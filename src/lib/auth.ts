/**
 * Frontend Auth Module — Embrace Health Grid
 *
 * Security improvements:
 * - Access JWT stored in sessionStorage (cleared on tab/browser close,
 *   NOT accessible after XSS via window.opener or cross-tab, shorter blast radius)
 * - Opaque refresh token stored in sessionStorage too (NOT localStorage)
 * - Non-sensitive profile metadata (role, email, name, DID) kept in
 *   localStorage ONLY for UI rendering — never used for authorization server-side
 * - Auto-refresh: schedules a token refresh 5 minutes before the access token expires
 * - In-memory token mirror: the token is also kept in a module-level variable so
 *   server-side rendering / service workers can access it without touching storage
 *
 * Token storage strategy:
 *   sessionStorage["authToken"]    — JWT access token  (2h TTL)
 *   sessionStorage["refreshToken"] — opaque refresh token (7d TTL, rotated on each use)
 *   localStorage["userRole"]       — for UI guards only (not authoritative)
 *   localStorage["userEmail"]      — for display only
 *   localStorage["userName"]       — for display only
 *   localStorage["userDID"]        — for patient portal DID display
 */

export type UserRole = "patient" | "staff" | "admin" | null;

export interface AuthUser {
  email: string;
  role: UserRole;
  name?: string;
  did?: string;
  walletAddress?: string | null;
  mrn?: string | null;
  employeeId?: string | null;
  // Extended profile fields (populated from backend/DID registry)
  age?: number;
  gender?: string;
  bloodGroup?: string;
  phone?: string;
  allergies?: string[];
  department?: string;
  specializations?: string[];
}

// ─── Storage keys ──────────────────────────────────────────────────────────────
const ACCESS_TOKEN_KEY  = "authToken";
const REFRESH_TOKEN_KEY = "refreshToken";

// ─── In-memory mirror (SSR / service worker safe) ─────────────────────────────
let _memToken: string | null = null;
let _refreshTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Token accessors ───────────────────────────────────────────────────────────

/** Read the access JWT. Prefers in-memory, falls back to sessionStorage. */
export function getToken(): string | null {
  if (_memToken) return _memToken;
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

/** Read the opaque refresh token from sessionStorage. */
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

// ─── Session management ────────────────────────────────────────────────────────

export interface SessionUser {
  name: string;
  email: string;
  role: string;
  did?: string | null;
  walletAddress?: string | null;
  mrn?: string | null;
  employeeId?: string | null;
}

export function setSession(token: string, user: SessionUser): void;
export function setSession(token: string, refreshToken: string | null, user: SessionUser): void;
export function setSession(
  token: string,
  refreshTokenOrUser: string | null | SessionUser,
  userOrUndefined?: SessionUser,
): void {
  if (typeof window === "undefined") return;

  let refreshToken: string | null = null;
  let user: SessionUser;

  if (typeof refreshTokenOrUser === "object" && refreshTokenOrUser !== null) {
    user = refreshTokenOrUser as SessionUser;
  } else {
    refreshToken = refreshTokenOrUser as string | null;
    user = userOrUndefined!;
  }

  if (!user) return;

  // Access token → sessionStorage + memory
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  _memToken = token;

  // Refresh token → sessionStorage only
  if (refreshToken) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }


  // Non-sensitive profile metadata → localStorage (for UI display only)
  localStorage.setItem("userRole",  user.role);
  localStorage.setItem("userEmail", user.email);
  localStorage.setItem("userName",  user.name);

  if (user.did) {
    localStorage.setItem("userDID", user.did);
  } else {
    localStorage.removeItem("userDID");
  }
  if (user.walletAddress) {
    localStorage.setItem("userWalletAddress", user.walletAddress);
  } else {
    localStorage.removeItem("userWalletAddress");
  }
  if (user.mrn) {
    localStorage.setItem("userMRN", user.mrn);
  } else {
    localStorage.removeItem("userMRN");
  }
  if (user.employeeId) {
    localStorage.setItem("userEmployeeId", user.employeeId);
  } else {
    localStorage.removeItem("userEmployeeId");
  }

  // Schedule automatic token refresh
  _scheduleRefresh(token);
}

/**
 * Parse JWT expiry from the token payload (no library needed — just base64).
 * Returns remaining ms until expiry, or null if unreadable.
 */
function _getTokenRemainingMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp) return null;
    return payload.exp * 1000 - Date.now();
  } catch {
    return null;
  }
}

/**
 * Schedule an automatic refresh 5 minutes before the access token expires.
 * Clears any previously scheduled timer.
 */
function _scheduleRefresh(token: string): void {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  const remaining = _getTokenRemainingMs(token);
  if (!remaining || remaining < 0) return;

  // Refresh 5 minutes before expiry (but not sooner than 10 seconds from now)
  const delay = Math.max(remaining - 5 * 60 * 1000, 10_000);
  _refreshTimer = setTimeout(() => {
    _autoRefresh().catch(() => {
      // If refresh fails, redirect to login
      logout();
    });
  }, delay);
}

/** Perform a silent token refresh using the stored refresh token. */
async function _autoRefresh(): Promise<void> {
  const rt = getRefreshToken();
  if (!rt) throw new Error("No refresh token");

  const clientKey =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_CLIENT_KEY) ||
    "apollo-consortium-client-secret-2026";

  const apiBase =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
    "http://localhost:3001";

  const res = await fetch(`${apiBase}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-key": clientKey,
    },
    body: JSON.stringify({ refreshToken: rt }),
  });

  if (!res.ok) throw new Error("Refresh failed");

  const data = await res.json();
  if (data.token) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, data.token);
    _memToken = data.token;
  }
  if (data.refreshToken) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  }
  _scheduleRefresh(data.token);
}

// ─── User retrieval ────────────────────────────────────────────────────────────

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;

  const role = localStorage.getItem("userRole") as UserRole;
  const email = localStorage.getItem("userEmail");

  // If there's no token in sessionStorage, treat as logged out
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) return null;
  if (!role || !email) return null;

  const name          = localStorage.getItem("userName")         ?? undefined;
  const did           = localStorage.getItem("userDID")          ?? undefined;
  const walletAddress = localStorage.getItem("userWalletAddress")?? undefined;
  const mrn           = localStorage.getItem("userMRN")          ?? undefined;
  const employeeId    = localStorage.getItem("userEmployeeId")   ?? undefined;

  return { email, role, name, did, walletAddress, mrn, employeeId };
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

export function hasAccess(
  userRole: UserRole,
  requiredRole: "patient" | "staff" | "admin",
): boolean {
  if (!userRole) return false;
  if (userRole === "admin") return true;
  return userRole === requiredRole;
}

// ─── Logout ────────────────────────────────────────────────────────────────────

/**
 * Clear all session state and redirect to login.
 * Also calls the server-side logout endpoint to blocklist the JTI.
 */
export async function logout(redirectToLogin = true): Promise<void> {
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }

  // Server-side token invalidation (best-effort — don't block on failure)
  try {
    const token = getToken();
    const rt    = getRefreshToken();
    if (token) {
      const clientKey =
        (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_CLIENT_KEY) ||
        "apollo-consortium-client-secret-2026";
      const apiBase =
        (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
        "http://localhost:3001";

      await fetch(`${apiBase}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-client-key": clientKey,
        },
        body: JSON.stringify({ refreshToken: rt }),
      }).catch(() => {});
    }
  } catch { /* ignore */ }

  // Clear all storage
  _memToken = null;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("userRole");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userName");
  localStorage.removeItem("userDID");
  localStorage.removeItem("userMRN");
  localStorage.removeItem("userEmployeeId");
  localStorage.removeItem("userWalletAddress");

  if (redirectToLogin && typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
