-- ============================================================================
-- Migration — Rich Audit Trail & Blockchain Proof Integration
-- ============================================================================
-- Extends the existing audit_events table with structured Who/What/When/Where/
-- Prev/New/Auth fields. All new columns are nullable so existing rows and the
-- existing audit() Edge Function helper keep working without changes.
--
-- Adds:
--   1. Extended columns on audit_events (who, what, where, prev, new, auth)
--   2. record_hash + anchor_id so each audit event can be blockchain-anchored
--   3. A new write_audit_record() FUNCTION callable by server functions using
--      service_role that inserts a rich audit row atomically
--   4. audit_anchor_queue — a lightweight table for tracking which audit rows
--      still need to be anchored on-chain (async background anchoring)
--   5. RLS update: staff can read their own events (not just admin)
--   6. Realtime publication for audit_events so the admin page updates live
-- ============================================================================

-- ─── 1. Extend audit_events ──────────────────────────────────────────────────
-- Every column is nullable (default null) so:
--   a) Existing rows keep their existing schema — no migration of old data needed.
--   b) The existing audit() helper in _shared/deps.ts continues to work as-is.
--   c) New server-side calls can populate all fields.

-- WHO
alter table public.audit_events
  add column if not exists who_name        text,          -- full name of actor
  add column if not exists who_role        text,          -- role at time of action
  add column if not exists who_hospital_id text,          -- hospital the actor belongs to
  add column if not exists who_email       text;          -- actor email (non-PHI identifier)

-- WHAT
alter table public.audit_events
  add column if not exists what_module     text,          -- e.g. 'admissions', 'prescriptions'
  add column if not exists what_entity_id  text,          -- ID of the affected record
  add column if not exists what_entity_type text;         -- e.g. 'admission', 'prescription', 'bed'

-- WHERE
alter table public.audit_events
  add column if not exists where_hospital  text,          -- hospital name or ID
  add column if not exists where_location  text;          -- e.g. 'Admin Portal → Bed Management'

-- PREVIOUS VALUE (sensitive data kept in DB, never hashed to chain)
alter table public.audit_events
  add column if not exists prev_value      jsonb;         -- state before the change

-- NEW VALUE
alter table public.audit_events
  add column if not exists new_value       jsonb;         -- state after the change

-- AUTHORIZATION
alter table public.audit_events
  add column if not exists auth_status     text           -- 'authorized' | 'unauthorized' | 'elevated'
    check (auth_status in ('authorized', 'unauthorized', 'elevated') or auth_status is null),
  add column if not exists auth_policy     text;          -- RLS policy / permission name used

-- BLOCKCHAIN PROOF
alter table public.audit_events
  add column if not exists record_hash     text,          -- SHA-256 of the audit record (no PHI)
  add column if not exists anchor_id       text           -- FK to solana_anchors (set after anchoring)
    references public.solana_anchors(anchor_id) on delete set null,
  add column if not exists anchor_status   text           -- 'pending' | 'anchored' | 'failed' | null
    check (anchor_status in ('pending', 'anchored', 'failed') or anchor_status is null);

-- Index the new search columns
create index if not exists audit_events_who_role_idx      on public.audit_events (who_role);
create index if not exists audit_events_what_module_idx   on public.audit_events (what_module);
create index if not exists audit_events_what_entity_idx   on public.audit_events (what_entity_id);
create index if not exists audit_events_anchor_status_idx on public.audit_events (anchor_status)
  where anchor_status = 'pending';

comment on column public.audit_events.record_hash is
  'SHA-256 of the non-PHI audit record fields. Anchored on Solana for tamper-evidence.';

-- ─── 2. audit_anchor_queue ───────────────────────────────────────────────────
-- Lightweight queue: rows inserted by write_audit_record() for events that
-- need blockchain anchoring. A background job (or manual trigger) reads this
-- and calls the anchor-record Edge Function, then updates audit_events.anchor_id.
-- This decouples the synchronous audit write from the async blockchain call.
create table if not exists public.audit_anchor_queue (
  queue_id     uuid primary key default gen_random_uuid(),
  tx_id        uuid not null references public.audit_events(tx_id) on delete cascade,
  actor_did    text not null,
  record_hash  text not null,
  record_type  text not null default 'audit_event',
  attempts     int  not null default 0,
  last_error   text,
  queued_at    timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists audit_anchor_queue_unprocessed_idx
  on public.audit_anchor_queue (queued_at)
  where processed_at is null;

alter table public.audit_anchor_queue enable row level security;

-- Only admins can see the queue (it contains audit metadata).
create policy audit_anchor_queue_select_admin on public.audit_anchor_queue
  for select to authenticated
  using (private.current_user_role() = 'admin');

-- Only service_role writes (the Edge Function or write_audit_record function).

comment on table public.audit_anchor_queue is
  'Pending blockchain anchoring jobs for audit events. Processed asynchronously.';

-- ─── 3. write_audit_record() — server-side function ─────────────────────────
-- Called by Postgres functions (e.g., from server actions via service_role) to
-- insert a rich audit record and compute its SHA-256 hash.
--
-- Why not just use the Edge Function audit() helper?
-- The audit() helper in _shared/deps.ts runs only in Deno (Edge Functions). For
-- server functions running on the app server (TanStack Start), the only way to
-- INSERT into audit_events is to call this Postgres function via service_role,
-- or to invoke an Edge Function. This Postgres function is faster (no HTTP call)
-- and runs in the same transaction context.
--
-- The hash covers only non-PHI fields so it can be stored on-chain safely:
-- action, outcome, who_role, what_module, what_entity_id, where_hospital,
-- logged_at. The prev/new values and metadata stay in the DB only.
create or replace function public.write_audit_record(
  p_actor_id        uuid,
  p_actor_did       text,
  p_who_name        text,
  p_who_role        text,
  p_who_hospital_id text,
  p_who_email       text,
  p_resource        text,
  p_action          text,
  p_outcome         text,
  p_severity        text,
  p_what_module     text,
  p_what_entity_id  text,
  p_what_entity_type text,
  p_where_hospital  text,
  p_where_location  text,
  p_prev_value      jsonb,
  p_new_value       jsonb,
  p_auth_status     text,
  p_auth_policy     text,
  p_metadata        jsonb
)
returns uuid   -- returns the tx_id of the new row
language plpgsql
security definer   -- runs as the function owner (postgres), bypassing RLS INSERT restriction
as $$
declare
  v_tx_id       uuid := gen_random_uuid();
  v_logged_at   timestamptz := now();
  v_hash_input  text;
  v_record_hash text;
begin
  -- Compute SHA-256 over non-PHI fields only.
  -- Format: action|outcome|who_role|what_module|entity_id|where_hospital|timestamp
  -- This is the canonical input — the verification function must use the same format.
  v_hash_input := coalesce(p_action, '')
    || '|' || coalesce(p_outcome, '')
    || '|' || coalesce(p_who_role, '')
    || '|' || coalesce(p_what_module, '')
    || '|' || coalesce(p_what_entity_id, '')
    || '|' || coalesce(p_where_hospital, '')
    || '|' || v_logged_at::text;

  v_record_hash := encode(digest(v_hash_input, 'sha256'), 'hex');

  insert into public.audit_events (
    tx_id,
    actor_id,
    actor_did,
    resource,
    action,
    outcome,
    severity,
    metadata,
    logged_at,
    -- Rich fields
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
    anchor_status
  ) values (
    v_tx_id,
    p_actor_id,
    p_actor_did,
    p_resource,
    p_action,
    p_outcome,
    coalesce(p_severity, 'info'),
    coalesce(p_metadata, '{}'::jsonb),
    v_logged_at,
    p_who_name,
    p_who_role,
    p_who_hospital_id,
    p_who_email,
    p_what_module,
    p_what_entity_id,
    p_what_entity_type,
    p_where_hospital,
    p_where_location,
    p_prev_value,
    p_new_value,
    coalesce(p_auth_status, 'authorized'),
    p_auth_policy,
    v_record_hash,
    'pending'   -- will be updated to 'anchored' after blockchain confirmation
  );

  -- Enqueue for async blockchain anchoring.
  -- Uses the actor_did if available; falls back to a system DID.
  insert into public.audit_anchor_queue (
    tx_id,
    actor_did,
    record_hash,
    record_type
  ) values (
    v_tx_id,
    coalesce(p_actor_did, 'did:hosp:system'),
    v_record_hash,
    'audit_event'
  );

  return v_tx_id;
end;
$$;

comment on function public.write_audit_record is
  'Insert a rich audit record with SHA-256 hash and enqueue for blockchain anchoring. '
  'Runs as security definer so server functions can write audit rows without a client INSERT policy.';

-- ─── 4. verify_audit_record() — integrity check ──────────────────────────────
-- Called from the admin verification UI. Re-computes the hash from the stored
-- fields and compares it to the stored record_hash. If they match the record
-- has not been tampered with since it was written.
create or replace function public.verify_audit_record(p_tx_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_row         record;
  v_hash_input  text;
  v_recomputed  text;
  v_anchor      record;
begin
  select * into v_row from public.audit_events where tx_id = p_tx_id;
  if not found then
    return jsonb_build_object('verified', false, 'reason', 'Record not found');
  end if;

  -- Recompute using the same canonical format as write_audit_record().
  v_hash_input := coalesce(v_row.action, '')
    || '|' || coalesce(v_row.outcome, '')
    || '|' || coalesce(v_row.who_role, '')
    || '|' || coalesce(v_row.what_module, '')
    || '|' || coalesce(v_row.what_entity_id, '')
    || '|' || coalesce(v_row.where_hospital, '')
    || '|' || v_row.logged_at::text;

  v_recomputed := encode(digest(v_hash_input, 'sha256'), 'hex');

  -- Check DB-level integrity (hash matches stored hash).
  if v_row.record_hash is null then
    return jsonb_build_object(
      'verified', false,
      'reason', 'Legacy record — no hash stored (written before this migration)',
      'db_integrity', 'unknown'
    );
  end if;

  if v_recomputed <> v_row.record_hash then
    return jsonb_build_object(
      'verified', false,
      'reason', 'Hash mismatch — record may have been tampered with',
      'db_integrity', 'FAIL',
      'stored_hash', v_row.record_hash,
      'recomputed_hash', v_recomputed
    );
  end if;

  -- If anchored, also check that the on-chain anchor matches the stored hash.
  if v_row.anchor_id is not null then
    select * into v_anchor from public.solana_anchors where anchor_id = v_row.anchor_id;
    if found then
      return jsonb_build_object(
        'verified', true,
        'db_integrity', 'OK',
        'chain_integrity', case
          when v_anchor.record_hash = v_row.record_hash then 'OK'
          else 'FAIL'
        end,
        'anchor_status', v_anchor.status,
        'signature', v_anchor.signature,
        'slot', v_anchor.slot,
        'stored_hash', v_row.record_hash,
        'chain_hash', v_anchor.record_hash,
        'explorer', case
          when v_anchor.signature is not null
          then 'https://explorer.solana.com/tx/' || v_anchor.signature || '?cluster=devnet'
          else null
        end
      );
    end if;
  end if;

  -- DB integrity OK, not yet anchored on-chain.
  return jsonb_build_object(
    'verified', true,
    'db_integrity', 'OK',
    'chain_integrity', 'pending',
    'anchor_status', coalesce(v_row.anchor_status, 'not_queued'),
    'stored_hash', v_row.record_hash
  );
end;
$$;

comment on function public.verify_audit_record is
  'Re-compute the SHA-256 hash of an audit record and compare to stored hash + on-chain anchor. '
  'Returns JSON with verified status, db_integrity, chain_integrity, and Solana explorer link.';

-- ─── 5. update_audit_event_deps() helper ─────────────────────────────────────
-- Updates anchor_id and anchor_status on an audit_event after the blockchain
-- anchoring job completes. Called by the processAuditAnchorQueue server function.
create or replace function public.mark_audit_anchored(
  p_tx_id     uuid,
  p_anchor_id text,
  p_status    text   -- 'anchored' or 'failed'
)
returns void
language plpgsql
security definer
as $$
begin
  update public.audit_events
  set
    anchor_id     = p_anchor_id,
    anchor_status = p_status
  where tx_id = p_tx_id;

  update public.audit_anchor_queue
  set processed_at = now()
  where tx_id = p_tx_id;
end;
$$;

-- ─── 6. Enable pgcrypto extension (needed for digest()) ──────────────────────
-- digest() is provided by pgcrypto. In Supabase it is pre-installed but the
-- extension may not be enabled in all projects.
create extension if not exists pgcrypto schema extensions;

-- ─── 7. Realtime publication for audit_events ────────────────────────────────
alter publication supabase_realtime add table public.audit_events;
alter table public.audit_events replica identity full;
alter publication supabase_realtime add table public.audit_anchor_queue;

-- ─── 8. Staff SELECT policy — staff can view events for their patients ────────
-- Previously only admin could see all; now staff/doctors see events where they
-- are the actor (their own actions in the system).
create policy audit_events_select_staff on public.audit_events
  for select to authenticated
  using (private.current_user_role() in ('doctor', 'staff')
    and actor_id = (select auth.uid()));
