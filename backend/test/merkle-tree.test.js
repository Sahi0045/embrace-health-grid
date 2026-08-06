/**
 * Merkle Tree Unit Tests
 * Uses Node.js built-in test runner (node:test) — no extra dependencies.
 * Run: node --test test/merkle-tree.test.js
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  hashLeaf,
  combineHashes,
  buildMerkleTree,
  getMerkleRoot,
  verifyLeaf,
  getLeaves,
  generateProof,
  verifyProof,
} from "../lib/merkle-tree.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeLeaf = (n) => ({
  doctorDid: `did:hosp:0xdoc${n}`,
  roomId: `room-${n}`,
  roomName: `Room ${n}`,
  action: n % 2 === 0 ? "checkout" : "checkin",
  timestamp: new Date(2026, 0, 1, n).toISOString(),
});

const leaf1 = makeLeaf(1);
const leaf2 = makeLeaf(2);
const leaf3 = makeLeaf(3);
const leaf4 = makeLeaf(4);

// ─── hashLeaf ─────────────────────────────────────────────────────────────────

describe("hashLeaf", () => {
  it("returns a 64-char hex string", () => {
    const hash = hashLeaf(leaf1);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    assert.equal(hashLeaf(leaf1), hashLeaf(leaf1));
  });

  it("produces different hashes for different leaves", () => {
    assert.notEqual(hashLeaf(leaf1), hashLeaf(leaf2));
  });

  it("ignores extra fields not in the canonical set", () => {
    const withExtra = { ...leaf1, extraField: "ignored" };
    assert.equal(hashLeaf(leaf1), hashLeaf(withExtra));
  });
});

// ─── combineHashes ────────────────────────────────────────────────────────────

describe("combineHashes", () => {
  it("returns a 64-char hex string", () => {
    const h = combineHashes(hashLeaf(leaf1), hashLeaf(leaf2));
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  it("is not commutative (order matters)", () => {
    const h1 = combineHashes(hashLeaf(leaf1), hashLeaf(leaf2));
    const h2 = combineHashes(hashLeaf(leaf2), hashLeaf(leaf1));
    assert.notEqual(h1, h2);
  });
});

// ─── buildMerkleTree ──────────────────────────────────────────────────────────

describe("buildMerkleTree", () => {
  it("returns null for empty array", () => {
    assert.equal(buildMerkleTree([]), null);
  });

  it("returns null for null input", () => {
    assert.equal(buildMerkleTree(null), null);
  });

  it("builds a tree from a single leaf", () => {
    const tree = buildMerkleTree([leaf1]);
    assert.ok(tree);
    assert.equal(tree.hash, hashLeaf(leaf1));
  });

  it("builds a tree from two leaves", () => {
    const tree = buildMerkleTree([leaf1, leaf2]);
    assert.ok(tree);
    assert.ok(tree.left);
    assert.ok(tree.right);
    const expected = combineHashes(hashLeaf(leaf1), hashLeaf(leaf2));
    assert.equal(tree.hash, expected);
  });

  it("builds a tree from four leaves (two levels)", () => {
    const tree = buildMerkleTree([leaf1, leaf2, leaf3, leaf4]);
    assert.ok(tree);
    assert.match(tree.hash, /^[0-9a-f]{64}$/);
  });

  it("handles odd number of leaves by duplicating the last", () => {
    const tree3 = buildMerkleTree([leaf1, leaf2, leaf3]);
    const tree4 = buildMerkleTree([leaf1, leaf2, leaf3, leaf3]);
    assert.ok(tree3);
    assert.ok(tree4);
    // Roots should match because the odd leaf is duplicated
    assert.equal(tree3.hash, tree4.hash);
  });
});

// ─── getMerkleRoot ────────────────────────────────────────────────────────────

describe("getMerkleRoot", () => {
  it("returns null for null tree", () => {
    assert.equal(getMerkleRoot(null), null);
  });

  it("returns the root hash string", () => {
    const tree = buildMerkleTree([leaf1, leaf2]);
    const root = getMerkleRoot(tree);
    assert.match(root, /^[0-9a-f]{64}$/);
  });

  it("is stable — same leaves always produce same root", () => {
    const root1 = getMerkleRoot(buildMerkleTree([leaf1, leaf2, leaf3, leaf4]));
    const root2 = getMerkleRoot(buildMerkleTree([leaf1, leaf2, leaf3, leaf4]));
    assert.equal(root1, root2);
  });

  it("changes when any leaf changes", () => {
    const root1 = getMerkleRoot(buildMerkleTree([leaf1, leaf2]));
    const mutated = { ...leaf1, roomId: "room-DIFFERENT" };
    const root2 = getMerkleRoot(buildMerkleTree([mutated, leaf2]));
    assert.notEqual(root1, root2);
  });
});

// ─── verifyLeaf ───────────────────────────────────────────────────────────────

describe("verifyLeaf", () => {
  it("returns false for null tree", () => {
    assert.equal(verifyLeaf(leaf1, null, null), false);
  });

  it("returns true for a leaf that is in the tree", () => {
    const tree = buildMerkleTree([leaf1, leaf2, leaf3]);
    const root = getMerkleRoot(tree);
    assert.equal(verifyLeaf(leaf1, root, tree), true);
    assert.equal(verifyLeaf(leaf2, root, tree), true);
    assert.equal(verifyLeaf(leaf3, root, tree), true);
  });

  it("returns false for a leaf not in the tree", () => {
    const tree = buildMerkleTree([leaf1, leaf2]);
    const root = getMerkleRoot(tree);
    assert.equal(verifyLeaf(leaf4, root, tree), false);
  });
});

// ─── getLeaves ────────────────────────────────────────────────────────────────

describe("getLeaves", () => {
  it("returns empty array for null tree", () => {
    const result = getLeaves(null);
    assert.deepEqual(result, []);
  });

  it("retrieves all leaves from a 4-leaf tree", () => {
    const tree = buildMerkleTree([leaf1, leaf2, leaf3, leaf4]);
    const leaves = getLeaves(tree);
    // All four original leaves should be present
    assert.equal(leaves.length, 4);
    const roomIds = leaves.map((l) => l.roomId);
    assert.ok(roomIds.includes("room-1"));
    assert.ok(roomIds.includes("room-2"));
    assert.ok(roomIds.includes("room-3"));
    assert.ok(roomIds.includes("room-4"));
  });
});

// ─── generateProof + verifyProof ─────────────────────────────────────────────

describe("generateProof / verifyProof", () => {
  it("generateProof returns null for null tree", () => {
    assert.equal(generateProof(leaf1, null), null);
  });

  it("generates a valid proof for leaf1 in a 4-leaf tree", () => {
    const tree = buildMerkleTree([leaf1, leaf2, leaf3, leaf4]);
    const root = getMerkleRoot(tree);
    const proof = generateProof(leaf1, tree);
    assert.ok(proof, "proof should not be null");
    assert.ok(Array.isArray(proof.proof));
    assert.equal(verifyProof(proof, root), true);
  });

  it("generates a valid proof for leaf4 in a 4-leaf tree", () => {
    const tree = buildMerkleTree([leaf1, leaf2, leaf3, leaf4]);
    const root = getMerkleRoot(tree);
    const proof = generateProof(leaf4, tree);
    assert.ok(proof);
    assert.equal(verifyProof(proof, root), true);
  });

  it("proof verification fails against a different root", () => {
    const tree = buildMerkleTree([leaf1, leaf2, leaf3, leaf4]);
    const proof = generateProof(leaf1, tree);
    const wrongRoot = "a".repeat(64);
    assert.equal(verifyProof(proof, wrongRoot), false);
  });

  it("proof is invalid when leaf data is tampered", () => {
    const tree = buildMerkleTree([leaf1, leaf2, leaf3, leaf4]);
    const root = getMerkleRoot(tree);
    const proof = generateProof(leaf1, tree);
    // Tamper: swap the leaf inside the proof
    const tamperedProof = { ...proof, leaf: leaf4 };
    assert.equal(verifyProof(tamperedProof, root), false);
  });
});

// ─── End-to-end: full daily event batch ──────────────────────────────────────

describe("End-to-end: daily event batch", () => {
  it("produces a stable root for a batch of 10 events and verifies every leaf", () => {
    const batch = Array.from({ length: 10 }, (_, i) => makeLeaf(i + 1));
    const tree = buildMerkleTree(batch);
    const root = getMerkleRoot(tree);

    assert.match(root, /^[0-9a-f]{64}$/);

    // Every leaf in the batch must verify successfully
    for (const leaf of batch) {
      assert.equal(verifyLeaf(leaf, root, tree), true, `leaf ${leaf.roomId} should verify`);
    }
  });

  it("adding one more event changes the root", () => {
    const batch = Array.from({ length: 10 }, (_, i) => makeLeaf(i + 1));
    const root1 = getMerkleRoot(buildMerkleTree(batch));
    const root2 = getMerkleRoot(buildMerkleTree([...batch, makeLeaf(11)]));
    assert.notEqual(root1, root2);
  });
});
