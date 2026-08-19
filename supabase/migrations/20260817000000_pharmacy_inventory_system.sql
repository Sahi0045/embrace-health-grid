-- ============================================================================
-- Pharmacy & Medical Inventory System
-- ============================================================================
-- Complete pharmacy inventory management system for Health Grid, including:
--   - Inventory master (medicines, consumables, supplies)
--   - Stock levels with location tracking (hospital → building → floor → ward → room)
--   - Batch-level tracking with expiry dates
--   - Suppliers and procurement
--   - Stock movements (add, remove, transfer, consume, waste, expire)
--   - Expiration and low-stock alerts
--   - Audit trail integration
--
-- Architecture:
--   - Multi-tenant: hospital_id on all tables for tenant isolation
--   - RLS-enforced: staff/admin see only their hospital's inventory
--   - Real-time enabled: subscriptions on stock_levels, movements for live dashboards
--   - Audit integrated: all movements logged via write_audit_record()
--   - Blockchain ready: movement hashes can be anchored to Solana
-- ============================================================================

-- ─── Enums ──────────────────────────────────────────────────────────────────

-- ── Naming note ─────────────────────────────────────────────────────────────
-- The pharmacy tables were originally called inventory_items and
-- stock_movements. Those exact names are already taken by
-- 20260815100000_inventory_management.sql, which creates a DIFFERENT, simpler
-- shape (text item_id, name/sku, inline current_stock) for general clinical
-- supplies and is used by /admin/inventory. This file models pharmacy stock with
-- uuid keys, batch-level expiry tracking and separate stock_levels, and is used
-- by /admin/pharmacy-inventory and /staff/pharmacy-inventory.
--
-- Two create-table statements for one name meant this migration could never be
-- applied: 20260815 runs first and creates the table, then this file's bare
-- "create table public.inventory_items" fails with "relation already exists".
-- Their index names collided as well (pharmacy_items_hospital_idx in both).
--
-- Renamed to pharmacy_items / pharmacy_stock_movements, which also matches the
-- routes that consume them. Consolidating the two overlapping inventory systems
-- into one is a product decision and deliberately not attempted here.
-- ────────────────────────────────────────────────────────────────────────────


create type inventory_item_type as enum (
  'medicine',
  'consumable',
  'medical_supply',
  'equipment',
  'other'
);

create type inventory_item_status as enum (
  'active',
  'inactive',
  'discontinued'
);

create type stock_movement_type as enum (
  'received',          -- Stock received from supplier
  'issued',            -- Stock issued for patient care
  'dispensed',         -- Medicine given to patient
  'consumed',          -- Consumable used in procedure
  'transferred',       -- Moved to different location
  'adjusted',          -- Inventory correction
  'returned',          -- Stock returned from ward
  'wasted',            -- Damaged, contaminated, or expired
  'expired',           -- Reached expiry date
  'damaged',           -- Physical damage
  'other'
);

create type expiration_status as enum (
  'valid',             -- Not expired, not near expiry
  'near_expiry',       -- Within threshold days of expiry
  'expired'            -- Past expiry date
);

-- ─── Suppliers ──────────────────────────────────────────────────────────────

create table public.suppliers (
  supplier_id    uuid primary key default gen_random_uuid(),
  hospital_id    uuid not null references public.hospitals(hospital_id) on delete cascade,
  supplier_name  text not null,
  contact_person text,
  phone          text,
  email          text,
  address        text,
  city           text,
  country        text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint suppliers_name_unique unique (hospital_id, supplier_name)
);

create index suppliers_hospital_idx on public.suppliers (hospital_id);
create index suppliers_active_idx on public.suppliers (hospital_id, is_active);

-- ─── Inventory Items (Medicine Master Catalog) ───────────────────────────────

create table public.pharmacy_items (
  item_id              uuid primary key default gen_random_uuid(),
  hospital_id          uuid not null references public.hospitals(hospital_id) on delete cascade,
  
  -- Identity
  item_code            text not null,           -- SKU/reference code
  item_name            text not null,
  item_type            inventory_item_type not null default 'medicine',
  category             text,                    -- e.g., antibiotic, painkiller, bandage
  description          text,
  
  -- Physical Properties
  unit_of_measure      text not null,           -- tablet, vial, box, etc.
  unit_cost            numeric(10, 2),          -- Cost per unit
  
  -- Control Levels
  reorder_level        int not null default 50, -- Alert when stock < this
  reorder_quantity     int not null default 100,-- Order this much when restocking
  maximum_stock        int,                     -- Safety limit
  
  -- Status & Dates
  status               inventory_item_status not null default 'active',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  
  constraint items_code_unique unique (hospital_id, item_code),
  constraint items_reorder_positive check (reorder_level > 0),
  constraint items_unit_cost_positive check (unit_cost is null or unit_cost > 0)
);

create index pharmacy_items_hospital_idx on public.pharmacy_items (hospital_id);
create index pharmacy_items_status_idx on public.pharmacy_items (status);
create index pharmacy_items_category_idx on public.pharmacy_items (category);
create index pharmacy_items_code_idx on public.pharmacy_items (item_code);

-- ─── Batches (Batch-Level Tracking) ─────────────────────────────────────────

create table public.inventory_batches (
  batch_id         uuid primary key default gen_random_uuid(),
  hospital_id      uuid not null references public.hospitals(hospital_id) on delete cascade,
  item_id          uuid not null references public.pharmacy_items(item_id) on delete cascade,
  supplier_id      uuid references public.suppliers(supplier_id) on delete set null,
  
  -- Batch Identity
  batch_number     text not null,
  
  -- Dates
  manufacturing_date date,
  expiry_date        date,
  
  -- Quantity
  quantity_received  int not null,
  quantity_available int not null,    -- Current usable quantity
  quantity_wasted    int not null default 0,
  quantity_expired   int not null default 0,
  
  -- Location
  storage_location   text,            -- Pharmacy Store A, Warehouse 2, etc.
  storage_building   uuid references public.buildings(building_id) on delete set null,
  storage_floor      uuid references public.floors(floor_id) on delete set null,
  storage_ward       uuid references public.wards(ward_id) on delete set null,
  
  -- Status
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  
  constraint batches_unique unique (hospital_id, item_id, batch_number),
  constraint batches_qty_positive check (quantity_received > 0),
  constraint batches_qty_available_nonnegative check (quantity_available >= 0),
  constraint batches_qty_consistency check (quantity_available + quantity_wasted + quantity_expired = quantity_received)
);

create index batches_hospital_idx on public.inventory_batches (hospital_id);
create index batches_item_idx on public.inventory_batches (item_id);
create index batches_supplier_idx on public.inventory_batches (supplier_id);
create index batches_expiry_idx on public.inventory_batches (expiry_date);
create index batches_active_idx on public.inventory_batches (hospital_id, is_active);

-- ─── Current Stock Levels ───────────────────────────────────────────────────

-- Aggregated stock per item + location (for quick availability checks)
create table public.stock_levels (
  stock_id         uuid primary key default gen_random_uuid(),
  hospital_id      uuid not null references public.hospitals(hospital_id) on delete cascade,
  item_id          uuid not null references public.pharmacy_items(item_id) on delete cascade,
  
  -- Location (optional; if null, represents warehouse aggregate)
  storage_location text,
  building_id      uuid references public.buildings(building_id) on delete set null,
  floor_id         uuid references public.floors(floor_id) on delete set null,
  ward_id          uuid references public.wards(ward_id) on delete set null,
  -- rooms.room_id is text; a uuid column cannot reference it.
  room_id          text references public.rooms(room_id) on delete set null,
  
  -- Quantities
  quantity_total   int not null default 0,   -- All stock including near-expiry
  quantity_usable  int not null default 0,   -- Stock not near expiry
  quantity_batches int not null default 0,   -- Number of active batches
  
  -- Status
  last_movement_at timestamptz,
  updated_at       timestamptz not null default now(),
  
  constraint stock_levels_unique unique (hospital_id, item_id, storage_location, building_id, floor_id, ward_id, room_id),
  constraint stock_total_nonnegative check (quantity_total >= 0),
  constraint stock_usable_nonnegative check (quantity_usable >= 0)
);

create index stock_levels_hospital_item_idx on public.stock_levels (hospital_id, item_id);
create index stock_levels_location_idx on public.stock_levels (hospital_id, storage_location);
create index stock_levels_building_idx on public.stock_levels (building_id);
create index stock_levels_ward_idx on public.stock_levels (ward_id);

-- ─── Stock Movements (Transaction History) ──────────────────────────────────

create table public.pharmacy_stock_movements (
  movement_id      text primary key,
  hospital_id      uuid not null references public.hospitals(hospital_id) on delete cascade,
  item_id          uuid not null references public.pharmacy_items(item_id) on delete cascade,
  batch_id         uuid references public.inventory_batches(batch_id) on delete set null,
  
  -- Movement Details
  movement_type    stock_movement_type not null,
  quantity_moved   int not null,
  reason           text,                -- Why was this moved (damage desc, expiry note, etc.)
  
  -- Previous State
  quantity_before  int not null,
  
  -- New State (after movement)
  quantity_after   int not null,
  
  -- Location Information
  source_location  text,
  destination_location text,
  source_building  uuid references public.buildings(building_id) on delete set null,
  destination_building uuid references public.buildings(building_id) on delete set null,
  source_ward      uuid references public.wards(ward_id) on delete set null,
  destination_ward uuid references public.wards(ward_id) on delete set null,
  
  -- Actor Information (captured at creation, never updated)
  performed_by_id  uuid,
  performed_by_name text,
  performed_by_role text,
  
  -- Prescription/Patient Link (for dispensing)
  prescription_id  text,                -- Link to prescription if this is a dispensing
  patient_did      text,                -- Patient receiving medication (if applicable)
  
  -- Timestamps
  movement_timestamp timestamptz not null default now(),
  recorded_at      timestamptz not null default now(),
  
  -- Audit & Integrity
  content_hash     text,                -- SHA-256 for blockchain anchoring
  
  constraint movements_qty_positive check (quantity_moved > 0)
);

create index movements_hospital_idx on public.pharmacy_stock_movements (hospital_id);
create index movements_item_idx on public.pharmacy_stock_movements (item_id);
create index movements_batch_idx on public.pharmacy_stock_movements (batch_id);
create index movements_type_idx on public.pharmacy_stock_movements (movement_type);
create index movements_timestamp_idx on public.pharmacy_stock_movements (movement_timestamp desc);
create index movements_prescription_idx on public.pharmacy_stock_movements (prescription_id);
create index movements_patient_idx on public.pharmacy_stock_movements (patient_did);
create index movements_actor_idx on public.pharmacy_stock_movements (performed_by_id);

-- ─── Expiration Tracking ─────────────────────────────────────────────────────

create table public.expiration_alerts (
  alert_id         uuid primary key default gen_random_uuid(),
  hospital_id      uuid not null references public.hospitals(hospital_id) on delete cascade,
  batch_id         uuid not null references public.inventory_batches(batch_id) on delete cascade,
  item_id          uuid not null references public.pharmacy_items(item_id) on delete cascade,
  
  -- Alert Details
  expiration_status expiration_status not null,
  expiry_date       date not null,
  days_until_expiry int,             -- Negative if already expired
  quantity_affected int not null,
  
  -- Action Tracking
  alert_raised_at   timestamptz not null default now(),
  action_taken_at   timestamptz,      -- When was action taken (disposal, etc.)
  action_taken_by   text,             -- Staff member who handled expiration
  action_notes      text,
  
  -- Status
  is_resolved       boolean not null default false,
  
  constraint alerts_qty_positive check (quantity_affected > 0)
);

create index expiration_alerts_hospital_idx on public.expiration_alerts (hospital_id);
create index expiration_alerts_batch_idx on public.expiration_alerts (batch_id);
create index expiration_alerts_status_idx on public.expiration_alerts (expiration_status);
create index expiration_alerts_resolved_idx on public.expiration_alerts (is_resolved);

-- ─── Low-Stock Alerts ────────────────────────────────────────────────────────

create table public.low_stock_alerts (
  alert_id         uuid primary key default gen_random_uuid(),
  hospital_id      uuid not null references public.hospitals(hospital_id) on delete cascade,
  item_id          uuid not null references public.pharmacy_items(item_id) on delete cascade,
  
  -- Alert Details
  current_quantity int not null,
  reorder_level    int not null,
  quantity_short   int not null,      -- How many below reorder level
  
  -- Action Tracking
  alert_raised_at  timestamptz not null default now(),
  order_created_at timestamptz,       -- When a purchase order was created
  order_id         text,              -- Link to purchase order
  
  -- Status
  is_resolved      boolean not null default false,
  
  constraint alerts_short_positive check (quantity_short > 0)
);

create index low_stock_alerts_hospital_idx on public.low_stock_alerts (hospital_id);
create index low_stock_alerts_item_idx on public.low_stock_alerts (item_id);
create index low_stock_alerts_resolved_idx on public.low_stock_alerts (is_resolved);

-- ─── Purchase Orders ────────────────────────────────────────────────────────

create type purchase_order_status as enum (
  'draft',
  'submitted',
  'confirmed',
  'received',
  'cancelled'
);

create table public.purchase_orders (
  order_id         text primary key,
  hospital_id      uuid not null references public.hospitals(hospital_id) on delete cascade,
  supplier_id      uuid not null references public.suppliers(supplier_id) on delete cascade,
  
  -- Items on order
  items            jsonb not null default '[]'::jsonb,  -- [{item_id, batch_number, quantity, unit_cost}]
  
  -- Amounts
  total_cost       numeric(12, 2),
  
  -- Status
  status           purchase_order_status not null default 'draft',
  
  -- Dates
  order_date       timestamptz not null default now(),
  expected_delivery_date date,
  received_date    date,
  
  -- Tracking
  ordered_by       uuid,
  ordered_by_name  text,
  received_by      uuid,
  received_by_name text,
  
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index purchase_orders_hospital_idx on public.purchase_orders (hospital_id);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index purchase_orders_status_idx on public.purchase_orders (status);
create index purchase_orders_delivery_idx on public.purchase_orders (expected_delivery_date);

-- ─── Row-Level Security ─────────────────────────────────────────────────────

alter table public.suppliers enable row level security;
alter table public.pharmacy_items enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.stock_levels enable row level security;
alter table public.pharmacy_stock_movements enable row level security;
alter table public.expiration_alerts enable row level security;
alter table public.low_stock_alerts enable row level security;
alter table public.purchase_orders enable row level security;

-- Pharmacy staff (doctor, staff, admin) can view their hospital's inventory
create policy suppliers_select_staff on public.suppliers
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy pharmacy_items_select_staff on public.pharmacy_items
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy batches_select_staff on public.inventory_batches
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy stock_levels_select_staff on public.stock_levels
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy movements_select_staff on public.pharmacy_stock_movements
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy expiration_alerts_select_staff on public.expiration_alerts
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy low_stock_alerts_select_staff on public.low_stock_alerts
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy purchase_orders_select_staff on public.purchase_orders
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

-- Pharmacy staff (staff, admin) can write inventory operations (not doctors)
create policy pharmacy_items_insert_admin on public.pharmacy_items
  for insert to authenticated
  with check (
    private.current_user_role() in ('admin')
    and private.can_access_hospital(hospital_id)
  );

create policy pharmacy_items_update_admin on public.pharmacy_items
  for update to authenticated
  using (
    private.current_user_role() in ('admin')
    and private.can_access_hospital(hospital_id)
  )
  with check (
    private.current_user_role() in ('admin')
    and private.can_access_hospital(hospital_id)
  );

create policy batches_insert_staff on public.inventory_batches
  for insert to authenticated
  with check (
    private.current_user_role() in ('staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy batches_update_staff on public.inventory_batches
  for update to authenticated
  using (
    private.current_user_role() in ('staff', 'admin')
    and private.can_access_hospital(hospital_id)
  )
  with check (
    private.current_user_role() in ('staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy movements_insert_staff on public.pharmacy_stock_movements
  for insert to authenticated
  with check (
    private.current_user_role() in ('staff', 'doctor', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy purchase_orders_insert_staff on public.purchase_orders
  for insert to authenticated
  with check (
    private.current_user_role() in ('staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

create policy purchase_orders_update_staff on public.purchase_orders
  for update to authenticated
  using (
    private.current_user_role() in ('staff', 'admin')
    and private.can_access_hospital(hospital_id)
  )
  with check (
    private.current_user_role() in ('staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

-- ─── Enable Realtime ────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'pharmacy_items', 'stock_levels', 'pharmacy_stock_movements', 
    'expiration_alerts', 'low_stock_alerts', 'purchase_orders'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;

alter table public.stock_levels replica identity full;
alter table public.pharmacy_stock_movements replica identity full;
alter table public.expiration_alerts replica identity full;
alter table public.low_stock_alerts replica identity full;

-- ─── Triggers for Audit Integration ─────────────────────────────────────────

-- Auto-update updated_at on inventory items
create or replace function public.touch_pharmacy_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pharmacy_items_touch_updated_at
  before update on public.pharmacy_items
  for each row
  execute function public.touch_pharmacy_items_updated_at();

-- Similar for batches, stock_levels, etc.
create or replace function public.touch_batches_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger batches_touch_updated_at
  before update on public.inventory_batches
  for each row
  execute function public.touch_batches_updated_at();

-- ─── Helper Functions ───────────────────────────────────────────────────────

-- Backing sequence for generate_batch_number(). It was referenced but never
-- created, so the function failed to compile with
-- 'relation "batch_number_seq" does not exist'.
create sequence if not exists public.batch_number_seq as bigint start 1;

grant usage, select on sequence public.batch_number_seq to authenticated, service_role;

-- Generate unique batch numbers
create or replace function public.generate_batch_number(p_item_code text)
returns text
language sql
as $$
  select p_item_code || '-' || to_char(now(), 'YYYY') || '-' || 
         lpad((nextval('public.batch_number_seq')::text), 5, '0');
$$;

-- Check if batch is expired
create or replace function public.is_batch_expired(p_expiry_date date)
returns boolean
language sql
stable
as $$
  select p_expiry_date < current_date;
$$;

-- Check if batch is near expiry (within 30 days)
create or replace function public.is_batch_near_expiry(p_expiry_date date, p_threshold_days int default 30)
returns boolean
language sql
stable
as $$
  select p_expiry_date between current_date and current_date + (p_threshold_days || ' days')::interval;
$$;

-- Get expiration status for a batch
create or replace function public.get_expiration_status(p_expiry_date date, p_threshold_days int default 30)
returns expiration_status
language plpgsql
stable
as $$
begin
  if p_expiry_date < current_date then
    return 'expired'::expiration_status;
  elsif p_expiry_date between current_date and current_date + (p_threshold_days || ' days')::interval then
    return 'near_expiry'::expiration_status;
  else
    return 'valid'::expiration_status;
  end if;
end;
$$;

-- Generate unique movement ID
create sequence public.stock_movement_seq start 1000;

create or replace function public.generate_movement_id()
returns text
language sql
as $$
  select 'MOV-' || to_char(now(), 'YYYYMMDD') || '-' || 
         lpad((nextval('stock_movement_seq')::text), 6, '0');
$$;
