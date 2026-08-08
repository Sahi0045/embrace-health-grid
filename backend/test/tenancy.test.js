/**
 * Multi-tenancy isolation tests.
 *
 * The RLS suite proves patient-level isolation. This proves HOSPITAL-level
 * isolation, which is a separate property: before the multi-tenancy migration
 * every policy passed while `dids_select_authenticated` was literally
 * `USING (true)`, so a suite that only checks patient scoping cannot catch a
 * tenant leak.
 *
 * The important tests here are the negative ones. A test that a doctor sees
 * their own hospital proves little; a test that they cannot see the other
 * hospital's patients is the one that would fail if a policy regressed.
 *
 * Fixtures (npm run seed):
 *   Apollo General     — alice, bob, dr.smith, admin
 *   City Care Hospital — carol, dr.jones, admin2
 *   Platform           — super (no hospital)
 *
 * Run: npm run test:tenancy
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "SeedPassw0rd!dev";

/** Sign in and return a client scoped to that user's RLS view. */
async function as(email) {
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

let admin;
let apolloDoctor, cityDoctor, apolloAdmin, cityAdmin, platform, apolloPatient;
let apolloId, cityId;
const createdConsents = [];

before(async () => {
  assert.ok(URL && ANON && SERVICE, "Supabase env vars must be set");
  admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: hospitals } = await admin.from("hospitals").select("hospital_id, slug");
  apolloId = hospitals.find((h) => h.slug === "apollo-general")?.hospital_id;
  cityId = hospitals.find((h) => h.slug === "city-care")?.hospital_id;
  assert.ok(apolloId && cityId, "both seeded hospitals must exist — run npm run seed");

  apolloDoctor = await as("dr.smith@seed.test");
  cityDoctor = await as("dr.jones@seed.test");
  apolloAdmin = await as("admin@seed.test");
  cityAdmin = await as("admin2@seed.test");
  platform = await as("super@seed.test");
  apolloPatient = await as("alice.patient@seed.test");
});

after(async () => {
  for (const id of createdConsents) {
    await admin.from("consents").delete().eq("grant_id", id);
  }
});

describe("Hospital directories are isolated", () => {
  it("a doctor sees no profiles from another hospital", async () => {
    // This is the test that would have failed before the migration:
    // profiles_select_staff was scoped by role alone.
    const { data } = await cityDoctor.from("profiles").select("email, hospital_id");
    const foreign = (data ?? []).filter((p) => p.hospital_id && p.hospital_id !== cityId);
    assert.equal(foreign.length, 0, `saw ${foreign.length} profiles from another hospital`);
  });

  it("an admin sees no profiles from another hospital", async () => {
    const { data } = await cityAdmin.from("profiles").select("email, hospital_id");
    const foreign = (data ?? []).filter((p) => p.hospital_id && p.hospital_id !== cityId);
    assert.equal(foreign.length, 0);
  });

  it("an admin cannot see the other hospital's staff by email", async () => {
    const { data } = await cityAdmin
      .from("profiles")
      .select("email")
      .eq("email", "dr.smith@seed.test");
    assert.equal(data?.length ?? 0, 0, "City Care admin resolved an Apollo clinician's profile");
  });

  it("a doctor cannot enumerate another hospital's PATIENT dids", async () => {
    // The clinician directory is deliberately cross-hospital; patient DIDs are
    // not, or it would become a patient enumeration endpoint.
    const { data } = await cityDoctor
      .from("dids")
      .select("did, owner_type, hospital_id")
      .eq("owner_type", "patient");

    const foreign = (data ?? []).filter((d) => d.hospital_id !== cityId);
    assert.equal(foreign.length, 0, `saw ${foreign.length} foreign patient DIDs`);
  });

  it("the clinician directory IS visible across hospitals", async () => {
    // Required for referrals: a patient must be able to find a clinician
    // elsewhere, and a credential's holder must be resolvable.
    const { data } = await cityDoctor
      .from("dids")
      .select("did, owner_type, hospital_id")
      .in("owner_type", ["doctor", "staff"]);

    const foreign = (data ?? []).filter((d) => d.hospital_id === apolloId);
    assert.ok(foreign.length > 0, "cross-hospital clinician directory is empty — referrals break");
  });

  it("a super admin sees every hospital's profiles", async () => {
    const { data } = await platform.from("profiles").select("email, hospital_id");
    const hospitalsSeen = new Set((data ?? []).map((p) => p.hospital_id).filter(Boolean));
    assert.ok(hospitalsSeen.size >= 2, "platform operator should span tenants");
  });
});

describe("Hospital-owned operations are isolated", () => {
  // Seeded rows all belong to Apollo, so City Care staff must see none of them.
  for (const table of ["beds", "rooms", "attendance", "staff_schedule", "equipment"]) {
    it(`${table}: City Care staff see no Apollo rows`, async () => {
      const { data } = await cityDoctor.from(table).select("hospital_id");
      const foreign = (data ?? []).filter((r) => r.hospital_id === apolloId);
      assert.equal(foreign.length, 0, `${table} leaked ${foreign.length} rows`);
    });
  }

  // The reverse direction. Isolation was only ever asserted City Care -> Apollo,
  // which a policy that happened to hardcode one hospital would still pass.
  // apolloDoctor and apolloAdmin were signed in but never asserted against.
  for (const table of ["beds", "rooms", "attendance", "staff_schedule", "equipment"]) {
    it(`${table}: Apollo staff see no City Care rows`, async () => {
      const { data } = await apolloDoctor.from(table).select("hospital_id");
      const foreign = (data ?? []).filter((r) => r.hospital_id === cityId);
      assert.equal(foreign.length, 0, `${table} leaked ${foreign.length} rows`);
    });
  }

  it("fraud alerts stay within the hospital", async () => {
    const { data } = await cityAdmin.from("fraud_alerts").select("hospital_id");
    const foreign = (data ?? []).filter((r) => r.hospital_id === apolloId);
    assert.equal(foreign.length, 0);
  });

  it("fraud alerts stay within the hospital (reverse)", async () => {
    const { data } = await apolloAdmin.from("fraud_alerts").select("hospital_id");
    const foreign = (data ?? []).filter((r) => r.hospital_id === cityId);
    assert.equal(foreign.length, 0);
  });

  it("governance policies ARE readable across hospitals", async () => {
    // Deliberate: a patient must be able to read a hospital's policy before
    // consenting to it, and a null hospital_id means platform-wide.
    const { error } = await apolloPatient.from("governance_policies").select("policy_id").limit(1);
    assert.equal(error, null, "policy visibility must not be tenant-gated");
  });
});

describe("Clinical records follow the patient, not the hospital", () => {
  it("a doctor at another hospital sees nothing WITHOUT consent", async () => {
    const { data } = await cityDoctor
      .from("medical_records")
      .select("record_id")
      .eq("patient_did", "did:hosp:0xSEEDA01");
    assert.equal(data?.length ?? 0, 0);
  });

  it("a doctor at another hospital sees records WITH consent", async () => {
    // The referral case. If this fails, hospital scoping has been applied to PHI
    // and a referred patient can no longer share their history.
    const grantId = `tenancy_test_${Date.now()}`;
    createdConsents.push(grantId);

    const { error: cErr } = await admin.from("consents").insert({
      grant_id: grantId,
      patient_did: "did:hosp:0xSEEDA01",
      doctor_did: "did:hosp:0xSEEDD02", // dr.jones, City Care
      resource: "Medical Records",
      status: "active",
    });
    assert.equal(cErr, null, `consent insert failed: ${cErr?.message}`);

    const { data } = await cityDoctor
      .from("medical_records")
      .select("record_id")
      .eq("patient_did", "did:hosp:0xSEEDA01");

    assert.ok(
      (data?.length ?? 0) > 0,
      "cross-hospital consent granted no access — referrals are broken",
    );
  });

  it("a consented doctor can resolve the patient's name across hospitals", async () => {
    // Without this a referred record renders as a bare DID.
    const { data } = await cityDoctor
      .from("dids")
      .select("owner_name")
      .eq("did", "did:hosp:0xSEEDA01")
      .maybeSingle();
    assert.equal(data?.owner_name, "Alice Tan");
  });
});

describe("Tenant boundaries cannot be edited away", () => {
  it("a hospital admin cannot create a hospital", async () => {
    const { error } = await cityAdmin.from("hospitals").insert({
      hospital_did: "did:hosp:org:rogue",
      name: "Rogue",
      slug: "rogue-test",
    });
    assert.ok(error, "a hospital admin minted a tenant");
  });

  it("a hospital admin cannot un-suspend or alter another hospital", async () => {
    const { data } = await cityAdmin
      .from("hospitals")
      .update({ status: "suspended" })
      .eq("hospital_id", apolloId)
      .select("hospital_id");
    assert.equal(data?.length ?? 0, 0, "a hospital admin changed another hospital's status");
  });

  it("no client may delete a hospital", async () => {
    // Suspension is a status change so the audit history survives; there is no
    // DELETE policy at all.
    const { data } = await platform
      .from("hospitals")
      .delete()
      .eq("hospital_id", cityId)
      .select("hospital_id");
    assert.equal(data?.length ?? 0, 0, "a hospital was deleted through the API");
  });

  it("a staff profile cannot exist without a hospital", async () => {
    const { data: u } = await admin.auth.admin.createUser({
      email: `orphan${Date.now()}@seed.test`,
      password: PASSWORD,
      email_confirm: true,
    });
    const { error } = await admin.from("profiles").insert({
      id: u.user.id,
      email: u.user.email,
      full_name: "Orphan Staff",
      role: "doctor",
      hospital_id: null,
    });
    await admin.auth.admin.deleteUser(u.user.id);
    assert.ok(error, "a doctor was created outside every hospital");
  });

  it("a super admin cannot belong to a hospital", async () => {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", "super@seed.test")
      .single();

    const { error } = await admin
      .from("profiles")
      .update({ hospital_id: apolloId })
      .eq("id", profile.id);

    assert.ok(error, "the platform operator was scoped to a tenant");
  });
});
