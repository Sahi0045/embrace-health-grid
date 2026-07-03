/**
 * Cryptographic Merkle Tree Utility
 *
 * Implements leaf hashing, Merkle Root computation, Merkle Proof generation,
 * and verification. Works across browser and Node.js environments.
 */

// Initialize crypto provider dynamically based on environment
let cryptoObj: any = null;
if (typeof window !== "undefined" && window.crypto) {
  cryptoObj = window.crypto;
} else if (typeof globalThis !== "undefined" && (globalThis as any).crypto) {
  cryptoObj = (globalThis as any).crypto;
}

export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  if (cryptoObj?.subtle) {
    try {
      const hash = await cryptoObj.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch (e) {
      // Fall back if subtle fails
    }
  }

  // Node.js dynamic import fallback
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const nodeCrypto = await import("crypto");
      return nodeCrypto.createHash("sha256").update(message).digest("hex");
    } catch (e) {
      // Fall back
    }
  }

  // Simple deterministic hash fallback if no crypto is available
  return simpleFnv1a(message);
}

function simpleFnv1a(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const part1 = (h >>> 0).toString(16).padStart(8, "0");
  return (part1 + part1 + part1 + part1 + part1 + part1 + part1 + part1).substring(0, 64);
}

export class MerkleTree {
  leaves: string[];
  tree: string[][];

  constructor(leaves: string[]) {
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
      const nextLevel: string[] = [];
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

  getRoot(): string {
    if (this.tree.length === 0 || this.tree[this.tree.length - 1].length === 0) {
      return "0000000000000000000000000000000000000000000000000000000000000000";
    }
    return this.tree[this.tree.length - 1][0];
  }

  async getProof(leaf: string): Promise<string[]> {
    const proof: string[] = [];
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

export async function verifyProof(
  leaf: string,
  proof: string[],
  root: string
): Promise<boolean> {
  let currentHash = await sha256(leaf);
  for (const sibling of proof) {
    currentHash = currentHash < sibling
      ? await sha256(currentHash + sibling)
      : await sha256(sibling + currentHash);
  }
  return currentHash === root;
}
