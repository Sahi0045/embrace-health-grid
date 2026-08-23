-- ============================================================================
-- Reconcile consent drift and restore the private-only RLS helpers
-- ============================================================================
-- Auditing the live database turned up objects that no migration defines. They
-- were created directly against the remote project, so a fresh environment built
-- from migrations behaves differently from production — which is how a policy
-- that looks correct in review can still fail in one place and not the other.
--
-- Three things are reconciled here.
--
-- 1. public.consents gained a request/approval timeline: requested_at,
--    approved_at, access_started_at, rejected_at, reason, and denormalised
--    doctor_name / doctor_specialty.
--
-- 2. medical_records_select_doctor and prescriptions_select_doctor were added.
--    Both are sound in substance — the authoring clinician keeps access to what
--    they wrote, plus anyone holding a live, approved, unexpired, unrevoked
--    consent for a matching resource — and the author clause mirrors the existing
--    prescriptions_select_author. They are recreated here so they exist
--    everywhere, and rewritten to call the private helpers (see 3).
--
-- 3. current_user_dids, current_user_role and has_active_consent were re-created
--    in the PUBLIC schema with EXECUTE granted to anon and authenticated. That
--    undoes 20260803180000_move_rls_helpers_to_private_schema.sql, whose whole
--    purpose was to put them out of client reach: PostgREST exposes public, so a
--    caller could invoke has_active_consent() against any patient DID and learn
--    whether a consent exists. The policies above referenced them unqualified,
--    which is why the public copies were needed. Once the policies name the
--    private schema explicitly, the public copies can go.

-- ─── 1. Consent timeline columns ────────────────────────────────────────────

alter table public.consents add column if not exists requested_at      timestamptz;
alter table public.consents add column if not exists approved_at       timestamptz;
alter table public.consents add column if not exists access_started_at timestamptz;
alter table public.consents add column if not exists rejected_at       timestamptz;
alter table public.consents add column if not exists reason            text;
alter table public.consents add column if not exists doctor_name       text;
alter table public.consents add column if not exists doctor_specialty  text;

comment on column public.consents.approved_at is
  'When the patient approved the request. medical_records_select_doctor and prescriptions_select_doctor require this to be non-null, so a consent that is active but never explicitly approved opens nothing.';

-- Existing grants predate the timeline. A row that is already active was, by
-- definition, approved, so backfill from granted_at rather than leaving it null
-- and silently revoking access that has been in use.
update public.consents
   set approved_at = coalesce(approved_at, granted_at)
 where status = 'active'
   and approved_at is null;

-- ─── 2. Clinician read policies, qualified ──────────────────────────────────

drop policy if exists medical_records_select_doctor on public.medical_records;

create policy medical_records_select_doctor on public.medical_records
  for select to authenticated
  using (
    -- The clinician who authored the record keeps access to their own work.
    author_did in (select private.current_user_dids())
    or exists (
      select 1
        from public.consents c
       where c.doctor_did in (select private.current_user_dids())
         and c.patient_did = medical_records.patient_did
         and c.status = 'active'
         and c.approved_at is not null
         and (c.expires_at is null or c.expires_at > now())
         and c.revoked_at is null
         and c.resource = any (array['Medical Records', 'Full Health Profile'])
    )
  );

drop policy if exists prescriptions_select_doctor on public.prescriptions;

create policy prescriptions_select_doctor on public.prescriptions
  for select to authenticated
  using (
    doctor_did in (select private.current_user_dids())
    or exists (
      select 1
        from public.consents c
       where c.doctor_did in (select private.current_user_dids())
         and c.patient_did = prescriptions.patient_did
         and c.status = 'active'
         and c.approved_at is not null
         and (c.expires_at is null or c.expires_at > now())
         and c.revoked_at is null
         and c.resource = any (
           array['Prescription Ledger', 'Full Health Profile', 'Medical Records']
         )
    )
  );

-- prescriptions_select_consented also called the unqualified helper.
drop policy if exists prescriptions_select_consented on public.prescriptions;

create policy prescriptions_select_consented on public.prescriptions
  for select to authenticated
  using (private.has_active_consent(patient_did));

-- ─── 3. Withdraw the public helper copies ───────────────────────────────────
-- Dropped rather than merely revoked: leaving an unreachable duplicate invites a
-- future policy to reference the wrong one again.

drop function if exists public.has_active_consent(text);
drop function if exists public.current_user_dids();
drop function if exists public.current_user_role();

-- ─── Guard ──────────────────────────────────────────────────────────────────
-- These helpers decide who may read PHI. If they reappear in a client-reachable
-- schema, fail loudly rather than leaving it to be noticed later.
do $$
declare
  exposed text;
begin
  select string_agg(p.proname, ', ')
    into exposed
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('has_active_consent', 'current_user_dids', 'current_user_role');

  if exposed is not null then
    raise exception
      'RLS helpers must live only in the private schema, found in public: %',
      exposed;
  end if;
end $$;
