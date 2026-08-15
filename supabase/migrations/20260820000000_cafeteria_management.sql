-- ============================================================================
-- Cafeteria, Kitchen Stock & Dietary Management — Embrace Health Grid
-- ============================================================================
-- Implements complete food service operations:
--   - cafeteria_menu_items: food & beverage catalog with dietary tags & calorie counts
--   - kitchen_stock: raw ingredients, kitchen provisions, expiry & supplier tracking
--   - dietary_requirements: patient-linked clinical dietary guidelines & meal plans
--   - meal_deliveries: patient ward/room meal delivery pipeline & dispatch queue
--   - cafeteria_vendors: food & ingredient suppliers, contract lifecycle & delivery tracking
--   - food_wastage_logs: daily wastage ledger, cost impact & reduction analytics
-- ============================================================================

-- ─── 1. Cafeteria Menu Items Table ──────────────────────────────────────────
create table if not exists public.cafeteria_menu_items (
  menu_item_id   text primary key default ('menu-' || gen_random_uuid()::text),
  hospital_id    uuid references public.hospitals(hospital_id) on delete cascade,
  name           text not null,
  category       text not null check (category in ('breakfast', 'lunch', 'dinner', 'snack', 'beverage')),
  dietary_tags   text[] not null default '{}',
  available_for  text not null default 'both' check (available_for in ('patient', 'staff', 'both')),
  price          numeric(10,2) not null default 0.00,
  calories       int not null default 0,
  status         text not null default 'active' check (status in ('active', 'inactive', 'sold_out')),
  description    text,
  allergens      text[] not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists cafeteria_menu_items_hospital_idx on public.cafeteria_menu_items (hospital_id);
create index if not exists cafeteria_menu_items_category_idx on public.cafeteria_menu_items (category);
create index if not exists cafeteria_menu_items_status_idx on public.cafeteria_menu_items (status);

-- ─── 2. Kitchen Stock Table ────────────────────────────────────────────────
create table if not exists public.kitchen_stock (
  stock_id         text primary key default ('kstock-' || gen_random_uuid()::text),
  hospital_id      uuid references public.hospitals(hospital_id) on delete cascade,
  item_name        text not null,
  category         text not null default 'produce' check (category in ('produce', 'dairy', 'meat', 'dry_goods', 'beverages', 'bakery', 'frozen')),
  quantity         numeric(10,2) not null default 0 check (quantity >= 0),
  unit             text not null default 'kg',
  reorder_level    numeric(10,2) not null default 10,
  unit_cost        numeric(10,2) not null default 0.00,
  expiry_date      date,
  supplier         text,
  storage_location text default 'Main Kitchen Pantry',
  status           text not null default 'normal' check (status in ('normal', 'low_stock', 'expired')),
  last_restocked_at timestamptz default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists kitchen_stock_hospital_idx on public.kitchen_stock (hospital_id);
create index if not exists kitchen_stock_status_idx on public.kitchen_stock (status);
create index if not exists kitchen_stock_expiry_idx on public.kitchen_stock (expiry_date);

-- ─── 3. Dietary Requirements Table ──────────────────────────────────────────
create table if not exists public.dietary_requirements (
  requirement_id   text primary key default ('diet-' || gen_random_uuid()::text),
  hospital_id      uuid references public.hospitals(hospital_id) on delete cascade,
  patient_did      text not null,
  patient_name     text not null default 'Inpatient',
  patient_mrn      text,
  room_number      text,
  requirements     text[] not null default '{}',
  allergies        text[] not null default '{}',
  meal_plan_status text not null default 'active' check (meal_plan_status in ('active', 'pending', 'review', 'suspended')),
  prescribed_by    text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists dietary_requirements_hospital_idx on public.dietary_requirements (hospital_id);
create index if not exists dietary_requirements_patient_idx on public.dietary_requirements (patient_did);
create index if not exists dietary_requirements_status_idx on public.dietary_requirements (meal_plan_status);

-- ─── 4. Meal Deliveries Table ───────────────────────────────────────────────
create table if not exists public.meal_deliveries (
  delivery_id      text primary key default ('deliv-' || gen_random_uuid()::text),
  hospital_id      uuid references public.hospitals(hospital_id) on delete cascade,
  patient_did      text not null,
  patient_name     text not null default 'Inpatient',
  room_number      text not null,
  meal_type        text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  menu_item_name   text not null,
  delivery_status  text not null default 'preparing' check (delivery_status in ('preparing', 'dispatched', 'delivered', 'cancelled')),
  scheduled_at     timestamptz not null default now(),
  delivered_at     timestamptz,
  dietary_notes    text,
  assigned_runner  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists meal_deliveries_hospital_idx on public.meal_deliveries (hospital_id);
create index if not exists meal_deliveries_patient_idx on public.meal_deliveries (patient_did);
create index if not exists meal_deliveries_status_idx on public.meal_deliveries (delivery_status);
create index if not exists meal_deliveries_scheduled_idx on public.meal_deliveries (scheduled_at);

-- ─── 5. Cafeteria Vendors Table ─────────────────────────────────────────────
create table if not exists public.cafeteria_vendors (
  vendor_id           text primary key default ('vnd-' || gen_random_uuid()::text),
  hospital_id         uuid references public.hospitals(hospital_id) on delete cascade,
  name                text not null,
  contact_person      text,
  contact_email       text,
  contact_phone       text,
  contract_status     text not null default 'active' check (contract_status in ('active', 'expired', 'pending', 'terminated')),
  supplied_categories text[] not null default '{}',
  last_delivery_at    timestamptz,
  contract_expiry     date,
  rating              numeric(3,1) default 5.0,
  address             text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists cafeteria_vendors_hospital_idx on public.cafeteria_vendors (hospital_id);
create index if not exists cafeteria_vendors_status_idx on public.cafeteria_vendors (contract_status);

-- ─── 6. Food Wastage Logs Table ─────────────────────────────────────────────
create table if not exists public.food_wastage_logs (
  log_id          text primary key default ('wst-' || gen_random_uuid()::text),
  hospital_id     uuid references public.hospitals(hospital_id) on delete cascade,
  date            date not null default current_date,
  meal_type       text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'prep_waste')),
  item_name       text not null,
  quantity_wasted numeric(10,2) not null default 0 check (quantity_wasted >= 0),
  unit            text not null default 'kg',
  cost_impact     numeric(10,2) not null default 0.00,
  reason          text not null default 'overproduction' check (reason in ('overproduction', 'spoilage', 'unconsumed_tray', 'expired_stock', 'damaged')),
  logged_by       text not null default 'Kitchen Supervisor',
  created_at      timestamptz not null default now()
);

create index if not exists food_wastage_logs_hospital_idx on public.food_wastage_logs (hospital_id);
create index if not exists food_wastage_logs_date_idx on public.food_wastage_logs (date desc);
create index if not exists food_wastage_logs_reason_idx on public.food_wastage_logs (reason);

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.cafeteria_menu_items enable row level security;
alter table public.kitchen_stock enable row level security;
alter table public.dietary_requirements enable row level security;
alter table public.meal_deliveries enable row level security;
alter table public.cafeteria_vendors enable row level security;
alter table public.food_wastage_logs enable row level security;

-- Permissive policies for authenticated users scoped to their hospital
create policy "Hospital staff can view cafeteria menu items"
  on public.cafeteria_menu_items for select
  to authenticated
  using (
    hospital_id is null or
    hospital_id = (select hospital_id from public.profiles where id = auth.uid() limit 1)
  );

create policy "Hospital staff can modify cafeteria menu items"
  on public.cafeteria_menu_items for all
  to authenticated
  using (
    hospital_id is null or
    hospital_id = (select hospital_id from public.profiles where id = auth.uid() limit 1)
  );

create policy "Hospital staff can view kitchen stock"
  on public.kitchen_stock for select
  to authenticated
  using (
    hospital_id is null or
    hospital_id = (select hospital_id from public.profiles where id = auth.uid() limit 1)
  );

create policy "Hospital staff can modify kitchen stock"
  on public.kitchen_stock for all
  to authenticated
  using (
    hospital_id is null or
    hospital_id = (select hospital_id from public.profiles where id = auth.uid() limit 1)
  );

create policy "Hospital staff can view dietary requirements"
  on public.dietary_requirements for select
  to authenticated
  using (
    hospital_id is null or
    hospital_id = (select hospital_id from public.profiles where id = auth.uid() limit 1)
  );

create policy "Hospital staff can modify dietary requirements"
  on public.dietary_requirements for all
  to authenticated
  using (
    hospital_id is null or
    hospital_id = (select hospital_id from public.profiles where id = auth.uid() limit 1)
  );

create policy "Hospital staff can view meal deliveries"
  on public.meal_deliveries for select
  to authenticated
  using (
    hospital_id is null or
    hospital_id = (select hospital_id from public.profiles where id = auth.uid() limit 1)
  );

create policy "Hospital staff can modify meal deliveries"
  on public.meal_deliveries for all
  to authenticated
  using (
    hospital_id is null or
    hospital_id = (select hospital_id from public.profiles where id = auth.uid() limit 1)
  );

create policy "Hospital staff can view cafeteria vendors"
  on public.cafeteria_vendors for select
  to authenticated
  using (
    hospital_id is null or
    hospital_id = (select hospital_id from public.profiles where id = auth.uid() limit 1)
  );

create policy "Hospital staff can modify cafeteria vendors"
  on public.cafeteria_vendors for all
  to authenticated
  using (
    hospital_id is null or
    hospital_id = (select hospital_id from public.profiles where id = auth.uid() limit 1)
  );

create policy "Hospital staff can view food wastage logs"
  on public.food_wastage_logs for select
  to authenticated
  using (
    hospital_id is null or
    hospital_id = (select hospital_id from public.profiles where id = auth.uid() limit 1)
  );

create policy "Hospital staff can modify food wastage logs"
  on public.food_wastage_logs for all
  to authenticated
  using (
    hospital_id is null or
    hospital_id = (select hospital_id from public.profiles where id = auth.uid() limit 1)
  );

-- ─── Realtime Publication ───────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.cafeteria_menu_items;
    alter publication supabase_realtime add table public.kitchen_stock;
    alter publication supabase_realtime add table public.dietary_requirements;
    alter publication supabase_realtime add table public.meal_deliveries;
    alter publication supabase_realtime add table public.cafeteria_vendors;
    alter publication supabase_realtime add table public.food_wastage_logs;
  end if;
exception
  when duplicate_object then null;
end $$;
