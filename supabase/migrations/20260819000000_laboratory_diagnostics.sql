-- ============================================================================
-- EMBRACE HEALTH GRID — LABORATORY & DIAGNOSTICS EXTENDED SYSTEM
-- Migration: 20260819000000_laboratory_diagnostics.sql
-- ============================================================================

-- 1. Lab Orders Table (Doctor & Department Test Orders)
CREATE TABLE IF NOT EXISTS public.lab_orders (
  order_id TEXT PRIMARY KEY,
  patient_did TEXT NOT NULL REFERENCES public.dids(did) ON DELETE CASCADE,
  ordered_by TEXT REFERENCES public.dids(did) ON DELETE SET NULL,
  hospital_id UUID REFERENCES public.hospitals(hospital_id),
  test_name TEXT NOT NULL,
  test_category TEXT NOT NULL DEFAULT 'biochemistry',
  priority TEXT NOT NULL DEFAULT 'routine', -- 'stat', 'urgent', 'routine'
  clinical_notes TEXT,
  specimen_type TEXT DEFAULT 'blood',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  lab_id TEXT REFERENCES public.lab_results(lab_id) ON DELETE SET NULL,
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Lab Samples Table (Specimen Collection & Processing Pipeline)
CREATE TABLE IF NOT EXISTS public.lab_samples (
  sample_id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES public.lab_orders(order_id) ON DELETE CASCADE,
  lab_id TEXT REFERENCES public.lab_results(lab_id) ON DELETE SET NULL,
  patient_did TEXT NOT NULL REFERENCES public.dids(did) ON DELETE CASCADE,
  hospital_id UUID REFERENCES public.hospitals(hospital_id),
  sample_type TEXT NOT NULL DEFAULT 'blood', -- 'blood', 'urine', 'tissue', 'swab', 'csf', 'sputum'
  barcode TEXT,
  collection_status TEXT NOT NULL DEFAULT 'collected', -- 'collected', 'lab_received', 'processing', 'resulted', 'reported'
  collected_by TEXT,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  reported_at TIMESTAMPTZ,
  temperature_c NUMERIC(4,1),
  container_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Radiology Orders & Imaging Scans Table
CREATE TABLE IF NOT EXISTS public.radiology_orders (
  order_id TEXT PRIMARY KEY,
  patient_did TEXT NOT NULL REFERENCES public.dids(did) ON DELETE CASCADE,
  ordered_by TEXT REFERENCES public.dids(did) ON DELETE SET NULL,
  hospital_id UUID REFERENCES public.hospitals(hospital_id),
  modality TEXT NOT NULL DEFAULT 'xray', -- 'mri', 'ct', 'xray', 'ultrasound', 'fluoroscopy', 'pet'
  body_part TEXT NOT NULL,
  clinical_indication TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'routine', -- 'stat', 'urgent', 'routine'
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'reported', 'cancelled'
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  equipment_id TEXT,
  report_text TEXT,
  reported_by TEXT,
  reported_at TIMESTAMPTZ,
  pacs_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Ensure lab_results has necessary columns
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS is_critical BOOLEAN DEFAULT FALSE;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS critical_flag TEXT;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'biochemistry';
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS verified_by TEXT;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS lab_orders_patient_did_idx ON public.lab_orders (patient_did);
CREATE INDEX IF NOT EXISTS lab_orders_hospital_idx ON public.lab_orders (hospital_id);
CREATE INDEX IF NOT EXISTS lab_orders_status_idx ON public.lab_orders (status);
CREATE INDEX IF NOT EXISTS lab_orders_priority_idx ON public.lab_orders (priority);

CREATE INDEX IF NOT EXISTS lab_samples_order_idx ON public.lab_samples (order_id);
CREATE INDEX IF NOT EXISTS lab_samples_patient_idx ON public.lab_samples (patient_did);
CREATE INDEX IF NOT EXISTS lab_samples_status_idx ON public.lab_samples (collection_status);

CREATE INDEX IF NOT EXISTS radiology_orders_patient_idx ON public.radiology_orders (patient_did);
CREATE INDEX IF NOT EXISTS radiology_orders_hospital_idx ON public.radiology_orders (hospital_id);
CREATE INDEX IF NOT EXISTS radiology_orders_status_idx ON public.radiology_orders (status);

-- 6. Row Level Security
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radiology_orders ENABLE ROW LEVEL SECURITY;

-- ─── Row Level Security ─────────────────────────────────────────────────────
--
-- These three tables hold PHI: what was ordered for whom, specimen chain of
-- custody, and imaging findings. They were originally created with
--   FOR SELECT USING (true) / WITH CHECK (true)
-- on all three tables for select, insert AND update, which is no access control
-- at all: any authenticated account could read, create and MODIFY any patient's
-- lab and radiology orders in every hospital. The comment said "within hospital
-- or own" but nothing implemented it.
--
-- They now follow exactly the same model as lab_results, which these tables
-- reference and whose data they describe:
--
--   SELECT  the patient's own DIDs, or a clinician holding active consent
--   INSERT  a doctor/staff holding active consent
--   UPDATE  the same (a corrected result or a sample status change is normal care)
--   DELETE  no policy — chain of custody must not be erasable
--
-- Deliberately NOT gated on private.can_access_hospital(). These are clinical
-- records, so they follow the PATIENT and not the building: a patient referred
-- from hospital A to hospital B must be able to grant B access to the labs A
-- ordered. hospital_id on these tables is provenance only. This is the Stage 4
-- PHI decision, and the guard at the end of this file now enforces it for these
-- tables too.
--
-- Admin is intentionally absent: an administrator has no blanket PHI read, and
-- break-glass remains the audited exception.
--
-- Split into one policy per visibility reason rather than a single OR'd
-- condition, so that why a row was readable stays auditable.

do $$
declare
  t text;
begin
  foreach t in array array['lab_orders', 'lab_samples', 'radiology_orders']
  loop
    -- Replace the wide-open originals.
    execute format('drop policy if exists %1$I_select on public.%1$I', t);
    execute format('drop policy if exists %1$I_insert on public.%1$I', t);
    execute format('drop policy if exists %1$I_update on public.%1$I', t);

    execute format($f$
      drop policy if exists %1$I_select_own on public.%1$I;
      create policy %1$I_select_own on public.%1$I
        for select to authenticated
        using (patient_did in (select private.current_user_dids()));
    $f$, t);

    execute format($f$
      drop policy if exists %1$I_select_consented on public.%1$I;
      create policy %1$I_select_consented on public.%1$I
        for select to authenticated
        using (private.has_active_consent(patient_did));
    $f$, t);

    execute format($f$
      drop policy if exists %1$I_insert_clinician on public.%1$I;
      create policy %1$I_insert_clinician on public.%1$I
        for insert to authenticated
        with check (
          private.current_user_role() in ('doctor', 'staff')
          and private.has_active_consent(patient_did)
        );
    $f$, t);

    execute format($f$
      drop policy if exists %1$I_update_clinician on public.%1$I;
      create policy %1$I_update_clinician on public.%1$I
        for update to authenticated
        using (
          private.current_user_role() in ('doctor', 'staff')
          and private.has_active_consent(patient_did)
        )
        with check (
          private.current_user_role() in ('doctor', 'staff')
          and private.has_active_consent(patient_did)
        );
    $f$, t);
  end loop;
end $$;

comment on table public.lab_orders is
  'Lab test orders. PHI: readable by the patient or a clinician with active consent, never hospital-gated so referrals work. hospital_id is provenance only.';

comment on table public.lab_samples is
  'Specimen chain of custody. PHI: same access model as lab_orders. No DELETE policy — custody history must survive.';

comment on table public.radiology_orders is
  'Imaging orders and reports. PHI: same access model as lab_orders.';

-- 7. Add to Realtime Publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_orders;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_samples;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.radiology_orders;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- ─── PHI guard ──────────────────────────────────────────────────────────────
-- Mirrors the Stage 4 guard for the tables added here. If someone later
-- hospital-gates one of these clinical SELECT policies, referrals silently break
-- for lab and imaging data: a patient moving from hospital A to B could consent
-- to B reading their labs and B would still see nothing. Fail the migration
-- rather than ship that.
do $$
declare
  offending text;
begin
  select string_agg(policyname, ', ')
    into offending
    from pg_policies
   where schemaname = 'public'
     and tablename in ('lab_orders', 'lab_samples', 'radiology_orders')
     and cmd = 'SELECT'
     and qual like '%can_access_hospital%';

  if offending is not null then
    raise exception
      'Clinical SELECT policies must not be hospital-gated, or referrals break: %',
      offending;
  end if;
end $$;
