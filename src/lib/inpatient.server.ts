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
import { z } from "zod";
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
    /**
     * The currently-active admission, not just the newest row.
     *
     * This was `admissions[0]` off a descending admitted_at order with no
     * status filter, so a patient discharged months ago was reported as
     * currently admitted. `discharged_at IS NULL` is what "still admitted"
     * actually means.
     */
    admission: admissions.find((a: any) => !a.discharged_at && a.status !== "discharged") ?? null,
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

/**
 * Update the caller's privacy and reminder preferences.
 *
 * The previous version had the same destructive shape as updateInsurancePolicy:
 * every absent key fell back to a hardcoded default (`?? true` / `?? false`) in
 * an upsert, so toggling ONE switch silently reset the other three to defaults —
 * a patient turning off research sharing could have had break-glass access
 * turned back on. On privacy switches that is the worst possible failure.
 *
 * Now: a closed schema (so a misspelled key is rejected rather than ignored),
 * and a patch built by omitting undefined keys, so a partial update only
 * touches what was sent.
 */
const preferencesSchema = z
  .object({
    emergencyAccess: z.boolean().optional(),
    insuranceVerification: z.boolean().optional(),
    researchSharing: z.boolean().optional(),
    crossHospital: z.boolean().optional(),
    // Added by 20260825020000 — these were component state only and reset on
    // every page load.
    reminderWhatsapp: z.boolean().optional(),
    reminderSms: z.boolean().optional(),
    reminderEmail: z.boolean().optional(),
  })
  .strict();

export const updatePatientPreferences = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => preferencesSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const did = await callerDid();

    const COLUMN: Record<string, string> = {
      emergencyAccess: "emergency_access",
      insuranceVerification: "insurance_verification",
      researchSharing: "research_sharing",
      crossHospital: "cross_hospital",
      reminderWhatsapp: "reminder_whatsapp",
      reminderSms: "reminder_sms",
      reminderEmail: "reminder_email",
    };

    const patch: Record<string, unknown> = { patient_did: did };
    for (const [key, column] of Object.entries(COLUMN)) {
      const value = (data as Record<string, unknown>)[key];
      if (value !== undefined) patch[column] = value;
    }

    const { error } = await supabase
      .from("patient_preferences")
      .upsert(patch, { onConflict: "patient_did" });

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── Feedback ───────────────────────────────────────────────────────────────

export const getFeedback = createServerFn({ method: "GET" }).handler(async () => ({
  feedback: await selectAll("feedback", "created_at"),
}));

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((data: { rating: number; doctor?: string; comments?: string }) => {
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
  .inputValidator(
    (data: { ambulanceId: string; status: string; location?: string; driverName?: string }) => {
      if (!data?.ambulanceId) throw new Error("Ambulance ID is required");
      if (!data?.status) throw new Error("Status is required");
      // Reject here rather than let Postgres raise a raw enum error at the UI.
      // The dispatch stages were only added to asset_status in 20260826060000;
      // before that these three writes always failed.
      const allowed = [
        "available",
        "in-use",
        "maintenance",
        "retired",
        "en-route",
        "at-scene",
        "returning",
      ];
      if (!allowed.includes(data.status)) {
        throw new Error(`Unknown ambulance status: ${data.status}`);
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const updatePayload: Record<string, any> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.location !== undefined) updatePayload.current_location = data.location;
    if (data.driverName !== undefined) updatePayload.driver_name = data.driverName;

    // `.select()` so an RLS-filtered update — which matches zero rows WITHOUT
    // raising an error — is reported as a failure rather than as success.
    const { data: updated, error } = await supabase
      .from("ambulances")
      .update(updatePayload)
      .eq("ambulance_id", data.ambulanceId)
      .select("ambulance_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) {
      throw new Error("Ambulance not found, or you do not have permission to update it");
    }
    return { ok: true as const, ambulanceId: data.ambulanceId, status: data.status };
  });

// ─── Equipment metadata ─────────────────────────────────────────────────────
/**
 * Derive an equipment TYPE from the device name, and nothing else.
 *
 * This function used to invent, per device-name keyword, a manufacturer, model,
 * serial number, department, floor, utilisation percentage, last-service date,
 * next-service date, warranty expiry, calibration date, next-calibration date
 * and assigned ward — e.g. any device whose name contained "ventilator" became
 * a Hamilton-G5 Pro, serial SN-VNT-55109-H, last serviced 2026-08-01, next
 * calibration 2026-11-01.
 *
 * `/admin/equipment` is subtitled "ISO calibration compliance". Every one of
 * those invented dates read there as a real service record, so a device that
 * had never been serviced displayed as in-compliance and one that was overdue
 * displayed as current. The serial number will not match the asset tag on the
 * device, so it cannot be used to find it either.
 *
 * Type inference from the name is kept: it is a classification of a value that
 * IS present, not an assertion about a value that is missing. Everything else
 * now passes through as null, and the UI renders "not recorded".
 */
function enrichEquipmentRecord(raw: any): any {
  const name = (raw.name || "").toLowerCase();

  const inferredType =
    raw.equipment_type ||
    (name.includes("mri")
      ? "mri"
      : name.includes("ct")
        ? "ct"
        : name.includes("ventilator")
          ? "ventilator"
          : name.includes("ultrasound")
            ? "ultrasound"
            : name.includes("x-ray") || name.includes("xray")
              ? "xray"
              : name.includes("monitor")
                ? "monitor"
                : name.includes("defibrillator")
                  ? "defibrillator"
                  : name.includes("infusion") || name.includes("pump")
                    ? "infusion-pump"
                    : null);

  return {
    ...raw,
    equipment_type: inferredType,
    manufacturer: raw.manufacturer ?? null,
    model: raw.model ?? null,
    serial_number: raw.serial_number ?? null,
    department: raw.department ?? null,
    floor_number: raw.floor_number ?? null,
    utilization_pct: raw.utilization_pct ?? null,
    last_serviced_on: raw.last_serviced_on ?? null,
    next_service_on: raw.next_service_on ?? null,
    warranty_expiry: raw.warranty_expiry ?? null,
    calibration_date: raw.calibration_date ?? null,
    next_calibration: raw.next_calibration ?? null,
    assigned_ward: raw.assigned_ward ?? null,
    did: raw.did || `did:hosp:equipment:${raw.equipment_id}`,
  };
}

export const getEquipment = createServerFn({ method: "GET" }).handler(async () => {
  const rawList = await selectAll("equipment", "updated_at");
  return {
    equipment: rawList.map(enrichEquipmentRecord),
  };
});

export const getEquipmentMaintenanceLog = createServerFn({ method: "GET" })
  .inputValidator((data: { equipmentId?: string }) => data)
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // A query failure used to fall back to SYNTHESISED maintenance records: a
    // "Quarterly Clinical Engineering Inspection & Safety Audit" performed by the
    // "Biomedical Engineering Service Team" 14 days ago for 320.00, with the note
    // "Ground resistance and chassis leakage current tested nominal" — plus two
    // hardcoded entries for SEED-EQ-3 naming a named technician and citing
    // IEC 60601-2-4 compliance.
    //
    // Those are records of electrical-safety tests that were never carried out,
    // shown in a maintenance history that a biomedical engineer relies on to know
    // what still needs doing. An error must surface as an error; an empty history
    // must read as empty.
    let query = supabase
      .from("equipment_maintenance_log")
      .select("*")
      .order("performed_at", { ascending: false });

    if (data?.equipmentId) {
      query = query.eq("equipment_id", data.equipmentId);
    }

    const { data: logs, error } = await query.limit(100);
    if (error) throw new Error(`Could not load maintenance history: ${error.message}`);

    return { logs: logs ?? [] };
  });

export const updateEquipmentStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      equipmentId: string;
      status: string;
      location?: string;
      assignedWard?: string;
      utilizationPct?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const updatePayload: Record<string, any> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.location !== undefined) updatePayload.location = data.location;
    if (data.assignedWard !== undefined) updatePayload.assigned_ward = data.assignedWard;
    if (data.utilizationPct !== undefined) updatePayload.utilization_pct = data.utilizationPct;

    // The old version retried a narrower update on ANY error and then returned
    // ok:true regardless of whether either write landed, so the detail panel
    // toasted "Equipment status & telemetry updated successfully" while nothing
    // had changed — including when the status was an invalid enum value, which
    // the UI could produce because its vocabulary did not match asset_status.
    const { data: updated, error } = await supabase
      .from("equipment")
      .update(updatePayload)
      .eq("equipment_id", data.equipmentId)
      .select("equipment_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) {
      throw new Error("Equipment not found, or you do not have permission to update it");
    }
    return { ok: true as const, equipmentId: data.equipmentId, status: data.status };
  });

export const recordEquipmentMaintenance = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      equipmentId: string;
      maintenanceType: "preventive" | "corrective" | "calibration" | "routine_check" | string;
      description: string;
      performedBy: string;
      nextDue?: string;
      cost?: number;
      status?: string;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const logId = `LOG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const entry = {
      log_id: logId,
      equipment_id: data.equipmentId,
      maintenance_type: data.maintenanceType,
      description: data.description,
      performed_by: data.performedBy,
      performed_at: new Date().toISOString(),
      next_due: data.nextDue || null,
      cost: data.cost ?? 0,
      status: data.status || "completed",
      notes: data.notes || null,
    };

    // Previously the insert was wrapped in try/catch and the entry was also
    // pushed to a module-level `memoryLogs` map. supabase-js RETURNS `{error}`
    // rather than throwing, so a rejected insert never reached the catch: the
    // record existed only in that process's memory, survived until the next
    // serverless cold start, and the caller was told it had been saved.
    const { error: logErr } = await supabase.from("equipment_maintenance_log").insert(entry);
    if (logErr) throw new Error(`Maintenance record could not be saved: ${logErr.message}`);

    // Roll the device's service/calibration dates forward to match the log entry
    // just written. A failure here leaves the log and the device disagreeing, so
    // it is reported rather than swallowed — an equipment record that claims it
    // was calibrated today when it was not is the defect this whole file had.
    const servicePatch =
      data.maintenanceType === "calibration"
        ? {
            calibration_date: new Date().toISOString().split("T")[0],
            next_calibration: data.nextDue || null,
            updated_at: new Date().toISOString(),
          }
        : {
            last_serviced_on: new Date().toISOString().split("T")[0],
            next_service_on: data.nextDue || null,
            updated_at: new Date().toISOString(),
          };

    const { data: serviced, error: svcErr } = await supabase
      .from("equipment")
      .update(servicePatch)
      .eq("equipment_id", data.equipmentId)
      .select("equipment_id");

    if (svcErr) {
      throw new Error(
        `Maintenance was logged, but the device's service dates were not updated: ${svcErr.message}`,
      );
    }
    // Same failure, without an error: the log says the device was serviced while
    // its next-service date still points at the old schedule.
    if (!serviced?.length) {
      throw new Error(
        "Maintenance was logged, but the device's service dates were not updated: equipment not found or not permitted",
      );
    }

    return { ok: true as const, logId };
  });

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
  .inputValidator((data: { amount: number; method?: string; reference?: string }) => {
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
  .inputValidator(
    (data: { name: string; category?: string; description?: string; status?: string }) => {
      if (!data?.name) throw new Error("name is required");
      return data;
    },
  )
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
  .inputValidator((data: { policyId: string; [key: string]: unknown }) => {
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
  .inputValidator((data: { alertId: string; status: string }) => {
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
/**
 * Hospital directory.
 *
 * hospitals_select_authenticated is intentionally readable by any signed-in user,
 * including patients: choosing which hospital to attend requires seeing the list.
 * Only public-facing columns are returned — nothing operational or financial.
 */
export const getHospitalDirectory = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("hospitals")
    .select("hospital_id, name, slug, city, country, status, hospital_did")
    .eq("status", "active")
    .order("name");

  if (error) throw new Error(error.message);
  return { hospitals: data ?? [] };
});

export const getDoctors = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("dids")
    // hospital_id so a patient can see WHICH hospital a clinician belongs to
    // before booking. The clinician directory is cross-hospital by design, so
    // without it every doctor looked like they came from the same place.
    .select("did, owner_name, owner_type, status, hospital_id")
    .in("owner_type", ["doctor", "staff"])
    // A hospital's own DID is stored with owner_type 'staff' because user_role has
    // no organisation member, so without this the admin roster listed hospitals
    // as clinicians with an "Approve & Issue DID" button beside them.
    .eq("is_organisation", false)
    .eq("status", "active");

  if (error) throw new Error(error.message);

  // Department, specialisation and employee number live on `profiles`, keyed by
  // primary_did. The Doctor Locator renders all three and offers a specialty
  // filter, and nothing was ever supplying them, so those columns were blank on
  // every row and the filter had one option. profiles_select_staff scopes this,
  // so a caller who may not read a profile simply gets no extras for that row.
  const rows = data ?? [];
  const dids = rows.map((d) => d.did).filter(Boolean);

  let extras = new Map<
    string,
    { department: string | null; specialty: string | null; employeeId: string | null }
  >();
  if (dids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("primary_did, department, specializations, employee_id")
      .in("primary_did", dids);

    extras = new Map(
      (profiles ?? []).map((p) => [
        p.primary_did as string,
        {
          department: p.department ?? null,
          // `specializations` is an array; the directory shows one label.
          specialty: Array.isArray(p.specializations) ? (p.specializations[0] ?? null) : null,
          employeeId: p.employee_id ?? null,
        },
      ]),
    );
  }

  const doctors = rows.map((d) => ({
    ...d,
    department: extras.get(d.did)?.department ?? null,
    specialty: extras.get(d.did)?.specialty ?? null,
    employee_id: extras.get(d.did)?.employeeId ?? null,
  }));

  return { doctors };
});

/**
 * Clinicians a patient may actually book with: their OWN hospital's, only.
 *
 * `getDoctors` above is deliberately cross-hospital — `dids_select_clinician_directory`
 * spans tenants so a clinician can request a referral for a patient treated
 * elsewhere. The patient booking screen used that same unscoped list, so a
 * patient registered at one hospital was offered every clinician on the
 * platform: verified against production, a patient at "shubham3" (1 clinician)
 * was shown 14 clinicians from "KIMS", a hospital they have no relationship
 * with. Booking one would create an appointment across a tenant boundary.
 *
 * The hospital is resolved HERE from the session, never accepted as a parameter.
 * A client-supplied hospitalId would just move the problem: anyone could pass
 * another tenant's id and get its roster back.
 */
export const getBookableDoctors = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const supabase = getSupabaseServerClient();

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("hospital_id")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr) throw new Error(pErr.message);

  // No hospital means no booking relationship with anyone. Returning the full
  // directory here would reintroduce exactly the bug this function exists to
  // fix, so it returns nothing and lets the UI explain why.
  if (!profile?.hospital_id) {
    return { doctors: [], hospitalId: null as string | null };
  }

  const { data, error } = await supabase
    .from("dids")
    .select("did, owner_name, owner_type, status, hospital_id")
    .in("owner_type", ["doctor", "staff"])
    .eq("is_organisation", false)
    .eq("status", "active")
    .eq("hospital_id", profile.hospital_id);

  if (error) throw new Error(error.message);
  return { doctors: data ?? [], hospitalId: profile.hospital_id as string | null };
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
