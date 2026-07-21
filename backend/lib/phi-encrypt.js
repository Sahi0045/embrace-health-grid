/**
 * PHI Field-Level Encryption — Embrace Health Grid
 *
 * HIPAA § 164.312(a)(2)(iv) — Encryption and decryption of ePHI
 *
 * Algorithm : AES-256-GCM  (authenticated encryption — detects tampering)
 * Key source : DATA_ENCRYPTION_KEY env var (32-byte hex = 64 hex chars)
 *              Falls back to a key derived from JWT_SECRET in development.
 *
 * Envelope format (stored as a JSON string):
 *   { v:1, iv:"<24-char base64url>", tag:"<24-char base64url>", ct:"<base64url>" }
 *
 * Namespaces that contain PHI (encrypted on write, decrypted on read):
 *   medical-records, prescriptions, lab-results, users, consent-manager,
 *   appointments, billing, nfc-cards, visitors, admissions, medications,
 *   nursing-notes, daily-checkups, procedures, diet-orders, vitals-history,
 *   health-metrics, pharmacy-orders, rehab-sessions, feedback
 *
 * Non-PHI namespaces (stored as plaintext — no sensitive patient data):
 *   audit, tracker, did-registry, beds, fraud-alerts, solana-anchors, zkproofs
 *
 * Usage:
 *   import { encryptValue, decryptValue, isPHINamespace } from './phi-encrypt.js';
 *   const stored  = encryptValue(plainObj);     // → encrypted envelope string
 *   const plain   = decryptValue(storedString); // → original object
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash, scryptSync } from "crypto";

// ─── Key management ────────────────────────────────────────────────────────────

/**
 * Derive a 32-byte AES key from the DATA_ENCRYPTION_KEY env var.
 * In production this MUST be a 32-byte (64 hex char) random key.
 * In development we derive from JWT_SECRET using scrypt so tests still work.
 */
function deriveKey() {
  const hexKey = process.env.DATA_ENCRYPTION_KEY;

  if (hexKey) {
    if (hexKey.length !== 64) {
      throw new Error(
        "DATA_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). " +
          "Generate one with: npm run gen:dek",
      );
    }
    return Buffer.from(hexKey, "hex");
  }

  // Development fallback: use a fixed seed so CLI tools and dev server always match
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL: DATA_ENCRYPTION_KEY must be set in production. " +
        "PHI cannot be stored unencrypted.",
    );
  }

  const devSeed = process.env.JWT_SECRET || "embrace-health-dev-encryption-seed-v1";
  const salt = Buffer.from("embrace-health-phi-salt-v1");
  return scryptSync(devSeed, salt, 32, { N: 16384, r: 8, p: 1 });
}

// Cache the key in module scope — derived once at startup
let _KEY = null;
function getKey() {
  if (!_KEY) _KEY = deriveKey();
  return _KEY;
}

// ─── PHI namespace registry ────────────────────────────────────────────────────

/**
 * Namespaces whose `value` objects contain PHI and must be encrypted at rest.
 * Keep this list up-to-date whenever a new namespace with patient data is added.
 */
const PHI_NAMESPACES = new Set([
  "medical-records",
  "medical-records-anchor",
  "prescriptions",
  "lab-results",
  "users",
  "consent-manager",
  "consent-requests",
  "appointments",
  "billing",
  "nfc-cards",
  "visitors",
  "admissions",
  "medications",
  "nursing-notes",
  "daily-checkups",
  "procedures",
  "diet-orders",
  "vitals-history",
  "health-metrics",
  "pharmacy-orders",
  "rehab-sessions",
  "feedback",
  "insurance-claims",
  "vaccines",
]);

/** Returns true if the namespace contains PHI that must be encrypted. */
export function isPHINamespace(namespace) {
  return PHI_NAMESPACES.has(namespace);
}

// ─── Encryption / Decryption ───────────────────────────────────────────────────

const ENVELOPE_VERSION = 1;
const ENC_PREFIX = "__phi_enc__:";

/**
 * Encrypt a JS value (any JSON-serialisable object) using AES-256-GCM.
 * Returns a string envelope that can be stored in place of the plaintext value.
 *
 * @param {any} value
 * @returns {string} encrypted envelope string
 */
export function encryptValue(value) {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const plaintext = JSON.stringify(value);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16-byte authentication tag

  const envelope = JSON.stringify({
    v: ENVELOPE_VERSION,
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    ct: ct.toString("base64url"),
  });

  return ENC_PREFIX + envelope;
}

/**
 * Decrypt an encrypted envelope string back to the original JS value.
 * If the input is not an envelope (plaintext JSON), returns it as-is
 * to support transparent migration of legacy unencrypted data.
 *
 * @param {string} stored - encrypted envelope string or legacy plaintext
 * @returns {any} decrypted value
 */
export function decryptValue(stored) {
  if (typeof stored !== "string" || !stored.startsWith(ENC_PREFIX)) {
    // Legacy plaintext — return as-is (migration in progress)
    return stored;
  }

  const key = getKey();
  const envelope = JSON.parse(stored.slice(ENC_PREFIX.length));

  if (envelope.v !== ENVELOPE_VERSION) {
    throw new Error(`Unknown PHI encryption envelope version: ${envelope.v}`);
  }

  const iv = Buffer.from(envelope.iv, "base64url");
  const tag = Buffer.from(envelope.tag, "base64url");
  const ct = Buffer.from(envelope.ct, "base64url");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}

/**
 * Check whether a stored value is already in encrypted envelope format.
 * Used during migration to avoid double-encryption.
 */
export function isEncrypted(stored) {
  return typeof stored === "string" && stored.startsWith(ENC_PREFIX);
}

// ─── Key rotation helper ───────────────────────────────────────────────────────

/**
 * Re-encrypt a value using a new key (for key rotation workflows).
 * Pass old key material as Buffer — reads new key from env as usual.
 *
 * @param {string} encryptedEnvelope
 * @param {Buffer} oldKey
 * @returns {string} re-encrypted envelope with current key
 */
export function reEncryptValue(encryptedEnvelope, oldKey) {
  // Decrypt with old key
  const key = oldKey;
  const envelope = JSON.parse(encryptedEnvelope.slice(ENC_PREFIX.length));
  const iv = Buffer.from(envelope.iv, "base64url");
  const tag = Buffer.from(envelope.tag, "base64url");
  const ct = Buffer.from(envelope.ct, "base64url");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");

  // Re-encrypt with current key
  const newKey = getKey();
  const newIv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", newKey, newIv);
  const newCt = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const newTag = cipher.getAuthTag();

  return (
    ENC_PREFIX +
    JSON.stringify({
      v: ENVELOPE_VERSION,
      iv: newIv.toString("base64url"),
      tag: newTag.toString("base64url"),
      ct: newCt.toString("base64url"),
    })
  );
}

// ─── Diagnostic (non-destructive) ─────────────────────────────────────────────

/**
 * Returns the SHA-256 fingerprint of the active key (for verification, not the key itself).
 * Safe to log or display in health checks.
 */
export function getKeyFingerprint() {
  const key = getKey();
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}
