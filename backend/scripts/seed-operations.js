/**
 * Operational and clinical fixtures.
 *
 * Split from seed-data.js because that file was already ~560 lines and this is a
 * distinct concern: the core identity/consent/records fixtures prove the security
 * model, whereas these populate the 14 screens that were rendering empty states.
 *
 * Every row is stamped with a hospital_id where the table has one, so the
 * tenancy boundary is exercised rather than bypassed — Apollo's beds must not
 * appear to City Care staff.
 *
 * Written with service_role: several of these tables gate INSERT on active
 * patient consent, which a seed script has no business satisfying.
 */

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db service_role client
 * @param {{ hospitalIds: Record<string,string>, ids: Record<string,string>, dids: Record<string,string> }} ctx
 */
export async function seedOperations(db, ctx) {
  const { hospitalIds, ids, dids } = ctx;

  /** Insert and throw on rejection, so a silent no-op cannot pass for success. */
  const put = async (table, rows) => {
    const { error } = await db.from(table).insert(rows);
    if (error) throw new Error(`seed ${table}: ${error.message}`);
  };
  const apollo = hospitalIds.apollo;
  const city = hospitalIds.citycare;

  const days = (n) => new Date(Date.now() + n * 864e5).toISOString();
  const hours = (n) => new Date(Date.now() + n * 36e5).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  // ── Patient-facing ────────────────────────────────────────────────────────

  await put("vaccines", [
    {
      vaccine_id: "SEED-VAC-A1",
      patient_did: dids.alice,
      vaccine_name: "Influenza (Quadrivalent)",
      dose_number: 1,
      administered_on: days(-120),
      administered_by: "Dr Sara Smith",
      batch_number: "FLU-2026-8841",
      next_due_on: days(245),
      hospital_id: apollo,
    },
    {
      vaccine_id: "SEED-VAC-A2",
      patient_did: dids.alice,
      vaccine_name: "Hepatitis B",
      dose_number: 3,
      administered_on: days(-400),
      administered_by: "Dr Sara Smith",
      batch_number: "HEPB-2025-1290",
      next_due_on: null,
      hospital_id: apollo,
    },
    {
      vaccine_id: "SEED-VAC-B1",
      patient_did: dids.bob,
      vaccine_name: "Tetanus (Td)",
      dose_number: 1,
      administered_on: days(-60),
      administered_by: "Dr Sara Smith",
      batch_number: "TD-2026-3312",
      next_due_on: days(3590),
      hospital_id: apollo,
    },
    {
      vaccine_id: "SEED-VAC-C1",
      patient_did: dids.carol,
      vaccine_name: "Influenza (Quadrivalent)",
      dose_number: 1,
      administered_on: days(-30),
      administered_by: "Dr Raj Jones",
      batch_number: "FLU-2026-9004",
      next_due_on: days(335),
      hospital_id: city,
    },
  ]);

  // Deliberately varied: Alice mid-deductible, Bob fully met, so the UI shows
  // more than one state.
  await put("insurance_policies", [
    {
      patient_did: dids.alice,
      provider: "Star Health",
      policy_number: "SH-4471-8829",
      group_number: "GRP-APOLLO-01",
      coverage_type: "Family Floater",
      copay: 500,
      deductible: 25000,
      deductible_met: 12500,
      out_of_pocket_max: 100000,
      out_of_pocket_met: 18400,
      coverage_percentage: 80,
      valid_from: days(-200),
      valid_to: days(165),
    },
    {
      patient_did: dids.bob,
      provider: "HDFC ERGO",
      policy_number: "HE-9920-1174",
      group_number: "GRP-APOLLO-01",
      coverage_type: "Individual",
      copay: 250,
      deductible: 15000,
      deductible_met: 15000,
      out_of_pocket_max: 75000,
      out_of_pocket_met: 41200,
      coverage_percentage: 90,
      valid_from: days(-90),
      valid_to: days(275),
    },
    {
      patient_did: dids.carol,
      provider: "Niva Bupa",
      policy_number: "NB-3318-5502",
      group_number: "GRP-CITY-02",
      coverage_type: "Individual",
      copay: 400,
      deductible: 20000,
      deductible_met: 0,
      out_of_pocket_max: 80000,
      out_of_pocket_met: 0,
      coverage_percentage: 75,
      valid_from: days(-15),
      valid_to: days(350),
    },
  ]);

  await put("billing_accounts", [
    { patient_did: dids.alice, outstanding: 4850, total_billed: 23400, total_paid: 18550 },
    { patient_did: dids.bob, outstanding: 0, total_billed: 8900, total_paid: 8900 },
    { patient_did: dids.carol, outstanding: 12300, total_billed: 12300, total_paid: 0 },
  ]);

  // Alice is currently admitted, Bob was discharged — so Inpatient Care shows an
  // active stay and a history rather than one row.
  await put("admissions", [
    {
      admission_id: "SEED-ADM-A1",
      patient_did: dids.alice,
      admitted_at: days(-3),
      expected_discharge: days(2),
      discharged_at: null,
      status: "admitted",
      ward: "Cardiology",
      room: "C-204",
      bed: "B2",
      admitting_doctor: "Dr Sara Smith",
      diagnosis: "Unstable angina — observation",
      hospital_id: apollo,
    },
    {
      admission_id: "SEED-ADM-B1",
      patient_did: dids.bob,
      admitted_at: days(-40),
      expected_discharge: days(-36),
      discharged_at: days(-36),
      status: "discharged",
      ward: "General Medicine",
      room: "G-110",
      bed: "B1",
      admitting_doctor: "Dr Sara Smith",
      diagnosis: "Community-acquired pneumonia",
      hospital_id: apollo,
    },
  ]);

  await put("patient_preferences", [
    {
      patient_did: dids.alice,
      emergency_access: true,
      insurance_verification: true,
      research_sharing: false,
      cross_hospital: true,
    },
    {
      patient_did: dids.bob,
      emergency_access: true,
      insurance_verification: false,
      research_sharing: false,
      cross_hospital: false,
    },
    {
      patient_did: dids.carol,
      emergency_access: false,
      insurance_verification: true,
      research_sharing: true,
      cross_hospital: true,
    },
  ]);

  // One approved, one pending, one declined — the three states the UI renders.
  await put("visitors", [
    {
      visitor_id: "SEED-VIS-A1",
      patient_did: dids.alice,
      visitor_name: "Meera Tan",
      relation: "Sister",
      visit_date: today,
      purpose: "Family visit",
      status: "approved",
      requested_by: ids.alice,
      resolved_at: hours(-4),
    },
    {
      visitor_id: "SEED-VIS-A2",
      patient_did: dids.alice,
      visitor_name: "Ravi Tan",
      relation: "Father",
      visit_date: today,
      purpose: "Family visit",
      status: "pending",
      requested_by: ids.alice,
    },
    {
      visitor_id: "SEED-VIS-B1",
      patient_did: dids.bob,
      visitor_name: "Unknown Caller",
      relation: "Unspecified",
      visit_date: today,
      purpose: "Unverified request",
      status: "denied",
      requested_by: ids.admin,
      resolved_at: hours(-20),
    },
  ]);

  // A short vitals series, so charts have a trend instead of a single point.
  const vitalRows = [];
  for (let i = 6; i >= 0; i--) {
    vitalRows.push({
      patient_did: dids.alice,
      heart_rate: 74 + ((i * 3) % 9),
      bp_systolic: 118 + ((i * 2) % 8),
      bp_diastolic: 76 + (i % 5),
      spo2: 97 + (i % 2),
      temperature: 36.6 + (i % 3) * 0.1,
      resp_rate: 16 + (i % 3),
      recorded_at: hours(-i * 4),
      hospital_id: apollo,
    });
  }
  await put("vitals", vitalRows);

  // ── Staff-facing ──────────────────────────────────────────────────────────

  await put("surgeries", [
    {
      surgery_id: "SEED-SUR-A1",
      patient_did: dids.alice,
      procedure_name: "Coronary angiography",
      operating_room: "OR-2",
      scheduled_for: hours(20),
      surgeon: "Dr Sara Smith",
      anesthesiologist: "Dr Neha Rao",
      status: "scheduled",
      est_duration_min: 75,
      hospital_id: apollo,
    },
    {
      surgery_id: "SEED-SUR-B1",
      patient_did: dids.bob,
      procedure_name: "Appendectomy (laparoscopic)",
      operating_room: "OR-1",
      scheduled_for: days(-38),
      surgeon: "Dr Sara Smith",
      anesthesiologist: "Dr Neha Rao",
      status: "completed",
      est_duration_min: 60,
      hospital_id: apollo,
    },
    {
      surgery_id: "SEED-SUR-C1",
      patient_did: dids.carol,
      procedure_name: "Cataract extraction",
      operating_room: "OR-A",
      scheduled_for: days(4),
      surgeon: "Dr Raj Jones",
      anesthesiologist: "Dr Imran Qureshi",
      status: "scheduled",
      est_duration_min: 45,
      hospital_id: city,
    },
  ]);

  await put("rooms", [
    {
      room_id: "SEED-RM-C204",
      room_name: "C-204",
      category: "Cardiology",
      floor: 2,
      hospital_id: apollo,
    },
    {
      room_id: "SEED-RM-C205",
      room_name: "C-205",
      category: "Cardiology",
      floor: 2,
      hospital_id: apollo,
    },
    {
      room_id: "SEED-RM-G110",
      room_name: "G-110",
      category: "General",
      floor: 1,
      hospital_id: apollo,
    },
    {
      room_id: "SEED-RM-OR2",
      room_name: "OR-2",
      category: "Theatre",
      floor: 3,
      hospital_id: apollo,
    },
    {
      room_id: "SEED-RM-CC01",
      room_name: "CC-101",
      category: "General",
      floor: 1,
      hospital_id: city,
    },
  ]);

  // Mixed occupancy so the ward view is not uniformly one colour.
  await put("beds", [
    {
      bed_id: "SEED-BED-C204B2",
      ward: "Cardiology",
      status: "occupied",
      patient_did: dids.alice,
      hospital_id: apollo,
    },
    {
      bed_id: "SEED-BED-C204B1",
      ward: "Cardiology",
      status: "available",
      patient_did: null,
      hospital_id: apollo,
    },
    {
      bed_id: "SEED-BED-C205B1",
      ward: "Cardiology",
      status: "cleaning",
      patient_did: null,
      hospital_id: apollo,
    },
    {
      bed_id: "SEED-BED-G110B1",
      ward: "General Medicine",
      status: "available",
      patient_did: null,
      hospital_id: apollo,
    },
    {
      bed_id: "SEED-BED-G110B2",
      ward: "General Medicine",
      status: "occupied",
      patient_did: dids.bob,
      hospital_id: apollo,
    },
    {
      bed_id: "SEED-BED-CC101B1",
      ward: "General",
      status: "available",
      patient_did: null,
      hospital_id: city,
    },
  ]);

  // Clock-in without a matching clock-out for dr.smith, so the roster shows
  // someone currently on duty.
  await put("attendance", [
    {
      staff_id: ids.drsmith,
      action: "in",
      location: "Main entrance",
      recorded_at: hours(-6),
      hospital_id: apollo,
    },
    {
      staff_id: ids.admin,
      action: "in",
      location: "Admin wing",
      recorded_at: hours(-8),
      hospital_id: apollo,
    },
    {
      staff_id: ids.admin,
      action: "out",
      location: "Admin wing",
      recorded_at: hours(-1),
      hospital_id: apollo,
    },
    {
      staff_id: ids.drjones,
      action: "in",
      location: "OPD entrance",
      recorded_at: hours(-5),
      hospital_id: city,
    },
  ]);

  await put("staff_schedule", [
    {
      shift_id: "SEED-SHIFT-1",
      staff_id: ids.drsmith,
      shift_date: today,
      role: "Cardiologist",
      starts_at: "08:00",
      ends_at: "16:00",
      unit: "Cardiology",
      patient_count: 7,
      confirmed: true,
      hospital_id: apollo,
    },
    {
      shift_id: "SEED-SHIFT-2",
      staff_id: ids.drsmith,
      shift_date: new Date(Date.now() + 864e5).toISOString().slice(0, 10),
      role: "Cardiologist",
      starts_at: "12:00",
      ends_at: "20:00",
      unit: "Cardiology",
      patient_count: 0,
      confirmed: false,
      hospital_id: apollo,
    },
    {
      shift_id: "SEED-SHIFT-3",
      staff_id: ids.drjones,
      shift_date: today,
      role: "Ophthalmologist",
      starts_at: "09:00",
      ends_at: "17:00",
      unit: "Ophthalmology",
      patient_count: 4,
      confirmed: true,
      hospital_id: city,
    },
  ]);

  await put("equipment", [
    {
      equipment_id: "SEED-EQ-1",
      name: "Ventilator (Hamilton C6)",
      category: "Critical care",
      status: "in-use",
      location: "ICU-1",
      last_serviced_on: days(-45),
      hospital_id: apollo,
    },
    {
      equipment_id: "SEED-EQ-2",
      name: "Portable ultrasound",
      category: "Imaging",
      status: "available",
      location: "Cardiology store",
      last_serviced_on: days(-12),
      hospital_id: apollo,
    },
    {
      equipment_id: "SEED-EQ-3",
      name: "Defibrillator (Zoll R)",
      category: "Emergency",
      status: "maintenance",
      location: "Biomed workshop",
      last_serviced_on: days(-180),
      hospital_id: apollo,
    },
    {
      equipment_id: "SEED-EQ-4",
      name: "Slit lamp",
      category: "Ophthalmology",
      status: "available",
      location: "OPD-3",
      last_serviced_on: days(-20),
      hospital_id: city,
    },
  ]);

  await put("ambulances", [
    {
      ambulance_id: "SEED-AMB-1",
      registration: "KA-01-AB-4471",
      vehicle_type: "Advanced Life Support",
      status: "available",
      current_location: "Apollo General — bay 1",
      driver_name: "Suresh Kumar",
      hospital_id: apollo,
    },
    {
      ambulance_id: "SEED-AMB-2",
      registration: "KA-01-AB-9920",
      vehicle_type: "Basic Life Support",
      status: "in-use",
      current_location: "Koramangala, en route",
      driver_name: "Vinod Shetty",
      hospital_id: apollo,
    },
    {
      ambulance_id: "SEED-AMB-3",
      registration: "MH-12-CD-3318",
      vehicle_type: "Patient Transport",
      status: "available",
      current_location: "City Care — bay A",
      driver_name: "Prakash Joshi",
      hospital_id: city,
    },
  ]);
}

/** Remove what seedOperations created, so the seed stays re-runnable. */
export async function cleanupOperations(db) {
  const byPrefix = [
    ["vaccines", "vaccine_id"],
    ["admissions", "admission_id"],
    ["visitors", "visitor_id"],
    ["surgeries", "surgery_id"],
    ["rooms", "room_id"],
    ["beds", "bed_id"],
    ["staff_schedule", "shift_id"],
    ["equipment", "equipment_id"],
    ["ambulances", "ambulance_id"],
  ];
  for (const [table, key] of byPrefix) {
    await db.from(table).delete().like(key, "SEED-%");
  }

  // These are keyed by patient_did rather than a SEED- id, so delete by the
  // seeded DID prefix instead.
  for (const table of ["insurance_policies", "billing_accounts", "patient_preferences", "vitals"]) {
    await db.from(table).delete().like("patient_did", "did:hosp:0xSEED%");
  }

  // attendance has no natural seed key; scope by the seeded staff ids.
  const { data: staff } = await db.from("profiles").select("id").like("email", "%@seed.test");
  for (const s of staff ?? []) {
    await db.from("attendance").delete().eq("staff_id", s.id);
  }
}
