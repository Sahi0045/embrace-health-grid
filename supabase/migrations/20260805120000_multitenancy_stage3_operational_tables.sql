-- ============================================================================
-- Multi-tenancy Stage 3 — hospital-owned operational tables
-- ============================================================================
-- These tables describe a hospital's own operations: its beds, rooms, staff
-- rota, attendance, equipment, ambulances, internal requests, policies and
-- fraud alerts. None of it is patient-owned, and none of it has any reason to
-- cross a tenant boundary — unlike clinical records, which follow the patient
-- (Stage 4).
--
-- So these get hard isolation: same hospital, or super_admin. Every policy here
-- was previously scoped by role alone, e.g.
--
--   beds_select_staff  USING (role in ('doctor','staff','admin'))
--
-- which let a clinician at one hospital read another hospital's bed occupancy,
-- rota and equipment register.
--
-- Two tables keep a deliberate exception, noted inline: rooms and
-- governance_policies.
-- ============================================================================

-- ─── 1. Add the tenant column ───────────────────────────────────────────────
alter table public.beds                add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.rooms               add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.room_checkins       add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.room_checkin_events add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.attendance          add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.staff_schedule      add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.equipment           add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.ambulances          add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.staff_requests      add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.governance_policies add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.fraud_alerts        add column if not exists hospital_id uuid references public.hospitals (hospital_id);

-- Every policy below filters on hospital_id, so each wants an index.
create index if not exists beds_hospital_idx                on public.beds (hospital_id);
create index if not exists rooms_hospital_idx               on public.rooms (hospital_id);
create index if not exists room_checkins_hospital_idx       on public.room_checkins (hospital_id);
create index if not exists room_checkin_events_hospital_idx on public.room_checkin_events (hospital_id);
create index if not exists attendance_hospital_idx          on public.attendance (hospital_id);
create index if not exists staff_schedule_hospital_idx      on public.staff_schedule (hospital_id);
create index if not exists equipment_hospital_idx           on public.equipment (hospital_id);
create index if not exists ambulances_hospital_idx          on public.ambulances (hospital_id);
create index if not exists staff_requests_hospital_idx      on public.staff_requests (hospital_id);
create index if not exists governance_policies_hospital_idx on public.governance_policies (hospital_id);
create index if not exists fraud_alerts_hospital_idx        on public.fraud_alerts (hospital_id);

-- ─── 2. Backfill existing rows ──────────────────────────────────────────────
-- Everything currently in the database belongs to the one hospital seeded in
-- Stage 1. Without this the new policies would hide every existing row.
do $$
declare
  seed_hospital uuid;
begin
  select hospital_id into seed_hospital
    from public.hospitals where slug = 'apollo-consortium-general';

  if seed_hospital is null then
    raise exception 'Stage 1 seed hospital is missing; run migrations in order';
  end if;

  update public.beds                set hospital_id = seed_hospital where hospital_id is null;
  update public.rooms               set hospital_id = seed_hospital where hospital_id is null;
  update public.room_checkins       set hospital_id = seed_hospital where hospital_id is null;
  update public.room_checkin_events set hospital_id = seed_hospital where hospital_id is null;
  update public.attendance          set hospital_id = seed_hospital where hospital_id is null;
  update public.staff_schedule      set hospital_id = seed_hospital where hospital_id is null;
  update public.equipment           set hospital_id = seed_hospital where hospital_id is null;
  update public.ambulances          set hospital_id = seed_hospital where hospital_id is null;
  update public.staff_requests      set hospital_id = seed_hospital where hospital_id is null;
  update public.governance_policies set hospital_id = seed_hospital where hospital_id is null;
  update public.fraud_alerts        set hospital_id = seed_hospital where hospital_id is null;
end $$;

-- ─── 3. Beds ────────────────────────────────────────────────────────────────
-- A patient keeps sight of their own bed regardless of hospital: they may be
-- admitted somewhere other than the hospital that registered them.
drop policy if exists beds_select_staff on public.beds;
drop policy if exists beds_update_staff on public.beds;

create policy beds_select_staff on public.beds
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy beds_update_staff on public.beds
  for update to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  )
  with check (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

-- ─── 4. Rooms ───────────────────────────────────────────────────────────────
-- Was USING (true) for every authenticated user. A room number is not sensitive
-- in itself, but a hospital's full floor plan and capacity is competitive
-- information, and there is no cross-tenant use for it.
drop policy if exists rooms_select_authenticated on public.rooms;

create policy rooms_select_same_hospital on public.rooms
  for select to authenticated
  using (private.can_access_hospital(hospital_id));

-- ─── 5. Room check-ins ──────────────────────────────────────────────────────
drop policy if exists room_checkins_select_staff       on public.room_checkins;
drop policy if exists room_checkin_events_select_staff on public.room_checkin_events;

create policy room_checkins_select_staff on public.room_checkins
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

-- room_checkin_events rows are merkle leaves, so they stay append-only: there
-- is still no UPDATE or DELETE policy, only a narrower SELECT.
create policy room_checkin_events_select_staff on public.room_checkin_events
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

-- ─── 6. Attendance and rota ─────────────────────────────────────────────────
-- attendance_select_admin previously let ANY admin read every hospital's
-- attendance. An admin is now a hospital admin, so it is scoped; a super_admin
-- still sees everything via can_access_hospital.
drop policy if exists attendance_select_admin     on public.attendance;
drop policy if exists staff_schedule_select_staff on public.staff_schedule;

create policy attendance_select_admin on public.attendance
  for select to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

-- attendance_select_own is unchanged: a staff member reads their own record
-- regardless of hospital scoping.

create policy staff_schedule_select_staff on public.staff_schedule
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

-- ─── 7. Equipment and ambulances ────────────────────────────────────────────
drop policy if exists equipment_select_staff  on public.equipment;
drop policy if exists equipment_update_staff  on public.equipment;
drop policy if exists ambulances_select_staff on public.ambulances;
drop policy if exists ambulances_update_staff on public.ambulances;

create policy equipment_select_staff on public.equipment
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy equipment_update_staff on public.equipment
  for update to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  )
  with check (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy ambulances_select_staff on public.ambulances
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy ambulances_update_staff on public.ambulances
  for update to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  )
  with check (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

-- ─── 8. Staff requests ──────────────────────────────────────────────────────
-- A leave request names a person and a reason, so an admin at another hospital
-- must not see it.
drop policy if exists staff_requests_select_admin on public.staff_requests;
drop policy if exists staff_requests_update_admin on public.staff_requests;

create policy staff_requests_select_admin on public.staff_requests
  for select to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

create policy staff_requests_update_admin on public.staff_requests
  for update to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  )
  with check (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

-- ─── 9. Governance policies ─────────────────────────────────────────────────
-- Readable across tenants on purpose: a patient is entitled to see the policy a
-- hospital operates under before consenting, and platform-wide policies
-- (hospital_id is null) apply to everyone. Writes stay scoped.
drop policy if exists governance_policies_update_admin on public.governance_policies;

create policy governance_policies_update_admin on public.governance_policies
  for update to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  )
  with check (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

-- ─── 10. Fraud alerts ───────────────────────────────────────────────────────
-- An alert names a suspected actor, so it stays admin-only AND hospital-scoped.
-- Still no policy for other roles, deliberately.
drop policy if exists fraud_alerts_select_admin on public.fraud_alerts;
drop policy if exists fraud_alerts_update_admin on public.fraud_alerts;

create policy fraud_alerts_select_admin on public.fraud_alerts
  for select to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

create policy fraud_alerts_update_admin on public.fraud_alerts
  for update to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  )
  with check (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );
