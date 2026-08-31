/**
 * Centralized Audit Trail & Blockchain Proof Server Functions — Embrace Health Grid
 *
 * Exposes RPC endpoints for querying, verifying, and batch-anchoring audit events.
 * Runs on the app server via TanStack Start createServerFn.
 */

import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";
import type { VerifyResult } from "./audit-helpers.server";

export type { AuditEntry, AuditResult, VerifyResult } from "./audit-helpers.server";

async function requireSession() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ─── getAuditTrail (server function) ─────────────────────────────────────────

/**
 * Rich audit trail query — returns the full structured data.
 * Admin sees all; staff/doctor sees own actions; patient sees own events.
 */
export const getAuditTrail = createServerFn({ method: "GET" })
  .inputValidator(
    (data: {
      module?: string;
      entityId?: string;
      actorId?: string;
      severity?: string;
      outcome?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    }) => data ?? {},
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("audit_events")
      .select(
        `
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
      `,
      )
      .order("logged_at", { ascending: false })
      .limit(data.limit ?? 200);

    if (data.offset) query = query.range(data.offset, data.offset + (data.limit ?? 200) - 1);
    if (data.module) query = query.eq("what_module", data.module);
    if (data.entityId) query = query.eq("what_entity_id", data.entityId);
    if (data.actorId) query = query.eq("actor_id", data.actorId);
    if (data.severity) query = query.eq("severity", data.severity);
    if (data.outcome) query = query.eq("outcome", data.outcome);
    if (data.from) query = query.gte("logged_at", data.from);
    if (data.to) query = query.lte("logged_at", data.to);

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
  .inputValidator((data: { txId: string }) => {
    if (!data?.txId) throw new Error("txId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: result, error } = await supabase.rpc("verify_audit_record", {
      p_tx_id: data.txId,
    });

    if (error) throw new Error(error.message);

    const r = result as Record<string, unknown>;
    return {
      txId: data.txId,
      verified: Boolean(r.verified),
      dbIntegrity: (r.db_integrity ?? "unknown") as VerifyResult["dbIntegrity"],
      chainIntegrity: (r.chain_integrity ?? "not_queued") as VerifyResult["chainIntegrity"],
      anchorStatus: (r.anchor_status as string) ?? null,
      signature: (r.signature as string) ?? null,
      slot: (r.slot as number) ?? null,
      storedHash: (r.stored_hash as string) ?? null,
      chainHash: (r.chain_hash as string) ?? null,
      explorerUrl: (r.explorer as string) ?? null,
      reason: (r.reason as string) ?? null,
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
  .inputValidator((data: { limit?: number }) => data ?? {})
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
      .lt("attempts", 3) // max 3 retry attempts
      .order("queued_at", { ascending: true })
      .limit(data.limit ?? 10);

    if (qErr) throw new Error(qErr.message);
    if (!queue?.length) return { processed: 0, anchored: 0, failed: 0, skipped: 0 };

    let anchored = 0,
      failed = 0;

    for (const job of queue) {
      // Increment attempt count first so a crash mid-way doesn't loop forever.
      //
      // That only holds if the increment actually lands. Unchecked, a rejected
      // update leaves `attempts` where it was and the job is picked up again on
      // every pass — the exact runaway this line exists to prevent. Skip the
      // job rather than retry it unbounded.
      const { data: bumped, error: bumpErr } = await supabase
        .from("audit_anchor_queue")
        .update({ attempts: job.attempts + 1 })
        .eq("queue_id", job.queue_id)
        .select("queue_id");

      if (bumpErr || !bumped?.length) {
        console.warn(
          `Skipping anchor job ${job.queue_id}: attempt counter could not be advanced` +
            (bumpErr ? ` (${bumpErr.message})` : ""),
        );
        failed++;
        continue;
      }

      try {
        // Call the existing anchor-record Edge Function
        const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
        const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("No session token for anchoring");

        const res = await fetch(`${supabaseUrl}/functions/v1/anchor-record`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            subjectDid: job.actor_did,
            recordHash: job.record_hash,
            recordType: job.record_type,
            recordId: job.tx_id,
          }),
        });

        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) {
          throw new Error(body?.error ?? `Anchor failed: HTTP ${res.status}`);
        }

        // Update audit_events with the anchor reference. If this does not land
        // the record is anchored on-chain but the trail still says pending, so
        // it must not be counted as anchored.
        const { error: markErr } = await supabase.rpc("mark_audit_anchored", {
          p_tx_id: job.tx_id,
          p_anchor_id: body.anchorId,
          p_status: "anchored",
        });
        if (markErr) throw new Error(`Anchored, but not recorded: ${markErr.message}`);

        anchored++;
      } catch (err) {
        // Mark failed if max attempts reached
        if (job.attempts + 1 >= 3) {
          const { error: failMarkErr } = await supabase.rpc("mark_audit_anchored", {
            p_tx_id: job.tx_id,
            p_anchor_id: null,
            p_status: "failed",
          });
          if (failMarkErr) {
            console.warn(`Could not mark ${job.tx_id} as failed: ${failMarkErr.message}`);
          }

          const { error: noteErr } = await supabase
            .from("audit_anchor_queue")
            .update({ last_error: (err as Error).message })
            .eq("queue_id", job.queue_id);
          if (noteErr) {
            console.warn(`Could not record the failure reason: ${noteErr.message}`);
          }
        }
        failed++;
      }
    }

    return {
      processed: queue.length,
      anchored,
      failed,
      skipped: queue.length - anchored - failed,
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

  return {
    total,
    failures,
    critical,
    unauthorized,
    anchored,
    pendingAnchors: pending,
  };
});
