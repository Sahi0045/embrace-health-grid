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
import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";

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
  .validator((data: { patientDid: string }) => {
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
      "rx_id, patient_did, doctor_did, drugs, diagnosis, notes, status, signed, signed_at, content_hash, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { prescriptions: data ?? [] };
});

export const getPrescriptionsForPatient = createServerFn({ method: "GET" })
  .validator((data: { patientDid: string }) => {
    if (!data?.patientDid) throw new Error("patientDid is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: rows, error } = await supabase
      .from("prescriptions")
      .select(
        "rx_id, patient_did, doctor_did, drugs, diagnosis, notes, status, signed, signed_at, content_hash, created_at",
      )
      .eq("patient_did", data.patientDid)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { prescriptions: rows ?? [] };
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
      "appt_id, patient_did, doctor_did, slot, mode, specialty, status, reason, booked_at, suggested_slot",
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
  .validator((data: { doctorDid: string; slot: string; specialty?: string; mode?: string }) => {
    if (!data?.doctorDid || !data?.slot) throw new Error("doctorDid and slot are required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // The caller's own DID, so a patient cannot book on someone else's behalf.
    // appointments_insert_patient enforces this in RLS regardless.
    const profile = { primary_did: await callerPrimaryDid() };

    if (!profile?.primary_did) throw new Error("No DID associated with this account");

    const apptId = `appt_${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from("appointments").insert({
      appt_id: apptId,
      patient_did: profile.primary_did,
      doctor_did: data.doctorDid,
      slot: data.slot,
      mode: data.mode ?? "in-person",
      specialty: data.specialty ?? null,
      status: "pending",
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
    .select(
      "grant_id, patient_did, doctor_did, resource, status, granted_at, expires_at, revoked_at",
    )
    .order("granted_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { consents: data ?? [] };
});

export const grantConsent = createServerFn({ method: "POST" })
  .validator((data: { doctorDid: string; resource: string; expiresAt?: string }) => {
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

export const revokeConsent = createServerFn({ method: "POST" })
  .validator((data: { grantId: string }) => {
    if (!data?.grantId) throw new Error("grantId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // consents_update_patient restricts this to grants the caller issued.
    const { data: updated, error } = await supabase
      .from("consents")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("grant_id", data.grantId)
      .select("grant_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Consent not found, or you are not the grantor");

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
    .select("tx_id, actor_did, resource, action, outcome, severity, logged_at")
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
export const updateOwnProfile = createServerFn({ method: "POST" })
  .validator((data: { fullName?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const user = await requireSession();
    const supabase = getSupabaseServerClient();

    const patch: Record<string, unknown> = {};
    if (data.fullName) patch.full_name = data.fullName;
    if (!Object.keys(patch).length) return { ok: true as const, changed: false };

    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) throw new Error(error.message);
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
  .validator(
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
      reason: data.reason ?? null,
      updated_at: new Date().toISOString(),
    };

    // A proposed time is kept separate from the agreed one: until the patient
    // accepts, the slot they originally requested is still the booked time.
    if (status === "suggested") {
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
  .validator((data: { grantId: string }) => {
    if (!data?.grantId) throw new Error("grantId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: updated, error } = await supabase
      .from("consents")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("grant_id", data.grantId)
      .select("grant_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Consent request not found, or you are not the grantor");
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
  .validator((data: { patientDid: string; testName: string }) => {
    if (!data?.patientDid || !data?.testName) {
      throw new Error("patientDid and testName are required");
    }
    return data;
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
  .validator((data: { patientDid?: string }) => data ?? {})
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("solana_anchors")
      .select(
        "anchor_id, record_hash, record_type, record_id, status, signature, slot, anchored_at",
      )
      .order("anchored_at", { ascending: false });

    if (data.patientDid) query = query.eq("actor_did", data.patientDid);

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
  .validator(
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
  .validator((data: { subjectDid: string; periodDate: string; events: unknown[] }) => {
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
  .validator(
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
  .validator(
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
    return await invokeEdgeFunction("onboard-user", data);
  });

/**
 * Identity, wallet, DID and NFC operations.
 *
 * All dispatch to the identity-ops Edge Function, which holds IDENTITY_SECRET
 * and performs the privileged writes: dids and nfc_cards have no client INSERT
 * policy, and audit_events has no client write policy at all.
 */
export const identityOp = createServerFn({ method: "POST" })
  .validator((data: { op: string; [key: string]: unknown }) => {
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
  .validator((data: { authorityPubkey: string }) => {
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
  .validator(
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
