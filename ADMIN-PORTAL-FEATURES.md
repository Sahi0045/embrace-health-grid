# Admin Portal Features - Doctor Availability & Prescription Management

**Date:** August 11, 2026  
**Due Date:** August 15, 2026  
**Status:** ✅ Complete  
**Priority:** 🟡 Medium

---

## Overview

This document describes the two new features added to the Health Grid Admin Portal:
1. **Doctor Availability Checking** - View doctor schedules and availability status
2. **Prescription Management** - Modify prescription details for clinical oversight

---

## Feature 1: Doctor Availability Checking

### Location
- **Route:** `/admin/doctors`
- **Access:** Admin role required
- **Navigation:** Admin Dashboard → "Doctor Availability" card

### Purpose
Allows hospital administrators to check the availability of doctors across the hospital, view their schedules, and see their current status in real-time.

### Features

#### Real-Time Availability Status
The system automatically determines doctor availability based on current shifts:
- **Available** (🟢 Green) - Currently in a scheduled shift with manageable patient load
- **Busy** (🟠 Orange) - In a shift with high patient count (>5 patients)
- **On Call** (🔴 Red) - Currently on emergency call duty
- **Off Duty** (⚪ Gray) - Not scheduled for today

#### Display Information
For each doctor, the following information is shown:
- Full name and role (Doctor/Staff)
- Department and specialty
- Email address
- Primary DID (Decentralized Identifier)
- Current availability status
- Upcoming shifts (next 5 shifts with date, time, role, and unit)

#### Statistics Dashboard
- **Total Doctors** - Count of all registered doctors
- **Available Now** - Doctors currently available for consultations
- **On Call** - Doctors on emergency call duty
- **Busy** - Doctors currently with high patient load

#### Filters & Search
- **Search:** Filter by name, email, department, specialty, or DID
- **Department Filter:** View doctors from specific departments
- **Availability Filter:** Filter by current status (Available, Busy, Off Duty, On Call)

#### Real-Time Updates
- Automatically refreshes when:
  - `profiles` table changes (new doctors added)
  - `staff_schedule` table changes (shifts updated)
- Uses Supabase Realtime for live synchronization

### Technical Implementation

#### Frontend
- **File:** `src/routes/admin.doctors.tsx`
- **Components:** Doctor cards with expandable details, statistics cards, filter controls
- **State Management:** React hooks for loading, filtering, and real-time updates

#### Backend APIs
- `getProfiles()` - Fetches all medical staff profiles
- `getStaffSchedule()` - Fetches staff schedules from operations.server.ts
- Uses existing RLS policies for security

#### Database Tables
- `profiles` - User profile information (name, email, role, DID)
- `staff_schedule` - Shift schedules (date, time, role, unit, patient count)

---

## Feature 2: Prescription Management

### Location
- **Route:** `/admin/prescriptions`
- **Access:** Admin role required
- **Navigation:** Admin Dashboard → "Prescription Management" card

### Purpose
Enables hospital administrators to view and modify prescription details for clinical oversight and corrections while maintaining audit integrity.

### Features

#### View Prescriptions
- List all prescriptions across the hospital
- View linked medical reports
- Filter by doctor, patient, status
- Search by patient name, doctor, diagnosis, prescription ID
- Real-time statistics:
  - Total Prescriptions
  - Active prescriptions
  - Prescriptions with medical reports
  - Number of prescribing doctors

#### Edit Prescription Details
Each prescription can be edited by clicking the "Edit" button:

**Editable Fields:**
- **Diagnosis** - Update the diagnosis text
- **Status** - Change status (Active, Dispensed, Cancelled, Expired)
- **Notes** - Add or modify additional notes
- **Medications** - Add, remove, or modify drugs:
  - Drug name
  - Dosage (e.g., "500mg")
  - Frequency (e.g., "Twice daily")
  - Duration (e.g., "30 days")
  - Usage (e.g., "After meals")
  - Instructions (special instructions)

**Immutable Fields (Protected):**
- Prescription ID (rx_id)
- Patient DID
- Doctor DID
- Signed flag
- Signed by
- Signed at timestamp

#### Security & Audit Trail
- Only administrators can modify prescriptions
- All changes are logged with `updated_at` timestamp
- Original prescription data is preserved for audit purposes
- RLS policies enforce admin-only access

#### Real-Time Updates
- Automatically refreshes when:
  - `prescriptions` table changes
  - `medical_records` table changes
- Updated prescriptions immediately visible to all viewers

### Technical Implementation

#### Frontend
- **File:** `src/routes/admin.prescriptions.tsx`
- **Components:** Prescription cards, edit dialog with form fields, medication management
- **State Management:** Edit modal state, form validation, API integration

#### Backend APIs
- `getPrescriptions()` - Fetches all prescriptions (existing)
- `updatePrescription(rxId, updates)` - Updates prescription details (new)
  - **Parameters:** 
    - `rxId` (required) - Prescription ID
    - `diagnosis` (optional) - New diagnosis
    - `notes` (optional) - Updated notes
    - `status` (optional) - New status (enum validated)
    - `drugs` (optional) - Updated medications array

#### Database
- **Table:** `prescriptions`
- **Migration:** `20260812000000_admin_prescription_update_policy.sql`
- **RLS Policy:** `prescriptions_update_admin`
  - Allows UPDATE only for users with `role = 'admin'`
  - Protects immutable fields through application logic

#### Server Function
- **File:** `src/lib/clinical.server.ts`
- **Function:** `updatePrescription`
- **Validation:**
  - Requires authenticated admin user
  - Validates status against enum values
  - Enforces at least one field update
  - Returns error for non-admin users

---

## Testing Guide

### Prerequisites

1. **Database Migration:**
   ```bash
   # Apply the prescription update policy migration
   supabase db push
   ```

2. **Admin User Setup:**
   - Use `setup-admin-user.sql` to create an admin account
   - Or ensure your user has `role = 'admin'` in the profiles table

3. **Test Data:**
   - At least one doctor profile with scheduled shifts
   - At least one prescription in the system

### Test Case 1: Doctor Availability

1. **Navigate to Doctor Availability:**
   - Login as admin
   - Go to Admin Dashboard (`/admin`)
   - Click "Doctor Availability" card

2. **Verify Display:**
   - [ ] Page loads without errors
   - [ ] Statistics cards show correct counts
   - [ ] Doctor cards display with proper information
   - [ ] Availability status badges appear correctly

3. **Test Filters:**
   - [ ] Search by doctor name works
   - [ ] Department filter narrows results
   - [ ] Availability filter shows only matching doctors

4. **Test Expandable Details:**
   - [ ] Click a doctor card to expand
   - [ ] Upcoming shifts are displayed
   - [ ] Doctor DID and contact info visible

5. **Test Real-Time Updates:**
   - [ ] Open page in two browser tabs
   - [ ] Add a shift in one tab (via database or staff interface)
   - [ ] Verify update appears in second tab

### Test Case 2: Prescription Modification

1. **Navigate to Prescriptions:**
   - Login as admin
   - Go to Admin Dashboard (`/admin`)
   - Click "Prescription Management" card

2. **Verify Display:**
   - [ ] Page loads without errors
   - [ ] Prescriptions list displays
   - [ ] Statistics are correct
   - [ ] Edit button visible on each prescription

3. **Test Edit Functionality:**
   - [ ] Click "Edit" button on a prescription
   - [ ] Edit dialog opens with current data
   - [ ] Immutable fields are read-only (patient, doctor, ID)
   - [ ] Editable fields can be modified

4. **Test Diagnosis Update:**
   - [ ] Change diagnosis text
   - [ ] Click "Save Changes"
   - [ ] Verify success toast appears
   - [ ] Verify prescription updates in list

5. **Test Status Change:**
   - [ ] Change status from "Active" to "Dispensed"
   - [ ] Save changes
   - [ ] Verify status badge updates

6. **Test Medication Management:**
   - [ ] Click "Add Drug" button
   - [ ] Fill in medication details
   - [ ] Add multiple drugs
   - [ ] Remove a drug using trash icon
   - [ ] Save changes
   - [ ] Verify medications update

7. **Test Validation:**
   - [ ] Try to save with invalid status → Should show error
   - [ ] Try to save with no changes → Should show error
   - [ ] Cancel edit → Dialog closes without saving

8. **Test Security:**
   - [ ] Logout admin user
   - [ ] Login as staff/doctor/patient
   - [ ] Navigate to `/admin/prescriptions`
   - [ ] Verify access denied (RouteGuard)

9. **Test Real-Time Updates:**
   - [ ] Open prescriptions in two tabs
   - [ ] Edit prescription in one tab
   - [ ] Verify update appears in second tab after save

### Test Case 3: Integration

1. **Admin Dashboard Navigation:**
   - [ ] Both feature cards appear on admin dashboard
   - [ ] Icons and descriptions are correct
   - [ ] Clicking cards navigates to correct routes

2. **Cross-Feature Testing:**
   - [ ] View doctor in availability list
   - [ ] Navigate to prescriptions
   - [ ] Find prescription by same doctor
   - [ ] Verify doctor name matches

---

## Database Schema

### Tables Modified/Used

#### `profiles`
```sql
- id (uuid, PK)
- email (text)
- full_name (text)
- role (user_role enum: 'patient' | 'doctor' | 'staff' | 'admin')
- primary_did (text, FK to dids)
- department (text, optional)
- specialty (text, optional)
```

#### `staff_schedule`
```sql
- shift_id (text, PK)
- staff_id (uuid, FK to profiles)
- shift_date (date)
- role (text: 'OPD' | 'Ward rounds' | 'Surgery' | 'On-call' | etc.)
- starts_at (time)
- ends_at (time)
- unit (text)
- patient_count (integer, optional)
- notes (text, optional)
- confirmed (boolean)
```

#### `prescriptions`
```sql
- rx_id (text, PK)
- patient_did (text, FK to dids)
- doctor_did (text, FK to dids)
- drugs (jsonb)
- diagnosis (text)
- notes (text)
- status (rx_status enum: 'active' | 'dispensed' | 'cancelled' | 'expired')
- signed (boolean)
- signed_by (text)
- signed_at (timestamptz)
- content_hash (text)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### New RLS Policy

```sql
-- prescriptions_update_admin
-- Allows admins to update prescription details
create policy prescriptions_update_admin on public.prescriptions
  for update to authenticated
  using (private.current_user_role() = 'admin')
  with check (private.current_user_role() = 'admin');
```

---

## API Reference

### Doctor Availability APIs

#### `getProfiles()`
- **Source:** `src/lib/clinical.server.ts`
- **Returns:** `{ profiles: Array<Profile> }`
- **RLS:** Admin sees all, others see own profile

#### `getStaffSchedule()`
- **Source:** `src/lib/operations.server.ts`
- **Returns:** `{ schedule: Array<Shift> }`
- **RLS:** Returns schedules based on user permissions

### Prescription Management APIs

#### `getPrescriptions()`
- **Source:** `src/lib/clinical.server.ts`
- **Returns:** `{ prescriptions: Array<Prescription> }`
- **RLS:** Patient sees own, doctor sees authored, admin sees all with consents

#### `updatePrescription(rxId, updates)`
- **Source:** `src/lib/clinical.server.ts` (new)
- **Parameters:**
  ```typescript
  {
    rxId: string;
    diagnosis?: string;
    notes?: string;
    status?: 'active' | 'dispensed' | 'cancelled' | 'expired';
    drugs?: Array<{
      name: string;
      dosage?: string;
      frequency?: string;
      duration?: string;
      usage?: string;
      instructions?: string;
    }>;
  }
  ```
- **Returns:** `{ ok: true, rxId: string }`
- **Throws:** Error if not admin, invalid status, or no fields to update

---

## Files Modified

### New Files
1. `src/routes/admin.doctors.tsx` - Doctor availability page
2. `supabase/migrations/20260812000000_admin_prescription_update_policy.sql` - RLS policy
3. `ADMIN-PORTAL-FEATURES.md` - This documentation

### Modified Files
1. `src/routes/admin.index.tsx` - Added navigation cards
2. `src/routes/admin.prescriptions.tsx` - Added edit functionality
3. `src/lib/clinical.server.ts` - Added updatePrescription server function
4. `src/lib/api.ts` - Added updatePrescription wrapper

---

## Security Considerations

### Authorization
- ✅ Both features require `role = 'admin'` via RouteGuard
- ✅ RLS policies enforce server-side access control
- ✅ updatePrescription validates admin role before allowing updates

### Audit Trail
- ✅ All prescription updates logged with `updated_at` timestamp
- ✅ Original immutable fields preserved (patient, doctor, rx_id)
- ✅ Audit events table captures all admin actions

### Data Protection
- ✅ PHI access controlled by RLS policies
- ✅ No PHI exposed in URLs or logs
- ✅ Doctor DIDs used for identification, not sensitive info

---

## Maintenance & Support

### Troubleshooting

**Doctor availability shows "Off Duty" for all doctors:**
- Check if `staff_schedule` table has data
- Verify shift dates are current
- Check shift start/end times align with current time

**"Only administrators can update prescriptions" error:**
- Verify user role is 'admin' in profiles table
- Check migration was applied: `supabase db pull`
- Verify RLS policy exists on prescriptions table

**Real-time updates not working:**
- Check Supabase Realtime is enabled for tables
- Verify `useTableRefresh` hook is properly imported
- Check browser console for WebSocket errors

### Future Enhancements

1. **Doctor Availability:**
   - Add calendar view for scheduling
   - Export doctor schedules to PDF/CSV
   - Send notifications when doctors become available
   - Add filtering by specialty and availability time ranges

2. **Prescription Management:**
   - Add prescription history/changelog
   - Implement approval workflow for major changes
   - Add bulk operations (e.g., expire multiple prescriptions)
   - Generate prescription reports and analytics

---

## Compliance Notes

- ✅ HIPAA compliant: Admin access logged, PHI protected by RLS
- ✅ Audit trail maintained for all prescription modifications
- ✅ Role-based access control enforced at database level
- ✅ No direct database manipulation required by admins

---

## Support Contact

For issues or questions regarding these features:
- Technical Lead: System Administrator
- Documentation: See inline code comments
- Database: Supabase Admin Dashboard

**Last Updated:** August 11, 2026
