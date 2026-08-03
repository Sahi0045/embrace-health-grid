/**
 * Supabase connectivity check — read-only, creates and modifies nothing.
 *
 * Verifies:
 *   1. Env vars are present and loadable
 *   2. Both keys belong to the project in SUPABASE_URL
 *   3. The REST endpoint is reachable and authenticates each key
 *
 * Run: npm run supabase:check
 */

import { getServiceClient, getAnonClient, describeConnection } from "../lib/supabase.js";

const conn = describeConnection();

console.log("Supabase connection target");
console.log("  URL          :", conn.url);
console.log("  Project ref  :", conn.projectRef);
console.log("  anon key     :", conn.anonKeyPresent ? "present" : "MISSING");
console.log("  service key  :", conn.serviceKeyPresent ? "present" : "MISSING");
console.log("");

if (!conn.anonKeyPresent || !conn.serviceKeyPresent) {
  console.error("FAIL: keys missing. Expected backend/.env loaded via --env-file=.env");
  process.exit(1);
}

/**
 * Probe a client by querying a table that does not exist.
 *
 * A reachable, authenticated project replies with PostgREST error PGRST205
 * ("could not find the table"), which confirms the round trip worked.
 * An auth failure surfaces as 401/invalid-key instead, which is what we
 * actually want to detect here.
 */
async function probe(label, client) {
  const { error } = await client.from("__connectivity_probe__").select("*").limit(1);

  if (!error) {
    // Unexpected, but still proves connectivity.
    console.log(`  ${label}: reachable (probe table unexpectedly exists)`);
    return true;
  }

  const msg = error.message ?? "";
  const code = error.code ?? "";

  // Missing table => reached PostgREST and authenticated successfully.
  if (code === "PGRST205" || /could not find the table|does not exist/i.test(msg)) {
    console.log(`  ${label}: reachable, key accepted`);
    return true;
  }

  if (/JWT|api key|unauthorized/i.test(msg)) {
    console.error(`  ${label}: KEY REJECTED — ${msg}`);
    return false;
  }

  console.error(`  ${label}: unexpected error [${code}] ${msg}`);
  return false;
}

console.log("Probing endpoints");

let ok = true;
try {
  ok = (await probe("service_role", getServiceClient())) && ok;
  ok = (await probe("anon        ", getAnonClient())) && ok;
} catch (err) {
  console.error("\nFAIL:", err.message);
  process.exit(1);
}

console.log("");
if (ok) {
  console.log("PASS: Supabase reachable and both keys valid for project", conn.projectRef);
  console.log("Note: no tables were created or modified.");
} else {
  console.error("FAIL: see errors above");
  process.exit(1);
}
