import { Keypair, PublicKey, Connection, SystemProgram } from "@solana/web3.js";
import crypto from "crypto";
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
  ownerType: "hospital" | "patient";
  ownerId: string; // hospital_id or patient_did
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

    await db
      .from("embedded_wallets")
      .update({ is_active: false })
      .eq("hospital_id", hospitalId)
      .eq("owner_type", "hospital");

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

export class PatientWalletService {
  async derivePatientWallet(patientDid: string, hospitalId: string): Promise<string> {
    const didParts = patientDid.split(":");
    const patientPublicKey = didParts[2];

    if (!patientPublicKey) {
      throw new Error(`Invalid patient DID format: ${patientDid}`);
    }

    // Combine patient DID + hospital ID deterministically
    const seedPhrase = `${patientDid}|${hospitalId}|health-grid`;
    const seed = crypto.createHash("sha256").update(seedPhrase).digest();

    const keypair = Keypair.fromSeed(seed);
    return keypair.publicKey.toBase58();
  }

  async getProgramDerivedAddress(
    patientDid: string,
    recordType: string,
    hospitalId: string,
  ): Promise<string> {
    const programId = new PublicKey(
      process.env.HEALTH_GRID_PROGRAM_ID || "11111111111111111111111111111111",
    );

    const seeds = [
      Buffer.from("record_account"),
      Buffer.from(patientDid),
      Buffer.from(recordType),
      Buffer.from(hospitalId),
    ];

    const [pda] = PublicKey.findProgramAddressSync(seeds, programId);
    return pda.toBase58();
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
export const patientWalletService = new PatientWalletService();
export const walletVerificationService = new WalletVerificationService();
