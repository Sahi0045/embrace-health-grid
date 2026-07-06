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

const TOKEN_KEY = "authToken";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(
  token: string,
  user: {
    name: string;
    email: string;
    role: string;
    did?: string | null;
    walletAddress?: string | null;
    mrn?: string | null;
    employeeId?: string | null;
  },
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
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;

  const role = localStorage.getItem("userRole") as UserRole;
  const email = localStorage.getItem("userEmail");

  if (!role || !email) return null;

  const name = localStorage.getItem("userName") ?? undefined;
  const did = localStorage.getItem("userDID") ?? undefined;
  const walletAddress = localStorage.getItem("userWalletAddress") ?? undefined;
  const mrn = localStorage.getItem("userMRN") ?? undefined;
  const employeeId = localStorage.getItem("userEmployeeId") ?? undefined;

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
