#!/usr/bin/env node
/**
 * JSON to SQLite Data Migration Script — Embrace Health Grid
 *
 * Migrates all existing JSON namespace files in backend/data/*.json to SQLite database (world-state.db).
 */

import { readFileSync, existsSync, readdirSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DB_PATH = join(DATA_DIR, "world-state.db");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

console.log("🚀 Initializing SQLite database at:", DB_PATH);
const db = new Database(DB_PATH);

// Enable WAL mode for performance & concurrent safety
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

const upsertStmt = db.prepare(`
  INSERT INTO world_state (namespace, key, value, version, updated_at, tx_id, doc_type)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(namespace, key) DO UPDATE SET
    value = excluded.value,
    version = excluded.version,
    updated_at = excluded.updated_at,
    tx_id = excluded.tx_id,
    doc_type = excluded.doc_type
`);

const files = readdirSync(DATA_DIR).filter(
  (f) => f.endsWith(".json") && !f.includes(".backup-") && !f.startsWith(".")
);

console.log(`📦 Found ${files.length} JSON data files to migrate.`);

let totalRecordsMigrated = 0;
const summary = [];

const migrateAll = db.transaction(() => {
  for (const file of files) {
    const namespace = file.replace(/\.json$/, "");
    const filePath = join(DATA_DIR, file);
    try {
      const content = readFileSync(filePath, "utf8");
      if (!content.trim()) continue;
      const parsed = JSON.parse(content);
      if (typeof parsed !== "object" || parsed === null) continue;

      let count = 0;
      for (const [key, entry] of Object.entries(parsed)) {
        if (!entry || typeof entry !== "object") continue;
        const storedKey = entry.key || key;
        const rawValue = entry.value !== undefined ? entry.value : entry;
        const storedValue = typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue);
        const version = entry.version || "1";
        const updatedAt = entry.updatedAt || new Date().toISOString();
        const txId = entry.txId || null;
        const docType = entry.docType || namespace;

        upsertStmt.run(namespace, storedKey, storedValue, version, updatedAt, txId, docType);
        count++;
      }
      totalRecordsMigrated += count;
      summary.push({ namespace, records: count });
    } catch (err) {
      console.warn(`⚠️ Error reading/migrating ${file}:`, err.message);
    }
  }
});

migrateAll();

console.log("\n✅ Migration complete!");
console.table(summary);
console.log(`🎉 Total records migrated into SQLite: ${totalRecordsMigrated}`);

db.close();
