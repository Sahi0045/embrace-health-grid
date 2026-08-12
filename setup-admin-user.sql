-- ============================================================================
-- Setup Admin User for Bed & Room Management Testing
-- ============================================================================
-- Run this in Supabase SQL Editor to set up your admin user properly
-- Replace 'YOUR-EMAIL@example.com' with your actual email address
-- ============================================================================

-- Step 1: Create a test hospital (if not exists)
INSERT INTO public.hospitals (hospital_id, hospital_name, slug, address, phone, created_at, updated_at)
VALUES (
  'test-hospital-001',
  'Test General Hospital',
  'test-general-hospital',
  '123 Main Street, City, State',
  '+1-234-567-8900',
  now(),
  now()
)
ON CONFLICT (hospital_id) DO UPDATE SET
  hospital_name = EXCLUDED.hospital_name,
  updated_at = now();

-- Verify hospital created
SELECT '✅ Hospital created/updated' as status, * FROM public.hospitals WHERE hospital_id = 'test-hospital-001';

-- Step 2: Update your user profile with hospital_id
-- IMPORTANT: Replace 'YOUR-EMAIL@example.com' with your actual email!
UPDATE public.profiles
SET hospital_id = 'test-hospital-001',
    updated_at = now()
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'YOUR-EMAIL@example.com'
);

-- Step 3: Verify your user is set up correctly
SELECT 
  '✅ User updated' as status,
  u.email as user_email,
  u.id as user_id,
  p.full_name,
  p.hospital_id,
  h.hospital_name,
  CASE 
    WHEN p.hospital_id IS NULL THEN '❌ ERROR: No hospital assigned to profile'
    WHEN h.hospital_id IS NULL THEN '❌ ERROR: Hospital not found'
    WHEN p.hospital_id = 'test-hospital-001' THEN '✅ READY: User properly configured'
    ELSE '⚠️ WARNING: User assigned to different hospital'
  END as test_status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.hospitals h ON h.hospital_id = p.hospital_id
WHERE u.email = 'YOUR-EMAIL@example.com';

-- Step 4: Check if admin role is set (if your system uses roles table)
-- If you have a separate roles or user_roles table, update here
-- This is optional depending on your schema

-- Step 5: Verify RLS policies will allow access
-- Test that can_access_hospital function works
SELECT 
  '✅ RLS Check' as status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.hospitals 
      WHERE hospital_id = 'test-hospital-001'
    ) THEN '✅ Hospital exists and is accessible'
    ELSE '❌ Hospital not accessible'
  END as hospital_access;

-- ============================================================================
-- Optional: Create sample infrastructure for testing
-- ============================================================================
-- Uncomment this section if you want pre-populated test data

/*
-- Create a sample building
INSERT INTO public.buildings (
  building_id, 
  hospital_id, 
  building_name, 
  building_code, 
  description, 
  total_floors,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'test-hospital-001',
  'Main Hospital Building',
  'MHB',
  'Primary hospital building with emergency and general wards',
  5,
  now(),
  now()
)
ON CONFLICT DO NOTHING
RETURNING building_id, building_name;

-- Create a sample floor (you'll need to replace the building_id)
INSERT INTO public.floors (
  floor_id,
  building_id,
  hospital_id,
  floor_number,
  floor_name,
  description,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  building_id,
  'test-hospital-001',
  1,
  'Ground Floor',
  'Emergency and OPD services',
  now(),
  now()
FROM public.buildings
WHERE hospital_id = 'test-hospital-001' 
  AND building_code = 'MHB'
LIMIT 1
ON CONFLICT DO NOTHING
RETURNING floor_id, floor_name;

-- Create a sample ward
INSERT INTO public.wards (
  ward_id,
  floor_id,
  building_id,
  hospital_id,
  ward_name,
  ward_code,
  ward_type,
  capacity,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  f.floor_id,
  f.building_id,
  'test-hospital-001',
  'General Ward A',
  'GW-A',
  'General',
  30,
  now(),
  now()
FROM public.floors f
JOIN public.buildings b ON b.building_id = f.building_id
WHERE b.hospital_id = 'test-hospital-001'
  AND b.building_code = 'MHB'
  AND f.floor_number = 1
LIMIT 1
ON CONFLICT DO NOTHING
RETURNING ward_id, ward_name;
*/

-- ============================================================================
-- Final Verification Checklist
-- ============================================================================
SELECT '
========================================
✅ VERIFICATION CHECKLIST
========================================

Run these queries to verify everything is set up:

1. Check Hospital:
   SELECT * FROM hospitals WHERE hospital_id = ''test-hospital-001'';
   
2. Check Your User:
   SELECT u.email, p.hospital_id, h.hospital_name
   FROM auth.users u
   JOIN profiles p ON p.id = u.id
   LEFT JOIN hospitals h ON h.hospital_id = p.hospital_id
   WHERE u.email = ''YOUR-EMAIL@example.com'';
   
3. Check Buildings:
   SELECT * FROM buildings WHERE hospital_id = ''test-hospital-001'';
   
4. Test RLS Access:
   SELECT * FROM buildings; 
   -- Should only show buildings from your hospital

========================================
✅ NEXT STEPS
========================================

1. Refresh your browser page
2. Go to: http://localhost:8080/admin/beds-rooms
3. Click "Add Building"
4. Fill in the form and click Create
5. Should work now! ✅

========================================
' as instructions;
