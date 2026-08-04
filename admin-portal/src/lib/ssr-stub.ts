/**
 * Stub for the main app's api.ts inside the admin portal bundle.
 *
 * api.ts delegates to TanStack Start server functions, which need an SSR runtime
 * this Vite SPA does not have. Rollup follows even dynamic imports, so the
 * module must be replaced at resolve time (see vite.config.ts).
 *
 * Only the few symbols shared components reference are provided. The admin
 * portal's own data access goes through ~/lib/admin-api, which queries Supabase
 * directly with RLS enforced.
 */

/** WebSocket URLs in shared components are built from this. */
export const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "http://localhost:3001";

/**
 * Reachability check. Reports false rather than pretending: the admin portal
 * talks to Supabase, not to the retired Express backend.
 */
export async function isBackendOnline(): Promise<boolean> {
  return false;
}

export function resetBackendCache(): void {
  /* nothing to reset */
}

/**
 * Auth stubs for shared components pulled into this bundle.
 *
 * The admin portal authenticates through ~/lib/supabase (adminSignIn /
 * adminCurrentUser), not through the main app's server functions. These exist
 * only so shared modules that reference them can be bundled; they report
 * "signed out" rather than pretending to have a session.
 */
export async function getCurrentUser(): Promise<null> {
  return null;
}

export async function signIn(): Promise<{ ok: false; error: string }> {
  return { ok: false, error: "Use adminSignIn from ~/lib/supabase" };
}

export async function signOut(): Promise<{ ok: true }> {
  return { ok: true };
}

export async function getRealtimeToken(): Promise<{ token: null }> {
  return { token: null };
}
