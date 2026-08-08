/**
 * Supabase client factory — Embrace Health Grid
 *
 * Two distinct clients, deliberately separated:
 *
 *   getServiceClient()  → uses SUPABASE_SERVICE_ROLE_KEY.
 *                         BYPASSES ALL ROW LEVEL SECURITY.
 *                         Server-side only. Use for migrations, seeding, and
 *                         admin tasks that must not be subject to RLS.
 *
 *   getAnonClient()     → uses SUPABASE_ANON_KEY.
 *                         SUBJECT to RLS, exactly like the browser is.
 *                         Use this in tests to prove RLS policies actually work.
 *
 * Why both: code that only ever runs as service_role will appear to work while
 * being completely broken for real users, because RLS is never exercised.
 * Verifying with the anon client is what surfaces missing policies early.
 *
 * Env is loaded by the caller (node --env-file=.env) so this module stays
 * side-effect free and testable.
 */

import { createClient } from "@supabase/supabase-js";

/** Read a required env var, failing loudly rather than connecting to the wrong place. */
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `Ensure backend/.env exists and the process was started with --env-file=.env`,
    );
  }
  return value;
}

/**
 * Decode the project ref embedded in a Supabase JWT without verifying it.
 * Used only as a safety check that a key belongs to the expected project —
 * never for authentication decisions.
 */
function projectRefFromKey(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return payload.ref ?? null;
  } catch {
    return null;
  }
}

/**
 * Guard against pointing a key at the wrong project — the failure mode where
 * schema changes or writes silently land in someone else's database.
 */
function assertKeyMatchesProject(keyName, jwt) {
  const url = requireEnv("SUPABASE_URL");
  const urlRef = new URL(url).hostname.split(".")[0];
  const keyRef = projectRefFromKey(jwt);

  if (keyRef && keyRef !== urlRef) {
    throw new Error(
      `${keyName} belongs to project "${keyRef}" but SUPABASE_URL points at "${urlRef}". ` +
        `Refusing to connect to avoid operating on the wrong database.`,
    );
  }
  return urlRef;
}

let _serviceClient = null;
let _anonClient = null;

/**
 * Service-role client. Bypasses RLS — never expose to a browser.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getServiceClient() {
  if (_serviceClient) return _serviceClient;

  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  assertKeyMatchesProject("SUPABASE_SERVICE_ROLE_KEY", key);

  _serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _serviceClient;
}

/**
 * Anonymous client. Subject to RLS, mirroring browser behaviour.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getAnonClient() {
  if (_anonClient) return _anonClient;

  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_ANON_KEY");
  assertKeyMatchesProject("SUPABASE_ANON_KEY", key);

  _anonClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _anonClient;
}

/** Non-sensitive connection summary, safe to log. Never returns key material. */
export function describeConnection() {
  const url = process.env.SUPABASE_URL ?? "<unset>";
  const ref = url === "<unset>" ? "<unset>" : new URL(url).hostname.split(".")[0];
  return {
    url,
    projectRef: ref,
    anonKeyPresent: Boolean(process.env.SUPABASE_ANON_KEY),
    serviceKeyPresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}
