# Pharmacy Audit Trail & Compliance

Complete audit trail for all pharmacy operations integrated with Health Grid's blockchain-ready audit system.

## Overview

Every pharmacy inventory transaction creates:
1. **Stock Movement Record** (append-only, immutable)
2. **Audit Event** (blockchain-anchored, compliant)
3. **Real-time Alert** (instant notification)
4. **Batch Tracking** (quantity snapshots)

## Audit Trail Architecture

### Tables Involved

| Table | Purpose | Immutable | Real-time |
|-------|---------|-----------|-----------|
| `stock_movements` | Transaction log | ✅ (append-only) | ✅ REPLICA IDENTITY FULL |
| `audit_events` | Compliance & blockchain | ✅ (immutable) | Via API |
| `expiration_alerts` | Expiry tracking | ❌ (resolved flag) | ✅ REPLICA IDENTITY FULL |
| `low_stock_alerts` | Stock monitoring | ❌ (resolved flag) | ✅ REPLICA IDENTITY FULL |
| `inventory_batches` | Batch state | ✅ (quantity tracked via movements) | ✅ REPLICA IDENTITY FULL |

### Stock Movement Types (Audit Events)

```
STOCK_RECEIVED        - Stock added from supplier
STOCK_ISSUED          - Stock issued for patient use
STOCK_DISPENSED       - Medication given to patient (prescription link)
STOCK_CONSUMED        - Consumable used in procedure
STOCK_TRANSFERRED     - Moved between locations/wards
STOCK_ADJUSTED        - Inventory correction (with reason)
STOCK_WASTED          - Damaged, contaminated, unusable
STOCK_EXPIRED         - Reached expiry date
PRESCRIPTION_DISPENSED - Medication dispensing for prescription
```

## Audit Event Structure

Every movement creates an audit event with:

```json
{
  "eventType": "STOCK_DISPENSED",
  "hospitalId": "uuid",
  "actorId": "user-id",
  "actorRole": "staff",
  "timestamp": "2026-08-17T10:30:00Z",
  "details": {
    "itemId": "item-uuid",
    "batchId": "batch-uuid",
    "quantity": 10,
    "movementId": "MOV-20260817-000042",
    "prescriptionId": "RX-2026-001",
    "patientDid": "did:solana:...",
  },
  "beforeState": {
    "quantity": 50
  },
  "afterState": {
    "quantity": 40
  }
}
```

### Audit Trail Flow

```
User Action (e.g., dispensePrescriptionMedications)
    ↓
RLS Check (verify hospital access)
    ↓
Validate Data (quantities, expiry, availability)
    ↓
Update Batch Quantities
    ↓
CREATE stock_movement (immutable record)
    ↓
tryWriteAudit() → audit_events (blockchain-ready)
    ↓
Realtime Event (stock_movements channel)
    ↓
Dashboard/Alert Updates
```

## Implementation

### Adding Stock

**API Call:**
```typescript
await addStock({
  itemId: "item-uuid",
  batchId: "batch-uuid",
  quantityToAdd: 100,
  reason: "Received from supplier XYZ"
})
```

**Generated Records:**

1. **stock_movements** (INSERT):
   ```
   movement_id: MOV-20260817-000001
   movement_type: received
   quantity_moved: 100
   quantity_before: 0
   quantity_after: 100
   performed_by_id: <staff-user-id>
   performed_by_name: "John Pharmacist"
   performed_by_role: staff
   ```

2. **audit_events** (INSERT):
   ```
   eventType: STOCK_RECEIVED
   hospitalId: <hospital-uuid>
   actorId: <staff-user-id>
   details: { itemId, batchId, quantity: 100, movementId }
   beforeState: { quantity: 0 }
   afterState: { quantity: 100 }
   blockchain_anchor: <pending>
   ```

3. **Realtime Event**: Published on `pharmacy:stock-movements:${hospitalId}` channel

### Dispensing Prescription

**API Call:**
```typescript
await dispensePrescriptionMedications({
  prescriptionId: "RX-2026-001",
  patientDid: "did:solana:...",
  medications: [
    { itemId: "item-uuid", batchId: "batch-uuid", quantityToDispense: 10 }
  ]
})
```

**Generated Records:**

For each medication:

1. **stock_movements** (INSERT):
   ```
   movement_type: dispensed
   prescription_id: RX-2026-001
   patient_did: did:solana:...
   performed_by_role: staff (or doctor)
   ```

2. **audit_events** (INSERT):
   ```
   eventType: PRESCRIPTION_DISPENSED
   details: { prescriptionId, patientDid, itemId, quantity }
   ```

3. **Realtime Event**: Published for dashboard update

## Compliance & Blockchain

### Immutability

- **stock_movements**: Append-only (no updates/deletes except by system)
- **audit_events**: Immutable after creation (blockchain-anchored)
- **REPLICA IDENTITY FULL**: Captures old/new row values for Supabase Realtime

### Blockchain Anchoring

All audit events eligible for Solana blockchain anchoring:

```typescript
// In audit.server.ts → tryWriteAudit()
const auditEntry = {
  eventType: "STOCK_DISPENSED",
  ...details,
  blockchain_anchor: null, // Initially null
  content_hash: SHA256(JSON.stringify(event))
};

// Later: Solana program
solana.program.methods.anchorAuditEvent({
  eventHash: event.content_hash,
  hospitalId: event.hospital_id,
  timestamp: event.timestamp
}).rpc();
```

## Querying Audit Trail

### Get Movement for an Item

```typescript
const movements = await getItemMovements({
  itemId: "item-uuid",
  movementType: "dispensed", // optional filter
  limit: 50
});

// Returns: Complete transaction history with actor info
```

### Get Batch Movements

```typescript
const movements = await getBatchMovements({
  batchId: "batch-uuid",
  limit: 100
});

// Returns: All changes to this batch (received, consumed, wasted, expired)
```

### Get Audit Events (Admin/Compliance)

```typescript
// Via audit.server.ts
const events = await supabase
  .from("audit_events")
  .select("*")
  .eq("hospital_id", hospitalId)
  .eq("eventType", "STOCK_DISPENSED")
  .gte("created_at", startDate)
  .order("created_at", { ascending: false });
```

## Real-time Sync

### Subscribe to Movements

```typescript
import { subscribeToStockMovements } from "@/lib/pharmacy-realtime";

const channel = subscribeToStockMovements(
  hospitalId,
  (movement) => {
    console.log("New movement:", movement);
    // Update dashboard, refresh inventory
  },
  (error) => console.error(error)
);

// Cleanup
await supabase.removeChannel(channel);
```

### React Hook

```typescript
import { usePharmacyRealtime } from "@/lib/pharmacy-realtime";

function PharmacyDashboard() {
  const { movements, stockLevels, expirationAlerts } = usePharmacyRealtime(
    hospitalId,
    {
      movements: true,
      stockLevels: true,
      expirationAlerts: true
    }
  );

  return (
    <div>
      <h3>Latest Movements ({movements.length})</h3>
      {movements.map(mov => <MovementRow key={mov.movement_id} {...mov} />)}
    </div>
  );
}
```

## Compliance Scenarios

### Scenario 1: Drug Recall

**Requirement**: Track all dispensed units of a recalled medication batch

**Query**:
```typescript
const movements = await getItemMovements({
  itemId: "recalled-med-id",
  movementType: "dispensed"
});

// Results:
// - Batch number
// - Patient (via patient_did)
// - Prescription (via prescription_id)
// - Dispensed by (staff name, role, timestamp)
// - Quantity
```

### Scenario 2: Inventory Discrepancy

**Requirement**: Audit trail shows all movements; discrepancy can be investigated

**Process**:
1. Count physical stock → 45 units
2. Query database → 50 units
3. Find movements showing 5-unit waste not recorded
4. Create `adjustStock` entry with reason
5. All recorded in audit_events

### Scenario 3: Wastage Reporting

**Requirement**: Wastage tracking for compliance/cost analysis

**Query**:
```typescript
const wastage = await supabase
  .from("stock_movements")
  .select("quantity_moved, performed_by_name, reason, created_at")
  .eq("hospital_id", hospitalId)
  .eq("movement_type", "wasted")
  .gte("created_at", monthStart)
  .lte("created_at", monthEnd);

// Group by item/batch for reports
```

## Security & Access Control

### RLS Policies

All tables enforce hospital-level isolation:

```sql
-- Example: stock_movements
create policy stock_movements_select on public.stock_movements
  for select to authenticated
  using (
    private.can_access_hospital(hospital_id)
    AND current_user_role() in ('staff', 'doctor', 'admin')
  );
```

### Role-Based Access

| Role | Can View | Can Modify |
|------|----------|-----------|
| Patient | ❌ | ❌ |
| Doctor | ✅ Read-only | Dispense medications |
| Staff | ✅ Full | All operations |
| Admin | ✅ Full + compliance | All operations + audit review |

## Reports & Analytics

### Sample Reports

1. **Daily Consumption Report**
   ```
   Item | Dispensed | Consumed | Wasted | Expired | Total Out
   ```

2. **Low Stock Alert Report**
   ```
   Item | Current | Threshold | Short | Action
   ```

3. **Expiration Monitoring**
   ```
   Item | Batch | Days to Expiry | Quantity | Action Required
   ```

4. **Supplier Performance**
   ```
   Supplier | Orders | On Time | Late | Cost
   ```

5. **Staff Activity Log**
   ```
   Staff | Operations | Quantity Handled | Errors | Date Range
   ```

## Testing

See `PHARMACY_TESTING.md` for end-to-end audit trail tests.
