#!/usr/bin/env node
/**
 * PHI Encryption Migration Script — Embrace Health Grid
 *
 * Migrates all existing plaintext JSON files in backend/data/ to AES-256-GCM
 * encrypted format. Run this ONCE after deploying the encryption feature.
 *
 * SAFETY:
 *   - Creates backups in backend/data/backup-<timestamp>/ before migrating
 *   - Skips entries that are already encrypted
 *   - Reports a migration summary per namespace
 *   - Non-PHI namespaces are skipped (plaintext is intentional)
 *   - Dry-run mode: pass --dry-run to preview without writing
 *
 * Usage:
 *   cd backend
 *   node scripts/migrate-encrypt-phi.js
 *   node scripts/migrate-encrypt-phi.js --dry-run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

// Load .env before importing encryption module
const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const parts = line.split("=");
      if (parts.length >= 2 && !line.trim().startsWith("#")) {
        const key = parts[0].trim();
        const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    });
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, "..", "data");

// Import after env is loaded
const { encryptValue, decryptValue, isPHINamespace, isEncrypted, getKeyFingerprint } =
  await import("../lib/phi-encrypt.js");

const DRY_RUN = process.argv.includes("--dry-run");

console.log(`
╔════════════════════════════════════════════════════════════╗
║  PHI Encryption Migration — Embrace Health Grid            ║
║  Algorithm: AES-256-GCM  |  HIPAA § 164.312(a)(2)(iv)   ║
╚════════════════════════════════════════════════════════════╝

  Key fingerprint : ${getKeyFingerprint()}
  Data directory  : ${DATA_DIR}
  Mode            : ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE MIGRATION"}
`);

// ─── Step 1: Backup ───────────────────────────────────────────────────────────
if (!DRY_RUN) {
  const backupDir = join(DATA_DIR, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  mkdirSync(backupDir, { recursive: true });
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    copyFileSync(join(DATA_DIR, f), join(backupDir, f));
  }
  console.log(`  📁 Backup created: ${backupDir}\n`);
}

// ─── Step 2: Migrate each namespace file ──────────────────────────────────────
const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("backup-"));

let totalMigrated = 0;
let totalSkipped  = 0;
let totalErrors   = 0;

for (const file of files) {
  const namespace = basename(file, ".json");

  if (!isPHINamespace(namespace)) {
    console.log(`  ⬜ [${namespace}]  SKIPPED — non-PHI namespace`);
    continue;
  }

  const filePath = join(DATA_DIR, file);
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    console.error(`  ❌ [${namespace}]  Failed to parse JSON — skipping`);
    totalErrors++;
    continue;
  }

  let migrated = 0;
  let alreadyEncrypted = 0;
  let errors = 0;

  for (const [key, entry] of Object.entries(data)) {
    if (typeof entry !== "object" || !entry.value) continue;

    const FORCE = process.argv.includes("--force");
    if (isEncrypted(entry.value) && !FORCE) {
      // Test if current key can decrypt it
      try {
        decryptValue(entry.value);
        alreadyEncrypted++;
        continue;
      } catch {
        // Current key cannot decrypt it — needs re-encryption!
      }
    }

    try {
      if (!DRY_RUN) {
        // If it was encrypted with an old key and we have plain object fallback, encrypt plaintext value
        let valToEncrypt = entry.value;
        if (isEncrypted(valToEncrypt)) {
          try {
            valToEncrypt = decryptValue(valToEncrypt);
          } catch {
            console.error(`    ⚠️  [${namespace}:${key}] Cannot decrypt with current key — skipping`);
            errors++;
            continue;
          }
        }
        data[key].value = encryptValue(valToEncrypt);
      }
      migrated++;
    } catch (err) {
      console.error(`    ⚠️  [${namespace}:${key}] Encryption failed: ${err.message}`);
      errors++;
    }
  }


  if (!DRY_RUN && migrated > 0) {
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  }

  const status = errors > 0 ? "❌" : migrated > 0 ? "✅" : "✓ ";
  console.log(
    `  ${status} [${namespace}]  encrypted=${migrated}  already_encrypted=${alreadyEncrypted}  errors=${errors}`,
  );

  totalMigrated += migrated;
  totalSkipped  += alreadyEncrypted;
  totalErrors   += errors;
}

console.log(`
─────────────────────────────────────────────────────────────
  Total entries encrypted : ${totalMigrated}
  Already encrypted       : ${totalSkipped}
  Errors                  : ${totalErrors}
  Mode                    : ${DRY_RUN ? "DRY RUN — no files changed" : "COMPLETE"}
─────────────────────────────────────────────────────────────
`);

if (totalErrors > 0) {
  console.error("  ⚠️  Some entries failed to encrypt. Review errors above.");
  process.exit(1);
}

if (!DRY_RUN) {
  console.log("  ✅ Migration complete. PHI data is now encrypted at rest.");
  console.log("  📁 Original files backed up. Delete backup after verifying the app works.\n");
} else {
  console.log("  ℹ️  Dry run complete. Run without --dry-run to apply changes.\n");
}
