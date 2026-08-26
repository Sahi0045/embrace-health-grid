-- ============================================================================
-- patient_master: stop asserting consent choices the patient never made
-- ============================================================================
-- The view coalesced four privacy preferences to literal defaults:
--
--   COALESCE(pp.emergency_access,       true)
--   COALESCE(pp.insurance_verification, true)
--   COALESCE(pp.research_sharing,       false)
--   COALESCE(pp.cross_hospital,         false)
--
-- A patient with no patient_preferences row has answered none of these, but the
-- view reported "emergency access enabled" and "insurance verification enabled"
-- as though they had opted in. These are consent flags on a medical record, and
-- a default that reads as an affirmative answer is the one kind of default that
-- must never be invented. NULL is the honest value: it lets the UI say "not
-- set" rather than claim an answer the patient never gave.
--
-- The column list and its ORDER are reproduced verbatim from
-- 20260816005000_patient_master_integration.sql because CREATE OR REPLACE VIEW
-- can neither drop nor reorder columns; only the four expressions above differ.

CREATE OR REPLACE VIEW public.patient_master AS
SELECT
  -- ── Core Patient Identity ──────────────────────────────────────────────────
  d.did AS patient_did,
  d.owner_name AS patient_name,
  d.hospital_id,
  h.name AS hospital_name,
  
  -- ── Current Admission ──────────────────────────────────────────────────────
  a.admission_id,
  a.admitted_at,
  a.expected_discharge,
  a.discharged_at,
  a.status AS admission_status,
  a.diagnosis,
  
  -- ── Current Location Hierarchy ──────────────────────────────────────────────
  a.bed AS bed_id,
  b.bed_number,
  b.bed_type,
  CASE WHEN b.status = 'occupied' THEN 'occupied' ELSE 'available' END AS bed_status,
  
  a.room AS room_id,
  r.room_number,
  r.room_type,
  r.capacity AS room_capacity,
  
  a.ward AS ward_id,
  w.ward_name,
  w.ward_type,
  w.ward_code,
  
  f.floor_id,
  f.floor_number,
  f.floor_name,
  
  bldg.building_id,
  bldg.building_name,
  bldg.building_code,
  
  -- ── Assigned Staff ──────────────────────────────────────────────────────────
  a.admitting_doctor AS assigned_doctor_did,
  MAX(CASE 
    WHEN ss.confirmed = true AND ss.shift_date = CURRENT_DATE 
    THEN ss.staff_id::text 
    ELSE NULL 
  END) AS assigned_nurse_id,
  
  -- ── Medical Summary ────────────────────────────────────────────────────────
  COUNT(DISTINCT mr.record_id)::int AS total_medical_records,
  COUNT(DISTINCT proc.procedure_id)::int AS total_procedures,
  COUNT(DISTINCT m.medication_id)::int AS active_medications,
  COUNT(DISTINCT lab.lab_id)::int AS total_lab_results,
  
  -- ── Billing Information ────────────────────────────────────────────────────
  ba.total_billed,
  ba.outstanding AS outstanding_balance,
  ba.total_paid,
  ip.provider AS insurance_provider,
  ip.policy_number,
  ip.coverage_percentage,
  
  -- ── Patient Preferences ────────────────────────────────────────────────────
  pp.emergency_access       AS emergency_access_enabled,
  pp.insurance_verification AS insurance_verification_enabled,
  pp.research_sharing       AS research_sharing_enabled,
  pp.cross_hospital         AS cross_hospital_access_enabled,
  
  -- ── Metadata ────────────────────────────────────────────────────────────────
  d.created_at AS patient_registered_at,
  ba.updated_at AS billing_last_updated,
  MAX(a.admitted_at) AS last_admission_date
FROM
  public.dids d
  LEFT JOIN public.hospitals h ON d.hospital_id = h.hospital_id
  LEFT JOIN public.admissions a ON d.did = a.patient_did AND a.status = 'admitted'
  LEFT JOIN public.beds b ON a.bed = b.bed_id
  LEFT JOIN public.rooms r ON b.room_id = r.room_id
  LEFT JOIN public.wards w ON b.ward_id = w.ward_id
  LEFT JOIN public.floors f ON w.floor_id = f.floor_id
  LEFT JOIN public.buildings bldg ON f.building_id = bldg.building_id
  LEFT JOIN public.staff_schedule ss ON a.bed = ss.unit AND ss.staff_id IS NOT NULL
  LEFT JOIN public.medical_records mr ON d.did = mr.patient_did
  LEFT JOIN public.procedures proc ON d.did = proc.patient_did
  LEFT JOIN public.medications m ON d.did = m.medication_id AND m.status = 'active'
  LEFT JOIN public.lab_results lab ON d.did = lab.patient_did
  LEFT JOIN public.billing_accounts ba ON d.did = ba.patient_did
  LEFT JOIN public.insurance_policies ip ON d.did = ip.patient_did
  LEFT JOIN public.patient_preferences pp ON d.did = pp.patient_did
WHERE
  d.owner_type = 'patient'
GROUP BY
  d.did, d.owner_name, d.hospital_id, h.name,
  a.admission_id, a.admitted_at, a.expected_discharge, a.discharged_at,
  a.status, a.diagnosis, a.bed, a.room, a.ward, a.admitting_doctor,
  b.bed_id, b.bed_number, b.bed_type, b.status,
  r.room_id, r.room_number, r.room_type, r.capacity,
  w.ward_id, w.ward_name, w.ward_type, w.ward_code,
  f.floor_id, f.floor_number, f.floor_name,
  bldg.building_id, bldg.building_name, bldg.building_code,
  ba.total_billed, ba.outstanding, ba.total_paid, ba.updated_at,
  ip.provider, ip.policy_number, ip.coverage_percentage,
  pp.emergency_access, pp.insurance_verification, pp.research_sharing, pp.cross_hospital,
  d.created_at;

-- CREATE OR REPLACE VIEW does not carry reloptions across, so security_invoker
-- has to be re-asserted every time the definition changes. The guard in
-- 20260826010000 fails the migration if this is ever forgotten.
alter view public.patient_master set (security_invoker = true);

comment on view public.patient_master is
  'Unified read-only patient record. security_invoker = true: enforces the caller''s RLS on every table it joins — do NOT recreate without it. Preference columns are nullable; NULL means the patient has not answered, never "no".';
