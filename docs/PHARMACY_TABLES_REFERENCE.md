# Pharmacy System - Database Tables Reference

Complete reference for all 8 new tables in the pharmacy & medical inventory system.

---

## Table 1: suppliers

**Purpose**: Store supplier/vendor information for medication purchases

```sql
create table public.suppliers (
  supplier_id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(hospital_id) on delete cascade,
  supplier_name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  city text,
  country text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint suppliers_name_unique unique (hospital_id, supplier_name)
);

create index suppliers_hospital_idx on public.suppliers (hospital_id);
create index suppliers_active_idx on public.suppliers (hospital_id, is_active);
```

**Columns**:
- `supplier_id` - UUID primary key
- `hospital_id` - Foreign key to hospitals (multi-tenant)
- `supplier_name` - Name of supplier company
- `contact_person` - Name of contact person
- `phone` - Contact phone number
- `email` - Contact email
- `address` - Physical address
- `city` - City
- `country` - Country
- `is_active` - Boolean flag (true = active supplier)
- `created_at` - Auto-timestamp on creation
- `updated_at` - Auto-timestamp on update

**Indexes**: 
- Hospital lookup (fast filtering by hospital)
- Active suppliers only (common query)

**Example Data**:
```
supplier_id: 550e8400-e29b-41d4-a716-446655440000
hospital_id: 123e4567-e89b-12d3-a456-426614174000
supplier_name: Medical Supplies Inc.
contact_person: John Smith
phone: +1-555-0001
email: supplier@medsupply.com
address: 123 Medical St
city: New York
country: USA
is_active: true
```

---

## Table 2: inventory_items

**Purpose**: Master catalog of all medicines, consumables, equipment

```sql
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

create table public.inventory_items (
  item_id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(hospital_id) on delete cascade,
  
  -- Identity
  item_code text not null,
  item_name text not null,
  item_type inventory_item_type not null default 'medicine',
  category text,
  description text,
  
  -- Physical Properties
  unit_of_measure text not null,
  unit_cost numeric(10, 2),
  
  -- Control Levels
  reorder_level int not null default 50,
  reorder_quantity int not null default 100,
  maximum_stock int,
  
  -- Status & Dates
  status inventory_item_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint items_code_unique unique (hospital_id, item_code),
  constraint items_reorder_positive check (reorder_level > 0),
  constraint items_unit_cost_positive check (unit_cost is null or unit_cost > 0)
);

create index inventory_items_hospital_idx on public.inventory_items (hospital_id);
create index inventory_items_status_idx on public.inventory_items (status);
create index inventory_items_category_idx on public.inventory_items (category);
create index inventory_items_code_idx on public.inventory_items (item_code);
```

**Columns**:
- `item_id` - UUID primary key
- `hospital_id` - Foreign key to hospitals (multi-tenant)
- `item_code` - SKU/reference code (e.g., PARA500)
- `item_name` - Full name (e.g., Paracetamol 500mg)
- `item_type` - Enum: medicine, consumable, medical_supply, equipment, other
- `category` - Category for filtering (e.g., antibiotic, painkiller)
- `description` - Additional details
- `unit_of_measure` - Unit type (tablet, vial, box, etc.)
- `unit_cost` - Cost per unit in decimal
- `reorder_level` - Alert threshold (default: 50)
- `reorder_quantity` - Order this much when restocking (default: 100)
- `maximum_stock` - Safety limit
- `status` - Enum: active, inactive, discontinued
- `created_at` - Auto-timestamp
- `updated_at` - Auto-timestamp

**Constraints**:
- Item code must be unique per hospital
- Reorder level must be positive
- Unit cost must be positive (if specified)

**Indexes**:
- Hospital lookup
- Status filtering
- Category filtering
- Code search

**Example Data**:
```
item_id: 660e8400-e29b-41d4-a716-446655440001
hospital_id: 123e4567-e89b-12d3-a456-426614174000
item_code: PARA500
item_name: Paracetamol 500mg Tablet
item_type: medicine
category: Painkiller
description: Fever and pain relief
unit_of_measure: tablet
unit_cost: 0.50
reorder_level: 50
reorder_quantity: 100
maximum_stock: 500
status: active
```

---

## Table 3: inventory_batches

**Purpose**: Batch-level tracking with expiry dates (each batch from supplier)

```sql
create table public.inventory_batches (
  batch_id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(hospital_id) on delete cascade,
  item_id uuid not null references public.inventory_items(item_id) on delete cascade,
  supplier_id uuid references public.suppliers(supplier_id) on delete set null,
  
  -- Batch Identity
  batch_number text not null,
  
  -- Dates
  manufacturing_date date,
  expiry_date date,
  
  -- Quantity
  quantity_received int not null,
  quantity_available int not null,
  quantity_wasted int not null default 0,
  quantity_expired int not null default 0,
  
  -- Location
  storage_location text,
  storage_building uuid references public.buildings(building_id) on delete set null,
  storage_floor uuid references public.floors(floor_id) on delete set null,
  storage_ward uuid references public.wards(ward_id) on delete set null,
  
  -- Status
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
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
```

**Columns**:
- `batch_id` - UUID primary key
- `hospital_id` - Foreign key (multi-tenant)
- `item_id` - Foreign key to inventory_items
- `supplier_id` - Foreign key to suppliers (nullable)
- `batch_number` - Batch identifier (e.g., PARA-2026-0801)
- `manufacturing_date` - Date manufactured
- `expiry_date` - Date expires
- `quantity_received` - Total quantity received
- `quantity_available` - Usable quantity (received - wasted - expired)
- `quantity_wasted` - Damaged/contaminated quantity
- `quantity_expired` - Expired quantity
- `storage_location` - Location name (e.g., "Pharmacy Store A")
- `storage_building` - Building reference
- `storage_floor` - Floor reference
- `storage_ward` - Ward reference
- `is_active` - Boolean flag
- `created_at` - Auto-timestamp
- `updated_at` - Auto-timestamp

**Constraints**:
- Batch number unique per hospital+item
- Quantity received must be positive
- Quantity available must be non-negative
- Quantity constraint: available + wasted + expired = received

**Indexes**:
- Hospital lookup
- Item lookup
- Supplier lookup
- Expiry date (for near-expiry queries)
- Active batches only

**Example Data**:
```
batch_id: 770e8400-e29b-41d4-a716-446655440002
hospital_id: 123e4567-e89b-12d3-a456-426614174000
item_id: 660e8400-e29b-41d4-a716-446655440001
supplier_id: 550e8400-e29b-41d4-a716-446655440000
batch_number: PARA-2026-0801
manufacturing_date: 2024-08-15
expiry_date: 2027-08-15
quantity_received: 1000
quantity_available: 980
quantity_wasted: 20
quantity_expired: 0
storage_location: Pharmacy Store A
storage_building: <building-uuid>
storage_floor: <floor-uuid>
storage_ward: <ward-uuid>
is_active: true
```

---

## Table 4: stock_levels

**Purpose**: Current aggregated stock quantities by location (fast read)

```sql
create table public.stock_levels (
  stock_id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(hospital_id) on delete cascade,
  item_id uuid not null references public.inventory_items(item_id) on delete cascade,
  
  -- Location (optional; if null, represents warehouse aggregate)
  storage_location text,
  building_id uuid references public.buildings(building_id) on delete set null,
  floor_id uuid references public.floors(floor_id) on delete set null,
  ward_id uuid references public.wards(ward_id) on delete set null,
  room_id uuid references public.rooms(room_id) on delete set null,
  
  -- Quantities
  quantity_total int not null default 0,
  quantity_usable int not null default 0,
  quantity_batches int not null default 0,
  
  -- Status
  last_movement_at timestamptz,
  updated_at timestamptz not null default now(),
  
  constraint stock_levels_unique unique (hospital_id, item_id, storage_location, building_id, floor_id, ward_id, room_id),
  constraint stock_total_nonnegative check (quantity_total >= 0),
  constraint stock_usable_nonnegative check (quantity_usable >= 0)
);

create index stock_levels_hospital_item_idx on public.stock_levels (hospital_id, item_id);
create index stock_levels_location_idx on public.stock_levels (hospital_id, storage_location);
create index stock_levels_building_idx on public.stock_levels (building_id);
create index stock_levels_ward_idx on public.stock_levels (ward_id);
```

**Columns**:
- `stock_id` - UUID primary key
- `hospital_id` - Foreign key (multi-tenant)
- `item_id` - Foreign key to inventory_items
- `storage_location` - Location name
- `building_id` - Building reference (nullable)
- `floor_id` - Floor reference (nullable)
- `ward_id` - Ward reference (nullable)
- `room_id` - Room reference (nullable)
- `quantity_total` - All stock including near-expiry
- `quantity_usable` - Stock not near expiry
- `quantity_batches` - Number of active batches
- `last_movement_at` - Timestamp of last transaction
- `updated_at` - Auto-timestamp

**Constraints**:
- Unique per hospital+item+location combination
- Quantities must be non-negative

**Indexes**:
- Hospital + item lookup (common query)
- Location lookup (for ward-level inventory)
- Building, ward lookups

**Example Data**:
```
stock_id: 880e8400-e29b-41d4-a716-446655440003
hospital_id: 123e4567-e89b-12d3-a456-426614174000
item_id: 660e8400-e29b-41d4-a716-446655440001
storage_location: Ward A
building_id: <building-uuid>
floor_id: <floor-uuid>
ward_id: <ward-uuid>
room_id: null
quantity_total: 580
quantity_usable: 570
quantity_batches: 2
last_movement_at: 2026-08-17T14:30:00Z
updated_at: 2026-08-17T14:30:00Z
```

---

## Table 5: stock_movements

**Purpose**: IMMUTABLE transaction log of all inventory changes (audit trail)

```sql
create type stock_movement_type as enum (
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

create table public.stock_movements (
  movement_id text primary key,
  hospital_id uuid not null references public.hospitals(hospital_id) on delete cascade,
  item_id uuid not null references public.inventory_items(item_id) on delete cascade,
  batch_id uuid references public.inventory_batches(batch_id) on delete set null,
  
  -- Movement Details
  movement_type stock_movement_type not null,
  quantity_moved int not null,
  reason text,
  
  -- Previous State
  quantity_before int not null,
  
  -- New State (after movement)
  quantity_after int not null,
  
  -- Location Information
  source_location text,
  destination_location text,
  source_building uuid references public.buildings(building_id) on delete set null,
  destination_building uuid references public.buildings(building_id) on delete set null,
  source_ward uuid references public.wards(ward_id) on delete set null,
  destination_ward uuid references public.wards(ward_id) on delete set null,
  
  -- Actor Information (captured at creation, never updated)
  performed_by_id uuid,
  performed_by_name text,
  performed_by_role text,
  
  -- Prescription/Patient Link (for dispensing)
  prescription_id text,
  patient_did text,
  
  -- Timestamps
  movement_timestamp timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  
  -- Audit & Integrity
  content_hash text,
  
  constraint movements_qty_positive check (quantity_moved > 0)
);

create index movements_hospital_idx on public.stock_movements (hospital_id);
create index movements_item_idx on public.stock_movements (item_id);
create index movements_batch_idx on public.stock_movements (batch_id);
create index movements_type_idx on public.stock_movements (movement_type);
create index movements_timestamp_idx on public.stock_movements (movement_timestamp desc);
create index movements_prescription_idx on public.stock_movements (prescription_id);
create index movements_patient_idx on public.stock_movements (patient_did);
create index movements_actor_idx on public.stock_movements (performed_by_id);
```

**Columns**:
- `movement_id` - Text primary key (MOV-20260817-000001)
- `hospital_id` - Foreign key (multi-tenant)
- `item_id` - Foreign key to inventory_items
- `batch_id` - Foreign key to inventory_batches (nullable)
- `movement_type` - Enum: received, issued, dispensed, consumed, transferred, adjusted, returned, wasted, expired, damaged, other
- `quantity_moved` - Quantity in this transaction
- `reason` - Why was this moved?
- `quantity_before` - Stock before movement
- `quantity_after` - Stock after movement
- `source_location` - Where from
- `destination_location` - Where to
- `source_building`, `destination_building` - Building references
- `source_ward`, `destination_ward` - Ward references
- `performed_by_id` - User ID (immutable)
- `performed_by_name` - User name (immutable)
- `performed_by_role` - User role (immutable)
- `prescription_id` - Link to prescription if dispensed
- `patient_did` - Patient Solana DID if applicable
- `movement_timestamp` - When did it happen (immutable)
- `recorded_at` - When was it recorded (immutable)
- `content_hash` - SHA-256 for blockchain (immutable)

**Constraints**:
- Quantity moved must be positive

**Indexes**:
- Hospital, item, batch (lookups)
- Movement type (filtering)
- Timestamp (reverse order for recent)
- Prescription, patient (drug recall queries)
- Actor (accountability)

**Example Data**:
```
movement_id: MOV-20260817-000001
hospital_id: 123e4567-e89b-12d3-a456-426614174000
item_id: 660e8400-e29b-41d4-a716-446655440001
batch_id: 770e8400-e29b-41d4-a716-446655440002
movement_type: dispensed
quantity_moved: 10
reason: Dispensed for RX-2026-0801
quantity_before: 500
quantity_after: 490
source_location: Ward A
destination_location: null
source_ward: <ward-uuid>
performed_by_id: <user-uuid>
performed_by_name: Jane Pharmacist
performed_by_role: staff
prescription_id: RX-2026-0801
patient_did: did:solana:...
movement_timestamp: 2026-08-17T14:30:00Z
recorded_at: 2026-08-17T14:30:00Z
content_hash: a1b2c3d4...
```

**Note**: This table is RLS-protected to prevent any UPDATEs or DELETEs (append-only audit log).

---

## Table 6: expiration_alerts

**Purpose**: Track near-expiry and expired batches with alert history

```sql
create type expiration_status as enum (
  'valid',
  'near_expiry',
  'expired'
);

create table public.expiration_alerts (
  alert_id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(hospital_id) on delete cascade,
  batch_id uuid not null references public.inventory_batches(batch_id) on delete cascade,
  item_id uuid not null references public.inventory_items(item_id) on delete cascade,
  
  -- Alert Details
  expiration_status expiration_status not null,
  expiry_date date not null,
  days_until_expiry int,
  quantity_affected int not null,
  
  -- Action Tracking
  alert_raised_at timestamptz not null default now(),
  action_taken_at timestamptz,
  action_taken_by text,
  action_notes text,
  
  -- Status
  is_resolved boolean not null default false,
  
  constraint alerts_qty_positive check (quantity_affected > 0)
);

create index expiration_alerts_hospital_idx on public.expiration_alerts (hospital_id);
create index expiration_alerts_batch_idx on public.expiration_alerts (batch_id);
create index expiration_alerts_status_idx on public.expiration_alerts (expiration_status);
create index expiration_alerts_resolved_idx on public.expiration_alerts (is_resolved);
```

**Columns**:
- `alert_id` - UUID primary key
- `hospital_id` - Foreign key (multi-tenant)
- `batch_id` - Foreign key to inventory_batches
- `item_id` - Foreign key to inventory_items
- `expiration_status` - Enum: valid, near_expiry (< 30 days), expired
- `expiry_date` - Batch expiry date
- `days_until_expiry` - Days remaining (negative if expired)
- `quantity_affected` - Units affected
- `alert_raised_at` - When alert was created
- `action_taken_at` - When action was taken (nullable)
- `action_taken_by` - Staff member (nullable)
- `action_notes` - What action was taken (nullable)
- `is_resolved` - Boolean flag

**Constraints**:
- Quantity affected must be positive

**Indexes**:
- Hospital lookup
- Batch lookup
- Status filtering (to find near-expiry items)
- Resolved status (to filter active alerts)

**Example Data**:
```
alert_id: 990e8400-e29b-41d4-a716-446655440004
hospital_id: 123e4567-e89b-12d3-a456-426614174000
batch_id: 770e8400-e29b-41d4-a716-446655440002
item_id: 660e8400-e29b-41d4-a716-446655440001
expiration_status: near_expiry
expiry_date: 2026-08-25
days_until_expiry: 8
quantity_affected: 450
alert_raised_at: 2026-08-17T00:00:00Z
action_taken_at: 2026-08-17T10:00:00Z
action_taken_by: John Staff
action_notes: Batch prioritized for dispensing
is_resolved: true
```

---

## Table 7: low_stock_alerts

**Purpose**: Track items below reorder level

```sql
create table public.low_stock_alerts (
  alert_id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(hospital_id) on delete cascade,
  item_id uuid not null references public.inventory_items(item_id) on delete cascade,
  
  -- Alert Details
  current_quantity int not null,
  reorder_level int not null,
  quantity_short int not null,
  
  -- Action Tracking
  alert_raised_at timestamptz not null default now(),
  order_created_at timestamptz,
  order_id text,
  
  -- Status
  is_resolved boolean not null default false,
  
  constraint alerts_short_positive check (quantity_short > 0)
);

create index low_stock_alerts_hospital_idx on public.low_stock_alerts (hospital_id);
create index low_stock_alerts_item_idx on public.low_stock_alerts (item_id);
create index low_stock_alerts_resolved_idx on public.low_stock_alerts (is_resolved);
```

**Columns**:
- `alert_id` - UUID primary key
- `hospital_id` - Foreign key (multi-tenant)
- `item_id` - Foreign key to inventory_items
- `current_quantity` - Current stock level
- `reorder_level` - Threshold level
- `quantity_short` - How many units below threshold
- `alert_raised_at` - When alert created
- `order_created_at` - When purchase order created (nullable)
- `order_id` - Link to purchase order (nullable)
- `is_resolved` - Boolean flag

**Constraints**:
- Quantity short must be positive

**Indexes**:
- Hospital lookup
- Item lookup
- Resolved status (to filter active alerts)

**Example Data**:
```
alert_id: aa0e8400-e29b-41d4-a716-446655440005
hospital_id: 123e4567-e89b-12d3-a456-426614174000
item_id: 660e8400-e29b-41d4-a716-446655440001
current_quantity: 40
reorder_level: 50
quantity_short: 10
alert_raised_at: 2026-08-17T08:00:00Z
order_created_at: 2026-08-17T09:15:00Z
order_id: PO-12ab34cd-1724086200000
is_resolved: false
```

---

## Table 8: purchase_orders

**Purpose**: Track supplier orders for replenishment

```sql
create type purchase_order_status as enum (
  'draft',
  'submitted',
  'confirmed',
  'received',
  'cancelled'
);

create table public.purchase_orders (
  order_id text primary key,
  hospital_id uuid not null references public.hospitals(hospital_id) on delete cascade,
  supplier_id uuid not null references public.suppliers(supplier_id) on delete cascade,
  
  -- Items on order
  items jsonb not null default '[]'::jsonb,
  
  -- Amounts
  total_cost numeric(12, 2),
  
  -- Status
  status purchase_order_status not null default 'draft',
  
  -- Dates
  order_date timestamptz not null default now(),
  expected_delivery_date date,
  received_date date,
  
  -- Tracking
  ordered_by uuid,
  ordered_by_name text,
  received_by uuid,
  received_by_name text,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_orders_hospital_idx on public.purchase_orders (hospital_id);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index purchase_orders_status_idx on public.purchase_orders (status);
create index purchase_orders_delivery_idx on public.purchase_orders (expected_delivery_date);
```

**Columns**:
- `order_id` - Text primary key (e.g., PO-12ab34cd-1724086200000)
- `hospital_id` - Foreign key (multi-tenant)
- `supplier_id` - Foreign key to suppliers
- `items` - JSONB array of ordered items: [{item_id, batch_number, quantity, unit_cost}]
- `total_cost` - Total order cost (decimal)
- `status` - Enum: draft, submitted, confirmed, received, cancelled
- `order_date` - When order created
- `expected_delivery_date` - Expected arrival date
- `received_date` - When actually received
- `ordered_by` - User ID of orderer
- `ordered_by_name` - User name (immutable)
- `received_by` - User ID of receiver (nullable)
- `received_by_name` - User name (nullable)
- `created_at` - Auto-timestamp
- `updated_at` - Auto-timestamp

**Indexes**:
- Hospital lookup
- Supplier lookup
- Status filtering (to find pending orders)
- Delivery date (to track timeline)

**Example Data**:
```
order_id: PO-12ab34cd-1724086200000
hospital_id: 123e4567-e89b-12d3-a456-426614174000
supplier_id: 550e8400-e29b-41d4-a716-446655440000
items: [
  {
    "item_id": "660e8400-e29b-41d4-a716-446655440001",
    "quantity": 500,
    "unit_cost": 0.50
  }
]
total_cost: 250.00
status: received
order_date: 2026-08-17T09:15:00Z
expected_delivery_date: 2026-08-20
received_date: 2026-08-20
ordered_by: <user-uuid>
ordered_by_name: Admin User
received_by: <user-uuid>
received_by_name: Jane Pharmacist
```

---

## Summary

| # | Table | Primary Key | Foreign Keys | Immutable | Realtime |
|---|-------|------------|--------------|-----------|----------|
| 1 | `suppliers` | supplier_id | hospital_id | ❌ | ❌ |
| 2 | `inventory_items` | item_id | hospital_id | ❌ | ✅ |
| 3 | `inventory_batches` | batch_id | hospital_id, item_id, supplier_id | ❌ | ✅ |
| 4 | `stock_levels` | stock_id | hospital_id, item_id | ❌ | ✅ |
| 5 | `stock_movements` | movement_id (text) | hospital_id, item_id, batch_id | ✅ | ✅ |
| 6 | `expiration_alerts` | alert_id | hospital_id, batch_id, item_id | ❌ | ✅ |
| 7 | `low_stock_alerts` | alert_id | hospital_id, item_id | ❌ | ✅ |
| 8 | `purchase_orders` | order_id (text) | hospital_id, supplier_id | ❌ | ❌ |

## Key Features

✅ **Multi-tenant**: All tables have `hospital_id` for data isolation
✅ **RLS Policies**: Row-level security enforces hospital-level access control
✅ **Real-time**: Key tables enabled for Supabase Realtime subscriptions
✅ **Immutable Audit**: stock_movements cannot be updated/deleted (append-only)
✅ **Constraints**: Data integrity checks (quantities, costs, etc.)
✅ **Indexes**: Optimized for common queries (hospital, item, status, date)
✅ **Timestamps**: Auto-updated created_at/updated_at on all tables

## Migration Command

To create all these tables in Supabase:

```bash
cd embrace-health-grid
supabase db push
```

This applies the migration file: `supabase/migrations/20260817000000_pharmacy_inventory_system.sql`
