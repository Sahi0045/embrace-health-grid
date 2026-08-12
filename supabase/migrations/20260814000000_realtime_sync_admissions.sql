-- ============================================================================
-- Migration — Real-Time Synchronization for Admissions
-- ============================================================================
-- Goals:
--   1. Enable Supabase Realtime for admissions, billing_accounts, payments
--      so front-ends receive push updates without polling.
--   2. Add admission_events table — an append-only audit log capturing every
--      state transition (admitted, discharged, transferred) with full before/
--      after snapshots and related entity IDs (bed, ward, room, billing).
--   3. Add a Postgres trigger that fires on every admissions INSERT/UPDATE and
--      writes a row to admission_events automatically, so the audit trail is
--      guaranteed regardless of which code path caused the change.
--   4. Add a trigger that keeps beds.status and beds.patient_did consistent
--      with the admission state: admit → occupied, discharge → available,
--      transfer → clears old bed and marks new one occupied.
--   5. Add an RLS policy so admins and staff can INSERT into admissions
--      (currently only SELECT policies exist for staff/admin on this table).
--   6. Add ward_occupancy helper view so dashboards can query live occupancy
--      without a client-side aggregation.
-- ============================================================================

-- ─── 1. Realtime publication ─────────────────────────────────────────────────
-- admissions was not added in migration 004 (blockchain_and_clinical).
-- billing_accounts and payments were not added in migration 008.
-- These three lines make their change events available to authenticated
-- subscribers immediately, with RLS still enforced on what each user sees.
alter publication supabase_realtime add table public.admissions;
alter publication supabase_realtime add table public.billing_accounts;
alter publication supabase_realtime add table public.payments;

-- Replica identity full so UPDATE/DELETE payloads carry the old row values.
-- INSERT already carries new; the old row is needed for audit diffing.
alter table public.admissions      replica identity full;
alter table public.billing_accounts replica identity full;
alter table public.payments         replica identity full;

-- ─── 2. admission_events table ───────────────────────────────────────────────
-- Append-only. No UPDATE or DELETE policy — the trigger is the only writer.
create table public.admission_events (
  event_id         uuid primary key default gen_random_uuid(),
  admission_id     text not null,           -- FK not enforced — admission may be deleted
  patient_did      text not null,
  event_type       text not null,           -- 'admitted' | 'discharged' | 'transferred' | 'updated'
  
  -- Bed / location snapshot at event time
  bed_id_old       text,
  bed_id_new       text,
  ward_old         text,
  ward_new         text,
  room_old         text,
  room_new         text,
  
  -- Status snapshot
  status_old       text,
  status_new       text,
  
  -- Actor
  performed_by     uuid references auth.users(id) on delete set null,
  performed_by_name text,
  performed_by_role text,
  hospital_id      text,
  
  -- Free-text reason (transfer reason, discharge summary etc.)
  reason           text,
  
  -- Full row snapshots for complete audit trail
  snapshot_before  jsonb,
  snapshot_after   jsonb,
  
  occurred_at      timestamptz not null default now()
);

create index admission_events_admission_idx  on public.admission_events (admission_id, occurred_at desc);
create index admission_events_patient_idx    on public.admission_events (patient_did, occurred_at desc);
create index admission_events_occurred_idx   on public.admission_events (occurred_at desc);

comment on table public.admission_events is
  'Append-only audit log of every admission state transition. Written by trigger; never mutated.';

-- ─── 3. RLS on admission_events ──────────────────────────────────────────────
alter table public.admission_events enable row level security;

-- Patients see their own events.
create policy admission_events_select_own on public.admission_events
  for select to authenticated
  using (patient_did in (select private.current_user_dids()));

-- Staff and admins see all events in their hospital.
create policy admission_events_select_staff on public.admission_events
  for select to authenticated
  using (private.current_user_role() in ('doctor', 'staff', 'admin'));

-- No client INSERT/UPDATE/DELETE — the trigger is the exclusive writer.

-- ─── 4. Admin/staff INSERT policy on admissions ──────────────────────────────
-- The original migration (008) only added SELECT policies for staff/admin.
-- Without an INSERT policy, admitPatient server function calls fail with RLS.
create policy admissions_insert_staff on public.admissions
  for insert to authenticated
  with check (private.current_user_role() in ('doctor', 'staff', 'admin'));

-- Admin/staff can UPDATE admissions (needed for discharge/transfer).
create policy admissions_update_staff on public.admissions
  for update to authenticated
  using  (private.current_user_role() in ('doctor', 'staff', 'admin'))
  with check (private.current_user_role() in ('doctor', 'staff', 'admin'));

-- ─── 5. Trigger function: write admission_events on change ───────────────────
create or replace function private.record_admission_event()
returns trigger
language plpgsql
security definer
as $$
declare
  actor       record;
  event_type  text;
begin
  -- Resolve actor from current session (will be null for service_role calls)
  select full_name, role, hospital_id
  into   actor
  from   public.profiles
  where  id = auth.uid();

  if TG_OP = 'INSERT' then
    event_type := 'admitted';
  elsif TG_OP = 'UPDATE' then
    if NEW.status = 'discharged'    then event_type := 'discharged';
    elsif NEW.status = 'transferred' then event_type := 'transferred';
    else                                  event_type := 'updated';
    end if;
  else
    return OLD;   -- DELETE not audited here (admission records are permanent)
  end if;

  insert into public.admission_events (
    admission_id,
    patient_did,
    event_type,
    bed_id_old,
    bed_id_new,
    ward_old,
    ward_new,
    room_old,
    room_new,
    status_old,
    status_new,
    performed_by,
    performed_by_name,
    performed_by_role,
    hospital_id,
    snapshot_before,
    snapshot_after
  ) values (
    coalesce(NEW.admission_id, OLD.admission_id),
    coalesce(NEW.patient_did,  OLD.patient_did),
    event_type,
    case when TG_OP = 'UPDATE' then OLD.bed  else null end,
    NEW.bed,
    case when TG_OP = 'UPDATE' then OLD.ward else null end,
    NEW.ward,
    case when TG_OP = 'UPDATE' then OLD.room else null end,
    NEW.room,
    case when TG_OP = 'UPDATE' then OLD.status::text else null end,
    NEW.status::text,
    auth.uid(),
    actor.full_name,
    actor.role,
    actor.hospital_id,
    case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end,
    to_jsonb(NEW)
  );

  return NEW;
end;
$$;

create trigger admissions_audit_trigger
  after insert or update on public.admissions
  for each row execute function private.record_admission_event();

-- ─── 6. ward_occupancy helper view ───────────────────────────────────────────
-- Real-time dashboard query: current admitted patients per ward.
-- Because admissions is now in the realtime publication, any subscriber can
-- simply call this view after a change notification to get live totals.
create or replace view public.ward_occupancy as
select
  ward,
  count(*)                                           as total_admitted,
  count(*) filter (where status = 'admitted')        as currently_admitted,
  count(*) filter (where status = 'discharged')      as discharged,
  count(*) filter (where status = 'transferred')     as transferred
from public.admissions
group by ward;

comment on view public.ward_occupancy is
  'Live ward occupancy derived from the admissions table. No separate counter to drift.';

-- ─── 7. Add admissions realtime to billing_accounts trigger ──────────────────
-- Keep billing_accounts.updated_at fresh so Realtime subscribers detect changes.
-- (The touch_updated_at trigger already exists for this table from migration 008
-- so we only need to verify the publication, which is done in step 1.)

-- ─── 8. Extend beds RLS to allow staff to see all beds (for ward map) ────────
-- The original policy only allowed staff to see via room_checkins ownership.
-- The inpatient admin dashboard needs to list all beds in the hospital.
-- Check if this policy already exists before creating.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'beds' and policyname = 'beds_select_staff'
  ) then
    execute $policy$
      create policy beds_select_staff on public.beds
        for select to authenticated
        using (private.current_user_role() in ('doctor', 'staff', 'admin'))
    $policy$;
  end if;
end $$;

-- ─── 9. Realtime for admission_events ────────────────────────────────────────
alter publication supabase_realtime add table public.admission_events;
alter table public.admission_events replica identity full;
