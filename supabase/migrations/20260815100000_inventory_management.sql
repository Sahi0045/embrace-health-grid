-- ============================================================================
-- Inventory & Stock Management — Embrace Health Grid
-- ============================================================================
-- Implements complete clinical supply chain & hospital stock governance:
--   - inventory_categories: standardized supply domains
--   - inventory_items: items with current, reserved, available stock & expiry
--   - stock_movements: immutable audit ledger of IN/OUT/ADJUSTMENT transactions
--   - inventory_alerts: live operational notifications (low-stock, near-expiry, critical)
-- ============================================================================

-- ─── 1. Inventory Categories Table ──────────────────────────────────────────
create table if not exists public.inventory_categories (
  category_id text primary key,
  name        text not null,
  description text,
  color_code  text not null default '#3b82f6',
  created_at  timestamptz not null default now()
);

-- ─── 2. Inventory Items Table ───────────────────────────────────────────────
create table if not exists public.inventory_items (
  item_id          text primary key,
  hospital_id      uuid references public.hospitals(hospital_id) on delete cascade,
  name             text not null,
  sku              text not null,
  category_id      text not null references public.inventory_categories(category_id) on delete restrict,
  current_stock    int not null default 0 check (current_stock >= 0),
  reserved_stock   int not null default 0 check (reserved_stock >= 0),
  unit             text not null default 'units',
  reorder_level    int not null default 10,
  reorder_qty      int not null default 50,
  unit_cost        numeric(10,2) not null default 0.00,
  expiry_date      date,
  storage_location text,
  supplier         text,
  status           text not null default 'normal'
                   check (status in ('normal', 'low_stock', 'critical', 'expired')),
  last_movement_at timestamptz default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists inventory_items_hospital_idx on public.inventory_items (hospital_id);
create index if not exists inventory_items_category_idx on public.inventory_items (category_id);
create index if not exists inventory_items_status_idx   on public.inventory_items (status);
create index if not exists inventory_items_expiry_idx   on public.inventory_items (expiry_date);

-- ─── 3. Stock Movements Table (Audit Ledger) ─────────────────────────────────
create table if not exists public.stock_movements (
  movement_id       uuid primary key default gen_random_uuid(),
  item_id           text not null references public.inventory_items(item_id) on delete cascade,
  hospital_id       uuid references public.hospitals(hospital_id) on delete cascade,
  movement_type     text not null check (movement_type in ('IN', 'OUT', 'ADJUSTMENT', 'RESERVATION', 'RELEASE')),
  quantity          int not null,
  previous_stock    int not null,
  new_stock         int not null,
  reason            text,
  performed_by      uuid references auth.users(id) on delete set null,
  performed_by_name text,
  recorded_at       timestamptz not null default now()
);

create index if not exists stock_movements_item_idx     on public.stock_movements (item_id, recorded_at desc);
create index if not exists stock_movements_hospital_idx on public.stock_movements (hospital_id);

-- ─── 4. Inventory Alerts Table ──────────────────────────────────────────────
create table if not exists public.inventory_alerts (
  alert_id          uuid primary key default gen_random_uuid(),
  item_id           text not null references public.inventory_items(item_id) on delete cascade,
  hospital_id       uuid references public.hospitals(hospital_id) on delete cascade,
  alert_type        text not null check (alert_type in ('low_stock', 'critical', 'near_expiry', 'expired')),
  severity          text not null check (severity in ('warning', 'critical')),
  message           text not null,
  current_level     int,
  threshold         int,
  acknowledged      boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists inventory_alerts_item_idx     on public.inventory_alerts (item_id);
create index if not exists inventory_alerts_hospital_idx on public.inventory_alerts (hospital_id);
create index if not exists inventory_alerts_ack_idx      on public.inventory_alerts (acknowledged, created_at desc);

-- ─── 5. Row Level Security ──────────────────────────────────────────────────
alter table public.inventory_categories enable row level security;
alter table public.inventory_items      enable row level security;
alter table public.stock_movements      enable row level security;
alter table public.inventory_alerts     enable row level security;

-- Categories: readable by any authenticated user
create policy inventory_categories_select on public.inventory_categories
  for select to authenticated
  using (true);

-- Items: staff & admin of the hospital can read
create policy inventory_items_select on public.inventory_items
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin', 'super_admin')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  );

create policy inventory_items_write on public.inventory_items
  for all to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin', 'staff')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  )
  with check (
    private.current_user_role() in ('admin', 'super_admin', 'staff')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  );

-- Movements: staff & admin can read, admin & staff can insert
create policy stock_movements_select on public.stock_movements
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin', 'super_admin')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  );

create policy stock_movements_insert on public.stock_movements
  for insert to authenticated
  with check (
    private.current_user_role() in ('admin', 'super_admin', 'staff')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  );

-- Alerts: staff & admin can read, admin can update/acknowledge
create policy inventory_alerts_select on public.inventory_alerts
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin', 'super_admin')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  );

create policy inventory_alerts_update on public.inventory_alerts
  for update to authenticated
  using (
    private.current_user_role() in ('admin', 'super_admin', 'staff')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  );

-- ─── 6. Realtime Publication ─────────────────────────────────────────────────
alter publication supabase_realtime add table public.inventory_categories;
alter publication supabase_realtime add table public.inventory_items;
alter publication supabase_realtime add table public.stock_movements;
alter publication supabase_realtime add table public.inventory_alerts;

alter table public.inventory_items  replica identity full;
alter table public.stock_movements  replica identity full;
alter table public.inventory_alerts replica identity full;

-- ─── 7. Seed Initial Categories and Stock Data ───────────────────────────────
do $$
declare
  seed_hospital uuid;
begin
  select hospital_id into seed_hospital
  from public.hospitals
  where status = 'active'
  order by created_at asc
  limit 1;

  -- 1. Insert Categories
  insert into public.inventory_categories (category_id, name, description, color_code)
  values
    ('medications', 'Medications & Drugs', 'Pharmaceuticals, IV infusions, injectables and oral medications', '#3b82f6'),
    ('medical_devices', 'Medical Devices', 'Diagnostic instruments, monitors, pumps and telemetry hardware', '#8b5cf6'),
    ('ppe', 'PPE & Infection Control', 'Gloves, masks, gowns, shields, and biohazard protection supplies', '#10b981'),
    ('surgical_supplies', 'Surgical Supplies', 'Sterile drapes, sutures, blades, scalpels and OR consumables', '#f59e0b'),
    ('lab_reagents', 'Lab Reagents & Assays', 'Chemical diagnostic reagents, assay kits and specimen containers', '#ec4899'),
    ('office_supplies', 'Administrative & Office', 'Hospital admission charts, barcode labels and desk supplies', '#6b7280'),
    ('cleaning_products', 'Sanitation & Disinfection', 'Hospital-grade disinfectants, sterilizing solutions and biocides', '#06b6d4')
  on conflict (category_id) do nothing;

  -- 2. Insert Inventory Items
  if seed_hospital is not null then
    insert into public.inventory_items (
      item_id, hospital_id, name, sku, category_id,
      current_stock, reserved_stock, unit, reorder_level, reorder_qty,
      unit_cost, expiry_date, storage_location, supplier, status
    )
    values
      -- Medications
      ('INV-MED-001', seed_hospital, 'Paracetamol IV Infusion 1000mg/100ml', 'MED-PCM-1000', 'medications', 340, 45, 'vials', 80, 200, 4.50, '2027-11-30', 'Pharmacy Cold Storage B2', 'Fresenius Kabi', 'normal'),
      ('INV-MED-002', seed_hospital, 'Propofol 1% Injectable Emulsion 20ml', 'MED-PRO-0020', 'medications', 14, 10, 'vials', 30, 100, 18.20, '2026-09-02', 'OR Anesthesia Vault 01', 'AstraZeneca', 'critical'),
      ('INV-MED-003', seed_hospital, 'Ceftriaxone Sodium 1g Powder for Injection', 'MED-CEF-0001', 'medications', 65, 20, 'vials', 50, 150, 6.75, '2027-04-15', 'Central Pharmacy Shelf A4', 'Roche Pharma', 'normal'),
      ('INV-MED-004', seed_hospital, 'Normal Saline 0.9% 500ml IV Bags', 'MED-NSS-0500', 'medications', 520, 80, 'bags', 120, 400, 2.10, '2028-01-20', 'Central Warehouse Bay 1', 'Baxter Healthcare', 'normal'),
      ('INV-MED-005', seed_hospital, 'Epinephrine 1mg/ml (1:1000) Ampoules', 'MED-EPI-0001', 'medications', 18, 5, 'ampoules', 25, 60, 8.40, '2026-08-30', 'Emergency Crash Cart Rack 3', 'Pfizer Hospital', 'low_stock'),

      -- Medical Devices & Telemetry
      ('INV-DEV-001', seed_hospital, 'Adult Defibrillator Electrodes / Pads', 'DEV-DEF-PAD1', 'medical_devices', 22, 4, 'pairs', 20, 50, 45.00, '2026-08-28', 'ICU Equipment Room E1', 'Philips Healthcare', 'low_stock'),
      ('INV-DEV-002', seed_hospital, 'Disposable SpO2 Sensor Cables (Adult)', 'DEV-SPO-AD01', 'medical_devices', 95, 12, 'units', 30, 100, 14.50, '2028-06-15', 'Biomedical Depot Shelf 2', 'Masimo Corp', 'normal'),
      ('INV-DEV-003', seed_hospital, 'Continuous Syringe Infusion Pump Lines', 'DEV-PMP-SY01', 'medical_devices', 180, 25, 'sets', 50, 200, 7.80, '2027-10-10', 'Ward Storage C3', 'B. Braun Medical', 'normal'),

      -- PPE & Infection Control
      ('INV-PPE-001', seed_hospital, 'N95 Particulate Respirators (Box/20)', 'PPE-N95-BX20', 'ppe', 12, 5, 'boxes', 25, 80, 28.00, '2029-12-31', 'Infection Control Depot A1', '3M Healthcare', 'critical'),
      ('INV-PPE-002', seed_hospital, 'Nitrile Examination Gloves Size M (Box/100)', 'PPE-GLV-MD10', 'ppe', 280, 40, 'boxes', 60, 200, 9.50, '2028-08-18', 'Central Warehouse Bay 2', 'Ansell Healthcare', 'normal'),
      ('INV-PPE-003', seed_hospital, 'Sterile Isolation Gowns Level 3', 'PPE-GWN-LV03', 'ppe', 410, 60, 'units', 100, 300, 5.25, '2029-05-12', 'Central Warehouse Bay 2', 'Medline Industries', 'normal'),

      -- Surgical Supplies
      ('INV-SUR-001', seed_hospital, 'Sterile Surgical Scalpels #10 (Box/10)', 'SUR-SCP-BX10', 'surgical_supplies', 35, 8, 'boxes', 15, 50, 16.50, '2028-03-22', 'OR Sterile Core Rack 4', 'Swann-Morton', 'normal'),
      ('INV-SUR-002', seed_hospital, 'Vicryl 3-0 Absorbable Sutures (Box/36)', 'SUR-SUT-V300', 'surgical_supplies', 8, 2, 'boxes', 15, 40, 112.00, '2026-09-10', 'OR Sterile Core Rack 2', 'Ethicon / J&J', 'critical'),
      ('INV-SUR-003', seed_hospital, 'Lap Sponge Sterile 4-Ply 45x45cm (Pack/5)', 'SUR-SPG-4545', 'surgical_supplies', 140, 20, 'packs', 40, 120, 11.20, '2027-12-05', 'Central Sterile Supply Dept', 'Cardinal Health', 'normal'),

      -- Lab Reagents
      ('INV-LAB-001', seed_hospital, 'Troponin I High-Sensitivity Assay Kit', 'LAB-TRP-HS01', 'lab_reagents', 6, 2, 'kits', 10, 25, 340.00, '2026-08-25', 'Clinical Lab Fridge L2', 'Abbott Diagnostics', 'critical'),
      ('INV-LAB-002', seed_hospital, 'Blood Culture Bottles Aerobic/Anaerobic', 'LAB-BLD-CL01', 'lab_reagents', 110, 15, 'bottles', 30, 100, 12.00, '2027-02-28', 'Microbiology Lab Shelf 1', 'BD Diagnostics', 'normal'),

      -- Cleaning & Sanitation
      ('INV-CLN-001', seed_hospital, 'Hospital Surface Biocide Disinfectant 5L', 'CLN-BIO-005L', 'cleaning_products', 45, 6, 'bottles', 15, 50, 22.00, '2028-11-15', 'Housekeeping Depot G0', 'Ecolab Healthcare', 'normal'),
      ('INV-CLN-002', seed_hospital, 'Enzymatic Instrument Pre-Wash Cleaner 5L', 'CLN-ENZ-005L', 'cleaning_products', 18, 2, 'bottles', 10, 30, 48.00, '2027-07-20', 'CSSD Decontamination Bay', 'Steris Corp', 'normal')
    on conflict (item_id) do nothing;

    -- 3. Insert Initial Stock Movements for Tracking History
    insert into public.stock_movements (
      item_id, hospital_id, movement_type, quantity,
      previous_stock, new_stock, reason, performed_by_name, recorded_at
    )
    values
      ('INV-MED-001', seed_hospital, 'IN', 200, 140, 340, 'Monthly replenishment batch #FKB-9821', 'Lead Pharmacist Dr. Sarah Chen', now() - interval '2 days'),
      ('INV-MED-002', seed_hospital, 'OUT', 16, 30, 14, 'Dispatched to OR Suite 3 & 4 emergency craniotomy', 'Anesthesia Tech Marcus Vance', now() - interval '4 hours'),
      ('INV-PPE-001', seed_hospital, 'OUT', 18, 30, 12, 'Emergency isolation protocol ward transfer allocation', 'Nurse Supervisor Elena Rostova', now() - interval '8 hours'),
      ('INV-LAB-001', seed_hospital, 'OUT', 4, 10, 6, 'Cardiac emergency triage batch testing cycle', 'Senior Biochemist David Miller', now() - interval '1 day'),
      ('INV-SUR-002', seed_hospital, 'OUT', 7, 15, 8, 'Scheduled general surgery room supply transfer', 'OR Sterile Supply Lead Robert King', now() - interval '6 hours'),
      ('INV-DEV-001', seed_hospital, 'ADJUSTMENT', -3, 25, 22, 'Damaged package calibration disposal check', 'Biomed Inspector Jack Reynolds', now() - interval '18 hours')
    on conflict do nothing;

    -- 4. Insert Initial Inventory Alerts
    insert into public.inventory_alerts (
      item_id, hospital_id, alert_type, severity, message, current_level, threshold, acknowledged, created_at
    )
    values
      ('INV-MED-002', seed_hospital, 'critical', 'critical', 'Propofol 1% stock level is critical (14 vials remaining vs reorder threshold 30). Near expiry in 19 days.', 14, 30, false, now() - interval '3 hours'),
      ('INV-PPE-001', seed_hospital, 'low_stock', 'critical', 'N95 Respirators below minimum threshold (12 boxes remaining vs reorder threshold 25). Immediate replenishment requested.', 12, 25, false, now() - interval '6 hours'),
      ('INV-LAB-001', seed_hospital, 'near_expiry', 'critical', 'Troponin I Assay Kits expiring in 11 days (2026-08-25). 6 kits remaining in Lab Fridge L2.', 6, 10, false, now() - interval '12 hours'),
      ('INV-SUR-002', seed_hospital, 'low_stock', 'warning', 'Vicryl 3-0 Sutures at low stock (8 boxes remaining vs reorder threshold 15). Reorder PO pending.', 8, 15, false, now() - interval '1 day'),
      ('INV-DEV-001', seed_hospital, 'near_expiry', 'warning', 'Adult Defibrillator Electrodes expiring in 14 days (2026-08-28). Rotation or replacement required.', 22, 20, false, now() - interval '18 hours')
    on conflict do nothing;

  end if;
end $$;
