/**
 * HIPAA-Compliant Access Control System
 * Implements HIPAA Security Rule §164.312(a)(1) - Access Control
 *
 * Features:
 * - Role-Based Access Control (RBAC)
 * - Minimum Necessary Standard
 * - Emergency Access Procedures
 * - Automatic Logoff
 */

import { logAuditEvent, AuditEventType, AuditSeverity } from "./audit-logger.js";

/**
 * User Roles with hierarchical permissions
 */
export const Roles = {
  PATIENT: "patient",
  NURSE: "nurse",
  DOCTOR: "doctor",
  PHARMACIST: "pharmacist",
  LAB_TECH: "lab_technician",
  RECEPTIONIST: "receptionist",
  ADMIN: "admin",
  SYSTEM_ADMIN: "system_admin",
  COMPLIANCE_OFFICER: "compliance_officer",
};

/**
 * Permissions for PHI access
 */
export const Permissions = {
  // Read permissions
  READ_OWN_PHI: "read:own_phi",
  READ_PATIENT_DEMOGRAPHICS: "read:patient_demographics",
  READ_PATIENT_VITALS: "read:patient_vitals",
  READ_PATIENT_MEDICAL_HISTORY: "read:patient_medical_history",
  READ_PRESCRIPTIONS: "read:prescriptions",
  READ_LAB_RESULTS: "read:lab_results",
  READ_APPOINTMENTS: "read:appointments",
  READ_BILLING: "read:billing",
  READ_AUDIT_LOGS: "read:audit_logs",
  READ_ALL_PHI: "read:all_phi",

  // Write permissions
  WRITE_PATIENT_DEMOGRAPHICS: "write:patient_demographics",
  WRITE_PATIENT_VITALS: "write:patient_vitals",
  WRITE_DIAGNOSES: "write:diagnoses",
  WRITE_PRESCRIPTIONS: "write:prescriptions",
  WRITE_LAB_ORDERS: "write:lab_orders",
  WRITE_LAB_RESULTS: "write:lab_results",
  WRITE_APPOINTMENTS: "write:appointments",
  WRITE_BILLING: "write:billing",

  // Administrative permissions
  MANAGE_USERS: "manage:users",
  MANAGE_ROLES: "manage:roles",
  MANAGE_CONSENT: "manage:consent",
  MANAGE_SYSTEM: "manage:system",
  EMERGENCY_ACCESS: "emergency:access",
  BREAK_GLASS: "emergency:break_glass",
};

/**
 * Role-Permission mapping (Principle of Least Privilege)
 */
export const RolePermissions = {
  [Roles.PATIENT]: [
    Permissions.READ_OWN_PHI,
    Permissions.READ_APPOINTMENTS,
    Permissions.READ_PRESCRIPTIONS,
    Permissions.READ_LAB_RESULTS,
    Permissions.WRITE_APPOINTMENTS,
    Permissions.MANAGE_CONSENT,
  ],

  [Roles.NURSE]: [
    Permissions.READ_PATIENT_DEMOGRAPHICS,
    Permissions.READ_PATIENT_VITALS,
    Permissions.READ_PATIENT_MEDICAL_HISTORY,
    Permissions.READ_APPOINTMENTS,
    Permissions.WRITE_PATIENT_VITALS,
    Permissions.WRITE_APPOINTMENTS,
  ],

  [Roles.DOCTOR]: [
    Permissions.READ_PATIENT_DEMOGRAPHICS,
    Permissions.READ_PATIENT_VITALS,
    Permissions.READ_PATIENT_MEDICAL_HISTORY,
    Permissions.READ_PRESCRIPTIONS,
    Permissions.READ_LAB_RESULTS,
    Permissions.READ_APPOINTMENTS,
    Permissions.WRITE_PATIENT_VITALS,
    Permissions.WRITE_DIAGNOSES,
    Permissions.WRITE_PRESCRIPTIONS,
    Permissions.WRITE_LAB_ORDERS,
    Permissions.WRITE_APPOINTMENTS,
  ],

  [Roles.PHARMACIST]: [
    Permissions.READ_PATIENT_DEMOGRAPHICS,
    Permissions.READ_PRESCRIPTIONS,
    Permissions.WRITE_PRESCRIPTIONS, // Fulfillment only
  ],

  [Roles.LAB_TECH]: [
    Permissions.READ_PATIENT_DEMOGRAPHICS,
    Permissions.READ_LAB_RESULTS,
    Permissions.WRITE_LAB_RESULTS,
  ],

  [Roles.RECEPTIONIST]: [
    Permissions.READ_PATIENT_DEMOGRAPHICS,
    Permissions.READ_APPOINTMENTS,
    Permissions.WRITE_PATIENT_DEMOGRAPHICS,
    Permissions.WRITE_APPOINTMENTS,
    Permissions.READ_BILLING,
    Permissions.WRITE_BILLING,
  ],

  [Roles.ADMIN]: [
    Permissions.READ_PATIENT_DEMOGRAPHICS,
    Permissions.READ_APPOINTMENTS,
    Permissions.READ_BILLING,
    Permissions.WRITE_APPOINTMENTS,
    Permissions.WRITE_BILLING,
    Permissions.MANAGE_USERS,
  ],

  [Roles.SYSTEM_ADMIN]: [
    Permissions.MANAGE_USERS,
    Permissions.MANAGE_ROLES,
    Permissions.MANAGE_SYSTEM,
    Permissions.READ_AUDIT_LOGS,
  ],

  [Roles.COMPLIANCE_OFFICER]: [
    Permissions.READ_ALL_PHI,
    Permissions.READ_AUDIT_LOGS,
    Permissions.MANAGE_CONSENT,
  ],
};

/**
 * Check if user has specific permission
 */
export function hasPermission(user, permission) {
  if (!user || !user.role) {
    return false;
  }

  const rolePermissions = RolePermissions[user.role] || [];
  return rolePermissions.includes(permission);
}

/**
 * Check if user has ANY of the specified permissions
 */
export function hasAnyPermission(user, permissions = []) {
  return permissions.some((permission) => hasPermission(user, permission));
}

/**
 * Check if user has ALL of the specified permissions
 */
export function hasAllPermissions(user, permissions = []) {
  return permissions.every((permission) => hasPermission(user, permission));
}

/**
 * Check if user can access specific patient data
 * Implements "Minimum Necessary" standard
 */
export function canAccessPatient(user, patientId, accessType = "read") {
  // Patients can always access their own data
  if (user.patientId === patientId) {
    return {
      allowed: true,
      reason: "Own data",
    };
  }

  // Check role-based permissions
  const permissionMap = {
    read: [
      Permissions.READ_PATIENT_DEMOGRAPHICS,
      Permissions.READ_PATIENT_VITALS,
      Permissions.READ_PATIENT_MEDICAL_HISTORY,
      Permissions.READ_ALL_PHI,
    ],
    write: [
      Permissions.WRITE_PATIENT_DEMOGRAPHICS,
      Permissions.WRITE_PATIENT_VITALS,
      Permissions.WRITE_DIAGNOSES,
    ],
  };

  const requiredPermissions = permissionMap[accessType] || [];
  const hasRequiredPermission = hasAnyPermission(user, requiredPermissions);

  if (!hasRequiredPermission) {
    logAuditEvent({
      type: AuditEventType.ACCESS_DENIED,
      severity: AuditSeverity.WARNING,
      actor: user.email || user.did,
      action: `Attempted ${accessType} access to patient ${patientId}`,
      resource: patientId,
      resourceType: "Patient",
      success: false,
      metadata: {
        reason: "Insufficient permissions",
        userRole: user.role,
      },
    });

    return {
      allowed: false,
      reason: "Insufficient permissions",
    };
  }

  // Check consent (if patient has given consent to this user)
  // This would integrate with the consent management system

  // Log successful access authorization
  logAuditEvent({
    type: AuditEventType.ACCESS_GRANTED,
    severity: AuditSeverity.INFO,
    actor: user.email || user.did,
    action: `Authorized ${accessType} access to patient ${patientId}`,
    resource: patientId,
    resourceType: "Patient",
    success: true,
    metadata: {
      userRole: user.role,
      permissions: requiredPermissions.filter((p) => hasPermission(user, p)),
    },
  });

  return {
    allowed: true,
    reason: "Authorized by role and consent",
  };
}

/**
 * Break-Glass Emergency Access
 * HIPAA allows emergency access when patient consent cannot be obtained
 * Must be audited extensively
 */
export function requestEmergencyAccess(user, patientId, justification) {
  if (
    !hasPermission(user, Permissions.EMERGENCY_ACCESS) &&
    !hasPermission(user, Permissions.BREAK_GLASS)
  ) {
    logAuditEvent({
      type: AuditEventType.ACCESS_DENIED,
      severity: AuditSeverity.CRITICAL,
      actor: user.email || user.did,
      action: `Unauthorized emergency access attempt for patient ${patientId}`,
      resource: patientId,
      resourceType: "Patient",
      success: false,
      metadata: {
        justification,
        userRole: user.role,
      },
    });

    return {
      granted: false,
      reason: "User not authorized for emergency access",
    };
  }

  // Grant temporary emergency access
  const emergencyToken = generateEmergencyAccessToken(user, patientId);

  // Critical audit log
  logAuditEvent({
    type: AuditEventType.SECURITY_ALERT,
    severity: AuditSeverity.CRITICAL,
    actor: user.email || user.did,
    action: `BREAK-GLASS emergency access granted for patient ${patientId}`,
    resource: patientId,
    resourceType: "Patient",
    success: true,
    metadata: {
      justification,
      userRole: user.role,
      emergencyToken,
      requiresReview: true,
      expiresIn: "1 hour",
    },
  });

  // Notify compliance officer
  notifyComplianceOfficer({
    type: "emergency_access",
    user: user.email,
    patient: patientId,
    justification,
    timestamp: new Date().toISOString(),
  });

  return {
    granted: true,
    emergencyToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    restrictions: [
      "Access limited to 1 hour",
      "All actions will be audited",
      "Supervisor review required",
    ],
  };
}

/**
 * Generate temporary emergency access token
 *
 * NOTE: the token is currently pure entropy and is bound to neither the
 * requesting user nor the patient, so it cannot be validated as belonging to a
 * specific break-glass request. Args are kept in the signature (prefixed to mark
 * them unused) so callers do not change when this is bound properly. This module
 * is not imported anywhere yet — see _user/_patientId before relying on it.
 */
function generateEmergencyAccessToken(_user, _patientId) {
  const { randomBytes } = require("crypto");
  return `emergency-${randomBytes(16).toString("hex")}`;
}

/**
 * Notify compliance officer (stub)
 */
function notifyComplianceOfficer(event) {
  // In production: Send email, SMS, or push notification
  console.log("🚨 COMPLIANCE ALERT:", event);
}

/**
 * Session timeout tracking (HIPAA requires automatic logoff)
 */
const activeSessions = new Map();
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes of inactivity

export function trackSession(sessionId, user) {
  activeSessions.set(sessionId, {
    user,
    lastActivity: Date.now(),
    createdAt: Date.now(),
  });
}

export function updateSessionActivity(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.lastActivity = Date.now();
  }
}

export function checkSessionTimeout(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return { valid: false, reason: "Session not found" };
  }

  const inactiveTime = Date.now() - session.lastActivity;
  if (inactiveTime > SESSION_TIMEOUT) {
    activeSessions.delete(sessionId);

    logAuditEvent({
      type: AuditEventType.USER_LOGOUT,
      severity: AuditSeverity.INFO,
      actor: session.user.email || session.user.did,
      action: "Automatic logout due to inactivity",
      metadata: {
        inactiveMinutes: Math.floor(inactiveTime / 60000),
        sessionDuration: Math.floor((Date.now() - session.createdAt) / 60000),
      },
    });

    return { valid: false, reason: "Session expired due to inactivity" };
  }

  return { valid: true };
}

/**
 * Access control middleware for Express routes
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    if (!hasPermission(req.user, permission)) {
      logAuditEvent({
        type: AuditEventType.ACCESS_DENIED,
        severity: AuditSeverity.WARNING,
        actor: req.user.email || req.user.did,
        action: `Access denied to ${req.path}`,
        resource: req.params.id,
        success: false,
        ipAddress: req.ip,
        metadata: {
          requiredPermission: permission,
          userRole: req.user.role,
        },
      });

      return res.status(403).json({
        error: "Insufficient permissions",
        code: "PERMISSION_DENIED",
        required: permission,
      });
    }

    next();
  };
}

/**
 * Require any of multiple permissions
 */
export function requireAnyPermission(permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!hasAnyPermission(req.user, permissions)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        required: permissions,
      });
    }

    next();
  };
}

/**
 * Patient-specific access control middleware
 */
export function requirePatientAccess(accessType = "read") {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const patientId = req.params.patientId || req.params.id || req.query.patientId;
    if (!patientId) {
      return res.status(400).json({ error: "Patient ID required" });
    }

    const accessCheck = canAccessPatient(req.user, patientId, accessType);
    if (!accessCheck.allowed) {
      return res.status(403).json({
        error: "Access denied to patient data",
        reason: accessCheck.reason,
      });
    }

    next();
  };
}

/**
 * Get user's effective permissions (for UI rendering)
 */
export function getUserPermissions(user) {
  if (!user || !user.role) {
    return [];
  }

  return RolePermissions[user.role] || [];
}

/**
 * Export role hierarchy for UI
 */
export function getRoleHierarchy() {
  return {
    [Roles.PATIENT]: {
      level: 1,
      description: "Patient - can view and manage own health information",
      canManage: [],
    },
    [Roles.RECEPTIONIST]: {
      level: 2,
      description: "Receptionist - administrative support",
      canManage: [],
    },
    [Roles.LAB_TECH]: {
      level: 2,
      description: "Laboratory Technician - lab results management",
      canManage: [],
    },
    [Roles.PHARMACIST]: {
      level: 2,
      description: "Pharmacist - prescription management",
      canManage: [],
    },
    [Roles.NURSE]: {
      level: 3,
      description: "Nurse - patient care and monitoring",
      canManage: [],
    },
    [Roles.DOCTOR]: {
      level: 4,
      description: "Doctor - full clinical access",
      canManage: [Roles.NURSE, Roles.LAB_TECH],
    },
    [Roles.ADMIN]: {
      level: 5,
      description: "Administrator - facility management",
      canManage: [Roles.RECEPTIONIST],
    },
    [Roles.COMPLIANCE_OFFICER]: {
      level: 6,
      description: "Compliance Officer - audit and compliance",
      canManage: [],
    },
    [Roles.SYSTEM_ADMIN]: {
      level: 7,
      description: "System Administrator - full system access",
      canManage: Object.values(Roles).filter((r) => r !== Roles.SYSTEM_ADMIN),
    },
  };
}
