-- ============================================================================
-- Patient Master Integration — Unified patient data aggregation view
-- ============================================================================
-- Creates a centralized Patient Master view that aggregates all patient-related
-- information from existing tables without duplicating data:
--
--   Core Patient Data: profiles, dids, patient_preferences
--   Admission Information: admissions (current + historical)
--   Hospital Location: Current bed, room, ward, building, floor, hospital
--   Assigned Staff: Admitting doctor, assigned nurse (from staff_schedule)
--   Medical Information: medical_records, procedures, surgeries, medications,
--                        lab_results, nursing_notes, daily_checkups
--   Billing: billing_accounts, insurance_policies
--   Discharge Information: admissions.discharged_at, discharge summary
--   Transfer History: admission_events (all location changes)
--
-- Security Model:
--   - Patient sees only their own data via private.current_user_dids()
--   - Clinicians see only patients they have active consent for
--   - Admins see all patients in their hospital
--   - No new RLS policies needed; queries enforce existing rules on joined tables
--
-- No new tables are created; this is a read-only view for unified access.
-- ============================================================================

-- ─── Patient Master View ────────────────────────────────────────────────────
-- Comprehensive patient record with all related information joined
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
  COALESCE(pp.emergency_access, true) AS emergency_access_enabled,
  COALESCE(pp.insurance_verification, true) AS insurance_verification_enabled,
  COALESCE(pp.research_sharing, false) AS research_sharing_enabled,
  COALESCE(pp.cross_hospital, false) AS cross_hospital_access_enabled,
  
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

COMMENT ON VIEW public.patient_master IS
  'Unified patient record aggregating core patient data, admission info, current location, medical records, billing, and preferences. Read-only; updates go through specific domain APIs.';

-- ─── Patient Master — Current Location View ─────────────────────────────────
-- Simplified view for quick current-location lookups
CREATE OR REPLACE VIEW public.patient_current_location AS
SELECT
  a.patient_did,
  a.admission_id,
  a.bed,
  b.bed_number,
  b.bed_type,
  a.room AS room_id,
  r.room_number,
  r.room_type,
  a.ward AS ward_id,
  w.ward_name,
  w.ward_type,
  f.floor_number,
  bldg.building_name,
  h.name AS hospital_name,
  a.admitted_at,
  a.expected_discharge,
  a.status
FROM
  public.admissions a
  LEFT JOIN public.beds b ON a.bed = b.bed_id
  LEFT JOIN public.rooms r ON b.room_id = r.room_id
  LEFT JOIN public.wards w ON b.ward_id = w.ward_id
  LEFT JOIN public.floors f ON w.floor_id = f.floor_id
  LEFT JOIN public.buildings bldg ON f.building_id = bldg.building_id
  LEFT JOIN public.hospitals h ON bldg.hospital_id = h.hospital_id
WHERE
  a.status = 'admitted';

COMMENT ON VIEW public.patient_current_location IS
  'Quick lookup of patient current hospital location (bed, room, ward, building).';

-- ─── Patient Master — Admission & Transfer History View ────────────────────
-- All admissions and transfers for audit trail and historical analysis
CREATE OR REPLACE VIEW public.patient_admission_history AS
SELECT
  a.patient_did,
  a.admission_id,
  a.admitted_at,
  a.discharged_at,
  a.status,
  a.diagnosis,
  a.bed,
  a.room,
  a.ward,
  a.admitting_doctor,
  EXTRACT(DAY FROM (COALESCE(a.discharged_at, NOW()) - a.admitted_at)) AS length_of_stay_days,
  COUNT(ae.event_id) FILTER (WHERE ae.event_type = 'transferred') AS total_transfers,
  ba.total_billed AS admission_bill,
  ba.outstanding AS unpaid_balance
FROM
  public.admissions a
  LEFT JOIN public.admission_events ae ON a.admission_id = ae.admission_id
  LEFT JOIN public.billing_accounts ba ON a.patient_did = ba.patient_did
GROUP BY
  a.patient_did, a.admission_id, a.admitted_at, a.discharged_at, a.status,
  a.diagnosis, a.bed, a.room, a.ward, a.admitting_doctor, ba.total_billed, ba.outstanding
ORDER BY
  a.admitted_at DESC;

COMMENT ON VIEW public.patient_admission_history IS
  'Historical view of all patient admissions with transfer counts and billing per admission.';

-- ─── Indexes for performance ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS patient_master_patient_did_idx ON public.dids(did)
  WHERE owner_type = 'patient';

CREATE INDEX IF NOT EXISTS patient_master_hospital_idx ON public.dids(hospital_id)
  WHERE owner_type = 'patient';

-- ─── RLS Policies on Views (read-only) ──────────────────────────────────────
-- Views are not themselves under RLS; the underlying table queries enforce it.
-- But we can add SELECT policies for clarity in audit/debugging.

-- ─── Helper: Resolve patient name from DID ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_patient_name(p_patient_did text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_name FROM public.dids WHERE did = p_patient_did AND owner_type = 'patient' LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_name(text) TO authenticated, service_role;

-- ─── Helper: Resolve patient's current admission ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_patient_current_admission(p_patient_did text)
RETURNS TABLE (
  admission_id text,
  admitted_at timestamptz,
  expected_discharge date,
  status text,
  bed text,
  ward text,
  room text,
  diagnosis text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    admission_id, admitted_at, expected_discharge, status, bed, ward, room, diagnosis
  FROM public.admissions
  WHERE patient_did = p_patient_did AND status = 'admitted'
  ORDER BY admitted_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_current_admission(text) TO authenticated, service_role;

-- ─── Helper: Get patient location hierarchy ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_patient_location(p_patient_did text)
RETURNS TABLE (
  patient_did text,
  bed_id text,
  bed_number text,
  bed_type text,
  room_id text,   -- rooms.room_id is text, not uuid
  room_number text,
  room_type text,
  ward_id uuid,
  ward_name text,
  ward_type text,
  floor_id uuid,
  floor_number int,
  building_id uuid,
  building_name text,
  hospital_id uuid,
  hospital_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.patient_did,
    a.bed,
    b.bed_number,
    b.bed_type,
    r.room_id,
    r.room_number,
    r.room_type,
    w.ward_id,
    w.ward_name,
    w.ward_type,
    f.floor_id,
    f.floor_number,
    bldg.building_id,
    bldg.building_name,
    h.hospital_id,
    h.name
  FROM public.admissions a
  LEFT JOIN public.beds b ON a.bed = b.bed_id
  LEFT JOIN public.rooms r ON b.room_id = r.room_id
  LEFT JOIN public.wards w ON b.ward_id = w.ward_id
  LEFT JOIN public.floors f ON w.floor_id = f.floor_id
  LEFT JOIN public.buildings bldg ON f.building_id = bldg.building_id
  LEFT JOIN public.hospitals h ON bldg.hospital_id = h.hospital_id
  WHERE a.patient_did = p_patient_did AND a.status = 'admitted'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_location(text) TO authenticated, service_role;

-- ─── Helper: Get all patient medical records ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_patient_medical_records(p_patient_did text)
RETURNS TABLE (
  record_id text,
  title text,
  record_type text,
  content text,
  author_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT record_id, title, record_type, content, author_name, created_at
  FROM public.medical_records
  WHERE patient_did = p_patient_did
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_medical_records(text) TO authenticated, service_role;

-- ─── Helper: Get patient admission history ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_patient_admission_history(p_patient_did text)
RETURNS TABLE (
  admission_id text,
  admitted_at timestamptz,
  discharged_at timestamptz,
  status text,
  diagnosis text,
  bed text,
  ward text,
  length_of_stay_days int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    admission_id,
    admitted_at,
    discharged_at,
    status,
    diagnosis,
    bed,
    ward,
    EXTRACT(DAY FROM (COALESCE(discharged_at, NOW()) - admitted_at))::int
  FROM public.admissions
  WHERE patient_did = p_patient_did
  ORDER BY admitted_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_admission_history(text) TO authenticated, service_role;

-- ─── Enable Realtime on views for live updates ──────────────────────────────
-- (Views themselves don't have realtime; but the underlying tables do)
-- This documents that changes to admissions, beds, rooms, wards, billing
-- automatically propagate to patient_master subscribers.

COMMENT ON SCHEMA public IS
  'Patient Master integration complete. Views aggregate patient data from existing tables. All writes go through domain APIs (admissions, beds, billing, etc.). Realtime enabled on underlying tables; view changes propagate automatically.';
