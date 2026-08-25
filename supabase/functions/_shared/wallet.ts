/**
 * Signing-key provisioning for DIDs — Edge Function side.
 *
 * WHY THIS EXISTS HERE AND NOT ONLY IN NODE
 * ─────────────────────────────────────────
 * The DID is created by an Edge Function, but key provisioning used to live in
 * the Node wrapper that calls it (clinical.server.ts). Anything invoking
 * onboard-user or identity-ops DIRECTLY — a script, an integration, a retry —
 * therefore produced a DID with a `pk_<uuid>` placeholder and no key material.
 * Verified by calling onboard-user directly: the account, profile, MRN and DID
 * were all created, and `embedded_wallets` had no row.
 *
 * Creating the key next to the DID removes that whole class of gap.
 *
 * BYTE-COMPATIBILITY IS THE WHOLE GAME
 * ────────────────────────────────────
 * src/lib/embedded-wallet.server.ts decrypts what this writes. If the two ever
 * disagree by one byte the key is unrecoverable, so this deliberately uses
 * `node:crypto` with the same algorithm, IV length and envelope shape rather
 * than a Web Crypto reimplementation — Web Crypto's AES-GCM appends the auth tag
 * to the ciphertext, whereas Node keeps it separate, and that difference is
 * exactly the kind of thing that silently destroys keys.
 *
 * Envelope: {"iv":<hex 12B>,"tag":<hex 16B>,"encrypted":<hex>}
 */

import crypto from "node:crypto";
// Buffer is NOT a global in Deno. Without this import the module-level
// SCRYPT_SALT initialiser throws a ReferenceError at import time, which the
// Edge Runtime surfaces only as a bare WORKER_ERROR.
import { Buffer } from "node:buffer";
import { Keypair } from "npm:@solana/web3.js@1.98.4";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
// Must match SCRYPT_SALT in src/lib/embedded-wallet.server.ts exactly.
const SCRYPT_SALT = Buffer.from("embrace-health-grid/embedded-wallet/v1");
const MIN_PASSPHRASE_LENGTH = 32;

function getMasterKey(): Buffer {
  const masterKey = Deno.env.get("MASTER_ENCRYPTION_KEY")?.trim();
  if (!masterKey) {
    throw new Error(
      "MASTER_ENCRYPTION_KEY is not configured for this function. Set it with " +
        "`supabase secrets set MASTER_ENCRYPTION_KEY=...` — it must be the SAME value " +
        "the app server uses, or keys written here cannot be decrypted there.",
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(masterKey)) return Buffer.from(masterKey, "hex");
  if (masterKey.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error("MASTER_ENCRYPTION_KEY must be 64 hex chars, or a passphrase of 32+ chars");
  }
  return crypto.scryptSync(masterKey, SCRYPT_SALT, KEY_LENGTH, { N: 16384, r: 8, p: 1 });
}

function encryptPrivateKey(privateKey: Uint8Array): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()]);
  return JSON.stringify({
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    encrypted: encrypted.toString("hex"),
  });
}

/**
 * Give a DID a signing key, and publish its public key onto the DID row.
 *
 * Idempotent — returns the existing key if one is already active, so it is safe
 * to call on every issuance and alongside the Node-side provisioning.
 *
 * Returns null instead of throwing: the DID, profile and credential are already
 * created by the time this runs, and failing the whole onboarding because a key
 * could not be minted would be worse than a DID that the backfill picks up
 * later. The caller reports it.
 */
export async function provisionDidWallet(
  db: SupabaseClient,
  did: string,
): Promise<{ publicKey: string } | null> {
  try {
    const { data: existing } = await db
      .from("embedded_wallets")
      .select("public_key")
      .eq("owner_did", did)
      .eq("is_active", true)
      .maybeSingle();
    if (existing) return { publicKey: existing.public_key };

    const { data: didRow } = await db
      .from("dids")
      .select("did, hospital_id")
      .eq("did", did)
      .maybeSingle();

    // embedded_wallets.hospital_id is NOT NULL and every policy scopes on it, so
    // a key with no tenant could not be governed. Refuse rather than guess.
    if (!didRow?.hospital_id) return null;

    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();

    const { error: insErr } = await db.from("embedded_wallets").insert({
      wallet_id: crypto.randomUUID(),
      hospital_id: didRow.hospital_id,
      owner_type: "did",
      owner_did: did,
      owner_id: null,
      public_key: publicKey,
      encrypted_private_key: encryptPrivateKey(keypair.secretKey),
      encryption_key_version: 1,
      is_active: true,
    });

    if (insErr) {
      // Lost a race with the Node-side provisioning: use whichever landed first
      // rather than leaving two active keys for one DID.
      const { data: raced } = await db
        .from("embedded_wallets")
        .select("public_key")
        .eq("owner_did", did)
        .eq("is_active", true)
        .maybeSingle();
      return raced ? { publicKey: raced.public_key } : null;
    }

    // Publish it. Until this runs the DID advertises a `pk_<uuid>` placeholder,
    // against which no signature it makes could be verified.
    const { error: pubErr } = await db
      .from("dids")
      .update({ public_key: publicKey })
      .eq("did", did);

    if (pubErr) {
      await db.from("embedded_wallets").delete().eq("owner_did", did);
      return null;
    }

    return { publicKey };
  } catch (_err) {
    return null;
  }
}
