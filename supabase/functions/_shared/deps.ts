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
    .select("id, role, hospital_id")
    .eq("id", userData.user.id)
    .single();
  if (pErr || !profile) throw new HttpError(403, "No profile for this account");

  const { data: dids } = await db.from("dids").select("did").eq("owner_id", profile.id);

  return {
    userId: profile.id,
    role: profile.role,
    dids: (dids ?? []).map((d: { did: string }) => d.did),
    hospitalId: profile.hospital_id ?? null,
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
  },
): Promise<void> {
  const { error } = await db.from("audit_events").insert({
    actor_id: entry.actor_id ?? null,
    actor_did: entry.actor_did ?? null,
    resource: entry.resource ?? null,
    action: entry.action,
    outcome: entry.outcome,
    severity: entry.severity ?? "info",
    metadata: entry.metadata ?? {},
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
