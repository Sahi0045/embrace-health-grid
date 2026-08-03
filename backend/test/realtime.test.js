/**
 * Realtime RLS tests — Embrace Health Grid
 *
 * The security question for Realtime is not "do events arrive" but "do events
 * arrive ONLY to subscribers whose RLS policies permit the row".
 *
 * Subscriptions run from the browser, so if Realtime ignored RLS, any
 * authenticated user could stream every patient's vitals and records straight
 * off the socket. These tests prove it does not.
 *
 * The legacy Express WebSocket broadcast every event to every connected client
 * and relied on client-side filtering — anyone with devtools could read other
 * patients' data off the wire. This is the fix for that.
 *
 * Prerequisite: npm run seed
 * Run:          npm run test:realtime
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "SeedPassw0rd!dev";

const DIDS = {
  alice: "did:hosp:0xSEEDA01",
  bob: "did:hosp:0xSEEDB02",
};

/** Sign in and return a client whose Realtime socket carries that session. */
async function clientFor(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  // Realtime authorises the socket separately from the REST client.
  await c.realtime.setAuth(data.session.access_token);
  return c;
}

/**
 * Subscribe, run an action, and collect events that arrive within a window.
 * Realtime is asynchronous with no completion signal, so a bounded wait is the
 * only way to assert that something did NOT arrive.
 */
async function collectEvents(client, table, action, windowMs = 6000) {
  const received = [];

  const channel = client
    .channel(`test:${table}:${crypto.randomUUID().slice(0, 6)}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
      received.push(payload.new ?? payload.old ?? {});
    });

  // Wait for SUBSCRIBED before acting, or the change can precede the listener.
  // Retry the join: Realtime occasionally drops a rapid re-subscribe on the
  // same client, which is a handshake race rather than a policy failure.
  let subscribed = false;
  for (let attempt = 1; attempt <= 3 && !subscribed; attempt++) {
    subscribed = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 12000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          resolve(false);
        }
      });
    });
    if (!subscribed) await new Promise((r) => setTimeout(r, 1500));
  }
  if (!subscribed) throw new Error("could not join the Realtime channel after 3 attempts");

  await action();
  await new Promise((r) => setTimeout(r, windowMs));
  await client.removeChannel(channel);
  await new Promise((r) => setTimeout(r, 1200));

  return received;
}

let alice;
let bob;
let admin;

before(async () => {
  assert.ok(URL && ANON && SERVICE, "SUPABASE_URL, ANON and SERVICE_ROLE keys must be set");
  alice = await clientFor("alice.patient@seed.test");
  bob = await clientFor("bob.patient@seed.test");
  admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
});

after(async () => {
  await admin.from("vitals").delete().in("patient_did", [DIDS.alice, DIDS.bob]);
  for (const c of [alice, bob]) await c?.auth.signOut().catch(() => {});
});

describe("Realtime respects RLS on vitals", () => {
  it("Alice RECEIVES her own vitals", async () => {
    // Delivery is the positive case and is inherently timing-dependent, so
    // retry before failing. The NEGATIVE tests below are the security
    // guarantees and must never be retried into passing.
    let delivered = false;

    for (let attempt = 1; attempt <= 3 && !delivered; attempt++) {
      const events = await collectEvents(
        alice,
        "vitals",
        async () => {
          const { error } = await admin.from("vitals").insert({
            patient_did: DIDS.alice,
            heart_rate: 70 + attempt,
            bp_systolic: 118,
            bp_diastolic: 76,
            spo2: 98,
            temperature: 36.8,
            resp_rate: 16,
          });
          if (error) throw new Error(`insert failed: ${error.message}`);
        },
        8000,
      );
      delivered = events.some((e) => e.patient_did === DIDS.alice);
    }

    assert.ok(delivered, "Alice did not receive her own vitals after 3 attempts");
  });

  it("Alice does NOT receive Bob's vitals", async () => {
    // The core guarantee. If this fails, every patient can stream every other
    // patient's vitals from the browser.
    const events = await collectEvents(alice, "vitals", async () => {
      const { error } = await admin.from("vitals").insert({
        patient_did: DIDS.bob,
        heart_rate: 88,
        bp_systolic: 130,
        bp_diastolic: 85,
        spo2: 95,
        temperature: 37.4,
        resp_rate: 18,
      });
      if (error) throw new Error(`insert failed: ${error.message}`);
    });

    const leaked = events.filter((e) => e.patient_did === DIDS.bob);
    assert.equal(leaked.length, 0, "LEAK: Alice received Bob's vitals over Realtime");
  });

  it("Bob does NOT receive Alice's vitals", async () => {
    const events = await collectEvents(bob, "vitals", async () => {
      const { error } = await admin.from("vitals").insert({
        patient_did: DIDS.alice,
        heart_rate: 70,
        spo2: 99,
        temperature: 36.6,
        resp_rate: 15,
      });
      if (error) throw new Error(`insert failed: ${error.message}`);
    });

    const leaked = events.filter((e) => e.patient_did === DIDS.alice);
    assert.equal(leaked.length, 0, "LEAK: Bob received Alice's vitals over Realtime");
  });
});

describe("Realtime respects RLS on medical records", () => {
  it("Alice does NOT receive Bob's new records", async () => {
    const recordId = `RT-TEST-${crypto.randomUUID().slice(0, 6)}`;

    const events = await collectEvents(alice, "medical_records", async () => {
      const { error } = await admin.from("medical_records").insert({
        record_id: recordId,
        patient_did: DIDS.bob,
        title: "Realtime isolation probe",
        record_type: "note",
        content: "Should never reach Alice.",
      });
      if (error) throw new Error(`insert failed: ${error.message}`);
    });

    await admin.from("medical_records").delete().eq("record_id", recordId);

    const leaked = events.filter((e) => e.patient_did === DIDS.bob);
    assert.equal(leaked.length, 0, "LEAK: Alice received Bob's medical record over Realtime");
  });
});

describe("Vitals write protection", () => {
  it("a patient CANNOT insert their own vitals", async () => {
    // Vitals come from devices and clinical systems via service_role. A patient
    // fabricating readings would corrupt the clinical record.
    const { error } = await alice.from("vitals").insert({
      patient_did: DIDS.alice,
      heart_rate: 60,
    });

    assert.ok(error, "expected the insert to be rejected");
    assert.match(error.message, /row-level security/i);
  });

  it("rejects physiologically impossible values", async () => {
    const { error } = await admin.from("vitals").insert({
      patient_did: DIDS.alice,
      heart_rate: 9999,
    });

    assert.ok(error, "expected the CHECK constraint to reject this");
    assert.match(error.message, /violates check constraint/i);
  });
});
