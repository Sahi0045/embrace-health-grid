# Embedded Wallet Integration — Quick Start Guide
## For Developers: 5-Minute Overview

---

## 🎯 The Problem We're Solving

Health Grid users (patients, doctors, staff) need their medical records cryptographically secured on blockchain **without knowing about wallets or private keys**.

### Current State
- ✅ Medical records stored in Postgres (centralized)
- ❌ No blockchain proof of authenticity
- ❌ No way for patients to verify records haven't been tampered with

### After Integration
- ✅ Medical records stored in Postgres (same)
- ✅ **Hash of records anchored to Solana blockchain** (proof of immutability)
- ✅ Patients can verify records in Solana Explorer
- ✅ Users see no blockchain complexity (fully hidden)

---

## 🏗️ Three Layers (Simple Version)

```
┌─────────────────────────────────────┐
│    Health Grid App (User sees)       │
│  - Dispense prescription button      │
│  - View medical history              │
│  - No wallet/blockchain visible      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Wallet Service (Backend manages)   │
│  - Create wallets automatically      │
│  - Store encrypted private keys      │
│  - Sign transactions server-side     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Solana Blockchain (Immutable)      │
│  - Records anchored with SHA-256     │
│  - Publicly verifiable               │
│  - Users can check Solana Explorer   │
└─────────────────────────────────────┘
```

---

## 💼 The Two Types of Wallets

### 1. Hospital Master Wallet
- **Purpose**: Pays transaction fees for all operations
- **Ownership**: Hospital (admin-managed)
- **Storage**: Encrypted in Supabase
- **Visibility**: Never exposed to users
- **Example Use**: Hospital pays to anchor prescription dispensing records

### 2. Patient Wallets (Derived)
- **Purpose**: Patient's identity on blockchain
- **Ownership**: Patient (derived deterministically)
- **Storage**: Not stored (derived on-demand from patient DID + hospital secret)
- **Visibility**: Patient sees public key only (if they want proof)
- **Example Use**: Prescription record linked to patient's Solana address

```
Patient DID: did:solana:8Pv...
Hospital ID: hosp-123
Master Secret: [encrypted in DB]
                │
                ├─ Combine using BIP44
                │
                ▼
Patient Wallet: 8R4k... (derived, same every time)
```

---

## 🔄 Request Flow: "Dispense Medication"

```
1. Staff Portal: Click "Dispense Medication" button
   └─ Sends: { prescriptionId, quantity }

2. Backend (pharmacy.server.ts):
   ├─ Create stock movement in Postgres
   ├─ Calculate hash: SHA-256(movement_data)
   └─ Call: await SolanaBlockchainService.anchorRecord(hash)

3. Blockchain Service:
   ├─ Get hospital wallet (encrypted)
   ├─ Build Solana transaction
   ├─ Sign transaction with hospital keypair
   ├─ Send to Solana RPC
   ├─ Wait for confirmation
   └─ Return: transactionId

4. Backend (continued):
   ├─ Save transactionId in Postgres
   └─ Return success to frontend

5. Staff Portal: Shows "✓ Anchored to blockchain"
   ├─ Small badge with explorer link
   └─ User can click to see proof on Solana Explorer
```

---

## 📁 Files to Create

### Phase 1: Wallet Infrastructure

**File**: `src/lib/embedded-wallet.server.ts`
```typescript
// Main wallet service
export async function getOrCreateHospitalWallet(hospitalId: string) {
  // Check if exists in DB
  // If yes: decrypt & return
  // If no: generate new, encrypt, store, return
}

export async function derivePatientWallet(patientDid: string, hospitalId: string) {
  // Derive deterministically from: patientDid + hospitalId + master_secret
  // Result: Same wallet every time for same inputs
}

export async function getProgramDerivedAddress(
  patientDid: string,
  recordType: string,
  hospitalId: string
) {
  // Get a unique Solana account for this patient's record
  // Used for on-chain storage
}
```

**File**: `supabase/migrations/20260818_embedded_wallets.sql`
```sql
CREATE TABLE embedded_wallets (
  wallet_id UUID PRIMARY KEY,
  hospital_id UUID REFERENCES hospitals,
  owner_type TEXT, -- 'hospital' or 'patient'
  owner_id TEXT,   -- hospital_id or patient_did
  public_key TEXT,
  encrypted_private_key TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE blockchain_operations (
  operation_id UUID PRIMARY KEY,
  hospital_id UUID REFERENCES hospitals,
  solana_tx_id TEXT,
  status TEXT,    -- 'pending', 'confirmed', 'failed'
  created_at TIMESTAMPTZ
);
```

---

### Phase 2: Blockchain Integration

**File**: `src/lib/solana-blockchain.server.ts`
```typescript
export async function anchorMedicalRecord(params: {
  patientDid: string,
  recordType: string,
  recordHash: string,
  hospitalId: string,
  metadata?: Record<string, unknown>
}): Promise<string> {
  // 1. Get hospital wallet
  // 2. Build transaction
  // 3. Sign with hospital keypair
  // 4. Send to Solana
  // 5. Return txId
}

export async function verifyAnchoredRecord(txId: string) {
  // Query Solana blockchain
  // Return: { verified, slot, signature, explorerUrl }
}
```

**File**: `src/lib/solana-transaction.server.ts`
```typescript
// Helper to build & sign Solana transactions
export class TransactionBuilder {
  constructor(rpcUrl: string) { }
  
  addAnchorRecordInstruction(params) { }
  addMemoInstruction(memo: string) { }
  sign(keypairs) { }
  sendAndConfirm() { }
}
```

**File**: `src/lib/solana-config.server.ts`
```typescript
export const SOLANA_CONFIG = {
  rpcUrl: process.env.SOLANA_RPC_URL,
  network: 'devnet' | 'testnet' | 'mainnet',
  programId: '...',
  // ...
};
```

---

### Phase 3: Integration with Existing APIs

**Modify**: `src/lib/audit.server.ts`
```typescript
// Current code (existing)
export async function writeAuditRecord(entry: AuditEntry) {
  const auditRow = await db.write_audit_record(entry);
  return { txId: auditRow.id, recordHash: auditRow.recordHash };
}

// NEW: Add blockchain integration
export async function writeAuditRecord(entry: AuditEntry) {
  const auditRow = await db.write_audit_record(entry);
  
  // NEW CODE:
  const blockchainTxId = await SolanaBlockchainService.anchorMedicalRecord({
    patientDid: entry.actorDid,
    recordType: entry.module,
    recordHash: auditRow.recordHash,
    hospitalId: entry.hospital,
    metadata: entry.metadata
  });
  
  return { 
    txId: auditRow.id, 
    recordHash: auditRow.recordHash,
    blockchainTxId: blockchainTxId // NEW
  };
}
```

**Modify**: `src/lib/pharmacy.server.ts`
```typescript
// Current code
export async function dispensePrescriptionMedications(
  prescriptionId: string,
  hospitalId: string
) {
  // Create stock movements
  // ... existing code ...
}

// NEW: After creating movements, anchor to blockchain
// (handled by audit system automatically)
```

---

## 🔐 Security Checklist

- [ ] Private keys encrypted at rest (AES-256-GCM)
- [ ] Private keys never sent to client/frontend
- [ ] Private keys only decrypted in-memory for signing
- [ ] Hospital wallet rotation every 3 months
- [ ] Patient wallets derived (never stored)
- [ ] All blockchain operations logged & auditable
- [ ] RLS policies enforce hospital-level isolation
- [ ] Encryption keys rotated regularly

---

## 🧪 Testing Approach

### Local Testing (No Blockchain)
```typescript
// Mock SolanaBlockchainService for unit tests
jest.mock('./solana-blockchain.server.ts');
SolanaBlockchainService.anchorMedicalRecord.mockResolvedValue('mock-tx-id-123');

// Test that audit system calls blockchain service
it('should call blockchain service when writing audit', async () => {
  await writeAuditRecord({ /* ... */ });
  expect(SolanaBlockchainService.anchorMedicalRecord).toHaveBeenCalled();
});
```

### Integration Testing (Devnet)
```typescript
// Connect to Solana Devnet for integration tests
// Run full flow: create record → anchor → verify
it('should anchor record to Devnet', async () => {
  const txId = await SolanaBlockchainService.anchorMedicalRecord({
    patientDid: 'test-did',
    recordType: 'prescription',
    recordHash: 'abc123...',
    hospitalId: 'test-hosp'
  });
  
  // Verify on-chain
  const result = await SolanaBlockchainService.verifyAnchoredRecord(txId);
  expect(result.verified).toBe(true);
});
```

---

## 🚀 Deployment Phases

**Phase 1** (Week 1-2): Wallet service
- Wallet generation & storage ✅
- Key encryption & rotation ✅

**Phase 2** (Week 3-4): Blockchain service
- Transaction building ✅
- Signing & confirmation ✅

**Phase 3** (Week 5-6): Deploy Anchor program
- Smart contract on Devnet ✅
- IDL generation ✅

**Phase 4** (Week 7-8): Backend integration
- Modify audit.server.ts ✅
- Modify pharmacy.server.ts ✅

**Phase 5** (Week 9-10): UI
- Add verification badges ✅
- Add explorer links ✅

**Phase 6** (Week 11-12): Testing & hardening
- Security audit ✅
- Load testing ✅
- Mainnet preparation ✅

---

## 🎓 Key Concepts

### Keypair
A pair of keys (public + private) that identify someone on Solana.
- **Public key** = address (like email, can be shared)
- **Private key** = password (secret, never shared)

### Transaction
Instructions sent to Solana to do something (e.g., anchor a record).
- Built on client/server
- Signed with private key
- Sent to network
- Confirmed by validators

### Program ID
Address of a smart contract deployed on Solana.
- Health Grid Program: Deployed at specific address
- Contains our custom logic for anchoring medical records

### Program Derived Address (PDA)
A unique account generated deterministically from seed + program ID.
- Same input → same PDA
- Used to store data on-chain
- Doesn't have a private key (derivable by anyone)

### Anchor Framework
Tools for building Solana programs (smart contracts) in Rust.
- Handles boilerplate code
- Account management
- Error handling
- Serialization/deserialization

---

## 📊 Transaction Flow Diagram

```
┌─ Dispense Prescription ─┐
│                         │
└──────────┬──────────────┘
           │
           ▼
    ┌──────────────┐
    │ Create Stock │
    │  Movement    │ ← Existing Postgres code
    └──────┬───────┘
           │
           ▼
    ┌──────────────────┐
    │  Calculate SHA   │
    │  256 Hash        │
    └──────┬───────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Build Solana Transaction │
    │  - Program: health_grid  │
    │  - Instruction: anchor   │
    │  - Data: record hash     │
    └──────┬───────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Get Hospital Wallet      │
    │ (decrypt private key)    │
    └──────┬───────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Sign Transaction         │
    │ (with hospital keypair)  │
    └──────┬───────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Send to Solana RPC       │
    │ (via RPC endpoint)       │
    └──────┬───────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Wait for Confirmation    │
    │ (30-32 slots)            │
    └──────┬───────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Return TX ID             │
    │ Save in Postgres         │
    └──────┬───────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Show to User             │
    │ "✓ Anchored on Solana"   │
    └──────────────────────────┘
```

---

## ❓ FAQ

**Q: What if Solana network is down?**
A: Records still saved in Postgres. Blockchain anchoring retries with exponential backoff. Users can manually retry from admin panel.

**Q: What if hospital loses the master wallet key?**
A: Key is encrypted in Supabase. If encryption key is lost, hospital must go through recovery process (requires multiple admin approvals).

**Q: Can patients see their private keys?**
A: No. Patient wallets are derived on-demand, never stored. Patients only see their public address (if they ask).

**Q: How much does it cost?**
A: Solana transaction costs ~0.00025 SOL (~$0.01-0.05). Hospital master wallet pays all fees.

**Q: Can I test without spending money?**
A: Yes! Use Solana Devnet (free airdrop of fake SOL). Perfect for development/testing.

**Q: How do I verify a record?**
A: Get transaction ID → Search Solana Explorer → See on-chain proof of record hash and timestamp.

---

## 🔗 Resources

- Full Implementation Plan: `docs/EMBEDDED_WALLET_IMPLEMENTATION_PLAN.md`
- Pharmacy System Docs: `docs/PHARMACY_IMPLEMENTATION_SUMMARY.md`
- Solana Docs: https://docs.solana.com/
- Anchor Book: https://www.anchor-lang.com/docs/intro

