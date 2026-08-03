/**
 * Supabase server client — Embrace Health Grid
 *
 * Runs only on the server (SSR / server functions). Reads and writes the
 * session as **httpOnly** cookies, which is what keeps the access token out of
 * reach of client-side JavaScript.
 *
 * Cookie flags and why each matters:
 *   httpOnly  — JS cannot read it, so XSS cannot steal the session
 *   secure    — HTTPS only (relaxed on localhost for development)
 *   sameSite  — 'lax' blocks cross-site CSRF while allowing normal navigation
 *   path      — '/' so the whole app shares one session
 *
 * This module must never be imported from client code. It uses the anon key
 * (not service_role), so RLS still applies to every query — the server acts on
 * behalf of the signed-in user, not as an omnipotent admin.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getCookies, setCookie, getRequest } from "@tanstack/react-start/server";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

/** Baseline cookie attributes applied to every auth cookie we set. */
function baseCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true, // the whole point: not readable by JavaScript
    secure: isProd, // allow plain HTTP on localhost during development
    sameSite: "lax",
    path: "/",
  };
}

/**
 * Server-side Supabase client bound to the current request's cookies.
 * Session reads and refreshes flow through httpOnly cookies transparently.
 */
export function getSupabaseServerClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase env vars on the server. Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        const cookies = getCookies();
        return Object.entries(cookies).map(([name, value]) => ({
          name,
          value: String(value ?? ""),
        }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          // Spread the library's options FIRST, then our security flags, so
          // httpOnly/secure/sameSite cannot be downgraded by the caller.
          setCookie(name, value, { ...options, ...baseCookieOptions() });
        }
      },
    },
  });
}

/**
 * Current authenticated user, verified against Supabase Auth.
 *
 * Uses getUser() rather than getSession(): getSession only decodes whatever
 * token is present, whereas getUser validates it server-side. For an
 * authorization decision, only the verified result is trustworthy.
 */
export async function getVerifiedUser() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

/** Expose the raw request when a caller needs headers (rate limiting, logging). */
export function getCurrentRequest() {
  return getRequest();
}
