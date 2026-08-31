/**
 * Clinical data server functions — Embrace Health Grid
 *
 * Replaces the Express REST calls in src/lib/api.ts for clinical domains.
 *
 * Why these are server functions rather than direct browser queries
 * ----------------------------------------------------------------
 * The browser Supabase client deliberately stores no session (see
 * supabase.browser.ts) so that an XSS payload cannot read the access token.
 * The trade-off is that the browser client is not authenticated on its own, so
 * any user-scoped read has to run server-side where the httpOnly cookie is
 * available.
 *
 * These functions use the ANON key with the caller's session, so **RLS still
 * applies**. They are not a privilege escalation: a patient calling
 * getMedicalRecords receives only their own rows, enforced by Postgres, not by
 * the code here. The RLS test suite proves that directly.
 */

import { createServerFn } from "@tanstack/react-start";
import {
  getSupabaseServerClient,
  getSupabaseServiceRoleClient,
  getVerifiedUser,
} from "./supabase.server";
import {
  resolveCallerForAudit,
  tryWriteAudit,
  buildPrescriptionAudit,
} from "./audit-helpers.server";

/** Reject unauthenticated callers before touching the database. */
/**
 * The caller's own primary DID.
 *
 * Filtered by id: a clinician's RLS view spans their hospital, so an unfiltered
 * .single() on profiles throws "Cannot coerce the result to a single JSON object"
 * as soon as a colleague exists.
 */
async function callerPrimaryDid(): Promise<string | null> {
  const user = await getVerifiedUser();
  if (!user) return null;

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("primary_did")
    .eq("id", user.id)
    .maybeSingle();

  return data?.primary_did ?? null;
}

async function requireSession() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ─── Medical records ────────────────────────────────────────────────────────

export const getMedicalRecords = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  // No patient filter needed: RLS returns own records, plus any the caller has
  // an active consent for. Adding a client-supplied DID filter here would be
  // redundant at best and a bug magnet at worst.
  const { data, error } = await supabase
    .from("medical_records")
    .select(
      "record_id, patient_did, title, record_type, content, author_name, content_hash, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { records: data ?? [] };
});

export const getMedicalRecordsForPatient = createServerFn({ method: "GET" })
  .inputValidator((data: { patientDid: string }) => {
    if (!data?.patientDid) throw new Error("patientDid is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // A clinician viewing a specific patient. If no consent exists RLS returns
    // an empty set rather than an error — absence of rows IS the denial.
    const { data: records, error } = await supabase
      .from("medical_records")
      .select(
        "record_id, patient_did, title, record_type, content, author_name, content_hash, created_at",
      )
      .eq("patient_did", data.patientDid)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { records: records ?? [] };
  });

// ─── Prescriptions ──────────────────────────────────────────────────────────

export const getPrescriptions = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("prescriptions")
    .select(
      // signed_by, appointment_id and reason all exist on the row and were not
      // selected, so the records screen fell back to a literal "Doctor" as the
      // prescriber and could never link a prescription to its appointment.
      "rx_id, patient_did, doctor_did, drugs, diagnosis, notes, status, signed, signed_by, signed_at, content_hash, appointment_id, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { prescriptions: data ?? [] };
});

export const getPrescriptionsForPatient = createServerFn({ method: "GET" })
  .inputValidator((data: { patientDid: string }) => {
    if (!data?.patientDid) throw new Error("patientDid is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: rows, error } = await supabase
      .from("prescriptions")
      .select(
        // signed_by, appointment_id and reason all exist on the row and were not
        // selected, so the records screen fell back to a literal "Doctor" as the
        // prescriber and could never link a prescription to its appointment.
        "rx_id, patient_did, doctor_did, drugs, diagnosis, notes, status, signed, signed_by, signed_at, content_hash, appointment_id, created_at",
      )
      .eq("patient_did", data.patientDid)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { prescriptions: rows ?? [] };
  });

/**
 * Update prescription details (admin only).
 *
 * Admins may update prescription details for clinical oversight and corrections.
 * The RLS policy prescriptions_update_admin restricts this to role='admin'.
 *
 * Immutable fields (rx_id, patient_did, doctor_did, signed, signed_by, signed_at)
 * are not updated to preserve audit integrity.
 */
export const updatePrescription = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      rxId: string;
      diagnosis?: string;
      notes?: string;
      status?: string;
      drugs?: any[];
    }) => {
      if (!data?.rxId) throw new Error("rxId is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // Capture previous state for audit trail before applying changes
    const { data: prevRow } = await supabase
      .from("prescriptions")
      .select("diagnosis, notes, status, drugs")
      .eq("rx_id", data.rxId)
      .maybeSingle();

    // Build the update patch with only the fields provided
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.diagnosis !== undefined) patch.diagnosis = data.diagnosis;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status !== undefined) {
      // Validate status against rx_status enum
      const validStatuses = ["active", "dispensed", "cancelled", "expired"];
      if (!validStatuses.includes(data.status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
      }
      patch.status = data.status;
    }
    if (data.drugs !== undefined) patch.drugs = data.drugs;

    // Only updated_at should change if no other fields provided
    if (Object.keys(patch).length === 1) {
      throw new Error("No fields to update");
    }

    const { data: updated, error } = await supabase
      .from("prescriptions")
      .update(patch)
      .eq("rx_id", data.rxId)
      .select("rx_id");

    if (error) {
      if (/row-level security/i.test(error.message)) {
        throw new Error("Only administrators can update prescriptions");
      }
      throw new Error(error.message);
    }

    if (!updated?.length) {
      throw new Error("Prescription not found or you do not have permission to update it");
    }

    // ── Rich audit record + blockchain proof ─────────────────────────────────
    const caller = await resolveCallerForAudit();
    tryWriteAudit(
      buildPrescriptionAudit(
        caller,
        data.rxId,
        prevRow
          ? {
              diagnosis: prevRow.diagnosis,
              notes: prevRow.notes,
              status: prevRow.status,
              drugCount: Array.isArray(prevRow.drugs) ? prevRow.drugs.length : 0,
            }
          : null,
        {
          diagnosis: data.diagnosis,
          notes: data.notes,
          status: data.status,
          drugCount: Array.isArray(data.drugs) ? data.drugs.length : undefined,
        },
      ),
    );

    return { ok: true as const, rxId: data.rxId };
  });

// ─── Lab results ────────────────────────────────────────────────────────────

export const getLabResults = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("lab_results")
    .select(
      "lab_id, patient_did, test_name, result_value, unit, reference_range, status, resulted_at, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { labResults: data ?? [] };
});

// ─── Appointments ───────────────────────────────────────────────────────────

export const getAppointments = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      // clinician_note is where updateAppointmentStatus writes the clinician's
      // note to the patient — including the rejection reason. It was never
      // selected, so staff.schedule.tsx's "Rejection note" line had nothing to
      // render on the rejected appointments that carry one.
      "appt_id, patient_did, doctor_did, slot, mode, specialty, status, reason, booked_at, suggested_slot, clinician_note, hospital_id",
    )
    .order("booked_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = data ?? [];

  // The appointments table stores DIDs only, so a caller that renders a name had
  // to resolve it itself — and none did, which is why confirming an appointment
  // reported "Appointment with undefined confirmed."
  //
  // Resolve here, once, from the DID registry: dids is readable by any
  // authenticated user and already carries owner_name, so this needs no extra
  // privilege and no PHI is involved.
  const dids = [
    ...new Set(rows.flatMap((r) => [r.patient_did, r.doctor_did]).filter(Boolean)),
  ] as string[];

  const names = new Map<string, string>();
  if (dids.length) {
    const { data: didRows } = await supabase.from("dids").select("did, owner_name").in("did", dids);

    for (const d of didRows ?? []) {
      if (d.did && d.owner_name) names.set(d.did, d.owner_name);
    }
  }

  const appointments = rows.map((r) => ({
    ...r,
    patient_name: names.get(r.patient_did) ?? null,
    doctor_name: names.get(r.doctor_did) ?? null,
  }));

  return { appointments };
});

export const bookAppointment = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      doctorDid: string;
      slot: string;
      specialty?: string;
      mode?: string;
      // `reason` is the patient's stated symptoms. appointments.reason exists,
      // but this validator and the insert below both omitted it, so the
      // "Reason for Visit" textarea was collected and silently discarded — the
      // clinician never received it, while the patient saw "request sent".
      reason?: string;
    }) => {
      if (!data?.doctorDid || !data?.slot) throw new Error("doctorDid and slot are required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // The caller's own DID, so a patient cannot book on someone else's behalf.
    // appointments_insert_patient enforces this in RLS regardless.
    const profile = { primary_did: await callerPrimaryDid() };

    if (!profile?.primary_did) throw new Error("No DID associated with this account");

    // Which hospital this appointment belongs to, taken from the clinician being
    // booked. A doctor belongs to exactly one hospital (enforce_staff_hospital),
    // so booking Dr X at Apollo is unambiguously an Apollo appointment — there is
    // nothing for the patient to choose and nothing to spoof from the request.
    //
    // This was never stamped, so every appointment had hospital_id NULL: a
    // hospital could not list its own appointments, and a patient's visit was not
    // attributable to the hospital they actually attended.
    //
    // Provenance only, per the Stage 4 PHI decision — appointments_select_involved
    // still governs access, so a referral keeps working across hospitals.
    const { data: doctorDid } = await supabase
      .from("dids")
      .select("hospital_id, owner_type, status")
      .eq("did", data.doctorDid)
      .maybeSingle();

    if (!doctorDid) throw new Error("Unknown clinician");
    if (doctorDid.status !== "active") {
      throw new Error("That clinician's DID is not active and cannot take bookings");
    }

    // Enforce the tenant boundary HERE, not just in the picker.
    //
    // The booking list was previously the cross-hospital referral directory, so
    // patients were shown every clinician on the platform. Scoping the list
    // (getBookableDoctors) fixes what is OFFERED; this fixes what can be
    // BOOKED. doctorDid arrives in the request body, so a filtered dropdown is
    // presentation, not a control — without this check the original bug is one
    // curl away.
    const { data: me } = await supabase
      .from("profiles")
      .select("hospital_id")
      .eq("id", (await requireSession()).id)
      .maybeSingle();

    if (!me?.hospital_id) {
      throw new Error("Your account is not linked to a hospital, so appointments cannot be booked");
    }
    if (doctorDid.hospital_id !== me.hospital_id) {
      throw new Error("You can only book with clinicians at the hospital you are registered with");
    }

    const apptId = `appt_${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from("appointments").insert({
      appt_id: apptId,
      patient_did: profile.primary_did,
      doctor_did: data.doctorDid,
      slot: data.slot,
      mode: data.mode ?? "in-person",
      specialty: data.specialty ?? null,
      reason: data.reason?.trim() || null,
      status: "pending",
      hospital_id: doctorDid.hospital_id,
    });

    if (error) throw new Error(error.message);
    return { ok: true as const, apptId };
  });

// ─── Consents ───────────────────────────────────────────────────────────────

export const getConsents = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("consents")
    // `reason` is the doctor's stated justification, written by
    // requestConsentAccess. It was never selected, so the consent screen fell
    // back to a hardcoded "Patient Care and Record Access" — the patient
    // approved access while reading an invented justification. approved_at and
    // requested_at matter too: the doctor read policies require approved_at to
    // be non-null, so the UI needs it to show a grant's true state.
    .select(
      "grant_id, patient_did, doctor_did, resource, status, reason, granted_at, expires_at, revoked_at, requested_at, approved_at, rejected_at",
    )
    .order("granted_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { consents: data ?? [] };
});

export const grantConsent = createServerFn({ method: "POST" })
  .inputValidator((data: { doctorDid: string; resource: string; expiresAt?: string }) => {
    if (!data?.doctorDid || !data?.resource) throw new Error("doctorDid and resource are required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const profile = { primary_did: await callerPrimaryDid() };
    if (!profile?.primary_did) throw new Error("No DID associated with this account");

    const grantId = `consent_${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from("consents").insert({
      grant_id: grantId,
      patient_did: profile.primary_did,
      doctor_did: data.doctorDid,
      resource: data.resource,
      status: "active",
      expires_at: data.expiresAt ?? null,
    });

    if (error) throw new Error(error.message);
    return { ok: true as const, grantId };
  });

/**
 * Clinician asks a patient for access to a resource.
 *
 * Writes a pending row into `consents`. The clinician cannot create an active
 * grant — consents_insert_clinician_request constrains status to 'pending' and
 * requires doctor_did to be one of the caller's own DIDs, so this cannot be used
 * to self-authorise or to request in a colleague's name.
 *
 * Replaces an Express POST to /consent/request against a server that no longer
 * exists, which is why "Request Access" on /staff/consent silently did nothing.
 */
export const requestConsentAccess = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { patientDid: string; resource: string; expiresAt?: string; reason?: string }) => {
      if (!data?.patientDid || !data?.resource) {
        throw new Error("patientDid and resource are required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const doctorDid = await callerPrimaryDid();
    if (!doctorDid) throw new Error("No DID associated with this account");
    if (doctorDid === data.patientDid) {
      // Also enforced by the consents_no_self_grant constraint.
      throw new Error("Cannot request access to your own records");
    }

    const grantId = `req_${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from("consents").insert({
      grant_id: grantId,
      patient_did: data.patientDid,
      doctor_did: doctorDid,
      resource: data.resource,
      status: "pending",
      expires_at: data.expiresAt ?? null,
      // The request timeline. medical_records_select_doctor and
      // prescriptions_select_doctor both require approved_at IS NOT NULL, so a
      // request starts with it unset and only gains it on approval.
      requested_at: new Date().toISOString(),
      approved_at: null,
      reason: data.reason ?? null,
    });

    if (error) throw new Error(error.message);
    return { ok: true as const, grantId };
  });

/**
 * Sign a consent decision and attach the proof to the row.
 *
 * Runs AFTER the decision is committed, and never blocks it. An unsigned
 * decision is still a valid decision; a revoke that failed because the key
 * service was down would be a safety problem.
 */
async function attachConsentSignature(grantId: string, decision: string, decidedAt: string) {
  try {
    const supabase = getSupabaseServerClient();
    const { data: row } = await supabase
      .from("consents")
      .select("grant_id, patient_did, doctor_did, resource")
      .eq("grant_id", grantId)
      .maybeSingle();
    if (!row) return;

    const { signConsentDecision } = await import("./consent-signing.server");
    const signed = await signConsentDecision({
      grantId: row.grant_id,
      patientDid: row.patient_did,
      doctorDid: row.doctor_did,
      resource: row.resource,
      decision,
      decidedAt,
    });
    if (!signed) return;

    // service_role: consents_update_patient would allow this, but the write must
    // not depend on the caller still satisfying a policy that the trigger guard
    // deliberately narrows after a terminal transition.
    const db = getSupabaseServiceRoleClient();
    const { data: signedRows, error: signErr } = await db
      .from("consents")
      .update({
        patient_signature: signed.signature,
        signed_payload: signed.payload,
        signing_public_key: signed.publicKey,
      })
      .eq("grant_id", grantId)
      .select("grant_id");

    if (signErr) throw new Error(signErr.message);
    if (!signedRows?.length) {
      throw new Error(`No consent row ${grantId} to attach the signature to`);
    }
  } catch (err) {
    console.warn(`Consent ${grantId} left unsigned:`, (err as Error).message);
  }
}

/**
 * Patient approves a pending request, in place.
 *
 * The approve path used to call grantConsent(), which INSERTS a fresh active row
 * and left the pending one pending — so an approved request stayed in the
 * patient's Requests tab forever and the grant was duplicated. Flipping the
 * existing row keeps one record per decision and preserves its grant_id, which
 * the audit trail references.
 *
 * Only the patient can do this: consents_update_patient restricts UPDATE to rows
 * whose patient_did is one of the caller's DIDs, so a clinician cannot approve
 * their own request.
 */
export const approveConsentRequest = createServerFn({ method: "POST" })
  .inputValidator((data: { grantId: string; expiresAt?: string }) => {
    if (!data?.grantId) throw new Error("grantId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      status: "active",
      granted_at: now,
      // Required by medical_records_select_doctor and prescriptions_select_doctor,
      // which both test approved_at IS NOT NULL. Without it a consent would look
      // active and still open no records.
      approved_at: now,
    };
    if (data.expiresAt) update.expires_at = data.expiresAt;

    const { data: updated, error } = await supabase
      .from("consents")
      .update(update)
      .eq("grant_id", data.grantId)
      .eq("status", "pending")
      .select("grant_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) {
      throw new Error("Request not found, already decided, or you are not the patient");
    }

    await attachConsentSignature(data.grantId, "approved", now);
    return { ok: true as const, grantId: data.grantId };
  });

export const revokeConsent = createServerFn({ method: "POST" })
  .inputValidator((data: { grantId: string }) => {
    if (!data?.grantId) throw new Error("grantId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // consents_update_patient restricts this to grants the caller issued.
    const revokedAt = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("consents")
      .update({ status: "revoked", revoked_at: revokedAt })
      .eq("grant_id", data.grantId)
      .select("grant_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Consent not found, or you are not the grantor");

    await attachConsentSignature(data.grantId, "revoked", revokedAt);
    return { ok: true as const };
  });

// ─── DIDs and credentials ───────────────────────────────────────────────────

export const getAllDIDs = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("dids")
    .select(
      // hospital_id is required so callers can tell an own-hospital DID from one
      // visible only through the cross-hospital clinician directory.
      "did, owner_name, owner_type, public_key, controller, status, created_at, is_organisation, hospital_id",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { dids: data ?? [], total: data?.length ?? 0 };
});

export const getCredentials = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("credentials")
    .select(
      "id, credential_type, issuer, subject_did, claims, signature, status, issued_at, expires_at",
    )
    .order("issued_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { credentials: data ?? [] };
});

// ─── Blockchain verification data ───────────────────────────────────────────

/**
 * Anchors and merkle roots are readable by any authenticated user because
 * verification must not require trusting a server: the client recomputes
 * SHA-256 over public data and compares. These are hashes, never PHI.
 */
export const getAnchors = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("solana_anchors")
    .select(
      "anchor_id, record_hash, record_type, record_id, status, signature, slot, network, anchored_at, confirmed_at",
    )
    .order("anchored_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return { anchors: data ?? [] };
});

export const getMerkleRoots = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("merkle_roots")
    .select(
      "publish_id, subject_did, root_hash, event_count, event_ids, period_date, anchor_id, published_at",
    )
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return { roots: data ?? [] };
});

// ─── Audit trail ────────────────────────────────────────────────────────────

export const getAuditEvents = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  // RLS: own trail, or everything for an admin.
  const { data, error } = await supabase
    .from("audit_events")
    // who_role, who_name, the entity linkage and the anchor columns all exist
    // and were not selected, so the access-history screen showed a constant
    // "System Actor" for every row and fabricated per-event hashes from the tx
    // id rather than displaying the real record_hash.
    .select(
      // `metadata` carries the clinician's stated justification for a
      // break-glass override (break-glass/index.ts:71 writes `{reason}`). It was
      // never selected, so the ED substituted the constant "Emergency access"
      // where the real reason belongs.
      "tx_id, actor_did, resource, action, outcome, severity, logged_at, who_name, who_role, what_entity_id, what_entity_type, record_hash, anchor_status, metadata",
    )
    .order("logged_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return { events: data ?? [] };
});

// ─── Realtime socket token ──────────────────────────────────────────────────

/**
 * Mint the access token used to authenticate the Realtime WebSocket.
 *
 * The browser client deliberately holds no session, so subscriptions would
 * otherwise be anonymous and RLS-protected tables would deliver no events.
 * Only the server can read the httpOnly cookie, so it hands the token over
 * explicitly.
 *
 * The token is passed to supabase.realtime.setAuth() and never persisted to
 * localStorage, sessionStorage, or any JS-readable cookie. It is short-lived
 * and refreshed by calling this again.
 */
export const getRealtimeToken = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getVerifiedUser();
  if (!user) return { token: null as string | null };

  const supabase = getSupabaseServerClient();
  const { data } = await supabase.auth.getSession();

  return { token: data.session?.access_token ?? null };
});

// ─── Platform / infrastructure ──────────────────────────────────────────────

/**
 * Platform health.
 *
 * The Express version pinged GET /health on localhost:3001. There is no such
 * server in production, so this now checks reachability of the actual backend:
 * a trivial Postgres round trip through RLS.
 */
export const getPlatformHealth = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getSupabaseServerClient();
  const startedAt = Date.now();

  // `head: true` fetches no rows — we only care that the round trip succeeds.
  const { error } = await supabase.from("dids").select("did", { count: "exact", head: true });

  return {
    online: !error,
    latencyMs: Date.now() - startedAt,
    error: error?.message ?? null,
  };
});

/**
 * Dashboard counters.
 *
 * Replaces getStats(), which returned hardcoded mock data from Express — the
 * README listed that as a known issue. These are real counts.
 *
 * Note the numbers are RLS-scoped: a patient sees counts over rows they may
 * read, an admin sees more. That is intentional; a count is still data.
 */
export const getPlatformStats = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const counted = async (table: string) => {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    return error ? 0 : (count ?? 0);
  };

  const [dids, credentials, anchors, roots, records, audits] = await Promise.all([
    counted("dids"),
    counted("credentials"),
    counted("solana_anchors"),
    counted("merkle_roots"),
    counted("medical_records"),
    counted("audit_events"),
  ]);

  // Latest confirmed anchor stands in for "chain tip" in the old UI.
  const { data: latestAnchor } = await supabase
    .from("solana_anchors")
    .select("slot, confirmed_at")
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    didCount: dids,
    credentialCount: credentials,
    anchorCount: anchors,
    merkleRootCount: roots,
    recordCount: records,
    auditCount: audits,
    latestSlot: latestAnchor?.slot ?? null,
    lastAnchoredAt: latestAnchor?.confirmed_at ?? null,
  };
});

/**
 * Directory of user profiles. Admin-scoped by RLS (profiles_select_staff), so a
 * patient calling this receives only their own row.
 */
export const getProfiles = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, primary_did, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { profiles: data ?? [] };
});

// ─── Writes on existing clinical tables (task 3) ────────────────────────────

/**
 * Update the caller's own profile.
 *
 * profiles_update_own restricts this to the caller's row, and its WITH CHECK
 * clause forbids changing `role`, so this cannot be used for privilege
 * escalation.
 */
/**
 * Update the signed-in user's own profile.
 *
 * This used to accept only `fullName` and silently drop everything else, so the
 * profile dialog appeared to save but phone, age, gender, blood group and
 * allergies were discarded — the reported "updates in the backend but not in the
 * UI" was in fact "never written, and never read back either".
 *
 * Each field is applied only when present, so a partial update cannot blank the
 * rest. Empty string clears a text field deliberately; undefined leaves it alone.
 */
/**
 * Record a prescription.
 *
 * Signing a prescription used to only mint a PrescriptionVC through the
 * sign-credential Edge Function; nothing was ever written to public.prescriptions.
 * The doctor saw "signed successfully" and the patient portal, which reads that
 * table, stayed empty — the credential existed but the prescription did not.
 *
 * doctor_did comes from the session, never the request, and
 * prescriptions_insert_clinician additionally requires an active consent from the
 * patient, so this cannot be used to write a prescription for someone the caller
 * has no relationship with.
 *
 * There is deliberately no client UPDATE policy: a signed prescription is
 * immutable, and a correction is a new row.
 */
export const createPrescription = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      patientDid: string;
      drugs?: unknown[];
      diagnosis?: string;
      notes?: string;
      signedBy?: string;
      contentHash?: string;
      rxId?: string;
    }) => {
      if (!data?.patientDid) throw new Error("patientDid is required");
      if (!Array.isArray(data.drugs) || data.drugs.length === 0) {
        throw new Error("At least one drug is required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const doctorDid = await callerPrimaryDid();
    if (!doctorDid) throw new Error("No DID associated with this account");

    const rxId = data.rxId || `rx_${crypto.randomUUID().slice(0, 8)}`;

    const { error } = await supabase.from("prescriptions").insert({
      rx_id: rxId,
      patient_did: data.patientDid,
      doctor_did: doctorDid,
      drugs: data.drugs,
      diagnosis: data.diagnosis ?? null,
      notes: data.notes ?? null,
      status: "active",
      signed: true,
      signed_by: data.signedBy ?? doctorDid,
      signed_at: new Date().toISOString(),
      content_hash: data.contentHash ?? null,
    });

    if (error) throw new Error(error.message);
    return { ok: true as const, rxId };
  });

export const updateOwnProfile = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      fullName?: string;
      phone?: string;
      age?: number | string | null;
      gender?: string;
      bloodGroup?: string;
      allergies?: string[] | string;
      department?: string;
      title?: string;
      specializations?: string[] | string;
      employeeId?: string;
      // Added by 20260825020000. These were accepted by the emergency dialog and
      // dropped in transit because no column existed.
      emergencyContact?: { name?: string; relation?: string; phone?: string } | null;
      organDonor?: boolean | null;
      conditions?: string[] | string;
      // Deliberately absent: `role`. That is the authorization role RLS reads,
      // and profiles_update_own rejects a change to it anyway. The staff form's
      // "Role / Title" is a job title and maps to `title`.
    }) => data ?? {},
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const supabase = getSupabaseServerClient();

    const patch: Record<string, unknown> = {};

    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    if (data.gender !== undefined) patch.gender = data.gender || null;
    if (data.bloodGroup !== undefined) patch.blood_group = data.bloodGroup || null;

    if (data.age !== undefined) {
      // The form sends a string, and parseInt("") is NaN, which Postgres rejects
      // for an int column.
      const n = typeof data.age === "number" ? data.age : parseInt(String(data.age ?? ""), 10);
      patch.age = Number.isFinite(n) ? n : null;
    }

    if (data.department !== undefined) patch.department = data.department || null;
    if (data.title !== undefined) patch.title = data.title || null;
    if (data.employeeId !== undefined) patch.employee_id = data.employeeId || null;

    if (data.emergencyContact !== undefined) {
      const c = data.emergencyContact;
      patch.emergency_contact_name = c?.name?.trim() || null;
      patch.emergency_contact_relation = c?.relation?.trim() || null;
      patch.emergency_contact_phone = c?.phone?.trim() || null;
    }

    // Tri-state: undefined means "not submitted", null means "not answered".
    if (data.organDonor !== undefined) patch.organ_donor = data.organDonor;

    if (data.conditions !== undefined) {
      patch.conditions = Array.isArray(data.conditions)
        ? data.conditions
        : String(data.conditions)
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
    }

    if (data.specializations !== undefined) {
      // Same accommodation as allergies: the dialog sends a comma-separated
      // string, callers with real data send an array.
      patch.specializations = Array.isArray(data.specializations)
        ? data.specializations
        : String(data.specializations)
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
    }

    if (data.allergies !== undefined) {
      // Accept either a real array or the comma-separated string the dialog uses.
      const list = Array.isArray(data.allergies)
        ? data.allergies
        : String(data.allergies)
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean);
      patch.allergies = list;
    }

    if (!Object.keys(patch).length) return { ok: true as const, changed: false };

    // RLS restricts this to the caller's own row; the id filter makes that
    // explicit rather than relying on the policy alone.
    const { data: updated, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select("id");

    if (error) throw new Error(error.message);
    // An RLS-filtered update matches zero rows without erroring, which would
    // report a saved profile that was never written.
    if (!updated?.length) throw new Error("Your profile could not be updated");
    return { ok: true as const, changed: true };
  });

/** Confirm, reschedule or cancel an appointment. RLS limits it to both parties. */
/**
 * status is a Postgres enum, so a label it does not contain fails the write
 * outright. The UI speaks in verbs ("accept"), the database in states
 * ("confirmed"); translate here rather than letting either side leak into the
 * other. Confirming an appointment used to fail with
 * `invalid input value for enum appt_status: "accepted"`.
 */
const APPT_STATUS_ALIASES: Record<string, string> = {
  accept: "confirmed",
  accepted: "confirmed",
  reject: "rejected",
  decline: "rejected",
  declined: "rejected",
  suggest: "suggested",
  reschedule: "suggested",
  cancel: "cancelled",
  canceled: "cancelled",
  complete: "completed",
};

/** Every label the appt_status enum actually accepts. */
const APPT_STATUSES = new Set([
  "pending",
  "confirmed",
  "rejected",
  "rescheduled",
  "cancelled",
  "completed",
  "suggested",
]);

export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { apptId: string; status: string; reason?: string; suggestedSlot?: string }) => {
      if (!data?.apptId || !data?.status) throw new Error("apptId and status are required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const raw = String(data.status).toLowerCase();
    const status = APPT_STATUS_ALIASES[raw] ?? raw;

    if (!APPT_STATUSES.has(status)) {
      throw new Error(`Unknown appointment status: ${data.status}`);
    }

    const patch: Record<string, unknown> = {
      status,
      // `reason` is the PATIENT's stated reason for the visit, written at
      // booking. This used to patch it unconditionally with the caller's
      // optional note-to-patient — which defaults to "" — so confirming an
      // appointment silently erased the patient's symptoms. The clinician's note
      // now has its own column and `reason` is never touched here.
      updated_at: new Date().toISOString(),
    };

    if (data.reason !== undefined) {
      patch.clinician_note = data.reason;
    }

    // A proposed time is kept separate from the agreed one: until the patient
    // accepts, the slot they originally requested is still the booked time.
    //
    // `rescheduled` is included alongside `suggested`. Both are valid members of
    // appt_status and staff.schedule.tsx sends `rescheduled` while
    // staff.appointments.tsx sends `suggest`; only the latter used to reach this
    // branch, so "Suggest Time" from the schedule view reported "New time
    // suggested — patient has been notified" and wrote no slot at all.
    if (status === "suggested" || status === "rescheduled") {
      if (!data.suggestedSlot) {
        throw new Error("A suggested time is required when proposing a reschedule");
      }
      patch.suggested_slot = data.suggestedSlot;
    }

    const { data: updated, error } = await supabase
      .from("appointments")
      .update(patch)
      .eq("appt_id", data.apptId)
      .select("appt_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Appointment not found, or you are not a party to it");
    return { ok: true as const };
  });

/** Deny a consent request — only the patient who would grant it may do so. */
export const denyConsent = createServerFn({ method: "POST" })
  .inputValidator((data: { grantId: string }) => {
    if (!data?.grantId) throw new Error("grantId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const rejectedAt = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("consents")
      // Was writing `revoked`, so a request the patient REFUSED became
      // indistinguishable in the history from access they granted and later
      // withdrew. The enum has `rejected` and the table has `rejected_at`; both
      // existed and were unused.
      .update({ status: "rejected", rejected_at: rejectedAt })
      .eq("grant_id", data.grantId)
      .select("grant_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Consent request not found, or you are not the grantor");

    await attachConsentSignature(data.grantId, "rejected", rejectedAt);
    return { ok: true as const };
  });

/**
 * Order a lab test.
 *
 * Written by service_role in the Express version. Here the ordering clinician
 * must hold an active consent, which is checked explicitly because lab_results
 * has no client INSERT policy — results arrive from the lab, not the browser.
 */
export const orderLabTest = createServerFn({ method: "POST" })
  .inputValidator((data: { patientDid: string; testName: string; priority?: string }) => {
    if (!data?.patientDid || !data?.testName) {
      throw new Error("patientDid and testName are required");
    }
    // Reject an unknown urgency rather than silently filing it as routine —
    // quietly downgrading a STAT order is the bug this parameter exists to fix.
    const priority = data.priority ?? "routine";
    if (!["stat", "urgent", "routine"].includes(priority)) {
      throw new Error(`Unknown lab priority: ${priority}`);
    }
    return { ...data, priority };
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // Confirm the caller can see this patient at all. If RLS returns nothing,
    // there is no consent and the order must not be created.
    const { data: visible } = await supabase
      .from("medical_records")
      .select("patient_did")
      .eq("patient_did", data.patientDid)
      .limit(1);

    const ownDid = { primary_did: await callerPrimaryDid() };
    const isOwnPatient = ownDid?.primary_did === data.patientDid;

    if (!visible?.length && !isOwnPatient) {
      throw new Error("Cannot order a lab for this patient: no active consent");
    }

    const labId = `LAB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error } = await supabase.from("lab_results").insert({
      lab_id: labId,
      patient_did: data.patientDid,
      ordered_by: ownDid?.primary_did ?? null,
      test_name: data.testName,
      priority: data.priority,
      status: "ordered",
    });

    if (error) {
      if (/row-level security/i.test(error.message)) {
        throw new Error("Lab orders are placed by the laboratory system");
      }
      throw new Error(error.message);
    }
    return { ok: true as const, labId };
  });

/** On-chain anchor history for one patient — hashes only, never PHI. */
export const getPatientAnchorHistory = createServerFn({ method: "GET" })
  .inputValidator((data: { patientDid?: string }) => data ?? {})
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // `network` was omitted from the select, so every consumer fell back to a
    // hardcoded "Solana Devnet" label instead of reporting the anchor's own chain.
    let query = supabase
      .from("solana_anchors")
      .select(
        "anchor_id, record_hash, record_type, record_id, status, signature, slot, network, anchored_at",
      )
      .order("anchored_at", { ascending: false });

    if (data.patientDid) {
      // actor_did is the DID that PERFORMED the anchoring — for a prescription
      // that is the prescribing doctor, not the patient. Filtering it by the
      // patient DID therefore matched nothing, and the on-chain history panel
      // reported "no history found" for every patient who had one.
      //
      // The patient's anchors are the ones whose record_id is a record of
      // theirs, so resolve the record ids first. Both reads go through the
      // request-scoped client, so RLS still decides what the caller may see.
      const [rxRes, recRes] = await Promise.all([
        supabase.from("prescriptions").select("rx_id").eq("patient_did", data.patientDid),
        supabase.from("medical_records").select("record_id").eq("patient_did", data.patientDid),
      ]);

      const recordIds = [
        ...(rxRes.data ?? []).map((r: { rx_id: string }) => r.rx_id),
        ...(recRes.data ?? []).map((r: { record_id: string }) => r.record_id),
      ];

      // No records means no anchors — return empty rather than an unfiltered read.
      if (!recordIds.length) return { anchors: [] };
      query = query.in("record_id", recordIds);
    }

    const { data: anchors, error } = await query;
    if (error) throw new Error(error.message);
    return { anchors: anchors ?? [] };
  });

// ─── Writes that must go through Edge Functions ─────────────────────────────

/**
 * Invoke a deployed Edge Function on the caller's behalf.
 *
 * Some operations cannot be plain table writes because they need a secret the
 * browser must never hold — the Solana wallet key, the VC issuer key. Those run
 * as Edge Functions; this forwards the caller's verified session so the function
 * can authorise them.
 */
async function invokeEdgeFunction(name: string, payload: unknown) {
  const supabase = getSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `${name} failed with status ${res.status}`);
  }
  return body;
}

/**
 * Anchor a record hash on Solana devnet.
 * Real on-chain transaction — the wallet key lives only in the Edge Function.
 */
export const anchorRecord = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { subjectDid: string; recordHash: string; recordType: string; recordId?: string }) => {
      if (!data?.subjectDid || !data?.recordHash || !data?.recordType) {
        throw new Error("subjectDid, recordHash and recordType are required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    return await invokeEdgeFunction("anchor-record", data);
  });

/** Publish a merkle root for a subject/day. */
export const publishMerkleRoot = createServerFn({ method: "POST" })
  .inputValidator((data: { subjectDid: string; periodDate: string; events: unknown[] }) => {
    if (!data?.subjectDid || !data?.periodDate || !Array.isArray(data?.events)) {
      throw new Error("subjectDid, periodDate and events[] are required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    return await invokeEdgeFunction("publish-merkle-root", data);
  });

/** Issue a signed Verifiable Credential (issuer key stays server-side). */
export const signCredential = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { subjectDid: string; credentialType: string; claims?: Record<string, unknown> }) => {
      if (!data?.subjectDid || !data?.credentialType) {
        throw new Error("subjectDid and credentialType are required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    return await invokeEdgeFunction("sign-credential", data);
  });

/**
 * Onboard a person: account, DID, signed identity credential, optional NFC card.
 *
 * A single Edge Function call because every one of those tables has no client
 * INSERT policy, and because partial failure must roll back — an account that
 * can sign in but has no DID is worse than no account.
 *
 * Admins may onboard any role; staff and doctors may onboard patients only.
 */
export const onboardUser = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      email: string;
      password: string;
      fullName: string;
      role: "patient" | "doctor" | "staff" | "admin";
      issueNfcCard?: boolean;
      mrn?: string;
      department?: string;
      specialty?: string;
    }) => {
      if (!data?.email || !data?.password || !data?.fullName || !data?.role) {
        throw new Error("email, password, fullName and role are required");
      }
      if (data.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const res = (await invokeEdgeFunction("onboard-user", data)) as { did?: string } | null;

    // onboard-user issues the DID with a `pk_<uuid>` placeholder — it runs in
    // Deno and cannot reach the Node key service. Provision the real signing key
    // now so a newly onboarded person is not left with a keyless identity.
    //
    // Non-fatal: the account, profile, DID and credential are all created and
    // usable by this point. A failure here is recoverable by re-running
    // backend/scripts/provision-did-wallets.js, and failing the whole onboarding
    // over it would be worse.
    if (res?.did) {
      try {
        const { didWalletService } = await import("./embedded-wallet.server");
        await didWalletService.getOrCreateWalletForDid(res.did);
      } catch (err) {
        console.warn(`Onboarded DID ${res.did} has no signing key yet:`, (err as Error).message);
      }
    }

    return res;
  });

/**
 * Identity, wallet, DID and NFC operations.
 *
 * All dispatch to the identity-ops Edge Function, which holds IDENTITY_SECRET
 * and performs the privileged writes: dids and nfc_cards have no client INSERT
 * policy, and audit_events has no client write policy at all.
 */
export const identityOp = createServerFn({ method: "POST" })
  .inputValidator((data: { op: string; [key: string]: unknown }) => {
    if (!data?.op) throw new Error("op is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    return await invokeEdgeFunction("identity-ops", data);
  });

/**
 * Build an UNSIGNED anchoring transaction for the patient to sign themselves.
 *
 * Distinct from the anchor-record Edge Function, which signs with the platform
 * wallet. Here the patient is the on-chain authority: they connect Phantom and
 * sign, so their records are anchored under a key only they control. The server
 * never holds the patient's key — it only assembles the instruction.
 *
 * Returns a base64 serialised transaction plus the merkle root it commits to.
 */
export const buildPatientAnchorTx = createServerFn({ method: "POST" })
  .inputValidator((data: { authorityPubkey: string }) => {
    if (!data?.authorityPubkey) throw new Error("authorityPubkey is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const profile = { primary_did: await callerPrimaryDid() };
    if (!profile?.primary_did) throw new Error("No DID associated with this account");
    const patientDid = profile.primary_did;

    // Records visible to the caller — RLS guarantees these are their own.
    const { data: records, error } = await supabase
      .from("medical_records")
      .select("record_id, content_hash")
      .eq("patient_did", patientDid)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    if (!records?.length) throw new Error("No records to anchor");

    // Merkle root over record hashes, matching lib/merkle-tree.js semantics
    // (pairwise SHA-256, last node duplicated on an odd count).
    const sha256Hex = async (input: string) => {
      const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
      return Array.from(new Uint8Array(d))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    };

    let level = await Promise.all(records.map((r) => sha256Hex(r.content_hash ?? r.record_id)));
    while (level.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        next.push(await sha256Hex(level[i] + (level[i + 1] ?? level[i])));
      }
      level = next;
    }
    const merkleRoot = level[0];

    // Assemble the Anchor instruction. Imported lazily so @solana/web3.js is
    // not pulled into unrelated server bundles.
    const { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } =
      await import("@solana/web3.js");
    const { encodeRegisterPatientRoot, encodeUpdatePatientRoot } =
      await import("./anchor-encoding");

    const programId = process.env.VITE_SOLANA_PROGRAM_ID ?? process.env.SOLANA_PROGRAM_ID ?? "";
    if (!programId) throw new Error("SOLANA_PROGRAM_ID is not configured");

    const rpcUrl = process.env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    const authority = new PublicKey(data.authorityPubkey);

    const [pda] = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode("patient-root"), new TextEncoder().encode(patientDid)],
      new PublicKey(programId),
    );

    // register_* uses `init` and fails if the account exists.
    const existing = await connection.getAccountInfo(pda);
    const ixData = existing
      ? await encodeUpdatePatientRoot(patientDid, merkleRoot)
      : await encodeRegisterPatientRoot(patientDid, merkleRoot);

    const keys = existing
      ? [
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: authority, isSigner: true, isWritable: false },
        ]
      : [
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: authority, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ];

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys,
        programId: new PublicKey(programId),
        data: Buffer.from(ixData),
      }),
    );
    tx.feePayer = authority;
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    // requireAllSignatures: false — the patient's wallet signs client-side.
    const serialised = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

    return {
      ok: true as const,
      transactionPayload: Buffer.from(serialised).toString("base64"),
      merkleRoot,
      pda: pda.toBase58(),
      recordCount: records.length,
      instruction: existing ? "update_patient_root" : "register_patient_root",
    };
  });
/**
 * Create a medical record.
 *
 * Permitted directly because medical_records_insert_clinician requires the
 * caller to be a doctor/staff member WITH an active consent — RLS rejects the
 * insert otherwise, so no server-side role check is duplicated here.
 */
export const createMedicalRecord = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { patientDid: string; title: string; recordType: string; content?: string }) => {
      if (!data?.patientDid || !data?.title || !data?.recordType) {
        throw new Error("patientDid, title and recordType are required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const supabase = getSupabaseServerClient();

    // Filtered by id: a clinician's RLS view spans their hospital, so an
    // unfiltered .single() throws once a colleague exists.
    const { data: profile } = await supabase
      .from("profiles")
      .select("primary_did, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const recordId = `REC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // Hash the clinical content so it can be anchored on-chain without
    // exposing PHI. Only the digest ever leaves Postgres.
    const encoded = new TextEncoder().encode(
      JSON.stringify({
        recordId,
        patientDid: data.patientDid,
        title: data.title,
        content: data.content ?? "",
      }),
    );
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    const contentHash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { error } = await supabase.from("medical_records").insert({
      record_id: recordId,
      patient_did: data.patientDid,
      title: data.title,
      record_type: data.recordType,
      content: data.content ?? null,
      author_did: profile?.primary_did ?? null,
      author_name: profile?.full_name ?? null,
      content_hash: contentHash,
    });

    if (error) {
      // An RLS rejection here means no active consent — surface that plainly.
      if (/row-level security/i.test(error.message)) {
        throw new Error("Cannot create a record for this patient: no active consent");
      }
      throw new Error(error.message);
    }

    return { ok: true as const, recordId, contentHash };
  });

/**
 * Detach the caller's own wallet.
 *
 * The counterpart to the admin action in hospitals.server.ts, and the one a
 * user should reach for first: profiles_update_own already permits a user to
 * write their own row, so this needs no service-role client and no admin —
 * only the row-scoped policy that is already in force.
 *
 * `role` is untouched, so the policy's `role = private.current_user_role()`
 * check passes exactly as it does for any other self-service profile edit.
 */
export const unlinkOwnWallet = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireSession();
  const supabase = getSupabaseServerClient();

  const { data: before } = await supabase
    .from("profiles")
    .select("wallet_address, role, hospital_id, full_name, primary_did")
    .eq("id", user.id)
    .maybeSingle();

  if (!before?.wallet_address) return { ok: true as const, changed: false };

  const { data: unlinked, error } = await supabase
    .from("profiles")
    .update({ wallet_address: null })
    .eq("id", user.id)
    .select("id");

  if (error) throw new Error(error.message);
  // An audit record saying the wallet was unlinked is written next; it must not
  // claim an unlink that did not happen.
  if (!unlinked?.length) throw new Error("Your wallet could not be unlinked");

  const { tryWriteAudit } = await import("./audit-helpers.server");
  tryWriteAudit({
    actorId: user.id,
    // These were all null, so the row had no tenant — and under the
    // hospital-scoped read policy an audit entry with no hospital is invisible
    // to every administrator. The profile is already being read above.
    actorDid: before.primary_did ?? null,
    actorName: before.full_name ?? null,
    actorRole: before.role ?? null,
    actorHospital: before.hospital_id ?? null,
    actorEmail: user.email ?? null,
    action: "WALLET_UNLINKED",
    outcome: "success",
    severity: "warning",
    module: "identity",
    entityId: user.id,
    entityType: "profile",
    resource: `Wallet ${before.wallet_address.slice(0, 4)}…${before.wallet_address.slice(-4)}`,
    hospital: before.hospital_id ?? null,
    location: "Profile → Solana Wallet",
    prevValue: { wallet_address: before.wallet_address },
    newValue: { wallet_address: null },
    authStatus: "authorized",
    authPolicy: "profiles_update_own",
    metadata: { selfService: true },
  });

  return { ok: true as const, changed: true, wallet: before.wallet_address };
});
