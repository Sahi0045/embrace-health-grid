# Bed & Room Management - Testing Checklist

## Prerequisites

### 1. Apply Database Migration
You need to apply the migration manually in your Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file: `supabase/migrations/20260807000000_hospital_infrastructure_hierarchy.sql`
4. Copy the entire SQL content
5. Paste it in the SQL Editor
6. Click **Run**
7. ✅ Verify no errors appear

### 2. Verify Tables Created
Run this query in Supabase SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('buildings', 'floors', 'wards', 'rooms', 'beds');
```
✅ Should return 5 rows (all 5 tables)

### 3. Check Realtime is Enabled
```sql
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```
✅ Should show: buildings, floors, wards, rooms, beds

---

## Testing Scenarios

### Test 1: Access Admin Portal
**Goal:** Verify admin can access the Bed & Room Management page

1. ✅ Start the main app: `npm run dev`
2. ✅ Open browser: http://localhost:8080/login
3. ✅ Login as **admin** user (your admin credentials)
4. ✅ Navigate to: http://localhost:8080/admin
5. ✅ Verify you see "Bed & Room Management" card with blue bed icon
6. ✅ Click on the card
7. ✅ Should navigate to: http://localhost:8080/admin/beds-rooms

**Expected Result:**
- Page loads without errors
- Shows statistics cards: Total Beds, Occupancy Rate, Under Maintenance, Reserved
- Shows 3 tabs: Hierarchy View, All Beds, All Rooms

---

### Test 2: View Statistics Dashboard
**Goal:** Verify bed/room statistics are loading

1. ✅ On the beds-rooms page, check the statistics cards at the top
2. ✅ Should show:
   - **Total Beds**: Number (e.g., 24)
   - **Occupancy Rate**: Percentage (e.g., 45%)
   - **Under Maintenance**: Number
   - **Reserved**: Number

**Expected Result:**
- Numbers should reflect actual data from database
- If no data, all should show 0

---

### Test 3: View Hierarchy (if seed data exists)
**Goal:** Verify hierarchical drill-down works

1. ✅ Click on **"Hierarchy View"** tab
2. ✅ Should see list of buildings (if seed data was applied)
3. ✅ Click the **chevron (>)** next to a building name
4. ✅ Should expand to show floors
5. ✅ Click chevron next to a floor
6. ✅ Should show wards
7. ✅ Click chevron next to a ward
8. ✅ Should show rooms
9. ✅ Click chevron next to a room
10. ✅ Should show beds

**Expected Result:**
- Smooth drill-down navigation
- Each level shows correct child items
- Chevron changes to down arrow (v) when expanded

---

### Test 4: Create a New Building
**Goal:** Test create functionality

1. ✅ Click **"Add Building"** button (top right)
2. ✅ Dialog should open: "Add New Building"
3. ✅ Fill in form:
   - Building Name: `Test Building`
   - Building Code: `TB`
   - Description: `Testing infrastructure`
   - Total Floors: `3`
4. ✅ Click **"Create"** button
5. ✅ Should show success toast: "Building created successfully"
6. ✅ Dialog should close
7. ✅ New building should appear in the hierarchy

**Expected Result:**
- Building creates without errors
- Appears in the list immediately
- Can expand it (though it has no floors yet)

---

### Test 5: Update Bed Status (All Beds Tab)
**Goal:** Test the main update functionality

#### Part A: Find a Bed
1. ✅ Click on **"All Beds"** tab
2. ✅ Should see list of all beds (if any exist)
3. ✅ Each bed shows:
   - Bed number (e.g., "B101-A")
   - Bed type (e.g., "Standard")
   - Status badge with color (e.g., "Available" in green)
   - **"Update Status"** button

#### Part B: Update Status
1. ✅ Click **"Update Status"** button on any bed
2. ✅ Dialog opens: "Update Bed Status"
3. ✅ Shows current bed number/ID
4. ✅ Dropdown shows current status selected
5. ✅ Click the dropdown
6. ✅ Should see all 7 statuses:
   - ✅ Available (green)
   - 👥 Occupied (blue)
   - 🕐 Reserved (yellow)
   - 🧹 Cleaning (light blue)
   - 🔧 Maintenance (orange)
   - 🚫 Blocked (red)
   - 🚨 Emergency (dark red)
7. ✅ Select **"Occupied"**
8. ✅ Click **"Update Status"** button in dialog
9. ✅ Should show toast: "Bed status updated"
10. ✅ Dialog closes
11. ✅ Bed status badge should now show "Occupied" in blue

**Expected Result:**
- Status updates without error
- Badge color changes immediately
- Statistics cards at top update (Available decreases, Occupied increases)

---

### Test 6: Update Room Status (All Rooms Tab)
**Goal:** Test room status updates

1. ✅ Click on **"All Rooms"** tab
2. ✅ Should see list of all rooms
3. ✅ Click **"Update Status"** on any room
4. ✅ Dialog opens: "Update Room Status"
5. ✅ Change status from dropdown
6. ✅ Click "Update Status"
7. ✅ Should show success toast
8. ✅ Room status badge updates

**Expected Result:**
- Same behavior as bed status update
- Room statistics update

---

### Test 7: Real-time Updates - Staff Portal
**Goal:** Verify real-time propagation to Staff Portal

#### Setup: Open Two Browser Windows
1. ✅ **Window 1:** Admin Portal at http://localhost:8080/admin/beds-rooms
2. ✅ **Window 2:** Staff Portal at http://localhost:8080/staff/rooms
   - Login as staff/doctor if needed

#### Test Real-time:
1. ✅ In **Window 2 (Staff Portal)**, scroll down to "Bed & Room Availability" section
2. ✅ Click **"Show Details"** to expand bed list
3. ✅ Note current bed statuses
4. ✅ In **Window 1 (Admin Portal)**, update a bed status (e.g., Available → Cleaning)
5. ✅ **Watch Window 2** - within 1-2 seconds:
   - Bed status badge should update automatically
   - Statistics cards should update (Available count changes)
   - **No page refresh needed!**

**Expected Result:**
- Staff Portal updates automatically
- Changes appear within 1-2 seconds
- No errors in console

---

### Test 8: Real-time Updates - Patient Portal
**Goal:** Verify real-time propagation to Patient Portal

#### Setup:
1. ✅ **Window 1:** Keep Admin Portal open
2. ✅ **Window 3:** Patient Portal at http://localhost:8080/patient/inpatient
   - Login as patient if needed

#### Test Real-time:
1. ✅ In **Window 3 (Patient Portal)**, look for "Hospital Bed Availability" card at top
2. ✅ Note current statistics (Available, Occupied, etc.)
3. ✅ In **Window 1 (Admin Portal)**, update a bed status
4. ✅ **Watch Window 3** - within 1-2 seconds:
   - Statistics cards should update
   - Progress bar should adjust
   - Percentages recalculate

**Expected Result:**
- Patient Portal shows updated aggregate statistics
- No individual bed details shown (privacy)
- Updates happen automatically

---

### Test 9: Multi-Status Testing
**Goal:** Verify all 7 statuses work correctly

**Test each status transition:**

1. ✅ Available → Occupied → **Check color is blue**
2. ✅ Occupied → Reserved → **Check color is yellow**
3. ✅ Reserved → Cleaning → **Check color is light blue**
4. ✅ Cleaning → Maintenance → **Check color is orange**
5. ✅ Maintenance → Blocked → **Check color is red**
6. ✅ Blocked → Emergency Reserved → **Check color is dark red**
7. ✅ Emergency Reserved → Available → **Check color is green**

**Expected Result:**
- Each status change works
- Correct color displayed
- Statistics update accordingly

---

### Test 10: Create Complete Hierarchy
**Goal:** Test full workflow from building to bed

1. ✅ Create a **Building**:
   - Name: `Test Wing`
   - Code: `TW`

2. ✅ Create a **Floor** (click "Add Floor" next to building):
   - Floor Number: `1`
   - Name: `Ground Floor`

3. ✅ Create a **Ward** (click "Add Ward" next to floor):
   - Name: `Test Ward`
   - Type: `General`

4. ✅ Create a **Room** (click "Add Room" next to ward):
   - Name: `Room 101`
   - Type: `Single`
   - Capacity: `1`

5. ✅ Create a **Bed** (click "Add Bed" next to room):
   - Bed Number: `B-101-A`
   - Type: `Standard`

6. ✅ Navigate through hierarchy to verify all created

**Expected Result:**
- Each creation succeeds
- Hierarchy is navigable
- New bed appears in "All Beds" tab

---

## Common Issues & Fixes

### Issue 1: "React is not defined" error
**Fix:** Already fixed - React import added

### Issue 2: Database tables don't exist
**Fix:** Apply migration in Supabase SQL Editor

### Issue 3: RLS policy errors
**Fix:** Verify user has correct `hospital_id` in users table:
```sql
SELECT id, email, hospital_id, role FROM users WHERE email = 'your-admin-email';
```

### Issue 4: Real-time not working
**Fix:** 
1. Check Supabase project has Realtime enabled
2. Verify tables in pg_publication_tables
3. Check browser console for WebSocket errors

### Issue 5: Statistics showing 0
**Fix:** 
- Run seed data section from migration
- Or create test data manually

### Issue 6: "Failed to load data" error
**Fix:**
- Check Supabase connection in `.env`
- Verify RLS policies allow admin access
- Check browser console for specific error

---

## Success Criteria

✅ **Admin Portal:**
- Can view statistics dashboard
- Can navigate hierarchy (drill-down)
- Can create buildings, floors, wards, rooms, beds
- Can update bed/room statuses
- All 7 statuses work
- UI is responsive

✅ **Staff Portal:**
- Shows bed status overview
- Displays statistics cards
- Shows individual bed list
- Real-time updates work (1-2 sec latency)

✅ **Patient Portal:**
- Shows hospital-wide statistics
- No individual bed details (privacy)
- Real-time updates work
- Progress bar updates

✅ **Real-time Sync:**
- Admin changes propagate to Staff Portal
- Admin changes propagate to Patient Portal
- No page refresh needed
- <2 second latency
- Multiple users can see updates

---

## Next Steps After Testing

**If all tests pass:**
1. ✅ Mark feature as complete
2. ✅ Document any configuration needed for production
3. ✅ Create PR with changes
4. ✅ Update user documentation

**If issues found:**
1. ❌ Document specific failures
2. ❌ Check browser console for errors
3. ❌ Verify database migration applied
4. ❌ Check Supabase project settings
5. ❌ Report issues for fixes

---

## Quick Test Commands

**Check if migration is applied:**
```sql
SELECT COUNT(*) FROM buildings;
-- Should return a number (0 or more)
```

**View seed data:**
```sql
SELECT building_name FROM buildings;
-- Should show "Main Hospital Building", "Emergency Wing" if seed data applied
```

**Check bed statuses:**
```sql
SELECT status, COUNT(*) 
FROM beds 
GROUP BY status;
-- Shows distribution of bed statuses
```

**Verify RLS policies:**
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('buildings', 'floors', 'wards', 'rooms', 'beds');
-- Should show multiple policies for each table
```

---

**Testing Time Estimate:** 30-45 minutes for complete end-to-end testing

**Priority Tests:**
1. Test 5 (Update Bed Status) - **Most Important**
2. Test 7 (Real-time Staff Portal) - **Most Important**
3. Test 2 (Statistics Dashboard) - Important
4. Test 10 (Create Hierarchy) - Important
