-- ============================================================================
-- Hospital Infrastructure Hierarchy — Buildings, Floors, Wards
-- ============================================================================
-- Implements the complete hospital resource hierarchy:
--   Hospital → Building → Floor → Ward → Room → Bed
--
-- This migration adds the missing layers (Building, Floor, Ward) and updates
-- the existing rooms and beds tables to reference them. The hierarchy enables
-- proper drill-down navigation in the Admin Portal and ensures logical
-- organization of hospital resources.
--
-- Extended bed/room statuses include:
--   - available, occupied, reserved, cleaning, maintenance, blocked, emergency_reserved
-- ============================================================================

-- ─── Extended Status Enums ──────────────────────────────────────────────────
-- Drop and recreate bed_status to add new statuses
drop type if exists bed_status cascade;
create type bed_status as enum (
  'available',
  'occupied',
  'reserved',
  'cleaning',
  'maintenance',
  'blocked',
  'emergency_reserved'
);

-- Add room_status enum
create type room_status as enum (
  'available',
  'occupied',
  'reserved',
  'cleaning',
  'maintenance',
  'blocked',
  'emergency_reserved'
);

-- ─── Buildings Table ────────────────────────────────────────────────────────
create table public.buildings (
  building_id   uuid primary key default gen_random_uuid(),
  hospital_id   uuid not null references public.hospitals(hospital_id) on delete cascade,
  building_name text not null,
  building_code text,
  description   text,
  total_floors  int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint buildings_name_unique unique (hospital_id, building_name)
);

create index buildings_hospital_idx on public.buildings (hospital_id);

-- ─── Floors Table ───────────────────────────────────────────────────────────
create table public.floors (
  floor_id     uuid primary key default gen_random_uuid(),
  building_id  uuid not null references public.buildings(building_id) on delete cascade,
  hospital_id  uuid not null references public.hospitals(hospital_id) on delete cascade,
  floor_number int not null,
  floor_name   text not null,
  description  text,
  total_wards  int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint floors_number_unique unique (building_id, floor_number)
);

create index floors_building_idx on public.floors (building_id);
create index floors_hospital_idx on public.floors (hospital_id);

-- ─── Wards Table ────────────────────────────────────────────────────────────
create table public.wards (
  ward_id      uuid primary key default gen_random_uuid(),
  floor_id     uuid not null references public.floors(floor_id) on delete cascade,
  building_id  uuid not null references public.buildings(building_id) on delete cascade,
  hospital_id  uuid not null references public.hospitals(hospital_id) on delete cascade,
  ward_name    text not null,
  ward_code    text,
  ward_type    text, -- e.g., ICU, General, Pediatric, Emergency, etc.
  description  text,
  capacity     int not null default 0,
  total_rooms  int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint wards_name_unique unique (floor_id, ward_name)
);

create index wards_floor_idx on public.wards (floor_id);
create index wards_building_idx on public.wards (building_id);
create index wards_hospital_idx on public.wards (hospital_id);

-- ─── Update Rooms Table ─────────────────────────────────────────────────────
-- Add foreign keys to connect rooms to wards
alter table public.rooms add column if not exists ward_id uuid references public.wards(ward_id) on delete cascade;
alter table public.rooms add column if not exists building_id uuid references public.buildings(building_id) on delete cascade;
alter table public.rooms add column if not exists room_number text;
alter table public.rooms add column if not exists room_type text; -- Single, Double, ICU, etc.
alter table public.rooms add column if not exists status room_status not null default 'available';
alter table public.rooms add column if not exists capacity int not null default 1;
alter table public.rooms add column if not exists occupied_count int not null default 0;
alter table public.rooms add column if not exists created_at timestamptz not null default now();
alter table public.rooms add column if not exists updated_at timestamptz not null default now();

-- Rename category to room_type if not already done (for backward compatibility)
do $$
begin
  if exists (select 1 from information_schema.columns 
             where table_name = 'rooms' and column_name = 'category') then
    alter table public.rooms rename column category to room_type_old;
  end if;
end $$;

create index if not exists rooms_ward_idx on public.rooms (ward_id);
create index if not exists rooms_building_idx on public.rooms (building_id);

-- ─── Update Beds Table ──────────────────────────────────────────────────────
-- Add foreign keys to connect beds to rooms and wards
alter table public.beds add column if not exists room_id uuid references public.rooms(room_id) on delete cascade;
alter table public.beds add column if not exists ward_id uuid references public.wards(ward_id) on delete cascade;
alter table public.beds add column if not exists building_id uuid references public.buildings(building_id) on delete cascade;
alter table public.beds add column if not exists bed_number text;
alter table public.beds add column if not exists bed_type text; -- Standard, ICU, Pediatric, etc.
alter table public.beds add column if not exists created_at timestamptz not null default now();

-- Update bed status column to use new enum (preserve existing data)
alter table public.beds alter column status type bed_status using (
  case status::text
    when 'available' then 'available'::bed_status
    when 'occupied' then 'occupied'::bed_status
    when 'cleaning' then 'cleaning'::bed_status
    when 'maintenance' then 'maintenance'::bed_status
    else 'available'::bed_status
  end
);

-- Convert old ward text field to reference (later in a data migration)
-- For now, keep the old 'ward' text column for backward compatibility
alter table public.beds rename column ward to ward_name_legacy;

create index if not exists beds_room_idx on public.beds (room_id);
create index if not exists beds_ward_idx on public.beds (ward_id);
create index if not exists beds_building_idx on public.beds (building_id);

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.buildings enable row level security;
alter table public.floors enable row level security;
alter table public.wards enable row level security;

-- Buildings: Hospital admins and staff can view their hospital's buildings
create policy buildings_select_staff on public.buildings
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

-- Admins can create/update buildings in their hospital
create policy buildings_insert_admin on public.buildings
  for insert to authenticated
  with check (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

create policy buildings_update_admin on public.buildings
  for update to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  )
  with check (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

create policy buildings_delete_admin on public.buildings
  for delete to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

-- Floors: Same access pattern as buildings
create policy floors_select_staff on public.floors
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy floors_insert_admin on public.floors
  for insert to authenticated
  with check (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

create policy floors_update_admin on public.floors
  for update to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  )
  with check (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

create policy floors_delete_admin on public.floors
  for delete to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

-- Wards: Same access pattern
create policy wards_select_staff on public.wards
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy wards_insert_admin on public.wards
  for insert to authenticated
  with check (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

create policy wards_update_admin on public.wards
  for update to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  )
  with check (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

create policy wards_delete_admin on public.wards
  for delete to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

-- Update rooms policies to allow admin inserts
create policy rooms_insert_admin on public.rooms
  for insert to authenticated
  with check (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

create policy rooms_update_admin on public.rooms
  for update to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  )
  with check (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

create policy rooms_delete_admin on public.rooms
  for delete to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

-- Update beds policies to allow admin inserts
create policy beds_insert_admin on public.beds
  for insert to authenticated
  with check (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

create policy beds_delete_admin on public.beds
  for delete to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin')
    and private.can_access_hospital(hospital_id)
  );

-- ─── Updated_at Triggers ────────────────────────────────────────────────────
create trigger buildings_touch_updated_at
  before update on public.buildings
  for each row execute function public.touch_updated_at();

create trigger floors_touch_updated_at
  before update on public.floors
  for each row execute function public.touch_updated_at();

create trigger wards_touch_updated_at
  before update on public.wards
  for each row execute function public.touch_updated_at();

create trigger rooms_touch_updated_at
  before update on public.rooms
  for each row execute function public.touch_updated_at();

-- ─── Realtime ───────────────────────────────────────────────────────────────
-- Enable real-time updates for beds and rooms (already enabled, but ensure full replication)
alter table public.buildings replica identity full;
alter table public.floors replica identity full;
alter table public.wards replica identity full;
alter table public.rooms replica identity full;

alter publication supabase_realtime add table public.buildings;
alter publication supabase_realtime add table public.floors;
alter publication supabase_realtime add table public.wards;

-- ─── Seed Data for Development ──────────────────────────────────────────────
-- Create sample infrastructure for the seed hospital
do $$
declare
  seed_hospital uuid;
  building1_id uuid;
  building2_id uuid;
  floor1_id uuid;
  floor2_id uuid;
  ward1_id uuid;
  ward2_id uuid;
  ward3_id uuid;
begin
  -- Get the seed hospital
  select hospital_id into seed_hospital
    from public.hospitals where slug = 'apollo-consortium-general';

  if seed_hospital is null then
    raise notice 'Seed hospital not found, skipping sample data';
    return;
  end if;

  -- Create buildings
  insert into public.buildings (hospital_id, building_name, building_code, description, total_floors)
  values 
    (seed_hospital, 'Main Block', 'MB', 'Primary hospital building with emergency and outpatient services', 5),
    (seed_hospital, 'Specialty Block', 'SB', 'Specialized departments and ICU', 3)
  returning building_id into building1_id;

  select building_id into building2_id from public.buildings 
  where hospital_id = seed_hospital and building_code = 'SB';

  -- Create floors
  insert into public.floors (building_id, hospital_id, floor_number, floor_name, description, total_wards)
  values 
    (building1_id, seed_hospital, 1, 'Ground Floor', 'Emergency and OPD', 2),
    (building1_id, seed_hospital, 2, 'First Floor', 'General Ward', 3),
    (building2_id, seed_hospital, 1, 'Ground Floor', 'ICU and Critical Care', 2)
  returning floor_id into floor1_id;

  select floor_id into floor2_id from public.floors 
  where building_id = building1_id and floor_number = 2;

  -- Create wards
  insert into public.wards (floor_id, building_id, hospital_id, ward_name, ward_code, ward_type, capacity, total_rooms)
  values 
    (floor1_id, building1_id, seed_hospital, 'Emergency Ward', 'ER-01', 'Emergency', 20, 5),
    (floor2_id, building1_id, seed_hospital, 'General Ward A', 'GW-A', 'General', 30, 10),
    (floor2_id, building1_id, seed_hospital, 'General Ward B', 'GW-B', 'General', 25, 8)
  returning ward_id into ward1_id;

  select ward_id into ward2_id from public.wards 
  where ward_code = 'GW-A';
  
  select ward_id into ward3_id from public.wards 
  where ward_code = 'GW-B';

  -- Update existing rooms to reference wards (if any exist)
  update public.rooms 
  set ward_id = ward1_id, 
      building_id = building1_id,
      status = 'available'::room_status
  where hospital_id = seed_hospital
    and room_name like '%ER%'
    and ward_id is null;

  update public.rooms 
  set ward_id = ward2_id, 
      building_id = building1_id,
      status = 'available'::room_status
  where hospital_id = seed_hospital
    and room_name like '%Ward A%'
    and ward_id is null;

  -- Update existing beds to reference wards (if any exist)
  update public.beds 
  set ward_id = ward1_id, 
      building_id = building1_id
  where hospital_id = seed_hospital
    and ward_name_legacy like '%Emergency%'
    and ward_id is null;

  update public.beds 
  set ward_id = ward2_id, 
      building_id = building1_id
  where hospital_id = seed_hospital
    and ward_name_legacy like '%General%'
    and ward_id is null;

  raise notice 'Sample hospital infrastructure created successfully';
end $$;
