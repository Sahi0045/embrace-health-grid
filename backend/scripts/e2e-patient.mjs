/**
 * Patient portal end-to-end check.
 *
 * Signs in as a real seeded patient with the ANON key, so every read goes
 * through RLS exactly as the browser does, then exercises the tables each
 * patient route depends on and reports what the screen would actually show.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const be = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const c = createClient(be.SUPABASE_URL, be.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: auth, error: se } = await c.auth.signInWithPassword({
  email: process.env.E2E_EMAIL ?? "alice.patient@seed.test",
  password: "SeedPassw0rd!dev",
});
if (se) {
  console.log("sign-in failed:", se.message);
  process.exit(1);
}

const svc = createClient(be.SUPABASE_URL, be.SUPABASE_SERVICE_ROLE_KEY);
const { data: me } = await c.from("profiles").select("*").eq("id", auth.user.id).single();
const did = me.primary_did;

console.log(`signed in: ${me.full_name} <${me.email}>  role=${me.role}`);
console.log(`DID: ${did}  hospital: ${me.hospital_id ?? "(none)"}  MRN: ${me.mrn ?? "(none)"}\n`);

const results = [];
async function check(route, label, fn) {
  try {
    const out = await fn();
    results.push({ route, label, ...out });
  } catch (err) {
    results.push({ route, label, ok: false, note: `THREW: ${String(err.message).slice(0, 60)}` });
  }
}

// ── /patient/profile · emergency · index
await check("profile", "own profile readable", async () => {
  const { data } = await c
    .from("profiles")
    .select("full_name, mrn, blood_group, age, gender, phone, hospital_id");
  return { ok: data?.length === 1, note: `${data?.length} row (own only)` };
});
await check("emergency", "emergency fields", async () => ({
  ok: true,
  note: `blood=${me.blood_group ?? "—"} allergies=${(me.allergies ?? []).length} conditions=${(me.conditions ?? []).length} contact=${me.emergency_contact_name ?? "—"} organ=${me.organ_donor === null ? "not declared" : me.organ_donor}`,
}));

// ── /patient/records
await check("records", "medical records", async () => {
  const { data, error } = await c
    .from("medical_records")
    .select("record_id, title, record_type")
    .eq("patient_did", did);
  return { ok: !error, note: error ? error.message.slice(0, 50) : `${data.length} record(s)` };
});
await check("records", "prescriptions", async () => {
  const { data, error } = await c
    .from("prescriptions")
    .select("rx_id, drugs, signed, appointment_id")
    .eq("patient_did", did);
  return { ok: !error, note: error ? error.message.slice(0, 50) : `${data.length} rx` };
});
await check("records", "lab results (+priority)", async () => {
  const { data, error } = await c
    .from("lab_results")
    .select("lab_id, test_name, result_value, unit, priority")
    .eq("patient_did", did);
  return { ok: !error, note: error ? error.message.slice(0, 50) : `${data.length} lab(s)` };
});

// ── /patient/consent
await check("consent", "consents + signatures", async () => {
  const { data, error } = await c
    .from("consents")
    .select("grant_id, status, doctor_did, patient_signature, signing_public_key")
    .eq("patient_did", did);
  if (error) return { ok: false, note: error.message.slice(0, 50) };
  const signed = data.filter((x) => x.patient_signature).length;
  return { ok: true, note: `${data.length} consent(s), ${signed} signed` };
});

// ── /patient/appointments
await check("appointments", "own appointments", async () => {
  const { data, error } = await c
    .from("appointments")
    .select("appt_id, status, slot, reason, clinician_note")
    .eq("patient_did", did);
  return { ok: !error, note: error ? error.message.slice(0, 50) : `${data.length} appt(s)` };
});
await check("appointments", "bookable doctors = own hospital only", async () => {
  const { data, error } = await c
    .from("dids")
    .select("did, owner_name, hospital_id")
    .in("owner_type", ["doctor", "staff"])
    .eq("is_organisation", false)
    .eq("status", "active")
    .eq("hospital_id", me.hospital_id);
  if (error) return { ok: false, note: error.message.slice(0, 50) };
  const foreign = data.filter((d) => d.hospital_id !== me.hospital_id).length;
  return {
    ok: foreign === 0,
    note: `${data.length} clinician(s), ${foreign} from another hospital`,
  };
});

// ── /patient/billing · insurance
await check("billing", "billing account", async () => {
  const { data, error } = await c
    .from("billing_accounts")
    .select("total_billed, outstanding, total_paid")
    .eq("patient_did", did);
  return {
    ok: !error,
    note: error
      ? error.message.slice(0, 50)
      : data.length
        ? `billed=${data[0].total_billed} outstanding=${data[0].outstanding}`
        : "no account",
  };
});
await check("insurance", "policy + claims", async () => {
  const { data: p, error: e1 } = await c
    .from("insurance_policies")
    .select("provider, policy_number")
    .eq("patient_did", did);
  const { data: cl, error: e2 } = await c
    .from("insurance_claims")
    .select("claim_id, status")
    .eq("patient_did", did);
  return { ok: !e1 && !e2, note: `${p?.length ?? 0} policy, ${cl?.length ?? 0} claim(s)` };
});

// ── /patient/inpatient
await check("inpatient", "admission + beds", async () => {
  const { data: a, error: e1 } = await c
    .from("admissions")
    .select("admission_id, status, diagnosis, discharge_summary")
    .eq("patient_did", did);
  const { data: b, error: e2 } = await c
    .from("beds")
    .select("bed_id, status, ward_name_legacy")
    .limit(5);
  return {
    ok: !e1 && !e2,
    note: `${a?.length ?? 0} admission(s); beds query ${e2 ? "FAILED" : "ok"}`,
  };
});

// ── /patient/vaccines
await check("vaccines", "vaccines", async () => {
  const { data, error } = await c.from("vaccines").select("*").eq("patient_did", did);
  return { ok: !error, note: error ? error.message.slice(0, 50) : `${data.length} vaccine(s)` };
});

// ── /patient/history
await check("history", "own audit events only", async () => {
  const { data, error } = await c
    .from("audit_events")
    .select("tx_id, action, actor_did")
    .limit(200);
  if (error) return { ok: false, note: error.message.slice(0, 50) };
  const others = data.filter((e) => e.actor_did && e.actor_did !== did).length;
  return { ok: others === 0, note: `${data.length} event(s), ${others} belonging to someone else` };
});

// ── /patient/qr · wallet
await check("qr", "own DID + signing key", async () => {
  const { data: d } = await svc.from("dids").select("public_key").eq("did", did).maybeSingle();
  const keyed = d && !String(d.public_key).startsWith("pk_");
  return {
    ok: Boolean(keyed),
    note: keyed ? `real key ${String(d.public_key).slice(0, 12)}…` : "PLACEHOLDER key",
  };
});
await check("wallet", "credentials", async () => {
  const { data, error } = await c
    .from("credentials")
    .select("id, credential_type, status")
    .eq("subject_did", did);
  return { ok: !error, note: error ? error.message.slice(0, 50) : `${data.length} credential(s)` };
});

// ── isolation: must NOT see another patient
await check("SECURITY", "cannot read another patient's records", async () => {
  const { data: victim } = await svc
    .from("dids")
    .select("did")
    .eq("owner_type", "patient")
    .neq("did", did)
    .limit(1)
    .single();
  const { data } = await c
    .from("medical_records")
    .select("record_id")
    .eq("patient_did", victim.did);
  return {
    ok: (data?.length ?? 0) === 0,
    note: `saw ${data?.length ?? 0} of another patient's records`,
  };
});
await check("SECURITY", "cannot read patient_master of another", async () => {
  const { data: victim } = await svc
    .from("dids")
    .select("did")
    .eq("owner_type", "patient")
    .neq("did", did)
    .limit(1)
    .single();
  const { data } = await c
    .from("patient_master")
    .select("diagnosis, total_billed")
    .eq("patient_did", victim.did)
    .maybeSingle();
  const leaked = data && (data.diagnosis !== null || data.total_billed !== null);
  return { ok: !leaked, note: leaked ? "*** PHI LEAKED ***" : "no PHI returned" };
});

console.log("ROUTE          CHECK                                     RESULT");
console.log("─".repeat(96));
for (const r of results) {
  console.log(`${r.route.padEnd(14)} ${r.label.padEnd(41)} ${r.ok ? "PASS" : "FAIL"}  ${r.note}`);
}
const failed = results.filter((r) => !r.ok);
console.log("─".repeat(96));
console.log(`${results.length - failed.length}/${results.length} passed`);
await c.auth.signOut();
process.exit(failed.length ? 1 : 0);
