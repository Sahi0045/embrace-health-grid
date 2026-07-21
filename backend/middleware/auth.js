/**
 * JWT authentication + RBAC middleware.
 * Role is always derived from JWT — never from x-user-role header.
 *
 * Security improvements (v2):
 * - JTI-based token blocklist checked on every request (supports logout + revocation)
 * - User-level revocation sentinel (force re-login all devices)
 * - Refresh tokens bound by fingerprint (UA + IP)
 */

import { createHash } from "crypto";
import { isTokenBlocked, isUserRevoked } from "../lib/token-store.js";

const PUBLIC_PATHS = new Set([
  "/health",
  "/health/ready",
  "/health/metrics",
  "/api/auth/login",
  "/api/auth/signup", // patient self-registration — guarded by requireClientAuth
  "/api/auth/setup", // one-time bootstrap — guarded internally + by requireClientAuth
  "/api/auth/refresh", // token refresh — uses opaque refresh token, not JWT
]);

/** Routes any authenticated user may access */
const AUTHENTICATED_PATHS = new Set([
  "/api/auth/me",
  "/api/auth/refresh",
  "/api/notifications",
  "/api/auth/logout",
]);

/** Admin-only path prefixes */
const ADMIN_PREFIXES = [
  "/api/did",
  "/api/auth/users",
  "/api/invoke",
  "/api/nfc/issue",
  "/api/credential/issue",
];

/** Staff + admin path prefixes */
const STAFF_PREFIXES = [
  "/api/prescriptions",
  "/api/labs",
  "/api/consent/request",
  "/api/nfc/verify",
  "/api/attendance",
  "/api/fraud/alert",
];

/** Patient-scoped read patterns — patients may only read own data via middleware helpers */
const CONSENT_GATED_PREFIXES = [
  "/api/medical-records",
  "/api/labs/",
  "/api/prescriptions/",
  "/api/billing/",
];

/**
 * Build a stable fingerprint from request metadata.
 * Used to bind refresh tokens to the originating device/browser session.
 * @param {import('express').Request} req
 * @returns {string}
 */
export function requestFingerprint(req) {
  const ua = req.headers["user-agent"] || "";
  const ip = req.ip || req.socket?.remoteAddress || "";
  return createHash("sha256").update(`${ip}:${ua}`).digest("hex").slice(0, 32);
}

export function createAuthMiddleware(jwtSecret) {
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required. Set it in .env — no default allowed in production.");
  }

  async function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Authentication required" });
    try {
      const jwt = await import("jsonwebtoken");
      req.user = jwt.default.verify(token, jwtSecret);
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  }

  // Fix async requireAuth - use sync jwt import at module level instead
  return { jwtSecret };
}

export function buildAuth(jwt, jwtSecret) {
  function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Authentication required" });
    try {
      const payload = jwt.verify(token, jwtSecret);

      // JTI blocklist check
      if (payload.jti && isTokenBlocked(payload.jti)) {
        return res.status(401).json({ error: "Token has been revoked" });
      }

      // User-level revocation (e.g. after password change / admin lockout)
      if (isUserRevoked(payload.email)) {
        return res.status(401).json({ error: "Session invalidated. Please log in again." });
      }

      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  }

  function requireRole(...roles) {
    const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;
    return (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: "Authentication required" });
      if (!allowedRoles.includes(req.user.role)) {
        return res
          .status(403)
          .json({ error: `Forbidden: requires role ${allowedRoles.join(" or ")}` });
      }
      next();
    };
  }

  function globalApiAuth(req, res, next) {
    const path = req.path;
    const fullPath = req.baseUrl + path;

    if (PUBLIC_PATHS.has(fullPath) || PUBLIC_PATHS.has(path)) return next();
    if (!fullPath.startsWith("/api") && !path.startsWith("/api")) return next();

    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Authentication required" });

    let payload;
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // JTI blocklist check
    if (payload.jti && isTokenBlocked(payload.jti)) {
      return res.status(401).json({ error: "Token has been revoked" });
    }

    // User-level revocation
    if (isUserRevoked(payload.email)) {
      return res.status(401).json({ error: "Session invalidated. Please log in again." });
    }

    req.user = payload;

    const apiPath = fullPath.startsWith("/api") ? fullPath : path;
    const role = req.user.role;

    if (role === "admin") return next();

    for (const prefix of ADMIN_PREFIXES) {
      if (apiPath.startsWith(prefix) && req.method !== "GET") {
        return res.status(403).json({ error: "Forbidden: admin only" });
      }
    }

    if (apiPath === "/api/auth/users") {
      return res.status(403).json({ error: "Forbidden: admin only" });
    }

    if (role === "patient") {
      for (const prefix of STAFF_PREFIXES) {
        if (apiPath.startsWith(prefix)) {
          return res.status(403).json({ error: "Forbidden: staff or admin only" });
        }
      }
      if (apiPath.startsWith("/api/invoke")) {
        return res.status(403).json({ error: "Forbidden: admin only" });
      }
    }

    if (role === "staff") {
      if (apiPath.startsWith("/api/auth/users")) {
        return res.status(403).json({ error: "Forbidden: admin only" });
      }
    }

    next();
  }

  return { requireAuth, requireRole, globalApiAuth, PUBLIC_PATHS, CONSENT_GATED_PREFIXES };
}

/** Check active consent grant for clinical data access */
export function hasActiveConsent(getAllState, patientDid, doctorDid, resource = "*") {
  const grants = getAllState("consent-manager").map((e) => e.value);
  const now = Date.now();
  return grants.some((g) => {
    if (g.status !== "active") return false;
    if (g.patientDid !== patientDid) return false;
    if (doctorDid && g.doctorDid !== doctorDid && g.doctorDid !== "*") return false;
    if (g.expiry && new Date(g.expiry).getTime() < now) return false;
    if (resource === "*") return true;
    return g.resource === resource || g.resource === "*" || g.resource === "Medical Records";
  });
}

export function consentMiddleware(getAllState) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (role === "admin") return next();
    if (role === "patient") return next();

    const patientDid = req.params.patientDid || req.body?.patientDid || req.query?.patientDid;

    if (!patientDid) return next();

    const doctorDid = req.user?.did || req.body?.doctorDid;
    if (hasActiveConsent(getAllState, patientDid, doctorDid)) return next();

    return res.status(403).json({
      error: "Consent required",
      message: "No active consent grant for this patient's data",
    });
  };
}
