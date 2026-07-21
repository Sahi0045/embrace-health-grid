/**
 * HIPAA-Compliant Audit Logging System
 * Implements HIPAA Security Rule §164.312(b) - Audit Controls
 *
 * Records all access to PHI and security-relevant events
 * Audit logs are tamper-evident and retained for 6 years (HIPAA requirement)
 */

import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { writeFileSync, readFileSync, existsSync, appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_DIR = join(__dirname, "../../audit-logs");
const CURRENT_LOG_FILE = join(AUDIT_DIR, "current-audit.ndjson");
const HASH_CHAIN_FILE = join(AUDIT_DIR, "hash-chain.json");

// Ensure audit directory exists
if (!existsSync(AUDIT_DIR)) {
  mkdirSync(AUDIT_DIR, { recursive: true });
}

// HIPAA Event Types
export const AuditEventType = {
  // Access Events
  PHI_ACCESS: "phi_access",
  PHI_CREATED: "phi_created",
  PHI_UPDATED: "phi_updated",
  PHI_DELETED: "phi_deleted",
  PHI_EXPORTED: "phi_exported",

  // Authentication Events
  USER_LOGIN: "user_login",
  USER_LOGOUT: "user_logout",
  LOGIN_FAILED: "login_failed",
  PASSWORD_CHANGED: "password_changed",
  MFA_ENABLED: "mfa_enabled",
  MFA_DISABLED: "mfa_disabled",

  // Authorization Events
  ACCESS_GRANTED: "access_granted",
  ACCESS_DENIED: "access_denied",
  PERMISSION_CHANGED: "permission_changed",
  ROLE_ASSIGNED: "role_assigned",

  // Consent Events
  CONSENT_GRANTED: "consent_granted",
  CONSENT_REVOKED: "consent_revoked",
  CONSENT_REQUEST: "consent_request",

  // System Events
  SYSTEM_START: "system_start",
  SYSTEM_STOP: "system_stop",
  CONFIG_CHANGED: "config_changed",
  BACKUP_CREATED: "backup_created",
  BACKUP_RESTORED: "backup_restored",

  // Security Events
  ENCRYPTION_KEY_ROTATED: "encryption_key_rotated",
  SECURITY_ALERT: "security_alert",
  BREACH_DETECTED: "breach_detected",
  SUSPICIOUS_ACTIVITY: "suspicious_activity",

  // Compliance Events
  AUDIT_LOG_ACCESSED: "audit_log_accessed",
  COMPLIANCE_REPORT_GENERATED: "compliance_report_generated",
  POLICY_UPDATED: "policy_updated",
};

// Severity levels
export const AuditSeverity = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical",
};

/**
 * Hash chain for audit log integrity
 * Each log entry includes hash of previous entry
 */
class HashChain {
  constructor() {
    this.loadChain();
  }

  loadChain() {
    if (existsSync(HASH_CHAIN_FILE)) {
      try {
        const data = readFileSync(HASH_CHAIN_FILE, "utf8");
        this.chain = JSON.parse(data);
      } catch (error) {
        console.error("Failed to load hash chain:", error.message);
        this.chain = { lastHash: null, count: 0 };
      }
    } else {
      this.chain = { lastHash: null, count: 0 };
    }
  }

  saveChain() {
    try {
      writeFileSync(HASH_CHAIN_FILE, JSON.stringify(this.chain, null, 2));
    } catch (error) {
      console.error("Failed to save hash chain:", error.message);
    }
  }

  getLastHash() {
    return this.chain.lastHash;
  }

  addHash(hash) {
    this.chain.lastHash = hash;
    this.chain.count += 1;
    this.saveChain();
  }

  verify(entries) {
    let prevHash = null;
    for (const entry of entries) {
      const expectedPrevHash = prevHash;
      if (entry.previousHash !== expectedPrevHash) {
        return {
          valid: false,
          error: `Hash chain broken at entry ${entry.id}`,
          entry,
        };
      }
      prevHash = entry.hash;
    }
    return { valid: true };
  }
}

const hashChain = new HashChain();

/**
 * Create tamper-evident hash of audit entry
 */
function createEntryHash(entry, previousHash) {
  const data = JSON.stringify({
    ...entry,
    previousHash,
  });
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Log audit event (HIPAA-compliant)
 *
 * @param {object} event - Audit event data
 * @param {string} event.type - Event type from AuditEventType
 * @param {string} event.actor - User/system performing action
 * @param {string} event.action - Description of action
 * @param {string} [event.resource] - Resource affected (e.g., patient ID)
 * @param {string} [event.resourceType] - Type of resource
 * @param {object} [event.metadata] - Additional event data
 * @param {string} [event.severity] - Event severity
 * @param {string} [event.ipAddress] - Source IP address
 * @param {string} [event.userAgent] - User agent string
 * @param {boolean} [event.success] - Whether action succeeded
 */
export function logAuditEvent(event) {
  const timestamp = new Date().toISOString();
  const id = randomUUID();

  const auditEntry = {
    id,
    timestamp,
    type: event.type || "unknown",
    severity: event.severity || AuditSeverity.INFO,
    actor: event.actor || "system",
    action: event.action || "",
    resource: event.resource || null,
    resourceType: event.resourceType || null,
    success: event.success !== false,
    ipAddress: event.ipAddress || null,
    userAgent: event.userAgent || null,
    metadata: event.metadata || {},
    previousHash: hashChain.getLastHash(),
  };

  // Create tamper-evident hash
  auditEntry.hash = createEntryHash(auditEntry, auditEntry.previousHash);
  hashChain.addHash(auditEntry.hash);

  // Write to audit log (NDJSON format for streaming)
  try {
    const logLine = JSON.stringify(auditEntry) + "\n";
    appendFileSync(CURRENT_LOG_FILE, logLine, "utf8");
  } catch (error) {
    console.error("CRITICAL: Failed to write audit log:", error.message);
    // In production, this should trigger an alert
  }

  // Console output for monitoring
  const logLevel =
    event.severity === AuditSeverity.CRITICAL || event.severity === AuditSeverity.ERROR
      ? "error"
      : "log";
  console[logLevel](`[AUDIT] ${event.type} | ${event.actor} | ${event.action}`);

  return auditEntry;
}

/**
 * Query audit logs
 * HIPAA requires ability to review audit logs
 */
export function queryAuditLogs(filters = {}) {
  const logs = [];

  if (!existsSync(CURRENT_LOG_FILE)) {
    return logs;
  }

  try {
    const content = readFileSync(CURRENT_LOG_FILE, "utf8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        // Apply filters
        if (filters.type && entry.type !== filters.type) continue;
        if (filters.actor && entry.actor !== filters.actor) continue;
        if (filters.resource && entry.resource !== filters.resource) continue;
        if (filters.severity && entry.severity !== filters.severity) continue;
        if (filters.startDate && new Date(entry.timestamp) < new Date(filters.startDate)) continue;
        if (filters.endDate && new Date(entry.timestamp) > new Date(filters.endDate)) continue;

        logs.push(entry);
      } catch (error) {
        console.error("Failed to parse audit log entry:", error.message);
      }
    }
  } catch (error) {
    console.error("Failed to read audit logs:", error.message);
  }

  // Sort by timestamp (newest first)
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return logs;
}

/**
 * Verify audit log integrity
 * Ensures logs haven't been tampered with
 */
export function verifyAuditIntegrity() {
  if (!existsSync(CURRENT_LOG_FILE)) {
    return { valid: true, message: "No audit logs to verify" };
  }

  try {
    const logs = queryAuditLogs();
    const result = hashChain.verify(logs);

    if (result.valid) {
      return {
        valid: true,
        message: `Verified ${logs.length} audit entries`,
        count: logs.length,
      };
    } else {
      // CRITICAL: Log tampering detected
      logAuditEvent({
        type: AuditEventType.SECURITY_ALERT,
        severity: AuditSeverity.CRITICAL,
        actor: "system",
        action: "Audit log tampering detected",
        metadata: { error: result.error },
      });

      return {
        valid: false,
        message: result.error,
        compromisedEntry: result.entry,
      };
    }
  } catch (error) {
    return {
      valid: false,
      message: `Verification failed: ${error.message}`,
    };
  }
}

/**
 * Archive old audit logs (HIPAA requires 6-year retention)
 */
export function archiveAuditLogs() {
  if (!existsSync(CURRENT_LOG_FILE)) {
    return { success: false, message: "No logs to archive" };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveFile = join(AUDIT_DIR, `audit-archive-${timestamp}.ndjson`);

  try {
    // Copy current log to archive
    const content = readFileSync(CURRENT_LOG_FILE, "utf8");
    writeFileSync(archiveFile, content);

    // Clear current log (start fresh)
    writeFileSync(CURRENT_LOG_FILE, "");

    // Reset hash chain
    hashChain.chain = { lastHash: null, count: 0 };
    hashChain.saveChain();

    logAuditEvent({
      type: AuditEventType.BACKUP_CREATED,
      severity: AuditSeverity.INFO,
      actor: "system",
      action: `Audit logs archived to ${archiveFile}`,
    });

    return {
      success: true,
      archiveFile,
      message: "Audit logs archived successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: `Archive failed: ${error.message}`,
    };
  }
}

/**
 * Generate audit report for compliance
 */
export function generateComplianceReport(startDate, endDate) {
  const logs = queryAuditLogs({ startDate, endDate });

  const report = {
    period: { startDate, endDate },
    generatedAt: new Date().toISOString(),
    totalEvents: logs.length,
    eventsByType: {},
    eventsBySeverity: {},
    phiAccessCount: 0,
    failedLogins: 0,
    accessDenials: 0,
    securityAlerts: 0,
    uniqueUsers: new Set(),
  };

  for (const log of logs) {
    // Count by type
    report.eventsByType[log.type] = (report.eventsByType[log.type] || 0) + 1;

    // Count by severity
    report.eventsBySeverity[log.severity] = (report.eventsBySeverity[log.severity] || 0) + 1;

    // Track unique users
    if (log.actor !== "system") {
      report.uniqueUsers.add(log.actor);
    }

    // Count specific events
    if (log.type.includes("phi_")) report.phiAccessCount++;
    if (log.type === AuditEventType.LOGIN_FAILED) report.failedLogins++;
    if (log.type === AuditEventType.ACCESS_DENIED) report.accessDenials++;
    if (log.severity === AuditSeverity.CRITICAL) report.securityAlerts++;
  }

  report.uniqueUsers = report.uniqueUsers.size;

  // Log report generation
  logAuditEvent({
    type: AuditEventType.COMPLIANCE_REPORT_GENERATED,
    severity: AuditSeverity.INFO,
    actor: "system",
    action: "Generated compliance audit report",
    metadata: { period: report.period, eventCount: report.totalEvents },
  });

  return report;
}

/**
 * Middleware for automatic audit logging of HTTP requests
 */
export function auditMiddleware(req, res, next) {
  const startTime = Date.now();

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;

    // Log API access
    if (req.path.includes("/api/") && req.user) {
      const isPHI =
        req.path.includes("patient") ||
        req.path.includes("medical") ||
        req.path.includes("prescription") ||
        req.path.includes("lab");

      logAuditEvent({
        type: isPHI ? AuditEventType.PHI_ACCESS : AuditEventType.ACCESS_GRANTED,
        severity: AuditSeverity.INFO,
        actor: req.user.email || req.user.did || "anonymous",
        action: `${req.method} ${req.path}`,
        resource: req.params.id || req.query.id || null,
        resourceType: req.path.split("/")[2] || null,
        success: res.statusCode < 400,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"],
        metadata: {
          method: req.method,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
        },
      });
    }

    return originalSend.call(this, data);
  };

  next();
}
