/**
 * Edge Function tests — Embrace Health Grid
 *
 * Exercises the deployed functions against the live project using real signed-in
 * users, asserting both the happy path and the refusals.
 *
 * The negative cases matter most: these functions hold service_role and are
 * publicly reachable, so a missing authorization check would be a direct PHI
 * leak. Being "behind Supabase" is not authorization.
 *
 * Prerequisite: npm run seed
 * Run:          npm run test:functions
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const PASSWORD = "SeedPassw0rd!dev";
const FN_BASE = `${URL}/functions/v1`;

const DIDS = {
  alice: "did:hosp:0xSEEDA01",
  bob: "did:hosp:0xSEEDB02",
  drsmith: "did:hosp:0xSEEDD01",
};

/** Sign in and return the access token for Authorization headers. */
async function tokenFor(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return data.session.access_token;
}

/** Invoke a deployed Edge Function. */
async function callFn(name, token, body) {
  const res = await fetch(`${FN_BASE}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, body: json };
}

let aliceTok, drsmithTok, adminTok;

before(async () => {
  assert.ok(URL && ANON, "SUPABASE_URL and SUPABASE_ANON_KEY must be set");
  aliceTok = await tokenFor("alice.patient@seed.test");
  drsmithTok = await tokenFor("dr.smith@seed.test");
  adminTok = await tokenFor("admin@seed.test");
});

// ─── Authentication is enforced ─────────────────────────────────────────────

describe("Edge Functions require authentication", () => {
  it("sign-credential rejects an unauthenticated call", async () => {
    const { status } = await callFn("sign-credential", null, { subjectDid: DIDS.alice });
    assert.ok(status === 401, `expected 401, got ${status}`);
  });

  it("break-glass rejects an unauthenticated call", async () => {
    const { status } = await callFn("break-glass", null, { patientDid: DIDS.alice });
    assert.ok(status === 401, `expected 401, got ${status}`);
  });

  it("rejects a forged bearer token", async () => {
    const { status } = await callFn("sign-credential", "not-a-real-jwt", {
      subjectDid: DIDS.alice,
    });
    assert.equal(status, 401);
  });
});

// ─── Role enforcement ───────────────────────────────────────────────────────

describe("sign-credential authorization", () => {
  it("a PATIENT cannot issue credentials", async () => {
    const { status, body } = await callFn("sign-credential", aliceTok, {
      subjectDid: DIDS.alice,
      credentialType: "SelfIssuedVC",
      claims: { forged: true },
    });
    assert.equal(status, 403, `expected 403, got ${status}: ${JSON.stringify(body)}`);
  });

  it("a DOCTOR can issue a credential", async () => {
    const { status, body } = await callFn("sign-credential", drsmithTok, {
      subjectDid: DIDS.alice,
      credentialType: "TreatmentVC",
      claims: { treatment: "annual review" },
    });
    assert.equal(status, 200, `got ${status}: ${JSON.stringify(body)}`);
    assert.ok(body.credential?.signature, "expected a signature");
    assert.equal(body.credential.proofType, "Ed25519Signature2020");
  });

  it("the issuer key is STABLE across calls (regression test)", async () => {
    // The legacy backend/lib/vc-sign.js generated a fresh Ed25519 keypair on
    // every process start, silently invalidating all previously signed
    // credentials. The fingerprint must not change between invocations.
    const a = await callFn("sign-credential", drsmithTok, {
      subjectDid: DIDS.alice,
      credentialType: "StabilityCheckA",
      claims: {},
    });
    const b = await callFn("sign-credential", drsmithTok, {
      subjectDid: DIDS.alice,
      credentialType: "StabilityCheckB",
      claims: {},
    });

    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(
      a.body.credential.keyFingerprint,
      b.body.credential.keyFingerprint,
      "issuer key changed between calls — signatures would become unverifiable",
    );
  });

  it("refuses an unknown subject DID", async () => {
    const { status } = await callFn("sign-credential", drsmithTok, {
      subjectDid: "did:hosp:0xDOESNOTEXIST",
      credentialType: "GhostVC",
      claims: {},
    });
    assert.equal(status, 404);
  });
});

// ─── Break-glass ────────────────────────────────────────────────────────────

describe("break-glass access", () => {
  it("a PATIENT cannot use break-glass", async () => {
    const { status } = await callFn("break-glass", aliceTok, {
      patientDid: DIDS.bob,
      reason: "I would like to read another patient's chart please",
    });
    assert.equal(status, 403);
  });

  it("a DOCTOR cannot use break-glass", async () => {
    const { status } = await callFn("break-glass", drsmithTok, {
      patientDid: DIDS.bob,
      reason: "Curiosity about this particular patient record",
    });
    assert.equal(status, 403);
  });

  it("an ADMIN must supply a substantive reason", async () => {
    const { status } = await callFn("break-glass", adminTok, {
      patientDid: DIDS.alice,
      reason: "test",
    });
    assert.equal(status, 400, "a trivial reason must be rejected");
  });

  it("an ADMIN with a reason gets records AND is audited", async () => {
    const { status, body } = await callFn("break-glass", adminTok, {
      patientDid: DIDS.alice,
      reason: "Emergency department request, patient unconscious, ref INC-4471",
    });

    assert.equal(status, 200, `got ${status}: ${JSON.stringify(body)}`);
    assert.ok(Array.isArray(body.medicalRecords), "expected medicalRecords array");
    assert.ok(body.warning?.includes("audit"), "response should state that access was recorded");

    // The audit row is the point of the whole mechanism.
    const admin = createClient(URL, ANON, { auth: { persistSession: false } });
    await admin.auth.signInWithPassword({
      email: "admin@seed.test",
      password: PASSWORD,
    });
    const { data: events } = await admin
      .from("audit_events")
      .select("action, severity, resource")
      .eq("action", "BREAK_GLASS_ACCESS")
      .order("logged_at", { ascending: false })
      .limit(1);

    assert.ok(events?.length === 1, "expected a BREAK_GLASS_ACCESS audit event");
    assert.equal(events[0].severity, "critical");
    assert.equal(events[0].resource, DIDS.alice);
  });
});

// ─── Merkle root publication ────────────────────────────────────────────────

describe("publish-merkle-root", () => {
  const today = new Date().toISOString().slice(0, 10);

  // (subject_did, period_date) is UNIQUE. Rather than hunting for a date that
  // has never been used — which fails as soon as the suite runs twice — use a
  // fixed test date and delete the row afterwards so the suite is idempotent.
  const uniqueDate = "2019-03-14";

  before(async () => {
    // Clear any row left by a previous run before asserting on a fresh publish.
    const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    await admin.from("merkle_roots").delete().eq("period_date", uniqueDate);
  });

  after(async () => {
    const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    await admin.from("merkle_roots").delete().eq("period_date", uniqueDate);
  });

  it("a PATIENT cannot publish a root", async () => {
    const { status } = await callFn("publish-merkle-root", aliceTok, {
      subjectDid: DIDS.alice,
      periodDate: today,
      events: [{ id: "E1", doctorDid: DIDS.alice, action: "check-in", timestamp: "t" }],
    });
    assert.equal(status, 403);
  });

  it("a clinician cannot publish for a DID they do not own", async () => {
    const { status } = await callFn("publish-merkle-root", drsmithTok, {
      subjectDid: DIDS.bob,
      periodDate: today,
      events: [{ id: "E1", doctorDid: DIDS.bob, action: "check-in", timestamp: "t" }],
    });
    assert.equal(status, 403);
  });

  it("rejects an empty event set", async () => {
    const { status } = await callFn("publish-merkle-root", drsmithTok, {
      subjectDid: DIDS.drsmith,
      periodDate: today,
      events: [],
    });
    assert.equal(status, 400);
  });

  it("a clinician CAN publish a root for their own DID", async () => {
    // Use a distinct date so the unique (subject_did, period_date) constraint
    // does not collide with the seeded root.
    const { status, body } = await callFn("publish-merkle-root", drsmithTok, {
      subjectDid: DIDS.drsmith,
      periodDate: uniqueDate,
      events: [
        {
          id: "EV1",
          doctorDid: DIDS.drsmith,
          roomId: "R1",
          action: "check-in",
          timestamp: `${uniqueDate}T09:00:00Z`,
        },
        {
          id: "EV2",
          doctorDid: DIDS.drsmith,
          roomId: "R1",
          action: "check-out",
          timestamp: `${uniqueDate}T17:00:00Z`,
        },
      ],
    });

    assert.equal(status, 200, `got ${status}: ${JSON.stringify(body)}`);
    assert.match(body.rootHash, /^[0-9a-f]{64}$/, "root should be a SHA-256 hex digest");
    assert.equal(body.eventCount, 2);
  });

  it("refuses a duplicate root for the same subject and day", async () => {
    const { status } = await callFn("publish-merkle-root", drsmithTok, {
      subjectDid: DIDS.drsmith,
      periodDate: uniqueDate,
      events: [{ id: "EV1", doctorDid: DIDS.drsmith, action: "check-in", timestamp: "t" }],
    });
    assert.equal(status, 409, "a second root for the same day must be refused");
  });
});
