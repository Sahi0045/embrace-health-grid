# Quick Start - Bed & Room Management Testing

## ✅ Issues Fixed
1. ✅ React import missing - **FIXED**
2. ✅ Duplicate `callerHospitalId()` function - **FIXED**
3. ✅ Create functions added to operations.server.ts

## 🚀 Steps to Test Now

### Step 1: Restart Your Dev Server
The server needs to reload with the fixed code:
```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 2: Setup Your Hospital & User
Run this SQL in **Supabase SQL Editor**:

```sql
-- 1. Create your test hospital
INSERT INTO public.hospitals (hospital_id, hospital_name, slug, created_at, updated_at)
VALUES (
  'test-hospital-001',
  'Test General Hospital',
  'test-general-hospital',
  now(),
  now()
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Update your admin user (replace email with yours)
UPDATE public.profiles
SET hospital_id = 'test-hospital-001'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'YOUR-EMAIL@example.com'
);

-- 3. Verify setup
SELECT 
  u.email,
  p.hospital_id,
  h.hospital_name
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.hospitals h ON h.hospital_id = p.hospital_id
WHERE u.email = 'YOUR-EMAIL@example.com';
```

**Expected Result:** Should show your email with hospital_id = 'test-hospital-001'

### Step 3: Test Creating a Building
1. Go to: http://localhost:8080/admin/beds-rooms
2. Click **"Add Building"** button
3. Fill in:
   - **Building Name:** `Main Block`
   - **Building Code:** `MB`
   - **Description:** `Emergency and OPD`
   - **Total Floors:** `3`
4. Click **"Create"**
5. ✅ Should succeed now!

## 📋 What Each Status Means

When you update bed status, you can choose from:

| Status | Color | When to Use |
|--------|-------|-------------|
| **Available** | 🟢 Green | Bed is ready for a new patient |
| **Occupied** | 🔵 Blue | Patient is currently using the bed |
| **Reserved** | 🟡 Yellow | Bed is booked for incoming patient |
| **Cleaning** | 🔵 Light Blue | Being sanitized after patient discharge |
| **Maintenance** | 🟠 Orange | Bed needs repair or servicing |
| **Blocked** | 🔴 Red | Temporarily unavailable (infection control, etc.) |
| **Emergency Reserved** | 🔴 Dark Red | Reserved for emergency cases only |

## 🧪 Test Scenarios

### Test 1: Create Complete Hierarchy (5 mins)
**Goal:** Build infrastructure from scratch

1. **Create Building:**
   - Name: `Main Wing`
   - Code: `MW`

2. **Create Floor:**
   - Click "Add Floor" next to your building
   - Number: `1`
   - Name: `Ground Floor`

3. **Create Ward:**
   - Click "Add Ward" next to your floor
   - Name: `General Ward A`
   - Type: `General`
   - Capacity: `30`

4. **Create Room:**
   - Click "Add Room" next to your ward
   - Name: `Room 101`
   - Type: `Single`
   - Capacity: `1`

5. **Create Bed:**
   - Click "Add Bed" next to your room
   - Number: `B-101-A`
   - Type: `Standard`

✅ **Success:** You now have a complete hierarchy!

### Test 2: Update Bed Status (2 mins)
**Goal:** Test the main feature

1. Go to **"All Beds"** tab
2. Find your bed (`B-101-A`)
3. Click **"Update Status"**
4. Change from `Available` to `Occupied`
5. Click **"Update Status"**

✅ **Expected:**
- Badge changes from green to blue
- Statistics update (Available ↓, Occupied ↑)

### Test 3: Real-time Updates (3 mins)
**Goal:** Verify live synchronization

**Setup Two Browser Windows:**

**Window 1 - Admin:**
- URL: http://localhost:8080/admin/beds-rooms
- Keep on "All Beds" tab

**Window 2 - Staff:**
- URL: http://localhost:8080/staff/rooms
- Login as staff/doctor
- Scroll to "Bed & Room Availability"
- Click "Show Details"

**Test:**
1. In Window 1, update any bed status
2. Watch Window 2 - should update in 1-2 seconds
3. No page refresh needed!

✅ **Expected:** Staff portal updates automatically

### Test 4: Patient Portal (2 mins)
**Goal:** Verify aggregate statistics

1. Open: http://localhost:8080/patient/inpatient
2. Login as patient
3. Find "Hospital Bed Availability" card
4. Should show aggregate statistics only

✅ **Expected:** 
- Shows total counts (Available, Occupied, etc.)
- No individual bed details (privacy)
- Updates when admin changes status

## 🐛 Common Issues

### Issue: "User has no hospital assigned"
**Solution:** Run Step 2 above (Setup Your Hospital & User)

### Issue: Page not loading / 500 error
**Solution:** 
1. Restart dev server
2. Check browser console for errors
3. Verify operations.server.ts has no syntax errors

### Issue: "Failed to create building"
**Solution:**
1. Check you're logged in as admin
2. Verify hospital_id is set in database
3. Check browser console for specific error

### Issue: Can't see buildings in hierarchy
**Solution:**
1. Migration might not be applied
2. Run migration SQL in Supabase
3. Or manually create test data

## 📊 Quick Verification

After creating your first building, verify in Supabase SQL Editor:

```sql
-- Check your building was created
SELECT * FROM buildings WHERE building_name = 'Main Block';

-- Check your hospital
SELECT * FROM hospitals WHERE slug = 'test-general-hospital';

-- Check your user profile
SELECT * FROM profiles WHERE hospital_id = 'test-hospital-001';
```

## ✅ Success Criteria

You're ready to proceed if:
- [ ] Dev server running without errors
- [ ] Can access /admin/beds-rooms page
- [ ] Can create a building successfully
- [ ] Statistics dashboard shows data
- [ ] Can update bed status
- [ ] Badge colors change correctly

## 🎯 Next Steps

Once basic testing works:
1. Test all 7 bed statuses
2. Test real-time updates across portals
3. Create complete infrastructure (building → floor → ward → room → bed)
4. Test with multiple users simultaneously

## 📞 Still Having Issues?

Check these in order:
1. Browser console errors
2. Network tab for API errors
3. Supabase logs
4. Database RLS policies
5. User's hospital_id in database

---

**Last Updated:** After fixing duplicate function error
**Status:** ✅ Ready to test
