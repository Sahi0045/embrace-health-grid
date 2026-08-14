import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";

async function requireSession() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export const getPatientFullProfile = createServerFn({ method: "GET" })
  .inputValidator((data: { patientDid: string }) => {
    if (!data?.patientDid) throw new Error("patientDid is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const { patientDid } = data;

    const [
      didRes,
      profileRes,
      admissionsRes,
      medicalRecordsRes,
      prescriptionsRes,
      labResultsRes,
      proceduresRes,
      surgeriesRes,
      appointmentsRes,
      medicationsRes,
      billingRes,
      paymentsRes,
      insurancePolicyRes,
      insuranceClaimsRes,
      credentialsRes,
      vaccinesRes,
      healthMetricsRes,
    ] = await Promise.all([
      supabase.from("dids").select("*").eq("did", patientDid).maybeSingle(),
      supabase.from("profiles").select("*").eq("primary_did", patientDid).maybeSingle(),
      supabase.from("admissions").select("*").eq("patient_did", patientDid).order("admitted_at", { ascending: false }),
      supabase.from("medical_records").select("*").eq("patient_did", patientDid).order("created_at", { ascending: false }),
      supabase.from("prescriptions").select("*").eq("patient_did", patientDid).order("created_at", { ascending: false }),
      supabase.from("lab_results").select("*").eq("patient_did", patientDid).order("created_at", { ascending: false }),
      supabase.from("procedures").select("*").eq("patient_did", patientDid).order("created_at", { ascending: false }),
      supabase.from("surgeries").select("*").eq("patient_did", patientDid).order("scheduled_for", { ascending: false }),
      supabase.from("appointments").select("*").eq("patient_did", patientDid).order("appointment_date", { ascending: false }),
      supabase.from("medications").select("*").eq("patient_did", patientDid).order("started_on", { ascending: false }),
      supabase.from("billing_accounts").select("*").eq("patient_did", patientDid).maybeSingle(),
      supabase.from("payments").select("*").eq("patient_did", patientDid).order("created_at", { ascending: false }),
      supabase.from("insurance_policies").select("*").eq("patient_did", patientDid).maybeSingle(),
      supabase.from("insurance_claims").select("*").eq("patient_did", patientDid).order("submitted_at", { ascending: false }),
      supabase.from("credentials").select("*").eq("subject_did", patientDid).order("issued_at", { ascending: false }),
      supabase.from("vaccines").select("*").eq("patient_did", patientDid).order("administered_on", { ascending: false }),
      supabase.from("health_metrics").select("*").eq("patient_did", patientDid).order("measured_on", { ascending: false }),
    ]);

    return {
      did: didRes.data,
      profile: profileRes.data,
      admissions: admissionsRes.data ?? [],
      medicalRecords: medicalRecordsRes.data ?? [],
      prescriptions: prescriptionsRes.data ?? [],
      labResults: labResultsRes.data ?? [],
      procedures: proceduresRes.data ?? [],
      surgeries: surgeriesRes.data ?? [],
      appointments: appointmentsRes.data ?? [],
      medications: medicationsRes.data ?? [],
      billing: billingRes.data ?? null,
      payments: paymentsRes.data ?? [],
      insurancePolicy: insurancePolicyRes.data ?? null,
      insuranceClaims: insuranceClaimsRes.data ?? [],
      credentials: credentialsRes.data ?? [],
      vaccines: vaccinesRes.data ?? [],
      healthMetrics: healthMetricsRes.data ?? [],
    };
  });
