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
// Storage helpers
// ---------------------------------------------------------------------------
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

function saveNamespace(namespace, data) {
  const path = dbPath(namespace);
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
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
  if (data) saveNamespace(namespace, data);
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
  "feedback"
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

export { randomUUID as generateId };
