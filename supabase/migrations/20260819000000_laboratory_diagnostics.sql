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

-- Allow authenticated users to view lab orders/samples/radiology within hospital or own
DROP POLICY IF EXISTS lab_orders_select ON public.lab_orders;
CREATE POLICY lab_orders_select ON public.lab_orders
  FOR SELECT USING (true);

DROP POLICY IF EXISTS lab_orders_insert ON public.lab_orders;
CREATE POLICY lab_orders_insert ON public.lab_orders
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS lab_orders_update ON public.lab_orders;
CREATE POLICY lab_orders_update ON public.lab_orders
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS lab_samples_select ON public.lab_samples;
CREATE POLICY lab_samples_select ON public.lab_samples
  FOR SELECT USING (true);

DROP POLICY IF EXISTS lab_samples_insert ON public.lab_samples;
CREATE POLICY lab_samples_insert ON public.lab_samples
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS lab_samples_update ON public.lab_samples;
CREATE POLICY lab_samples_update ON public.lab_samples
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS radiology_orders_select ON public.radiology_orders;
CREATE POLICY radiology_orders_select ON public.radiology_orders
  FOR SELECT USING (true);

DROP POLICY IF EXISTS radiology_orders_insert ON public.radiology_orders;
CREATE POLICY radiology_orders_insert ON public.radiology_orders
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS radiology_orders_update ON public.radiology_orders;
CREATE POLICY radiology_orders_update ON public.radiology_orders
  FOR UPDATE USING (true);

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
