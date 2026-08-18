# Embedded Wallet Integration Plan for Health Grid
## Non-Blockchain Users on Solana — Complete Implementation Guide

---

## 📋 Executive Summary

This plan provides **embedded wallet integration** for Health Grid users who don't understand blockchain or wallets. The goal is **zero blockchain friction**:

- ✅ Users **never see wallet addresses, private keys, or transaction hashes**
- ✅ Wallets are **automatically created and managed** (hidden from users)
- ✅ Blockchain operations happen **transparently in the background**
- ✅ Users experience **simple, familiar health system workflows**
- ✅ Compliance & audit trail **automatically anchored to Solana**

### Use Cases
1. **Patient Medical Records** - Patients own their encrypted health data on-chain
2. **Prescription History** - Tamper-proof drug dispensing audit trail
3. **Consent Management** - Immutable proof of patient consent
4. **Insurance Claims** - Verifiable proof of treatments & procedures
5. **Doctor Credentials** - Verifiable healthcare provider licenses on-chain

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│  (Admin Portal, Staff Portal, Patient App)                      │
│  Users see: "Save Record" buttons, no wallet/chain mention      │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│           Application Business Logic Layer                      │
│  (audit.server.ts, pharmacy.server.ts, admissions.server.ts)   │
│  Calls: writeAuditRecord(), dispenseMedication(), etc.         │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│     Embedded Wallet Management Layer (NEW)                      │
│  - HospitalWalletService: Manage hospital master wallet         │
│  - PatientWalletService: Generate patient wallet DIDs           │
│  - ProgramDerivedAddress (PDA): Unique account per patient/item │
│  - Transaction Signing: Automatic key management                │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│          Solana Blockchain Abstraction Layer (NEW)              │
│  - SolanaBlockchainService: Anchor records to on-chain          │
│  - ProgramInstructions: SPL token, metadata, on-chain storage   │
│  - TransactionBuilder: Compose and sign transactions            │
│  - Confirmation: Monitor tx status (confirmation, finality)     │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Solana Blockchain Network                          │
│  - Mainnet | Testnet | Devnet (configurable)                   │
│  - Health Grid Program: Custom program for health records       │
│  - SPL Tokens: Health tokens for incentives                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Components & Responsibilities

### 1. **Embedded Wallet Service** (`src/lib/embedded-wallet.server.ts`)

**Responsibility**: Create, store, and manage wallets for users without exposing keys

```typescript
// Examples (pseudocode for now)

// Hospital Master Wallet
const hospitalWallet = await EmbeddedWalletService.getOrCreateHospitalWallet(hospitalId);
// Result: { publicKey, encryptedPrivateKey, createdAt, ... }
// Private key NEVER leaves server, NEVER sent to client

// Patient Wallet (derived from patient DID + hospital master)
const patientWallet = await EmbeddedWalletService.derivePatientWallet(patientDid, hospitalId);
// Result: Deterministic wallet derived from patient DID + hospital secret
// Same input → same wallet (reproducible)

// Program Derived Address (PDA) for storing records
const recordPDA = await EmbeddedWalletService.getProgramDerivedAddress(
  patientDid,
  recordType, // "prescription", "diagnosis", "insurance_claim"
  hospitalId
);
// Result: A unique Solana account address for this patient's record
```

**Storage**: Encrypted in Supabase with hospital-level isolation

```sql
-- Table: embedded_wallets
CREATE TABLE embedded_wallets (
  wallet_id UUID PRIMARY KEY,
  hospital_id UUID NOT NULL REFERENCES hospitals,
  owner_type ENUM ('hospital', 'patient'), -- who owns it
  owner_id TEXT NOT NULL, -- hospital_id or patient_did
  public_key TEXT NOT NULL UNIQUE, -- Solana address
  encrypted_private_key TEXT NOT NULL, -- AES-256 encrypted
  encryption_key_hash TEXT, -- For rotation
  derivation_path TEXT, -- m/44'/501'/...' (BIP44)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  
  CONSTRAINT unique_owner UNIQUE (hospital_id, owner_type, owner_id)
);
```

---

### 2. **Solana Blockchain Service** (`src/lib/solana-blockchain.server.ts`)

**Responsibility**: Handle all on-chain operations (transactions, confirmations, verification)

```typescript
// Examples

// Anchor a medical record
const txId = await SolanaBlockchainService.anchorMedicalRecord({
  patientDid: "did:solana:...",
  recordType: "prescription", // Type of record
  recordHash: "sha256_hash_of_record",
  hospitalId: "hospital_uuid",
  metadata: {
    drainIssuer: "doctor_did",
    timestamp: now(),
    action: "PRESCRIPTION_DISPENSED"
  }
});
// Result: txId (can verify on-chain explorer)

// Verify record on-chain
const verified = await SolanaBlockchainService.verifyAnchoredRecord(txId);
// Result: { verified: true, slot: 123456, signature: "...", explorerUrl: "..." }

// Get record history from blockchain
const history = await SolanaBlockchainService.getRecordHistory(patientDid);
// Result: All records ever anchored for this patient
```

---

### 3. **Transaction Builder & Signing** (`src/lib/solana-transaction.server.ts`)

**Responsibility**: Construct transactions and sign them server-side (no client involvement)

```typescript
// Examples

// Create transaction to anchor prescription
const tx = new TransactionBuilder(solanaRpcUrl)
  .addAnchorRecordInstruction({
    programId: HEALTH_GRID_PROGRAM_ID,
    payer: hospitalWallet.publicKey, // Hospital pays fees
    recordAccount: recordPDA, // Where to store record
    recordHash: "hash...",
    metadata: {...}
  })
  .addMemoInstruction("Health Grid - Prescription RX-123") // For explorer readability
  .setFeePayer(hospitalWallet.publicKey);

// Sign transaction with embedded wallet private key (never exposed)
const signedTx = await tx.sign([hospitalWallet.keypair]);
// keypair is in-memory, derived from encrypted storage, never sent to client

// Send & wait for confirmation
const result = await tx.sendAndConfirm({
  confirmation: "confirmed", // Wait for 30+ slots
  maxRetries: 5,
  timeout: 60000
});
// Result: { txId, slot, signature, confirmed: true }
```

---

### 4. **Health Grid Solana Program** (Smart Contract on-chain)

**Responsibility**: On-chain storage of medical records with access control

```rust
// Simplified pseudocode of what's deployed to Solana
// File: anchor/programs/health_grid_anchor/src/lib.rs

#[program]
pub mod health_grid {
    use super::*;

    // Anchor a medical record
    pub fn anchor_record(
        ctx: Context<AnchorRecord>,
        record_type: String,         // "prescription", "diagnosis", etc.
        record_hash: [u8; 32],       // SHA-256 hash of record
        metadata_hash: [u8; 32],     // Additional metadata hash
    ) -> Result<()> {
        let record_account = &mut ctx.accounts.record_account;
        record_account.patient_did = ctx.accounts.patient_did.key();
        record_account.hospital_id = ctx.accounts.hospital.key();
        record_account.record_type = record_type;
        record_account.record_hash = record_hash;
        record_account.metadata_hash = metadata_hash;
        record_account.created_at = Clock::get()?.unix_timestamp;
        record_account.confirmed = false;
        
        emit!(RecordAnchored {
            patient_did: ctx.accounts.patient_did.key(),
            record_hash,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    // Verify record integrity
    pub fn verify_record(
        ctx: Context<VerifyRecord>,
        expected_hash: [u8; 32],
    ) -> Result<bool> {
        let record = &ctx.accounts.record_account;
        Ok(record.record_hash == expected_hash)
    }
}

// Record Account Structure (stored on-chain)
#[account]
pub struct MedicalRecord {
    pub patient_did: Pubkey,           // Patient identity
    pub hospital_id: Pubkey,           // Which hospital
    pub record_type: String,           // Type of record
    pub record_hash: [u8; 32],         // Content hash
    pub metadata_hash: [u8; 32],       // Additional metadata
    pub created_at: i64,               // Timestamp
    pub created_by: Pubkey,            // Doctor/Staff who created it
    pub confirmed: bool,               // Finalized on-chain
    pub bump: u8,                      // Seed for PDA derivation
}
```

---

## 📊 Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Build wallet infrastructure without breaking existing code

**Tasks**:
- [ ] Create `EmbeddedWalletService` (wallet generation, storage, encryption)
- [ ] Create database table `embedded_wallets` in Supabase
- [ ] Implement wallet key derivation (deterministic patient wallets)
- [ ] Add RLS policies for wallet isolation
- [ ] Unit tests for wallet creation & derivation
- [ ] Documentation: Wallet architecture & security model

**Deliverables**:
- `src/lib/embedded-wallet.server.ts` (200-300 lines)
- `supabase/migrations/20260818_embedded_wallets.sql`
- Test suite for wallet operations

---

### Phase 2: Blockchain Integration (Weeks 3-4)
**Goal**: Build Solana blockchain abstraction layer

**Tasks**:
- [ ] Create `SolanaBlockchainService` (RPC calls, transaction building)
- [ ] Implement transaction builder with instruction support
- [ ] Add transaction signing with embedded wallet keys
- [ ] Implement confirmation & finality monitoring
- [ ] Error handling & retry logic for blockchain failures
- [ ] Testnet integration & manual testing
- [ ] Unit tests for blockchain operations

**Deliverables**:
- `src/lib/solana-blockchain.server.ts` (400-500 lines)
- `src/lib/solana-transaction.server.ts` (200-300 lines)
- `src/lib/solana-config.server.ts` (network, program IDs, RPC)
- Test suite & debugging guide

---

### Phase 3: Anchor Program Deployment (Weeks 5-6)
**Goal**: Deploy Health Grid Anchor program to Solana

**Tasks**:
- [ ] Build Health Grid Anchor program (Rust, Anchor framework)
- [ ] Define on-chain data structures (MedicalRecord, etc.)
- [ ] Implement on-chain verification logic
- [ ] Deploy to Devnet for testing
- [ ] Test anchor_record instruction from client
- [ ] Write on-chain tests
- [ ] Generate IDL (Interface Definition Language) for client

**Deliverables**:
- Anchor program in `anchor/programs/health_grid/`
- IDL file for TS/JS client generation
- Deployment scripts

---

### Phase 4: Backend Integration (Weeks 7-8)
**Goal**: Integrate blockchain operations into existing Health Grid APIs

**Tasks**:
- [ ] Modify `audit.server.ts` to call `SolanaBlockchainService`
- [ ] Modify `pharmacy.server.ts` to anchor stock movements
- [ ] Modify `admissions.server.ts` to anchor patient admits
- [ ] Add blockchain status tracking (pending, confirmed, failed)
- [ ] Create audit log for blockchain operations
- [ ] Integration tests with mock blockchain
- [ ] E2E tests with actual Devnet

**Changes**:
```typescript
// Example: Existing code in audit.server.ts
export async function writeAuditRecord(entry: AuditEntry): Promise<AuditResult> {
  // 1. Write to Postgres (existing)
  const auditRow = await db.write_audit_record(entry);
  
  // 2. NEW: Queue for blockchain anchoring
  const blockchainTxId = await SolanaBlockchainService.anchorMedicalRecord({
    patientDid: entry.actorDid,
    recordType: entry.module,
    recordHash: auditRow.recordHash,
    hospitalId: entry.hospital,
    metadata: entry.metadata
  });
  
  return {
    txId: auditRow.id,
    blockchainTxId, // NEW
    recordHash: auditRow.recordHash,
    anchorQueued: true
  };
}
```

---

### Phase 5: UI/UX (Weeks 9-10)
**Goal**: Add blockchain awareness to user interfaces (without exposing blockchain)

**Tasks**:
- [ ] Add "Anchored to blockchain" badges on records
- [ ] Add verification modal (show proof, explorer link)
- [ ] Add blockchain status indicator (pending → confirmed)
- [ ] Create settings page for blockchain network (Devnet/Testnet/Mainnet)
- [ ] Add blockchain error handling (network failures, transaction fails)
- [ ] Create admin dashboard for blockchain stats

**Example Component**:
```tsx
// RecordVerificationBadge.tsx
export function RecordVerificationBadge({ recordId, blockchainTxId }) {
  const [status, setStatus] = useState('pending');
  const [explorerUrl, setExplorerUrl] = useState(null);

  useEffect(() => {
    if (!blockchainTxId) return;
    
    // Check blockchain status
    SolanaBlockchainService.verifyAnchoredRecord(blockchainTxId)
      .then(result => {
        setStatus(result.verified ? 'verified' : 'failed');
        setExplorerUrl(result.explorerUrl);
      });
  }, [blockchainTxId]);

  return (
    <div className="flex items-center gap-2">
      {status === 'pending' && <Spinner />}
      {status === 'verified' && (
        <>
          <CheckCircle className="text-green-500" />
          <span>Verified on blockchain</span>
          <a href={explorerUrl} target="_blank" className="text-blue-500">
            View on Solana Explorer
          </a>
        </>
      )}
      {status === 'failed' && <XCircle className="text-red-500" />}
    </div>
  );
}
```

---

### Phase 6: Testing & Hardening (Weeks 11-12)
**Goal**: Comprehensive testing before production

**Tasks**:
- [ ] Security audit of embedded wallet implementation
- [ ] Penetration testing of key storage
- [ ] Load testing (1000s of transactions/day)
- [ ] Disaster recovery testing (key loss, blockchain failure)
- [ ] Mainnet dry-run (sandboxed)
- [ ] Documentation: Operations runbook, troubleshooting guide
- [ ] Compliance review (HIPAA, SOC2, etc.)

---

## 🔐 Security Considerations

### 1. Private Key Protection
```typescript
// ❌ BAD: Store plaintext
localStorage.setItem('privateKey', privateKey);

// ✅ GOOD: Encrypt at rest, decrypt in-memory only
const encrypted = await encrypt(privateKey, masterKey); // AES-256
await db.saveEncryptedWallet(encrypted);

// At runtime:
const decrypted = await decrypt(encrypted, masterKey); // ← In-memory only
const keypair = Keypair.fromSecretKey(decrypted);
// Use keypair to sign transaction
// ← Immediately discard from memory after use
```

### 2. Hospital Master Wallet
- Single hospital wallet pays all transaction fees
- Never exposed to client/frontend
- Regenerated periodically (key rotation)
- Secured with encryption + access controls

### 3. Patient Wallet Derivation
- Derived deterministically from: patient_did + hospital_id + master_seed
- Same inputs → same wallet (reproducible)
- Patient privacy: Each hospital gets different patient wallet for same patient
- No patient private key ever stored

### 4. Access Control
```sql
-- Only hospital admin can view/use embedded wallets
CREATE POLICY embedded_wallets_access ON embedded_wallets
  FOR SELECT TO authenticated
  USING (
    hospital_id IN (
      SELECT hospital_id FROM hospital_staff 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'blockchain_operator')
    )
  );
```

### 5. Audit Trail
- All blockchain operations logged in `blockchain_operations` table
- Who initiated the transaction
- What was anchored (record hash, not content)
- Status (pending → confirmed → finalized)
- Any failures/retries

---

## 💾 Database Schema

### Table 1: `embedded_wallets`
```sql
CREATE TABLE embedded_wallets (
  wallet_id UUID PRIMARY KEY,
  hospital_id UUID NOT NULL REFERENCES hospitals,
  owner_type TEXT CHECK (owner_type IN ('hospital', 'patient')),
  owner_id TEXT NOT NULL,
  public_key TEXT NOT NULL UNIQUE,
  encrypted_private_key TEXT NOT NULL,
  encryption_key_version INT,
  derivation_path TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rotated_at TIMESTAMPTZ,
  
  UNIQUE (hospital_id, owner_type, owner_id)
);
```

### Table 2: `blockchain_operations`
```sql
CREATE TABLE blockchain_operations (
  operation_id UUID PRIMARY KEY,
  hospital_id UUID NOT NULL REFERENCES hospitals,
  wallet_id UUID NOT NULL REFERENCES embedded_wallets,
  
  -- What
  operation_type TEXT, -- 'anchor_record', 'mint_nft', 'transfer_spl'
  solana_tx_id TEXT UNIQUE,
  program_id TEXT,
  instruction TEXT,
  
  -- Status
  status TEXT CHECK (status IN ('pending', 'sent', 'confirmed', 'finalized', 'failed')),
  confirmation_status TEXT,
  confirmation_count INT DEFAULT 0,
  
  -- Result
  slot INT,
  signature TEXT,
  error_message TEXT,
  
  -- Metadata
  related_record_hash TEXT,
  metadata JSONB,
  
  created_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ
);
```

### Table 3: `blockchain_verification`
```sql
CREATE TABLE blockchain_verification (
  verification_id UUID PRIMARY KEY,
  hospital_id UUID NOT NULL REFERENCES hospitals,
  operation_id UUID NOT NULL REFERENCES blockchain_operations,
  
  -- Original data
  expected_hash TEXT,
  expected_metadata TEXT,
  
  -- Blockchain verification
  on_chain_hash TEXT,
  on_chain_metadata TEXT,
  verified BOOLEAN,
  verification_timestamp TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ
);
```

---

## 🚀 API Reference

### Embedded Wallet Service

```typescript
// Get or create hospital master wallet
await EmbeddedWalletService.getOrCreateHospitalWallet(hospitalId): Promise<Wallet>

// Derive patient wallet
await EmbeddedWalletService.derivePatientWallet(patientDid, hospitalId): Promise<Wallet>

// Get program derived address (PDA)
await EmbeddedWalletService.getProgramDerivedAddress(
  patientDid: string,
  recordType: string,
  hospitalId: string
): Promise<string>

// Rotate master wallet key
await EmbeddedWalletService.rotateHospitalWallet(hospitalId): Promise<void>

// Verify wallet is valid
await EmbeddedWalletService.verifyWallet(publicKey): Promise<boolean>
```

### Solana Blockchain Service

```typescript
// Anchor medical record to blockchain
await SolanaBlockchainService.anchorMedicalRecord({
  patientDid: string,
  recordType: string,
  recordHash: string,
  hospitalId: string,
  metadata?: Record<string, unknown>
}): Promise<string> // txId

// Verify record on-chain
await SolanaBlockchainService.verifyAnchoredRecord(txId: string): Promise<{
  verified: boolean,
  slot: number,
  signature: string,
  explorerUrl: string
}>

// Get record history
await SolanaBlockchainService.getRecordHistory(patientDid: string): Promise<RecordProof[]>

// Monitor transaction confirmation
await SolanaBlockchainService.waitForConfirmation(
  txId: string,
  options?: { commitment: 'confirmed' | 'finalized', timeout: number }
): Promise<{ confirmed: boolean, slot: number }>
```

---

## 📱 User Experience Flow

### Scenario: Dispensing a Prescription

```
Staff Portal
├─ Staff views prescription for patient
├─ Clicks "Dispense Medication" button
│  └─ User sees: "Dispensing... (this will be verified on blockchain)"
│
├─ [BACKEND]
│  ├─ 1. Create stock movement in Postgres
│  ├─ 2. Calculate SHA-256 hash of movement
│  ├─ 3. Build Solana transaction to anchor record
│  ├─ 4. Sign with hospital wallet (no client involvement)
│  ├─ 5. Send to Solana blockchain
│  ├─ 6. Wait for confirmation
│  └─ 7. Update UI with verification status
│
└─ Staff sees: "✓ Verified on blockchain. View proof →"
   └─ Link to Solana Explorer showing transaction
```

### Scenario: Patient Viewing Medical History

```
Patient Portal
├─ Patient clicks "View Medical Records"
├─ System loads records from Postgres
├─ For each record, shows:
│  ├─ Record content (diagnosis, prescription, lab result)
│  ├─ Verification badge: "✓ Verified on blockchain"
│  └─ "View Proof" button → Solana Explorer
│
└─ Patient can verify records are immutable
   └─ Each record has blockchain-proven timestamp & hash
```

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
// embedded-wallet.test.ts
describe('EmbeddedWalletService', () => {
  it('should derive same wallet for same inputs', async () => {
    const wallet1 = await derivePatientWallet('did:solana:123', 'hosp-1');
    const wallet2 = await derivePatientWallet('did:solana:123', 'hosp-1');
    expect(wallet1.publicKey).toBe(wallet2.publicKey);
  });

  it('should derive different wallet for different patient', async () => {
    const wallet1 = await derivePatientWallet('did:solana:123', 'hosp-1');
    const wallet2 = await derivePatientWallet('did:solana:456', 'hosp-1');
    expect(wallet1.publicKey).not.toBe(wallet2.publicKey);
  });

  it('should not expose private key to client', async () => {
    const wallet = await derivePatientWallet('did:solana:123', 'hosp-1');
    expect(wallet.privateKey).toBeUndefined();
  });
});

// solana-blockchain.test.ts
describe('SolanaBlockchainService', () => {
  it('should anchor record and return txId', async () => {
    const txId = await anchorMedicalRecord({
      patientDid: 'did:solana:123',
      recordType: 'prescription',
      recordHash: 'abc123',
      hospitalId: 'hosp-1'
    });
    expect(txId).toMatch(/^[A-Za-z0-9]{88}$/); // Solana tx ID format
  });

  it('should verify anchored record', async () => {
    const txId = 'test_tx_id';
    const result = await verifyAnchoredRecord(txId);
    expect(result.verified).toBe(true);
    expect(result.signature).toBeDefined();
  });
});
```

### Integration Tests
```typescript
// blockchain-integration.test.ts
describe('Audit + Blockchain Integration', () => {
  it('should anchor audit record to blockchain', async () => {
    // 1. Write audit record
    const auditResult = await writeAuditRecord({
      actorId: 'staff-123',
      action: 'PRESCRIPTION_DISPENSED',
      module: 'pharmacy'
      // ...
    });

    // 2. Should return blockchain txId
    expect(auditResult.blockchainTxId).toBeDefined();

    // 3. Should be verifiable on-chain
    const verified = await verifyAnchoredRecord(auditResult.blockchainTxId);
    expect(verified.verified).toBe(true);
  });
});
```

---

## 📚 Configuration

### Environment Variables
```env
# Solana Network
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
SOLANA_COMMITMENT=confirmed

# Program IDs
HEALTH_GRID_PROGRAM_ID=<deployed-program-address>
HEALTH_GRID_STATE_PDA=<state-account-address>

# Hospital Master Wallet (encrypted in secrets manager)
HOSPITAL_MASTER_WALLET_ENCRYPTED=<base64-encrypted-keypair>
HOSPITAL_MASTER_WALLET_KEY_VERSION=1

# Encryption
MASTER_ENCRYPTION_KEY=<from-secrets-manager>
WALLET_ENCRYPTION_ALGORITHM=aes-256-gcm

# Blockchain Settings
BLOCKCHAIN_TX_TIMEOUT_MS=60000
BLOCKCHAIN_CONFIRMATION_COUNT=32
BLOCKCHAIN_MAX_RETRIES=5
```

### Runtime Configuration
```typescript
// src/lib/solana-config.server.ts
export const SOLANA_CONFIG = {
  rpcUrl: process.env.SOLANA_RPC_URL,
  network: process.env.SOLANA_NETWORK as 'devnet' | 'testnet' | 'mainnet',
  programId: new PublicKey(process.env.HEALTH_GRID_PROGRAM_ID),
  commitment: process.env.SOLANA_COMMITMENT as Commitment,
  txTimeout: parseInt(process.env.BLOCKCHAIN_TX_TIMEOUT_MS),
  confirmationCount: parseInt(process.env.BLOCKCHAIN_CONFIRMATION_COUNT),
  maxRetries: parseInt(process.env.BLOCKCHAIN_MAX_RETRIES),
};
```

---

## 🎯 Success Metrics

**Phase Completion**:
- [ ] All 6 phases complete on schedule
- [ ] 0 security vulnerabilities in wallet storage
- [ ] 99.9% blockchain transaction success rate
- [ ] <100ms latency for wallet operations
- [ ] 100% audit trail coverage

**User Experience**:
- [ ] 0 users see private keys/addresses
- [ ] 100% of records have blockchain proof option
- [ ] Users never need to understand blockchain concepts
- [ ] <5 second end-to-end latency for "verify" button

**Compliance**:
- [ ] HIPAA compliance maintained (PHI never on-chain)
- [ ] Audit trail tamper-evident
- [ ] Key rotation working monthly
- [ ] Disaster recovery tested quarterly

---

## 📖 Next Steps

1. **Review Plan**: Team review & feedback (1 week)
2. **Phase 1 Start**: Begin wallet infrastructure (Week 1)
3. **Weekly Sync**: 1-hour sync calls to unblock & review
4. **Testnet Launch**: Deploy to Solana Devnet (Week 6)
5. **Production Ready**: Mainnet deployment checklist (Week 12)

---

## 📞 Support & Resources

- **Solana Docs**: https://docs.solana.com/
- **Anchor Framework**: https://www.anchor-lang.com/
- **Solana Web3.js**: https://solana-labs.github.io/solana-web3.js/
- **Health Grid Docs**: See `docs/` folder for project context
- **Questions**: Post in team Slack #blockchain-engineering

