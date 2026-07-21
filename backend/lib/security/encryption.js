/**
 * HIPAA-Compliant Data Encryption Module
 * Implements AES-256-GCM encryption for PHI (Protected Health Information)
 * Compliant with HIPAA Security Rule §164.312(a)(2)(iv) and §164.312(e)(2)(ii)
 */

import { randomBytes, createCipheriv, createDecipheriv, scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for GCM
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;
const SCRYPT_COST = 16384; // N parameter (CPU/memory cost)

/**
 * Get or generate master encryption key
 * In production, this should be stored in a secure key management service (AWS KMS, Azure Key Vault)
 */
function getMasterKey() {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: ENCRYPTION_MASTER_KEY not set in production");
    }
    console.warn("⚠️ Using development encryption key - NOT FOR PRODUCTION");
    return Buffer.from("dev-master-key-change-in-production-32bytes!!", "utf8");
  }
  return Buffer.from(key, "hex");
}

/**
 * Derive encryption key from master key and salt
 * Uses scrypt for key derivation (NIST approved)
 */
async function deriveKey(masterKey, salt) {
  return await scryptAsync(masterKey, salt, KEY_LENGTH, { N: SCRYPT_COST });
}

/**
 * Encrypt sensitive data (PHI)
 * Returns base64-encoded string with format: salt:iv:authTag:ciphertext
 *
 * @param {string|object} data - Data to encrypt (will be stringified if object)
 * @returns {Promise<string>} Encrypted data string
 */
export async function encryptPHI(data) {
  try {
    const plaintext = typeof data === "string" ? data : JSON.stringify(data);
    const masterKey = getMasterKey();

    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Derive encryption key
    const key = await deriveKey(masterKey, salt);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine: salt:iv:authTag:ciphertext (all hex encoded)
    const result = [
      salt.toString("hex"),
      iv.toString("hex"),
      authTag.toString("hex"),
      encrypted,
    ].join(":");

    return result;
  } catch (error) {
    console.error("Encryption failed:", error.message);
    throw new Error("Failed to encrypt sensitive data");
  }
}

/**
 * Decrypt sensitive data (PHI)
 *
 * @param {string} encryptedData - Encrypted data string (salt:iv:authTag:ciphertext)
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptPHI(encryptedData) {
  try {
    if (!encryptedData || typeof encryptedData !== "string") {
      throw new Error("Invalid encrypted data format");
    }

    // Parse encrypted data
    const parts = encryptedData.split(":");
    if (parts.length !== 4) {
      throw new Error("Invalid encrypted data structure");
    }

    const [saltHex, ivHex, authTagHex, ciphertext] = parts;
    const masterKey = getMasterKey();

    // Convert from hex
    const salt = Buffer.from(saltHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    // Derive decryption key
    const key = await deriveKey(masterKey, salt);

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error.message);
    throw new Error("Failed to decrypt sensitive data");
  }
}

/**
 * Encrypt specific fields in an object (selective encryption)
 * Useful for encrypting only PHI fields while keeping metadata readable
 *
 * @param {object} data - Object with data
 * @param {string[]} fieldsToEncrypt - Array of field names to encrypt
 * @returns {Promise<object>} Object with encrypted fields
 */
export async function encryptFields(data, fieldsToEncrypt = []) {
  const result = { ...data };

  for (const field of fieldsToEncrypt) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = await encryptPHI(result[field]);
      result[`${field}_encrypted`] = true; // Mark as encrypted
    }
  }

  return result;
}

/**
 * Decrypt specific fields in an object
 *
 * @param {object} data - Object with encrypted data
 * @param {string[]} fieldsToDecrypt - Array of field names to decrypt
 * @returns {Promise<object>} Object with decrypted fields
 */
export async function decryptFields(data, fieldsToDecrypt = []) {
  const result = { ...data };

  for (const field of fieldsToDecrypt) {
    if (result[field] && result[`${field}_encrypted`]) {
      try {
        const decrypted = await decryptPHI(result[field]);
        // Try to parse as JSON if possible
        try {
          result[field] = JSON.parse(decrypted);
        } catch {
          result[field] = decrypted;
        }
        delete result[`${field}_encrypted`];
      } catch (error) {
        console.error(`Failed to decrypt field ${field}:`, error.message);
        // Keep encrypted value
      }
    }
  }

  return result;
}

/**
 * Hash sensitive data for searching/indexing (one-way)
 * Uses SHA-256 with salt for consistent hashing
 */
export function hashForSearch(data, salt = "search-salt") {
  const crypto = require("crypto");
  return crypto
    .createHash("sha256")
    .update(data + salt)
    .digest("hex");
}

/**
 * Generate encryption key pair for asymmetric encryption
 * Used for secure data exchange between parties
 */
export function generateKeyPair() {
  const crypto = require("crypto");
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
}

/**
 * Validate encryption configuration on startup
 * HIPAA requires validation of security controls
 */
export function validateEncryptionConfig() {
  const issues = [];

  if (!process.env.ENCRYPTION_MASTER_KEY && process.env.NODE_ENV === "production") {
    issues.push("ENCRYPTION_MASTER_KEY not configured");
  }

  if (process.env.ENCRYPTION_MASTER_KEY) {
    const keyBuffer = Buffer.from(process.env.ENCRYPTION_MASTER_KEY, "hex");
    if (keyBuffer.length < KEY_LENGTH) {
      issues.push(`Encryption key too short (${keyBuffer.length} bytes, need ${KEY_LENGTH})`);
    }
  }

  if (issues.length > 0) {
    console.error("❌ Encryption configuration issues:", issues);
    return false;
  }

  console.log("✅ Encryption configuration validated");
  return true;
}
