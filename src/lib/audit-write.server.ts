/**
 * Audit write path and entry builders — server-only, no client surface.
 *
 * WHY THIS FILE IS SEPARATE FROM audit.server.ts
 * ──────────────────────────────────────────────
 * TanStack Start rewrites a `.server.ts` module for the client by replacing
 * every `createServerFn` export with an RPC stub and dropping the module body
 * — including its imports. That only works if EVERY export is a serverFn.
 *
 * audit.server.ts used to export nine plain functions (resolveCallerForAudit,
 * writeAuditRecord, tryWriteAudit and six build*Audit builders) alongside its
 * four serverFns. A plain function cannot be stubbed, so the client transform
 * had to keep the module body, which kept
 *
 *   import { getSupabaseServerClient } from "./supabase.server"
 *
 * and therefore `@tanstack/react-start/server`. The import-protection plugin
 * denies that in the client environment, so any client route that reached this
 * module failed to load with:
 *
 *   [import-protection] Import denied in client environment
 *   Denied by specifier pattern: @tanstack/react-start/server
 *
 * src/routes/patient.history.tsx imports `verifyAuditRecord` from
 * audit.server.ts directly, and src/lib/api.ts reaches it via
 * `await import("./audit.server")`, so both paths tripped it.
 *
 * Compare clinical/operations/inpatient/admissions.server.ts: each exports only
 * serverFns, and each has its supabase.server import stripped cleanly from the
 * client build. Keeping this file free of serverFns and audit.server.ts free of
 * plain exports is what restores that property.
 *
 * Nothing here is client-reachable: only other *.server.ts modules import it.
 */

import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditEntry {
  /** WHO performed the action */
  actorId: string | null;
  actorDid: string | null;
  actorName: string | null;
  actorRole: string | null;
  actorHospital: string | null;
  actorEmail: string | null;

  /** WHAT was done */
  action: string; // e.g. "PATIENT_ADMITTED", "PRESCRIPTION_UPDATED"
  outcome: "success" | "failure" | "unauthorized";
  severity: "info" | "warning" | "critical";
  module: string; // e.g. "admissions", "prescriptions", "beds"
  entityId: string | null; // ID of the affected record
  entityType: string | null; // e.g. "admission", "prescription", "bed"
  resource: string | null; // Human-readable label, e.g. "Admission ADM-00001234"

  /** WHERE it happened */
  hospital: string | null; // Hospital name or ID
  location: string | null; // e.g. "Admin Portal → Admissions"

  /** PREVIOUS and NEW state (PHI stays in DB only) */
  prevValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;

  /** AUTHORIZATION context */
  authStatus: "authorized" | "unauthorized" | "elevated";
  authPolicy: string | null; // e.g. "admissions_insert_staff"

  /** Extra metadata */
  metadata: Record<string, unknown>;
}

export interface AuditResult {
  txId: string;
  recordHash: string | null;
  anchorQueued: boolean;
}

export interface VerifyResult {
  verified: boolean;
  dbIntegrity: "OK" | "FAIL" | "unknown" | "pending";
  chainIntegrity: "OK" | "FAIL" | "pending" | "not_queued";
  anchorStatus: string | null;
  signature: string | null;
  slot: number | null;
  storedHash: string | null;
  chainHash: string | null;
  explorerUrl: string | null;
  reason: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireSession() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/**
 * Resolve the caller's full profile for audit context.
 * Returns null fields gracefully — audit must never block the primary action.
 */
export async function resolveCallerForAudit(): Promise<{
  userId: string | null;
  actorDid: string | null;
  actorName: string | null;
  actorRole: string | null;
  hospital: string | null;
  email: string | null;
}> {
  try {
    const user = await getVerifiedUser();
    if (!user)
      return {
        userId: null,
        actorDid: null,
        actorName: null,
        actorRole: null,
        hospital: null,
        email: null,
      };

    const supabase = getSupabaseServerClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("primary_did, full_name, role, hospital_id, email")
      .eq("id", user.id)
      .maybeSingle();

    return {
      userId: user.id,
      actorDid: profile?.primary_did ?? null,
      actorName: profile?.full_name ?? null,
      actorRole: profile?.role ?? null,
      hospital: profile?.hospital_id ?? null,
      email: profile?.email ?? user.email ?? null,
    };
  } catch {
    return {
      userId: null,
      actorDid: null,
      actorName: null,
      actorRole: null,
      hospital: null,
      email: null,
    };
  }
}

// ─── writeAuditRecord ────────────────────────────────────────────────────────

/**
 * Write a rich, structured audit record.
 *
 * Calls the write_audit_record() Postgres function (security definer) which:
 *   1. Computes the SHA-256 hash of non-PHI fields
 *   2. Inserts into audit_events
 *   3. Enqueues for blockchain anchoring
 *
 * This is fire-and-forget from the caller's perspective — audit failure must
 * NEVER propagate to the primary operation (admission, prescription update etc.).
 * Call writeAuditRecord(...).catch(() => {}) or use tryWriteAudit() below.
 */
export async function writeAuditRecord(entry: AuditEntry): Promise<AuditResult> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc("write_audit_record", {
    p_actor_id: entry.actorId,
    p_actor_did: entry.actorDid,
    p_who_name: entry.actorName,
    p_who_role: entry.actorRole,
    p_who_hospital_id: entry.actorHospital,
    p_who_email: entry.actorEmail,
    p_resource: entry.resource,
    p_action: entry.action,
    p_outcome: entry.outcome,
    p_severity: entry.severity,
    p_what_module: entry.module,
    p_what_entity_id: entry.entityId,
    p_what_entity_type: entry.entityType,
    p_where_hospital: entry.hospital,
    p_where_location: entry.location,
    p_prev_value: entry.prevValue ? JSON.stringify(entry.prevValue) : null,
    p_new_value: entry.newValue ? JSON.stringify(entry.newValue) : null,
    p_auth_status: entry.authStatus,
    p_auth_policy: entry.authPolicy,
    p_metadata: JSON.stringify(entry.metadata ?? {}),
  });

  if (error) throw new Error(`Audit write failed: ${error.message}`);

  const txId = data as string;

  // Fetch the record_hash that was computed by the DB function
  const { data: row } = await supabase
    .from("audit_events")
    .select("record_hash")
    .eq("tx_id", txId)
    .maybeSingle();

  return {
    txId,
    recordHash: row?.record_hash ?? null,
    anchorQueued: true,
  };
}

/**
 * Fire-and-forget wrapper. Swallows errors so audit never blocks primary ops.
 * Use this in every server function — audit failure must be silent to the user.
 */
export async function tryWriteAudit(entry: AuditEntry): Promise<void> {
  writeAuditRecord(entry).catch((err) => {
    // Log but never rethrow — audit is observability, not a transaction gate.
    console.error("[audit] write failed silently:", err?.message);
  });
}

// ─── getAuditTrail (server function) ─────────────────────────────────────────

/**
 * Rich audit trail query — returns the full structured data.
 * Admin sees all; staff/doctor sees own actions; patient sees own events.
 */
// the field names. Each function returns an AuditEntry ready for tryWriteAudit().

/**
 * Per-call overrides for the builders below.
 *
 * Every builder used to hardcode `outcome: "success"` and
 * `authStatus: "authorized"`, and both are inside the hashed field set. The
 * audit trail was therefore structurally incapable of recording a failure or a
 * denied attempt: getAuditStats() always returned 0 for both, and the admin
 * audit page displayed "0 Failures · 0 Unauthorized" as a compliance fact with
 * an Outcome filter that could never select anything.
 *
 * `location` was likewise a fixed string naming the admin portal, but
 * updateBedStatus is also reached from /admin/hospital-map and /staff/rooms —
 * so the recorded origin of an action was wrong more often than right.
 *
 * Defaults keep every existing call site behaving as before; a caller on a
 * failure path now has somewhere to say so.
 */
export interface AuditOverrides {
  outcome?: AuditEntry["outcome"];
  authStatus?: AuditEntry["authStatus"];
  /** The surface the action came from. Null when the caller does not know. */
  location?: string | null;
}

export function buildAdmissionAudit(
  caller: {
    userId: string | null;
    actorDid: string | null;
    actorName: string | null;
    actorRole: string | null;
    hospital: string | null;
    email: string | null;
  },
  action: "PATIENT_ADMITTED" | "PATIENT_DISCHARGED" | "PATIENT_TRANSFERRED",
  admissionId: string,
  patientDid: string,
  prev: Record<string, unknown> | null,
  next: Record<string, unknown>,
  extra: Record<string, unknown> = {},
  overrides: AuditOverrides = {},
): AuditEntry {
  const labels: Record<string, string> = {
    PATIENT_ADMITTED: "Patient admitted to hospital",
    PATIENT_DISCHARGED: "Patient discharged from hospital",
    PATIENT_TRANSFERRED: "Patient transferred to new ward/bed",
  };
  return {
    actorId: caller.userId,
    actorDid: caller.actorDid,
    actorName: caller.actorName,
    actorRole: caller.actorRole,
    actorHospital: caller.hospital,
    actorEmail: caller.email,
    action,
    outcome: "success",
    severity: "info",
    module: "admissions",
    entityId: admissionId,
    entityType: "admission",
    resource: `Admission ${admissionId} — Patient ${patientDid.slice(-8)}`,
    hospital: caller.hospital,
    location: "Admin Portal → Admissions Management",
    prevValue: prev,
    newValue: next,
    authStatus: "authorized",
    authPolicy: "admissions_insert_staff",
    metadata: { description: labels[action], patientDid, ...extra },
    ...overrides,
  };
}

export function buildPrescriptionAudit(
  caller: {
    userId: string | null;
    actorDid: string | null;
    actorName: string | null;
    actorRole: string | null;
    hospital: string | null;
    email: string | null;
  },
  rxId: string,
  prev: Record<string, unknown> | null,
  next: Record<string, unknown>,
  overrides: AuditOverrides = {},
): AuditEntry {
  return {
    actorId: caller.userId,
    actorDid: caller.actorDid,
    actorName: caller.actorName,
    actorRole: caller.actorRole,
    actorHospital: caller.hospital,
    actorEmail: caller.email,
    action: "PRESCRIPTION_UPDATED",
    outcome: "success",
    severity: "info",
    module: "prescriptions",
    entityId: rxId,
    entityType: "prescription",
    resource: `Prescription ${rxId}`,
    hospital: caller.hospital,
    location: "Admin Portal → Prescription Management",
    prevValue: prev,
    newValue: next,
    authStatus: "authorized",
    authPolicy: "prescriptions_update_admin",
    metadata: { description: "Hospital admin modified prescription details" },
    ...overrides,
  };
}

export function buildCertificationAudit(
  caller: {
    userId: string | null;
    actorDid: string | null;
    actorName: string | null;
    actorRole: string | null;
    hospital: string | null;
    email: string | null;
  },
  action: "CERTIFICATION_CREATED" | "CERTIFICATION_UPDATED" | "CERTIFICATION_DELETED",
  certId: string,
  staffDid: string,
  prev: Record<string, unknown> | null,
  next: Record<string, unknown> | null,
  overrides: AuditOverrides = {},
): AuditEntry {
  const labels: Record<string, string> = {
    CERTIFICATION_CREATED: "New certification added for staff member",
    CERTIFICATION_UPDATED: "Existing certification details modified",
    CERTIFICATION_DELETED: "Certification removed from staff record",
  };
  return {
    actorId: caller.userId,
    actorDid: caller.actorDid,
    actorName: caller.actorName,
    actorRole: caller.actorRole,
    actorHospital: caller.hospital,
    actorEmail: caller.email,
    action,
    outcome: "success",
    severity: action === "CERTIFICATION_DELETED" ? "warning" : "info",
    module: "certifications",
    entityId: certId,
    entityType: "certification",
    resource: `Certification ${certId} — Staff ${staffDid.slice(-8)}`,
    hospital: caller.hospital,
    location: "Admin Portal → Certifications & Qualifications",
    prevValue: prev,
    newValue: next,
    authStatus: "authorized",
    authPolicy: "staff_certifications_insert_admin",
    metadata: { description: labels[action], staffDid },
    ...overrides,
  };
}

export function buildBedAudit(
  caller: {
    userId: string | null;
    actorDid: string | null;
    actorName: string | null;
    actorRole: string | null;
    hospital: string | null;
    email: string | null;
  },
  bedId: string,
  prevStatus: string,
  newStatus: string,
  extra: Record<string, unknown> = {},
  overrides: AuditOverrides = {},
): AuditEntry {
  return {
    actorId: caller.userId,
    actorDid: caller.actorDid,
    actorName: caller.actorName,
    actorRole: caller.actorRole,
    actorHospital: caller.hospital,
    actorEmail: caller.email,
    action: "BED_STATUS_CHANGED",
    outcome: "success",
    severity: "info",
    module: "beds",
    entityId: bedId,
    entityType: "bed",
    resource: `Bed ${bedId}`,
    hospital: caller.hospital,
    location: "Admin Portal → Bed & Room Management",
    prevValue: { status: prevStatus },
    newValue: { status: newStatus, ...extra },
    authStatus: "authorized",
    authPolicy: "beds_update_staff",
    metadata: { description: `Bed status changed from ${prevStatus} to ${newStatus}`, ...extra },
    ...overrides,
  };
}

export function buildRoomAudit(
  caller: {
    userId: string | null;
    actorDid: string | null;
    actorName: string | null;
    actorRole: string | null;
    hospital: string | null;
    email: string | null;
  },
  roomId: string,
  prevStatus: string,
  newStatus: string,
  overrides: AuditOverrides = {},
): AuditEntry {
  return {
    actorId: caller.userId,
    actorDid: caller.actorDid,
    actorName: caller.actorName,
    actorRole: caller.actorRole,
    actorHospital: caller.hospital,
    actorEmail: caller.email,
    action: "ROOM_STATUS_CHANGED",
    outcome: "success",
    severity: "info",
    module: "rooms",
    entityId: roomId,
    entityType: "room",
    resource: `Room ${roomId}`,
    hospital: caller.hospital,
    location: "Admin Portal → Bed & Room Management",
    prevValue: { status: prevStatus },
    newValue: { status: newStatus },
    authStatus: "authorized",
    authPolicy: "rooms_update_staff",
    metadata: { description: `Room status changed from ${prevStatus} to ${newStatus}` },
    ...overrides,
  };
}

export function buildInventoryAudit(
  caller: {
    userId: string | null;
    actorDid: string | null;
    actorName: string | null;
    actorRole: string | null;
    hospital: string | null;
    email: string | null;
  },
  itemId: string,
  movementType: string,
  quantity: number,
  prevStock: number,
  newStock: number,
  extra: Record<string, unknown> = {},
  overrides: AuditOverrides = {},
): AuditEntry {
  return {
    actorId: caller.userId,
    actorDid: caller.actorDid,
    actorName: caller.actorName,
    actorRole: caller.actorRole,
    actorHospital: caller.hospital,
    actorEmail: caller.email,
    action: `STOCK_${movementType}`,
    outcome: "success",
    severity: "info",
    module: "inventory",
    entityId: itemId,
    entityType: "inventory_item",
    resource: `Inventory Item ${itemId}`,
    hospital: caller.hospital,
    location: "Admin Portal → Inventory Dashboard",
    prevValue: { stock: prevStock },
    newValue: { stock: newStock, quantity, movementType, ...extra },
    authStatus: "authorized",
    authPolicy: "stock_movements_insert",
    metadata: {
      description: `Stock movement ${movementType} of ${quantity} units recorded (${prevStock} → ${newStock})`,
      ...extra,
    },
    ...overrides,
  };
}
