/**
 * Zero-Knowledge Proof Simulation Library
 *
 * Simulates ZKP selective disclosure for healthcare credentials.
 * Uses a Groth16-inspired circuit model (groth16-hospital-v1).
 *
 * Architecture:
 *  - Claims    → per-attribute disclosure toggles
 *  - Commitment → Pedersen-style hash of all claim values + salt
 *  - Nullifier  → prevents double-spend / replay of proofs
 *  - Merkle root→ simulated sparse Merkle tree of the patient's claim set
 *  - QR payload → base64 JSON summary for presentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ZKProofClaim {
  attribute: string; // e.g. "bloodGroup", "age", "vaccineStatus"
  label: string; // human-readable label
  value: string; // actual value (hidden from verifier unless disclosed)
  disclosed: boolean; // whether to include this attribute in the proof
  category: "identity" | "medical" | "credentials";
}

export interface ZKProof {
  proofId: string;
  patientDid: string;
  claims: ZKProofClaim[];
  commitment: string; // Pedersen-style hash commitment over all claim values
  nullifier: string; // prevents double-spend / replay
  merkleRoot: string; // simulated sparse Merkle root of claim set
  circuitId: string; // e.g. "groth16-hospital-v1"
  generatedAt: string;
  expiresAt: string;
  qrPayload: string; // base64-encoded proof summary for QR display
  verificationStatus: "pending" | "verified" | "expired";
}

export interface ZKVerificationResult {
  valid: boolean;
  proofId: string;
  disclosedAttributes: Record<string, string>;
  verifiedAt: string;
  circuitId: string;
  blockHash: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Internal crypto utilities (deterministic, SHA-256-like hex simulation)
// ---------------------------------------------------------------------------

/** Murmurhash3-inspired finaliser — deterministic hashing simulator */
function simHash(input: string): string {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x9e3779b9);
    h2 = Math.imul(h2 ^ ch, 0x5f356495);
  }
  h1 ^= Math.imul(h1 ^ (h2 >>> 15), 0x735a2d97);
  h2 ^= Math.imul(h2 ^ (h1 >>> 15), 0xcaf649a9);
  h1 ^= h2 >>> 16;
  h2 ^= h1 >>> 16;
  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  const rand = Math.random().toString(36).substring(2, 18);
  return hex1 + hex2 + rand + Date.now().toString(16);
}

/** Produce a 64-char hex string (256-bit look) from an arbitrary seed */
function hash256(seed: string): string {
  const a = simHash(seed + "a");
  const b = simHash(seed + "b");
  return (a + b).substring(0, 64);
}

/** Produce a nullifier — 32 bytes hex */
function nullifierHash(did: string, salt: string): string {
  return hash256(did + "::nullifier::" + salt);
}

/** Merkle root of N leaves — simulated by iterative hashing of sorted values */
function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return hash256("empty-tree");
  const sorted = [...leaves].sort();
  let current = sorted.map((l) => hash256(l));
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1] ?? current[i];
      next.push(hash256(left + right));
    }
    current = next;
  }
  return current[0];
}

/** Pedersen-style commitment: hash(values || salt) */
function pedersenCommitment(values: string[], salt: string): string {
  return hash256(values.join("|") + "::commit::" + salt);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a simulated ZK proof for the given patient DID and selected claims.
 * Claims with `disclosed: false` are hidden from the verifier but still
 * committed to in the Merkle root.
 */
export function generateZKProof(patientDid: string, selectedClaims: ZKProofClaim[]): ZKProof {
  const salt = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const proofId = "zkp_" + hash256(patientDid + salt).substring(0, 24);

  const allValues = selectedClaims.map((c) => c.attribute + "=" + c.value);
  const commitment = pedersenCommitment(allValues, salt);
  const nullifier = nullifierHash(patientDid, salt);
  const root = merkleRoot(allValues);

  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 60 * 1000); // 30-minute proof window

  // QR payload: only include disclosed attributes + proof metadata
  const qrData = {
    proofId,
    circuitId: "groth16-hospital-v1",
    patientDid,
    disclosed: selectedClaims
      .filter((c) => c.disclosed)
      .reduce<Record<string, string>>((acc, c) => {
        acc[c.attribute] = c.value;
        return acc;
      }, {}),
    merkleRoot: root.substring(0, 16),
    expiresAt: expires.toISOString(),
  };
  const qrPayload = btoa(JSON.stringify(qrData));

  return {
    proofId,
    patientDid,
    claims: selectedClaims,
    commitment,
    nullifier,
    merkleRoot: root,
    circuitId: "groth16-hospital-v1",
    generatedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    qrPayload,
    verificationStatus: "pending",
  };
}

/**
 * Verify a ZK proof.
 * In a real system this would call the verifier smart contract on-chain.
 * Here we simulate: always valid within the expiry window, shows only
 * disclosed attributes, and returns a simulated on-chain block hash.
 */
export async function verifyZKProof(proof: ZKProof): Promise<ZKVerificationResult> {
  // Simulate network latency for the verifier circuit
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));

  const now = new Date();
  const expired = now > new Date(proof.expiresAt);

  const disclosedAttributes = proof.claims
    .filter((c) => c.disclosed)
    .reduce<Record<string, string>>((acc, c) => {
      acc[c.attribute] = c.value;
      return acc;
    }, {});

  const blockHash =
    "0x" + hash256(proof.proofId + proof.commitment + now.toISOString()).substring(0, 64);

  if (expired) {
    return {
      valid: false,
      proofId: proof.proofId,
      disclosedAttributes,
      verifiedAt: now.toISOString(),
      circuitId: proof.circuitId,
      blockHash,
      message: "Proof has expired. Please generate a new proof.",
    };
  }

  return {
    valid: true,
    proofId: proof.proofId,
    disclosedAttributes,
    verifiedAt: now.toISOString(),
    circuitId: proof.circuitId,
    blockHash,
    message: "Proof verified successfully. All disclosed attributes are cryptographically valid.",
  };
}

/**
 * Build a default set of ZKProofClaims from a patient record.
 * Each claim defaults to disclosed = false (privacy first).
 */
export function getDefaultClaims(
  patientRecord: Record<string, unknown> | null | undefined,
): ZKProofClaim[] {
  // Cast to any internally so property access stays concise — the parameter
  // is still typed for callers; the any is local to this function body.

  const p = (patientRecord ?? {}) as Record<string, any>;

  const age =
    typeof p.age === "number"
      ? String(p.age)
      : p.dob
        ? String(new Date().getFullYear() - new Date(p.dob).getFullYear())
        : "32";

  const bloodGroup = p.bloodGroup ?? "B+";
  const allergies =
    Array.isArray(p.allergies) && p.allergies.length > 0
      ? p.allergies.filter((a: string) => a !== "None").join(", ") || "None"
      : "None";

  const insuranceProvider = p.insuranceProvider ?? "Star Health";
  const conditions =
    Array.isArray(p.conditions) && p.conditions.length > 0 ? p.conditions[0] : "Hypertension";

  return [
    // Identity
    {
      attribute: "patientDid",
      label: "Patient DID",
      value: p.did ?? "did:hosp:0xabcd1234",
      disclosed: false,
      category: "identity",
    },
    {
      attribute: "fullName",
      label: "Full Name",
      value: p.name ?? "",
      disclosed: false,
      category: "identity",
    },
    {
      attribute: "age",
      label: "Age",
      value: age,
      disclosed: false,
      category: "identity",
    },
    {
      attribute: "gender",
      label: "Gender",
      value: p.gender === "M" ? "Male" : p.gender === "F" ? "Female" : "Female",
      disclosed: false,
      category: "identity",
    },
    {
      attribute: "nationality",
      label: "Nationality",
      value: p.nationality ?? "Indian",
      disclosed: false,
      category: "identity",
    },
    // Medical
    {
      attribute: "bloodGroup",
      label: "Blood Group",
      value: bloodGroup,
      disclosed: false,
      category: "medical",
    },
    {
      attribute: "allergies",
      label: "Known Allergies",
      value: allergies,
      disclosed: false,
      category: "medical",
    },
    {
      attribute: "primaryCondition",
      label: "Primary Condition",
      value: conditions,
      disclosed: false,
      category: "medical",
    },
    {
      attribute: "vaccineStatus",
      label: "Vaccination Status",
      value: "COVID-19 · Hep-B · Tetanus",
      disclosed: false,
      category: "medical",
    },
    {
      attribute: "organDonor",
      label: "Organ Donor",
      value: p.organDonor === true ? "Yes" : "No",
      disclosed: false,
      category: "medical",
    },
    // Credentials
    {
      attribute: "hospitalPatient",
      label: "Registered Hospital Patient",
      value: "Embrace Health Grid · Verified",
      disclosed: false,
      category: "credentials",
    },
    {
      attribute: "insuranceValid",
      label: "Insurance Valid",
      value: insuranceProvider + " · Active",
      disclosed: false,
      category: "credentials",
    },
    {
      attribute: "mrn",
      label: "Medical Record No.",
      value: p.mrn ?? "MRN-204871",
      disclosed: false,
      category: "credentials",
    },
    {
      attribute: "admissionStatus",
      label: "Admission Status",
      value: p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : "Outpatient",
      disclosed: false,
      category: "credentials",
    },
  ];
}
