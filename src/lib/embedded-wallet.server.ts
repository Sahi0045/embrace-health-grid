import { Keypair, PublicKey, Connection, SystemProgram } from "@solana/web3.js";
import crypto from "crypto";
// @noble/curves is already a dependency of @solana/web3.js and is the same
// ed25519 implementation Solana verifies against — no new package needed.
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { getSupabaseServiceRoleClient } from "./supabase.server";

// ─── Cryptography Helper Utilities ──────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * Derive the 32-byte AES key used to wrap Solana private keys.
 *
 * Two accepted forms:
 *
 *   64 hex characters   the documented form (crypto.randomBytes(32)). Used
 *                       directly — already full entropy, so hashing adds nothing.
 *   any other string    treated as a passphrase and stretched with scrypt.
 *
 * This previously ran a bare SHA-256 over whatever was supplied. For a random
 * 32-byte key that is harmless, but for a passphrase it is close to no protection:
 * SHA-256 is fast and unsalted, so anyone holding the ciphertext could brute-force
 * the key offline. These ciphertexts live in a database row, so that is a
 * realistic threat, and scrypt makes each guess expensive.
 *
 * The fixed salt is a deliberate compromise. Per-key salts would be stronger, but
 * a salt must be recoverable to decrypt and there is nowhere to store it that an
 * attacker holding the ciphertext would not also reach. It therefore serves only
 * as domain separation, and the passphrase path stays a fallback — prefer hex.
 */
const KEY_LENGTH = 32;
const SCRYPT_SALT = Buffer.from("embrace-health-grid/embedded-wallet/v1");
const MIN_PASSPHRASE_LENGTH = 32;

function getMasterKey(): Buffer {
  const masterKey = process.env.MASTER_ENCRYPTION_KEY?.trim();
  if (!masterKey) {
    throw new Error(
      "MASTER_ENCRYPTION_KEY environment variable is required. Cannot encrypt/decrypt " +
        "wallet keys without it. Generate one with: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(masterKey)) {
    return Buffer.from(masterKey, "hex");
  }

  if (masterKey.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(
      "MASTER_ENCRYPTION_KEY must be 64 hex characters, or a passphrase of at least " +
        `${MIN_PASSPHRASE_LENGTH} characters. It protects Solana signing keys at rest.`,
    );
  }

  return crypto.scryptSync(masterKey, SCRYPT_SALT, KEY_LENGTH, { N: 16384, r: 8, p: 1 });
}

function encryptPrivateKey(privateKey: Uint8Array): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    encrypted: encrypted.toString("hex"),
  });
}

function decryptPrivateKey(encryptedStr: string): Uint8Array {
  const key = getMasterKey();

  const { iv, tag, encrypted } = JSON.parse(encryptedStr);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "hex")),
    decipher.final(),
  ]);
  return new Uint8Array(decrypted);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmbeddedWallet {
  walletId: string;
  hospitalId: string;
  // "did" is a key belonging to a DID subject (patient or clinician); "hospital"
  // is a tenant's own signing key. "patient" was never a valid value — the table
  // constraint has always been ('hospital','user'), now ('hospital','user','did').
  ownerType: "hospital" | "user" | "did";
  ownerId: string; // hospital_id, profile id, or the DID
  publicKey: string; // Solana address (base58)
  derivationPath?: string; // BIP44 path
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Hospital Master Wallet Service ──────────────────────────────────────────

export class HospitalWalletService {
  private connection: Connection;

  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");
  }

  async getOrCreateHospitalWallet(hospitalId: string): Promise<EmbeddedWallet> {
    // Service role: encrypted_private_key is not granted to `authenticated`, so the
    // request-scoped client cannot see it. Callers must have already verified the
    // user's identity and hospital before reaching this service.
    const db = getSupabaseServiceRoleClient();

    const { data: existingWallet, error: fetchError } = await db
      .from("embedded_wallets")
      .select("*")
      .eq("hospital_id", hospitalId)
      .eq("owner_type", "hospital")
      .eq("is_active", true)
      .maybeSingle();

    if (existingWallet && !fetchError) {
      return {
        walletId: existingWallet.wallet_id,
        hospitalId: existingWallet.hospital_id,
        ownerType: existingWallet.owner_type,
        ownerId: existingWallet.owner_id,
        publicKey: existingWallet.public_key,
        isActive: existingWallet.is_active,
        createdAt: new Date(existingWallet.created_at),
        updatedAt: new Date(existingWallet.updated_at),
      };
    }

    // Generate new keypair
    const keypair = Keypair.generate();

    // Encrypt private key
    const encryptedPrivateKey = encryptPrivateKey(keypair.secretKey);

    const walletId = crypto.randomUUID();
    const { error: insertError } = await db.from("embedded_wallets").insert({
      wallet_id: walletId,
      hospital_id: hospitalId,
      owner_type: "hospital",
      owner_id: hospitalId,
      public_key: keypair.publicKey.toBase58(),
      encrypted_private_key: encryptedPrivateKey,
      encryption_key_version: 1,
      derivation_path: "m/44'/501'/0'/0/0",
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    if (insertError) {
      throw new Error(`Failed to store wallet: ${insertError.message}`);
    }

    console.log(
      `✅ Created hospital wallet ${keypair.publicKey.toBase58()} for hospital ${hospitalId}`,
    );

    return {
      walletId,
      hospitalId,
      ownerType: "hospital",
      ownerId: hospitalId,
      publicKey: keypair.publicKey.toBase58(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getHospitalKeypair(hospitalId: string): Promise<Keypair> {
    // Service role: encrypted_private_key is not granted to `authenticated`, so the
    // request-scoped client cannot see it. Callers must have already verified the
    // user's identity and hospital before reaching this service.
    const db = getSupabaseServiceRoleClient();

    const { data: wallet, error } = await db
      .from("embedded_wallets")
      .select("encrypted_private_key, public_key")
      .eq("hospital_id", hospitalId)
      .eq("owner_type", "hospital")
      .single();

    if (!wallet || error) {
      // Create one if it does not exist
      const newWallet = await this.getOrCreateHospitalWallet(hospitalId);
      throw new Error(
        `Hospital wallet not found for: ${hospitalId}. Generated new one: ${newWallet.publicKey}`,
      );
    }

    try {
      const privateKeyBytes = decryptPrivateKey(wallet.encrypted_private_key);
      return Keypair.fromSecretKey(privateKeyBytes);
    } catch (err) {
      console.warn("Failed to decrypt hospital private key, generating fallback keypair", err);
      return Keypair.generate();
    }
  }

  async rotateHospitalWallet(hospitalId: string): Promise<string> {
    // Service role: encrypted_private_key is not granted to `authenticated`, so the
    // request-scoped client cannot see it. Callers must have already verified the
    // user's identity and hospital before reaching this service.
    const db = getSupabaseServiceRoleClient();

    const { error: deactivateErr } = await db
      .from("embedded_wallets")
      .update({ is_active: false })
      .eq("hospital_id", hospitalId)
      .eq("owner_type", "hospital");

    // If the old wallet is still active when the new one is minted, the hospital
    // has two active signing keys and which one signs becomes arbitrary.
    if (deactivateErr) {
      throw new Error(`Could not retire the previous wallet: ${deactivateErr.message}`);
    }

    const newWallet = await this.getOrCreateHospitalWallet(hospitalId);

    console.log(`🔄 Rotated hospital wallet for ${hospitalId}`);
    console.log(`   New: ${newWallet.publicKey}`);

    return newWallet.publicKey;
  }

  async getBalance(publicKey: string): Promise<number> {
    try {
      const pubkey = new PublicKey(publicKey);
      return await this.connection.getBalance(pubkey);
    } catch (error) {
      console.error(`Failed to get balance for ${publicKey}:`, error);
      return 0;
    }
  }

  async requestAirdrop(publicKey: string, amount: number = 1): Promise<string> {
    if (process.env.SOLANA_NETWORK === "mainnet") {
      throw new Error("Airdrops only available on Devnet/Testnet");
    }

    try {
      const pubkey = new PublicKey(publicKey);
      const lamports = amount * 1_000_000_000;

      const signature = await this.connection.requestAirdrop(pubkey, lamports);
      console.log(`✅ Requested ${amount} SOL airdrop. TX: ${signature}`);

      return signature;
    } catch (error) {
      throw new Error(`Airdrop failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// ─── Patient Wallet Service ──────────────────────────────────────────────────

/**
 * Signing keys for DIDs — patients and clinicians alike.
 *
 * Custodial by design. The key is generated on the server, encrypted at rest with
 * MASTER_ENCRYPTION_KEY, and never leaves it. The subject installs no wallet, has
 * no seed phrase, and cannot lock themselves out of their own medical record —
 * which is the whole reason not to hand patients a Phantom wallet.
 *
 * The trade is explicit: the platform CAN sign as the subject, so a signature
 * proves "the platform asserts this subject approved", not "only this subject
 * could have approved". Every signing operation therefore has to be audited, and
 * no UI may describe this as self-custody.
 *
 * REPLACES PatientWalletService.derivePatientWallet(), which built the keypair
 * from sha256(`${did}|${hospitalId}|health-grid`). All three inputs are public —
 * the DID is on the patient's emergency QR code — so anyone could regenerate
 * anyone's private key. It was dead code; it is gone.
 */
export class DidWalletService {
  /**
   * Return the DID's active wallet, creating one if it has none.
   *
   * Idempotent: safe to call on every onboarding and from the backfill. The
   * partial unique index on (owner_did) where is_active is the real guard
   * against a race creating two active keys for one DID.
   */
  async getOrCreateWalletForDid(did: string): Promise<EmbeddedWallet> {
    const db = getSupabaseServiceRoleClient();

    const { data: existing } = await db
      .from("embedded_wallets")
      .select("*")
      .eq("owner_did", did)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      return {
        walletId: existing.wallet_id,
        hospitalId: existing.hospital_id,
        ownerType: "did",
        ownerId: existing.owner_did,
        publicKey: existing.public_key,
        isActive: existing.is_active,
        createdAt: new Date(existing.created_at),
        updatedAt: new Date(existing.updated_at),
      };
    }

    const { data: didRow, error: didErr } = await db
      .from("dids")
      .select("did, hospital_id")
      .eq("did", did)
      .maybeSingle();

    if (didErr) throw new Error(didErr.message);
    if (!didRow) throw new Error(`Unknown DID: ${did}`);
    if (!didRow.hospital_id) {
      // embedded_wallets.hospital_id is NOT NULL, and a key with no tenant could
      // not be scoped by any policy. Better to refuse than to attribute it.
      //
      // This is also what keeps SUPER-ADMINS off embedded keys by design: they
      // belong to no hospital, so they fall out here and use an external wallet
      // instead. Patients, clinicians and hospital admins all get one.
      throw new Error(`DID ${did} belongs to no hospital, so no signing key can be issued`);
    }

    const keypair = Keypair.generate();
    const walletId = crypto.randomUUID();

    const { error: insertError } = await db.from("embedded_wallets").insert({
      wallet_id: walletId,
      hospital_id: didRow.hospital_id,
      owner_type: "did",
      owner_did: did,
      owner_id: null,
      public_key: keypair.publicKey.toBase58(),
      encrypted_private_key: encryptPrivateKey(keypair.secretKey),
      encryption_key_version: 1,
      is_active: true,
    });

    if (insertError) {
      // Lost a race: another request provisioned it first. Return theirs rather
      // than failing — and do NOT leave a second key around.
      if (/embedded_wallets_active_did_idx|duplicate key/i.test(insertError.message)) {
        return this.getOrCreateWalletForDid(did);
      }
      throw new Error(`Failed to store wallet: ${insertError.message}`);
    }

    // Publish the real public key onto the DID. Until now every DID carried a
    // `pk_<uuid>` placeholder, so nothing could verify a signature against it.
    const { data: pubUpdated, error: pubErr } = await db
      .from("dids")
      .update({ public_key: keypair.publicKey.toBase58() })
      .eq("did", did)
      .select("did");

    if (!pubErr && !pubUpdated?.length) {
      // No such DID: the key would exist with nothing advertising it.
      await db.from("embedded_wallets").delete().eq("wallet_id", walletId);
      throw new Error(`Could not publish public key: no DID ${did}`);
    }

    if (pubErr) {
      // The key exists but the DID still advertises the placeholder, which would
      // make its signatures unverifiable. Roll back rather than ship that.
      await db.from("embedded_wallets").delete().eq("wallet_id", walletId);
      throw new Error(`Could not publish public key onto the DID: ${pubErr.message}`);
    }

    return {
      walletId,
      hospitalId: didRow.hospital_id,
      ownerType: "did",
      ownerId: did,
      publicKey: keypair.publicKey.toBase58(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Export a DID's full keypair.
   *
   * The subject owns this identity, so they must be able to hold both halves —
   * that is the point of a DID-based record. This method performs NO
   * authorization: the caller (wallets.server.ts) must have already proven the
   * requester owns `did`, because everything this returns is the identity
   * itself.
   *
   * Returned in both formats a wallet will accept: base58 is what Phantom and
   * Solflare take on import, the byte array is what `solana-keygen` writes.
   */
  async exportKeypairForDid(did: string): Promise<{
    publicKey: string;
    secretKeyBase58: string;
    secretKeyArray: number[];
  } | null> {
    const db = getSupabaseServiceRoleClient();
    const { data, error } = await db
      .from("embedded_wallets")
      .select("encrypted_private_key, public_key")
      .eq("owner_did", did)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const secret = decryptPrivateKey(data.encrypted_private_key);
    const keypair = Keypair.fromSecretKey(secret);

    return {
      publicKey: data.public_key,
      secretKeyBase58: bs58.encode(secret),
      secretKeyArray: Array.from(secret),
    };
  }

  /** The DID's Solana public key, or null if no wallet has been provisioned. */
  async getPublicKey(did: string): Promise<string | null> {
    const db = getSupabaseServiceRoleClient();
    const { data } = await db
      .from("embedded_wallets")
      .select("public_key")
      .eq("owner_did", did)
      .eq("is_active", true)
      .maybeSingle();
    return data?.public_key ?? null;
  }

  /**
   * Sign a message as this DID.
   *
   * The plaintext key exists only inside this call. Callers must have already
   * established that the request is authorised to act for `did` — this service
   * performs no authorization of its own, by design, because it is reached from
   * several different flows with different rules.
   */
  async signAsDid(
    did: string,
    message: Uint8Array,
  ): Promise<{ signature: string; publicKey: string }> {
    const db = getSupabaseServiceRoleClient();
    const { data, error } = await db
      .from("embedded_wallets")
      .select("wallet_id, encrypted_private_key, public_key")
      .eq("owner_did", did)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error(`No signing key provisioned for ${did}`);

    const secret = decryptPrivateKey(data.encrypted_private_key);
    const keypair = Keypair.fromSecretKey(secret);
    // Solana secretKey is 64 bytes (32-byte seed || 32-byte public key); noble
    // signs from the seed half.
    const signature = ed25519.sign(message, keypair.secretKey.slice(0, 32));

    const { error: touchErr } = await db
      .from("embedded_wallets")
      .update({ last_used_at: new Date().toISOString() })
      .eq("wallet_id", data.wallet_id);

    // Telemetry only: the signature is already produced and must not be failed
    // for a bookkeeping write.
    if (touchErr) {
      console.warn(`Could not stamp last_used_at on ${data.wallet_id}: ${touchErr.message}`);
    }

    return {
      signature: Buffer.from(signature).toString("base64"),
      publicKey: data.public_key,
    };
  }
}

// ─── Wallet Verification Service ─────────────────────────────────────────────

export class WalletVerificationService {
  verifyPublicKey(publicKey: string): boolean {
    try {
      new PublicKey(publicKey);
      return true;
    } catch {
      return false;
    }
  }

  verifySolanaDid(did: string): boolean {
    if (!did.startsWith("did:solana:")) {
      return false;
    }

    const publicKey = did.split(":")[2];
    return this.verifyPublicKey(publicKey);
  }
}

export const hospitalWalletService = new HospitalWalletService();
export const didWalletService = new DidWalletService();
export const walletVerificationService = new WalletVerificationService();
