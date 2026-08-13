/**
 * Patient Master API — Centralized patient data access layer
 *
 * Provides unified read access to all patient-related information:
 * - Patient details, admission info, current location
 * - Medical records, procedures, medications, lab results
 * - Billing, insurance, preferences
 * - Admission and transfer history
 *
 * All data is aggregated from existing domain tables (admissions, medical_records,
 * medications, lab_results, billing_accounts, etc.) with no new tables introduced.
 *
 * Write operations go through domain-specific APIs:
 * - admissions.server.ts: admit, discharge, transfer
 * - clinical.server.ts: prescriptions, procedures, medications
 * - operations.server.ts: bed/room status
 *
 * Security:
 * - RLS enforced on all underlying queries via Supabase Auth
 * - Patient sees only own data
 * - Clinicians see patients they have active consent for
 * - Admins see all patients in their hospital
 */

import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function requireSession() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ─── Get Patient Master Summary ─────────────────────────────────────────────

export const getPatientMaster = createServerFn({ method: "GET" })
  .validator(
    (data: { patientDid: string }) => {
      if (!data?.patientDid) throw new Error("patientDid is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // Fetch from the patient_master view (RLS will enforce visibility)
    const { data: patient, error } = await supabase
      .from("patient_master")
      .select("*")
      .eq("patient_did", data.patientDid)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!patient) throw new Error("Patient not found or you do not have access");

    return {
      ok: true as const,
      patient: {
        patientDid: patient.patient_did,
        name: patient.patient_name,
        hospitalId: patient.hospital_id,
        hospitalName: patient.hospital_name,

        // Admission
        currentAdmission: patient.admission_id
          ? {
              admissionId: patient.admission_id,
              admittedAt: patient.admitted_at,
              expectedDischarge: patient.expected_discharge,
              status: patient.admission_status,
              diagnosis: patient.diagnosis,
            }
          : null,

        // Location
        currentLocation: patient.bed_id
          ? {
              bedId: patient.bed_id,
              bedNumber: patient.bed_number,
              bedType: patient.bed_type,
              bedStatus: patient.bed_status,
              roomId: patient.room_id,
              roomNumber: patient.room_number,
              roomType: patient.room_type,
              roomCapacity: patient.room_capacity,
              wardId: patient.ward_id,
              wardName: patient.ward_name,
              wardType: patient.ward_type,
              wardCode: patient.ward_code,
              floorNumber: patient.floor_number,
              floorName: patient.floor_name,
              buildingName: patient.building_name,
            }
          : null,

        // Staff assignments
        assignedDoctorDid: patient.assigned_doctor_did,
        assignedNurseId: patient.assigned_nurse_id,

        // Medical summary
        medicalSummary: {
          totalMedicalRecords: patient.total_medical_records || 0,
          totalProcedures: patient.total_procedures || 0,
          activeMedications: patient.active_medications || 0,
          totalLabResults: patient.total_lab_results || 0,
        },

        // Billing
        billing: {
          totalBilled: Number(patient.total_billed || 0),
          outstanding: Number(patient.outstanding_balance || 0),
          totalPaid: Number(patient.total_paid || 0),
        },

        // Insurance
        insurance: patient.insurance_provider
          ? {
              provider: patient.insurance_provider,
              policyNumber: patient.policy_number,
              coveragePercentage: patient.coverage_percentage,
            }
          : null,

        // Preferences
        preferences: {
          emergencyAccess: patient.emergency_access_enabled,
          insuranceVerification: patient.insurance_verification_enabled,
          researchSharing: patient.research_sharing_enabled,
          crossHospitalAccess: patient.cross_hospital_access_enabled,
        },

        // Metadata
        registeredAt: patient.patient_registered_at,
        lastAdmissionDate: patient.last_admission_date,
      },
    };
  });

// ─── Get Patient Current Location ────────────────────────────────────────────

export const getPatientCurrentLocation = createServerFn({ method: "GET" })
  .validator(
    (data: { patientDid: string }) => {
      if (!data?.patientDid) throw new Error("patientDid is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: location, error } = await supabase
      .from("patient_current_location")
      .select("*")
      .eq("patient_did", data.patientDid)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!location) {
      return {
        ok: true as const,
        location: null,
        message: "Patient has no active admission",
      };
    }

    return {
      ok: true as const,
      location: {
        admissionId: location.admission_id,
        admittedAt: location.admitted_at,
        expectedDischarge: location.expected_discharge,
        status: location.status,
        bed: {
          bedId: location.bed,
          bedNumber: location.bed_number,
          bedType: location.bed_type,
        },
        room: {
          roomId: location.room_id,
          roomNumber: location.room_number,
          roomType: location.room_type,
        },
        ward: {
          wardId: location.ward_id,
          wardName: location.ward_name,
          wardType: location.ward_type,
        },
        floor: {
          floorNumber: location.floor_number,
          floorName: location.floor_name,
        },
        building: {
          buildingName: location.building_name,
        },
        hospital: {
          hospitalName: location.hospital_name,
        },
      },
    };
  });

// ─── Get Patient Admission History ──────────────────────────────────────────

export const getPatientAdmissionHistory = createServerFn({ method: "GET" })
  .validator(
    (data: { patientDid: string; limit?: number }) => {
      if (!data?.patientDid) throw new Error("patientDid is required");
      return { ...data, limit: data.limit ?? 50 };
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: admissions, error } = await supabase
      .from("patient_admission_history")
      .select("*")
      .eq("patient_did", data.patientDid)
      .limit(data.limit ?? 50);

    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      admissions: (admissions ?? []).map((adm: any) => ({
        admissionId: adm.admission_id,
        admittedAt: adm.admitted_at,
        dischargedAt: adm.discharged_at,
        status: adm.status,
        diagnosis: adm.diagnosis,
        bed: adm.bed,
        ward: adm.ward,
        room: adm.room,
        admittingDoctor: adm.admitting_doctor,
        lengthOfStayDays: adm.length_of_stay_days,
        totalTransfers: adm.total_transfers,
        admissionBill: Number(adm.admission_bill || 0),
        unpaidBalance: Number(adm.unpaid_balance || 0),
      })),
    };
  });

// ─── Get Patient Transfer History ────────────────────────────────────────────

export const getPatientTransferHistory = createServerFn({ method: "GET" })
  .validator(
    (data: { patientDid: string; limit?: number }) => {
      if (!data?.patientDid) throw new Error("patientDid is required");
      return { ...data, limit: data.limit ?? 100 };
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: events, error } = await supabase
      .from("admission_events")
      .select("*")
      .eq("patient_did", data.patientDid)
      .eq("event_type", "transferred")
      .order("occurred_at", { ascending: false })
      .limit(data.limit ?? 100);

    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      transfers: (events ?? []).map((ev: any) => ({
        eventId: ev.event_id,
        admissionId: ev.admission_id,
        eventType: ev.event_type,
        fromBed: ev.bed_id_old,
        toBed: ev.bed_id_new,
        fromWard: ev.ward_old,
        toWard: ev.ward_new,
        fromRoom: ev.room_old,
        toRoom: ev.room_new,
        performedBy: ev.performed_by_name,
        performedByRole: ev.performed_by_role,
        reason: ev.reason,
        occurredAt: ev.occurred_at,
      })),
    };
  });

// ─── Get Patient Medical Records ─────────────────────────────────────────────

export const getPatientMedicalRecords = createServerFn({ method: "GET" })
  .validator(
    (data: { patientDid: string; recordType?: string; limit?: number }) => {
      if (!data?.patientDid) throw new Error("patientDid is required");
      return { ...data, limit: data.limit ?? 100 };
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("medical_records")
      .select("*")
      .eq("patient_did", data.patientDid)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);

    if (data.recordType) query = query.eq("record_type", data.recordType);

    const { data: records, error } = await query;
    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      records: (records ?? []).map((rec: any) => ({
        recordId: rec.record_id,
        title: rec.title,
        recordType: rec.record_type,
        content: rec.content,
        authorName: rec.author_name,
        createdAt: rec.created_at,
        updatedAt: rec.updated_at,
      })),
    };
  });

// ─── Get Patient Medications ─────────────────────────────────────────────────

export const getPatientMedications = createServerFn({ method: "GET" })
  .validator(
    (data: { patientDid: string; status?: string }) => {
      if (!data?.patientDid) throw new Error("patientDid is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("medications")
      .select("*")
      .eq("patient_did", data.patientDid)
      .order("started_on", { ascending: false });

    if (data.status) query = query.eq("status", data.status);

    const { data: medications, error } = await query;
    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      medications: (medications ?? []).map((m: any) => ({
        medicationId: m.medication_id,
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        route: m.route,
        startedOn: m.started_on,
        prescribedBy: m.prescribed_by,
        status: m.status,
        nextDoseAt: m.next_dose_at,
      })),
    };
  });

// ─── Get Patient Procedures ──────────────────────────────────────────────────

export const getPatientProcedures = createServerFn({ method: "GET" })
  .validator(
    (data: { patientDid: string; status?: string }) => {
      if (!data?.patientDid) throw new Error("patientDid is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("procedures")
      .select("*")
      .eq("patient_did", data.patientDid)
      .order("scheduled_for", { ascending: false });

    if (data.status) query = query.eq("status", data.status);

    const { data: procedures, error } = await query;
    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      procedures: (procedures ?? []).map((p: any) => ({
        procedureId: p.procedure_id,
        name: p.name,
        scheduledFor: p.scheduled_for,
        completedAt: p.completed_at,
        status: p.status,
        performedBy: p.performed_by,
        location: p.location,
        notes: p.notes,
      })),
    };
  });

// ─── Get Patient Lab Results ─────────────────────────────────────────────────

export const getPatientLabResults = createServerFn({ method: "GET" })
  .validator(
    (data: { patientDid: string; limit?: number }) => {
      if (!data?.patientDid) throw new Error("patientDid is required");
      return { ...data, limit: data.limit ?? 50 };
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: results, error } = await supabase
      .from("lab_results")
      .select("*")
      .eq("patient_did", data.patientDid)
      .order("resulted_at", { ascending: false })
      .limit(data.limit ?? 50);

    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      labResults: (results ?? []).map((lab: any) => ({
        labId: lab.lab_id,
        testName: lab.test_name,
        resultValue: lab.result_value,
        unit: lab.unit,
        referenceRange: lab.reference_range,
        status: lab.status,
        resultedAt: lab.resulted_at,
      })),
    };
  });

// ─── Get Patient Billing Information ─────────────────────────────────────────

export const getPatientBilling = createServerFn({ method: "GET" })
  .validator(
    (data: { patientDid: string }) => {
      if (!data?.patientDid) throw new Error("patientDid is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // Billing account summary
    const { data: billing, error: billErr } = await supabase
      .from("billing_accounts")
      .select("*")
      .eq("patient_did", data.patientDid)
      .maybeSingle();

    if (billErr) throw new Error(billErr.message);

    // Insurance information
    const { data: insurance, error: insErr } = await supabase
      .from("insurance_policies")
      .select("*")
      .eq("patient_did", data.patientDid)
      .maybeSingle();

    if (insErr) throw new Error(insErr.message);

    // Payment history
    const { data: payments, error: payErr } = await supabase
      .from("payments")
      .select("*")
      .eq("patient_did", data.patientDid)
      .order("paid_at", { ascending: false })
      .limit(50);

    if (payErr) throw new Error(payErr.message);

    return {
      ok: true as const,
      billing: billing
        ? {
            totalBilled: Number(billing.total_billed || 0),
            outstanding: Number(billing.outstanding || 0),
            totalPaid: Number(billing.total_paid || 0),
            lastUpdated: billing.updated_at,
          }
        : null,
      insurance: insurance
        ? {
            provider: insurance.provider,
            policyNumber: insurance.policy_number,
            groupNumber: insurance.group_number,
            coverageType: insurance.coverage_type,
            copay: Number(insurance.copay || 0),
            deductible: Number(insurance.deductible || 0),
            deductibleMet: Number(insurance.deductible_met || 0),
            outOfPocketMax: Number(insurance.out_of_pocket_max || 0),
            outOfPocketMet: Number(insurance.out_of_pocket_met || 0),
            coveragePercentage: insurance.coverage_percentage,
            validFrom: insurance.valid_from,
            validTo: insurance.valid_to,
          }
        : null,
      payments: (payments ?? []).map((p: any) => ({
        paymentId: p.payment_id,
        amount: Number(p.amount || 0),
        method: p.method,
        status: p.status,
        paidAt: p.paid_at,
      })),
    };
  });

// ─── Get Patient Discharge Information ───────────────────────────────────────

export const getPatientDischargeInfo = createServerFn({ method: "GET" })
  .validator(
    (data: { patientDid: string }) => {
      if (!data?.patientDid) throw new Error("patientDid is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // Get most recent discharged admission
    const { data: discharge, error } = await supabase
      .from("admissions")
      .select("*")
      .eq("patient_did", data.patientDid)
      .eq("status", "discharged")
      .order("discharged_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!discharge) {
      return {
        ok: true as const,
        discharge: null,
        message: "Patient has not been discharged",
      };
    }

    return {
      ok: true as const,
      discharge: {
        admissionId: discharge.admission_id,
        admittedAt: discharge.admitted_at,
        dischargedAt: discharge.discharged_at,
        expectedDischarge: discharge.expected_discharge,
        diagnosis: discharge.diagnosis,
        admittingDoctor: discharge.admitting_doctor,
        bed: discharge.bed,
        ward: discharge.ward,
        room: discharge.room,
        lengthOfStayDays: discharge.discharged_at
          ? Math.floor(
              (new Date(discharge.discharged_at).getTime() - new Date(discharge.admitted_at).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null,
      },
    };
  });
