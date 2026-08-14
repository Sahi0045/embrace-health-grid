# Pharmacy & Medical Inventory System - Testing Guide

Complete end-to-end testing procedures for the pharmacy backend.

## Setup

### Prerequisites

- Supabase instance running with pharmacy schema migrated
- Health Grid main application running
- Test user accounts with roles: admin, staff, doctor
- Sample hospital, building, ward data

### Test Data Setup

```sql
-- Create test hospital
insert into public.hospitals (hospital_name, city, country)
values ('Test Hospital', 'Test City', 'Test Country')
returning hospital_id;

-- Create test supplier
insert into public.suppliers (hospital_id, supplier_name, contact_person, phone, email)
values (
  'HOSPITAL_ID',
  'Test Supplier',
  'John Supplier',
  '555-0001',
  'supplier@test.com'
)
returning supplier_id;

-- Create test inventory item
insert into public.inventory_items (
  hospital_id, item_code, item_name, item_type, unit_of_measure,
  reorder_level, reorder_quantity
)
values (
  'HOSPITAL_ID',
  'TEST001',
  'Test Medicine',
  'medicine',
  'tablet',
  50,
  100
)
returning item_id;

-- Create test batch
insert into public.inventory_batches (
  hospital_id, item_id, supplier_id, batch_number,
  quantity_received, quantity_available, expiry_date
)
values (
  'HOSPITAL_ID',
  'ITEM_ID',
  'SUPPLIER_ID',
  'BATCH-TEST-001',
  1000,
  1000,
  '2027-12-31'
)
returning batch_id;
```

## Test Cases

### Test 1: Add Stock (Receive from Supplier)

**Objective**: Verify stock reception creates correct movements and audit records

**Steps**:
1. Call `addStock()` with batch_id and quantity
2. Verify batch.quantity_available increases
3. Verify stock_movement record created (type=received)
4. Verify audit_event created
5. Verify realtime event published

**Expected Results**:
```
✅ Batch quantity_available: 1000 → 1100
✅ stock_movements INSERT: MOV-20260817-000001
✅ audit_events INSERT: STOCK_RECEIVED event
✅ Realtime event received on channel
```

**Test Code**:
```typescript
test("addStock creates movement and audit trail", async () => {
  const result = await addStock({
    itemId: "ITEM_ID",
    batchId: "BATCH_ID",
    quantityToAdd: 100,
    reason: "Test receipt"
  });

  expect(result.ok).toBe(true);
  expect(result.movement.movement_type).toBe("received");
  expect(result.batchUpdated).toBe(1100);

  // Verify audit event
  const auditEvents = await supabase
    .from("audit_events")
    .select("*")
    .eq("hospital_id", HOSPITAL_ID)
    .eq("eventType", "STOCK_RECEIVED")
    .order("created_at", { ascending: false })
    .limit(1);
  
  expect(auditEvents.data[0].details.quantity).toBe(100);
});
```

---

### Test 2: Dispense Prescription Medication

**Objective**: Verify dispensing creates stock movement + links to prescription

**Steps**:
1. Create test prescription with medications
2. Call `dispensePrescriptionMedications()`
3. Verify stock movements created (type=dispensed)
4. Verify prescription_id linked in movements
5. Verify patient_did captured
6. Verify batch quantities decreased
7. Verify audit event type=PRESCRIPTION_DISPENSED

**Expected Results**:
```
✅ Batch quantity_available: 1100 → 1090
✅ stock_movements INSERT: MOV-20260817-000002, type=dispensed
✅ prescription_id: RX-2026-001
✅ patient_did: captured
✅ audit_events INSERT: PRESCRIPTION_DISPENSED
```

**Test Code**:
```typescript
test("dispensePrescriptionMedications links prescription to stock", async () => {
  const result = await dispensePrescriptionMedications({
    prescriptionId: "RX-2026-001",
    patientDid: "did:solana:...",
    medications: [
      {
        itemId: "ITEM_ID",
        batchId: "BATCH_ID",
        quantityToDispense: 10,
        medicationName: "Test Medicine"
      }
    ]
  });

  expect(result.ok).toBe(true);
  expect(result.movements[0].movement_type).toBe("dispensed");
  expect(result.movements[0].prescription_id).toBe("RX-2026-001");
  expect(result.movements[0].patient_did).toBe("did:solana:...");
});
```

---

### Test 3: Low-Stock Alert

**Objective**: Verify alerts trigger when inventory falls below reorder level

**Steps**:
1. Set item reorder_level = 50
2. Remove stock until quantity < 50
3. Verify low_stock_alerts entry created
4. Verify alert has correct quantities
5. Verify realtime event published
6. Resolve alert and verify is_resolved flag

**Expected Results**:
```
✅ low_stock_alerts INSERT: quantity_short = 10
✅ current_quantity = 40
✅ reorder_level = 50
✅ Realtime event received
✅ Alert resolution updates is_resolved = true
```

**Test Code**:
```typescript
test("low-stock alert created when quantity drops below threshold", async () => {
  // Remove 55 units (1000 → 945)
  await removeStock({
    itemId: "ITEM_ID",
    batchId: "BATCH_ID",
    quantityToRemove: 55,
    movementType: "issued"
  });

  // Query alerts
  const alerts = await supabase
    .from("low_stock_alerts")
    .select("*")
    .eq("item_id", "ITEM_ID")
    .eq("is_resolved", false);

  expect(alerts.data.length).toBeGreaterThan(0);
  expect(alerts.data[0].quantity_short).toBe(10);
});
```

---

### Test 4: Near-Expiry Alert

**Objective**: Verify expiration alerts trigger within 30 days of expiry

**Steps**:
1. Create batch with expiry_date = 29 days from now
2. Verify expiration_alerts entry created (status=near_expiry)
3. Create batch with expiry_date = 5 days ago
4. Verify expiration_alerts entry created (status=expired)
5. Verify alert resolution updates is_resolved flag

**Expected Results**:
```
✅ near_expiry batch: expiration_alerts INSERT, status=near_expiry
✅ expired batch: expiration_alerts INSERT, status=expired
✅ days_until_expiry = -5 for expired batch
✅ Realtime events received
```

---

### Test 5: Wastage Recording

**Objective**: Verify wastage removes stock and creates audit trail

**Steps**:
1. Create batch with 1000 units
2. Call `recordWastage()` with reason
3. Verify quantity_wasted incremented
4. Verify quantity_available decreased
5. Verify movement type=wasted
6. Verify audit event captured reason

**Expected Results**:
```
✅ Batch quantity_available: 1000 → 980
✅ Batch quantity_wasted: 0 → 20
✅ stock_movements: type=wasted, quantity_moved=20
✅ reason captured: "Contaminated batch"
```

---

### Test 6: Inventory Transfer

**Objective**: Verify stock transfer between locations doesn't change batch qty

**Steps**:
1. Call `transferStock()` with source/destination locations
2. Verify batch quantity_available unchanged
3. Verify movement type=transferred
4. Verify source/destination locations recorded
5. Verify audit event has location context

**Expected Results**:
```
✅ Batch quantity_available: unchanged
✅ stock_movements: type=transferred, source/destination captured
✅ quantity_moved recorded for tracking
```

---

### Test 7: Stock Adjustment

**Objective**: Verify inventory corrections with reason tracking

**Steps**:
1. Call `adjustStock()` with adjustment=-50, reason="Physical count discrepancy"
2. Verify batch quantity_available decreased by 50
3. Verify movement type=adjusted
4. Verify reason captured in movement + audit event
5. Verify actor info (who made adjustment)

**Expected Results**:
```
✅ Batch quantity_available: 1000 → 950
✅ stock_movements: type=adjusted, quantity=50, reason captured
✅ audit_events: STOCK_ADJUSTED, beforeState/afterState captured
✅ Staff member name/ID recorded
```

---

### Test 8: Audit Trail Immutability

**Objective**: Verify stock movements cannot be modified (immutable log)

**Steps**:
1. Create a movement
2. Attempt to UPDATE stock_movements (should fail via RLS)
3. Attempt to DELETE stock_movements (should fail via RLS)
4. Verify audit_events also immutable

**Expected Results**:
```
✅ UPDATE stock_movements: RLS violation
✅ DELETE stock_movements: RLS violation
✅ UPDATE audit_events: RLS violation
✅ Only INSERTS allowed (append-only)
```

**Test Code**:
```typescript
test("stock_movements are immutable (RLS enforced)", async () => {
  const supabase = getSupabaseServerClient();
  
  // Attempt update
  const { error } = await supabase
    .from("stock_movements")
    .update({ quantity_moved: 999 })
    .eq("movement_id", "MOV-20260817-000001");

  expect(error).toBeDefined();
  expect(error.message).toContain("violates row-level security");
});
```

---

### Test 9: Role-Based Access Control

**Objective**: Verify RLS policies enforce proper access by role

**Steps**:
1. Admin: Can create items, view all movements ✅
2. Staff: Can add/remove stock, dispense, view ✅
3. Doctor: Can view, dispense only ✅
4. Patient: Cannot access pharmacy ❌

**Expected Results**:
```
✅ Admin: All operations
✅ Staff: Receive, dispense, transfer, consume, waste, adjust
❌ Doctor: Receive (blocked), but dispense allowed
❌ Patient: All operations blocked (RLS)
```

---

### Test 10: Realtime Sync

**Objective**: Verify realtime subscriptions deliver updates instantly

**Steps**:
1. Open Dashboard A in browser 1
2. Open Dashboard B in browser 2
3. In browser 1: Add stock via `addStock()`
4. In browser 2: Observe stock level update (via subscription)
5. No manual refresh needed

**Expected Results**:
```
✅ Browser 1: Stock change visible immediately
✅ Browser 2: Stock update received via realtime
✅ Both dashboards show consistent data
✅ Latency < 100ms typical
```

**Test Code**:
```typescript
test("realtime subscriptions deliver movements instantly", async (done) => {
  const received: any[] = [];

  subscribeToStockMovements(
    HOSPITAL_ID,
    (movement) => {
      received.push(movement);
      if (received.length >= 1) {
        expect(received[0].movement_type).toBe("received");
        done();
      }
    }
  );

  // Trigger movement
  await addStock({
    itemId: "ITEM_ID",
    batchId: "BATCH_ID",
    quantityToAdd: 100
  });

  // Done callback fires when realtime event received
});
```

---

### Test 11: Prescription Availability Check

**Objective**: Verify pre-dispensing checks prevent stockouts

**Steps**:
1. Prescription requires 10 units
2. Inventory has 5 units
3. Call `checkPrescriptionMedicationAvailability()`
4. Verify allAvailable=false, shortfall=5
5. Attempt dispense (should fail)

**Expected Results**:
```
✅ checkPrescriptionMedicationAvailability: allAvailable=false
✅ availability[0].shortfall = 5
❌ dispensePrescriptionMedications fails with insufficient qty
```

---

### Test 12: Expired Batch Filtering

**Objective**: Verify availability checks exclude expired batches

**Steps**:
1. Create 2 batches: A (expires tomorrow), B (expired yesterday)
2. Total quantity = 20, Available (non-expired) = 10
3. Call `checkPrescriptionMedicationAvailability()` for qty=15
4. Verify shortfall=5 (expired batch excluded)

**Expected Results**:
```
✅ Batch A: included (expiry_date > today)
❌ Batch B: excluded (expiry_date < today)
✅ availableQuantity = 10 (B excluded)
✅ shortfall = 5
```

---

## Performance Tests

### Test P1: Bulk Movement Creation

**Objective**: Verify system handles high-volume movements

**Steps**:
1. Create 1000 movements in sequence
2. Measure duration
3. Verify all movements recorded
4. Verify audit events created
5. Verify stock levels accurate

**Expected Results**:
```
✅ 1000 movements in < 30 seconds
✅ All movements in database
✅ Audit events count = 1000
✅ Final stock level accurate
```

---

### Test P2: Realtime Scale

**Objective**: Verify realtime scales to multiple concurrent subscribers

**Steps**:
1. Subscribe 10 concurrent clients to same channel
2. Generate 100 movements
3. Verify all clients receive all events
4. Check message delivery latency

**Expected Results**:
```
✅ All 10 clients receive all 100 events
✅ Latency < 200ms p99
✅ No dropped events
✅ Channel remains stable
```

---

### Test P3: Large Batch Quantity

**Objective**: Verify system handles large quantities without issues

**Steps**:
1. Create batch with quantity_received = 999,999
2. Remove 50,000 units
3. Verify movement created
4. Verify batch quantities correct
5. Verify audit event captured

**Expected Results**:
```
✅ Batch: 999,999 → 949,999
✅ Movement: quantity_moved = 50,000
✅ Audit trail intact
```

---

## Manual Testing Checklist

- [ ] Admin can create inventory items
- [ ] Staff can receive stock
- [ ] Staff can dispense prescriptions
- [ ] Prescriptions show availability before dispensing
- [ ] Low-stock alerts appear when threshold hit
- [ ] Near-expiry alerts appear 30 days before expiry
- [ ] Expired stock alerts show
- [ ] Movement history is complete and accurate
- [ ] Audit events record all operations
- [ ] Realtime updates show on dashboard
- [ ] Multiple users see consistent data
- [ ] Pharmacy admin portal loads quickly
- [ ] Pharmacy staff portal is intuitive
- [ ] Disposal workflow works (wastage/expiry)
- [ ] Patient cannot access pharmacy inventory

---

## Regression Tests

After any changes to pharmacy system:

```bash
# Run all tests
npm test -- pharmacy

# Run with coverage
npm test -- pharmacy --coverage

# Run specific test suite
npm test -- pharmacy.movements
npm test -- pharmacy.alerts
npm test -- pharmacy.realtime
npm test -- pharmacy.rbac
```

---

## Debugging

### Check Stock Movement Log

```sql
select * from stock_movements
where hospital_id = 'HOSPITAL_ID'
order by movement_timestamp desc
limit 20;
```

### Check Audit Events

```sql
select * from audit_events
where hospital_id = 'HOSPITAL_ID'
and eventType like 'STOCK_%'
order by created_at desc
limit 20;
```

### Check Active Alerts

```sql
select * from low_stock_alerts
where hospital_id = 'HOSPITAL_ID'
and is_resolved = false;

select * from expiration_alerts
where hospital_id = 'HOSPITAL_ID'
and is_resolved = false
and expiration_status in ('near_expiry', 'expired');
```

### Monitor Realtime

```typescript
import { RealtimeClient } from "@supabase/realtime-js";

const client = new RealtimeClient();
client.connect();

const channel = client.channel(`pharmacy:stock-movements:HOSPITAL_ID`);
channel.on("*", (msg) => console.log(msg));
channel.subscribe();
```

---

## Success Criteria

✅ All test cases pass
✅ Audit trail is complete and immutable
✅ Realtime sync latency < 200ms
✅ RLS policies enforce access control
✅ Batch quantities remain consistent
✅ Alerts trigger correctly
✅ Performance meets requirements
✅ No data loss or corruption
