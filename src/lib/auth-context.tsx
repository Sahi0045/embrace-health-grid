/**
 * Auth context — Embrace Health Grid
 *
 * Bridges the async, server-verified session to the synchronous access pattern
 * the existing components use.
 *
 * The old `getCurrentUser()` read localStorage synchronously, which is why it
 * could be called inline during render. Its replacement is a server function
 * (the profile now comes from Postgres), so it is necessarily async. This
 * provider fetches once, then exposes the result synchronously via
 * `useCurrentUser()` — so call sites change from
 *
 *     const user = getCurrentUser();          // localStorage, trivially forged
 * to
 *     const { user } = useCurrentUser();      // DB-backed, server-verified
 *
 * Security note: `user.role` here is for RENDERING ONLY. Authorization is
 * enforced by RLS in Postgres. A user who tampers with this value in memory
 * changes what the UI draws, not what the database will return.
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getCurrentUser as fetchCurrentUser, signOut as serverSignOut } from "./auth.server";
import type { CurrentUser, UserRole } from "./auth.server";

export type { CurrentUser, UserRole };

interface AuthContextValue {
  user: CurrentUser | null;
  /** true until the first server check resolves — render nothing rather than guessing. */
  loading: boolean;
  /** Re-read the profile from the database (after a role change, say). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await fetchCurrentUser();
      setUser(u);
    } catch {
      // Network or auth failure — treat as signed out rather than assuming a role.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await serverSignOut().catch(() => {});
    setUser(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Current user, server-verified and DB-backed. */
export function useCurrentUser() {
  return useContext(AuthContext);
}

/**
 * Role hierarchy for UI gating only — not a security boundary.
 * Mirrors hasAccess() in auth.server.ts.
 */
export function hasAccess(userRole: UserRole | null, required: UserRole): boolean {
  if (!userRole) return false;
  if (userRole === required) return true;
  if (userRole === "super_admin") return required !== "patient";
  if (userRole === "admin") return required !== "patient";
  if (userRole === "doctor") return required === "staff";
  return false;
}
