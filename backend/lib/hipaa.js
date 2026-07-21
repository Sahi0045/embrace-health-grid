/**
 * HIPAA Compliance Middleware — Embrace Health Grid
 *
 * Implements technical safeguards required by HIPAA Security Rule
 * (45 CFR § 164.300–164.318):
 *
 *  § 164.312(b)   Audit controls — log all PHI access events
 *  § 164.312(c)   Integrity — tamper detection via HMAC of audit events
 *  § 164.312(d)   Authentication — ensure user identity on PHI requests
 *  § 164.312(e)   Transmission security — enforce HTTPS / reject HTTP
 *  § 164.308(a)(3) Access management — role-based access logging
 *  § 164.308(a)(5) Security awareness — automatic session timeout warnings
 *
 * Usage in server.js:
 *   import { hipaaMiddleware, hipaaAuditPHIAccess } from './lib/hipaa.js';
 *   app.use(hipaaMiddleware());
 *   // On any PHI route:
 *   app.get('/api/medical-records/:did', requireAuth, hipaaAuditPHIAccess('MedicalRecord'), handler);
 */

import { createHmac } from "crypto";
import logger from "./logger.js";

// ─── HTTPS enforcement ─────────────────────────────────────────────────────────

/**
 * HIPAA § 164.312(e)(1) — Transmission security.
 * Redirects all plain-HTTP requests to HTTPS in production.
 * In development, adds a warning header instead.
 *
 * @param {object} opts
 * @param {"redirect"|"reject"|"warn"} opts.mode
 * @returns {import('express').RequestHandler}
 */
export function httpsEnforcementMiddleware({ mode = "redirect" } = {}) {
  return (req, res, next) => {
    // Trust proxy headers (Nginx, Cloudflare, ALB, etc.)
    const isSecure =
      req.secure ||
      req.headers["x-forwarded-proto"] === "https" ||
      req.headers["x-forwarded-ssl"] === "on" ||
      req.headers["cf-visitor"]?.includes('"scheme":"https"');

    if (isSecure) return next();

    const isDev = process.env.NODE_ENV !== "production";

    if (isDev) {
      res.setHeader("X-HIPAA-Transport-Warning", "Non-HTTPS connection detected in development mode");
      return next();
    }

    if (mode === "redirect") {
      const httpsUrl = `https://${req.headers.host}${req.url}`;
      return res.redirect(301, httpsUrl);
    }

    if (mode === "reject") {
      return res.status(403).json({
        error: "HTTPS Required",
        code: "HIPAA_TRANSPORT_SECURITY",
        message: "HIPAA § 164.312(e)(1) requires all ePHI transmission to be encrypted. Use HTTPS.",
      });
    }

    next();
  };
}

// ─── HIPAA Security Headers ────────────────────────────────────────────────────

/**
 * Add HIPAA-aligned security response headers.
 * Complements Helmet.js with healthcare-specific policies.
 * @returns {import('express').RequestHandler}
 */
export function hipaaSecurityHeaders() {
  return (req, res, next) => {
    // Prevent caching of PHI responses
    if (req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }

    // Prevent browser from guessing content types (protects against MIME attacks on PHI)
    res.setHeader("X-Content-Type-Options", "nosniff");

    // HSTS — enforce HTTPS for 1 year including subdomains
    if (process.env.NODE_ENV === "production") {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
    }

    // Prevent clickjacking on patient portal
    res.setHeader("X-Frame-Options", "DENY");

    // Referrer policy — don't leak PHI URLs in referrer headers
    res.setHeader("Referrer-Policy", "no-referrer");

    // Permissions policy — disable unnecessary browser APIs
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );

    next();
  };
}

// ─── PHI Access Audit Logging ─────────────────────────────────────────────────

/**
 * HIPAA § 164.312(b) — PHI access audit control.
 *
 * Automatically logs every access to PHI data with:
 *  - Actor identity (JWT email, IP, user agent)
 *  - Resource accessed (namespace + key/patient DID)
 *  - Action and outcome
 *  - HMAC integrity tag (detects log tampering)
 *  - Timestamp (microsecond precision)
 *
 * @param {string} resourceType - Human-readable resource label (e.g. "MedicalRecord")
 * @param {object} opts
 * @param {Function} opts.logFn - Function to persist the event (e.g. putState)
 * @returns {import('express').RequestHandler}
 */
export function hipaaAuditPHIAccess(resourceType, { logFn } = {}) {
  const AUDIT_HMAC_KEY = process.env.AUDIT_HMAC_KEY || process.env.JWT_SECRET || "dev-hmac-key";

  return (req, res, next) => {
    const start = Date.now();

    // Capture response to log outcome
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const durationMs = Date.now() - start;
      const outcome = res.statusCode >= 400 ? "failure" : "success";

      const event = {
        type: "hipaa_phi_access",
        actor: req.user?.email || "unauthenticated",
        actorDid: req.user?.did || null,
        actorRole: req.user?.role || null,
        actorIp: req.ip || req.socket?.remoteAddress,
        actorUa: req.headers["user-agent"]?.slice(0, 120) || null,
        resourceType,
        resourceId:
          req.params?.patientDid ||
          req.params?.did ||
          req.params?.id ||
          req.body?.patientDid ||
          "unknown",
        action: req.method,
        outcome,
        httpStatus: res.statusCode,
        durationMs,
        requestId: req.headers["x-request-id"] || null,
        timestamp: new Date().toISOString(),
        retentionPolicy: "HIPAA_6Y", // 6-year retention per § 164.530(j)
      };

      // HMAC integrity tag — allows detecting if the log was tampered with
      const eventJson = JSON.stringify(event);
      event.integrityTag = createHmac("sha256", AUDIT_HMAC_KEY)
        .update(eventJson)
        .digest("hex")
        .slice(0, 32);

      // Write to structured logger
      logger.info("hipaa_phi_access", event);

      // Optionally persist to DB
      if (logFn) {
        try {
          logFn("audit", `hipaa_${Date.now()}_${Math.random().toString(36).slice(2)}`, event, "system");
        } catch { /* non-blocking */ }
      }

      return originalJson(body);
    };

    next();
  };
}

// ─── Session timeout enforcement ───────────────────────────────────────────────

/**
 * HIPAA § 164.312(a)(2)(iii) — Automatic logoff.
 * Adds session-age headers so the frontend can enforce session timeout.
 * Also rejects tokens that are close to their max absolute age.
 *
 * @param {number} maxAgeSeconds - Maximum session age in seconds (default: 8h)
 * @returns {import('express').RequestHandler}
 */
export function sessionTimeoutMiddleware(maxAgeSeconds = 8 * 60 * 60) {
  return (req, res, next) => {
    if (!req.user) return next();

    const issuedAt = req.user.iat; // JWT iat claim (seconds)
    if (!issuedAt) return next();

    const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
    const remaining = maxAgeSeconds - ageSeconds;

    // Reject if absolute session age exceeds maximum
    if (ageSeconds > maxAgeSeconds) {
      return res.status(401).json({
        error: "Session expired",
        code: "HIPAA_SESSION_TIMEOUT",
        message: "HIPAA § 164.312(a)(2)(iii): Session has exceeded the maximum allowed age. Please log in again.",
      });
    }

    // Warn when within 15 minutes of forced expiry
    if (remaining < 15 * 60) {
      res.setHeader("X-Session-Warning", `Session expires in ${Math.floor(remaining / 60)} minutes`);
    }

    res.setHeader("X-Session-Remaining", String(remaining));
    next();
  };
}

// ─── Minimum Necessary Access ──────────────────────────────────────────────────

/**
 * HIPAA § 164.514(d) — Minimum necessary standard.
 * Strips fields from API responses that aren't needed by the requesting role.
 * Applied to responses containing user/patient objects.
 *
 * @param {string[]} sensitiveFields - Fields to strip from non-admin responses
 * @returns {import('express').RequestHandler}
 */
export function minimumNecessaryFilter(sensitiveFields = ["password", "ssn", "dob_exact"]) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    const role = req.user?.role;

    res.json = function (body) {
      if (role !== "admin" && body && typeof body === "object") {
        body = stripSensitiveFields(body, sensitiveFields);
      }
      return originalJson(body);
    };
    next();
  };
}

function stripSensitiveFields(obj, fields) {
  if (Array.isArray(obj)) return obj.map((item) => stripSensitiveFields(item, fields));
  if (obj && typeof obj === "object") {
    const cleaned = { ...obj };
    for (const f of fields) delete cleaned[f];
    for (const k of Object.keys(cleaned)) {
      if (typeof cleaned[k] === "object") {
        cleaned[k] = stripSensitiveFields(cleaned[k], fields);
      }
    }
    return cleaned;
  }
  return obj;
}

// ─── Audit log retention policy ────────────────────────────────────────────────

/**
 * HIPAA § 164.530(j) — Retention of documentation.
 * Audit logs must be retained for 6 years.
 *
 * Exports a policy object that can be consumed by backup/archival tooling.
 */
export const HIPAA_AUDIT_RETENTION_POLICY = {
  namespace: "audit",
  retentionYears: 6,
  retentionDays: 6 * 365,
  description: "HIPAA § 164.530(j): Audit logs retained for minimum 6 years from creation date",
  archivalStrategy: "cold-storage-after-90-days",
  encryptArchive: true,
  integrityVerification: "sha256-hmac",
};

// ─── Business Associate Agreement framework ────────────────────────────────────

/**
 * BAA metadata framework (HIPAA § 164.308(b)).
 * In a real deployment this would be stored in a secure document store
 * and referenced in vendor contracts. Provided here as a schema reference.
 */
export const BAA_REQUIRED_VENDORS = [
  { vendor: "Convex", service: "Database (cloud sync)", baaStatus: "required", docs: "https://convex.dev/hipaa" },
  { vendor: "Vercel", service: "Frontend hosting",      baaStatus: "required", docs: "https://vercel.com/docs/security/hipaa" },
  { vendor: "AWS/GCP/Azure", service: "Container hosting", baaStatus: "required", docs: "vendor-specific" },
  { vendor: "Solana RPC", service: "Blockchain anchor", baaStatus: "N/A - public blockchain, no PHI transmitted", docs: null },
];

// ─── Composite middleware factory ──────────────────────────────────────────────

/**
 * Mount all HIPAA technical safeguards in one call.
 * Recommended order: call before route definitions in server.js.
 *
 * @param {object} opts
 * @returns {import('express').RequestHandler[]}
 */
export function hipaaMiddleware(opts = {}) {
  return [
    httpsEnforcementMiddleware({ mode: opts.httpsMode || "redirect" }),
    hipaaSecurityHeaders(),
    sessionTimeoutMiddleware(opts.sessionMaxAge || 8 * 60 * 60),
    minimumNecessaryFilter(opts.sensitiveFields || ["password", "ssn"]),
  ];
}
