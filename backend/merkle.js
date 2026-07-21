/**
 * Cryptographic Merkle Tree Utility (Backend)
 *
 * Implements leaf hashing, Merkle Root computation, Merkle Proof generation,
 * and verification.
 */

import { createHash } from "crypto";

export async function sha256(message) {
  return createHash("sha256").update(message).digest("hex");
}

export class MerkleTree {
  constructor(leaves) {
    this.leaves = [...leaves].sort();
    this.tree = [];
  }

  async build() {
    if (this.leaves.length === 0) {
      this.tree = [[await sha256("empty-tree")]];
      return;
    }

    let currentLevel = await Promise.all(this.leaves.map((l) => sha256(l)));
    this.tree.push(currentLevel);

    while (currentLevel.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] || left;
        const combined = left < right ? await sha256(left + right) : await sha256(right + left);
        nextLevel.push(combined);
      }
      currentLevel = nextLevel;
      this.tree.push(currentLevel);
    }
  }

  getRoot() {
    if (this.tree.length === 0 || this.tree[this.tree.length - 1].length === 0) {
      return "0000000000000000000000000000000000000000000000000000000000000000";
    }
    return this.tree[this.tree.length - 1][0];
  }

  async getProof(leaf) {
    const proof = [];
    const hashedLeaf = await sha256(leaf);
    let index = this.tree[0].indexOf(hashedLeaf);
    if (index === -1) return [];

    for (let level = 0; level < this.tree.length - 1; level++) {
      const isRightNode = index % 2 === 1;
      const siblingIndex = isRightNode ? index - 1 : index + 1;
      if (siblingIndex < this.tree[level].length) {
        proof.push(this.tree[level][siblingIndex]);
      } else {
        proof.push(this.tree[level][index]);
      }
      index = Math.floor(index / 2);
    }
    return proof;
  }
}

export async function verifyProof(leaf, proof, root) {
  let currentHash = await sha256(leaf);
  for (const sibling of proof) {
    currentHash =
      currentHash < sibling
        ? await sha256(currentHash + sibling)
        : await sha256(sibling + currentHash);
  }
  return currentHash === root;
}
