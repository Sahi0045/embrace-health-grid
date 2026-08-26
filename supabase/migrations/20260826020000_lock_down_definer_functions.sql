-- ============================================================================
-- SECURITY DEFINER functions reachable by any authenticated user
-- ============================================================================
-- A SECURITY DEFINER function runs as its owner, so RLS on the tables it reads
-- does not apply to the caller. Postgres also grants EXECUTE to PUBLIC by
-- default, and PostgREST publishes every function in `public` as an RPC. Three
-- separate holes follow from that.

-- ─── 1. Five patient helpers that read PHI with no authorization at all ─────
-- Each takes a patient DID from the caller and returns that patient's data with
-- no check of who is asking. Verified against the live database by signing in as
-- a seeded PATIENT and reading a DIFFERENT patient's data:
--
--   bob.patient@seed.test -> get_patient_name('did:hosp:0xSEEDA01')  => "Alice Tan"
--   bob.patient@seed.test -> get_patient_medical_records(...)        => full clinical notes
--   bob.patient@seed.test -> get_patient_current_admission(...)      => diagnosis, bed, ward
--
-- They are DROPPED rather than repaired: nothing in the application calls any of
-- them (`src/`, `supabase/functions/` and `backend/` contain zero references),
-- so they are pure attack surface. Re-adding an authorization predicate to dead
-- code would leave five more hand-written copies of a policy that must be kept
-- in step with the tables' RLS forever. If a caller needs this data later, query
-- the table directly and let its policies do the work.

drop function if exists public.get_patient_name(text);
drop function if exists public.get_patient_current_admission(text);
drop function if exists public.get_patient_location(text);
drop function if exists public.get_patient_medical_records(text);
drop function if exists public.get_patient_admission_history(text);

-- ─── 2. write_audit_record(): actor identity was caller-supplied ────────────
-- The function takes p_actor_id, p_actor_did, p_who_name, p_who_role,
-- p_who_email and p_who_hospital_id as ARGUMENTS and writes them verbatim. It is
-- security definer and executable by `authenticated`, so any signed-in user
-- could call it from the browser and plant a correctly-hashed, anchor-queued
-- audit row attributed to any clinician — defeating the tamper-evidence the
-- whole audit chain exists to provide. Hashing does not help: the forged row is
-- hashed by this same function, so it verifies.
--
-- The fix is to stop trusting those arguments when there is a session to check
-- them against. When auth.uid() is present the actor fields are DERIVED from
-- that user's profile and the passed values are ignored. When auth.uid() is null
-- the caller is service_role — the Edge Functions' audit() helper, which is
-- already trusted and legitimately reports an actor other than itself — and the
-- arguments are used as before.
--
-- Signature and behaviour for legitimate callers are unchanged: audit.server.ts
-- already passes the real session user's identity, so deriving it here produces
-- the same row.

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
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx_id       uuid := gen_random_uuid();
  v_logged_at   timestamptz := now();
  v_hash_input  text;
  v_record_hash text;
  v_uid         uuid := auth.uid();
  -- Effective actor: derived from the session when there is one.
  v_actor_id    uuid := p_actor_id;
  v_actor_did   text := p_actor_did;
  v_who_name    text := p_who_name;
  v_who_role    text := p_who_role;
  v_who_hosp    text := p_who_hospital_id;
  v_who_email   text := p_who_email;
begin
  if v_uid is not null then
    -- A real user session. Whatever identity the caller claimed is discarded and
    -- replaced with the one the JWT actually proves.
    select p.id,
           p.full_name,
           p.role::text,
           p.hospital_id::text,
           p.email
      into v_actor_id, v_who_name, v_who_role, v_who_hosp, v_who_email
      from public.profiles p
     where p.id = v_uid;

    -- The acting DID must be one this user controls; anything else is discarded
    -- rather than recorded as fact.
    select d.did into v_actor_did
      from public.dids d
     where d.owner_id = v_uid
       and (p_actor_did is null or d.did = p_actor_did)
     order by (d.did = p_actor_did) desc
     limit 1;
  end if;

  -- Hash covers non-PHI fields only, so it can be published on-chain.
  -- NOTE: this is the canonical input; verify_audit_record must match it byte
  -- for byte. It deliberately still omits actor identity — changing the format
  -- would invalidate every existing hash — but the actor is no longer
  -- attacker-controlled, which was the exploitable half of that gap.
  v_hash_input := coalesce(p_action, '')
    || '|' || coalesce(p_outcome, '')
    || '|' || coalesce(v_who_role, '')
    || '|' || coalesce(p_what_module, '')
    || '|' || coalesce(p_what_entity_id, '')
    || '|' || coalesce(p_where_hospital, '')
    || '|' || v_logged_at::text;

  v_record_hash := encode(extensions.digest(v_hash_input, 'sha256'), 'hex');

  insert into public.audit_events (
    tx_id, actor_id, actor_did, resource, action, outcome, severity, metadata,
    logged_at, who_name, who_role, who_hospital_id, who_email, what_module,
    what_entity_id, what_entity_type, where_hospital, where_location,
    prev_value, new_value, auth_status, auth_policy, record_hash, anchor_status
  ) values (
    v_tx_id, v_actor_id, v_actor_did, p_resource, p_action, p_outcome,
    coalesce(p_severity, 'info'), coalesce(p_metadata, '{}'::jsonb), v_logged_at,
    v_who_name, v_who_role, v_who_hosp::uuid, v_who_email, p_what_module,
    p_what_entity_id, p_what_entity_type, p_where_hospital, p_where_location,
    p_prev_value, p_new_value, coalesce(p_auth_status, 'authorized'),
    p_auth_policy, v_record_hash, 'pending'
  );

  insert into public.audit_anchor_queue (tx_id, actor_did, record_hash, record_type)
  values (v_tx_id, coalesce(v_actor_did, 'did:hosp:system'), v_record_hash, 'audit_event');

  return v_tx_id;
end;
$$;

comment on function public.write_audit_record is
  'Insert a hashed audit record and enqueue it for anchoring. When called with a user session the actor fields are derived from auth.uid() and the caller-supplied ones are ignored — they were forgeable. service_role callers (the Edge Function audit helper) may still name the actor explicitly.';

-- ─── 3. mark_audit_anchored(): anyone could stamp a row as anchored ─────────
-- Also security definer and executable by `authenticated`, so any signed-in user
-- could mark an arbitrary audit row 'anchored' with an anchor id of their
-- choosing — asserting that a record was published to a blockchain when it was
-- not. Anchoring is an administrative operation, so it is restricted to
-- service_role and admins.

create or replace function private.assert_can_anchor()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;  -- service_role / trusted backend
  end if;
  if private.current_user_role() not in ('admin', 'super_admin') then
    raise exception 'mark_audit_anchored: administrative operation'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

create or replace function public.mark_audit_anchored(
  p_tx_id     uuid,
  p_anchor_id text,
  p_status    text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_can_anchor();

  update public.audit_events
     set anchor_id = p_anchor_id,
         anchor_status = p_status
   where tx_id = p_tx_id;

  update public.audit_anchor_queue
     set processed_at = now()
   where tx_id = p_tx_id;
end;
$$;

comment on function public.mark_audit_anchored is
  'Record the on-chain anchor for an audit row. Restricted to service_role and admins: any authenticated user could previously assert that an arbitrary record had been anchored.';
