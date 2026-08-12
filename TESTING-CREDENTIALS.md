# Testing Credentials - Bed & Room Management

## 🔐 Test User Accounts

### Admin Account (Full Access)
**For testing Admin Portal and Bed/Room Management:**
- **Email:** `admin@apollohospitals.com`
- **Password:** `admin123` (or your configured password)
- **Role:** `admin`
- **Hospital:** `apollo-consortium-general`
- **Access:**
  - Full CRUD on buildings, floors, wards, rooms, beds
  - Update bed/room statuses
  - View all statistics
  - Manage infrastructure hierarchy

**Test URL:** http://localhost:8080/admin/beds-rooms

---

### Staff/Doctor Account (Read + View Access)
**For testing Staff Portal real-time updates:**
- **Email:** `doctor@apollohospitals.com` or `staff@apollohospitals.com`
- **Password:** `doctor123` or `staff123`
- **Role:** `doctor` or `staff`
- **Hospital:** `apollo-consortium-general`
- **Access:**
  - View bed status and statistics
  - Room check-in/check-out
  - See real-time bed availability updates

**Test URL:** http://localhost:8080/staff/rooms

---

### Patient Account (Limited Read Access)
**For testing Patient Portal real-time updates:**
- **Email:** `patient@example.com` or `test@example.com`
- **Password:** `patient123` or `test123`
- **Role:** `patient`
- **Hospital:** `apollo-consortium-general`
- **Access:**
  - View aggregate bed availability statistics only
  - See occupancy rates
  - No individual bed details (privacy)

**Test URL:** http://localhost:8080/patient/inpatient

---

## 🏥 Seed Hospital Data

The migration creates sample data for testing:

**Hospital:** `apollo-consortium-general`
- **Slug:** `apollo-consortium-general`
- **Name:** Apollo Consortium General Hospital

**Buildings Created:**
1. **Main Block (MB)**
   - 5 floors
   - Emergency and outpatient services

2. **Specialty Block (SB)**
   - 3 floors
   - Specialized departments and ICU

**Floors Created:**
- **Ground Floor** (Main Block) - Emergency and OPD
- **First Floor** (Main Block) - General Ward
- **Ground Floor** (Specialty Block) - ICU and Critical Care

**Wards Created:**
1. **Emergency Ward (ER-01)** - Emergency - 20 beds capacity
2. **General Ward A (GW-A)** - General - 30 beds capacity
3. **General Ward B (GW-B)** - General - 25 beds capacity

---

## 🎯 Quick Test Scenarios

### Scenario 1: Admin Creates Building
**Login as:** `admin@apollohospitals.com`

1. Go to: http://localhost:8080/admin/beds-rooms
2. Click "Add Building"
3. Fill in:
   - **Building Name:** `main block`
   - **Building Code:** `MD`
   - **Description:** `emergency ward`
   - **Total Floors:** `1`
4. Click "Create"
5. ✅ Should succeed and show in hierarchy

---

### Scenario 2: Admin Updates Bed Status
**Login as:** `admin@apollohospitals.com`

1. Go to: http://localhost:8080/admin/beds-rooms
2. Click "All Beds" tab
3. Find any bed (or create one if none exist)
4. Click "Update Status"
5. Change status:
   - From: `Available` (green)
   - To: `Occupied` (blue)
6. Click "Update Status"
7. ✅ Badge should change color immediately
8. ✅ Statistics should update (Available ↓, Occupied ↑)

---

### Scenario 3: Staff Views Real-time Updates
**Setup:** Two browser windows

**Window 1 (Admin):**
- Login: `admin@apollohospitals.com`
- URL: http://localhost:8080/admin/beds-rooms

**Window 2 (Staff):**
- Login: `doctor@apollohospitals.com`
- URL: http://localhost:8080/staff/rooms
- Scroll to "Bed & Room Availability"
- Click "Show Details"

**Test:**
1. In Window 1, update a bed status (Available → Cleaning)
2. Watch Window 2
3. ✅ Should update within 1-2 seconds automatically
4. ✅ No page refresh needed

---

### Scenario 4: Patient Views Aggregate Statistics
**Login as:** `patient@example.com`

1. Go to: http://localhost:8080/patient/inpatient
2. Look for "Hospital Bed Availability" card
3. Should see:
   - Available beds count
   - Occupied beds (with % capacity)
   - Cleaning/Maintenance count
   - Reserved beds
4. ✅ Only aggregate numbers (no individual bed details)
5. ✅ Updates automatically when admin changes status

---

## 🔧 Create Test Users (If Not Exist)

If the users don't exist in your database, run this SQL in Supabase:

```sql
-- 1. Insert test users into users table
INSERT INTO public.users (id, email, name, role, hospital_id, created_at, updated_at)
VALUES 
  (
    gen_random_uuid(), 
    'admin@apollohospitals.com', 
    'Admin User', 
    'admin', 
    (SELECT hospital_id FROM hospitals WHERE slug = 'apollo-consortium-general'),
    now(),
    now()
  ),
  (
    gen_random_uuid(), 
    'doctor@apollohospitals.com', 
    'Dr. John Doe', 
    'doctor', 
    (SELECT hospital_id FROM hospitals WHERE slug = 'apollo-consortium-general'),
    now(),
    now()
  ),
  (
    gen_random_uuid(), 
    'staff@apollohospitals.com', 
    'Staff Member', 
    'staff', 
    (SELECT hospital_id FROM hospitals WHERE slug = 'apollo-consortium-general'),
    now(),
    now()
  ),
  (
    gen_random_uuid(), 
    'patient@example.com', 
    'Test Patient', 
    'patient', 
    (SELECT hospital_id FROM hospitals WHERE slug = 'apollo-consortium-general'),
    now(),
    now()
  )
ON CONFLICT (email) DO NOTHING;

-- 2. Create auth users (if using Supabase Auth)
-- Note: You may need to do this through Supabase Auth UI or use Supabase Admin API
-- The passwords need to be set through Supabase's authentication system
```

---

## 🚨 Important Notes

### Hospital ID Requirement
All test users MUST have the same `hospital_id` as the seed data:
- Hospital slug: `apollo-consortium-general`
- Users can only see/manage data from their own hospital (RLS enforced)

### Role Requirements
- **Admin:** Full CRUD access to infrastructure
- **Doctor/Staff:** Read access + room check-in
- **Patient:** Read-only aggregate statistics

### RLS Policies
Row Level Security (RLS) is enforced at database level:
- Users can only access data from their `hospital_id`
- Admin role required for create/update/delete operations
- Staff/Doctor role required for read operations

---

## 🐛 Troubleshooting

### Issue: "Failed to create" error
**Solution:** Check user has admin role and correct hospital_id
```sql
SELECT id, email, role, hospital_id 
FROM users 
WHERE email = 'admin@apollohospitals.com';
```

### Issue: "No buildings configured yet"
**Solution:** Migration seed data didn't run. Manually run the seed data section:
- Open migration file: `supabase/migrations/20260807000000_hospital_infrastructure_hierarchy.sql`
- Copy the "Seed Data for Development" section (bottom part)
- Run in Supabase SQL Editor

### Issue: User can't login
**Solution:** Create auth user in Supabase dashboard:
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Enter email and password
4. Confirm email
5. User should now be in both `auth.users` and `public.users`

### Issue: Real-time not working
**Solution:** Check Realtime is enabled:
```sql
-- Verify tables are in realtime publication
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```
Should show: buildings, floors, wards, rooms, beds

---

## ✅ Testing Checklist

### Database Setup
- [ ] Migration applied successfully
- [ ] Seed data created (buildings, floors, wards)
- [ ] Test users exist in `users` table
- [ ] Auth users created in Supabase
- [ ] Users have correct `hospital_id`
- [ ] Realtime enabled for all tables

### Admin Portal Tests
- [ ] Admin can login and access /admin/beds-rooms
- [ ] Statistics dashboard shows correct counts
- [ ] Can view hierarchy (drill-down)
- [ ] Can create building
- [ ] Can update bed status
- [ ] Can update room status
- [ ] All 7 statuses work (color-coded badges)

### Staff Portal Tests
- [ ] Staff/Doctor can login
- [ ] Can access /staff/rooms
- [ ] Bed status section loads
- [ ] Statistics cards show correct data
- [ ] Real-time updates work (<2 sec)

### Patient Portal Tests
- [ ] Patient can login
- [ ] Can access /patient/inpatient
- [ ] Bed availability card shows
- [ ] Only aggregate statistics (no bed details)
- [ ] Real-time updates work

### Real-time Sync Tests
- [ ] Admin update → Staff portal updates
- [ ] Admin update → Patient portal updates
- [ ] No page refresh needed
- [ ] Updates within 1-2 seconds
- [ ] Multiple users see same updates

---

## 📞 Support

If you encounter issues:

1. Check browser console for errors
2. Verify database connection in `.env`
3. Check Supabase logs
4. Verify RLS policies with test SQL queries
5. Ensure Realtime is enabled in Supabase project settings

---

**Happy Testing! 🎉**
