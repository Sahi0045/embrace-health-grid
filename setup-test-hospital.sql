-- Setup Test Hospital and Admin User
-- Run this in Supabase SQL Editor to create a test hospital and assign it to your admin user

-- 1. Create a test hospital (if not exists)
INSERT INTO public.hospitals (hospital_id, hospital_name, slug, created_at, updated_at)
VALUES (
  'test-hospital-001',
  'Test General Hospital',
  'test-general-hospital',
  now(),
  now()
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Check if hospital was created
SELECT hospital_id, hospital_name, slug FROM public.hospitals WHERE slug = 'test-general-hospital';

-- 3. Update your admin user to have this hospital_id
-- Replace 'your-admin-email@example.com' with your actual admin email
UPDATE public.profiles
SET hospital_id = 'test-hospital-001'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'admin@apollohospitals.com'
);

-- 4. Verify user has hospital_id
SELECT 
  u.email,
  p.hospital_id,
  p.full_name,
  h.hospital_name
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.hospitals h ON h.hospital_id = p.hospital_id
WHERE u.email = 'admin@apollohospitals.com';

-- 5. If you need to create the admin user (if doesn't exist)
-- NOTE: This creates the profile, but you still need to create the auth user
-- through Supabase Dashboard → Authentication → Add User

INSERT INTO public.profiles (id, full_name, primary_did, hospital_id)
SELECT 
  u.id,
  'Admin User',
  'did:hosp:admin-001',
  'test-hospital-001'
FROM auth.users u
WHERE u.email = 'admin@apollohospitals.com'
ON CONFLICT (id) DO UPDATE SET 
  hospital_id = 'test-hospital-001',
  full_name = 'Admin User';

-- 6. Final verification - check everything is set up
SELECT 
  u.email as user_email,
  p.full_name,
  p.hospital_id,
  h.hospital_name,
  CASE 
    WHEN p.hospital_id IS NULL THEN '❌ No hospital assigned'
    WHEN h.hospital_id IS NULL THEN '❌ Hospital not found'
    ELSE '✅ Ready to test'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.hospitals h ON h.hospital_id = p.hospital_id
WHERE u.email = 'admin@apollohospitals.com';
