-- ============================================================================
-- Hospital Isolation — RLS Policies
-- Migration: 20260824100000_hospital_isolation_policies.sql
-- ============================================================================
-- Replaces or adds hospital-scoped RLS policies for:
--   admissions, billing_accounts, admission_events,
--   visitors, nfc_cards, profiles, dids
--
-- Written as plain SQL only (no DO $$ blocks) to avoid Supabase CLI
-- statement-splitting issues with dollar-quoted blocks.
-- ============================================================================

-- ─── admissions ──────────────────────────────────────────────────────────────
-- Keep existing patient/consent policies, replace staff-scoped ones

DROP POLICY IF EXISTS admissions_select_staff      ON public.admissions;
DROP POLICY IF EXISTS admissions_insert_staff      ON public.admissions;
DROP POLICY IF EXISTS admissions_update_staff      ON public.admissions;
DROP POLICY IF EXISTS admissions_insert_clinician  ON public.admissions;
DROP POLICY IF EXISTS admissions_update_clinician  ON public.admissions;
DROP POLICY IF EXISTS admissions_select_involved   ON public.admissions;
DROP POLICY IF EXISTS admissions_all_staff         ON public.admissions;

-- Staff see admissions only within their hospital (hospital_id scoped)
CREATE POLICY admissions_select_staff ON public.admissions
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

-- Staff insert admissions only within their hospital
CREATE POLICY admissions_insert_staff ON public.admissions
  FOR INSERT TO authenticated
  WITH CHECK (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

-- Staff update admissions (discharge/transfer) only within their hospital
CREATE POLICY admissions_update_staff ON public.admissions
  FOR UPDATE TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  )
  WITH CHECK (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

-- ─── billing_accounts ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS billing_accounts_select_staff  ON public.billing_accounts;
DROP POLICY IF EXISTS billing_accounts_upsert_staff  ON public.billing_accounts;
DROP POLICY IF EXISTS billing_accounts_insert_staff  ON public.billing_accounts;
DROP POLICY IF EXISTS billing_accounts_update_staff  ON public.billing_accounts;
DROP POLICY IF EXISTS billing_accounts_all_staff     ON public.billing_accounts;

-- Staff see billing only within their hospital
CREATE POLICY billing_accounts_select_staff ON public.billing_accounts
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY billing_accounts_insert_staff ON public.billing_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY billing_accounts_update_staff ON public.billing_accounts
  FOR UPDATE TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  )
  WITH CHECK (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

-- ─── admission_events ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS admission_events_select_staff ON public.admission_events;
DROP POLICY IF EXISTS admission_events_select_all   ON public.admission_events;
DROP POLICY IF EXISTS admission_events_all_staff    ON public.admission_events;

CREATE POLICY admission_events_select_own ON public.admission_events
  FOR SELECT TO authenticated
  USING (patient_did IN (SELECT private.current_user_dids()));

CREATE POLICY admission_events_select_staff ON public.admission_events
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

-- ─── visitors ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS visitors_select_staff    ON public.visitors;
DROP POLICY IF EXISTS visitors_update_staff    ON public.visitors;
DROP POLICY IF EXISTS visitors_insert_involved ON public.visitors;
DROP POLICY IF EXISTS visitors_all_staff       ON public.visitors;

CREATE POLICY visitors_select_staff ON public.visitors
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY visitors_insert_involved ON public.visitors
  FOR INSERT TO authenticated
  WITH CHECK (
    patient_did IN (SELECT private.current_user_dids())
    OR (
      private.current_user_role() IN ('doctor', 'staff', 'admin')
      AND private.can_access_hospital(hospital_id)
    )
  );

CREATE POLICY visitors_update_staff ON public.visitors
  FOR UPDATE TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  )
  WITH CHECK (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

-- ─── nfc_cards ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS nfc_cards_select_staff ON public.nfc_cards;
DROP POLICY IF EXISTS nfc_cards_all_staff    ON public.nfc_cards;

CREATE POLICY nfc_cards_select_staff ON public.nfc_cards
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

-- ─── profiles — tighten SELECT to hospital-scoped ────────────────────────────
-- Own profile always visible. Super admin sees all. Staff/admin/doctor see
-- only same-hospital profiles.

DROP POLICY IF EXISTS profiles_select_staff         ON public.profiles;
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
DROP POLICY IF EXISTS profiles_select_hospital      ON public.profiles;

CREATE POLICY profiles_select_staff ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR private.is_super_admin()
    OR (
      private.current_user_role() IN ('doctor', 'staff', 'admin')
      AND hospital_id = private.current_user_hospital()
    )
  );

-- ─── dids — tighten SELECT for full isolation ────────────────────────────────
-- Own DID, same-hospital, cross-hospital clinician directory (for referrals),
-- organisation DIDs (for credential verification), super admin.

DROP POLICY IF EXISTS dids_select_authenticated  ON public.dids;
DROP POLICY IF EXISTS dids_select_staff          ON public.dids;
DROP POLICY IF EXISTS dids_select_same_hospital  ON public.dids;
DROP POLICY IF EXISTS dids_select_clinician_dir  ON public.dids;
DROP POLICY IF EXISTS dids_select_cross_hospital ON public.dids;

CREATE POLICY dids_select_authenticated ON public.dids
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR private.is_super_admin()
    OR private.can_access_hospital(hospital_id)
    OR (
      owner_type IN ('doctor', 'staff')
      AND is_organisation = false
      AND private.current_user_role() IN ('doctor', 'staff', 'admin')
    )
    OR is_organisation = true
  );
