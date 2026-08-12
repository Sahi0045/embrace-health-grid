/**
 * Centralized Audit Trail & Blockchain Proof Server Functions
 * Embrace Health Grid
 *
 * This module is the SINGLE source of truth for writing audit records.
 * All other server functions (admissions, prescriptions, certifications,
 * bed management) call writeAuditRecord() from here rather than maintaining
 * their own audit logic.
 *
 * Architecture
 * ─────────────
 *
 *  Operational Event (admit patient, update prescription, etc.)
 *       │
 *       ▼
 *  writeAuditRecord()       ← this file
 *       │
 *       ├─ 1. Calls write_audit_record() Postgres function (security definer)
 *       │      Inserts rich audit row + computes SHA-256 hash in DB
 *       │      Enqueues row in audit_anchor_queue
 *       │
 *       └─ 2. (Async) processAuditAnchorQueue() called separately
 *                   Reads unprocessed queue rows
 *                   Calls anchor-record Edge Function (Solana)
 *                   Updates audit_events.anchor_status = 'anchored'
 *
 * Data Privacy
 * ─────────────
 * The SHA-256 hash covers ONLY non-PHI fields:
 *   action | outcome | who_role | what_module | entity_id | where_hospital | logged_at
 *
 * Sensitive data (prev_value, new_value, metadata) lives ONLY in Postgres.
 * Only the hash goes on-chain — never PHI.
 *
 * Verification
 * ─────────────
 *  verifyAuditRecord(txId) re-computes the hash server-side and compares to:
 *    1. The stored record_hash in audit_events (DB-level integrity)
 *    2. The on-chain anchor record_hash in solana_anchors (chain-level integrity)
 *
 * If both match → tamper-evident proof that the record is unchanged.
 */

import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditEntry {
  /** WHO performed the action */
  actorId:       string | null;
  actorDid:      string | null;
  actorName:     string | null;
  actorRole:     string | null;
  actorHospital: string | null;
  actorEmail:    string | null;

  /** WHAT was done */
  action:        string;          // e.g. "PATIENT_ADMITTED", "PRESCRIPTION_UPDATED"
  outcome:       "success" | "failure" | "unauthorized";
  severity:      "info" | "warning" | "critical";
  module:        string;          // e.g. "admissions", "prescriptions", "beds"
  entityId:      string | null;   // ID of the affected record
  entityType:    string | null;   // e.g. "admission", "prescription", "bed"
  resource:      string | null;   // Human-readable label, e.g. "Admission ADM-00001234"

  /** WHERE it happened */
  hospital:      string | null;   // Hospital name or ID
  location:      string | null;   // e.g. "Admin Portal → Admissions"

  /** PREVIOUS and NEW state (PHI stays in DB only) */
  prevValue:     Record<string, unknown> | null;
  newValue:      Record<string, unknown> | null;

  /** AUTHORIZATION context */
  authStatus:    "authorized" | "unauthorized" | "elevated";
  authPolicy:    string | null;   // e.g. "admissions_insert_staff"

  /** Extra metadata */
  metadata:      Record<string, unknown>;
}

export interface AuditResult {
  txId:        string;
  recordHash:  string | null;
  anchorQueued: boolean;
}

export interface VerifyResult {
  verified:       boolean;
  dbIntegrity:    "OK" | "FAIL" | "unknown" | "pending";
  chainIntegrity: "OK" | "FAIL" | "pending" | "not_queued";
  anchorStatus:   string | null;
  signature:      string | null;
  slot:           number | null;
  storedHash:     string | null;
  chainHash:      string | null;
  explorerUrl:    string | null;
  reason:         string | null;
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
  userId:     string | null;
  actorDid:   string | null;
  actorName:  string | null;
  actorRole:  string | null;
  hospital:   string | null;
  email:      string | null;
}> {
  try {
    const user = await getVerifiedUser();
    if (!user) return { userId: null, actorDid: null, actorName: null, actorRole: null, hospital: null, email: null };

    const supabase = getSupabaseServerClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("primary_did, full_name, role, hospital_id, email")
      .eq("id", user.id)
      .maybeSingle();

    return {
      userId:    user.id,
      actorDid:  profile?.primary_did ?? null,
      actorName: profile?.full_name   ?? null,
      actorRole: profile?.role        ?? null,
      hospital:  profile?.hospital_id ?? null,
      email:     profile?.email       ?? user.email ?? null,
    };
  } catch {
    return { userId: null, actorDid: null, actorName: null, actorRole: null, hospital: null, email: null };
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
    p_actor_id:         entry.actorId,
    p_actor_did:        entry.actorDid,
    p_who_name:         entry.actorName,
    p_who_role:         entry.actorRole,
    p_who_hospital_id:  entry.actorHospital,
    p_who_email:        entry.actorEmail,
    p_resource:         entry.resource,
    p_action:           entry.action,
    p_outcome:          entry.outcome,
    p_severity:         entry.severity,
    p_what_module:      entry.module,
    p_what_entity_id:   entry.entityId,
    p_what_entity_type: entry.entityType,
    p_where_hospital:   entry.hospital,
    p_where_location:   entry.location,
    p_prev_value:       entry.prevValue  ? JSON.stringify(entry.prevValue)  : null,
    p_new_value:        entry.newValue   ? JSON.stringify(entry.newValue)   : null,
    p_auth_status:      entry.authStatus,
    p_auth_policy:      entry.authPolicy,
    p_metadata:         JSON.stringify(entry.metadata ?? {}),
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
    recordHash:   row?.record_hash ?? null,
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
export const getAuditTrail = createServerFn({ method: "GET" })
  .validator((data: {
    module?:    string;
    entityId?:  string;
    actorId?:   string;
    severity?:  string;
    outcome?:   string;
    from?:      string;
    to?:        string;
    limit?:     number;
    offset?:    number;
  }) => data ?? {})
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("audit_events")
      .select(`
        tx_id,
        actor_id,
        actor_did,
        resource,
        action,
        outcome,
        severity,
        metadata,
        logged_at,
        who_name,
        who_role,
        who_hospital_id,
        who_email,
        what_module,
        what_entity_id,
        what_entity_type,
        where_hospital,
        where_location,
        prev_value,
        new_value,
        auth_status,
        auth_policy,
        record_hash,
        anchor_id,
        anchor_status
      `)
      .order("logged_at", { ascending: false })
      .limit(data.limit ?? 200);

    if (data.offset)   query = query.range(data.offset, data.offset + (data.limit ?? 200) - 1);
    if (data.module)   query = query.eq("what_module",  data.module);
    if (data.entityId) query = query.eq("what_entity_id", data.entityId);
    if (data.actorId)  query = query.eq("actor_id",     data.actorId);
    if (data.severity) query = query.eq("severity",     data.severity);
    if (data.outcome)  query = query.eq("outcome",      data.outcome);
    if (data.from)     query = query.gte("logged_at",   data.from);
    if (data.to)       query = query.lte("logged_at",   data.to);

    const { data: events, error } = await query;
    if (error) throw new Error(error.message);
    return { events: events ?? [], total: events?.length ?? 0 };
  });

// ─── verifyAuditRecord (server function) ─────────────────────────────────────

/**
 * Verify the integrity of an audit record.
 *
 * Calls verify_audit_record() Postgres function which:
 *   1. Recomputes the SHA-256 from stored fields
 *   2. Compares to stored record_hash → DB integrity
 *   3. If anchored, compares to solana_anchors.record_hash → chain integrity
 *
 * Returns structured result with Solana explorer link if available.
 */
export const verifyAuditRecord = createServerFn({ method: "GET" })
  .validator((data: { txId: string }) => {
    if (!data?.txId) throw new Error("txId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: result, error } = await supabase
      .rpc("verify_audit_record", { p_tx_id: data.txId });

    if (error) throw new Error(error.message);

    const r = result as Record<string, unknown>;
    return {
      txId:           data.txId,
      verified:       Boolean(r.verified),
      dbIntegrity:    (r.db_integrity    ?? "unknown") as VerifyResult["dbIntegrity"],
      chainIntegrity: (r.chain_integrity ?? "not_queued") as VerifyResult["chainIntegrity"],
      anchorStatus:   (r.anchor_status   as string) ?? null,
      signature:      (r.signature       as string) ?? null,
      slot:           (r.slot            as number) ?? null,
      storedHash:     (r.stored_hash     as string) ?? null,
      chainHash:      (r.chain_hash      as string) ?? null,
      explorerUrl:    (r.explorer        as string) ?? null,
      reason:         (r.reason          as string) ?? null,
    } satisfies VerifyResult & { txId: string };
  });

// ─── processAuditAnchorQueue (server function) ───────────────────────────────

/**
 * Process pending blockchain anchor jobs.
 *
 * Reads unprocessed rows from audit_anchor_queue and calls the anchor-record
 * Edge Function for each one. Updates audit_events.anchor_status on completion.
 *
 * Called manually from the admin audit page ("Anchor Pending" button) or can
 * be scheduled via a cron job / Supabase pg_cron.
 *
 * Limited to 10 rows per call to avoid Edge Function timeout.
 */
export const processAuditAnchorQueue = createServerFn({ method: "POST" })
  .validator((data: { limit?: number }) => data ?? {})
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // Only admins can trigger batch anchoring
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, primary_did")
      .eq("id", (await getVerifiedUser())!.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      throw new Error("Only administrators can process the anchor queue");
    }

    const { data: queue, error: qErr } = await supabase
      .from("audit_anchor_queue")
      .select("queue_id, tx_id, actor_did, record_hash, record_type, attempts")
      .is("processed_at", null)
      .lt("attempts", 3)            // max 3 retry attempts
      .order("queued_at", { ascending: true })
      .limit(data.limit ?? 10);

    if (qErr) throw new Error(qErr.message);
    if (!queue?.length) return { processed: 0, anchored: 0, failed: 0, skipped: 0 };

    let anchored = 0, failed = 0;

    for (const job of queue) {
      // Increment attempt count first so a crash mid-way doesn't loop forever
      await supabase
        .from("audit_anchor_queue")
        .update({ attempts: job.attempts + 1 })
        .eq("queue_id", job.queue_id);

      try {
        // Call the existing anchor-record Edge Function
        const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
        const anonKey     = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("No session token for anchoring");

        const res = await fetch(`${supabaseUrl}/functions/v1/anchor-record`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey:          anonKey,
            Authorization:   `Bearer ${token}`,
          },
          body: JSON.stringify({
            subjectDid:  job.actor_did,
            recordHash:  job.record_hash,
            recordType:  job.record_type,
            recordId:    job.tx_id,
          }),
        });

        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) {
          throw new Error(body?.error ?? `Anchor failed: HTTP ${res.status}`);
        }

        // Update audit_events with the anchor reference
        await supabase.rpc("mark_audit_anchored", {
          p_tx_id:     job.tx_id,
          p_anchor_id: body.anchorId,
          p_status:    "anchored",
        });

        anchored++;
      } catch (err) {
        // Mark failed if max attempts reached
        if (job.attempts + 1 >= 3) {
          await supabase.rpc("mark_audit_anchored", {
            p_tx_id:     job.tx_id,
            p_anchor_id: null,
            p_status:    "failed",
          });
          await supabase
            .from("audit_anchor_queue")
            .update({ last_error: (err as Error).message })
            .eq("queue_id", job.queue_id);
        }
        failed++;
      }
    }

    return {
      processed: queue.length,
      anchored,
      failed,
      skipped:   queue.length - anchored - failed,
    };
  });

// ─── getAuditStats ────────────────────────────────────────────────────────────

/** Dashboard statistics for the audit viewer. */
export const getAuditStats = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const counted = async (filter: Record<string, string>) => {
    let q = supabase.from("audit_events").select("*", { count: "exact", head: true });
    for (const [col, val] of Object.entries(filter)) {
      q = (q as any).eq(col, val);
    }
    const { count } = await q;
    return count ?? 0;
  };

  const [total, failures, critical, unauthorized, anchored, pending] = await Promise.all([
    counted({}),
    counted({ outcome: "failure" }),
    counted({ severity: "critical" }),
    counted({ auth_status: "unauthorized" }),
    counted({ anchor_status: "anchored" }),
    counted({ anchor_status: "pending" }),
  ]);

  return { total, failures, critical, unauthorized, anchored, pendingAnchors: pending };
});

// ─── Pre-built audit helpers for each module ─────────────────────────────────
// These build the correct AuditEntry structure so callers don't need to know
// the field names. Each function returns an AuditEntry ready for tryWriteAudit().

export function buildAdmissionAudit(
  caller: { userId: string | null; actorDid: string | null; actorName: string | null; actorRole: string | null; hospital: string | null; email: string | null },
  action: "PATIENT_ADMITTED" | "PATIENT_DISCHARGED" | "PATIENT_TRANSFERRED",
  admissionId: string,
  patientDid: string,
  prev: Record<string, unknown> | null,
  next: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): AuditEntry {
  const labels: Record<string, string> = {
    PATIENT_ADMITTED:    "Patient admitted to hospital",
    PATIENT_DISCHARGED:  "Patient discharged from hospital",
    PATIENT_TRANSFERRED: "Patient transferred to new ward/bed",
  };
  return {
    actorId:       caller.userId,
    actorDid:      caller.actorDid,
    actorName:     caller.actorName,
    actorRole:     caller.actorRole,
    actorHospital: caller.hospital,
    actorEmail:    caller.email,
    action,
    outcome:       "success",
    severity:      "info",
    module:        "admissions",
    entityId:      admissionId,
    entityType:    "admission",
    resource:      `Admission ${admissionId} — Patient ${patientDid.slice(-8)}`,
    hospital:      caller.hospital,
    location:      "Admin Portal → Admissions Management",
    prevValue:     prev,
    newValue:      next,
    authStatus:    "authorized",
    authPolicy:    "admissions_insert_staff",
    metadata:      { description: labels[action], patientDid, ...extra },
  };
}

export function buildPrescriptionAudit(
  caller: { userId: string | null; actorDid: string | null; actorName: string | null; actorRole: string | null; hospital: string | null; email: string | null },
  rxId: string,
  prev: Record<string, unknown> | null,
  next: Record<string, unknown>,
): AuditEntry {
  return {
    actorId:       caller.userId,
    actorDid:      caller.actorDid,
    actorName:     caller.actorName,
    actorRole:     caller.actorRole,
    actorHospital: caller.hospital,
    actorEmail:    caller.email,
    action:        "PRESCRIPTION_UPDATED",
    outcome:       "success",
    severity:      "info",
    module:        "prescriptions",
    entityId:      rxId,
    entityType:    "prescription",
    resource:      `Prescription ${rxId}`,
    hospital:      caller.hospital,
    location:      "Admin Portal → Prescription Management",
    prevValue:     prev,
    newValue:      next,
    authStatus:    "authorized",
    authPolicy:    "prescriptions_update_admin",
    metadata:      { description: "Hospital admin modified prescription details" },
  };
}

export function buildCertificationAudit(
  caller: { userId: string | null; actorDid: string | null; actorName: string | null; actorRole: string | null; hospital: string | null; email: string | null },
  action: "CERTIFICATION_CREATED" | "CERTIFICATION_UPDATED" | "CERTIFICATION_DELETED",
  certId: string,
  staffDid: string,
  prev: Record<string, unknown> | null,
  next: Record<string, unknown> | null,
): AuditEntry {
  const labels: Record<string, string> = {
    CERTIFICATION_CREATED: "New certification added for staff member",
    CERTIFICATION_UPDATED: "Existing certification details modified",
    CERTIFICATION_DELETED: "Certification removed from staff record",
  };
  return {
    actorId:       caller.userId,
    actorDid:      caller.actorDid,
    actorName:     caller.actorName,
    actorRole:     caller.actorRole,
    actorHospital: caller.hospital,
    actorEmail:    caller.email,
    action,
    outcome:       "success",
    severity:      action === "CERTIFICATION_DELETED" ? "warning" : "info",
    module:        "certifications",
    entityId:      certId,
    entityType:    "certification",
    resource:      `Certification ${certId} — Staff ${staffDid.slice(-8)}`,
    hospital:      caller.hospital,
    location:      "Admin Portal → Certifications & Qualifications",
    prevValue:     prev,
    newValue:      next,
    authStatus:    "authorized",
    authPolicy:    "staff_certifications_insert_admin",
    metadata:      { description: labels[action], staffDid },
  };
}

export function buildBedAudit(
  caller: { userId: string | null; actorDid: string | null; actorName: string | null; actorRole: string | null; hospital: string | null; email: string | null },
  bedId: string,
  prevStatus: string,
  newStatus: string,
  extra: Record<string, unknown> = {},
): AuditEntry {
  return {
    actorId:       caller.userId,
    actorDid:      caller.actorDid,
    actorName:     caller.actorName,
    actorRole:     caller.actorRole,
    actorHospital: caller.hospital,
    actorEmail:    caller.email,
    action:        "BED_STATUS_CHANGED",
    outcome:       "success",
    severity:      "info",
    module:        "beds",
    entityId:      bedId,
    entityType:    "bed",
    resource:      `Bed ${bedId}`,
    hospital:      caller.hospital,
    location:      "Admin Portal → Bed & Room Management",
    prevValue:     { status: prevStatus },
    newValue:      { status: newStatus, ...extra },
    authStatus:    "authorized",
    authPolicy:    "beds_update_staff",
    metadata:      { description: `Bed status changed from ${prevStatus} to ${newStatus}`, ...extra },
  };
}

export function buildRoomAudit(
  caller: { userId: string | null; actorDid: string | null; actorName: string | null; actorRole: string | null; hospital: string | null; email: string | null },
  roomId: string,
  prevStatus: string,
  newStatus: string,
): AuditEntry {
  return {
    actorId:       caller.userId,
    actorDid:      caller.actorDid,
    actorName:     caller.actorName,
    actorRole:     caller.actorRole,
    actorHospital: caller.hospital,
    actorEmail:    caller.email,
    action:        "ROOM_STATUS_CHANGED",
    outcome:       "success",
    severity:      "info",
    module:        "rooms",
    entityId:      roomId,
    entityType:    "room",
    resource:      `Room ${roomId}`,
    hospital:      caller.hospital,
    location:      "Admin Portal → Bed & Room Management",
    prevValue:     { status: prevStatus },
    newValue:      { status: newStatus },
    authStatus:    "authorized",
    authPolicy:    "rooms_update_staff",
    metadata:      { description: `Room status changed from ${prevStatus} to ${newStatus}` },
  };
}
