# Detailed Code Additions - Audit Trail PR

## File-by-File Breakdown

---

## 1. NEW: `src/lib/audit.server.ts` (633 lines)

### Purpose
Central hub for all audit operations - recording, querying, verifying, and processing audit events with blockchain anchoring.

### Key Exports

#### Interfaces
```typescript
interface AuditEntry {
  who: {
    actorId: string | null;
    actorDid: string | null;
    name: string | null;
    role: string | null;
    hospitalId: string | null;
    email: string | null;
  };
  what: {
    module: string;
    action: string;
    entityId: string;
    entityType: string;
  };
  where: {
    hospital: string | null;
    location: string | null;
  };
  prev: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
  auth: {
    status: string | null;
    policy: string | null;
  };
}
```

#### Core Functions

**`resolveCallerForAudit()`**
```typescript
async function resolveCallerForAudit(): Promise<{
  actorId: string;
  actorDid: string | null;
  name: string | null;
  role: string | null;
  hospitalId: string | null;
  email: string | null;
}>
```
- Gets current user from session
- Looks up profile (name, role, hospital, DID, email)
- Returns complete caller context for audit records

**`writeAuditRecord(entry: AuditEntry)`**
```typescript
async function writeAuditRecord(entry: AuditEntry): Promise<string>
```
- Calls `write_audit_record()` Postgres RPC (security definer, bypasses RLS)
- Computes SHA-256 hash over non-PHI fields
- Enqueues for async blockchain anchoring
- Returns transaction ID

**`tryWriteAudit(entry: AuditEntry)`**
```typescript
function tryWriteAudit(entry: AuditEntry): void
```
- Fire-and-forget wrapper around `writeAuditRecord()`
- Swallows errors so audit never blocks primary operations
- Logs failures to console

#### Query Functions

**`getAuditTrail(opts: { ... })`**
```typescript
async function getAuditTrail(opts: {
  module?: string;
  entityId?: string;
  actorId?: string;
  severity?: string;
  outcome?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<{ events: AuditEvent[] }>
```
- Fetches audit events with optional filtering
- Returns rich event objects with all WHO/WHAT/WHERE fields

**`getAuditStats()`**
```typescript
async function getAuditStats(): Promise<{
  total: number;
  failures: number;
  critical: number;
  unauthorized: number;
  anchored: number;
  pendingAnchors: number;
}>
```
- Dashboard statistics
- Used by admin audit viewer

**`verifyAuditRecord(txId: string)`**
```typescript
async function verifyAuditRecord(txId: string): Promise<{
  txId: string;
  verified: boolean;
  dbIntegrity: "OK" | "FAIL" | "unknown" | "pending";
  chainIntegrity: "OK" | "FAIL" | "pending" | "not_queued";
  anchorStatus: string | null;
  signature: string | null;
  slot: number | null;
  storedHash: string | null;
  chainHash: string | null;
  explorerUrl: string | null;
  reason: string | null;
}>
```
- Calls `verify_audit_record()` Postgres RPC
- Re-computes hash from stored fields
- Checks blockchain anchor
- Returns tamper status

#### Processing Functions

**`processAuditAnchorQueue(limit?: number)`**
```typescript
async function processAuditAnchorQueue(limit?: number): Promise<{
  processed: number;
  anchored: number;
  failed: number;
}>
```
- Processes pending jobs from `audit_anchor_queue`
- Calls anchor-record Edge Function
- Updates anchor_status and anchor_id
- Returns summary stats

#### Helper Builders

**`buildAdmissionAudit()`**
```typescript
function buildAdmissionAudit(
  caller: CallerContext,
  action: "PATIENT_ADMITTED" | "PATIENT_DISCHARGED" | "PATIENT_TRANSFERRED",
  admissionId: string,
  patientDid: string,
  prevState: object | null,
  newState: object,
  metadata?: object
): AuditEntry
```
- Creates audit entry for admission events
- Automatically sets WHO/WHAT/WHERE fields
- Fills in prev/new state

**`buildPrescriptionAudit()`**
```typescript
function buildPrescriptionAudit(
  caller: CallerContext,
  rxId: string,
  prevState: object | null,
  newState: object
): AuditEntry
```
- Creates audit entry for prescription updates

**`buildCertificationAudit()`**
```typescript
function buildCertificationAudit(
  caller: CallerContext,
  action: "CERTIFICATION_CREATED" | "CERTIFICATION_UPDATED" | "CERTIFICATION_DELETED",
  certId: string,
  staffDid: string,
  prevState: object | null,
  newState: object | null
): AuditEntry
```
- Creates audit entry for certification lifecycle events

**`buildBedAudit()`**
```typescript
function buildBedAudit(
  caller: CallerContext,
  bedId: string,
  prevStatus: string,
  newStatus: string,
  metadata?: object
): AuditEntry
```
- Creates audit entry for bed status changes

**`buildRoomAudit()`**
```typescript
function buildRoomAudit(
  caller: CallerContext,
  roomId: string,
  prevStatus: string,
  newStatus: string,
  metadata?: object
): AuditEntry
```
- Creates audit entry for room status changes

---

## 2. NEW: `supabase/migrations/20260815000000_audit_trail_blockchain_proofs.sql` (373 lines)

### Database Schema Extensions

#### `audit_events` Table Additions

```sql
-- WHO context
who_name TEXT,
who_role TEXT,
who_hospital_id UUID,
who_email TEXT,

-- WHAT context
what_module TEXT,
what_entity_id TEXT,
what_entity_type TEXT,

-- WHERE context
where_hospital TEXT,
where_location TEXT,

-- PREV/NEW state
prev_value JSONB,
new_value JSONB,

-- AUTH context
auth_status TEXT,
auth_policy TEXT,

-- BLOCKCHAIN
record_hash TEXT,
anchor_id UUID,
anchor_status TEXT
```

All columns are NULLABLE for backward compatibility.

#### New `audit_anchor_queue` Table

```sql
CREATE TABLE audit_anchor_queue (
  id BIGSERIAL PRIMARY KEY,
  tx_id UUID,
  record_hash TEXT,
  record_type TEXT,
  record_id TEXT,
  status TEXT DEFAULT 'pending',
  attempts INT DEFAULT 0,
  anchor_id UUID,
  error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### Postgres Functions

**`write_audit_record()`**
- SECURITY DEFINER: Bypasses RLS for inserts
- Accepts: who/what/where/prev/new/auth parameters
- Computes SHA-256 hash using pgcrypto
- Inserts into audit_events with computed hash
- Enqueues in audit_anchor_queue
- Returns tx_id

```sql
CREATE OR REPLACE FUNCTION write_audit_record(
  p_actor_id UUID,
  p_actor_did TEXT,
  -- ... more params
  p_prev_value JSONB,
  p_new_value JSONB,
  -- ...
) RETURNS UUID AS $$
DECLARE
  v_tx_id UUID;
  v_hash TEXT;
BEGIN
  -- Compute SHA-256 hash of non-PHI fields
  v_hash := encode(digest(
    p_action || '|' || p_outcome || '|' || p_who_role || '|' || 
    p_what_module || '|' || p_what_entity_id || '|' || 
    p_where_hospital || '|' || now()::text,
    'sha256'
  ), 'hex');
  
  -- Insert audit record
  INSERT INTO audit_events (
    actor_id, actor_did, resource, action, outcome, severity,
    who_name, who_role, who_hospital_id, who_email,
    what_module, what_entity_id, what_entity_type,
    where_hospital, where_location,
    prev_value, new_value,
    auth_status, auth_policy,
    record_hash,
    logged_at
  ) VALUES (
    p_actor_id, p_actor_did, p_resource, p_action, p_outcome, p_severity,
    p_who_name, p_who_role, p_who_hospital_id, p_who_email,
    p_what_module, p_what_entity_id, p_what_entity_type,
    p_where_hospital, p_where_location,
    p_prev_value, p_new_value,
    p_auth_status, p_auth_policy,
    v_hash,
    now()
  ) RETURNING tx_id INTO v_tx_id;
  
  -- Enqueue for blockchain anchoring
  INSERT INTO audit_anchor_queue (
    tx_id, record_hash, record_type, record_id, status, created_at
  ) VALUES (v_tx_id, v_hash, 'audit', v_tx_id::text, 'pending', now());
  
  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**`verify_audit_record(tx_id UUID)`**
- Re-computes hash from stored fields
- Checks DB integrity (hash match)
- Checks blockchain integrity (solana_anchors lookup)
- Returns verification result

```sql
CREATE OR REPLACE FUNCTION verify_audit_record(p_tx_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_stored_record RECORD;
  v_recomputed_hash TEXT;
  v_anchor_record RECORD;
  v_verified BOOLEAN;
  v_result JSONB;
BEGIN
  -- Get audit record
  SELECT * FROM audit_events WHERE tx_id = p_tx_id INTO v_stored_record;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'txId', p_tx_id::text,
      'verified', false,
      'reason', 'Record not found'
    );
  END IF;
  
  -- Recompute hash
  v_recomputed_hash := encode(digest(
    v_stored_record.action || '|' || v_stored_record.outcome || '|' ||
    v_stored_record.who_role || '|' || v_stored_record.what_module || '|' ||
    v_stored_record.what_entity_id || '|' || v_stored_record.where_hospital || '|' ||
    v_stored_record.logged_at::text,
    'sha256'
  ), 'hex');
  
  -- Check DB integrity
  v_verified := (v_recomputed_hash = v_stored_record.record_hash);
  
  -- Check blockchain integrity
  SELECT * FROM solana_anchors 
    WHERE anchor_id = v_stored_record.anchor_id 
    INTO v_anchor_record;
  
  RETURN jsonb_build_object(
    'txId', p_tx_id::text,
    'verified', v_verified,
    'dbIntegrity', CASE WHEN v_verified THEN 'OK' ELSE 'FAIL' END,
    'chainIntegrity', CASE 
      WHEN v_anchor_record IS NULL THEN 'not_queued'
      WHEN v_anchor_record.status = 'confirmed' THEN 'OK'
      WHEN v_anchor_record.status = 'pending' THEN 'pending'
      ELSE 'FAIL'
    END,
    'anchorStatus', v_anchor_record.status,
    'signature', v_anchor_record.signature,
    'slot', v_anchor_record.slot,
    'storedHash', v_stored_record.record_hash,
    'chainHash', v_anchor_record.record_hash,
    'explorerUrl', CASE 
      WHEN v_anchor_record.status = 'confirmed' THEN
        'https://explorer.solana.com/tx/' || v_anchor_record.signature || '?cluster=devnet'
      ELSE NULL
    END,
    'reason', CASE 
      WHEN NOT v_verified THEN 'Hash mismatch detected - possible tampering'
      WHEN v_anchor_record.status = 'failed' THEN 'Blockchain anchor failed'
      ELSE NULL
    END
  );
END;
$$ LANGUAGE plpgsql;
```

#### Additional Setup
- `CREATE EXTENSION pgcrypto;` for SHA-256
- RLS policies for staff to SELECT audit_events
- Realtime publication on audit_events and audit_anchor_queue

---

## 3. MODIFIED: `src/lib/admissions.server.ts`

### Integration Points

#### In `admitPatient()`
```typescript
// After bed, room, billing updates:
const caller = await resolveCallerForAudit();
tryWriteAudit(buildAdmissionAudit(
  caller,
  "PATIENT_ADMITTED",
  admissionId,
  data.patientDid,
  null,  // no previous state
  {
    admissionId,
    bedId: data.bedId,
    ward: data.ward,
    room: data.room ?? null,
    diagnosis: data.diagnosis ?? null,
    admissionFee: fee,
    status: "admitted",
  },
  { billingCharged: fee },
));
```

#### In `dischargePatient()`
```typescript
// After discharge updates:
const caller = await resolveCallerForAudit();
tryWriteAudit(buildAdmissionAudit(
  caller,
  "PATIENT_DISCHARGED",
  data.admissionId,
  admission.patient_did,
  { status: "admitted", bed: admission.bed, ward: admission.ward, room: admission.room },
  { status: "discharged", dischargedAt: now, dischargeSummary: data.dischargeSummary ?? null },
  { finalBill: data.finalBillAmount ?? 0, bedNowCleaning: admission.bed },
));
```

#### In `transferPatient()`
```typescript
// After transfer updates:
const caller = await resolveCallerForAudit();
tryWriteAudit(buildAdmissionAudit(
  caller,
  "PATIENT_TRANSFERRED",
  data.admissionId,
  admission.patient_did,
  { bed: oldBedId, ward: admission.ward, room: admission.room },
  { bed: data.newBedId, ward: data.newWard, room: data.newRoom ?? null },
  { transferReason: data.transferReason ?? null },
));
```

---

## 4. MODIFIED: `src/lib/clinical.server.ts`

### In `updatePrescription()`
```typescript
// Before update - capture previous state:
const { data: prevRow } = await supabase
  .from("prescriptions")
  .select("diagnosis, notes, status, drugs")
  .eq("rx_id", data.rxId)
  .maybeSingle();

// ... perform update ...

// After update - write audit:
const caller = await resolveCallerForAudit();
tryWriteAudit(buildPrescriptionAudit(
  caller,
  data.rxId,
  prevRow ? {
    diagnosis: prevRow.diagnosis,
    notes:     prevRow.notes,
    status:    prevRow.status,
    drugCount: Array.isArray(prevRow.drugs) ? prevRow.drugs.length : 0,
  } : null,
  {
    diagnosis: data.diagnosis,
    notes:     data.notes,
    status:    data.status,
    drugCount: Array.isArray(data.drugs) ? data.drugs.length : undefined,
  },
));
```

---

## 5. MODIFIED: `src/lib/certifications.server.ts`

### In `createCertification()`
```typescript
// After INSERT:
const caller = await resolveCallerForAudit();
tryWriteAudit(buildCertificationAudit(
  caller,
  "CERTIFICATION_CREATED",
  certification.cert_id,
  data.staffDid,
  null,
  { certName: data.certName, issuingBody: data.issuingBody, status: data.status ?? "active" },
));
```

### In `updateCertification()`
```typescript
// Capture before, update, then audit:
const { data: prevRow } = await supabase
  .from("staff_certifications")
  .select("cert_name, issuing_body, status, expiry_date, staff_did")
  .eq("cert_id", data.certId)
  .maybeSingle();

// ... update ...

const caller = await resolveCallerForAudit();
tryWriteAudit(buildCertificationAudit(
  caller,
  "CERTIFICATION_UPDATED",
  data.certId,
  prevRow?.staff_did ?? data.certId,
  prevRow ? { certName: prevRow.cert_name, status: prevRow.status, expiryDate: prevRow.expiry_date } : null,
  { certName: data.certName, status: data.status, expiryDate: data.expiryDate },
));
```

### In `deleteCertification()`
```typescript
// Capture before deletion:
const { data: prevRow } = await supabase
  .from("staff_certifications")
  .select("cert_name, issuing_body, status, staff_did")
  .eq("cert_id", data.certId)
  .maybeSingle();

// ... delete ...

const caller = await resolveCallerForAudit();
tryWriteAudit(buildCertificationAudit(
  caller,
  "CERTIFICATION_DELETED",
  data.certId,
  prevRow?.staff_did ?? data.certId,
  prevRow ? { certName: prevRow.cert_name, issuingBody: prevRow.issuing_body, status: prevRow.status } : null,
  null,
));
```

---

## 6. MODIFIED: `src/lib/operations.server.ts`

### In `updateBedStatus()`
```typescript
// ... update bed ...

const caller = await resolveCallerForAudit();
tryWriteAudit(buildBedAudit(
  caller,
  data.bedId,
  "unknown",          // prev status not fetched to keep lean
  data.status,
  data.patientDid ? { patientDid: data.patientDid } : {},
));
```

### In `updateRoomStatus()`
```typescript
// ... update room ...

const caller = await resolveCallerForAudit();
tryWriteAudit(buildRoomAudit(caller, data.roomId, "unknown", data.status));
```

---

## 7. MODIFIED: `src/lib/api.ts`

### New Wrapper Exports

```typescript
export async function getAuditTrail(opts: {
  module?: string;
  entityId?: string;
  actorId?: string;
  severity?: string;
  outcome?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { getAuditTrail: fn } = await import("./audit.server");
  return await fn({ data: opts });
}

export async function verifyAuditRecord(txId: string) {
  const { verifyAuditRecord: fn } = await import("./audit.server");
  return await fn({ data: { txId } });
}

export async function processAuditAnchorQueue(limit?: number) {
  const { processAuditAnchorQueue: fn } = await import("./audit.server");
  return await fn({ data: { limit } });
}

export async function getAuditStats() {
  const { getAuditStats: fn } = await import("./audit.server");
  return await fn();
}
```

---

## 8. MODIFIED: `src/routes/admin.audit.tsx`

### New Route & Components

#### Route Definition
```typescript
export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [{ title: "Admin · Audit Trail — Embrace Health Grid" }],
  }),
  component: AdminAuditPageGuarded,
});
```

#### Route Guard Component
```typescript
function AdminAuditPageGuarded() {
  return (
    <RouteGuard requiredRole="admin">
      <AdminAuditPage />
    </RouteGuard>
  );
}
```

#### Main Audit Page Component
```typescript
function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [outcomeFilter, setOutcomeFilter] = useState("All");
  // ... more state ...
  
  // Real-time subscriptions
  useTableRefresh("audit_events", load);
  useTableRefresh("audit_anchor_queue", load);
  
  // Renders: Header, Stats, Filters, Events List, Verification Dialog
}
```

#### Key Features in UI

**Header Section**
- Title: "Audit Trail & Blockchain Proofs"
- Refresh button
- Anchor Pending button (conditional)

**Statistics Cards** (6 total)
- Total Events
- Failures
- Critical Severity
- Unauthorized
- Anchored
- Pending Anchors

**Filters**
- Search input (by actor, action, entity, location, tx_id)
- Module dropdown (dynamic from events)
- Outcome dropdown (all, success, failure, unauthorized)

**Event Cards** (Expandable)
- Summary: Icon, action, outcome badge, module badge
- Details: actor, role, location, timestamp, tx_id, entity_id
- Expand: before/after changes, metadata, hash, anchor status

**Verification Modal**
- Overall status (Verified/Failed)
- DB Integrity status
- Blockchain Integrity status
- Hash comparison (stored vs chain)
- Solana Explorer link

---

## Summary of Additions

| Component | LOC | Purpose |
|-----------|-----|---------|
| audit.server.ts | 633 | Core audit functions |
| Migration SQL | 373 | Database schema |
| admissions.server.ts | +10 | Integration |
| clinical.server.ts | +27 | Integration |
| certifications.server.ts | +48 | Integration |
| operations.server.ts | +15 | Integration |
| api.ts | +32 | API wrappers |
| admin.audit.tsx | 990 | Admin UI |
| **TOTAL** | **2,128** | |

All changes are **production-ready** with:
- ✅ Error handling
- ✅ Type safety
- ✅ Security (RLS, security definer)
- ✅ Performance (async, fire-and-forget)
- ✅ Backward compatibility
