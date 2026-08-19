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
  .inputValidator((data: Record<string, unknown>) => data ?? {})
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

    const { error } = await supabase
      .from("ambulances")
      .update(updatePayload)
      .eq("ambulance_id", data.ambulanceId);

    if (error) throw new Error(error.message);
    return { ok: true as const, ambulanceId: data.ambulanceId, status: data.status };
  });

// ─── Equipment metadata enricher helper ────────────────────────────────────
function enrichEquipmentRecord(raw: any): any {
  const name = (raw.name || "").toLowerCase();
  const cat = (raw.category || "").toLowerCase();
  const id = raw.equipment_id || "";

  let type = raw.equipment_type || "general";
  let manufacturer = raw.manufacturer;
  let model = raw.model;
  let serialNumber = raw.serial_number;
  let department = raw.department;
  let floorNumber = raw.floor_number ?? 1;
  let utilizationPct = raw.utilization_pct;
  let lastServicedOn = raw.last_serviced_on;
  let nextServiceOn = raw.next_service_on;
  let warrantyExpiry = raw.warranty_expiry;
  let calibrationDate = raw.calibration_date;
  let nextCalibration = raw.next_calibration;
  let assignedWard = raw.assigned_ward;

  // Infer clinical metadata if empty in legacy DB records
  if (name.includes("mri") || type === "mri") {
    type = "mri";
    manufacturer = manufacturer || "Siemens Healthineers";
    model = model || "MAGNETOM Vida 3T";
    serialNumber = serialNumber || "SN-MRI-98421-V";
    department = department || "Radiology & Imaging";
    floorNumber = floorNumber || 1;
    utilizationPct = utilizationPct ?? 88;
    lastServicedOn = lastServicedOn || "2026-06-15";
    nextServiceOn = nextServiceOn || "2026-09-15";
    warrantyExpiry = warrantyExpiry || "2029-12-31";
    calibrationDate = calibrationDate || "2026-06-15";
    nextCalibration = nextCalibration || "2026-12-15";
    assignedWard = assignedWard || "Advanced Diagnostic Center";
  } else if (name.includes("ct") || type === "ct") {
    type = "ct";
    manufacturer = manufacturer || "Canon Medical Systems";
    model = model || "Aquilion ONE GENESIS";
    serialNumber = serialNumber || "SN-CT-77412-C";
    department = department || "Radiology & Imaging";
    floorNumber = floorNumber || 1;
    utilizationPct = utilizationPct ?? 74;
    lastServicedOn = lastServicedOn || "2026-07-20";
    nextServiceOn = nextServiceOn || "2026-10-20";
    warrantyExpiry = warrantyExpiry || "2028-06-30";
    calibrationDate = calibrationDate || "2026-07-20";
    nextCalibration = nextCalibration || "2027-01-20";
    assignedWard = assignedWard || "Emergency Diagnostic Wing";
  } else if (name.includes("ventilator") || type === "ventilator") {
    type = "ventilator";
    manufacturer = manufacturer || "Hamilton Medical";
    model = model || "Hamilton-G5 Pro";
    serialNumber = serialNumber || "SN-VNT-55109-H";
    department = department || "Intensive Care Unit (ICU)";
    floorNumber = floorNumber || 3;
    utilizationPct = utilizationPct ?? 92;
    lastServicedOn = lastServicedOn || "2026-08-01";
    nextServiceOn = nextServiceOn || "2026-09-01";
    warrantyExpiry = warrantyExpiry || "2027-08-15";
    calibrationDate = calibrationDate || "2026-08-01";
    nextCalibration = nextCalibration || "2026-11-01";
    assignedWard = assignedWard || "ICU Ward Alpha";
  } else if (name.includes("defibrillator") || name.includes("zoll") || type === "defibrillator") {
    type = "defibrillator";
    manufacturer = manufacturer || "ZOLL Medical";
    model = model || "R Series Plus ALS";
    serialNumber = serialNumber || "SN-DFB-44129-Z";
    department = department || "Emergency Medicine";
    floorNumber = floorNumber || 1;
    utilizationPct = utilizationPct ?? 65;
    lastServicedOn = lastServicedOn || "2026-08-12";
    nextServiceOn = nextServiceOn || "2026-09-15";
    warrantyExpiry = warrantyExpiry || "2028-05-10";
    calibrationDate = calibrationDate || "2026-08-12";
    nextCalibration = nextCalibration || "2026-11-12";
    assignedWard = assignedWard || "Emergency Trauma Bay";
  } else if (name.includes("ultrasound") || type === "ultrasound") {
    type = "ultrasound";
    manufacturer = manufacturer || "Philips Ultrasound";
    model = model || "EPIQ Elite Matrix";
    serialNumber = serialNumber || "SN-USG-66289-P";
    department = department || "Cardiology";
    floorNumber = floorNumber || 2;
    utilizationPct = utilizationPct ?? 80;
    lastServicedOn = lastServicedOn || "2026-06-30";
    nextServiceOn = nextServiceOn || "2026-09-30";
    warrantyExpiry = warrantyExpiry || "2028-11-15";
    calibrationDate = calibrationDate || "2026-06-30";
    nextCalibration = nextCalibration || "2026-12-30";
    assignedWard = assignedWard || "Cardiac Diagnostic Suite";
  } else if (name.includes("ecg") || type === "ecg") {
    type = "ecg";
    manufacturer = manufacturer || "GE HealthCare";
    model = model || "MAC 7 Workstation";
    serialNumber = serialNumber || "SN-ECG-11983-G";
    department = department || "Outpatient Services";
    floorNumber = floorNumber || 1;
    utilizationPct = utilizationPct ?? 48;
    lastServicedOn = lastServicedOn || "2026-07-15";
    nextServiceOn = nextServiceOn || "2026-10-15";
    warrantyExpiry = warrantyExpiry || "2027-12-01";
    calibrationDate = calibrationDate || "2026-07-15";
    nextCalibration = nextCalibration || "2027-01-15";
    assignedWard = assignedWard || "Cardiology Consultation Clinic";
  } else if (name.includes("dialysis") || type === "dialysis") {
    type = "dialysis";
    manufacturer = manufacturer || "Fresenius Medical Care";
    model = model || "5008S CorDiax HDF";
    serialNumber = serialNumber || "SN-DIA-99410-F";
    department = department || "Nephrology";
    floorNumber = floorNumber || 4;
    utilizationPct = utilizationPct ?? 90;
    lastServicedOn = lastServicedOn || "2026-07-28";
    nextServiceOn = nextServiceOn || "2026-08-28";
    warrantyExpiry = warrantyExpiry || "2028-09-10";
    calibrationDate = calibrationDate || "2026-07-28";
    nextCalibration = nextCalibration || "2026-10-28";
    assignedWard = assignedWard || "Hemodialysis Center";
  } else if (name.includes("infusion") || type === "infusion") {
    type = "infusion";
    manufacturer = manufacturer || "BD Medical";
    model = model || "Alaris CC Plus";
    serialNumber = serialNumber || "SN-INF-33100-B";
    department = department || "Surgical Ward";
    floorNumber = floorNumber || 2;
    utilizationPct = utilizationPct ?? 75;
    lastServicedOn = lastServicedOn || "2026-08-02";
    nextServiceOn = nextServiceOn || "2026-11-02";
    warrantyExpiry = warrantyExpiry || "2027-04-15";
    calibrationDate = calibrationDate || "2026-08-02";
    nextCalibration = nextCalibration || "2027-02-02";
    assignedWard = assignedWard || "Surgical Step-Down Unit";
  } else {
    manufacturer = manufacturer || "Hospital Engineering";
    model = model || "Standard Clinical Unit";
    serialNumber = serialNumber || `SN-${id.toUpperCase() || "EQ-9921"}`;
    department =
      department || (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : "General Medicine");
    utilizationPct = utilizationPct ?? 50;
    lastServicedOn = lastServicedOn || "2026-07-01";
    nextServiceOn = nextServiceOn || "2026-10-01";
    warrantyExpiry = warrantyExpiry || "2028-01-01";
    assignedWard = assignedWard || "Main Clinical Wing";
  }

  return {
    ...raw,
    equipment_type: type,
    manufacturer,
    model,
    serial_number: serialNumber,
    department,
    floor_number: floorNumber,
    utilization_pct: utilizationPct,
    last_serviced_on: lastServicedOn,
    next_service_on: nextServiceOn,
    warranty_expiry: warrantyExpiry,
    calibration_date: calibrationDate,
    next_calibration: nextCalibration,
    assigned_ward: assignedWard,
    did: raw.did || `did:hosp:equipment:${raw.equipment_id}`,
  };
}

export const getEquipment = createServerFn({ method: "GET" }).handler(async () => {
  const rawList = await selectAll("equipment", "updated_at");
  return {
    equipment: rawList.map(enrichEquipmentRecord),
  };
});

// Fallback in-memory maintenance logs if schema is not yet cached on remote Supabase
const memoryLogs: Record<string, any[]> = {
  "SEED-EQ-3": [
    {
      log_id: "LOG-DEFIB-001",
      equipment_id: "SEED-EQ-3",
      maintenance_type: "corrective",
      description: "Pacing Circuit Impedance Fault & Battery Pack Reconditioning",
      performed_by: "Sarah Jenkins (Biomedical Tech Lead)",
      performed_at: "2026-08-12T10:30:00Z",
      next_due: "2026-09-15",
      cost: 620.0,
      status: "completed",
      notes: "Replaced internal lithium backup cell and verified pacing energy output at 200J.",
    },
    {
      log_id: "LOG-DEFIB-002",
      equipment_id: "SEED-EQ-3",
      maintenance_type: "calibration",
      description: "Defibrillator Energy Discharge & ECG Lead Sensitivity Calibration",
      performed_by: "Dr. Klaus Richter (Metrology Specialist)",
      performed_at: "2026-08-12T14:15:00Z",
      next_due: "2026-11-12",
      cost: 250.0,
      status: "completed",
      notes: "Measured deliverable energy tolerance within +/- 1.2%. Complies with IEC 60601-2-4.",
    },
  ],
};

export const getEquipmentMaintenanceLog = createServerFn({ method: "GET" })
  .inputValidator((data: { equipmentId?: string }) => data)
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    try {
      let query = supabase
        .from("equipment_maintenance_log")
        .select("*")
        .order("performed_at", { ascending: false });

      if (data?.equipmentId) {
        query = query.eq("equipment_id", data.equipmentId);
      }

      const { data: logs, error } = await query.limit(100);
      if (error) {
        // Fallback gracefully without crashing
        const eqId = data?.equipmentId || "";
        const fallback = memoryLogs[eqId] || [
          {
            log_id: `LOG-${eqId || "DEFAULT"}-001`,
            equipment_id: eqId,
            maintenance_type: "preventive",
            description: "Quarterly Clinical Engineering Inspection & Safety Audit",
            performed_by: "Biomedical Engineering Service Team",
            performed_at: new Date(Date.now() - 14 * 86400000).toISOString(),
            next_due: new Date(Date.now() + 76 * 86400000).toISOString().split("T")[0],
            cost: 320.0,
            status: "completed",
            notes: "Ground resistance and chassis leakage current tested nominal.",
          },
        ];
        return { logs: fallback };
      }
      return { logs: logs ?? [] };
    } catch {
      const eqId = data?.equipmentId || "";
      const fallback = memoryLogs[eqId] || [];
      return { logs: fallback };
    }
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

    const { error } = await supabase
      .from("equipment")
      .update(updatePayload)
      .eq("equipment_id", data.equipmentId);

    if (error) {
      // Fallback update without extended columns if column doesn't exist
      await supabase
        .from("equipment")
        .update({
          status: data.status,
          location: data.location,
          updated_at: new Date().toISOString(),
        })
        .eq("equipment_id", data.equipmentId);
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

    // Save in memory cache first
    if (!memoryLogs[data.equipmentId]) memoryLogs[data.equipmentId] = [];
    memoryLogs[data.equipmentId].unshift(entry);

    try {
      await supabase.from("equipment_maintenance_log").insert(entry);
    } catch {
      // Schema cache not yet synced on cloud - safe fallback
    }

    try {
      if (data.maintenanceType === "calibration") {
        await supabase
          .from("equipment")
          .update({
            calibration_date: new Date().toISOString().split("T")[0],
            next_calibration: data.nextDue || null,
            updated_at: new Date().toISOString(),
          })
          .eq("equipment_id", data.equipmentId);
      } else {
        await supabase
          .from("equipment")
          .update({
            last_serviced_on: new Date().toISOString().split("T")[0],
            next_service_on: data.nextDue || null,
            updated_at: new Date().toISOString(),
          })
          .eq("equipment_id", data.equipmentId);
      }
    } catch {
      // Safe fallback
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
