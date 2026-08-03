-- ============================================================================
-- Migration 003 — Move RLS helpers into a non-exposed schema
-- ============================================================================
-- Migration 002 was wrong, and the RLS test suite caught it.
--
-- What went wrong:
--   002 revoked EXECUTE on the helper functions from `authenticated` to stop
--   them being callable as PostgREST RPC endpoints. But RLS policy expressions
--   are evaluated with the CALLING role's privileges for function execution.
--   Revoking EXECUTE from `authenticated` therefore broke every policy that
--   referenced a helper: legitimate queries began failing with
--   "42501 permission denied for function current_user_role".
--
--   Net effect: every table became unreadable even by its rightful owner.
--   Fail-closed rather than fail-open, so no data was ever exposed — but the
--   application was fully broken.
--
-- The correct approach:
--   PostgREST only exposes functions in schemas listed as exposed (public by
--   default). Moving the helpers into a dedicated `private` schema removes the
--   RPC surface entirely, while EXECUTE can stay granted to `authenticated` so
--   policy evaluation works.
--
--   Security comes from the schema not being exposed, not from revoking the
--   privilege that policies depend on.
-- ============================================================================

create schema if not exists private;

-- `authenticated` needs USAGE on the schema to resolve the functions during
-- policy evaluation, but cannot reach them over the REST API because `private`
-- is not an exposed schema.
grant usage on schema private to authenticated, service_role;

-- ─── Recreate helpers in `private` ──────────────────────────────────────────

create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function private.current_user_dids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select did from public.dids where owner_id = (select auth.uid());
$$;

create or replace function private.has_active_consent(target_patient_did text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.consents c
    where c.patient_did = target_patient_did
      and c.doctor_did in (
        select did from public.dids where owner_id = (select auth.uid())
      )
      and c.status = 'active'
      and (c.expires_at is null or c.expires_at > now())
  );
$$;

grant execute on function private.current_user_role()            to authenticated, service_role;
grant execute on function private.current_user_dids()            to authenticated, service_role;
grant execute on function private.has_active_consent(text)       to authenticated, service_role;

-- ─── Repoint every policy at private.* ──────────────────────────────────────

-- profiles
drop policy if exists profiles_select_own   on public.profiles;
drop policy if exists profiles_select_staff on public.profiles;
drop policy if exists profiles_update_own   on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (private.current_user_role() in ('doctor', 'staff', 'admin'));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = private.current_user_role()   -- blocks self-promotion
  );

-- credentials
drop policy if exists credentials_select_own   on public.credentials;
drop policy if exists credentials_select_staff on public.credentials;

create policy credentials_select_own on public.credentials
  for select to authenticated
  using (subject_did in (select private.current_user_dids()));

create policy credentials_select_staff on public.credentials
  for select to authenticated
  using (private.current_user_role() in ('doctor', 'staff', 'admin'));

-- consents
drop policy if exists consents_select_involved on public.consents;
drop policy if exists consents_insert_patient  on public.consents;
drop policy if exists consents_update_patient  on public.consents;

create policy consents_select_involved on public.consents
  for select to authenticated
  using (
    patient_did in (select private.current_user_dids())
    or doctor_did in (select private.current_user_dids())
  );

create policy consents_insert_patient on public.consents
  for insert to authenticated
  with check (patient_did in (select private.current_user_dids()));

create policy consents_update_patient on public.consents
  for update to authenticated
  using (patient_did in (select private.current_user_dids()))
  with check (patient_did in (select private.current_user_dids()));

-- medical_records
drop policy if exists medical_records_select_own        on public.medical_records;
drop policy if exists medical_records_select_consented  on public.medical_records;
drop policy if exists medical_records_insert_clinician  on public.medical_records;

create policy medical_records_select_own on public.medical_records
  for select to authenticated
  using (patient_did in (select private.current_user_dids()));

create policy medical_records_select_consented on public.medical_records
  for select to authenticated
  using (private.has_active_consent(patient_did));

create policy medical_records_insert_clinician on public.medical_records
  for insert to authenticated
  with check (
    private.current_user_role() in ('doctor', 'staff')
    and private.has_active_consent(patient_did)
  );

-- ─── Remove the public.* helpers entirely ───────────────────────────────────
-- No longer referenced by any policy, and their presence in `public` is what
-- created the RPC exposure in the first place.
drop function if exists public.current_user_role();
drop function if exists public.current_user_dids();
drop function if exists public.has_active_consent(text);
