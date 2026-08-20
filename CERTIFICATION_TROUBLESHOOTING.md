# Certification System Troubleshooting

## Issue: Cannot Select Doctors in Certification Management

### Problem
When trying to add a certification in `/admin/certifications-mgmt`, the dropdown shows "No Staff or Doctor DIDs Found" even though you have onboarded doctors.

### Root Cause
The DIDs were created with the wrong `owner_type`. The certification system filters for DIDs with `owner_type` of **'doctor'** or **'staff'**, but the DIDs might have been created with `owner_type` of 'patient' or another value.

### Solution 1: Onboard Doctors with Correct Role (Recommended)

When onboarding new doctors in `/admin/onboard`:

1. **Select the correct role:**
   - For doctors → Select **"doctor"** from the Role dropdown
   - For staff → Select **"staff"** from the Role dropdown
   - NOT "patient" or "admin"

2. **Fill in required fields:**
   ```
   Full Name: Dr. John Smith
   Email: john.smith@hospital.com
   Password: ********
   Role: doctor ✅ (Important!)
   Department: Cardiology
   Specialty: Interventional Cardiology
   Issue NFC Card: ✓ (optional)
   ```

3. **Click Submit** - The DID will be created with `owner_type='doctor'`

4. **Verify in console:**
   - Open browser DevTools → Console
   - You should see:
     ```
     All DIDs: X
     Staff/Doctor DIDs: Y (should be > 0)
     Owner types found: ["patient", "doctor", "staff"]
     ```

### Solution 2: Fix Existing DIDs

If you already have DIDs that were created with wrong owner_type:

#### Option A: Using Direct Database Update (Supabase Studio)

1. Go to Supabase Studio
2. Navigate to Table Editor → `dids` table
3. Find the DID for your doctor (search by `owner_name`)
4. Click on the row to edit
5. Change `owner_type` from `patient` to `doctor` or `staff`
6. Save changes
7. Refresh the certification management page

#### Option B: Recreate the DID

1. Note the doctor's email/name
2. Delete the old profile (if needed)
3. Re-onboard with correct role selection

### How to Check Current DIDs

Add this code to browser console on `/admin/certifications-mgmt`:

```javascript
// This will show you all DIDs and their types
fetch('/api/getAllDIDs')
  .then(r => r.json())
  .then(data => {
    console.table(data.dids.map(d => ({
      name: d.owner_name,
      type: d.owner_type,
      did: d.did.slice(0, 30) + '...'
    })));
  });
```

Expected output for correctly onboarded doctors:
```
┌─────────┬────────────────────┬────────────┬───────────────────────────────┐
│ (index) │       name         │    type    │            did                │
├─────────┼────────────────────┼────────────┼───────────────────────────────┤
│    0    │ 'Dr. John Smith'   │  'doctor'  │ 'did:hosp:0x1234...'          │
│    1    │ 'Nurse Jane'       │  'staff'   │ 'did:hosp:0x5678...'          │
│    2    │ 'Patient Bob'      │  'patient' │ 'did:hosp:0x9abc...'          │
└─────────┴────────────────────┴────────────┴───────────────────────────────┘
```

### Valid owner_type Values

According to the database schema (`user_role` enum):
- ✅ `'patient'` - For patients
- ✅ `'doctor'` - For doctors (shows in certification dropdown)
- ✅ `'staff'` - For nurses, technicians, etc. (shows in certification dropdown)
- ✅ `'admin'` - For administrators

**Only 'doctor' and 'staff' appear in the certification management dropdown.**

### Why This Filtering Exists

The certification system is designed for professional credentials:
- Medical licenses
- Board certifications
- Specializations
- Training certificates

These only apply to medical professionals (doctors/staff), not patients or admins.

### Verification Steps After Fix

1. Go to `/admin/certifications-mgmt`
2. Click "Add Certification"
3. The "Staff Member" dropdown should now show your doctors:
   ```
   Select staff member...
   Dr. John Smith (doctor) - did:hosp:0x1234...
   Nurse Jane (staff) - did:hosp:0x5678...
   ```

4. Select a doctor
5. Fill in certification details
6. Check "Admin Verification"
7. Click "Create Certification"
8. The doctor can now see it on `/staff/profile`

### Console Logs for Debugging

The certification page now logs helpful information. Open DevTools Console:

```
All DIDs: 15
Staff/Doctor DIDs: 5
Owner types found: Array(3) ["patient", "doctor", "staff"]
```

If you see:
- `Staff/Doctor DIDs: 0` → No doctors/staff DIDs found
- `Owner types found: ["patient"]` → Only patients were onboarded

This confirms the DIDs need to be fixed per Solution 2 above.

### Quick Reference: Onboarding Checklist

When onboarding a doctor:
- [ ] Email: Valid email address
- [ ] Full Name: Complete name with title (e.g., "Dr. John Smith")
- [ ] Password: At least 8 characters
- [ ] **Role: Select "doctor" or "staff"** ⭐ CRITICAL
- [ ] Department: (optional but recommended)
- [ ] Specialty: (optional but recommended)
- [ ] NFC Card: Check if needed

### Still Having Issues?

1. **Check browser console** for the debug logs
2. **Verify database** using Supabase Studio:
   ```sql
   SELECT owner_name, owner_type, did 
   FROM dids 
   WHERE owner_type IN ('doctor', 'staff')
   ORDER BY created_at DESC;
   ```
3. **Re-onboard** a test doctor with role='doctor'
4. **Contact support** with console logs if issue persists

### Future Improvements

Planned enhancements:
- UI warning during onboarding if role selection doesn't match intent
- Bulk DID owner_type update tool
- Better validation during DID creation
- Migration script to fix existing DIDs
