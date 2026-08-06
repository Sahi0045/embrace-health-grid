/**
 * Seed data for the Supabase schema — Embrace Health Grid
 *
 * Creates synthetic (non-PHI) users and clinical data sufficient to exercise
 * every RLS policy, including the cases that must FAIL.
 *
 * Uses the Supabase Auth admin API so users are real auth.users rows and can
 * actually sign in — RLS depends on auth.uid(), so fake UUIDs would prove
 * nothing.
 *
 * Idempotent: re-running deletes and recreates the seeded fixtures. Safe to
 * run repeatedly during development.
 *
 * Run: npm run seed
 *
 * NOTE: all names/emails/conditions below are invented. No real patient data.
 */

import { getServiceClient } from "../lib/supabase.js";

const db = getServiceClient();

// Shared password for seeded accounts — development only.
const SEED_PASSWORD = "SeedPassw0rd!dev";

/**
 * Fixture definition. Kept declarative so the RLS test file can import the
 * same shape and assert against known relationships.
 */
/**
 * Two hospitals, so tenancy is exercised rather than assumed. Slugs are capped at
 * 19 characters because the on-chain PDA is seeded on the full DID and a Solana
 * seed cannot exceed 32 bytes.
 */
export const HOSPITALS = [
  {
    key: "apollo",
    slug: "apollo-general",
    name: "Apollo General",
    hospital_did: "did:hosp:org:apollo-general",
    city: "Bengaluru",
    country: "IN",
  },
  {
    key: "citycare",
    slug: "city-care",
    name: "City Care Hospital",
    hospital_did: "did:hosp:org:city-care",
    city: "Pune",
    country: "IN",
  },
];

/**
 * Fixture definition. Kept declarative so the RLS test file can import the same
 * shape and assert against known relationships.
 *
 * Split across two hospitals on purpose:
 *   Apollo   — alice, bob, drsmith, admin
 *   City Care — carol, drjones, admin2
 *
 * That gives the tenancy tests a real cross-hospital pair: drjones must not see
 * Apollo's patients, and drsmith must not see City Care's.
 */
export const FIXTURES = {
  patients: [
    {
      key: "alice",
      email: "alice.patient@seed.test",
      name: "Alice Tan",
      did: "did:hosp:0xSEEDA01",
      hospital: "apollo",
    },
    {
      key: "bob",
      email: "bob.patient@seed.test",
      name: "Bob Iyer",
      did: "did:hosp:0xSEEDB02",
      hospital: "apollo",
    },
    {
      key: "carol",
      email: "carol.patient@seed.test",
      name: "Carol Nair",
      did: "did:hosp:0xSEEDC03",
      hospital: "citycare",
    },
  ],
  doctors: [
    {
      key: "drsmith",
      email: "dr.smith@seed.test",
      name: "Dr Sara Smith",
      did: "did:hosp:0xSEEDD01",
      hospital: "apollo",
    },
    {
      key: "drjones",
      email: "dr.jones@seed.test",
      name: "Dr Raj Jones",
      did: "did:hosp:0xSEEDD02",
      hospital: "citycare",
    },
  ],
  admins: [
    {
      key: "admin",
      email: "admin@seed.test",
      name: "Ops Admin",
      did: "did:hosp:0xSEEDX01",
      hospital: "apollo",
    },
    {
      key: "admin2",
      email: "admin2@seed.test",
      name: "City Care Admin",
      did: "did:hosp:0xSEEDX02",
      hospital: "citycare",
    },
  ],
  /**
   * The platform operator. No hospital: a trigger rejects a super_admin with
   * one, because it belongs to the platform rather than a tenant.
   */
  superAdmins: [
    {
      key: "super",
      email: "super@seed.test",
      name: "Platform Super Admin",
      did: "did:hosp:0xSEEDS01",
      hospital: null,
    },
  ],
};

/**
 * Consent matrix — deliberately includes an expired and a revoked grant so the
 * tests can prove that neither grants access.
 *
 *   alice  -> drsmith : active   (drsmith SHOULD read alice)
 *   bob    -> drsmith : expired  (drsmith must NOT read bob)
 *   carol  -> drjones : revoked  (drjones must NOT read carol)
 *   carol  -> drsmith : none     (drsmith must NOT read carol)
 */
const CONSENTS = [
  {
    grant_id: "seed_consent_active",
    patient: "alice",
    doctor: "drsmith",
    resource: "Medical Records",
    status: "active",
    expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
  },
  {
    grant_id: "seed_consent_expired",
    patient: "bob",
    doctor: "drsmith",
    resource: "Medical Records",
    status: "active", // status active but expiry in the past — must still deny
    expires_at: new Date(Date.now() - 864e5).toISOString(),
  },
  {
    grant_id: "seed_consent_revoked",
    patient: "carol",
    doctor: "drjones",
    resource: "Medical Records",
    status: "revoked",
    expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
  },
];

const RECORDS = [
  { record_id: "SEED-REC-A1", patient: "alice", title: "Annual Physical", type: "consult-note" },
  { record_id: "SEED-REC-A2", patient: "alice", title: "Lipid Panel", type: "lab-report" },
  { record_id: "SEED-REC-B1", patient: "bob", title: "Fracture Follow-up", type: "consult-note" },
  { record_id: "SEED-REC-C1", patient: "carol", title: "Allergy Review", type: "consult-note" },
];

/** Prescriptions — drsmith prescribes for alice (consented) and bob (expired). */
const PRESCRIPTIONS = [
  {
    rx_id: "SEED-RX-A1",
    patient: "alice",
    doctor: "drsmith",
    diagnosis: "Hypertension",
    drugs: [{ name: "Amlodipine 5mg", dosage: "5mg", frequency: "Once daily" }],
  },
  {
    rx_id: "SEED-RX-B1",
    patient: "bob",
    doctor: "drsmith",
    diagnosis: "Post-fracture pain",
    drugs: [{ name: "Ibuprofen 400mg", dosage: "400mg", frequency: "Twice daily" }],
  },
];

const APPOINTMENTS = [
  {
    appt_id: "SEED-APPT-A1",
    patient: "alice",
    doctor: "drsmith",
    slot: "Mon, 10:00 AM",
    status: "confirmed",
  },
  {
    appt_id: "SEED-APPT-C1",
    patient: "carol",
    doctor: "drjones",
    slot: "Tue, 02:00 PM",
    status: "pending",
  },
];

const LAB_RESULTS = [
  {
    lab_id: "SEED-LAB-A1",
    patient: "alice",
    ordered_by: "drsmith",
    test_name: "LDL Cholesterol",
    result_value: "128",
    unit: "mg/dL",
    reference_range: "<100",
    status: "final",
  },
];

/**
 * Blockchain fixtures. Written via service_role because clients have no INSERT
 * policy on these tables by design — a forged anchor would defeat anchoring.
 *
 * Covers all three anchor states so the retry/monitoring paths have data:
 * confirmed (has signature), pending (no signature yet), failed (error set).
 */
const ANCHORS = [
  {
    anchor_id: "SEED-ANCHOR-CONFIRMED",
    record_hash: "a".repeat(64),
    record_type: "medical-record",
    record_id: "SEED-REC-A1",
    status: "confirmed",
    signature: "seed_sig_confirmed_0001",
    slot: 480956544,
    network: "devnet",
  },
  {
    anchor_id: "SEED-ANCHOR-PENDING",
    record_hash: "b".repeat(64),
    record_type: "prescription",
    record_id: "SEED-RX-A1",
    status: "pending",
    signature: null,
    slot: null,
    network: "devnet",
  },
  {
    anchor_id: "SEED-ANCHOR-FAILED",
    record_hash: "c".repeat(64),
    record_type: "lab-result",
    record_id: "SEED-LAB-A1",
    status: "failed",
    signature: null,
    slot: null,
    network: "devnet",
    error: "blockhash not found",
  },
];

const ALL = [
  ...FIXTURES.patients.map((p) => ({ ...p, role: "patient" })),
  ...FIXTURES.doctors.map((d) => ({ ...d, role: "doctor" })),
  ...FIXTURES.admins.map((a) => ({ ...a, role: "admin" })),
  ...FIXTURES.superAdmins.map((a) => ({ ...a, role: "super_admin" })),
];

/** Populated by seedHospitals(); fixture hospital key -> hospital_id. */
const hospitalIds = {};

/** Look up a seeded auth user by email, since createUser fails if one exists. */
async function findAuthUserByEmail(email) {
  // listUsers is paginated; seeded set is small so one page suffices.
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  return data.users.find((u) => u.email === email) ?? null;
}

/** Remove previously seeded fixtures so the script is safely re-runnable. */
async function cleanup() {
  console.log("Cleaning previous seed data...");

  // Child rows first — FKs cascade from dids, but be explicit.
  await db.from("merkle_roots").delete().like("publish_id", "SEED-%");
  await db.from("solana_anchors").delete().like("anchor_id", "SEED-%");
  await db.from("lab_results").delete().like("lab_id", "SEED-%");
  await db.from("appointments").delete().like("appt_id", "SEED-%");
  await db.from("prescriptions").delete().like("rx_id", "SEED-%");
  await db.from("medical_records").delete().like("record_id", "SEED-%");
  await db.from("consents").delete().like("grant_id", "seed_%");
  await db.from("credentials").delete().like("id", "seed_%");

  for (const u of ALL) {
    const existing = await findAuthUserByEmail(u.email);
    if (existing) {
      // profiles/dids cascade from auth.users on delete.
      const { error } = await db.auth.admin.deleteUser(existing.id);
      if (error) console.warn(`  warn: could not delete ${u.email}: ${error.message}`);
    }
  }
  // Belt and braces in case a DID was orphaned.
  await db.from("dids").delete().like("did", "did:hosp:0xSEED%");
}

/**
 * Upsert the hospitals first: profiles and dids reference them, and the Stage 2
 * trigger rejects a staff profile with no hospital.
 */
async function seedHospitals() {
  console.log("Seeding hospitals...");
  for (const h of HOSPITALS) {
    const { data, error } = await db
      .from("hospitals")
      .upsert(
        {
          hospital_did: h.hospital_did,
          name: h.name,
          slug: h.slug,
          city: h.city,
          country: h.country,
          status: "active",
        },
        { onConflict: "slug" },
      )
      .select("hospital_id")
      .single();

    if (error) throw new Error(`hospital ${h.slug}: ${error.message}`);
    hospitalIds[h.key] = data.hospital_id;
    console.log(`  hospital   ${h.name}  ${h.hospital_did}`);
  }
}

async function seed() {
  await seedHospitals();

  console.log("Seeding users via Auth admin API...");

  const ids = {}; // fixture key -> auth user id

  for (const u of ALL) {
    const { data, error } = await db.auth.admin.createUser({
      email: u.email,
      password: SEED_PASSWORD,
      email_confirm: true, // skip the confirmation flow for dev accounts
      user_metadata: { full_name: u.name, seeded: true },
    });
    if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
    ids[u.key] = data.user.id;
    console.log(`  auth user  ${u.email}  (${u.role})`);
  }

  // profiles has no client INSERT policy by design — service_role writes it.
  console.log("Inserting profiles...");
  const { error: pErr } = await db.from("profiles").insert(
    ALL.map((u) => ({
      id: ids[u.key],
      email: u.email,
      full_name: u.name,
      role: u.role,
      // null for the super_admin, which the trigger requires.
      hospital_id: u.hospital ? hospitalIds[u.hospital] : null,
    })),
  );
  if (pErr) throw new Error(`profiles insert: ${pErr.message}`);

  console.log("Inserting DIDs...");
  const { error: dErr } = await db.from("dids").insert(
    ALL.map((u) => ({
      did: u.did,
      owner_id: ids[u.key],
      owner_name: u.name,
      owner_type: u.role,
      public_key: `pk_seed_${u.key}`,
      // Controlled by the hospital that issued it, so a credential proves which
      // hospital vouched for the holder. The platform operator's own DID has no
      // hospital, so it falls back to the consortium authority.
      controller: u.hospital
        ? HOSPITALS.find((h) => h.key === u.hospital).hospital_did
        : "did:hosp:consortium:authority",
      status: "active",
      hospital_id: u.hospital ? hospitalIds[u.hospital] : null,
    })),
  );
  if (dErr) throw new Error(`dids insert: ${dErr.message}`);

  // Link each profile to its primary DID.
  for (const u of ALL) {
    const { error } = await db.from("profiles").update({ primary_did: u.did }).eq("id", ids[u.key]);
    if (error) throw new Error(`profile primary_did ${u.email}: ${error.message}`);
  }

  console.log("Inserting consents...");
  const byKey = Object.fromEntries(ALL.map((u) => [u.key, u]));
  const { error: cErr } = await db.from("consents").insert(
    CONSENTS.map((c) => ({
      grant_id: c.grant_id,
      patient_did: byKey[c.patient].did,
      doctor_did: byKey[c.doctor].did,
      resource: c.resource,
      status: c.status,
      expires_at: c.expires_at,
      revoked_at: c.status === "revoked" ? new Date().toISOString() : null,
    })),
  );
  if (cErr) throw new Error(`consents insert: ${cErr.message}`);

  console.log("Inserting medical records...");
  const { error: rErr } = await db.from("medical_records").insert(
    RECORDS.map((r) => ({
      record_id: r.record_id,
      patient_did: byKey[r.patient].did,
      title: r.title,
      record_type: r.type,
      content: `Synthetic content for ${r.title}. Not real patient data.`,
      author_did: byKey.drsmith.did,
      author_name: byKey.drsmith.name,
      content_hash: `sha256:seed${r.record_id.toLowerCase()}`,
    })),
  );
  if (rErr) throw new Error(`medical_records insert: ${rErr.message}`);

  console.log("Inserting prescriptions...");
  const { error: rxErr } = await db.from("prescriptions").insert(
    PRESCRIPTIONS.map((p) => ({
      rx_id: p.rx_id,
      patient_did: byKey[p.patient].did,
      doctor_did: byKey[p.doctor].did,
      drugs: p.drugs,
      diagnosis: p.diagnosis,
      notes: "Synthetic prescription. Not real patient data.",
      status: "active",
      signed: true,
      signed_by: byKey[p.doctor].did,
      signed_at: new Date().toISOString(),
      content_hash: `sha256:seed${p.rx_id.toLowerCase()}`,
    })),
  );
  if (rxErr) throw new Error(`prescriptions insert: ${rxErr.message}`);

  console.log("Inserting appointments...");
  const { error: aErr } = await db.from("appointments").insert(
    APPOINTMENTS.map((a) => ({
      appt_id: a.appt_id,
      patient_did: byKey[a.patient].did,
      doctor_did: byKey[a.doctor].did,
      slot: a.slot,
      mode: "in-person",
      specialty: "General Medicine",
      status: a.status,
    })),
  );
  if (aErr) throw new Error(`appointments insert: ${aErr.message}`);

  console.log("Inserting lab results...");
  const { error: lErr } = await db.from("lab_results").insert(
    LAB_RESULTS.map((l) => ({
      lab_id: l.lab_id,
      patient_did: byKey[l.patient].did,
      ordered_by: byKey[l.ordered_by].did,
      test_name: l.test_name,
      result_value: l.result_value,
      unit: l.unit,
      reference_range: l.reference_range,
      status: l.status,
      content_hash: `sha256:seed${l.lab_id.toLowerCase()}`,
      resulted_at: new Date().toISOString(),
    })),
  );
  if (lErr) throw new Error(`lab_results insert: ${lErr.message}`);

  console.log("Inserting blockchain anchors (service_role only)...");
  const { error: anErr } = await db.from("solana_anchors").insert(
    ANCHORS.map((a) => ({
      anchor_id: a.anchor_id,
      record_hash: a.record_hash,
      record_type: a.record_type,
      record_id: a.record_id,
      actor_did: byKey.drsmith.did,
      status: a.status,
      signature: a.signature,
      slot: a.slot,
      network: a.network,
      error: a.error ?? null,
      confirmed_at: a.status === "confirmed" ? new Date().toISOString() : null,
    })),
  );
  if (anErr) throw new Error(`solana_anchors insert: ${anErr.message}`);

  console.log("Inserting merkle root...");
  const { error: mErr } = await db.from("merkle_roots").insert({
    publish_id: "SEED-ROOT-D1",
    subject_did: byKey.drsmith.did,
    root_hash: "d".repeat(64),
    event_count: 3,
    event_ids: ["SEED-EV-1", "SEED-EV-2", "SEED-EV-3"],
    period_date: new Date().toISOString().slice(0, 10),
    anchor_id: "SEED-ANCHOR-CONFIRMED",
  });
  if (mErr) throw new Error(`merkle_roots insert: ${mErr.message}`);

  return ids;
}

async function main() {
  const { describeConnection } = await import("../lib/supabase.js");
  const conn = describeConnection();
  console.log(`Target project: ${conn.projectRef}\n`);

  await cleanup();
  const ids = await seed();

  console.log("\nSeed complete.");
  console.log(`  users            ${ALL.length}`);
  console.log(`  consents         ${CONSENTS.length} (1 active, 1 expired, 1 revoked)`);
  console.log(`  medical records  ${RECORDS.length}`);
  console.log(`  prescriptions    ${PRESCRIPTIONS.length}`);
  console.log(`  appointments     ${APPOINTMENTS.length}`);
  console.log(`  lab results      ${LAB_RESULTS.length}`);
  console.log(`  anchors          ${ANCHORS.length} (1 confirmed, 1 pending, 1 failed)`);
  console.log(`  merkle roots     1`);
  console.log(`\n  password for all seeded accounts: ${SEED_PASSWORD}`);
  console.log("\nExpected access matrix:");
  console.log("  dr.smith  CAN  read alice (active consent)");
  console.log("  dr.smith  CANNOT read bob   (consent expired)");
  console.log("  dr.jones  CANNOT read carol (consent revoked)");
  console.log("  alice     CANNOT read bob's records");

  return ids;
}

main().catch((err) => {
  console.error("\nSEED FAILED:", err.message);
  process.exit(1);
});
