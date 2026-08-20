# Quick Test Guide - Schedule & Appointments

## ✅ What Was Fixed

1. **Weekly schedule now shows appointments on correct days** (no database migration needed!)
2. **Doctors see only their own appointments**
3. **Staff/Admin see all appointments from all doctors**
4. **Patient profile updates now persist all fields**
5. **Doctors can see patient health info (allergies, blood group)**

---

## 🚀 Quick Test (5 Minutes)

### **Test 1: Book Appointment with Future Date**
```
1. Login as: patient@example.com
2. Go to: Appointments page
3. Click: Any doctor's "Book" button
4. Select: Date = 3 days from today (e.g., August 20)
5. Select: Time = 10:00 AM
6. Click: "Send Appointment Request"
7. ✅ Should succeed without errors
```

### **Test 2: Doctor Sees Appointment on Correct Day**
```
1. Login as: doctor@example.com (the doctor you booked with)
2. Go to: Schedule page
3. Click: "Week" view button
4. Use: < > arrows to navigate to the correct week
5. ✅ Should see appointment on August 20 (not today!)
6. ✅ Should see patient's allergies and blood group (if set)
7. ✅ Should NOT see other doctors' appointments
```

### **Test 3: Staff Sees All Appointments**
```
1. Login as: staff@example.com
2. Go to: Schedule page
3. Click: "Week" view
4. ✅ Page title should say "All Appointments" 
5. ✅ Should see the appointment from Test 1
6. ✅ Should see doctor's name on the appointment card
7. ✅ Should see appointments from multiple doctors (if any exist)
```

### **Test 4: Patient Profile Update**
```
1. Login as: patient@example.com
2. Go to: My Profile
3. Click: "Edit Profile"
4. Change: Blood Group to "O+", add "Peanuts" to allergies
5. Click: "Save Changes"
6. Refresh page
7. ✅ Changes should still be there
8. Book another appointment
9. Login as doctor
10. ✅ Should see O+ blood group and Peanuts allergy
```

---

## 🎯 Key Changes Made

### **Slot Format Change**
**Old:** `"Wed · 10:00 AM"` ❌ (no date info)  
**New:** `"2026-08-20 · Wed · 10:00 AM"` ✅ (date included)

### **Files Modified**
- `src/lib/clinical.server.ts` - Backend filtering and profile updates
- `src/lib/api.ts` - API layer updates
- `src/routes/staff.schedule.tsx` - Schedule display logic
- `src/routes/patient.appointments.tsx` - Booking flow

### **No Database Changes Required**
- ✅ No migrations to run
- ✅ Works immediately
- ✅ Old appointments still work (fall back to booked_at date)

---

## 🐛 Troubleshooting

### **Problem: Appointments still only show today**
**Solution:** 
1. Book a NEW appointment (old ones may not have dates)
2. Make sure you selected a future date when booking
3. Navigate to the correct week using < > buttons

### **Problem: "Could not find 'date' column" error**
**Solution:** This error should be gone now. If you still see it, the fix is already applied.

### **Problem: Doctor sees appointments from other doctors**
**Solution:** Make sure you're logged in as a doctor (not staff/admin). Staff intentionally see all appointments.

### **Problem: Profile changes don't persist**
**Solution:** Hard refresh the page (Ctrl+F5). If still not working, check browser console for errors.

---

## 📊 Expected Results

### **Week View - Doctor Portal**
```
Mon   Tue   Wed   Thu   Fri   Sat   Sun
16    17    18    19    20    21    22
                        🔵    
                      (your appt)
```

### **Week View - Staff Portal**
```
Mon   Tue   Wed   Thu   Fri   Sat   Sun
16    17    18    19    20    21    22
🔵    🔵          🔵    🔵    
(all doctors' appointments)
```

### **Appointment Card - Doctor View**
```
┌─────────────────────────────────┐
│ 👤 John Doe                     │
│ ⚕️ General Medicine · In-Person│
│ 🕐 2026-08-20 · Wed · 10:00 AM │
│                                 │
│ 📋 Patient Info:               │
│   • Age: 30 years              │
│   • Gender: Male               │
│   • Blood: O+                  │
│   • ⚠️ Allergies: Peanuts      │
└─────────────────────────────────┘
```

---

## ✅ Success Criteria

- [ ] Can book appointment with future date
- [ ] Appointment appears on correct day in week view
- [ ] Doctor sees only their own appointments
- [ ] Staff sees all appointments with doctor names
- [ ] Patient profile updates persist
- [ ] Doctor can see patient health info
- [ ] Month view shows appointments on correct dates

---

## 🎉 All Done!

The system is ready to use immediately. No database migrations or additional setup required!

**If you encounter any issues, check the detailed guide:** `SCHEDULE_FIXES_SUMMARY.md`
