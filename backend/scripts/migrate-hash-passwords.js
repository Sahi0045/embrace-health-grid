#!/usr/bin/env node
/**
 * Password Migration Script — Embrace Health Grid
 *
 * Migrates plaintext passwords stored in backend/data/users.json to
 * bcrypt hashes (cost factor 12). This is a one-time operation.
 *
 * SAFETY:
 *   - Creates a backup before modifying any data
 *   - Skips users that already have bcrypt hashes
 *   - Dry-run mode available via --dry-run flag
 *
 * Usage:
 *   cd backend
 *   node scripts/migrate-hash-passwords.js
 *   node scripts/migrate-hash-passwords.js --dry-run
 *
 * After running, users with migrated passwords must log in with their
 * original password — the hash is transparent to the auth system.
 * Users with plaintext passwords like "Sahi@0045" are a HIPAA violation;
 * this script fixes them immediately.
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, "..", "data");
const USERS_FILE = join(DATA_DIR, "users.json");

const DRY_RUN = process.argv.includes("--dry-run");

// bcrypt is already a dependency of the backend
let bcrypt;
try {
  bcrypt = (await import("bcryptjs")).default;
} catch {
  try {
    bcrypt = await import("bcrypt");
  } catch {
    console.error("❌  Neither bcryptjs nor bcrypt is installed. Run: npm install bcryptjs");
    process.exit(1);
  }
}

const BCRYPT_COST = 12; // Higher than the default 10 — slower but more secure

console.log(`
╔════════════════════════════════════════════════════════════╗
║  Password Hash Migration — Embrace Health Grid             ║
║  Algorithm : bcrypt (cost=${BCRYPT_COST})                            ║
╚════════════════════════════════════════════════════════════╝
  Data file : ${USERS_FILE}
  Mode      : ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE MIGRATION"}
`);

if (!existsSync(USERS_FILE)) {
  console.log("  ℹ️  users.json not found — nothing to migrate.");
  process.exit(0);
}

// Step 1: Backup
const BACKUP = USERS_FILE.replace(".json", `.backup-${Date.now()}.json`);
if (!DRY_RUN) {
  copyFileSync(USERS_FILE, BACKUP);
  console.log(`  📁 Backup: ${BACKUP}\n`);
}

// Step 2: Load and process
const data = JSON.parse(readFileSync(USERS_FILE, "utf8"));
let migrated = 0;
let skipped  = 0;

for (const [email, entry] of Object.entries(data)) {
  const { password } = entry.value || {};

  if (!password) {
    console.log(`  ⬜ [${email}]  No password field — skipped`);
    skipped++;
    continue;
  }

  // Check if already bcrypt hash
  const isBcrypt =
    password.startsWith("$2a$") ||
    password.startsWith("$2b$") ||
    password.startsWith("$2y$");

  if (isBcrypt) {
    console.log(`  ✓  [${email}]  Already hashed — skipped`);
    skipped++;
    continue;
  }

  // Hash the plaintext password
  if (!DRY_RUN) {
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    data[email].value.password = hash;
  }

  // Generate a safe fingerprint for logging (never log the password itself)
  const fp = createHash("sha256").update(password).digest("hex").slice(0, 8);
  console.log(`  ✅ [${email}]  Hashed (sha256_prefix=${fp})`);
  migrated++;
}

// Step 3: Write
if (!DRY_RUN && migrated > 0) {
  writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), "utf8");
}

console.log(`
─────────────────────────────────────────────────────────────
  Migrated : ${migrated}
  Skipped  : ${skipped}
  Mode     : ${DRY_RUN ? "DRY RUN — no files changed" : migrated > 0 ? "COMPLETE" : "Nothing to do"}
─────────────────────────────────────────────────────────────
`);

if (!DRY_RUN && migrated > 0) {
  console.log("  ✅ Password migration complete.");
  console.log("  ⚠️  IMPORTANT: Rotate any compromised credentials immediately.\n");
}
