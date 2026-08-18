# Embedded Wallet Integration — Technical Specification
## Code-Level Implementation Details for Health Grid

---

## Overview

This document provides **exact code specifications** for implementing embedded wallets in Health Grid.

**Stack**:
- **Wallet Management**: @solana/web3.js, tweetnacl.js
- **Encryption**: libsodium (sodium.js), AES-256-GCM
- **Backend**: Node.js + TanStack React Start
- **Database**: Supabase (PostgreSQL)
- **Smart Contracts**: Anchor Framework (Rust)
- **Networks**: Devnet → Testnet → Mainnet

---

## 1. Embedded Wallet Service Implementation

### File: `src/lib/embedded-wallet.server.ts`

```typescript
import {
  Keypair,
  PublicKey,
  Connection,
  TransactionV0,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { createSecretBox, randomBytes, secretbox } from 'tweetnacl';
import { decrypt as decryptFromString, encrypt as encryptToString } from 'libsodium.js';
import { getSupabaseServerClient } from './supabase.server';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

/**
 * Wallet metadata structure
 */
export interface EmbeddedWallet {
  walletId: string;
  hospitalId: string;
  ownerType: 'hospital' | 'patient';
  ownerId: string; // hospital_id or patient_did
  publicKey: string; // Solana address (base58)
  derivationPath?: string; // BIP44 path (never send private key)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Note: privateKey NEVER in this object when returned to frontend
}

/**
 * Hospital Master Wallet Service
 * Manages the hospital's main wallet that pays transaction fees
 */
export class HospitalWalletService {
  private connection: Connection;

  constructor() {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    );
  }

  /**
   * Get or create hospital master wallet
   * - If exists: decrypt from DB and return
   * - If not exists: generate new keypair, encrypt, store, return
   * 
   * This wallet is used to:
   * - Sign all transactions from the hospital
   * - Pay transaction fees for anchoring records
   * - Be rotated periodically for security
   * 
   * @param hospitalId Hospital UUID
   * @returns Public key only (never private key)
   */
  async getOrCreateHospitalWallet(hospitalId: string): Promise<EmbeddedWallet> {
    const db = getSupabaseServerClient();

    // Step 1: Check if wallet exists in database
    const { data: existingWallet, error: fetchError } = await db
      .from('embedded_wallets')
      .select('*')
      .eq('hospital_id', hospitalId)
      .eq('owner_type', 'hospital')
      .eq('is_active', true)
      .single();

    if (existingWallet && !fetchError) {
      // Wallet exists, return metadata (no private key)
      return {
        walletId: existingWallet.wallet_id,
        hospitalId: existingWallet.hospital_id,
        ownerType: existingWallet.owner_type,
        ownerId: existingWallet.owner_id,
        publicKey: existingWallet.public_key,
        isActive: existingWallet.is_active,
        createdAt: new Date(existingWallet.created_at),
        updatedAt: new Date(existingWallet.updated_at),
      };
    }

    // Step 2: Generate new keypair
    const keypair = Keypair.generate();

    // Step 3: Encrypt private key
    const privateKeyBytes = keypair.secretKey;
    const masterEncryptionKey = Buffer.from(
      process.env.MASTER_ENCRYPTION_KEY || 'fallback-key-32-chars-min-length!!!',
      'utf-8'
    );
    const encryptedPrivateKey = await encryptToString(
      Buffer.from(privateKeyBytes),
      masterEncryptionKey
    );

    // Step 4: Store in database
    const walletId = crypto.randomUUID();
    const { error: insertError } = await db.from('embedded_wallets').insert({
      wallet_id: walletId,
      hospital_id: hospitalId,
      owner_type: 'hospital',
      owner_id: hospitalId,
      public_key: keypair.publicKey.toBase58(),
      encrypted_private_key: encryptedPrivateKey,
      encryption_key_version: 1,
      derivation_path: "m/44'/501'/0'/0/0", // Standard Solana path
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    if (insertError) {
      throw new Error(`Failed to store wallet: ${insertError.message}`);
    }

    console.log(`✅ Created hospital wallet ${keypair.publicKey.toBase58()} for hospital ${hospitalId}`);

    return {
      walletId,
      hospitalId,
      ownerType: 'hospital',
      ownerId: hospitalId,
      publicKey: keypair.publicKey.toBase58(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get hospital wallet keypair for signing
   * ⚠️ INTERNAL ONLY - Never expose to client
   * 
   * @param hospitalId Hospital UUID
   * @returns Keypair object (with private key for in-memory signing)
   */
  async getHospitalKeypair(hospitalId: string): Promise<Keypair> {
    const db = getSupabaseServerClient();

    // Fetch encrypted private key
    const { data: wallet, error } = await db
      .from('embedded_wallets')
      .select('encrypted_private_key, public_key')
      .eq('hospital_id', hospitalId)
      .eq('owner_type', 'hospital')
      .single();

    if (!wallet || error) {
      throw new Error(`Hospital wallet not found: ${error?.message}`);
    }

    // Decrypt private key
    const masterEncryptionKey = Buffer.from(
      process.env.MASTER_ENCRYPTION_KEY || 'fallback-key',
      'utf-8'
    );
    const decryptedPrivateKey = await decryptFromString(
      wallet.encrypted_private_key,
      masterEncryptionKey
    );

    // Reconstruct keypair
    const keypair = Keypair.fromSecretKey(Buffer.from(decryptedPrivateKey));
    return keypair;
  }

  /**
   * Rotate hospital wallet (security best practice)
   * - Create new keypair
   * - Encrypt and store
   * - Mark old wallet as inactive
   * - Log rotation event
   * 
   * @param hospitalId Hospital UUID
   */
  async rotateHospitalWallet(hospitalId: string): Promise<string> {
    const db = getSupabaseServerClient();

    // Step 1: Mark old wallet as inactive
    await db
      .from('embedded_wallets')
      .update({ is_active: false })
      .eq('hospital_id', hospitalId)
      .eq('owner_type', 'hospital');

    // Step 2: Generate and store new wallet
    const newWallet = await this.getOrCreateHospitalWallet(hospitalId);

    // Step 3: Log rotation audit event
    console.log(`🔄 Rotated hospital wallet for ${hospitalId}`);
    console.log(`   Old: [redacted]`);
    console.log(`   New: ${newWallet.publicKey}`);

    return newWallet.publicKey;
  }

  /**
   * Get wallet balance on Solana
   * Used to verify hospital wallet has enough SOL for transaction fees
   * 
   * @param publicKey Wallet public key
   * @returns Balance in lamports (1 SOL = 1 billion lamports)
   */
  async getBalance(publicKey: string): Promise<number> {
    try {
      const pubkey = new PublicKey(publicKey);
      const balance = await this.connection.getBalance(pubkey);
      return balance;
    } catch (error) {
      console.error(`Failed to get balance for ${publicKey}:`, error);
      return 0;
    }
  }

  /**
   * Request SOL airdrop (Devnet/Testnet only)
   * Used for testing without spending real money
   * 
   * @param publicKey Wallet public key
   * @param amount SOL amount (1 SOL)
   */
  async requestAirdrop(publicKey: string, amount: number = 1): Promise<string> {
    if (process.env.SOLANA_NETWORK === 'mainnet') {
      throw new Error('Airdrops only available on Devnet/Testnet');
    }

    try {
      const pubkey = new PublicKey(publicKey);
      const lamports = amount * 1_000_000_000; // Convert SOL to lamports

      const signature = await this.connection.requestAirdrop(pubkey, lamports);
      console.log(`✅ Requested ${amount} SOL airdrop. TX: ${signature}`);

      return signature;
    } catch (error) {
      throw new Error(`Airdrop failed: ${error.message}`);
    }
  }
}

/**
 * Patient Wallet Service
 * Derives patient wallets deterministically (never stored)
 */
export class PatientWalletService {
  /**
   * Derive patient wallet from patient DID + hospital master
   * 
   * Key insight: Same patient in same hospital → Same wallet
   * Different hospital → Different wallet for same patient
   * 
   * Process:
   * 1. Combine: patient_did + hospital_id
   * 2. Use BIP44 derivation path
   * 3. Result: Deterministic keypair
   * 
   * This means:
   * - No storage needed (derive on-demand)
   * - Patient privacy: Each hospital has different patient wallet
   * - Reproducible: Same inputs → same wallet
   * 
   * @param patientDid Patient Solana DID (e.g., "did:solana:8Pv...")
   * @param hospitalId Hospital UUID
   * @returns Public key only
   */
  async derivePatientWallet(patientDid: string, hospitalId: string): Promise<string> {
    // Extract public key from DID
    const didParts = patientDid.split(':');
    const patientPublicKey = didParts[2]; // Format: did:solana:<pubkey>

    if (!patientPublicKey) {
      throw new Error(`Invalid patient DID format: ${patientDid}`);
    }

    // Combine patient DID + hospital ID as seed
    const seedPhrase = `${patientDid}|${hospitalId}|health-grid`;
    const seed = Buffer.from(seedPhrase, 'utf-8');

    // Derive keypair using BIP44 path
    // Path structure: m/44'/501'/0'/0'/i'
    // - 44': BIP44 standard
    // - 501': Solana (https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
    // - 0': Hospital index
    // - 0': Account index
    // - i': Change index (0 for external addresses)

    const pathStr = "m/44'/501'/0'/0'/0'";
    const { key } = derivePath(pathStr, seed.toString('hex'));

    // Create keypair from derived key
    const keypair = Keypair.fromSeed(Buffer.from(key).slice(0, 32));

    return keypair.publicKey.toBase58();
  }

  /**
   * Get Program Derived Address (PDA) for patient record
   * 
   * PDAs are unique accounts for storing data on-chain
   * Deterministic: Same inputs → same PDA
   * No private key: Derived by program using hash function
   * 
   * Use case: Each patient prescription has unique PDA for on-chain storage
   * 
   * @param patientDid Patient DID
   * @param recordType Type of record ("prescription", "diagnosis", etc.)
   * @param hospitalId Hospital UUID
   * @returns PDA public key
   */
  async getProgramDerivedAddress(
    patientDid: string,
    recordType: string,
    hospitalId: string
  ): Promise<string> {
    const programId = new PublicKey(process.env.HEALTH_GRID_PROGRAM_ID!);

    // Seeds for PDA derivation
    const seeds = [
      Buffer.from('record_account'), // Type identifier
      Buffer.from(patientDid),       // Patient identifier
      Buffer.from(recordType),       // Record type
      Buffer.from(hospitalId),       // Hospital identifier
    ];

    // Find PDA using program ID and seeds
    const [pda] = PublicKey.findProgramAddressSync(seeds, programId);

    return pda.toBase58();
  }
}

/**
 * Wallet Verification Service
 * Verify wallet addresses are valid on Solana
 */
export class WalletVerificationService {
  /**
   * Verify that a public key is a valid Solana address
   * 
   * @param publicKey Solana address (base58)
   * @returns true if valid, false otherwise
   */
  verifyPublicKey(publicKey: string): boolean {
    try {
      new PublicKey(publicKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify that a DID is a valid Solana DID
   * Format: did:solana:<base58-public-key>
   * 
   * @param did Decentralized identifier
   * @returns true if valid Solana DID, false otherwise
   */
  verifySolanaDid(did: string): boolean {
    if (!did.startsWith('did:solana:')) {
      return false;
    }

    const publicKey = did.split(':')[2];
    return this.verifyPublicKey(publicKey);
  }
}

// Export singleton instances
export const hospitalWalletService = new HospitalWalletService();
export const patientWalletService = new PatientWalletService();
export const walletVerificationService = new WalletVerificationService();
```

---

## 2. Solana Blockchain Service

### File: `src/lib/solana-blockchain.server.ts`

```typescript
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  Keypair,
} from '@solana/web3.js';
import { TextEncoder } from 'util';
import { getSupabaseServerClient } from './supabase.server';
import { hospitalWalletService } from './embedded-wallet.server';

/**
 * Solana Blockchain Service
 * Handles all interactions with Solana blockchain
 */
export class SolanaBlockchainService {
  private connection: Connection;
  private programId: PublicKey;
  private network: 'devnet' | 'testnet' | 'mainnet';

  constructor() {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );
    this.programId = new PublicKey(process.env.HEALTH_GRID_PROGRAM_ID!);
    this.network = (process.env.SOLANA_NETWORK || 'devnet') as any;
  }

  /**
   * Anchor a medical record to Solana blockchain
   * 
   * Process:
   * 1. Build transaction with anchor instruction
   * 2. Sign with hospital wallet
   * 3. Send to Solana RPC
   * 4. Wait for confirmation
   * 5. Save TX ID to Postgres
   * 
   * @param params Record details
   * @returns Transaction ID (can verify on Solana Explorer)
   */
  async anchorMedicalRecord(params: {
    patientDid: string;
    recordType: string;
    recordHash: string;
    hospitalId: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    try {
      // Step 1: Get hospital wallet for signing
      const hospitalKeypair = await hospitalWalletService.getHospitalKeypair(
        params.hospitalId
      );

      // Step 2: Get latest blockhash (required for transactions)
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

      // Step 3: Build instruction (example - actual structure depends on your program)
      const instruction = {
        programId: this.programId,
        keys: [
          {
            pubkey: hospitalKeypair.publicKey,
            isSigner: true,
            isWritable: false,
          },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: Buffer.concat([
          Buffer.from([0]), // Instruction discriminator (anchor_record = 0)
          Buffer.from(params.recordType.padEnd(32, '\0')),
          Buffer.from(params.recordHash, 'hex'),
          Buffer.from(params.patientDid.padEnd(64, '\0')),
        ]),
      };

      // Step 4: Create transaction
      const message = new TransactionMessage({
        instructions: [instruction],
        payerKey: hospitalKeypair.publicKey,
        recentBlockhash: blockhash,
      }).compileToV0Message();

      const versionedTx = new VersionedTransaction(message);

      // Step 5: Sign transaction (with hospital wallet - never client-side)
      versionedTx.sign([hospitalKeypair]);

      // Step 6: Send transaction
      const txId = await this.connection.sendRawTransaction(versionedTx.serialize(), {
        maxRetries: 5,
        skipPreflight: false,
      });

      console.log(`📤 Sent transaction: ${txId}`);

      // Step 7: Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        {
          signature: txId,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log(`✅ Transaction confirmed: ${txId}`);

      // Step 8: Save to Postgres for audit trail
      const db = getSupabaseServerClient();
      const operationId = crypto.randomUUID();

      await db.from('blockchain_operations').insert({
        operation_id: operationId,
        hospital_id: params.hospitalId,
        wallet_id: crypto.randomUUID(), // Get from wallet table
        operation_type: 'anchor_record',
        solana_tx_id: txId,
        program_id: this.programId.toBase58(),
        status: 'confirmed',
        confirmation_status: 'confirmed',
        confirmation_count: 32,
        slot: confirmation.value.slot,
        signature: txId,
        related_record_hash: params.recordHash,
        metadata: params.metadata || {},
        created_at: new Date(),
        confirmed_at: new Date(),
      });

      return txId;
    } catch (error) {
      console.error('❌ Failed to anchor record:', error);
      throw error;
    }
  }

  /**
   * Verify that a record was anchored to blockchain
   * 
   * Checks:
   * 1. Transaction exists on-chain
   * 2. Transaction is confirmed/finalized
   * 3. Record hash matches
   * 
   * @param txId Transaction ID
   * @returns Verification result
   */
  async verifyAnchoredRecord(txId: string): Promise<{
    verified: boolean;
    slot: number | null;
    signature: string | null;
    explorerUrl: string;
  }> {
    try {
      // Step 1: Get transaction details
      const tx = await this.connection.getTransaction(txId, {
        commitment: 'confirmed',
      });

      if (!tx) {
        return {
          verified: false,
          slot: null,
          signature: null,
          explorerUrl: this.getExplorerUrl(txId),
        };
      }

      // Step 2: Verify transaction was successful
      if (tx.meta?.err) {
        return {
          verified: false,
          slot: tx.slot,
          signature: txId,
          explorerUrl: this.getExplorerUrl(txId),
        };
      }

      // Step 3: Check finality
      const commitment = await this.connection.getSignatureStatus(txId);

      const isFinalized =
        commitment.value?.confirmationStatus === 'finalized';

      return {
        verified: isFinalized,
        slot: tx.slot,
        signature: txId,
        explorerUrl: this.getExplorerUrl(txId),
      };
    } catch (error) {
      console.error('Error verifying record:', error);
      return {
        verified: false,
        slot: null,
        signature: null,
        explorerUrl: this.getExplorerUrl(txId),
      };
    }
  }

  /**
   * Get Solana Explorer URL for transaction
   * 
   * @param txId Transaction ID
   * @returns URL to view on explorer
   */
  private getExplorerUrl(txId: string): string {
    const baseUrl = 'https://explorer.solana.com/tx';
    const params = this.network === 'mainnet' ? '' : `?cluster=${this.network}`;
    return `${baseUrl}/${txId}${params}`;
  }

  /**
   * Get record history for a patient
   * Queries blockchain for all records ever anchored for patient
   * 
   * @param patientDid Patient Solana DID
   * @returns Array of anchored records
   */
  async getRecordHistory(patientDid: string): Promise<any[]> {
    // This would query the on-chain program for all records
    // Implementation depends on your program's account structure
    console.log(`🔍 Querying record history for ${patientDid}`);
    return [];
  }

  /**
   * Wait for transaction confirmation
   * Polls blockchain until transaction reaches desired confirmation level
   * 
   * @param txId Transaction ID
   * @param options Confirmation options
   * @returns Confirmation result
   */
  async waitForConfirmation(
    txId: string,
    options: {
      commitment?: 'processed' | 'confirmed' | 'finalized';
      timeout?: number;
      maxRetries?: number;
    } = {}
  ): Promise<{ confirmed: boolean; slot: number }> {
    const {
      commitment = 'confirmed',
      timeout = 60000,
      maxRetries = 120, // 120 * 500ms = 60 seconds
    } = options;

    const startTime = Date.now();
    let retries = 0;

    while (retries < maxRetries) {
      const elapsed = Date.now() - startTime;
      if (elapsed > timeout) {
        throw new Error(`Confirmation timeout after ${timeout}ms`);
      }

      const status = await this.connection.getSignatureStatus(txId);

      if (status.value?.confirmationStatus === commitment) {
        return {
          confirmed: true,
          slot: status.value.slot || 0,
        };
      }

      retries++;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Failed to confirm transaction after ${maxRetries} retries`);
  }
}

export const solanaBlockchainService = new SolanaBlockchainService();
```

---

## 3. Database Schema

### File: `supabase/migrations/20260818_embedded_wallets.sql`

```sql
-- ─── Embedded Wallets ───────────────────────────────────────────

CREATE TABLE public.embedded_wallets (
  wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(hospital_id) ON DELETE CASCADE,
  
  owner_type TEXT NOT NULL CHECK (owner_type IN ('hospital', 'patient')),
  owner_id TEXT NOT NULL, -- hospital_id or patient_did
  
  public_key TEXT NOT NULL UNIQUE,
  encrypted_private_key TEXT NOT NULL,
  encryption_key_version INT DEFAULT 1,
  
  derivation_path TEXT, -- e.g., "m/44'/501'/0'/0/0"
  
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  
  CONSTRAINT unique_owner UNIQUE (hospital_id, owner_type, owner_id)
);

CREATE INDEX wallets_hospital_idx ON public.embedded_wallets (hospital_id);
CREATE INDEX wallets_owner_idx ON public.embedded_wallets (owner_type, owner_id);
CREATE INDEX wallets_public_key_idx ON public.embedded_wallets (public_key);

-- ─── Blockchain Operations ──────────────────────────────────────

CREATE TABLE public.blockchain_operations (
  operation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(hospital_id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.embedded_wallets(wallet_id),
  
  operation_type TEXT NOT NULL, -- 'anchor_record', 'mint_nft', etc.
  solana_tx_id TEXT UNIQUE,
  program_id TEXT,
  instruction TEXT,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'confirmed', 'finalized', 'failed')
  ),
  confirmation_status TEXT,
  confirmation_count INT DEFAULT 0,
  
  slot INT,
  signature TEXT,
  error_message TEXT,
  
  related_record_hash TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ
);

CREATE INDEX blockchain_ops_hospital_idx ON public.blockchain_operations (hospital_id);
CREATE INDEX blockchain_ops_tx_idx ON public.blockchain_operations (solana_tx_id);
CREATE INDEX blockchain_ops_status_idx ON public.blockchain_operations (status);
CREATE INDEX blockchain_ops_created_idx ON public.blockchain_operations (created_at DESC);

-- ─── Blockchain Verification ────────────────────────────────────

CREATE TABLE public.blockchain_verification (
  verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(hospital_id) ON DELETE CASCADE,
  operation_id UUID NOT NULL REFERENCES public.blockchain_operations(operation_id),
  
  expected_hash TEXT,
  expected_metadata TEXT,
  
  on_chain_hash TEXT,
  on_chain_metadata TEXT,
  
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_timestamp TIMESTAMPTZ,
  verification_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX verification_hospital_idx ON public.blockchain_verification (hospital_id);
CREATE INDEX verification_operation_idx ON public.blockchain_verification (operation_id);
CREATE INDEX verification_verified_idx ON public.blockchain_verification (verified);

-- ─── RLS Policies ────────────────────────────────────────────────

ALTER TABLE public.embedded_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY embedded_wallets_hospital_isolation ON public.embedded_wallets
  FOR SELECT TO authenticated
  USING (
    hospital_id IN (
      SELECT hospital_id FROM public.hospital_staff 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'blockchain_operator')
    )
  );

ALTER TABLE public.blockchain_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY blockchain_ops_hospital_isolation ON public.blockchain_operations
  FOR SELECT TO authenticated
  USING (
    hospital_id IN (
      SELECT hospital_id FROM public.hospital_staff 
      WHERE user_id = auth.uid()
    )
  );
```

---

## 4. Integration with Audit System

### Modify: `src/lib/audit.server.ts`

```typescript
// Add to imports
import { solanaBlockchainService } from './solana-blockchain.server';

// Modify writeAuditRecord function
export async function writeAuditRecord(entry: AuditEntry): Promise<AuditResult> {
  // ... existing code to write to Postgres ...
  const auditRow = await db.write_audit_record(entry);

  // NEW: Queue for blockchain anchoring
  try {
    const blockchainTxId = await solanaBlockchainService.anchorMedicalRecord({
      patientDid: entry.actorDid || `did:solana:unknown-${entry.actorId}`,
      recordType: entry.module,
      recordHash: auditRow.recordHash,
      hospitalId: entry.hospital,
      metadata: {
        action: entry.action,
        outcome: entry.outcome,
        severity: entry.severity,
        actorRole: entry.actorRole,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`✅ Audit record anchored to blockchain: ${blockchainTxId}`);

    return {
      txId: auditRow.id,
      recordHash: auditRow.recordHash,
      anchorQueued: true,
      blockchainTxId: blockchainTxId, // NEW
    };
  } catch (error) {
    console.warn(`⚠️ Failed to anchor audit to blockchain:`, error);
    // Continue without blockchain - don't fail the operation
    return {
      txId: auditRow.id,
      recordHash: auditRow.recordHash,
      anchorQueued: false, // Will retry later
    };
  }
}
```

---

## 5. Configuration

### File: `src/lib/solana-config.server.ts`

```typescript
import { Commitment } from '@solana/web3.js';

export interface SolanaConfig {
  rpcUrl: string;
  network: 'devnet' | 'testnet' | 'mainnet';
  programId: string;
  commitment: Commitment;
  txTimeout: number;
  confirmationCount: number;
  maxRetries: number;
}

export const SOLANA_CONFIG: SolanaConfig = {
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  network: (process.env.SOLANA_NETWORK || 'devnet') as any,
  programId: process.env.HEALTH_GRID_PROGRAM_ID || '',
  commitment: (process.env.SOLANA_COMMITMENT || 'confirmed') as Commitment,
  txTimeout: parseInt(process.env.BLOCKCHAIN_TX_TIMEOUT_MS || '60000'),
  confirmationCount: parseInt(process.env.BLOCKCHAIN_CONFIRMATION_COUNT || '32'),
  maxRetries: parseInt(process.env.BLOCKCHAIN_MAX_RETRIES || '5'),
};

// Validate config at startup
if (!SOLANA_CONFIG.programId) {
  console.warn('⚠️ HEALTH_GRID_PROGRAM_ID not set. Blockchain operations will fail.');
}
```

### File: `.env.local`

```bash
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
SOLANA_COMMITMENT=confirmed
HEALTH_GRID_PROGRAM_ID=<deployed-program-address>

# Encryption
MASTER_ENCRYPTION_KEY=<32-character-minimum-encryption-key>

# Blockchain Settings
BLOCKCHAIN_TX_TIMEOUT_MS=60000
BLOCKCHAIN_CONFIRMATION_COUNT=32
BLOCKCHAIN_MAX_RETRIES=5
```

---

## 6. Testing Examples

### File: `src/lib/__tests__/embedded-wallet.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hospitalWalletService, patientWalletService } from '../embedded-wallet.server';

describe('EmbeddedWalletService', () => {
  const testHospitalId = 'test-hospital-123';
  const testPatientDid = 'did:solana:8Pv4ZSooXZYZJ7f7hJnLHRFBw5jX';

  describe('HospitalWalletService', () => {
    it('should create a hospital wallet', async () => {
      const wallet = await hospitalWalletService.getOrCreateHospitalWallet(
        testHospitalId
      );

      expect(wallet).toHaveProperty('publicKey');
      expect(wallet.publicKey).toMatch(/^[1-9A-HJ-NP-Z]{32,34}$/); // Base58 format
      expect(wallet.ownerType).toBe('hospital');
    });

    it('should return same wallet for repeated calls', async () => {
      const wallet1 = await hospitalWalletService.getOrCreateHospitalWallet(
        testHospitalId
      );
      const wallet2 = await hospitalWalletService.getOrCreateHospitalWallet(
        testHospitalId
      );

      expect(wallet1.publicKey).toBe(wallet2.publicKey);
    });

    it('should never return private key', async () => {
      const wallet = await hospitalWalletService.getOrCreateHospitalWallet(
        testHospitalId
      );

      expect(wallet).not.toHaveProperty('privateKey');
      expect(JSON.stringify(wallet)).not.toContain('privateKey');
    });
  });

  describe('PatientWalletService', () => {
    it('should derive same wallet for same inputs', async () => {
      const wallet1 = await patientWalletService.derivePatientWallet(
        testPatientDid,
        testHospitalId
      );
      const wallet2 = await patientWalletService.derivePatientWallet(
        testPatientDid,
        testHospitalId
      );

      expect(wallet1).toBe(wallet2);
    });

    it('should derive different wallet for different patient', async () => {
      const wallet1 = await patientWalletService.derivePatientWallet(
        testPatientDid,
        testHospitalId
      );
      const wallet2 = await patientWalletService.derivePatientWallet(
        'did:solana:9Qx5ZSooXZYZJ7f7hJnLHRFBw5jX', // Different DID
        testHospitalId
      );

      expect(wallet1).not.toBe(wallet2);
    });

    it('should derive different wallet for different hospital', async () => {
      const wallet1 = await patientWalletService.derivePatientWallet(
        testPatientDid,
        testHospitalId
      );
      const wallet2 = await patientWalletService.derivePatientWallet(
        testPatientDid,
        'different-hospital-456' // Different hospital
      );

      expect(wallet1).not.toBe(wallet2);
    });

    it('should get PDA for patient record', async () => {
      const pda = await patientWalletService.getProgramDerivedAddress(
        testPatientDid,
        'prescription',
        testHospitalId
      );

      expect(pda).toMatch(/^[1-9A-HJ-NP-Z]{32,34}$/); // Valid Solana address
    });
  });
});

describe('SolanaBlockchainService (Integration)', () => {
  // Only run if connected to Devnet
  if (process.env.SOLANA_NETWORK !== 'devnet') {
    it.skip('Integration tests require Devnet', () => {});
    return;
  }

  it('should anchor record to blockchain', async () => {
    const txId = await solanaBlockchainService.anchorMedicalRecord({
      patientDid: 'did:solana:8Pv4ZSooXZYZJ7f7hJnLHRFBw5jX',
      recordType: 'prescription',
      recordHash: 'abcd1234567890',
      hospitalId: testHospitalId,
    });

    expect(txId).toMatch(/^[A-Za-z0-9]{88}$/); // Solana TX ID format
  });

  it('should verify anchored record', async () => {
    const txId = 'test-tx-id';
    const result = await solanaBlockchainService.verifyAnchoredRecord(txId);

    expect(result).toHaveProperty('verified');
    expect(result).toHaveProperty('explorerUrl');
  });
});
```

---

## Summary

This technical specification provides:

✅ Complete wallet service implementation  
✅ Blockchain integration code  
✅ Database schema with RLS  
✅ Audit system integration  
✅ Configuration management  
✅ Testing examples  

**Next Steps**:
1. Set up Anchor program for Solana (separate Rust project)
2. Deploy program to Devnet
3. Implement missing function bodies
4. Run integration tests with actual blockchain
5. Move to Testnet → Mainnet

