export type UserRole = "patient" | "staff" | "admin" | null;

export interface AuthUser {
  email: string;
  role: UserRole;
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  
  const role = localStorage.getItem("userRole") as UserRole;
  const email = localStorage.getItem("userEmail");
  
  if (!role || !email) return null;
  
  return { email, role };
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

export function hasAccess(userRole: UserRole, requiredRole: "patient" | "staff" | "admin"): boolean {
  if (!userRole) return false;
  
  // Admin has access to everything
  if (userRole === "admin") return true;
  
  // Users can only access their own role's routes
  return userRole === requiredRole;
}

export function logout() {
  localStorage.removeItem("userRole");
  localStorage.removeItem("userEmail");
  window.location.href = "/login";
}
