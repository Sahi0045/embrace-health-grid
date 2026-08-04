/**
 * Onboarding tests.
 *
 * Onboarding is the one operation that creates an account AND issues identity, so
 * it is the highest-privilege write in the system. These assert both that it
 * works and that it cannot be abused.
 *
 * Prerequisite: npm run seed
 * Run:          npm run test:onboard
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "SeedPassw0rd!dev";
const NEW_PASSWORD = "OnboardTest123!";

/** Unique suffix so repeated runs never collide on email. */
const STAMP = Date.now();
const created = [];

async function tokenFor(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return data.session.access_token;
}

async function onboard(token, body) {
  const res = await fetch(`${URL}/functions/v1/onboard-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  if (json?.email) created.push(json.email);
  return { status: res.status, body: json };
}

let adminTok, doctorTok, patientTok, admin;

before(async () => {
  assert.ok(URL && ANON && SERVICE, "Supabase env vars must be set");
  adminTok = await tokenFor("admin@seed.test");
  doctorTok = await tokenFor("dr.smith@seed.test");
  patientTok = await tokenFor("alice.patient@seed.test");
  admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
});

after(async () => {
  // Remove accounts this suite created so it stays idempotent.
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const u of data?.users ?? []) {
    if (created.includes(u.email)) {
      await admin.auth.admin.deleteUser(u.id).catch(() => {});
    }
  }
  await admin.from("dids").delete().like("owner_name", "Onboard Test%");
});

describe("Onboarding requires authorisation", () => {
  it("rejects an unauthenticated request", async () => {
    const { status } = await onboard(null, {
      email: `anon${STAMP}@seed.test`,
      password: NEW_PASSWORD,
      fullName: "Onboard Test Anon",
      role: "patient",
    });
    assert.equal(status, 401);
  });

  it("a PATIENT cannot onboard anyone", async () => {
    const { status } = await onboard(patientTok, {
      email: `bypatient${STAMP}@seed.test`,
      password: NEW_PASSWORD,
      fullName: "Onboard Test ByPatient",
      role: "patient",
    });
    assert.equal(status, 403);
  });

  it("a DOCTOR cannot create another doctor", async () => {
    // Otherwise any clinician could mint colleagues — privilege escalation.
    const { status } = await onboard(doctorTok, {
      email: `bydoc${STAMP}@seed.test`,
      password: NEW_PASSWORD,
      fullName: "Onboard Test ByDoctor",
      role: "doctor",
    });
    assert.equal(status, 403);
  });

  it("a DOCTOR cannot create an admin", async () => {
    const { status } = await onboard(doctorTok, {
      email: `byadmin${STAMP}@seed.test`,
      password: NEW_PASSWORD,
      fullName: "Onboard Test ByAdmin",
      role: "admin",
    });
    assert.equal(status, 403);
  });

  it("a DOCTOR CAN onboard a patient", async () => {
    const { status, body } = await onboard(doctorTok, {
      email: `docpatient${STAMP}@seed.test`,
      password: NEW_PASSWORD,
      fullName: "Onboard Test DocPatient",
      role: "patient",
      mrn: "MRN-TEST-1",
    });
    assert.equal(status, 200, JSON.stringify(body));
    assert.match(body.did, /^did:hosp:0x/);
  });
});

describe("Onboarding validates input", () => {
  it("rejects a short password", async () => {
    const { status } = await onboard(adminTok, {
      email: `short${STAMP}@seed.test`,
      password: "abc",
      fullName: "Onboard Test Short",
      role: "patient",
    });
    assert.equal(status, 400);
  });

  it("rejects an unknown role", async () => {
    const { status } = await onboard(adminTok, {
      email: `role${STAMP}@seed.test`,
      password: NEW_PASSWORD,
      fullName: "Onboard Test Role",
      role: "superuser",
    });
    assert.equal(status, 400);
  });

  it("rejects a duplicate email with 409", async () => {
    const { status } = await onboard(adminTok, {
      email: "admin@seed.test",
      password: NEW_PASSWORD,
      fullName: "Onboard Test Dup",
      role: "patient",
    });
    assert.equal(status, 409);
  });
});

describe("Onboarding produces a usable identity", () => {
  it("creates account, DID, credential and NFC card together", async () => {
    const email = `full${STAMP}@seed.test`;
    const { status, body } = await onboard(adminTok, {
      email,
      password: NEW_PASSWORD,
      fullName: "Onboard Test Full",
      role: "doctor",
      specialty: "Cardiology",
      issueNfcCard: true,
    });

    assert.equal(status, 200, JSON.stringify(body));
    assert.ok(body.userId, "expected a userId");
    assert.match(body.did, /^did:hosp:0x/);
    assert.match(body.credentialId, /^vc_/);
    assert.ok(body.cardId, "expected an NFC card id");
    assert.ok(body.signature?.length > 40, "expected an Ed25519 signature");

    // The whole point: the new account must actually be able to sign in.
    const c = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data, error } = await c.auth.signInWithPassword({ email, password: NEW_PASSWORD });
    assert.equal(error, null, `new account could not sign in: ${error?.message}`);
    assert.ok(data.session, "expected a session");

    // And its profile must carry the role and DID that RLS depends on.
    const { data: profile } = await c
      .from("profiles")
      .select("role, primary_did")
      .eq("id", data.user.id)
      .single();

    assert.equal(profile?.role, "doctor");
    assert.equal(profile?.primary_did, body.did);
  });

  it("rolls back completely when a step fails", async () => {
    // A duplicate email fails at the first step, so nothing should be left.
    const before = await admin.from("dids").select("did", { count: "exact", head: true });

    await onboard(adminTok, {
      email: "admin@seed.test",
      password: NEW_PASSWORD,
      fullName: "Onboard Test Rollback",
      role: "patient",
    });

    const after = await admin.from("dids").select("did", { count: "exact", head: true });
    assert.equal(after.count, before.count, "a failed onboarding left a DID behind");

    const { data: orphan } = await admin
      .from("dids")
      .select("did")
      .eq("owner_name", "Onboard Test Rollback");
    assert.equal(orphan?.length ?? 0, 0, "a failed onboarding left an orphaned DID");
  });
});
