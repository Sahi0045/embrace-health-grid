-- ============================================================================
-- Multi-tenancy Stage 2 correction — a patient must not see other patients
-- ============================================================================
-- Stage 2 scoped `dids` by hospital but not by role:
--
--   dids_select_same_hospital  USING (hospital_id = private.current_user_hospital())
--
-- That is right for staff, who need a directory of the people at their hospital.
-- It is wrong for a patient: it let Alice enumerate every other patient at her
-- hospital by name through the DID Explorer page.
--
-- The rule that was intended:
--   patient   -> own DIDs, plus clinicians (to book and to verify a credential)
--   staff     -> everyone at their own hospital
--   platform  -> everything
--
-- dids_select_own, dids_select_clinician_directory, dids_select_consented and
-- dids_select_super_admin already cover the patient's legitimate needs, so this
-- only has to narrow the same-hospital policy to staff roles.
-- ============================================================================

drop policy if exists dids_select_same_hospital on public.dids;

-- Renamed as well as narrowed: the old name implied "anyone in my hospital",
-- which is exactly the misreading that caused the bug.
create policy dids_select_hospital_staff on public.dids
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and hospital_id = private.current_user_hospital()
  );

-- ─── audit_events ───────────────────────────────────────────────────────────
-- audit_events_select_admin was not hospital-scoped, so an admin at one hospital
-- could read another hospital's audit trail — including which clinicians were
-- onboarded and when.
--
-- The audit trail has no hospital_id column of its own (it is append-only and
-- deliberately never migrated), so scope through the actor's profile instead.
drop policy if exists audit_events_select_admin on public.audit_events;

create policy audit_events_select_admin on public.audit_events
  for select to authenticated
  using (
    private.is_super_admin()
    or (
      private.current_user_role() = 'admin'
      and (
        -- Rows whose actor belongs to the caller's hospital.
        exists (
          select 1
            from public.profiles pr
           where pr.id = public.audit_events.actor_id
             and pr.hospital_id = private.current_user_hospital()
        )
        -- Keep rows with no resolvable actor visible to admins only via the
        -- platform: an orphaned actor_id must not become a cross-tenant hole.
        or public.audit_events.actor_id = (select auth.uid())
      )
    )
  );

-- audit_events_select_own is unchanged: a user may always read their own trail,
-- which is what /patient/history renders.

comment on table public.audit_events is
  'Append-only audit trail. No client INSERT/UPDATE/DELETE policy at all. Reads: own rows, or an admin scoped to their hospital via the actor profile, or the platform.';
