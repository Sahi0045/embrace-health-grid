/**
 * Supabase client for the admin portal.
 *
 * IMPORTANT ARCHITECTURAL DIFFERENCE FROM THE MAIN APP
 * ----------------------------------------------------
 * The main app is a TanStack Start SSR app, so its session lives in an httpOnly
 * cookie that JavaScript cannot read. The admin portal is a plain Vite SPA with
 * no server runtime, so it has no way to set or read httpOnly cookies — the
 * Supabase session is therefore held in browser storage here.
 *
 * That is a genuine weakness, not a preference: an XSS payload in the admin
 * portal could read the session, and an admin session is the most valuable one
 * to steal. It is accepted only because:
 *
 *   1. The admin portal is NOT deployed — it runs on localhost:3002 for
 *      development. Nothing in vercel.json or the production CD builds it.
 *   2. RLS still governs every query. A stolen admin session cannot exceed what
 *      the admin's own policies permit, and break-glass PHI access remains an
 *      audited Edge Function rather than an implicit RLS bypass.
 *
 * Before this portal is ever deployed it should either be folded into the main
 * app (where server functions and httpOnly cookies already work) or converted
 * to TanStack Start. See task 6 in the migration plan.
 */

import { createClient } from "@supabase/supabase-js";

/**
 * Shape of the profiles row this portal reads. Declared locally because no
 * generated Database types exist yet; without it the untyped client infers
 * `never` for selected columns.
 */
interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  primary_did: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY for the admin portal. " +
      "The anon key is safe to expose only because RLS is enforced on every table.",
  );
}

let _client: ReturnType<typeof createClient> | null = null;

export function getAdminSupabase() {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _client;
}

/**
 * Sign in and verify the account is actually an admin.
 *
 * The role check reads `profiles` from Postgres — never a client-held value —
 * so a non-admin cannot reach the portal by editing local state. Even if they
 * did, RLS would return nothing for admin-scoped queries.
 */
export async function adminSignIn(email: string, password: string) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Generic message: distinguishing "no such user" from "wrong password"
    // enables account enumeration.
    return { success: false as const, error: "Invalid email or password" };
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, primary_did")
    .eq("id", data.user.id)
    .single<ProfileRow>();

  if (pErr || !profile) {
    await supabase.auth.signOut();
    return { success: false as const, error: "Account is not fully provisioned" };
  }

  if (profile.role !== "admin") {
    // Sign straight back out: this portal is admin-only.
    await supabase.auth.signOut();
    return { success: false as const, error: "This portal is restricted to administrators" };
  }

  return {
    success: true as const,
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.full_name,
      role: profile.role,
      did: profile.primary_did,
    },
  };
}

/** Current admin profile, re-read from Postgres. Returns null when signed out. */
export async function adminCurrentUser() {
  const supabase = getAdminSupabase();

  // getUser() verifies the token server-side; getSession() only decodes it.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, primary_did")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (!profile || profile.role !== "admin") return null;

  return {
    id: profile.id,
    email: profile.email,
    name: profile.full_name,
    role: profile.role,
    did: profile.primary_did,
  };
}

export async function adminSignOut() {
  await getAdminSupabase().auth.signOut();
}
