#!/usr/bin/env node
/**
 * Hash all plaintext passwords in users.json
 * Usage: node fabric-backend/scripts/hash-passwords.js
 */
import bcrypt from "bcryptjs";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const usersPath = join(__dirname, "../data/users.json");

if (!existsSync(usersPath)) {
  console.log("No users.json found — skipping");
  process.exit(0);
}

const data = JSON.parse(readFileSync(usersPath, "utf8"));
let updated = 0;

for (const key of Object.keys(data)) {
  const entry = data[key];
  const pwd = entry?.value?.password;
  if (!pwd) continue;
  const isHash =
    pwd.startsWith("$2a$") || pwd.startsWith("$2b$") || pwd.startsWith("$2y$");
  if (!isHash) {
    entry.value.password = bcrypt.hashSync(pwd, 10);
    updated++;
  }
}

writeFileSync(usersPath, JSON.stringify(data, null, 2));
console.log(`Hashed ${updated} password(s) in users.json`);
