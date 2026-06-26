export type UserRole = "patient" | "staff" | "admin" | null;

export interface AuthUser {
  email: string;
  role: UserRole;
  name?: string;
  did?: string;
}

const TOKEN_KEY = "authToken";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(
  token: string,
  user: { name: string; email: string; role: string; did?: string },
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem("userRole", user.role);
  localStorage.setItem("userEmail", user.email);
  localStorage.setItem("userName", user.name);
  if (user.did) {
    localStorage.setItem("userDID", user.did);
  } else {
    localStorage.removeItem("userDID");
  }
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;

  const role = localStorage.getItem("userRole") as UserRole;
  const email = localStorage.getItem("userEmail");

  if (!role || !email) return null;

  const name = localStorage.getItem("userName") ?? undefined;
  const did = localStorage.getItem("userDID") ?? undefined;

  return { email, role, name, did };
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

export function hasAccess(
  userRole: UserRole,
  requiredRole: "patient" | "staff" | "admin",
): boolean {
  if (!userRole) return false;

  // Admin has access to everything
  if (userRole === "admin") return true;

  // Users can only access their own role's routes
  return userRole === requiredRole;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("userRole");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userName");
  localStorage.removeItem("userDID");
  window.location.href = "/login";
}
