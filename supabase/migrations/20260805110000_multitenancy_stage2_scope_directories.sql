-- ============================================================================
-- Multi-tenancy Stage 2 — tenant-scope the directory tables
-- ============================================================================
-- This is the actual vulnerability, not a missing feature.
--
-- Before this migration:
--   dids_select_authenticated  USING (true)
--   profiles_select_staff      USING (role in ('doctor','staff','admin'))
--
-- So any clinician could read every DID and every profile in the database. With
-- more than one hospital on this schema, a doctor at hospital A could enumerate
-- hospital B's entire staff and patient directory. That is a tenant isolation
-- failure, and it is why this stage comes before anything user-facing.
--
-- The replacement is deliberately not a blanket "same hospital only". Three
-- cross-tenant paths have to keep working, or the product breaks:
--
--   1. A patient must be able to find a clinician at ANY active hospital, or
--      they can never book with, or be referred to, a second hospital.
--   2. A clinician holding a patient's consent must be able to resolve that
--      patient's DID even if the patient belongs to another hospital —
--      otherwise a referral shows an unnamed record.
--   3. A patient must resolve the issuer of their own credentials.
--
-- Those are the point of a DID/consent system, so they are allowed explicitly
-- rather than left to a broad policy.
-- ============================================================================

-- ─── dids ───────────────────────────────────────────────────────────────────
-- Replaces a single `USING (true)` policy with four narrow ones. Split rather
-- than OR'd into one expression so each reason a row is visible is auditable on
-- its own, and so removing one path does not require re-reasoning about the
-- others.
drop policy if exists dids_select_authenticated on public.dids;

-- Your own DIDs, always. Independent of hospital: a patient with no hospital
-- affiliation still owns their identity.
create policy dids_select_own on public.dids
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- Everyone in your own hospital.
create policy dids_select_same_hospital on public.dids
  for select to authenticated
  using (hospital_id = private.current_user_hospital());

-- The clinician directory, across hospitals.
--
-- Restricted to doctor and staff DIDs at active hospitals: a patient needs to
-- discover clinicians to book with or be referred to, and verifying a
-- clinician's credential means resolving their DID. Patient DIDs are NOT
-- exposed by this policy, so it cannot be used to enumerate other hospitals'
-- patients.
create policy dids_select_clinician_directory on public.dids
  for select to authenticated
  using (
    owner_type in ('doctor', 'staff')
    and exists (
      select 1 from public.hospitals h
       where h.hospital_id = public.dids.hospital_id
         and h.status = 'active'
    )
  );

-- A patient who granted you consent, even from another hospital. This is what
-- makes a referral legible: without it a consented record has no resolvable
-- owner and renders as a bare DID.
create policy dids_select_consented on public.dids
  for select to authenticated
  using (private.has_active_consent(did));

-- The platform sees the whole registry, which is what makes it a registry.
create policy dids_select_super_admin on public.dids
  for select to authenticated
  using (private.is_super_admin());

-- ─── profiles ───────────────────────────────────────────────────────────────
-- profiles carries email and full name — directory data, but per-person, so it
-- is scoped harder than dids. There is no cross-hospital clinician-directory
-- equivalent here: name and DID come from dids, and email is not needed to book
-- an appointment.
drop policy if exists profiles_select_staff on public.profiles;

create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and hospital_id = private.current_user_hospital()
  );

create policy profiles_select_super_admin on public.profiles
  for select to authenticated
  using (private.is_super_admin());

-- profiles_select_own is unchanged and still applies, so a patient continues to
-- read their own row regardless of hospital.

-- ─── credentials ────────────────────────────────────────────────────────────
-- Same problem, same shape: credentials_select_staff let any clinician read
-- every credential in the system. A credential names its subject, so this is
-- directory data about a specific person.
drop policy if exists credentials_select_staff on public.credentials;

create policy credentials_select_staff on public.credentials
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and exists (
      select 1 from public.dids d
       where d.did = public.credentials.subject_did
         and d.hospital_id = private.current_user_hospital()
    )
  );

-- A clinician holding consent may verify that patient's credentials, which is
-- how a referral is validated across hospitals.
create policy credentials_select_consented on public.credentials
  for select to authenticated
  using (private.has_active_consent(subject_did));

create policy credentials_select_super_admin on public.credentials
  for select to authenticated
  using (private.is_super_admin());

-- ─── Staff must belong to a hospital ────────────────────────────────────────
-- A clinician row with a null hospital_id would be invisible to its own
-- colleagues under the policies above, and would sit outside every tenant
-- boundary. Patients stay nullable: they are not owned by a hospital.
--
-- Enforced as a trigger rather than a CHECK constraint because it has to permit
-- the super_admin case, which a CHECK cannot express cleanly alongside the
-- patient exemption.
create or replace function private.enforce_staff_hospital()
returns trigger
language plpgsql
as $$
begin
  if new.role in ('doctor', 'staff', 'admin') and new.hospital_id is null then
    raise exception
      'A % account must belong to a hospital (hospital_id is null)', new.role
      using errcode = 'check_violation';
  end if;

  -- super_admin is deliberately the inverse: it belongs to the platform, so a
  -- hospital_id would imply a tenant scope it does not have.
  if new.role = 'super_admin' and new.hospital_id is not null then
    raise exception 'A super_admin belongs to the platform, not a hospital'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_staff_hospital on public.profiles;

create trigger profiles_enforce_staff_hospital
  before insert or update on public.profiles
  for each row execute function private.enforce_staff_hospital();
