-- ============================================================================
-- PHARMACY & MEDICAL INVENTORY SYSTEM - SQL COMMANDS FOR SUPABASE
-- ============================================================================
-- All SQL commands to create 8 new tables for pharmacy inventory management
-- 
-- Tables Created:
--   1. suppliers
--   2. inventory_items
--   3. inventory_batches
--   4. stock_levels
--   5. stock_movements
--   6. expiration_alerts
--   7. low_stock_alerts
--   8. purchase_orders
--
-- Usage:
--   1. Copy all commands below
--   2. Go to Supabase Dashboard → SQL Editor
--   3. Paste and execute
--   OR
--   4. Run: supabase db push
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. CREATE ENUMS
-- ─────────────────────────────────────────────────────────────────────────

CREATE TYPE inventory_item_type AS ENUM (
  'medicine',
  'consumable',
  'medical_supply',
  'equipment',
  'other'
);

CREATE TYPE inventory_item_status AS ENUM (
  'active',
  'inactive',
  'discontinued'
);

CREATE TYPE stock_movement_type AS ENUM (
  'received',
  'issued',
  'dispensed',
  'consumed',
  'transferred',
  'adjusted',
  'returned',
  'wasted',
  'expired',
  'damaged',
  'other'
);

CREATE TYPE expiration_status AS ENUM (
  'valid',
  'near_expiry',
  'expired'
);

CREATE TYPE purchase_order_status AS ENUM (
  'draft',
  'submitted',
  'confirmed',
  'received',
  'cancelled'
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. CREATE TABLE: suppliers
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.suppliers (
  supplier_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id    UUID NOT NULL REFERENCES public.hospitals(hospital_id) ON DELETE CASCADE,
  supplier_name  TEXT NOT NULL,
  contact_person TEXT,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  city           TEXT,
  country        TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT suppliers_name_unique UNIQUE (hospital_id, supplier_name)
);

CREATE INDEX suppliers_hospital_idx ON public.suppliers (hospital_id);
CREATE INDEX suppliers_active_idx ON public.suppliers (hospital_id, is_active);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. CREATE TABLE: inventory_items
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.inventory_items (
  item_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id          UUID NOT NULL REFERENCES public.hospitals(hospital_id) ON DELETE CASCADE,
  item_code            TEXT NOT NULL,
  item_name            TEXT NOT NULL,
  item_type            inventory_item_type NOT NULL DEFAULT 'medicine',
  category             TEXT,
  description          TEXT,
  unit_of_measure      TEXT NOT NULL,
  unit_cost            NUMERIC(10, 2),
  reorder_level        INT NOT NULL DEFAULT 50,
  reorder_quantity     INT NOT NULL DEFAULT 100,
  maximum_stock        INT,
  status               inventory_item_status NOT NULL DEFAULT 'active',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT items_code_unique UNIQUE (hospital_id, item_code),
  CONSTRAINT items_reorder_positive CHECK (reorder_level > 0),
  CONSTRAINT items_unit_cost_positive CHECK (unit_cost IS NULL OR unit_cost > 0)
);

CREATE INDEX inventory_items_hospital_idx ON public.inventory_items (hospital_id);
CREATE INDEX inventory_items_status_idx ON public.inventory_items (status);
CREATE INDEX inventory_items_category_idx ON public.inventory_items (category);
CREATE INDEX inventory_items_code_idx ON public.inventory_items (item_code);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. CREATE TABLE: inventory_batches
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.inventory_batches (
  batch_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id        UUID NOT NULL REFERENCES public.hospitals(hospital_id) ON DELETE CASCADE,
  item_id            UUID NOT NULL REFERENCES public.inventory_items(item_id) ON DELETE CASCADE,
  supplier_id        UUID REFERENCES public.suppliers(supplier_id) ON DELETE SET NULL,
  batch_number       TEXT NOT NULL,
  manufacturing_date DATE,
  expiry_date        DATE,
  quantity_received  INT NOT NULL,
  quantity_available INT NOT NULL,
  quantity_wasted    INT NOT NULL DEFAULT 0,
  quantity_expired   INT NOT NULL DEFAULT 0,
  storage_location   TEXT,
  storage_building   UUID REFERENCES public.buildings(building_id) ON DELETE SET NULL,
  storage_floor      UUID REFERENCES public.floors(floor_id) ON DELETE SET NULL,
  storage_ward       UUID REFERENCES public.wards(ward_id) ON DELETE SET NULL,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT batches_unique UNIQUE (hospital_id, item_id, batch_number),
  CONSTRAINT batches_qty_positive CHECK (quantity_received > 0),
  CONSTRAINT batches_qty_available_nonnegative CHECK (quantity_available >= 0),
  CONSTRAINT batches_qty_consistency CHECK (quantity_available + quantity_wasted + quantity_expired = quantity_received)
);

CREATE INDEX batches_hospital_idx ON public.inventory_batches (hospital_id);
CREATE INDEX batches_item_idx ON public.inventory_batches (item_id);
CREATE INDEX batches_supplier_idx ON public.inventory_batches (supplier_id);
CREATE INDEX batches_expiry_idx ON public.inventory_batches (expiry_date);
CREATE INDEX batches_active_idx ON public.inventory_batches (hospital_id, is_active);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. CREATE TABLE: stock_levels
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.stock_levels (
  stock_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id      UUID NOT NULL REFERENCES public.hospitals(hospital_id) ON DELETE CASCADE,
  item_id          UUID NOT NULL REFERENCES public.inventory_items(item_id) ON DELETE CASCADE,
  storage_location TEXT,
  building_id      UUID REFERENCES public.buildings(building_id) ON DELETE SET NULL,
  floor_id         UUID REFERENCES public.floors(floor_id) ON DELETE SET NULL,
  ward_id          UUID REFERENCES public.wards(ward_id) ON DELETE SET NULL,
  room_id          UUID REFERENCES public.rooms(room_id) ON DELETE SET NULL,
  quantity_total   INT NOT NULL DEFAULT 0,
  quantity_usable  INT NOT NULL DEFAULT 0,
  quantity_batches INT NOT NULL DEFAULT 0,
  last_movement_at TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT stock_levels_unique UNIQUE (hospital_id, item_id, storage_location, building_id, floor_id, ward_id, room_id),
  CONSTRAINT stock_total_nonnegative CHECK (quantity_total >= 0),
  CONSTRAINT stock_usable_nonnegative CHECK (quantity_usable >= 0)
);

CREATE INDEX stock_levels_hospital_item_idx ON public.stock_levels (hospital_id, item_id);
CREATE INDEX stock_levels_location_idx ON public.stock_levels (hospital_id, storage_location);
CREATE INDEX stock_levels_building_idx ON public.stock_levels (building_id);
CREATE INDEX stock_levels_ward_idx ON public.stock_levels (ward_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. CREATE TABLE: stock_movements (IMMUTABLE AUDIT LOG)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.stock_movements (
  movement_id           TEXT PRIMARY KEY,
  hospital_id           UUID NOT NULL REFERENCES public.hospitals(hospital_id) ON DELETE CASCADE,
  item_id               UUID NOT NULL REFERENCES public.inventory_items(item_id) ON DELETE CASCADE,
  batch_id              UUID REFERENCES public.inventory_batches(batch_id) ON DELETE SET NULL,
  movement_type         stock_movement_type NOT NULL,
  quantity_moved        INT NOT NULL,
  reason                TEXT,
  quantity_before       INT NOT NULL,
  quantity_after        INT NOT NULL,
  source_location       TEXT,
  destination_location  TEXT,
  source_building       UUID REFERENCES public.buildings(building_id) ON DELETE SET NULL,
  destination_building  UUID REFERENCES public.buildings(building_id) ON DELETE SET NULL,
  source_ward           UUID REFERENCES public.wards(ward_id) ON DELETE SET NULL,
  destination_ward      UUID REFERENCES public.wards(ward_id) ON DELETE SET NULL,
  performed_by_id       UUID,
  performed_by_name     TEXT,
  performed_by_role     TEXT,
  prescription_id       TEXT,
  patient_did           TEXT,
  movement_timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content_hash          TEXT,

  CONSTRAINT movements_qty_positive CHECK (quantity_moved > 0)
);

CREATE INDEX movements_hospital_idx ON public.stock_movements (hospital_id);
CREATE INDEX movements_item_idx ON public.stock_movements (item_id);
CREATE INDEX movements_batch_idx ON public.stock_movements (batch_id);
CREATE INDEX movements_type_idx ON public.stock_movements (movement_type);
CREATE INDEX movements_timestamp_idx ON public.stock_movements (movement_timestamp DESC);
CREATE INDEX movements_prescription_idx ON public.stock_movements (prescription_id);
CREATE INDEX movements_patient_idx ON public.stock_movements (patient_did);
CREATE INDEX movements_actor_idx ON public.stock_movements (performed_by_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 7. CREATE TABLE: expiration_alerts
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.expiration_alerts (
  alert_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id       UUID NOT NULL REFERENCES public.hospitals(hospital_id) ON DELETE CASCADE,
  batch_id          UUID NOT NULL REFERENCES public.inventory_batches(batch_id) ON DELETE CASCADE,
  item_id           UUID NOT NULL REFERENCES public.inventory_items(item_id) ON DELETE CASCADE,
  expiration_status expiration_status NOT NULL,
  expiry_date       DATE NOT NULL,
  days_until_expiry INT,
  quantity_affected INT NOT NULL,
  alert_raised_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action_taken_at   TIMESTAMPTZ,
  action_taken_by   TEXT,
  action_notes      TEXT,
  is_resolved       BOOLEAN NOT NULL DEFAULT FALSE,

  CONSTRAINT alerts_qty_positive CHECK (quantity_affected > 0)
);

CREATE INDEX expiration_alerts_hospital_idx ON public.expiration_alerts (hospital_id);
CREATE INDEX expiration_alerts_batch_idx ON public.expiration_alerts (batch_id);
CREATE INDEX expiration_alerts_status_idx ON public.expiration_alerts (expiration_status);
CREATE INDEX expiration_alerts_resolved_idx ON public.expiration_alerts (is_resolved);

-- ─────────────────────────────────────────────────────────────────────────
-- 8. CREATE TABLE: low_stock_alerts
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.low_stock_alerts (
  alert_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id      UUID NOT NULL REFERENCES public.hospitals(hospital_id) ON DELETE CASCADE,
  item_id          UUID NOT NULL REFERENCES public.inventory_items(item_id) ON DELETE CASCADE,
  current_quantity INT NOT NULL,
  reorder_level    INT NOT NULL,
  quantity_short   INT NOT NULL,
  alert_raised_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  order_created_at TIMESTAMPTZ,
  order_id         TEXT,
  is_resolved      BOOLEAN NOT NULL DEFAULT FALSE,

  CONSTRAINT alerts_short_positive CHECK (quantity_short > 0)
);

CREATE INDEX low_stock_alerts_hospital_idx ON public.low_stock_alerts (hospital_id);
CREATE INDEX low_stock_alerts_item_idx ON public.low_stock_alerts (item_id);
CREATE INDEX low_stock_alerts_resolved_idx ON public.low_stock_alerts (is_resolved);

-- ─────────────────────────────────────────────────────────────────────────
-- 9. CREATE TABLE: purchase_orders
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.purchase_orders (
  order_id               TEXT PRIMARY KEY,
  hospital_id            UUID NOT NULL REFERENCES public.hospitals(hospital_id) ON DELETE CASCADE,
  supplier_id            UUID NOT NULL REFERENCES public.suppliers(supplier_id) ON DELETE CASCADE,
  items                  JSONB NOT NULL DEFAULT '[]'::JSONB,
  total_cost             NUMERIC(12, 2),
  status                 purchase_order_status NOT NULL DEFAULT 'draft',
  order_date             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_delivery_date DATE,
  received_date          DATE,
  ordered_by             UUID,
  ordered_by_name        TEXT,
  received_by            UUID,
  received_by_name       TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX purchase_orders_hospital_idx ON public.purchase_orders (hospital_id);
CREATE INDEX purchase_orders_supplier_idx ON public.purchase_orders (supplier_id);
CREATE INDEX purchase_orders_status_idx ON public.purchase_orders (status);
CREATE INDEX purchase_orders_delivery_idx ON public.purchase_orders (expected_delivery_date);

-- ─────────────────────────────────────────────────────────────────────────
-- 10. ENABLE ROW-LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expiration_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.low_stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────
-- 11. CREATE RLS POLICIES (SELECT)
-- ─────────────────────────────────────────────────────────────────────────

CREATE POLICY suppliers_select_staff ON public.suppliers
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY inventory_items_select_staff ON public.inventory_items
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY batches_select_staff ON public.inventory_batches
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY stock_levels_select_staff ON public.stock_levels
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY movements_select_staff ON public.stock_movements
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY expiration_alerts_select_staff ON public.expiration_alerts
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY low_stock_alerts_select_staff ON public.low_stock_alerts
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY purchase_orders_select_staff ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (
    private.current_user_role() IN ('doctor', 'staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 12. CREATE RLS POLICIES (INSERT/UPDATE)
-- ─────────────────────────────────────────────────────────────────────────

CREATE POLICY inventory_items_insert_admin ON public.inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (
    private.current_user_role() IN ('admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY inventory_items_update_admin ON public.inventory_items
  FOR UPDATE TO authenticated
  USING (
    private.current_user_role() IN ('admin')
    AND private.can_access_hospital(hospital_id)
  )
  WITH CHECK (
    private.current_user_role() IN ('admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY batches_insert_staff ON public.inventory_batches
  FOR INSERT TO authenticated
  WITH CHECK (
    private.current_user_role() IN ('staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY batches_update_staff ON public.inventory_batches
  FOR UPDATE TO authenticated
  USING (
    private.current_user_role() IN ('staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  )
  WITH CHECK (
    private.current_user_role() IN ('staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY movements_insert_staff ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    private.current_user_role() IN ('staff', 'doctor', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY purchase_orders_insert_staff ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    private.current_user_role() IN ('staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

CREATE POLICY purchase_orders_update_staff ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (
    private.current_user_role() IN ('staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  )
  WITH CHECK (
    private.current_user_role() IN ('staff', 'admin')
    AND private.can_access_hospital(hospital_id)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 13. ENABLE REALTIME
-- ─────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.stock_levels;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.expiration_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.low_stock_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.purchase_orders;

ALTER TABLE public.stock_levels REPLICA IDENTITY FULL;
ALTER TABLE public.stock_movements REPLICA IDENTITY FULL;
ALTER TABLE public.expiration_alerts REPLICA IDENTITY FULL;
ALTER TABLE public.low_stock_alerts REPLICA IDENTITY FULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 14. CREATE HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────

CREATE SEQUENCE public.stock_movement_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_movement_id()
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT 'MOV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
         LPAD((NEXTVAL('stock_movement_seq')::TEXT), 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.is_batch_expired(p_expiry_date DATE)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT p_expiry_date < CURRENT_DATE;
$$;

CREATE OR REPLACE FUNCTION public.is_batch_near_expiry(p_expiry_date DATE, p_threshold_days INT DEFAULT 30)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT p_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_threshold_days || ' days')::INTERVAL;
$$;

CREATE OR REPLACE FUNCTION public.get_expiration_status(p_expiry_date DATE, p_threshold_days INT DEFAULT 30)
RETURNS expiration_status
LANGUAGE PLPGSQL
STABLE
AS $$
BEGIN
  IF p_expiry_date < CURRENT_DATE THEN
    RETURN 'expired'::expiration_status;
  ELSIF p_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_threshold_days || ' days')::INTERVAL THEN
    RETURN 'near_expiry'::expiration_status;
  ELSE
    RETURN 'valid'::expiration_status;
  END IF;
END;
$$;

-- ============================================================================
-- END OF SQL COMMANDS
-- ============================================================================
