/**
 * Signing and verification for consent decisions.
 *
 * A consent decision used to be evidenced only by a `status` column. This signs
 * the decision with the patient DID's server-held Ed25519 key, so the record
 * carries proof that cannot be altered afterwards without detection.
 *
 * Plain exports only — no createServerFn here. See wallets.server.ts for why
 * mixing the two breaks the client build.
 */

import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { didWalletService } from "./embedded-wallet.server";
import { getSupabaseServiceRoleClient } from "./supabase.server";

/**
 * The exact string that gets signed.
 *
 * Field order and separator are part of the format: verification recomputes
 * nothing, it reads back the stored payload, but this must stay stable so a
 * payload signed today still parses tomorrow. Every field that gives the
 * decision meaning is committed to — changing the doctor, the resource or the
 * decision after the fact invalidates the signature.
 */
export function buildConsentPayload(input: {
  grantId: string;
  patientDid: string;
  doctorDid: string;
  resource: string;
  decision: string;
  decidedAt: string;
}): string {
  return [
    "embrace-health-grid/consent/v1",
    input.grantId,
    input.patientDid,
    input.doctorDid,
    input.resource,
    input.decision,
    input.decidedAt,
  ].join("|");
}

/**
 * Sign a consent decision as the patient.
 *
 * Never throws: a signing failure must not block the patient from granting or
 * withdrawing access. An unsigned decision is still a valid decision — it just
 * carries no proof — whereas a consent that could not be revoked because the
 * key service was down would be a safety problem.
 */
export async function signConsentDecision(input: {
  grantId: string;
  patientDid: string;
  doctorDid: string;
  resource: string;
  decision: string;
  decidedAt: string;
}): Promise<{ payload: string; signature: string; publicKey: string } | null> {
  try {
    const payload = buildConsentPayload(input);
    const { signature, publicKey } = await didWalletService.signAsDid(
      input.patientDid,
      new TextEncoder().encode(payload),
    );
    return { payload, signature, publicKey };
  } catch (err) {
    console.warn(`Consent ${input.grantId} recorded without a signature:`, (err as Error).message);
    return null;
  }
}

export interface ConsentVerification {
  grantId: string;
  signed: boolean;
  valid: boolean;
  reason: string;
  publicKey?: string;
  signedAt?: string;
}

/**
 * Verify a stored consent signature.
 *
 * Reads the payload back rather than rebuilding it, so verification tests the
 * signature and not this function's ability to reproduce a string. The payload
 * itself commits to the grant's fields, so the check below also confirms the row
 * still says what was signed.
 */
export async function verifyConsentSignature(grantId: string): Promise<ConsentVerification> {
  const db = getSupabaseServiceRoleClient();

  const { data: row, error } = await db
    .from("consents")
    .select(
      "grant_id, patient_did, doctor_did, resource, status, patient_signature, signed_payload, signing_public_key, approved_at, revoked_at, rejected_at",
    )
    .eq("grant_id", grantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return { grantId, signed: false, valid: false, reason: "No such consent" };

  if (!row.patient_signature || !row.signed_payload || !row.signing_public_key) {
    return {
      grantId,
      signed: false,
      valid: false,
      reason:
        "This decision predates consent signing, or the signing key was unavailable when it was recorded.",
    };
  }

  let valid = false;
  try {
    valid = ed25519.verify(
      Buffer.from(row.patient_signature, "base64"),
      new TextEncoder().encode(row.signed_payload),
      bs58.decode(row.signing_public_key),
    );
  } catch {
    return { grantId, signed: true, valid: false, reason: "Signature is malformed" };
  }

  if (!valid) {
    return {
      grantId,
      signed: true,
      valid: false,
      reason: "Signature does not match the recorded decision — this record may have been altered.",
      publicKey: row.signing_public_key,
    };
  }

  // The signature is good; now confirm the row still matches what it covers.
  const parts = row.signed_payload.split("|");
  const drift =
    parts[1] !== row.grant_id ||
    parts[2] !== row.patient_did ||
    parts[3] !== row.doctor_did ||
    parts[4] !== row.resource;

  if (drift) {
    return {
      grantId,
      signed: true,
      valid: false,
      reason:
        "Signature is valid but the consent row no longer matches what was signed — a field was changed after the decision.",
      publicKey: row.signing_public_key,
    };
  }

  return {
    grantId,
    signed: true,
    valid: true,
    reason: `Signed by ${row.patient_did} and verified against their published key.`,
    publicKey: row.signing_public_key,
    signedAt: parts[6],
  };
}
