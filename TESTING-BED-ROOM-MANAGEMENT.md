# Bed & Room Management - End-to-End Testing Guide

## Overview
This guide walks through testing the complete Bed & Room Management system with real-time updates across Admin Portal, Staff Portal, and Patient Portal.

## Prerequisites

### 1. Apply Database Migration
```bash
cd embrace-health-grid
# Apply the migration to your Supabase database
supabase db push
# OR manually apply the migration file:
# supabase/migrations/20260807000000_hospital_infrastructure_hierarchy.sql
```

### 2. Start Development Servers
```bash
# Terminal 1: Main application (localhost:3000)
npm run dev

# Terminal 2: Admin Portal (localhost:3002)
cd admin-portal
npm run dev
```

## Test Scenarios

### Scenario 1: Admin Creates Hospital Infrastructure

**Portal:** Admin Portal (http://localhost:3002)

1. **Login as Admin**
   - Use admin credentials for a hospital (e.g., apollo-consortium-general)

2. **Navigate to Beds & Rooms**
   - Click "Beds & Rooms" in the sidebar

3. **Verify Sample Data Loaded**
   - Check the "Statistics" section shows:
     - Available beds count
     - Occupied beds count
     - Cleaning/Maintenance beds
     - Reserved beds
   - Verify the hierarchy view shows:
     - Buildings (e.g., "Main Hospital Building", "Emergency Wing")
     - Floors under each building
     - Wards under each floor
     - Rooms and beds under each ward

4. **Create New Infrastructure (Optional)**
   - Click "Create Building" to add a new building
   - Click "Create Floor" to add a floor to a building
   - Click "Create Ward" to add a ward to a floor
   - Click "Create Room" to add a room to a ward
   - Click "Create Bed" to add a bed to a room

### Scenario 2: Admin Updates Bed Status → Real-time Propagation

**Portal:** Admin Portal

1. **Go to "All Beds" Tab**
   - Click the "All Beds" tab
   - See list of all beds with current statuses

2. **Update a Bed Status**
   - Find a bed with status "available"
   - Note the bed number (e.g., "B101-A")
   - Click "Update Status" button
   - Change status from "available" to "occupied"
   - Click "Update"
   - **Expected:** Status updates immediately in the UI
   - **Expected:** Statistics dashboard updates (available count decreases, occupied count increases)

3. **Keep Admin Portal Open**
   - Keep this window visible while testing other portals

### Scenario 3: Staff Portal Real-time Update

**Portal:** Staff Portal (http://localhost:3000/staff/rooms)

1. **Login as Staff/Doctor**
   - Use staff or doctor credentials for the same hospital

2. **Navigate to Room Check-In Page**
   - Go to http://localhost:3000/staff/rooms
   - Scroll down to "Bed & Room Availability" section

3. **Verify Real-time Update**
   - Click "Show Details" to expand the bed list
   - **Expected:** The bed status you just changed in Admin Portal should reflect here
   - **Expected:** Statistics cards should show updated counts:
     - Available beds decreased by 1
     - Occupied beds increased by 1

4. **Test Live Updates**
   - Keep this page open
   - Return to Admin Portal
   - Update another bed status from "available" to "cleaning"
   - **Expected:** Within 1-2 seconds, the Staff Portal should auto-update:
     - Bed status badge changes color
     - Statistics cards update
     - No page refresh needed

### Scenario 4: Patient Portal Real-time Update

**Portal:** Patient Portal (http://localhost:3000/patient/inpatient)

1. **Login as Patient**
   - Use patient credentials for the same hospital

2. **Navigate to Inpatient Care Page**
   - Go to http://localhost:3000/patient/inpatient

3. **View Hospital Bed Availability**
   - See the "Hospital Bed Availability" card at the top
   - **Expected:** Shows 4 statistics cards:
     - Available beds
     - Occupied beds (with % capacity)
     - Cleaning/Maintenance beds
     - Reserved beds (including emergency)
   - **Expected:** Shows progress bar indicating bed availability

4. **Verify Real-time Synchronization**
   - Keep Patient Portal open
   - Return to Admin Portal
   - Update a bed status from "occupied" back to "available"
   - **Expected:** Patient Portal updates automatically within 1-2 seconds
   - **Expected:** Statistics and progress bar reflect the change
   - **Note:** Patient portal does NOT show individual bed details (privacy) - only aggregate statistics

### Scenario 5: Multi-Status Testing

**Test different status transitions to ensure all 7 statuses work:**

1. **In Admin Portal, test each status:**
   - `available` → `occupied` → `cleaning` → `available`
   - `available` → `reserved` → `available`
   - `available` → `maintenance` → `available`
   - `available` → `blocked` → `available`
   - `available` → `emergency_reserved` → `occupied` → `available`

2. **Verify in Staff & Patient Portals:**
   - Each status change propagates correctly
   - Badge colors update appropriately:
     - ✅ Available: green
     - 👥 Occupied: blue/primary
     - 🕐 Reserved: yellow/warning
     - 🧹 Cleaning: blue
     - 🔧 Maintenance: orange
     - 🚫 Blocked: red
     - 🚨 Emergency Reserved: red

### Scenario 6: Room Status Testing

**Test room-level status updates:**

1. **In Admin Portal → "All Rooms" Tab**
   - Find a room with status "available"
   - Update room status to "occupied"
   - **Expected:** Room status updates immediately

2. **Verify in Staff Portal**
   - Room statistics should update
   - Room count by status should reflect change

3. **Verify in Patient Portal**
   - Room statistics should update
   - "X rooms free" count should decrease

## Expected Real-time Behavior

### Supabase Realtime Subscriptions

The system uses Supabase Realtime to push updates automatically:

1. **Admin updates bed status**
   ↓
2. **Database triggers UPDATE on `beds` table**
   ↓
3. **Supabase Realtime broadcasts change**
   ↓
4. **All subscribed clients receive update**
   - Admin Portal: `useTableRefresh("beds")` in admin-api.ts
   - Staff Portal: `useTableRefresh("beds", loadBedStatus)` in staff.rooms.tsx
   - Patient Portal: `useTableRefresh("beds", loadBedStats)` in patient.inpatient.tsx
   ↓
5. **UI updates automatically** (no refresh needed)

### Debugging Real-time Issues

If real-time updates aren't working:

1. **Check Supabase Realtime is enabled:**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   -- Should show: beds, rooms, buildings, floors, wards
   ```

2. **Check browser console for Realtime errors:**
   - Open DevTools → Console
   - Look for WebSocket connection errors
   - Look for Supabase Realtime subscription messages

3. **Verify RLS policies allow reads:**
   ```sql
   -- Test as staff user
   SELECT * FROM beds WHERE hospital_id = 'apollo-consortium-general';
   -- Should return results
   ```

4. **Check network tab:**
   - Filter for "realtime" or "wss://"
   - Verify WebSocket connection is established
   - Look for messages with event type "UPDATE"

## Success Criteria

✅ **Admin Portal:**
- Can create/update buildings, floors, wards, rooms, beds
- Statistics dashboard updates immediately after changes
- Hierarchical drill-down navigation works
- All 7 bed/room statuses can be set

✅ **Staff Portal:**
- Displays bed status overview with statistics
- Shows individual bed list with status badges
- Real-time updates propagate within 1-2 seconds
- Statistics cards update automatically

✅ **Patient Portal:**
- Shows hospital-wide bed availability statistics
- Displays aggregate counts (no individual bed details)
- Real-time updates reflect within 1-2 seconds
- Progress bar updates automatically

✅ **Real-time Sync:**
- Changes in Admin Portal appear in Staff Portal immediately
- Changes in Admin Portal appear in Patient Portal immediately
- No manual refresh needed
- Multiple users can see updates simultaneously

## Common Issues & Fixes

### Issue: Real-time not working
**Fix:** Ensure Supabase project has Realtime enabled and migration applied

### Issue: RLS policy errors
**Fix:** Verify user has correct hospital_id and role in users table

### Issue: Statistics not updating
**Fix:** Check that `getBedRoomStatistics()` is being called in useEffect

### Issue: Admin can't see beds
**Fix:** Ensure admin has correct hospital_id matching the beds' hospital_id

## Database Seed Data

The migration includes sample data for "apollo-consortium-general" hospital:
- 2 Buildings: Main Hospital Building, Emergency Wing
- 3 Floors per building
- 3 Wards: General Ward, ICU, Emergency Ward
- Multiple rooms and beds with various statuses

To test with your own hospital:
1. Update the hospital_id in the seed data section of the migration
2. Or create new infrastructure using the Admin Portal

## Performance Expectations

- **Initial load:** < 500ms for bed/room statistics
- **Real-time update latency:** < 2 seconds
- **Admin Portal:** Should handle 1000+ beds without lag
- **Staff/Patient Portal:** Aggregate statistics should load instantly

## Next Steps After Testing

1. **If all tests pass:**
   - Mark task #8 as complete
   - Create PR with all changes
   - Document any configuration needed for production

2. **If issues found:**
   - Document specific failures
   - Check browser console for errors
   - Verify database migration was applied correctly
   - Check Supabase project settings

---

**Testing Checklist:**
- [ ] Database migration applied successfully
- [ ] Both dev servers running (main + admin portal)
- [ ] Admin can view/update bed statuses
- [ ] Staff portal shows real-time bed updates
- [ ] Patient portal shows real-time statistics
- [ ] All 7 bed statuses work correctly
- [ ] Room statuses work correctly
- [ ] No console errors
- [ ] Real-time sync works across all portals
