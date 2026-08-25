/**
 * Shared helpers for Edge Functions — Embrace Health Grid
 *
 * Deno runtime (Supabase Edge Functions), not Node.
 */

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Service-role client. Edge Functions are the only place service_role is used
 * from application code, because they perform writes that clients must not be
 * able to forge (anchors, merkle roots, signed credentials, audit entries).
 */
export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Resolve the caller from their Authorization header and return their profile.
 *
 * Edge Functions are publicly reachable, so every one must authenticate the
 * caller itself — being deployed behind Supabase is not authorization. We use
 * an anon-key client bound to the caller's JWT so getUser() verifies it rather
 * than merely decoding it.
 */
export async function requireCaller(req: Request): Promise<{
  userId: string;
  role: string;
  dids: string[];
  /**
   * The caller's hospital, or null for a super_admin (who belongs to the
   * platform) and for a patient with no affiliation. Functions that write
   * tenant-scoped rows must stamp this rather than trusting a client-supplied
   * hospital id.
   */
  hospitalId: string | null;
  /** Stamped onto audit rows so a trail identifies who acted, not just their id. */
  name: string | null;
  email: string | null;
}> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Missing Authorization header");

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await asCaller.auth.getUser();
  if (userErr || !userData.user) throw new HttpError(401, "Invalid or expired session");

  // Read the profile with service_role: the caller's own RLS view is not needed
  // and this keeps the lookup independent of policy changes.
  const db = serviceClient();
  const { data: profile, error: pErr } = await db
    .from("profiles")
    .select("id, role, hospital_id, full_name, email")
    .eq("id", userData.user.id)
    .single();
  if (pErr || !profile) throw new HttpError(403, "No profile for this account");

  const { data: dids } = await db.from("dids").select("did").eq("owner_id", profile.id);

  return {
    userId: profile.id,
    role: profile.role,
    dids: (dids ?? []).map((d: { did: string }) => d.did),
    hospitalId: profile.hospital_id ?? null,
    name: profile.full_name ?? null,
    email: profile.email ?? null,
  };
}

/** Error carrying an HTTP status so handlers can map failures cleanly. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Write an audit entry. Clients have no INSERT policy on audit_events, so this
 * is the only path — an actor cannot suppress their own trail.
 *
 * Goes through write_audit_record() rather than inserting directly. Two things
 * were wrong with the direct insert:
 *
 *  1. NO TAMPER-EVIDENCE. record_hash is computed inside write_audit_record(),
 *     so every row written by an Edge Function had record_hash NULL and was not
 *     covered by the integrity guarantee at all — verified in production, where
 *     USER_ONBOARDED / DID_CREATED / WALLET_LINKED rows all had a null hash
 *     while RPC-written rows did not. Those rows also never entered
 *     audit_anchor_queue, so they were never anchored on chain.
 *
 *  2. NO TENANT. who_hospital_id was never set, so under the hospital-scoped
 *     read policy every hospital admin saw an EMPTY audit trail — the people
 *     meant to audit the system could not read it. 198 of 200 live rows are
 *     affected.
 *
 * `requireCaller()` above already resolves the caller's role and hospital, so
 * pass its result as `caller` and the stamping is free.
 */
export async function audit(
  db: SupabaseClient,
  entry: {
    actor_id?: string | null;
    actor_did?: string | null;
    resource?: string | null;
    action: string;
    outcome: string;
    severity?: string;
    metadata?: Record<string, unknown>;
    /** The result of requireCaller(), when the action had an authenticated caller. */
    caller?: {
      userId?: string | null;
      role?: string | null;
      hospitalId?: string | null;
      name?: string | null;
      email?: string | null;
    } | null;
    module?: string | null;
    entity_id?: string | null;
    entity_type?: string | null;
  },
): Promise<void> {
  const c = entry.caller ?? null;

  const { error } = await db.rpc("write_audit_record", {
    p_actor_id: entry.actor_id ?? c?.userId ?? null,
    p_actor_did: entry.actor_did ?? null,
    p_who_name: c?.name ?? null,
    p_who_role: c?.role ?? null,
    p_who_hospital_id: c?.hospitalId ?? null,
    p_who_email: c?.email ?? null,
    p_resource: entry.resource ?? null,
    p_action: entry.action,
    p_outcome: entry.outcome,
    p_severity: entry.severity ?? "info",
    p_what_module: entry.module ?? "identity",
    p_what_entity_id: entry.entity_id ?? null,
    p_what_entity_type: entry.entity_type ?? null,
    p_where_hospital: c?.hospitalId ?? null,
    p_where_location: null,
    p_prev_value: null,
    p_new_value: null,
    p_auth_status: null,
    p_auth_policy: null,
    p_metadata: entry.metadata ?? {},
  });

  // Audit failure must be visible, but must not mask the primary error.
  if (error) console.error("audit_write_failed", error.message);
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Uniform error handling so functions never leak internals to the caller. */
export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return json({ error: err.message }, err.status);
  }
  console.error("unhandled_error", err);
  return json({ error: "Internal error" }, 500);
}
