/**
 * World State Database — SQLite Database Key-Value & Relational Storage
 *
 * Direct database storage engine backed by SQLite (better-sqlite3).
 * Data is persisted directly to SQLite database on disk (`backend/data/world-state.db`).
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

import { readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID, createHmac } from "crypto";
import Database from "better-sqlite3";
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

// Load .env BEFORE any encryption or DB init that depends on env vars
function loadEnv() {
  const envPaths = [
    join(process.cwd(), ".env"),
    join(process.cwd(), ".env.local"),
    join(process.cwd(), "..", ".env"),
    join(process.cwd(), "..", ".env.local"),
  ];
  envPaths.forEach((envPath) => {
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, "utf8");
        content.split("\n").forEach((line) => {
          if (line.trim().startsWith("#") || !line.includes("=")) return;
          const parts = line.split("=");
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts
              .slice(1)
              .join("=")
              .trim()
              .replace(/^['"]|['"]$/g, "");
            if (!process.env[key]) process.env[key] = val;
          }
        });
      } catch (e) {
        // Quiet fail
      }
    }
  });
}
loadEnv();

// ---------------------------------------------------------------------------
// SQLite Database Initialization
// ---------------------------------------------------------------------------
const DB_PATH = join(DATA_DIR, "world-state.db");
const db = new Database(DB_PATH);

// Enable WAL mode for optimum concurrency and performance
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS world_state (
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    version TEXT,
    updated_at TEXT,
    tx_id TEXT,
    doc_type TEXT,
    PRIMARY KEY (namespace, key)
  );

  CREATE INDEX IF NOT EXISTS idx_ws_namespace ON world_state(namespace);
  CREATE INDEX IF NOT EXISTS idx_ws_updated ON world_state(namespace, updated_at);
`);

// Prepared statements for zero-overhead performance
const stmtGetNamespace = db.prepare(`
  SELECT key, value, version, updated_at, tx_id, doc_type
  FROM world_state
  WHERE namespace = ?
`);

const stmtUpsertState = db.prepare(`
  INSERT INTO world_state (namespace, key, value, version, updated_at, tx_id, doc_type)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(namespace, key) DO UPDATE SET
    value = excluded.value,
    version = excluded.version,
    updated_at = excluded.updated_at,
    tx_id = excluded.tx_id,
    doc_type = excluded.doc_type
`);

const stmtCountTotal = db.prepare(`
  SELECT COUNT(*) as count FROM world_state
`);

const stmtGetAllRecords = db.prepare(`
  SELECT namespace, key, value, version, updated_at, tx_id, doc_type FROM world_state
`);

// Validate encryption key on startup
const hasExplicitKey = !!process.env.DATA_ENCRYPTION_KEY;
try {
  const fp = getKeyFingerprint();
  if (hasExplicitKey) {
    console.log(`🔐 PHI Encryption active. Key fingerprint: ${fp} (AES-256-GCM)`);
  } else if (process.env.NODE_ENV === "production") {
    console.error("FATAL: DATA_ENCRYPTION_KEY must be set in production.");
    console.error("Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    process.exit(1);
  } else {
    console.warn(`⚠️ PHI Encryption using DEV FALLBACK key (fingerprint: ${fp}). Set DATA_ENCRYPTION_KEY for production.`);
  }
} catch (e) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: PHI encryption key unavailable.", e.message);
    process.exit(1);
  } else {
    console.warn("⚠️ PHI encryption key not configured — using dev fallback.", e.message);
  }
}

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
// In-Memory Cache (Write-Through to SQLite)
// ---------------------------------------------------------------------------
const _cache = new Map();

function loadNamespaceFromDb(namespace) {
  const rows = stmtGetNamespace.all(namespace);
  const data = {};
  for (const row of rows) {
    let val = row.value;
    if (typeof val === "string" && !val.startsWith("__phi_enc__:")) {
      try {
        val = JSON.parse(val);
      } catch {}
    }
    data[row.key] = {
      key: row.key,
      value: val,
      namespace,
      version: row.version,
      updatedAt: row.updated_at,
      txId: row.tx_id,
      docType: row.doc_type || namespace,
    };
  }
  return data;
}

function getNamespaceCache(namespace) {
  if (!_cache.has(namespace)) {
    _cache.set(namespace, loadNamespaceFromDb(namespace));
  }
  return _cache.get(namespace);
}

function saveEntryToDb(namespace, key, entry) {
  const rawValue = entry.value;
  const dbValue = typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue);
  stmtUpsertState.run(
    namespace,
    key,
    dbValue,
    entry.version || "1",
    entry.updatedAt || new Date().toISOString(),
    entry.txId || null,
    entry.docType || namespace
  );
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
 * Stage a putState inside a transaction without committing yet
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
  tx.stagedDeletes.delete(`${namespace}\0${key}`);
}

/**
 * Commit a transaction atomically across all affected namespaces inside SQLite transaction
 */
export function commitTransaction(tx) {
  if (!tx || tx.status !== "active")
    throw new Error("Transaction is not active or already finished");

  const affectedNamespaces = new Set();

  const commitToDb = db.transaction(() => {
    // Apply staged writes
    for (const [namespace, stagedMap] of tx.stagedWrites) {
      affectedNamespaces.add(namespace);
      const nsCache = getNamespaceCache(namespace);
      for (const [key, entry] of stagedMap) {
        const { plainValue, ...dbEntry } = entry;
        nsCache[key] = dbEntry;
        saveEntryToDb(namespace, key, dbEntry);

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
      const sepIdx = target.indexOf("\0");
      const namespace = target.slice(0, sepIdx);
      const key = target.slice(sepIdx + 1);
      affectedNamespaces.add(namespace);
      const nsCache = getNamespaceCache(namespace);
      if (nsCache[key]) {
        let plainVal = nsCache[key].value;
        if (isPHINamespace(namespace)) {
          try {
            plainVal = decryptValue(nsCache[key].value);
          } catch {}
        }
        if (typeof plainVal === "object" && plainVal !== null) {
          plainVal._deleted = true;
          plainVal._deletedAt = new Date().toISOString();
        } else {
          plainVal = { _deleted: true, _deletedAt: new Date().toISOString() };
        }
        const storedValue = isPHINamespace(namespace) ? encryptValue(plainVal) : plainVal;
        nsCache[key].value = storedValue;
        saveEntryToDb(namespace, key, nsCache[key]);
      }
    }
  });

  commitToDb();

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
  "consent-requests",
  "billing",
  "tracker",
  "appointments",
  "audit",
  "financial",
  "medical-records",
  "medical-records-anchor",
  "nfc-cards",
  "ambulances",
  "insurance-claims",
  "insurance-policies",
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
  "notifications",
  "blockchain-tx",
  "credentials",
  "doctor-location-roots",
  "doctor-locations",
  "doctors",
  "governance-policies",
  "merkle-roots",
  "patient-preferences",
  "room-checkin",
  "room-checkin-history",
  "solana-anchors",
  "staff-schedule",
  "staff-requests",
  "surgeries",
];

// Synchronously initialize/replicate from Convex database on boot
export async function bootstrapFromConvex() {
  if (!convexClient) return;
  console.log("🔄 Replicating World State from Convex to local SQLite database...");
  const namespaces = ALL_NAMESPACES;
  for (const ns of namespaces) {
    try {
      const list = await convexClient.query("records:getAllGenericWorldState", { namespace: ns });
      if (list && list.length > 0) {
        const cache = getNamespaceCache(ns);
        for (const res of list) {
          const entry = {
            key: res.key,
            value: res.value,
            namespace: res.namespace,
            version: res.version,
            updatedAt: res.updatedAt,
            txId: res.txId,
            docType: res.namespace,
          };
          cache[res.key] = entry;
          saveEntryToDb(ns, res.key, entry);
        }
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

  // Encrypt PHI before writing to DB
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
  saveEntryToDb(namespace, key, entry);

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
    let plainVal = ns[key].value;
    if (isPHINamespace(namespace)) {
      try {
        plainVal = decryptValue(ns[key].value);
      } catch {}
    }
    if (typeof plainVal === "object" && plainVal !== null) {
      plainVal._deleted = true;
      plainVal._deletedAt = new Date().toISOString();
    } else {
      plainVal = { _deleted: true, _deletedAt: new Date().toISOString() };
    }
    const storedValue = isPHINamespace(namespace) ? encryptValue(plainVal) : plainVal;
    ns[key].value = storedValue;
    saveEntryToDb(namespace, key, ns[key]);

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
        if (decrypted && decrypted._deleted) return null;
        return { ...entry, value: decrypted };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Rich query across a namespace (predicate selector)
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
  const row = stmtCountTotal.get();
  return row ? row.count : 0;
}

/**
 * Get all world state entries (for browser sync)
 */
export function getAllWorldState() {
  const result = {};
  const rows = stmtGetAllRecords.all();
  for (const row of rows) {
    if (row.value && row.value.includes('"_deleted":true')) continue;
    let val = row.value;
    if (typeof val === "string" && !val.startsWith("__phi_enc__:")) {
      try {
        val = JSON.parse(val);
      } catch {}
    }
    result[`${row.namespace}:${row.key}`] = {
      key: row.key,
      value: val,
      namespace: row.namespace,
      version: row.version,
      updatedAt: row.updated_at,
      txId: row.tx_id,
      docType: row.doc_type || row.namespace,
    };
  }
  return result;
}

/**
 * Flush all (no-op as writes are committed immediately to SQLite)
 */
export function flushAll() {
  // SQLite writes are synchronous and immediate
}

// ---------------------------------------------------------------------------
// Encrypted Backup & Verification Engine (§ 164.312(a)(2)(iv))
// ---------------------------------------------------------------------------

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
    const nsData = loadNamespaceFromDb(ns);
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
