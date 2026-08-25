/**
 * Provision a real Solana signing key for every DID that still carries a
 * `pk_...` placeholder.
 *
 * Every DID in this system was issued with `public_key: pk_<uuid fragment>` — an
 * identifier shaped like a key with no key behind it — so nothing could be signed
 * as that subject and no signature could be verified against them.
 *
 * Idempotent: a DID that already has an active wallet is skipped, so this can be
 * re-run safely. DIDs with no hospital are skipped rather than guessed at,
 * because embedded_wallets.hospital_id is what every access policy scopes on.
 *
 * Run: node --env-file=.env scripts/provision-did-wallets.js [--commit]
 * Without --commit it reports what it would do and changes nothing.
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Keypair } from "@solana/web3.js";

const COMMIT = process.argv.includes("--commit");

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MASTER = process.env.MASTER_ENCRYPTION_KEY?.trim();

if (!URL || !SERVICE) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
if (!MASTER) throw new Error("MASTER_ENCRYPTION_KEY is required — it protects the keys at rest");

// Must match encryptPrivateKey() in src/lib/embedded-wallet.server.ts exactly,
// or the app will not be able to decrypt what this script writes.
const SCRYPT_SALT = Buffer.from("embrace-health-grid/embedded-wallet/v1");
function masterKey() {
  if (/^[0-9a-fA-F]{64}$/.test(MASTER)) return Buffer.from(MASTER, "hex");
  if (MASTER.length < 32) throw new Error("MASTER_ENCRYPTION_KEY passphrase must be >= 32 chars");
  return crypto.scryptSync(MASTER, SCRYPT_SALT, 32, { N: 16384, r: 8, p: 1 });
}
function encryptPrivateKey(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
  return JSON.stringify({
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    encrypted: encrypted.toString("hex"),
  });
}

const db = createClient(URL, SERVICE);

const { data: dids, error } = await db
  .from("dids")
  .select("did, owner_name, owner_type, hospital_id, public_key");
if (error) throw new Error(error.message);

const { data: wallets } = await db
  .from("embedded_wallets")
  .select("owner_did")
  .eq("is_active", true)
  .not("owner_did", "is", null);
const provisioned = new Set((wallets ?? []).map((w) => w.owner_did));

const todo = dids.filter((d) => !provisioned.has(d.did) && d.hospital_id);
const skipped = dids.filter((d) => !provisioned.has(d.did) && !d.hospital_id);

console.log(`DIDs: ${dids.length} total, ${provisioned.size} already keyed`);
console.log(`      ${todo.length} to provision, ${skipped.length} skipped (no hospital)`);
for (const d of skipped) console.log(`      skip: ${d.did} (${d.owner_type}) — no hospital`);

if (!COMMIT) {
  console.log("\nDry run. Re-run with --commit to write.");
  process.exit(0);
}

let ok = 0;
for (const d of todo) {
  const keypair = Keypair.generate();
  const pub = keypair.publicKey.toBase58();

  const { error: insErr } = await db.from("embedded_wallets").insert({
    wallet_id: crypto.randomUUID(),
    hospital_id: d.hospital_id,
    owner_type: "did",
    owner_did: d.did,
    owner_id: null,
    public_key: pub,
    encrypted_private_key: encryptPrivateKey(keypair.secretKey),
    encryption_key_version: 1,
    is_active: true,
  });
  if (insErr) {
    console.log(`  FAIL ${d.did}: ${insErr.message.slice(0, 80)}`);
    continue;
  }

  const { error: pubErr } = await db.from("dids").update({ public_key: pub }).eq("did", d.did);
  if (pubErr) {
    // Leaving the DID advertising a placeholder while a key exists would make
    // its signatures unverifiable.
    await db.from("embedded_wallets").delete().eq("owner_did", d.did);
    console.log(`  FAIL ${d.did}: could not publish public key — ${pubErr.message.slice(0, 60)}`);
    continue;
  }
  ok++;
}
console.log(`\nProvisioned ${ok} of ${todo.length}.`);
