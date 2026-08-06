/**
 * Supabase browser client — Embrace Health Grid
 *
 * NO localStorage. NO sessionStorage. NO JS-readable session cookie.
 *
 * Why this file looks unusual
 * ---------------------------
 * @supabase/ssr's createBrowserClient writes the session to document.cookie so
 * the client can rehydrate it. That cookie is readable by JavaScript, which
 * defeats the purpose of httpOnly — verification caught exactly this: the full
 * access token was sitting in document.cookie.
 *
 * Instead this client is given explicit no-op cookie handlers and
 * persistSession: false, so it never stores a session anywhere on the client.
 * The httpOnly cookies set by the server (supabase.server.ts) are the only
 * session store, and they travel automatically on every request.
 *
 * Consequence, deliberately accepted: this client is NOT authenticated on its
 * own. Any query that must run as the signed-in user goes through a server
 * function. Use this client only for:
 *   - Realtime subscriptions to non-PHI tables
 *   - reads of data whose RLS policy permits the anon role
 *
 * That is the correct trade for healthcare data: an XSS payload cannot steal a
 * session it cannot read.
 */

import { createBrowserClient } from "@supabase/ssr";

/**
 * Trimmed deliberately.
 *
 * A trailing newline in the deployment's environment variable made every
 * Realtime WebSocket fail: the key is sent as a query parameter, the newline
 * became "%0A", and the server rejected the connection before the handshake.
 * REST calls tolerated it because the header was trimmed in transit, so the app
 * looked healthy while live updates silently never arrived.
 *
 * Trimming here rather than only fixing the dashboard value: an invisible
 * character in a config field should not be able to break a subsystem.
 */
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string)?.trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string)?.trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Add them to .env — the anon key is safe to expose only because RLS is enforced.",
  );
}

let _client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Singleton browser client that stores nothing.
 *
 * The cookie handlers are intentionally inert: getAll returns no cookies and
 * setAll discards writes, so no token material is ever placed where JS (or an
 * XSS payload) can read it.
 */
export function getSupabaseBrowserClient() {
  if (_client) return _client;

  _client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      // Never surface the httpOnly session to client-side JS.
      getAll() {
        return [];
      },
      // Never persist a JS-readable copy of the session.
      setAll() {
        /* intentionally empty */
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false, // refresh is the server's job, via httpOnly cookies
      detectSessionInUrl: false,
    },
  });

  return _client;
}
