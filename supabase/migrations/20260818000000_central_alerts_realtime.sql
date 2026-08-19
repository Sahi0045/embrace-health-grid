-- ============================================================================
-- Migration: Central Alerts & Notifications Infrastructure
-- ============================================================================
-- 1. Enable Realtime on fraud_alerts for live security alerts
-- 2. Create emergency_broadcasts table for hospital-wide clinical code alerts
-- 3. Setup RLS and Realtime publication
-- ============================================================================

-- ─── 1. Emergency Broadcasts Table ───────────────────────────────────────────
create table if not exists public.emergency_broadcasts (
  broadcast_id     uuid primary key default gen_random_uuid(),
  hospital_id      uuid references public.hospitals(hospital_id) on delete cascade,
  broadcast_code   text not null check (broadcast_code in ('code_blue', 'code_red', 'trauma_alpha', 'mass_casualty', 'cyber_incident', 'lockdown', 'disaster')),
  title            text not null,
  severity         text not null check (severity in ('critical', 'warning', 'info')),
  message          text not null,
  location         text not null,
  initiator_did    text not null,
  initiator_name   text not null,
  status           text not null default 'active' check (status in ('active', 'acknowledged', 'resolved', 'cancelled')),
  acknowledged_by  text,
  acknowledged_at  timestamptz,
  resolved_at      timestamptz,
  metadata         jsonb default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists emergency_broadcasts_hospital_idx on public.emergency_broadcasts (hospital_id);
create index if not exists emergency_broadcasts_status_idx   on public.emergency_broadcasts (status, created_at desc);
create index if not exists emergency_broadcasts_code_idx     on public.emergency_broadcasts (broadcast_code);

-- ─── 2. Row Level Security ───────────────────────────────────────────────────
alter table public.emergency_broadcasts enable row level security;

-- NOTE: 'nurse' is not a value of user_role, which is
-- patient|doctor|staff|admin|super_admin. Listing it made Postgres reject these
-- policies outright. Nursing staff are modelled as 'staff' (the Nurses tab on
-- /admin/people filters staff), so 'staff' already covers them.

create policy emergency_broadcasts_select on public.emergency_broadcasts
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin', 'super_admin')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  );

create policy emergency_broadcasts_insert on public.emergency_broadcasts
  for insert to authenticated
  with check (
    private.current_user_role() in ('doctor', 'staff', 'admin', 'super_admin')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  );

create policy emergency_broadcasts_update on public.emergency_broadcasts
  for update to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin', 'staff', 'doctor')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  )
  with check (
    private.current_user_role() in ('admin', 'super_admin', 'staff', 'doctor')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  );

-- ─── 3. Add to Supabase Realtime Publication ─────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'fraud_alerts'
  ) then
    alter publication supabase_realtime add table public.fraud_alerts;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'emergency_broadcasts'
  ) then
    alter publication supabase_realtime add table public.emergency_broadcasts;
  end if;
end $$;
