/**
 * Auth server functions — Embrace Health Grid
 *
 * All session handling happens here, on the server, using httpOnly cookies.
 *
 * Design rules:
 *   1. NO localStorage / sessionStorage anywhere. The token lives in an
 *      httpOnly cookie that JavaScript cannot read.
 *   2. The user profile (role, name, DID, MRN) is ALWAYS read from Postgres.
 *      It is never cached in the browser, because a client-held role is
 *      trivially editable and must never drive an authorization decision.
 *   3. Authorization is enforced by RLS in the database. These functions return
 *      role information for UI rendering only — the database is the arbiter.
 *
 * Replaces the previous model, which kept the JWT in sessionStorage AND
 * localStorage and mirrored `userRole` into localStorage where RouteGuard read
 * it. Editing one localStorage value was enough to change the UI's belief about
 * your role.
 */

import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";

/** Roles as stored in the database `user_role` enum. */
export type UserRole = "patient" | "doctor" | "staff" | "admin";

/**
 * Profile shape returned to the client for rendering.
 * Contains no token material.
 *
 * Legacy aliases (`name`, `did`) are provided alongside the canonical
 * `fullName` / `primaryDid` so existing components keep working during the
 * migration. New code should prefer the canonical names.
 */
export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  primaryDid: string | null;

  /** Alias of fullName — legacy call sites. */
  name: string;
  /** Alias of primaryDid — legacy call sites. */
  did: string | null;

  /**
   * Fields the old localStorage session carried that are not yet modelled in
   * the database. Always undefined for now; they resolve to falsy so existing
   * conditional rendering behaves sensibly rather than crashing.
   *
   * TODO: model these as columns and populate them here. Until then, screens
   * needing this data should read it from its own table (patients, staff,
   * insurance) rather than from the session — which is the correct pattern
   * anyway, since a session should carry identity, not a copy of every record.
   */
  mrn?: string;
  employeeId?: string;
  walletAddress?: string;
  department?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  phone?: string;
  allergies?: string[];
  conditions?: string[];
  specializations?: string[];
  insuranceProvider?: string;
  insurancePolicyNo?: string;
  sumInsured?: number;
  policyType?: string;
  validFrom?: string;
  validTo?: string;
}

/** Build the client-facing user object from a profiles row. */
function toCurrentUser(profile: {
  id: string;
  email: string;
  full_name: string;
  role: string;
  primary_did: string | null;
}): CurrentUser {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as UserRole,
    primaryDid: profile.primary_did,
    // Aliases for legacy call sites.
    name: profile.full_name,
    did: profile.primary_did,
  };
}

/**
 * Sign in with email + password.
 * On success the server sets httpOnly auth cookies; nothing is returned to be
 * stored client-side.
 */
export const signIn = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => {
    if (!data?.email || !data?.password) throw new Error("Email and password are required");
    return data;
  })
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();

    const { data: result, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      // Deliberately generic: distinguishing "no such user" from "wrong
      // password" enables account enumeration.
      return { ok: false as const, error: "Invalid email or password" };
    }

    // Load the profile from the database — never trust client-supplied role.
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, primary_did")
      .eq("id", result.user.id)
      .single();

    if (pErr || !profile) {
      // Authenticated but no profile row: treat as a failed login rather than
      // guessing at a role.
      await supabase.auth.signOut();
      return { ok: false as const, error: "Account is not fully provisioned" };
    }

    return {
      ok: true as const,
      user: toCurrentUser(profile),
    };
  });

/**
 * Current user, verified server-side on every call.
 *
 * Returns null when unauthenticated. Because this reads from Postgres, a role
 * change or account suspension takes effect immediately — there is no stale
 * client-side copy to invalidate.
 */
export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    const user = await getVerifiedUser();
    if (!user) return null;

    const supabase = getSupabaseServerClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, primary_did")
      .eq("id", user.id)
      .single();

    if (error || !profile) return null;

    return toCurrentUser(profile);
  },
);

/** Sign out and clear the auth cookies. */
export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = getSupabaseServerClient();
  await supabase.auth.signOut();
  return { ok: true as const };
});

/**
 * Role hierarchy for UI gating.
 *
 * This is presentation logic only. It decides which nav items and pages to
 * render — it does NOT protect data. Data access is enforced by RLS, so a user
 * who bypasses this check still cannot read rows they have no policy for.
 */
export function hasAccess(userRole: UserRole | null, required: UserRole): boolean {
  if (!userRole) return false;
  if (userRole === required) return true;

  // Admins may view staff areas; doctors may view staff areas.
  if (userRole === "admin") return required !== "patient";
  if (userRole === "doctor") return required === "staff";

  return false;
}
