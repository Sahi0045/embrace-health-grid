/**
 * Inpatient, facility and billing server functions — Embrace Health Grid
 *
 * Final batch replacing Express reads. Same contract as clinical.server.ts and
 * operations.server.ts: server-side because the browser client holds no
 * session, and using the ANON key so RLS decides what each caller sees.
 *
 * No caller-supplied patient identifier filters these queries. RLS derives
 * scope from the session, so a patient receives only their own rows and a
 * clinician only rows for patients who granted consent.
 */

import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";

async function requireSession() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

async function callerDid(): Promise<string> {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = getSupabaseServerClient();
  // Filtered by id. An unfiltered .single() on profiles throws "Cannot coerce the
  // result to a single JSON object" for any caller whose RLS view spans more than
  // their own row — which is every clinician and admin.
  const { data } = await supabase
    .from("profiles")
    .select("primary_did")
    .eq("id", user.id)
    .maybeSingle();

  if (!data?.primary_did) throw new Error("No DID associated with this account");
  return data.primary_did;
}

/**
 * Shared reader for the patient-scoped clinical tables.
 *
 * Every one of these applies the identical RLS gate, so a single helper avoids
 * fifteen near-identical handlers. The table name is a closed set chosen by the
 * caller in this module — never a client-supplied string.
 */
async function selectAll(table: string, orderColumn: string, ascending = false) {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order(orderColumn, { ascending })
    .limit(300);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Inpatient care ─────────────────────────────────────────────────────────

export const getAdmissions = createServerFn({ method: "GET" }).handler(async () => ({
  admissions: await selectAll("admissions", "admitted_at"),
}));

export const getProcedures = createServerFn({ method: "GET" }).handler(async () => ({
  procedures: await selectAll("procedures", "created_at"),
}));

export const getSurgeries = createServerFn({ method: "GET" }).handler(async () => ({
  surgeries: await selectAll("surgeries", "scheduled_for"),
}));

export const getRehabSessions = createServerFn({ method: "GET" }).handler(async () => ({
  sessions: await selectAll("rehab_sessions", "session_date"),
}));

export const getMedications = createServerFn({ method: "GET" }).handler(async () => ({
  medications: await selectAll("medications", "started_on"),
}));

export const getPharmacyOrders = createServerFn({ method: "GET" }).handler(async () => ({
  orders: await selectAll("pharmacy_orders", "ordered_on"),
}));

export const getNursingNotes = createServerFn({ method: "GET" }).handler(async () => ({
  notes: await selectAll("nursing_notes", "recorded_at"),
}));

export const getDailyCheckups = createServerFn({ method: "GET" }).handler(async () => ({
  checkups: await selectAll("daily_checkups", "checkup_at"),
}));

export const getDietOrders = createServerFn({ method: "GET" }).handler(async () => ({
  dietOrders: await selectAll("diet_orders", "started_on"),
}));

export const getVaccines = createServerFn({ method: "GET" }).handler(async () => ({
  vaccines: await selectAll("vaccines", "administered_on"),
}));

/**
 * Everything the inpatient dashboard needs, in one round trip.
 *
 * Each query is independently RLS-filtered, so a patient with no admission
 * simply receives empty arrays rather than an error.
 */
export const getInpatientData = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();

  const [admissions, procedures, medications, nursingNotes, checkups, dietOrders, rehab] =
    await Promise.all([
      selectAll("admissions", "admitted_at"),
      selectAll("procedures", "created_at"),
      selectAll("medications", "started_on"),
      selectAll("nursing_notes", "recorded_at"),
      selectAll("daily_checkups", "checkup_at"),
      selectAll("diet_orders", "started_on"),
      selectAll("rehab_sessions", "session_date"),
    ]);

  return {
    admission: admissions[0] ?? null,
    admissions,
    procedures,
    medications,
    nursingNotes,
    dailyCheckups: checkups,
    dietOrders,
    rehabSessions: rehab,
  };
});

// ─── Patient preferences ────────────────────────────────────────────────────

export const getPatientPreferences = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.from("patient_preferences").select("*").maybeSingle();
  if (error) throw new Error(error.message);

  // Defaults matter: absent preferences must not read as "all sharing enabled".
  return {
    preferences: data ?? {
      emergency_access: true,
      insurance_verification: true,
      research_sharing: false,
      cross_hospital: false,
    },
  };
});

export const updatePatientPreferences = createServerFn({ method: "POST" })
  .validator((data: Record<string, unknown>) => data ?? {})
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const did = await callerDid();

    const { error } = await supabase.from("patient_preferences").upsert(
      {
        patient_did: did,
        emergency_access: (data.emergencyAccess as boolean) ?? true,
        insurance_verification: (data.insuranceVerification as boolean) ?? true,
        research_sharing: (data.researchSharing as boolean) ?? false,
        cross_hospital: (data.crossHospital as boolean) ?? false,
      },
      { onConflict: "patient_did" },
    );

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── Feedback ───────────────────────────────────────────────────────────────

export const getFeedback = createServerFn({ method: "GET" }).handler(async () => ({
  feedback: await selectAll("feedback", "created_at"),
}));

export const submitFeedback = createServerFn({ method: "POST" })
  .validator((data: { rating: number; doctor?: string; comments?: string }) => {
    if (!data?.rating || data.rating < 1 || data.rating > 5) {
      throw new Error("A rating between 1 and 5 is required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const did = await callerDid();

    const feedbackId = `FB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error } = await supabase.from("feedback").insert({
      feedback_id: feedbackId,
      patient_did: did,
      doctor: data.doctor ?? null,
      rating: data.rating,
      comments: data.comments ?? null,
    });

    if (error) throw new Error(error.message);
    return { ok: true as const, feedbackId };
  });

// ─── Facility assets ────────────────────────────────────────────────────────

export const getAmbulances = createServerFn({ method: "GET" }).handler(async () => ({
  ambulances: await selectAll("ambulances", "updated_at"),
}));

export const updateAmbulanceStatus = createServerFn({ method: "POST" })
  .validator((data: { ambulanceId: string; status: string; location?: string; driverName?: string }) => {
    if (!data?.ambulanceId) throw new Error("Ambulance ID is required");
    if (!data?.status) throw new Error("Status is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const updatePayload: Record<string, any> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.location !== undefined) updatePayload.current_location = data.location;
    if (data.driverName !== undefined) updatePayload.driver_name = data.driverName;

    const { error } = await supabase
      .from("ambulances")
      .update(updatePayload)
      .eq("ambulance_id", data.ambulanceId);

    if (error) throw new Error(error.message);
    return { ok: true as const, ambulanceId: data.ambulanceId, status: data.status };
  });

export const getEquipment = createServerFn({ method: "GET" }).handler(async () => ({
  equipment: await selectAll("equipment", "updated_at"),
}));

// ─── Fraud alerts (admin only by RLS) ───────────────────────────────────────

export const getFraudAlerts = createServerFn({ method: "GET" }).handler(async () => ({
  alerts: await selectAll("fraud_alerts", "detected_at"),
}));

// ─── Billing and payments ───────────────────────────────────────────────────

export const getBilling = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const [{ data: account }, { data: payments }] = await Promise.all([
    supabase.from("billing_accounts").select("*").maybeSingle(),
    supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  return {
    account: account ?? { outstanding: 0, total_billed: 0, total_paid: 0 },
    payments: payments ?? [],
  };
});

/**
 * Record a payment intent.
 *
 * Deliberately inserts with status 'pending' — the RLS policy enforces that, so
 * a client cannot mark a payment 'paid' without a real settlement. Confirmation
 * is a service_role operation once a provider webhook lands.
 */
export const recordPayment = createServerFn({ method: "POST" })
  .validator((data: { amount: number; method?: string; reference?: string }) => {
    if (!data?.amount || data.amount <= 0) throw new Error("A positive amount is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const did = await callerDid();

    const paymentId = `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error } = await supabase.from("payments").insert({
      payment_id: paymentId,
      patient_did: did,
      amount: data.amount,
      method: data.method ?? "card",
      reference: data.reference ?? null,
      status: "pending",
    });

    if (error) throw new Error(error.message);
    return { ok: true as const, paymentId, status: "pending" as const };
  });

// ─── Governance policies ────────────────────────────────────────────────────

export const getPolicies = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("governance_policies")
    .select("policy_id, name, category, status, description, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { policies: data ?? [] };
});

/** Author a policy. RLS restricts this to admins. */
export const createPolicy = createServerFn({ method: "POST" })
  .validator((data: { name: string; category?: string; description?: string; status?: string }) => {
    if (!data?.name) throw new Error("name is required");
    return data;
  })
  .handler(async ({ data }) => {
    const user = await requireSession();
    const supabase = getSupabaseServerClient();

    // A policy belongs to the hospital that authored it. Omitting hospital_id
    // fails governance_policies_update_admin later, since that check is
    // tenant-scoped.
    const { data: prof } = await supabase
      .from("profiles")
      .select("hospital_id")
      .eq("id", user.id)
      .maybeSingle();

    const policyId = `POL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error } = await supabase.from("governance_policies").insert({
      policy_id: policyId,
      hospital_id: prof?.hospital_id ?? null,
      name: data.name,
      category: data.category ?? null,
      description: data.description ?? null,
      status: (data.status as "active" | "draft" | "retired") ?? "draft",
      updated_by: user.id,
    });

    if (error) {
      if (/row-level security/i.test(error.message)) {
        throw new Error("Only administrators may create a policy");
      }
      throw new Error(error.message);
    }
    return { ok: true as const, policyId };
  });

/** Amend a policy. RLS restricts this to admins. */
export const updatePolicy = createServerFn({ method: "POST" })
  .validator((data: { policyId: string; [key: string]: unknown }) => {
    if (!data?.policyId) throw new Error("policyId is required");
    return data;
  })
  .handler(async ({ data }) => {
    const user = await requireSession();
    const supabase = getSupabaseServerClient();

    const patch: Record<string, unknown> = { updated_by: user.id };
    if (data.name) patch.name = data.name;
    if (data.category) patch.category = data.category;
    if (data.description) patch.description = data.description;
    if (data.status) patch.status = data.status;

    const { data: updated, error } = await supabase
      .from("governance_policies")
      .update(patch)
      .eq("policy_id", data.policyId)
      .select("policy_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) {
      throw new Error("Policy not found, or you are not permitted to amend it");
    }
    return { ok: true as const };
  });

// ─── Fraud alerts (admin) ───────────────────────────────────────────────────

/**
 * Update an alert's investigation status. RLS restricts this to admins, since
 * fraud alerts name a suspected actor.
 */
export const updateFraudAlertStatus = createServerFn({ method: "POST" })
  .validator((data: { alertId: string; status: string }) => {
    if (!data?.alertId || !data?.status) throw new Error("alertId and status are required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "resolved" || data.status === "dismissed") {
      patch.resolved_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabase
      .from("fraud_alerts")
      .update(patch)
      .eq("alert_id", data.alertId)
      .select("alert_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Alert not found, or administrators only");
    return { ok: true as const };
  });

// ─── Doctor directory ───────────────────────────────────────────────────────

/**
 * Clinician directory, derived from profiles + dids rather than a separate
 * table. A duplicated doctors table would drift out of step with the identity
 * records that actually govern access.
 */
export const getDoctors = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("dids")
    .select("did, owner_name, owner_type, status")
    .in("owner_type", ["doctor", "staff"])
    // A hospital's own DID is stored with owner_type 'staff' because user_role has
    // no organisation member, so without this the admin roster listed hospitals
    // as clinicians with an "Approve & Issue DID" button beside them.
    .eq("is_organisation", false)
    .eq("status", "active");

  if (error) throw new Error(error.message);
  return { doctors: data ?? [] };
});

/**
 * Patient directory.
 *
 * Reads the DID registry, not a PHI table — name and DID only, which is what a
 * roster needs. Patient clinical data still requires consent or ownership.
 *
 * This exists because useLivePatients() was wired to a stub that always returned
 * [], a leftover from the Express decommission. Twenty-two routes look people up
 * in that list, so every lookup missed and pages fell back to hardcoded demo
 * names.
 */
export const getPatientDirectory = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("dids")
    .select("did, owner_name, owner_type, status")
    .eq("owner_type", "patient")
    .eq("is_organisation", false)
    .eq("status", "active");

  if (error) throw new Error(error.message);

  // Attach email where a profile is visible, so lookups keyed by email resolve.
  // profiles_select_staff scopes this: a patient sees only their own row, so the
  // list stays name-only for them.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("primary_did, email, full_name");

  const byDid = new Map((profiles ?? []).map((p) => [p.primary_did, p]));

  const patients = (data ?? []).map((d) => {
    const profile = byDid.get(d.did);
    return {
      did: d.did,
      owner_name: d.owner_name,
      owner_type: d.owner_type,
      status: d.status,
      email: profile?.email ?? null,
    };
  });

  return { patients };
});
