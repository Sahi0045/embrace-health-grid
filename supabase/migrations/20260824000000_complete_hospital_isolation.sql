-- ============================================================================
-- Complete Multi-Tenant Hospital Isolation — DDL Phase
-- Migration: 20260824000000_complete_hospital_isolation.sql
-- ============================================================================
-- Adds hospital_id columns, indexes, backfill, and triggers.
-- Policy changes are in 20260824100000_hospital_isolation_policies.sql
-- ============================================================================

-- ─── Add hospital_id columns ─────────────────────────────────────────────────

ALTER TABLE public.admissions
  ADD COLUMN IF NOT EXISTS hospital_id uuid
    REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL;

ALTER TABLE public.billing_accounts
  ADD COLUMN IF NOT EXISTS hospital_id uuid
    REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL;

ALTER TABLE public.admission_events
  ADD COLUMN IF NOT EXISTS hospital_id uuid
    REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL;

ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS hospital_id uuid
    REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL;

ALTER TABLE public.nfc_cards
  ADD COLUMN IF NOT EXISTS hospital_id uuid
    REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS admissions_hospital_idx
  ON public.admissions (hospital_id);

CREATE INDEX IF NOT EXISTS admissions_hospital_status_idx
  ON public.admissions (hospital_id, status);

CREATE INDEX IF NOT EXISTS billing_accounts_hospital_idx
  ON public.billing_accounts (hospital_id);

CREATE INDEX IF NOT EXISTS admission_events_hospital_idx
  ON public.admission_events (hospital_id);

CREATE INDEX IF NOT EXISTS visitors_hospital_idx
  ON public.visitors (hospital_id);

CREATE INDEX IF NOT EXISTS visitors_hospital_status_idx
  ON public.visitors (hospital_id, status);

CREATE INDEX IF NOT EXISTS nfc_cards_hospital_idx
  ON public.nfc_cards (hospital_id);

-- ─── Backfill ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  seed uuid;
BEGIN
  SELECT hospital_id INTO seed FROM public.hospitals
    WHERE slug = 'apollo-consortium-general';
  IF seed IS NULL THEN
    SELECT hospital_id INTO seed FROM public.hospitals
      WHERE status = 'active' ORDER BY created_at LIMIT 1;
  END IF;
  IF seed IS NULL THEN RETURN; END IF;

  UPDATE public.admissions a
  SET hospital_id = COALESCE(
    (SELECT b.hospital_id FROM public.beds b
      WHERE b.bed_id = a.bed AND b.hospital_id IS NOT NULL LIMIT 1),
    seed)
  WHERE a.hospital_id IS NULL;

  UPDATE public.billing_accounts ba
  SET hospital_id = COALESCE(
    (SELECT adm.hospital_id FROM public.admissions adm
      WHERE adm.patient_did = ba.patient_did AND adm.hospital_id IS NOT NULL
      ORDER BY adm.admitted_at DESC LIMIT 1),
    seed)
  WHERE ba.hospital_id IS NULL;

  UPDATE public.admission_events ae
  SET hospital_id = COALESCE(
    (SELECT adm.hospital_id FROM public.admissions adm
      WHERE adm.admission_id = ae.admission_id AND adm.hospital_id IS NOT NULL LIMIT 1),
    seed)
  WHERE ae.hospital_id IS NULL;

  UPDATE public.visitors v
  SET hospital_id = COALESCE(
    (SELECT p.hospital_id FROM public.profiles p
      JOIN public.dids d ON d.owner_id = p.id
      WHERE d.did = v.patient_did AND p.hospital_id IS NOT NULL LIMIT 1),
    seed)
  WHERE v.hospital_id IS NULL;

  UPDATE public.nfc_cards nc
  SET hospital_id = COALESCE(
    (SELECT p.hospital_id FROM public.profiles p
      JOIN public.dids d ON d.owner_id = p.id
      WHERE d.did = nc.patient_did AND p.hospital_id IS NOT NULL LIMIT 1),
    seed)
  WHERE nc.hospital_id IS NULL;
END $$;

-- ─── Enable RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.admissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_events ENABLE ROW LEVEL SECURITY;

-- ─── Ward occupancy view with hospital_id ────────────────────────────────────

CREATE OR REPLACE VIEW public.ward_occupancy AS
SELECT
  a.ward,
  a.hospital_id,
  COUNT(*) AS total_admitted,
  COUNT(*) FILTER (WHERE a.status = 'admitted')    AS currently_admitted,
  COUNT(*) FILTER (WHERE a.status = 'discharged')  AS discharged,
  COUNT(*) FILTER (WHERE a.status = 'transferred') AS transferred
FROM public.admissions a
GROUP BY a.ward, a.hospital_id;

-- ─── Auto-stamp trigger: admissions ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.stamp_admission_hospital()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE h uuid;
BEGIN
  IF NEW.hospital_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT b.hospital_id INTO h FROM public.beds b WHERE b.bed_id = NEW.bed LIMIT 1;
  IF h IS NULL THEN
    SELECT hospital_id INTO h FROM public.profiles WHERE id = auth.uid();
  END IF;
  NEW.hospital_id := h;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admissions_stamp_hospital ON public.admissions;
CREATE TRIGGER admissions_stamp_hospital
  BEFORE INSERT ON public.admissions
  FOR EACH ROW EXECUTE FUNCTION private.stamp_admission_hospital();

-- ─── Auto-stamp trigger: billing_accounts ────────────────────────────────────

CREATE OR REPLACE FUNCTION private.stamp_billing_hospital()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE h uuid;
BEGIN
  IF NEW.hospital_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT p.hospital_id INTO h
    FROM public.profiles p JOIN public.dids d ON d.owner_id = p.id
   WHERE d.did = NEW.patient_did LIMIT 1;
  IF h IS NULL THEN
    SELECT hospital_id INTO h FROM public.profiles WHERE id = auth.uid();
  END IF;
  NEW.hospital_id := h;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billing_accounts_stamp_hospital ON public.billing_accounts;
CREATE TRIGGER billing_accounts_stamp_hospital
  BEFORE INSERT ON public.billing_accounts
  FOR EACH ROW EXECUTE FUNCTION private.stamp_billing_hospital();

-- ─── Realtime publication ────────────────────────────────────────────────────

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.admissions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_accounts;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.admission_events;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.admissions       REPLICA IDENTITY FULL;
ALTER TABLE public.billing_accounts REPLICA IDENTITY FULL;
