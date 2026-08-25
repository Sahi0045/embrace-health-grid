/**
 * Doctor / staff portal end-to-end check.
 *
 * Signs in as a real seeded clinician over the ANON key, so every read goes
 * through RLS exactly as the browser does, and exercises the data each staff
 * route depends on. Isolation checks at the end are the point: a clinician must
 * see their own hospital and their consented patients, and nothing else.
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

const EMAIL = process.env.E2E_EMAIL ?? "dr.smith@seed.test";
const c = createClient(be.SUPABASE_URL, be.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: auth, error: se } = await c.auth.signInWithPassword({
  email: EMAIL,
  password: "SeedPassw0rd!dev",
});
if (se) {
  console.log("sign-in failed:", se.message);
  process.exit(1);
}

const svc = createClient(be.SUPABASE_URL, be.SUPABASE_SERVICE_ROLE_KEY);
const { data: me } = await c.from("profiles").select("*").eq("id", auth.user.id).single();
const { data: hosp } = await svc
  .from("hospitals")
  .select("name")
  .eq("hospital_id", me.hospital_id)
  .maybeSingle();
const did = me.primary_did;

console.log(`signed in: ${me.full_name} <${me.email}>  role=${me.role}`);
console.log(`DID: ${did}   hospital: ${hosp?.name ?? "(none)"}\n`);

const results = [];
async function check(route, label, fn) {
  try {
    results.push({ route, label, ...(await fn()) });
  } catch (err) {
    results.push({ route, label, ok: false, note: `THREW: ${String(err.message).slice(0, 60)}` });
  }
}

// ── /staff/patients, /staff/patient-master
await check("patients", "patient directory (own hospital)", async () => {
  const { data, error } = await c
    .from("profiles")
    .select("id,hospital_id,role")
    .eq("role", "patient");
  if (error) return { ok: false, note: error.message.slice(0, 50) };
  const foreign = data.filter((p) => p.hospital_id && p.hospital_id !== me.hospital_id).length;
  return { ok: foreign === 0, note: `${data.length} patient(s), ${foreign} from another hospital` };
});

// ── /staff/consent
await check("consent", "consents where I am the doctor", async () => {
  const { data, error } = await c.from("consents").select("grant_id,status,patient_did,doctor_did");
  if (error) return { ok: false, note: error.message.slice(0, 50) };
  const notMine = data.filter((x) => x.doctor_did !== did && x.patient_did !== did).length;
  return {
    ok: notMine === 0,
    note: `${data.length} consent(s), ${notMine} involving neither me nor my patients`,
  };
});

// ── /staff/prescriptions, /staff/sign
await check("prescriptions", "prescriptions visible", async () => {
  const { data, error } = await c
    .from("prescriptions")
    .select("rx_id,patient_did,doctor_did,signed,appointment_id");
  return { ok: !error, note: error ? error.message.slice(0, 50) : `${data.length} rx` };
});

// ── /staff/labs
await check("labs", "lab results + priority column", async () => {
  const { data, error } = await c.from("lab_results").select("lab_id,test_name,priority,status");
  if (error) return { ok: false, note: error.message.slice(0, 50) };
  const stat = data.filter((l) => l.priority === "stat").length;
  return { ok: true, note: `${data.length} lab(s), ${stat} STAT` };
});

// ── /staff/appointments, /staff/schedule
await check("appointments", "appointments where I am the doctor", async () => {
  const { data, error } = await c
    .from("appointments")
    .select("appt_id,status,doctor_did,reason,clinician_note,suggested_slot");
  if (error) return { ok: false, note: error.message.slice(0, 50) };
  const notMine = data.filter((a) => a.doctor_did !== did).length;
  return { ok: notMine === 0, note: `${data.length} appt(s), ${notMine} for another clinician` };
});

// ── /staff/rooms, /staff/emergency, /staff/command
await check("rooms", "beds query (renamed ward column)", async () => {
  const { data, error } = await c
    .from("beds")
    .select("bed_id,status,ward_name_legacy,ward_id,bed_number");
  return { ok: !error, note: error ? error.message.slice(0, 55) : `${data.length} bed(s)` };
});
await check("rooms", "rooms query", async () => {
  const { data, error } = await c.from("rooms").select("room_id,room_name,room_type,floor,status");
  return { ok: !error, note: error ? error.message.slice(0, 55) : `${data.length} room(s)` };
});
await check("emergency", "ambulances (dispatch enum)", async () => {
  const { data, error } = await c
    .from("ambulances")
    .select("ambulance_id,status,registration,current_location");
  return { ok: !error, note: error ? error.message.slice(0, 55) : `${data.length} ambulance(s)` };
});

// ── /staff/surgeries, /staff/visitors, /staff/attendance
for (const [route, table, cols] of [
  ["surgeries", "surgeries", "surgery_id,patient_did,status"],
  ["visitors", "visitors", "visitor_id,patient_did,visitor_name,status"],
  ["attendance", "attendance", "staff_id,action,recorded_at,location"],
]) {
  await check(route, `${table} readable`, async () => {
    const { data, error } = await c.from(table).select(cols);
    return { ok: !error, note: error ? error.message.slice(0, 55) : `${data.length} row(s)` };
  });
}

// ── /staff/profile
await check("profile", "own DID has a real signing key", async () => {
  const { data } = await svc.from("dids").select("public_key").eq("did", did).maybeSingle();
  const real = data && !String(data.public_key).startsWith("pk_");
  return {
    ok: Boolean(real),
    note: real ? `real key ${String(data.public_key).slice(0, 12)}…` : "PLACEHOLDER key",
  };
});

// ── clinical access must be consent-gated
await check("SECURITY", "records via consent or own authorship only", async () => {
  // medical_records_select_doctor allows two paths, and both are intended:
  // an active approved consent, OR being the clinician who wrote the record —
  // "the clinician who authored the record keeps access to their own work".
  // The author path is deliberately cross-hospital, which is the referral case.
  // A check that ignores it reports a false positive.
  const { data: mine } = await c
    .from("consents")
    .select("patient_did")
    .eq("doctor_did", did)
    .eq("status", "active")
    .not("approved_at", "is", null);
  const allowed = new Set((mine ?? []).map((x) => x.patient_did));
  const { data: recs } = await c.from("medical_records").select("patient_did, author_did");
  const outside = (recs ?? []).filter(
    (r) => r.patient_did !== did && !allowed.has(r.patient_did) && r.author_did !== did,
  );
  const authored = (recs ?? []).filter(
    (r) => r.author_did === did && !allowed.has(r.patient_did),
  ).length;
  return {
    ok: outside.length === 0,
    note: `${recs?.length ?? 0} record(s); ${authored} via authorship; ${outside.length} unexplained`,
  };
});
await check("SECURITY", "cannot read another hospital's admissions", async () => {
  const { data: other } = await svc
    .from("hospitals")
    .select("hospital_id")
    .neq("hospital_id", me.hospital_id)
    .limit(1)
    .single();
  const { data } = await c
    .from("admissions")
    .select("admission_id")
    .eq("hospital_id", other.hospital_id);
  return {
    ok: (data?.length ?? 0) === 0,
    note: `saw ${data?.length ?? 0} of another hospital's admissions`,
  };
});
await check("SECURITY", "cannot export a patient's private key", async () => {
  const { data: victim } = await svc
    .from("dids")
    .select("did,owner_id")
    .eq("owner_type", "patient")
    .not("owner_id", "is", null)
    .limit(1)
    .single();
  const { data: owned } = await svc.from("dids").select("did").eq("owner_id", auth.user.id);
  const canReach = (owned ?? []).some((d) => d.did === victim.did);
  const { data: leak } = await c.from("embedded_wallets").select("encrypted_private_key").limit(1);
  return {
    ok: !canReach && (leak?.length ?? 0) === 0,
    note: canReach ? "*** owns victim DID ***" : "no key access",
  };
});

console.log("ROUTE          CHECK                                     RESULT");
console.log("─".repeat(100));
for (const r of results)
  console.log(`${r.route.padEnd(14)} ${r.label.padEnd(41)} ${r.ok ? "PASS" : "FAIL"}  ${r.note}`);
const failed = results.filter((r) => !r.ok);
console.log("─".repeat(100));
console.log(`${results.length - failed.length}/${results.length} passed`);
await c.auth.signOut();
process.exit(failed.length ? 1 : 0);
