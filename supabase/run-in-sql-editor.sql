-- ============================================================================
-- MULTI-TENANT HOSPITAL ISOLATION — COMPLETE SQL (hardened)
-- Paste into: https://supabase.com/dashboard/project/etazymekhfnijbmcvzwl/sql/new
-- Run the whole file at once.
-- ============================================================================

-- ─── 1. Add hospital_id columns (safe — IF NOT EXISTS) ───────────────────────

ALTER TABLE public.admissions
  ADD COLUMN IF NOT EXISTS hospital_id uuid
    REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL;

ALTER TABLE public.billing_accounts
  ADD COLUMN IF NOT EXISTS hospital_id uuid
    REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL;

-- admission_events.hospital_id is TEXT from migration 20260814 — skip ADD COLUMN,
-- just make sure backfill and cast work below.

ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS hospital_id uuid
    REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL;

ALTER TABLE public.nfc_cards
  ADD COLUMN IF NOT EXISTS hospital_id uuid
    REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL;

-- ─── 2. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS admissions_hospital_idx          ON public.admissions (hospital_id);
CREATE INDEX IF NOT EXISTS admissions_hospital_status_idx   ON public.admissions (hospital_id, status);
CREATE INDEX IF NOT EXISTS billing_accounts_hospital_idx    ON public.billing_accounts (hospital_id);
CREATE INDEX IF NOT EXISTS admission_events_hospital_idx    ON public.admission_events (hospital_id);
CREATE INDEX IF NOT EXISTS visitors_hospital_idx            ON public.visitors (hospital_id);
CREATE INDEX IF NOT EXISTS nfc_cards_hospital_idx           ON public.nfc_cards (hospital_id);

-- ─── 3–7. Backfill (plain UPDATEs — no DO $$ so planner sees new columns) ────

-- admissions: derive from bed's hospital, fall back to seed
UPDATE public.admissions a
SET hospital_id = (
  SELECT b.hospital_id FROM public.beds b
  WHERE b.bed_id = a.bed AND b.hospital_id IS NOT NULL LIMIT 1
)
WHERE a.hospital_id IS NULL;

UPDATE public.admissions
SET hospital_id = (
  SELECT hospital_id FROM public.hospitals
  WHERE slug = 'apollo-consortium-general' LIMIT 1
)
WHERE hospital_id IS NULL;

-- admission_events: hospital_id is TEXT here so cast uuid→text
UPDATE public.admission_events ae
SET hospital_id = (
  SELECT adm.hospital_id::text FROM public.admissions adm
  WHERE adm.admission_id = ae.admission_id
    AND adm.hospital_id IS NOT NULL LIMIT 1
)
WHERE ae.hospital_id IS NULL;

UPDATE public.admission_events
SET hospital_id = (
  SELECT hospital_id::text FROM public.hospitals
  WHERE slug = 'apollo-consortium-general' LIMIT 1
)
WHERE hospital_id IS NULL;

-- billing_accounts: derive from most recent admission for that patient
UPDATE public.billing_accounts ba
SET hospital_id = (
  SELECT adm.hospital_id FROM public.admissions adm
  WHERE adm.patient_did = ba.patient_did
    AND adm.hospital_id IS NOT NULL
  ORDER BY adm.admitted_at DESC LIMIT 1
)
WHERE ba.hospital_id IS NULL;

UPDATE public.billing_accounts
SET hospital_id = (
  SELECT hospital_id FROM public.hospitals
  WHERE slug = 'apollo-consortium-general' LIMIT 1
)
WHERE hospital_id IS NULL;

-- visitors: derive from patient DID → profile → hospital
UPDATE public.visitors v
SET hospital_id = (
  SELECT p.hospital_id FROM public.profiles p
  INNER JOIN public.dids d ON d.owner_id = p.id
  WHERE d.did = v.patient_did AND p.hospital_id IS NOT NULL LIMIT 1
)
WHERE v.hospital_id IS NULL;

UPDATE public.visitors
SET hospital_id = (
  SELECT hospital_id FROM public.hospitals
  WHERE slug = 'apollo-consortium-general' LIMIT 1
)
WHERE hospital_id IS NULL;

-- nfc_cards: derive from patient DID → profile → hospital
UPDATE public.nfc_cards nc
SET hospital_id = (
  SELECT p.hospital_id FROM public.profiles p
  INNER JOIN public.dids d ON d.owner_id = p.id
  WHERE d.did = nc.patient_did AND p.hospital_id IS NOT NULL LIMIT 1
)
WHERE nc.hospital_id IS NULL;

UPDATE public.nfc_cards
SET hospital_id = (
  SELECT hospital_id FROM public.hospitals
  WHERE slug = 'apollo-consortium-general' LIMIT 1
)
WHERE hospital_id IS NULL;

-- ─── 8. admissions RLS ───────────────────────────────────────────────────────

ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admissions_select_own       ON public.admissions;
DROP POLICY IF EXISTS admissions_select_consented ON public.admissions;
DROP POLICY IF EXISTS admissions_select_staff     ON public.admissions;
DROP POLICY IF EXISTS admissions_select_patient   ON public.admissions;
DROP POLICY IF EXISTS admissions_select_involved  ON public.admissions;
DROP POLICY IF EXISTS admissions_insert_staff     ON public.admissions;
DROP POLICY IF EXISTS admissions_insert_clinician ON public.admissions;
DROP POLICY IF EXISTS admissions_update_staff     ON public.admissions;
DROP POLICY IF EXISTS admissions_update_clinician ON public.admissions;
DROP POLICY IF EXISTS admissions_all_staff        ON public.admissions;

-- Patients see their own
CREATE POLICY admissions_select_own ON public.admissions
  FOR SELECT TO authenticated
  USING (patient_did IN (SELECT private.current_user_dids()));

-- Cross-hospital referral via consent
CREATE POLICY admissions_select_consented ON public.admissions
  FOR SELECT TO authenticated
  USING (private.has_active_consent(patient_did));

-- Staff see only their hospital
CREATE POLICY admissions_select_staff ON public.admissions
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

-- Staff can admit only into their hospital
CREATE POLICY admissions_insert_staff ON public.admissions
  FOR INSERT TO authenticated
  WITH CHECK (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

-- Staff can update (discharge/transfer) only within their hospital
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

-- ─── 9. billing_accounts RLS ─────────────────────────────────────────────────

ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_accounts_select_own   ON public.billing_accounts;
DROP POLICY IF EXISTS billing_accounts_select_staff ON public.billing_accounts;
DROP POLICY IF EXISTS billing_accounts_upsert_own   ON public.billing_accounts;
DROP POLICY IF EXISTS billing_accounts_upsert_staff ON public.billing_accounts;
DROP POLICY IF EXISTS billing_accounts_insert_staff ON public.billing_accounts;
DROP POLICY IF EXISTS billing_accounts_update_staff ON public.billing_accounts;
DROP POLICY IF EXISTS billing_accounts_all_staff    ON public.billing_accounts;

CREATE POLICY billing_accounts_select_own ON public.billing_accounts
  FOR SELECT TO authenticated
  USING (patient_did IN (SELECT private.current_user_dids()));

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

-- ─── 10. admission_events RLS ────────────────────────────────────────────────
-- hospital_id is TEXT here → cast to uuid for can_access_hospital(uuid)

ALTER TABLE public.admission_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admission_events_select_own   ON public.admission_events;
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
    AND private.can_access_hospital(hospital_id::uuid)
  );

-- ─── 11. visitors RLS ────────────────────────────────────────────────────────

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

-- ─── 12. nfc_cards RLS ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS nfc_cards_select_staff ON public.nfc_cards;
DROP POLICY IF EXISTS nfc_cards_all_staff    ON public.nfc_cards;

CREATE POLICY nfc_cards_select_staff ON public.nfc_cards
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

-- ─── 13. profiles RLS — hospital-scoped ──────────────────────────────────────

DROP POLICY IF EXISTS profiles_select_staff         ON public.profiles;
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
DROP POLICY IF EXISTS profiles_select_hospital      ON public.profiles;

-- Own profile always visible; super_admin sees all; staff see same hospital only
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

-- ─── 14. dids RLS — hospital-scoped + cross-hospital clinician directory ──────

DROP POLICY IF EXISTS dids_select_authenticated  ON public.dids;
DROP POLICY IF EXISTS dids_select_staff          ON public.dids;
DROP POLICY IF EXISTS dids_select_same_hospital  ON public.dids;
DROP POLICY IF EXISTS dids_select_clinician_dir  ON public.dids;
DROP POLICY IF EXISTS dids_select_cross_hospital ON public.dids;

-- Own DID, same-hospital, cross-hospital clinician dir (for referrals),
-- organisation DIDs (for credential verification), super_admin sees all
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

-- ─── 15. Auto-stamp triggers ─────────────────────────────────────────────────
-- Guarantees hospital_id is never NULL on new admissions or billing rows

CREATE OR REPLACE FUNCTION private.stamp_admission_hospital()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h uuid;
BEGIN
  IF NEW.hospital_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT b.hospital_id INTO h FROM public.beds b WHERE b.bed_id = NEW.bed LIMIT 1;
  IF h IS NULL THEN
    SELECT hospital_id INTO h FROM public.profiles WHERE id = auth.uid();
  END IF;
  NEW.hospital_id := h;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS admissions_stamp_hospital ON public.admissions;
CREATE TRIGGER admissions_stamp_hospital
  BEFORE INSERT ON public.admissions
  FOR EACH ROW EXECUTE FUNCTION private.stamp_admission_hospital();

CREATE OR REPLACE FUNCTION private.stamp_billing_hospital()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h uuid;
BEGIN
  IF NEW.hospital_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT p.hospital_id INTO h FROM public.profiles p
    INNER JOIN public.dids d ON d.owner_id = p.id
    WHERE d.did = NEW.patient_did LIMIT 1;
  IF h IS NULL THEN
    SELECT hospital_id INTO h FROM public.profiles WHERE id = auth.uid();
  END IF;
  NEW.hospital_id := h;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS billing_accounts_stamp_hospital ON public.billing_accounts;
CREATE TRIGGER billing_accounts_stamp_hospital
  BEFORE INSERT ON public.billing_accounts
  FOR EACH ROW EXECUTE FUNCTION private.stamp_billing_hospital();

-- ─── 16. Ward occupancy view ─────────────────────────────────────────────────
-- DROP first — CREATE OR REPLACE cannot reorder existing columns

DROP VIEW IF EXISTS public.ward_occupancy;

CREATE VIEW public.ward_occupancy AS
SELECT
  a.ward,
  a.hospital_id,
  COUNT(*)                                         AS total_admitted,
  COUNT(*) FILTER (WHERE a.status = 'admitted')    AS currently_admitted,
  COUNT(*) FILTER (WHERE a.status = 'discharged')  AS discharged,
  COUNT(*) FILTER (WHERE a.status = 'transferred') AS transferred
FROM public.admissions a
GROUP BY a.ward, a.hospital_id;

-- ─── 17. Realtime ────────────────────────────────────────────────────────────

ALTER TABLE public.admissions       REPLICA IDENTITY FULL;
ALTER TABLE public.billing_accounts REPLICA IDENTITY FULL;

-- ─── Verification ────────────────────────────────────────────────────────────
-- All counts should be 0 or more. 0 is fine for empty tables.

SELECT 'admissions'       AS tbl, COUNT(*) AS rows_with_hospital FROM public.admissions       WHERE hospital_id IS NOT NULL
UNION ALL
SELECT 'billing_accounts' AS tbl, COUNT(*) AS rows_with_hospital FROM public.billing_accounts WHERE hospital_id IS NOT NULL
UNION ALL
SELECT 'visitors'         AS tbl, COUNT(*) AS rows_with_hospital FROM public.visitors         WHERE hospital_id IS NOT NULL
UNION ALL
SELECT 'nfc_cards'        AS tbl, COUNT(*) AS rows_with_hospital FROM public.nfc_cards        WHERE hospital_id IS NOT NULL
UNION ALL
SELECT 'admission_events' AS tbl, COUNT(*) AS rows_with_hospital FROM public.admission_events WHERE hospital_id IS NOT NULL;
