/**
 * RLS isolation tests — the security gate for the Supabase migration.
 *
 * These sign in as real seeded users and assert what each one can and cannot
 * read. Every query goes through the ANON key + a user session, exactly like
 * the browser will. Using service_role here would prove nothing: it bypasses
 * RLS entirely, so broken policies would still appear to work.
 *
 * The negative cases are the point. A passing "patient A cannot read patient
 * B's records" is the only evidence that direct client access is safe.
 *
 * Prerequisite: npm run seed
 * Run:          npm run test:rls
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PASSWORD = "SeedPassw0rd!dev";

const DIDS = {
  alice: "did:hosp:0xSEEDA01",
  bob: "did:hosp:0xSEEDB02",
  carol: "did:hosp:0xSEEDC03",
  drsmith: "did:hosp:0xSEEDD01",
  drjones: "did:hosp:0xSEEDD02",
};

/**
 * Sign in and return an anon-key client carrying that user's session.
 * Fresh client per user so sessions never bleed between assertions.
 */
async function signIn(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  assert.ok(data.session, `expected a session for ${email}`);
  return client;
}

let alice, bob, drsmith, drjones, admin;

before(async () => {
  assert.ok(SUPABASE_URL && ANON_KEY, "SUPABASE_URL and SUPABASE_ANON_KEY must be set");
  alice = await signIn("alice.patient@seed.test");
  bob = await signIn("bob.patient@seed.test");
  drsmith = await signIn("dr.smith@seed.test");
  drjones = await signIn("dr.jones@seed.test");
  admin = await signIn("admin@seed.test");
});

after(async () => {
  for (const c of [alice, bob, drsmith, drjones, admin]) {
    await c?.auth.signOut().catch(() => {});
  }
});

// ─── Patient isolation — the core guarantee ─────────────────────────────────

describe("Patient record isolation", () => {
  it("Alice CAN read her own records", async () => {
    const { data, error } = await alice
      .from("medical_records")
      .select("record_id")
      .eq("patient_did", DIDS.alice);

    assert.equal(error, null);
    assert.ok(data.length >= 2, `expected Alice's records, got ${data.length}`);
  });

  it("Alice CANNOT read Bob's records", async () => {
    const { data, error } = await alice
      .from("medical_records")
      .select("record_id")
      .eq("patient_did", DIDS.bob);

    // RLS filters rather than erroring: an empty set is the correct denial.
    assert.equal(error, null);
    assert.equal(data.length, 0, "LEAK: Alice read Bob's records");
  });

  it("Alice sees ONLY her own rows on an unfiltered select", async () => {
    // The dangerous case: a client omitting a filter must not receive everything.
    const { data, error } = await alice.from("medical_records").select("patient_did");

    assert.equal(error, null);
    const others = data.filter((r) => r.patient_did !== DIDS.alice);
    assert.equal(
      others.length,
      0,
      `LEAK: unfiltered select returned ${others.length} foreign rows`,
    );
  });

  it("Bob CANNOT read Alice's records", async () => {
    const { data, error } = await bob
      .from("medical_records")
      .select("record_id")
      .eq("patient_did", DIDS.alice);

    assert.equal(error, null);
    assert.equal(data.length, 0, "LEAK: Bob read Alice's records");
  });
});

// ─── Consent-gated clinician access ────────────────────────────────────────

describe("Clinician access via consent", () => {
  it("Dr Smith CAN read Alice's records (active consent)", async () => {
    const { data, error } = await drsmith
      .from("medical_records")
      .select("record_id")
      .eq("patient_did", DIDS.alice);

    assert.equal(error, null);
    assert.ok(data.length >= 2, `expected consented access, got ${data.length} rows`);
  });

  it("Dr Smith CANNOT read Bob's records (consent EXPIRED)", async () => {
    // consents row is status='active' but expires_at is in the past.
    // Proves expiry is enforced at query time, not by a cleanup job.
    const { data, error } = await drsmith
      .from("medical_records")
      .select("record_id")
      .eq("patient_did", DIDS.bob);

    assert.equal(error, null);
    assert.equal(data.length, 0, "LEAK: expired consent still granted access");
  });

  it("Dr Jones CANNOT read Carol's records (consent REVOKED)", async () => {
    const { data, error } = await drjones
      .from("medical_records")
      .select("record_id")
      .eq("patient_did", DIDS.carol);

    assert.equal(error, null);
    assert.equal(data.length, 0, "LEAK: revoked consent still granted access");
  });

  it("Dr Smith CANNOT read Carol's records (no consent at all)", async () => {
    const { data, error } = await drsmith
      .from("medical_records")
      .select("record_id")
      .eq("patient_did", DIDS.carol);

    assert.equal(error, null);
    assert.equal(data.length, 0, "LEAK: access without any consent");
  });
});

// ─── Write protection ───────────────────────────────────────────────────────

describe("Write protection", () => {
  it("A patient CANNOT forge a medical record", async () => {
    const { error } = await alice.from("medical_records").insert({
      record_id: "FORGED-BY-ALICE",
      patient_did: DIDS.alice,
      title: "Forged",
      record_type: "note",
    });

    assert.ok(error, "expected insert to be rejected");
    assert.match(error.message, /row-level security/i);
  });

  it("A patient CANNOT grant consent on someone else's behalf", async () => {
    // Alice tries to grant Dr Smith access to Bob's records.
    const { error } = await alice.from("consents").insert({
      grant_id: "FORGED-CONSENT",
      patient_did: DIDS.bob,
      doctor_did: DIDS.drsmith,
      resource: "Medical Records",
      status: "active",
    });

    assert.ok(error, "expected insert to be rejected");
    assert.match(error.message, /row-level security/i);
  });

  it("A patient CANNOT escalate their own role to admin", async () => {
    const { data } = await alice
      .from("profiles")
      .update({ role: "admin" })
      .eq("role", "patient")
      .select();

    // Either rejected outright, or the WITH CHECK clause filters it to no-op.
    assert.equal(data?.length ?? 0, 0, "PRIVILEGE ESCALATION: role change succeeded");

    const { data: check } = await alice.from("profiles").select("role").limit(1);
    assert.equal(check?.[0]?.role, "patient", "PRIVILEGE ESCALATION: role is now admin");
  });

  it("A patient CANNOT insert a DID (issuance is service_role only)", async () => {
    const { error } = await alice.from("dids").insert({
      did: "did:hosp:0xFORGED",
      owner_name: "Forged",
      owner_type: "patient",
      public_key: "pk",
      controller: "c",
    });

    assert.ok(error, "expected insert to be rejected");
    assert.match(error.message, /row-level security/i);
  });
});

// ─── Profile visibility ────────────────────────────────────────────────────

describe("Profile visibility", () => {
  it("A patient sees only their own profile", async () => {
    const { data, error } = await alice.from("profiles").select("email");

    assert.equal(error, null);
    assert.equal(data.length, 1, `LEAK: patient saw ${data.length} profiles`);
    assert.equal(data[0].email, "alice.patient@seed.test");
  });

  it("A clinician CAN see the roster", async () => {
    const { data, error } = await drsmith.from("profiles").select("email");

    assert.equal(error, null);
    assert.ok(data.length > 1, "clinician should see more than one profile");
  });
});

// ─── Helper functions must not be callable directly ────────────────────────

describe("RLS helper functions are not exposed", () => {
  it("has_active_consent cannot be invoked by a client", async () => {
    // If callable, this would leak the consent graph without reading records.
    const { error } = await alice.rpc("has_active_consent", {
      target_patient_did: DIDS.bob,
    });

    assert.ok(error, "expected permission denied");
    assert.match(error.message, /permission denied|not find/i);
  });
});

// ─── Admin break-glass is deliberately absent ──────────────────────────────

describe("Admin has no implicit PHI access", () => {
  it("Admin CANNOT read patient records via RLS", async () => {
    // Deliberate design choice: break-glass access belongs in an audited Edge
    // Function, not an invisible RLS bypass. If this ever starts returning
    // rows, that decision was silently reversed.
    const { data, error } = await admin.from("medical_records").select("record_id");

    assert.equal(error, null);
    assert.equal(data.length, 0, "admin gained implicit PHI access via RLS");
  });
});

// ─── Blockchain integrity ──────────────────────────────────────────────────
// Anchors and merkle roots must be readable by anyone (verification has to work
// without trusting a server) but writable by nobody except service_role.
// A client that could forge an anchor or backdate a root would defeat the
// entire point of anchoring.

describe("Blockchain anchors are read-only to clients", () => {
  it("A patient CAN read anchors (needed for client-side verification)", async () => {
    const { data, error } = await alice
      .from("solana_anchors")
      .select("anchor_id, record_hash, status");

    assert.equal(error, null);
    assert.ok(data.length >= 3, `expected seeded anchors, got ${data.length}`);
  });

  it("A patient CAN read merkle roots", async () => {
    const { data, error } = await alice.from("merkle_roots").select("publish_id, root_hash");

    assert.equal(error, null);
    assert.ok(data.length >= 1, "expected at least one published root");
  });

  it("A patient CANNOT forge an anchor", async () => {
    const { error } = await alice.from("solana_anchors").insert({
      anchor_id: "FORGED-ANCHOR",
      record_hash: "f".repeat(64),
      record_type: "medical-record",
      status: "confirmed",
      signature: "fake_signature",
      network: "devnet",
    });

    assert.ok(error, "expected insert to be rejected");
    assert.match(error.message, /row-level security/i);
  });

  it("A patient CANNOT backdate or alter a merkle root", async () => {
    const { error } = await alice.from("merkle_roots").insert({
      publish_id: "FORGED-ROOT",
      subject_did: DIDS.alice,
      root_hash: "e".repeat(64),
      event_count: 1,
      period_date: "2020-01-01",
    });

    assert.ok(error, "expected insert to be rejected");
    assert.match(error.message, /row-level security/i);
  });

  it("A clinician CANNOT rewrite an anchor's signature", async () => {
    // Tampering would let a confirmed anchor point at different content.
    const { data } = await drsmith
      .from("solana_anchors")
      .update({ signature: "tampered" })
      .eq("anchor_id", "SEED-ANCHOR-CONFIRMED")
      .select();

    assert.equal(data?.length ?? 0, 0, "TAMPER: anchor signature was modified");
  });
});

// ─── Clinical namespaces reuse the consent gate ────────────────────────────

describe("Prescriptions follow the consent model", () => {
  it("Alice CAN read her own prescriptions", async () => {
    const { data, error } = await alice.from("prescriptions").select("rx_id");

    assert.equal(error, null);
    assert.ok(data.length >= 1, `expected Alice's prescriptions, got ${data.length}`);
  });

  it("Alice CANNOT read Bob's prescriptions", async () => {
    const { data, error } = await alice
      .from("prescriptions")
      .select("rx_id")
      .eq("patient_did", DIDS.bob);

    assert.equal(error, null);
    assert.equal(data.length, 0, "LEAK: Alice read Bob's prescriptions");
  });

  it("The prescribing clinician retains access to what they wrote", async () => {
    // drsmith wrote SEED-RX-B1 for bob, whose consent has since expired.
    // Authorship access is intentional: a prescriber must be able to see their
    // own prescribing history.
    const { data, error } = await drsmith.from("prescriptions").select("rx_id");

    assert.equal(error, null);
    assert.ok(data.length >= 2, `expected authored prescriptions, got ${data.length}`);
  });

  it("A patient CANNOT forge a prescription", async () => {
    const { error } = await alice.from("prescriptions").insert({
      rx_id: "FORGED-RX",
      patient_did: DIDS.alice,
      doctor_did: DIDS.drsmith,
      drugs: [{ name: "Controlled substance" }],
      status: "active",
    });

    assert.ok(error, "expected insert to be rejected");
    assert.match(error.message, /row-level security/i);
  });
});

describe("Lab results follow the consent model", () => {
  it("Alice CAN read her own lab results", async () => {
    const { data, error } = await alice.from("lab_results").select("lab_id");

    assert.equal(error, null);
    assert.ok(data.length >= 1, `expected Alice's labs, got ${data.length}`);
  });

  it("Bob CANNOT read Alice's lab results", async () => {
    const { data, error } = await bob.from("lab_results").select("lab_id");

    assert.equal(error, null);
    assert.equal(data.length, 0, "LEAK: Bob read Alice's lab results");
  });
});

describe("Appointments are visible to both parties only", () => {
  it("Alice CAN see her appointment", async () => {
    const { data, error } = await alice.from("appointments").select("appt_id");

    assert.equal(error, null);
    assert.ok(data.length >= 1, "expected Alice's appointment");
  });

  it("Alice CANNOT see Carol's appointment with Dr Jones", async () => {
    const { data, error } = await alice
      .from("appointments")
      .select("appt_id")
      .eq("appt_id", "SEED-APPT-C1");

    assert.equal(error, null);
    assert.equal(data.length, 0, "LEAK: Alice saw an unrelated appointment");
  });
});

// ─── Audit trail is append-only ────────────────────────────────────────────

describe("Audit trail cannot be tampered with", () => {
  it("A client CANNOT insert audit events (service_role writes them)", async () => {
    // If clients could write audit rows they could fabricate history.
    const { error } = await alice.from("audit_events").insert({
      action: "FORGED_ACTION",
      outcome: "success",
    });

    assert.ok(error, "expected insert to be rejected");
    assert.match(error.message, /row-level security/i);
  });

  it("A client CANNOT delete audit events", async () => {
    const { data } = await alice.from("audit_events").delete().neq("action", "").select();

    assert.equal(data?.length ?? 0, 0, "TAMPER: audit events were deleted");
  });
});
