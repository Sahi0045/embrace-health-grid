import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  putState,
  getState,
  getAllState,
  queryState,
  deleteState,
  getWorldStateSize,
  getAllWorldState,
  beginTransaction,
  stagePutState,
  commitTransaction,
  rollbackTransaction,
} from "../world-state-db.js";

describe("SQLite World State DB Unit Tests", () => {
  it("putState & getState works for non-PHI namespace", () => {
    const key = `test_key_${Date.now()}`;
    const value = { name: "Test Item", role: "staff" };
    putState("tracker", key, value, "tx_123");

    const retrieved = getState("tracker", key);
    assert.ok(retrieved);
    assert.equal(retrieved.value.name, "Test Item");
    assert.equal(retrieved.value.role, "staff");
  });

  it("putState & getState works for PHI namespace with transparent encryption/decryption", () => {
    const key = `patient_phi_${Date.now()}`;
    const value = { name: "John Doe", condition: "Stable" };
    putState("medical-records", key, value, "tx_456");

    const retrieved = getState("medical-records", key);
    assert.ok(retrieved);
    assert.equal(retrieved.value.name, "John Doe");
    assert.equal(retrieved.value.condition, "Stable");
  });

  it("getAllState retrieves records without deleted items", () => {
    const key = `active_${Date.now()}`;
    putState("prescriptions", key, { drug: "Aspirin" }, "tx_789");

    const all = getAllState("prescriptions");
    assert.ok(Array.isArray(all));
    const found = all.find((e) => e.key === key);
    assert.ok(found);
    assert.equal(found.value.drug, "Aspirin");
  });

  it("deleteState marks record deleted", () => {
    const key = `to_delete_${Date.now()}`;
    putState("vitals-history", key, { temp: 37.0 }, "tx_001");
    assert.ok(getState("vitals-history", key));

    const res = deleteState("vitals-history", key);
    assert.equal(res, true);

    const after = getAllState("vitals-history");
    const found = after.find((e) => e.key === key);
    assert.equal(found, undefined);
  });

  it("queryState filters records correctly", () => {
    const key = `q_${Date.now()}`;
    putState("appointments", key, { patientName: "Alice", status: "confirmed" }, "tx_q");

    const matches = queryState("appointments", (v) => v.patientName === "Alice");
    assert.ok(matches.length > 0);
    assert.equal(matches[0].value.patientName, "Alice");
  });

  it("ACID transaction commit works", () => {
    const tx = beginTransaction();
    const key = `tx_key_${Date.now()}`;
    stagePutState(tx, "users", key, { email: "tx@test.com" });

    commitTransaction(tx);

    const retrieved = getState("users", key);
    assert.ok(retrieved);
    assert.equal(retrieved.value.email, "tx@test.com");
  });

  it("ACID transaction rollback discards staged writes", () => {
    const tx = beginTransaction();
    const key = `rb_key_${Date.now()}`;
    stagePutState(tx, "users", key, { email: "rb@test.com" });

    rollbackTransaction(tx);

    const retrieved = getState("users", key);
    assert.equal(retrieved, null);
  });

  it("getWorldStateSize returns positive integer", () => {
    const size = getWorldStateSize();
    assert.ok(typeof size === "number" && size > 0);
  });
});
