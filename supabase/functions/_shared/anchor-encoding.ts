/**
 * Anchor encoding for the deployed Solana program (Deno / Edge Function).
 *
 * Mirrors backend/lib/solana-anchor.js. Kept as a separate file because Edge
 * Functions run on Deno and cannot import from the Node backend tree.
 *
 * Program: FuL2Ko8zMdej7QU8VtxoyTdmpuF1MsWLECCTVTztQ2iR (devnet)
 *
 * Anchor instruction data layout:
 *   [8-byte discriminator = sha256("global:<name>")[0..8]][Borsh args]
 *
 * The legacy backend sent the raw 32-byte hash as instruction data, which
 * matches no discriminator and would always have been rejected.
 */

/** Anchor discriminator for an instruction name. */
export async function discriminator(name: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`global:${name}`));
  return new Uint8Array(digest).slice(0, 8);
}

/** Borsh string: u32 little-endian length prefix, then UTF-8 bytes. */
export function borshString(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  const out = new Uint8Array(4 + bytes.length);
  new DataView(out.buffer).setUint32(0, bytes.length, true);
  out.set(bytes, 4);
  return out;
}

/** Fixed [u8; 32] — inline, no length prefix. */
export function borshFixed32(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  if (clean.length !== 64) {
    throw new Error(`Expected 64 hex chars for [u8; 32], got ${clean.length}`);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** update_patient_root(patient_did: String, new_root: [u8; 32]) */
export async function encodeUpdatePatientRoot(
  patientDid: string,
  rootHashHex: string,
): Promise<Uint8Array> {
  return concat([
    await discriminator("update_patient_root"),
    borshString(patientDid),
    borshFixed32(rootHashHex),
  ]);
}

/** register_patient_root(patient_did: String, initial_root: [u8; 32]) */
export async function encodeRegisterPatientRoot(
  patientDid: string,
  rootHashHex: string,
): Promise<Uint8Array> {
  return concat([
    await discriminator("register_patient_root"),
    borshString(patientDid),
    borshFixed32(rootHashHex),
  ]);
}
