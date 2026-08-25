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

-- ─── Other policies that called the unqualified helpers ─────────────────────
-- Dropping the public copies fails while anything still depends on them
-- (SQLSTATE 2BP01), and four further policies did — including two on
-- prescription_items and medical_reports, tables that are themselves drift. Each
-- is recreated with identical logic, only schema-qualified.
--
-- Note the role comparison: private.current_user_role() returns user_role, not
-- text, so the literals are left unquoted for Postgres to resolve rather than
-- cast to text as the public version did.

drop policy if exists prescriptions_select_consented on public.prescriptions;

create policy prescriptions_select_consented on public.prescriptions
  for select to authenticated
  using (private.has_active_consent(patient_did));

drop policy if exists prescriptions_insert_clinician on public.prescriptions;

create policy prescriptions_insert_clinician on public.prescriptions
  for insert to authenticated
  with check (
    private.current_user_role() in ('doctor', 'staff')
    and doctor_did in (select private.current_user_dids())
    and private.has_active_consent(patient_did)
  );

do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'medical_reports') then

    drop policy if exists medical_reports_select_consented on public.medical_reports;
    create policy medical_reports_select_consented on public.medical_reports
      for select to authenticated
      using (private.has_active_consent(patient_did));

    drop policy if exists medical_reports_insert_clinician on public.medical_reports;
    create policy medical_reports_insert_clinician on public.medical_reports
      for insert to authenticated
      with check (
        private.current_user_role() in ('doctor', 'staff')
        and doctor_did in (select private.current_user_dids())
        and private.has_active_consent(patient_did)
      );
  end if;

  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'prescription_items') then

    drop policy if exists prescription_items_select_consented on public.prescription_items;
    create policy prescription_items_select_consented on public.prescription_items
      for select to authenticated
      using (
        prescription_id in (
          select p.rx_id from public.prescriptions p
           where private.has_active_consent(p.patient_did)
        )
      );
  end if;
end $$;

-- ─── Remaining drift policies that bind to the public helpers ───────────────
-- The first push of this migration failed at the drop with SQLSTATE 2BP01:
-- sixteen further policies still depended on public.current_user_dids(). They
-- were created directly against the remote project, so they are invisible to a
-- scratch database built from migrations — which is why the migration passed
-- review and still could not apply.
--
-- Each is recreated below with identical logic, schema-qualified onto private.
-- private.current_user_dids() and private.has_active_consent() have bodies
-- identical in meaning to the public copies, so this changes which function a
-- policy calls, never what it decides.
--
-- Role targeting is preserved exactly as found, including the policies created
-- without a TO clause (they target PUBLIC rather than authenticated). Narrowing
-- those is a separate decision and is deliberately not bundled here.

-- appointments ───────────────────────────────────────────────────────────────

drop policy if exists appointments_select_involved on public.appointments;
create policy appointments_select_involved on public.appointments
  for select to authenticated
  using (
    patient_did in (select private.current_user_dids())
    or doctor_did in (select private.current_user_dids())
  );

drop policy if exists appointments_insert_patient on public.appointments;
create policy appointments_insert_patient on public.appointments
  for insert to authenticated
  with check (patient_did in (select private.current_user_dids()));

drop policy if exists appointments_update_involved on public.appointments;
create policy appointments_update_involved on public.appointments
  for update to authenticated
  using (
    patient_did in (select private.current_user_dids())
    or doctor_did in (select private.current_user_dids())
  )
  with check (
    patient_did in (select private.current_user_dids())
    or doctor_did in (select private.current_user_dids())
  );

-- consents ───────────────────────────────────────────────────────────────────
-- consents_insert_doctor is the policy behind "Request Access" on the consent
-- page: a clinician may create a row for themselves, and only at status
-- 'requested', so a request cannot be self-approved on insert.

drop policy if exists consents_select_patient on public.consents;
create policy consents_select_patient on public.consents
  for select
  using (patient_did in (select private.current_user_dids()));

drop policy if exists consents_select_doctor on public.consents;
create policy consents_select_doctor on public.consents
  for select
  using (doctor_did in (select private.current_user_dids()));

drop policy if exists consents_insert_doctor on public.consents;
create policy consents_insert_doctor on public.consents
  for insert
  with check (
    doctor_did in (select private.current_user_dids())
    and status = 'requested'::public.consent_status
  );

drop policy if exists consents_update_patient on public.consents;
create policy consents_update_patient on public.consents
  for update
  using (patient_did in (select private.current_user_dids()));

drop policy if exists consents_revoke_patient on public.consents;
create policy consents_revoke_patient on public.consents
  for update
  using (
    patient_did in (select private.current_user_dids())
    and status = any (array['active'::public.consent_status, 'requested'::public.consent_status])
  )
  with check (status = 'revoked'::public.consent_status and revoked_at is not null);

-- prescription_items (drift table) ───────────────────────────────────────────

do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'prescription_items') then

    drop policy if exists prescription_items_select_own on public.prescription_items;
    create policy prescription_items_select_own on public.prescription_items
      for select to authenticated
      using (
        prescription_id in (
          select p.rx_id from public.prescriptions p
           where p.patient_did in (select private.current_user_dids())
        )
      );

    drop policy if exists prescription_items_select_author on public.prescription_items;
    create policy prescription_items_select_author on public.prescription_items
      for select to authenticated
      using (
        prescription_id in (
          select p.rx_id from public.prescriptions p
           where p.doctor_did in (select private.current_user_dids())
        )
      );

    -- private.current_user_role() returns user_role, not text: the literals stay
    -- unquoted for Postgres to resolve, where the public version cast to text.
    drop policy if exists prescription_items_insert_clinician on public.prescription_items;
    create policy prescription_items_insert_clinician on public.prescription_items
      for insert to authenticated
      with check (
        private.current_user_role() in ('doctor', 'staff')
        and prescription_id in (
          select p.rx_id from public.prescriptions p
           where p.doctor_did in (select private.current_user_dids())
        )
      );

    drop policy if exists prescription_items_select_doctor on public.prescription_items;
    create policy prescription_items_select_doctor on public.prescription_items
      for select
      using (
        exists (
          select 1 from public.prescriptions p
           where p.rx_id = prescription_items.prescription_id
             and (
               p.doctor_did in (select private.current_user_dids())
               or exists (
                 select 1 from public.consents c
                  where c.doctor_did in (select private.current_user_dids())
                    and c.patient_did = p.patient_did
                    and c.status = 'active'::public.consent_status
                    and c.approved_at is not null
                    and (c.expires_at is null or c.expires_at > now())
                    and c.revoked_at is null
                    and c.resource = any (
                      array['Prescription Ledger', 'Full Health Profile', 'Medical Records']
                    )
               )
             )
        )
      );
  end if;
end $$;

-- medical_reports (drift table) ──────────────────────────────────────────────

do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'medical_reports') then

    drop policy if exists medical_reports_select_own on public.medical_reports;
    create policy medical_reports_select_own on public.medical_reports
      for select to authenticated
      using (patient_did in (select private.current_user_dids()));

    drop policy if exists medical_reports_select_author on public.medical_reports;
    create policy medical_reports_select_author on public.medical_reports
      for select to authenticated
      using (doctor_did in (select private.current_user_dids()));

    drop policy if exists medical_reports_update_author on public.medical_reports;
    create policy medical_reports_update_author on public.medical_reports
      for update to authenticated
      using (
        doctor_did in (select private.current_user_dids())
        and status = 'draft'
      )
      with check (doctor_did in (select private.current_user_dids()));

    drop policy if exists medical_reports_select_doctor on public.medical_reports;
    create policy medical_reports_select_doctor on public.medical_reports
      for select
      using (
        doctor_did in (select private.current_user_dids())
        or exists (
          select 1 from public.consents c
           where c.doctor_did in (select private.current_user_dids())
             and c.patient_did = medical_reports.patient_did
             and c.status = 'active'::public.consent_status
             and c.approved_at is not null
             and (c.expires_at is null or c.expires_at > now())
             and c.revoked_at is null
             and c.resource = any (
               array['Medical Records', 'Full Health Profile', 'Prescription Ledger']
             )
        )
      );
  end if;
end $$;

-- ─── Withdraw the public helper copies ──────────────────────────────────────
-- Only safe once nothing references them, which the requalification above
-- ensures. Dropped rather than merely revoked: leaving an unreachable duplicate
-- invites a future policy to bind to the wrong one again.

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
