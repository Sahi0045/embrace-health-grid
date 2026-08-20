-- ============================================================================
-- Enhanced Consent Management System with 1-Hour Time-Based Access Control
-- ============================================================================
-- This migration adds comprehensive consent lifecycle tracking with:
-- - Request → Approval → Active Access → Expiration workflow
-- - Automatic 1-hour access window enforcement
-- - Complete audit trail with timestamps
-- - Backend-enforced time-based access validation
-- ============================================================================

-- ─── Add new columns to consents table ─────────────────────────────────────

-- Add lifecycle tracking columns
ALTER TABLE public.consents
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS access_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS doctor_name text,
  ADD COLUMN IF NOT EXISTS doctor_specialty text;

-- Add comment for documentation
COMMENT ON COLUMN public.consents.requested_at IS 'Timestamp when doctor requested access';
COMMENT ON COLUMN public.consents.approved_at IS 'Timestamp when patient approved the request';
COMMENT ON COLUMN public.consents.access_started_at IS 'Timestamp when access became active (same as approved_at)';
COMMENT ON COLUMN public.consents.rejected_at IS 'Timestamp when patient rejected the request';
COMMENT ON COLUMN public.consents.reason IS 'Doctor''s reason for requesting access';
COMMENT ON COLUMN public.consents.doctor_name IS 'Doctor''s display name at time of request';
COMMENT ON COLUMN public.consents.doctor_specialty IS 'Doctor''s specialty at time of request';

-- Add new status values if not already present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
                 WHERE t.typname = 'consent_status' AND e.enumlabel = 'requested') THEN
    ALTER TYPE consent_status ADD VALUE IF NOT EXISTS 'requested';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
                 WHERE t.typname = 'consent_status' AND e.enumlabel = 'rejected') THEN
    ALTER TYPE consent_status ADD VALUE IF NOT EXISTS 'rejected';
  END IF;
END$$;

-- ─── Helper function: Check if consent is currently active ─────────────────

CREATE OR REPLACE FUNCTION public.is_consent_active(consent_record public.consents)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT 
    consent_record.status = 'active'
    AND consent_record.approved_at IS NOT NULL
    AND (
      consent_record.expires_at IS NULL 
      OR consent_record.expires_at > now()
    )
    AND consent_record.revoked_at IS NULL;
$$;

COMMENT ON FUNCTION public.is_consent_active IS 
  'Returns true if consent is active and has not expired or been revoked';

-- ─── Helper function: Get active consent for doctor/patient pair ───────────

CREATE OR REPLACE FUNCTION public.get_active_consent(
  p_doctor_did text,
  p_patient_did text,
  p_resource text DEFAULT NULL
)
RETURNS public.consents
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.consents
  WHERE doctor_did = p_doctor_did
    AND patient_did = p_patient_did
    AND status = 'active'
    AND approved_at IS NOT NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND revoked_at IS NULL
    AND (p_resource IS NULL OR resource = p_resource)
  ORDER BY approved_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_active_consent IS 
  'Returns the active consent for a doctor/patient pair if one exists and has not expired';

-- ─── Helper function: Validate consent for data access ─────────────────────

CREATE OR REPLACE FUNCTION public.validate_consent_access(
  p_doctor_did text,
  p_patient_did text,
  p_resource text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consent public.consents;
BEGIN
  -- Get active consent
  SELECT * INTO v_consent
  FROM public.get_active_consent(p_doctor_did, p_patient_did, p_resource);
  
  -- Return true if consent exists and is valid
  IF v_consent.grant_id IS NOT NULL THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.validate_consent_access IS 
  'Validates if a doctor has active, non-expired consent to access patient data. Used by RLS policies.';

-- ─── Trigger: Auto-expire consents ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_expire_consents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update status to expired if expires_at has passed
  UPDATE public.consents
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at <= now()
    AND grant_id = NEW.grant_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to check expiration on read
DROP TRIGGER IF EXISTS check_consent_expiration ON public.consents;
CREATE TRIGGER check_consent_expiration
  BEFORE SELECT ON public.consents
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_expire_consents();

-- ─── Function: Request consent (doctor initiates) ──────────────────────────

CREATE OR REPLACE FUNCTION public.request_consent(
  p_doctor_did text,
  p_doctor_name text,
  p_doctor_specialty text,
  p_patient_did text,
  p_resource text,
  p_reason text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant_id text;
BEGIN
  -- Validate inputs
  IF p_doctor_did IS NULL OR p_patient_did IS NULL OR p_resource IS NULL THEN
    RAISE EXCEPTION 'doctor_did, patient_did, and resource are required';
  END IF;
  
  -- Prevent self-consent
  IF p_doctor_did = p_patient_did THEN
    RAISE EXCEPTION 'Cannot request consent for yourself';
  END IF;
  
  -- Generate grant ID
  v_grant_id := 'consent_' || substr(md5(random()::text), 1, 12);
  
  -- Insert consent request with 'requested' status
  INSERT INTO public.consents (
    grant_id,
    patient_did,
    doctor_did,
    resource,
    status,
    requested_at,
    reason,
    doctor_name,
    doctor_specialty,
    granted_at  -- Set to requested_at for backward compatibility
  ) VALUES (
    v_grant_id,
    p_patient_did,
    p_doctor_did,
    p_resource,
    'requested',
    now(),
    p_reason,
    p_doctor_name,
    p_doctor_specialty,
    now()
  );
  
  RETURN v_grant_id;
END;
$$;

COMMENT ON FUNCTION public.request_consent IS 
  'Doctor requests access to patient data. Creates consent record with requested status.';

-- ─── Function: Approve consent (patient approves) ──────────────────────────

CREATE OR REPLACE FUNCTION public.approve_consent(
  p_grant_id text,
  p_patient_did text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consent public.consents;
  v_expires_at timestamptz;
BEGIN
  -- Get the consent request
  SELECT * INTO v_consent
  FROM public.consents
  WHERE grant_id = p_grant_id
    AND patient_did = p_patient_did
    AND status = 'requested';
  
  IF v_consent.grant_id IS NULL THEN
    RAISE EXCEPTION 'Consent request not found or already processed';
  END IF;
  
  -- Calculate expiry: exactly 1 hour from now
  v_expires_at := now() + interval '1 hour';
  
  -- Update consent to active with 1-hour expiry
  UPDATE public.consents
  SET 
    status = 'active',
    approved_at = now(),
    access_started_at = now(),
    expires_at = v_expires_at
  WHERE grant_id = p_grant_id;
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.approve_consent IS 
  'Patient approves consent request. Sets status to active and expires_at to exactly 1 hour from approval.';

-- ─── Function: Reject consent (patient rejects) ────────────────────────────

CREATE OR REPLACE FUNCTION public.reject_consent(
  p_grant_id text,
  p_patient_did text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consent public.consents;
BEGIN
  -- Get the consent request
  SELECT * INTO v_consent
  FROM public.consents
  WHERE grant_id = p_grant_id
    AND patient_did = p_patient_did
    AND status = 'requested';
  
  IF v_consent.grant_id IS NULL THEN
    RAISE EXCEPTION 'Consent request not found or already processed';
  END IF;
  
  -- Update consent to rejected
  UPDATE public.consents
  SET 
    status = 'rejected',
    rejected_at = now()
  WHERE grant_id = p_grant_id;
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.reject_consent IS 
  'Patient rejects consent request. Sets status to rejected.';

-- ─── Update RLS policies with time-based validation ────────────────────────

-- Drop existing policies
DROP POLICY IF EXISTS consents_select ON public.consents;
DROP POLICY IF EXISTS consents_insert_doctor ON public.consents;
DROP POLICY IF EXISTS consents_update_patient ON public.consents;

-- Patients can see their own consents
CREATE POLICY consents_select_patient ON public.consents
  FOR SELECT
  USING (
    patient_did IN (SELECT * FROM public.current_user_dids())
  );

-- Doctors can see consents they requested
CREATE POLICY consents_select_doctor ON public.consents
  FOR SELECT
  USING (
    doctor_did IN (SELECT * FROM public.current_user_dids())
  );

-- Doctors can request consent (insert with 'requested' status)
CREATE POLICY consents_insert_doctor ON public.consents
  FOR INSERT
  WITH CHECK (
    doctor_did IN (SELECT * FROM public.current_user_dids())
    AND status = 'requested'
  );

-- Patients can approve/reject their consent requests
CREATE POLICY consents_update_patient ON public.consents
  FOR UPDATE
  USING (
    patient_did IN (SELECT * FROM public.current_user_dids())
  );

-- Patients can revoke active consents
CREATE POLICY consents_revoke_patient ON public.consents
  FOR UPDATE
  USING (
    patient_did IN (SELECT * FROM public.current_user_dids())
    AND status IN ('active', 'requested')
  )
  WITH CHECK (
    status = 'revoked'
    AND revoked_at IS NOT NULL
  );

-- ─── Update prescriptions RLS to enforce consent ───────────────────────────

-- Drop existing doctor access policy
DROP POLICY IF EXISTS prescriptions_select_doctor ON public.prescriptions;

-- Doctors can only select prescriptions for patients with active consent
CREATE POLICY prescriptions_select_doctor ON public.prescriptions
  FOR SELECT
  USING (
    doctor_did IN (SELECT * FROM public.current_user_dids())
    OR (
      -- Must have active, non-expired consent
      EXISTS (
        SELECT 1 FROM public.consents c
        WHERE c.doctor_did IN (SELECT * FROM public.current_user_dids())
          AND c.patient_did = prescriptions.patient_did
          AND c.status = 'active'
          AND c.approved_at IS NOT NULL
          AND (c.expires_at IS NULL OR c.expires_at > now())
          AND c.revoked_at IS NULL
          AND c.resource IN ('Prescription Ledger', 'Full Health Profile', 'Medical Records')
      )
    )
  );

-- ─── Update medical_records RLS to enforce consent ─────────────────────────

-- Drop existing doctor access policy
DROP POLICY IF EXISTS medical_records_select_doctor ON public.medical_records;

-- Doctors can only select records for patients with active consent
CREATE POLICY medical_records_select_doctor ON public.medical_records
  FOR SELECT
  USING (
    author_did IN (SELECT * FROM public.current_user_dids())
    OR (
      -- Must have active, non-expired consent
      EXISTS (
        SELECT 1 FROM public.consents c
        WHERE c.doctor_did IN (SELECT * FROM public.current_user_dids())
          AND c.patient_did = medical_records.patient_did
          AND c.status = 'active'
          AND c.approved_at IS NOT NULL
          AND (c.expires_at IS NULL OR c.expires_at > now())
          AND c.revoked_at IS NULL
          AND c.resource IN ('Medical Records', 'Full Health Profile')
      )
    )
  );

-- ─── Update medical_reports RLS to enforce consent ─────────────────────────

-- Drop existing doctor access policy if exists
DROP POLICY IF EXISTS medical_reports_select_doctor ON public.medical_reports;

-- Doctors can only select reports for patients with active consent
CREATE POLICY medical_reports_select_doctor ON public.medical_reports
  FOR SELECT
  USING (
    author_did IN (SELECT * FROM public.current_user_dids())
    OR (
      -- Must have active, non-expired consent
      EXISTS (
        SELECT 1 FROM public.consents c
        WHERE c.doctor_did IN (SELECT * FROM public.current_user_dids())
          AND c.patient_did = medical_reports.patient_did
          AND c.status = 'active'
          AND c.approved_at IS NOT NULL
          AND (c.expires_at IS NULL OR c.expires_at > now())
          AND c.revoked_at IS NULL
          AND c.resource IN ('Medical Records', 'Full Health Profile', 'Prescription Ledger')
      )
    )
  );

-- ─── Update prescription_items RLS to enforce consent ──────────────────────

-- Drop existing doctor access policy if exists
DROP POLICY IF EXISTS prescription_items_select_doctor ON public.prescription_items;

-- Doctors can only select prescription items for patients with active consent
CREATE POLICY prescription_items_select_doctor ON public.prescription_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
      WHERE p.rx_id = prescription_items.prescription_id
        AND (
          p.doctor_did IN (SELECT * FROM public.current_user_dids())
          OR EXISTS (
            SELECT 1 FROM public.consents c
            WHERE c.doctor_did IN (SELECT * FROM public.current_user_dids())
              AND c.patient_did = p.patient_did
              AND c.status = 'active'
              AND c.approved_at IS NOT NULL
              AND (c.expires_at IS NULL OR c.expires_at > now())
              AND c.revoked_at IS NULL
              AND c.resource IN ('Prescription Ledger', 'Full Health Profile', 'Medical Records')
          )
        )
    )
  );

-- ─── Create indexes for performance ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS consents_requested_at_idx ON public.consents (requested_at DESC);
CREATE INDEX IF NOT EXISTS consents_approved_at_idx ON public.consents (approved_at DESC);
CREATE INDEX IF NOT EXISTS consents_status_expires_idx ON public.consents (status, expires_at) 
  WHERE status = 'active';

-- Composite index for consent validation queries
CREATE INDEX IF NOT EXISTS consents_doctor_patient_active_idx 
  ON public.consents (doctor_did, patient_did, status, expires_at)
  WHERE status = 'active';

-- ─── Backfill existing consents ─────────────────────────────────────────────

-- Update existing pending consents to have requested status
UPDATE public.consents
SET 
  status = 'requested',
  requested_at = COALESCE(granted_at, created_at, now())
WHERE status = 'pending'
  AND requested_at IS NULL;

-- Update existing active consents to have proper timestamps
UPDATE public.consents
SET 
  approved_at = COALESCE(granted_at, created_at),
  access_started_at = COALESCE(granted_at, created_at),
  requested_at = COALESCE(granted_at, created_at) - interval '1 hour'
WHERE status = 'active'
  AND approved_at IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing after migration)
-- ============================================================================

-- Check consent lifecycle states:
-- SELECT status, count(*) FROM public.consents GROUP BY status;

-- Check active consents with expiry info:
-- SELECT grant_id, patient_did, doctor_did, resource, approved_at, expires_at,
--        CASE 
--          WHEN expires_at IS NULL THEN 'No expiry'
--          WHEN expires_at > now() THEN 'Active (' || to_char(expires_at - now(), 'HH24:MI') || ' remaining)'
--          ELSE 'Expired'
--        END as status_detail
-- FROM public.consents
-- WHERE status = 'active'
-- ORDER BY approved_at DESC;

