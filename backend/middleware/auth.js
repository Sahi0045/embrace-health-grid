/**
 * JWT authentication + RBAC middleware.
 * Role is always derived from JWT — never from x-user-role header.
 */

const PUBLIC_PATHS = new Set(["/health", "/api/auth/login", "/api/auth/signup"]);

/** Routes any authenticated user may access */
const AUTHENTICATED_PATHS = new Set(["/api/auth/me", "/api/auth/refresh", "/api/notifications"]);

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
  "/api/visitors",
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
      req.user = jwt.verify(token, jwtSecret);
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

    try {
      req.user = jwt.verify(token, jwtSecret);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

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
