/**
 * World State Database — File-Persisted Key-Value Store
 *
 * Standard key-value database for data persistence.
 * Data is persisted to JSON files on disk, surviving server restarts.
 *
 * Namespaces:
 *   - did-registry     → DID documents
 *   - consent-manager  → Patient consent grants
 *   - billing          → Payment records & invoices
 *   - tracker          → Staff telemetry
 *   - appointments     → Appointment bookings
 *   - audit            → Audit log events
 *   - financial        → Financial statements
 *   - medical-records  → Patient medical records
 *   - prescriptions    → Prescription data
 *   - lab-results      → Lab test results
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { ConvexHttpClient } from "convex/browser";
import {
  encryptValue,
  decryptValue,
  isPHINamespace,
  getKeyFingerprint,
} from "./lib/phi-encrypt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Log encryption key fingerprint on startup (safe — not the key itself)
try {
  const fp = getKeyFingerprint();
  console.log(`🔐 PHI Encryption active. Key fingerprint: ${fp} (AES-256-GCM)`);
} catch (e) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: PHI encryption key unavailable.", e.message);
    process.exit(1);
  } else {
    console.warn("⚠️ PHI encryption key not configured — using dev fallback.", e.message);
  }
}

// Manual basic .env loader to read from workspace root
function loadEnv() {
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf8");
      content.split("\n").forEach((line) => {
        const parts = line.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts
            .slice(1)
            .join("=")
            .trim()
            .replace(/^['"]|['"]$/g, "");
          process.env[key] = val;
        }
      });
    } catch (e) {
      // Quiet fail
    }
  }
}
loadEnv();

// Initialize Convex Client for World State
const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
let convexClient = null;
if (convexUrl && convexUrl !== "https://dummy-url.convex.cloud") {
  try {
    convexClient = new ConvexHttpClient(convexUrl);
    console.log(`📡 World State DB: Convex Client initialized at: ${convexUrl}`);
  } catch (err) {
    console.error("⚠️ World State DB: Failed to connect Convex Client:", err.message);
  }
}

// ---------------------------------------------------------------------------
// Concurrent-Write Safety & Atomic File Storage Helpers
// ---------------------------------------------------------------------------
import { unlinkSync, renameSync, openSync, fsyncSync, closeSync } from "fs";

/** Lock queues per namespace to serialize writes and avoid race conditions */
const _namespaceLocks = new Map();

function getNamespaceLock(namespace) {
  if (!_namespaceLocks.has(namespace)) {
    _namespaceLocks.set(namespace, Promise.resolve());
  }
  return _namespaceLocks.get(namespace);
}

function dbPath(namespace) {
  return join(DATA_DIR, `${namespace.replace(/[^a-zA-Z0-9-_]/g, "_")}.json`);
}

function loadNamespace(namespace) {
  const path = dbPath(namespace);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Atomic File Write with fsync + atomic rename (Crash & Corruption Resistant)
 */
function saveNamespaceAtomic(namespace, data) {
  const path = dbPath(namespace);
  const tempPath = `${path}.tmp.${randomUUID()}`;
  try {
    const serialized = JSON.stringify(data, null, 2);
    // 1. Write to temporary file
    const fd = openSync(tempPath, "w");
    writeFileSync(fd, serialized, "utf8");
    fsyncSync(fd);
    closeSync(fd);

    // 2. Atomic rename replaces target file cleanly
    renameSync(tempPath, path);
  } catch (err) {
    if (existsSync(tempPath)) {
      try {
        unlinkSync(tempPath);
      } catch {}
    }
    throw new Error(`Failed atomic disk write for namespace [${namespace}]: ${err.message}`);
  }
}

// In-memory cache (write-through)
const _cache = new Map();

function getNamespaceCache(namespace) {
  if (!_cache.has(namespace)) {
    _cache.set(namespace, loadNamespace(namespace));
  }
  return _cache.get(namespace);
}

function flushNamespace(namespace) {
  const data = _cache.get(namespace);
  if (data) {
    // Chain onto namespace queue for serialized write-safety
    const lock = getNamespaceLock(namespace);
    const nextLock = lock
      .then(() => saveNamespaceAtomic(namespace, data))
      .catch((err) => {
        console.error(`⚠️ Async write error on namespace [${namespace}]:`, err.message);
      });
    _namespaceLocks.set(namespace, nextLock);
  }
}

// ---------------------------------------------------------------------------
// Transaction (ACID) Support
// ---------------------------------------------------------------------------

const _activeTransactions = new Map();

/**
 * Begin a multi-operation database transaction
 */
export function beginTransaction() {
  const txId = `tx_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const tx = {
    txId,
    createdAt: new Date().toISOString(),
    stagedWrites: new Map(), // namespace -> Map(key -> entry)
    stagedDeletes: new Set(), // `${namespace}:${key}`
    status: "active",
  };
  _activeTransactions.set(txId, tx);
  return tx;
}

/**
 * Stage a putState inside a transaction without committing to disk/cache yet
 */
export function stagePutState(tx, namespace, key, value, version = "1") {
  if (!tx || tx.status !== "active") throw new Error("Transaction is not active");
  const storedValue = isPHINamespace(namespace) ? encryptValue(value) : value;

  const entry = {
    key,
    value: storedValue,
    plainValue: value,
    namespace,
    version: `${tx.txId}:${version}`,
    updatedAt: new Date().toISOString(),
    txId: tx.txId,
    docType: namespace,
  };

  if (!tx.stagedWrites.has(namespace)) {
    tx.stagedWrites.set(namespace, new Map());
  }
  tx.stagedWrites.get(namespace).set(key, entry);
  tx.stagedDeletes.delete(`${namespace}:${key}`);
}

/**
 * Commit a transaction atomically across all affected namespaces
 */
export function commitTransaction(tx) {
  if (!tx || tx.status !== "active")
    throw new Error("Transaction is not active or already finished");

  const affectedNamespaces = new Set();

  // Apply staged writes
  for (const [namespace, stagedMap] of tx.stagedWrites) {
    affectedNamespaces.add(namespace);
    const nsCache = getNamespaceCache(namespace);
    for (const [key, entry] of stagedMap) {
      const { plainValue, ...dbEntry } = entry;
      nsCache[key] = dbEntry;

      if (convexClient) {
        convexClient
          .mutation("records:putGenericWorldState", {
            namespace,
            key,
            value: plainValue,
            txId: tx.txId,
            version: dbEntry.version,
            updatedAt: dbEntry.updatedAt,
          })
          .catch(() => {});
      }
    }
  }

  // Apply staged deletes
  for (const target of tx.stagedDeletes) {
    const [namespace, key] = target.split(":");
    affectedNamespaces.add(namespace);
    const nsCache = getNamespaceCache(namespace);
    if (nsCache[key]) {
      nsCache[key].value._deleted = true;
      nsCache[key].value._deletedAt = new Date().toISOString();
    }
  }

  // Flush all affected namespaces atomically to disk
  for (const ns of affectedNamespaces) {
    flushNamespace(ns);
  }

  tx.status = "committed";
  _activeTransactions.delete(tx.txId);
  return { success: true, txId: tx.txId, affectedNamespaces: Array.from(affectedNamespaces) };
}

/**
 * Rollback a transaction, discarding all staged modifications
 */
export function rollbackTransaction(tx) {
  if (!tx) return;
  tx.status = "rolled_back";
  tx.stagedWrites.clear();
  tx.stagedDeletes.clear();
  _activeTransactions.delete(tx.txId);
  return { success: true, txId: tx.txId };
}

// ---------------------------------------------------------------------------
// World State API
// ---------------------------------------------------------------------------

const ALL_NAMESPACES = [
  "did-registry",
  "consent-manager",
  "billing",
  "tracker",
  "appointments",
  "audit",
  "financial",
  "medical-records",
  "medical-records-anchor",
  "consent-requests",
  "nfc-cards",
  "ambulances",
  "insurance-claims",
  "vaccines",
  "visitors",
  "attendance",
  "users",
  "beds",
  "prescriptions",
  "lab-results",
  "fraud-alerts",
  "equipment",
  "zkproofs",
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
];

// 🔄 Synchronously initialize/replicate from Convex database on boot
export async function bootstrapFromConvex() {
  if (!convexClient) return;
  console.log("🔄 Replicating World State from Convex to local cache...");
  const namespaces = ALL_NAMESPACES;
  for (const ns of namespaces) {
    try {
      const list = await convexClient.query("records:getAllGenericWorldState", { namespace: ns });
      if (list && list.length > 0) {
        const cache = getNamespaceCache(ns);
        list.forEach((res) => {
          cache[res.key] = {
            key: res.key,
            value: res.value,
            namespace: res.namespace,
            version: res.version,
            updatedAt: res.updatedAt,
            txId: res.txId,
            docType: res.namespace,
          };
        });
        flushNamespace(ns);
      }
    } catch (err) {
      console.warn(`⚠️ Replication failed for namespace [${ns}]:`, err.message);
    }
  }
  console.log("✅ World State replication from Convex complete!");
}

/**
 * Put a key-value pair into the world state
 */
export function putState(namespace, key, value, txId, version = "1") {
  const ns = getNamespaceCache(namespace);

  // Encrypt PHI before writing to disk
  const storedValue = isPHINamespace(namespace) ? encryptValue(value) : value;

  const entry = {
    key,
    value: storedValue,
    namespace,
    version: `${txId}:${version}`,
    updatedAt: new Date().toISOString(),
    txId,
    docType: namespace,
  };
  ns[key] = entry;
  flushNamespace(namespace);

  if (convexClient) {
    // Send plaintext value to Convex (Convex has its own encryption at rest)
    convexClient
      .mutation("records:putGenericWorldState", {
        namespace,
        key,
        value,
        txId,
        version: `${txId}:${version}`,
        updatedAt: entry.updatedAt,
      })
      .catch((err) => {
        console.error(`⚠️ Convex background putState error [${namespace}:${key}]:`, err.message);
      });
  }

  // Return entry with DECRYPTED value so callers work with plain objects
  return { ...entry, value };
}

/**
 * Get a value by key from the world state
 */
export function getState(namespace, key) {
  const ns = getNamespaceCache(namespace);
  const entry = ns[key] ?? null;
  if (!entry) return null;
  // Transparently decrypt PHI values on read
  if (isPHINamespace(namespace)) {
    return { ...entry, value: decryptValue(entry.value) };
  }
  return entry;
}

/**
 * Delete a key from the world state
 */
export function deleteState(namespace, key) {
  const ns = getNamespaceCache(namespace);
  if (ns[key]) {
    ns[key].value._deleted = true;
    ns[key].value._deletedAt = new Date().toISOString();
    flushNamespace(namespace);

    if (convexClient) {
      convexClient.mutation("records:deleteGenericWorldState", { namespace, key }).catch((err) => {
        console.error(`⚠️ Convex background deleteState error [${namespace}:${key}]:`, err.message);
      });
    }
    return true;
  }
  return false;
}

/**
 * Get all entries from a namespace
 */
export function getAllState(namespace) {
  const ns = getNamespaceCache(namespace);
  return Object.values(ns)
    .filter((e) => !e.value?._deleted)
    .map((entry) => {
      if (!isPHINamespace(namespace)) return entry;
      try {
        const decrypted = decryptValue(entry.value);
        // Support legacy plaintext entries (migration) — _deleted flag check
        if (decrypted && decrypted._deleted) return null;
        return { ...entry, value: decrypted };
      } catch {
        // If decryption fails, skip the entry (corrupted or wrong key)
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Rich query across a namespace (CouchDB-style selector)
 */
export function queryState(namespace, predicate) {
  const ns = getNamespaceCache(namespace);
  return Object.values(ns)
    .map((entry) => {
      if (!isPHINamespace(namespace)) return entry;
      try {
        return { ...entry, value: decryptValue(entry.value) };
      } catch {
        return null;
      }
    })
    .filter((e) => e && !e.value?._deleted && predicate(e.value));
}

/**
 * Get history of a key (simulated — returns current + metadata)
 */
export function getStateHistory(namespace, key) {
  const entry = getState(namespace, key);
  if (!entry) return [];
  return [
    {
      txId: entry.txId,
      timestamp: entry.updatedAt,
      value: entry.value,
      isDelete: false,
    },
  ];
}

/**
 * Count total keys across all namespaces
 */
export function getWorldStateSize() {
  let total = 0;
  for (const [, ns] of _cache) {
    total += Object.keys(ns).length;
  }
  return total;
}

/**
 * Get all world state entries (for browser sync)
 */
export function getAllWorldState() {
  const result = {};
  const namespaces = ALL_NAMESPACES;
  for (const ns of namespaces) {
    const data = getNamespaceCache(ns);
    for (const [key, entry] of Object.entries(data)) {
      result[`${ns}:${key}`] = entry;
    }
  }
  return result;
}

/**
 * Flush all namespaces to disk
 */
export function flushAll() {
  for (const [namespace] of _cache) {
    flushNamespace(namespace);
  }
}

// ---------------------------------------------------------------------------
// Encrypted Backup & Verification Engine (§ 164.312(a)(2)(iv))
// ---------------------------------------------------------------------------
import { createHmac } from "crypto";

const BACKUP_HMAC_SECRET =
  process.env.AUDIT_HMAC_KEY || process.env.JWT_SECRET || "embrace-health-backup-hmac-key";

/**
 * Create a fully AES-256-GCM encrypted database backup archive
 */
export function createEncryptedBackup() {
  const backupId = `BKP-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8)}`;
  const timestamp = new Date().toISOString();
  const keyFingerprint = getKeyFingerprint();

  const archiveData = {};
  let totalRecords = 0;

  for (const ns of ALL_NAMESPACES) {
    const nsData = loadNamespace(ns);
    archiveData[ns] = nsData;
    totalRecords += Object.keys(nsData).length;
  }

  const rawPayload = JSON.stringify({
    backupId,
    timestamp,
    keyFingerprint,
    namespaces: archiveData,
  });

  // Encrypt entire database payload with AES-256-GCM envelope
  const encryptedPayload = encryptValue(rawPayload);
  const hmacDigest = createHmac("sha256", BACKUP_HMAC_SECRET)
    .update(encryptedPayload)
    .digest("hex");

  return {
    backupId,
    timestamp,
    keyFingerprint,
    totalRecords,
    totalNamespaces: ALL_NAMESPACES.length,
    encryptedPayload,
    hmacDigest,
  };
}

/**
 * Verify backup encryption integrity, key fingerprint, and 0-plaintext leakage
 */
export function verifyBackupEncryption(backupBundle) {
  if (!backupBundle || !backupBundle.encryptedPayload || !backupBundle.hmacDigest) {
    return { verified: false, error: "Invalid backup bundle format" };
  }

  // 1. Verify HMAC integrity
  const expectedHmac = createHmac("sha256", BACKUP_HMAC_SECRET)
    .update(backupBundle.encryptedPayload)
    .digest("hex");
  if (expectedHmac !== backupBundle.hmacDigest) {
    return {
      verified: false,
      error: "Backup HMAC integrity check failed — payload tampered or corrupted",
    };
  }

  // 2. Decrypt backup payload
  let payloadObj;
  try {
    const decryptedRaw = decryptValue(backupBundle.encryptedPayload);
    payloadObj = typeof decryptedRaw === "string" ? JSON.parse(decryptedRaw) : decryptedRaw;
  } catch (err) {
    return { verified: false, error: `Failed to decrypt backup with current key: ${err.message}` };
  }

  const { backupId, timestamp, keyFingerprint, namespaces = {} } = payloadObj;

  // 3. Scan 100% of PHI namespace entries for envelope encryption compliance
  let totalRecordsScanned = 0;
  let phiEncryptedRecordsCount = 0;
  let plaintextLeakageCount = 0;
  const leakedKeys = [];

  for (const [ns, nsData] of Object.entries(namespaces)) {
    const isPHI = isPHINamespace(ns);
    for (const [key, entry] of Object.entries(nsData)) {
      totalRecordsScanned++;
      if (isPHI) {
        if (typeof entry.value === "string" && entry.value.startsWith("__phi_enc__:")) {
          phiEncryptedRecordsCount++;
        } else {
          plaintextLeakageCount++;
          leakedKeys.push(`${ns}:${key}`);
        }
      }
    }
  }

  const activeKeyFingerprint = getKeyFingerprint();

  return {
    verified: plaintextLeakageCount === 0,
    backupId,
    timestamp,
    backupKeyFingerprint: keyFingerprint,
    activeKeyFingerprint,
    keyMatch: keyFingerprint === activeKeyFingerprint,
    totalNamespaces: Object.keys(namespaces).length,
    totalRecordsScanned,
    phiEncryptedRecordsCount,
    plaintextLeakageCount,
    leakedKeys,
    complianceStatus:
      plaintextLeakageCount === 0
        ? "PASSED_100_PERCENT_ENCRYPTED"
        : "FAILED_PLAINTEXT_LEAKAGE_DETECTED",
  };
}

export { randomUUID as generateId };
