-- ============================================================================
-- Migration: Hospital Infrastructure Hierarchy Seed Fix
-- ============================================================================
-- Fixes seed hospital infrastructure for Apollo General:
--   1. Ensures Buildings (Main Block, Specialty Block) exist for the tenant.
--   2. Ensures Floors (Ground Floor, First Floor) exist.
--   3. Ensures Wards (Emergency Ward, Cardiology Ward, General Ward A) exist.
--   4. Links existing rooms to their respective buildings and wards.
--   5. Links existing beds to their respective rooms, wards, and buildings.
-- ============================================================================

do $$
declare
  seed_hospital uuid;
  building1_id uuid;
  building2_id uuid;
  floor1_id uuid;
  floor2_id uuid;
  ward_er uuid;
  ward_cardio uuid;
  ward_general uuid;
begin
  -- Resolve seed hospital by slug
  select hospital_id into seed_hospital
    from public.hospitals 
   where slug in ('apollo-general', 'apollo-consortium-general')
   limit 1;

  if seed_hospital is null then
    raise notice 'Seed hospital not found, skipping sample data';
    return;
  end if;

  -- 1. Create or retrieve Buildings
  insert into public.buildings (hospital_id, building_name, building_code, description, total_floors)
  values 
    (seed_hospital, 'Main Block', 'MB', 'Primary clinical block with outpatient, inpatient, and emergency services', 5),
    (seed_hospital, 'Specialty Block', 'SB', 'Specialized cardiology, oncology, and intensive care units', 3)
  on conflict (hospital_id, building_name) do update
    set description = excluded.description,
        total_floors = excluded.total_floors;

  select building_id into building1_id from public.buildings 
  where hospital_id = seed_hospital and building_code = 'MB';

  select building_id into building2_id from public.buildings 
  where hospital_id = seed_hospital and building_code = 'SB';

  -- 2. Create or retrieve Floors
  insert into public.floors (building_id, hospital_id, floor_number, floor_name, description, total_wards)
  values 
    (building1_id, seed_hospital, 1, 'Ground Floor', 'Emergency care, triage, and admissions registry', 2),
    (building1_id, seed_hospital, 2, 'First Floor', 'Inpatient wards and diagnostic suites', 3)
  on conflict (building_id, floor_number) do update
    set floor_name = excluded.floor_name,
        description = excluded.description;

  select floor_id into floor1_id from public.floors 
  where building_id = building1_id and floor_number = 1;

  select floor_id into floor2_id from public.floors 
  where building_id = building1_id and floor_number = 2;

  -- 3. Create or retrieve Wards
  insert into public.wards (floor_id, building_id, hospital_id, ward_name, ward_code, ward_type, description, capacity, total_rooms)
  values 
    (floor1_id, building1_id, seed_hospital, 'Emergency Ward', 'ER-01', 'Emergency', '24/7 Trauma and acute stabilization ward', 20, 5)
  on conflict (floor_id, ward_name) do update
    set ward_code = excluded.ward_code,
        ward_type = excluded.ward_type;

  insert into public.wards (floor_id, building_id, hospital_id, ward_name, ward_code, ward_type, description, capacity, total_rooms)
  values 
    (floor2_id, building1_id, seed_hospital, 'Cardiology Ward', 'CARD-01', 'General', 'Cardiology telemetry, post-op recovery, and monitoring', 25, 8),
    (floor2_id, building1_id, seed_hospital, 'General Ward A', 'GW-A', 'General', 'General medicine and surgical inpatient care', 30, 10)
  on conflict (floor_id, ward_name) do update
    set ward_code = excluded.ward_code,
        ward_type = excluded.ward_type;

  select ward_id into ward_er from public.wards where floor_id = floor1_id and ward_name = 'Emergency Ward';
  select ward_id into ward_cardio from public.wards where floor_id = floor2_id and ward_name = 'Cardiology Ward';
  select ward_id into ward_general from public.wards where floor_id = floor2_id and ward_name = 'General Ward A';

  -- 4. Update Rooms hierarchy linkage
  update public.rooms 
  set building_id = building1_id,
      ward_id = ward_cardio,
      room_number = '204',
      room_type = 'Single',
      capacity = 2,
      status = 'available'
  where room_id = 'SEED-RM-C204';

  update public.rooms 
  set building_id = building1_id,
      ward_id = ward_cardio,
      room_number = '205',
      room_type = 'Single',
      capacity = 1,
      status = 'available'
  where room_id = 'SEED-RM-C205';

  update public.rooms 
  set building_id = building1_id,
      ward_id = ward_general,
      room_number = '110',
      room_type = 'Double',
      capacity = 2,
      status = 'available'
  where room_id = 'SEED-RM-G110';

  update public.rooms 
  set building_id = building1_id,
      ward_id = ward_cardio,
      room_number = 'OR-2',
      room_type = 'Operating',
      capacity = 1,
      status = 'available'
  where room_id = 'SEED-RM-OR2';

  -- 5. Update Beds hierarchy linkage
  update public.beds
  set building_id = building1_id,
      ward_id = ward_cardio,
      room_id = 'SEED-RM-C204',
      bed_number = 'C204-A',
      bed_type = 'Electric'
  where bed_id = 'SEED-BED-C204B1';

  update public.beds
  set building_id = building1_id,
      ward_id = ward_cardio,
      room_id = 'SEED-RM-C204',
      bed_number = 'C204-B',
      bed_type = 'Standard'
  where bed_id = 'SEED-BED-C204B2';

  update public.beds
  set building_id = building1_id,
      ward_id = ward_cardio,
      room_id = 'SEED-RM-C205',
      bed_number = 'C205-A',
      bed_type = 'ICU'
  where bed_id = 'SEED-BED-C205B1';

  update public.beds
  set building_id = building1_id,
      ward_id = ward_general,
      room_id = 'SEED-RM-G110',
      bed_number = 'G110-A',
      bed_type = 'Standard'
  where bed_id = 'SEED-BED-G110B1';

  update public.beds
  set building_id = building1_id,
      ward_id = ward_general,
      room_id = 'SEED-RM-G110',
      bed_number = 'G110-B',
      bed_type = 'Standard'
  where bed_id = 'SEED-BED-G110B2';

  raise notice 'Hospital infrastructure seed hierarchy fixed successfully';
end $$;
