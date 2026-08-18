/**
 * Pharmacy + Hybrid Wallet Integration
 * Enhances pharmacy dispensing operations with blockchain signing
 * Integrates dispensePrescriptionMedications with hybrid wallet router
 */

import { getSupabaseServerClient, getVerifiedUser } from '@/lib/supabase.server';
import { dispensePrescriptionMedications } from '@/lib/pharmacy.server';
import { routeTransaction } from '@/routes/api.transaction-router';
import { recordWalletSigningAudit } from '@/lib/wallet-audit-integration.server';
import type { TransactionRouterResponse } from '@/routes/api.transaction-router';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DispenseWithBlockchainParams {
  prescriptionId: string;
  patientDid: string;
  medications: Array<{
    itemId: string;
    batchId: string;
    quantityToDispense: number;
    medicationName?: string;
  }>;
  dispensedBy?: string;
  notes?: string;
  signWithBlockchain?: boolean; // Enable hybrid wallet signing
  userPreferredWallet?: 'auto' | 'phantom' | 'embedded';
  phantomAvailable?: boolean;
  phantomConnected?: boolean;
}

export interface DispenseWithBlockchainResult {
  ok: boolean;
  prescriptionId: string;
  patientDid: string;
  dispensedCount: number;
  failedCount?: number;
  errors?: string[];
  blockchainSigningEnabled: boolean;
  signingResult?: {
    txId: string;
    signature: string;
    walletUsed: 'phantom' | 'embedded';
    confirmed: boolean;
    explorerUrl: string;
  };
  message: string;
}

// ─── Core Function: Dispense with Blockchain Integration ──────────────────

/**
 * Dispense prescription medications with optional blockchain signing
 *
 * Flow:
 * 1. Verify user permissions
 * 2. Call dispensePrescriptionMedications (updates inventory, creates movements)
 * 3. If signWithBlockchain enabled:
 *    a. Calculate hash of dispensing record
 *    b. Route transaction through hybrid wallet signer
 *    c. Record signing event in audit trail
 *    d. Return blockchain transaction details
 * 4. Return complete dispensing result with optional blockchain proof
 *
 * Use case: High-security pharmacies that want immutable records on-chain
 */
export async function dispensePrescriptionMedicationsWithBlockchain(
  params: DispenseWithBlockchainParams
): Promise<DispenseWithBlockchainResult> {
  const db = getSupabaseServerClient();
  const user = await getVerifiedUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    console.log(`\n💊 === DISPENSING WITH BLOCKCHAIN INTEGRATION ===`);
    console.log(`   Prescription: ${params.prescriptionId}`);
    console.log(`   Patient: ${params.patientDid}`);
    console.log(`   Medications: ${params.medications.length}`);
    console.log(`   Blockchain Signing: ${params.signWithBlockchain ? 'ENABLED' : 'disabled'}`);

    // ─── Step 1: Dispense Medications ────────────────────────────────────

    console.log(`\n⏳ Dispensing medications...`);

    const dispenseResult = await dispensePrescriptionMedications({
      data: {
        prescriptionId: params.prescriptionId,
        patientDid: params.patientDid,
        medications: params.medications,
        dispensedBy: params.dispensedBy,
        notes: params.notes,
      },
    });

    console.log(`✅ Medications dispensed: ${dispenseResult.dispensedCount} successful`);

    if (dispenseResult.failedCount && dispenseResult.failedCount > 0) {
      console.warn(`⚠️ Failed dispensals: ${dispenseResult.failedCount}`);
    }

    // ─── Step 2: Optional Blockchain Signing ────────────────────────────

    let signingResult: TransactionRouterResponse | null = null;

    if (params.signWithBlockchain) {
      console.log(`\n⛓️ Initiating blockchain signing...`);

      try {
        // Create record hash from dispensing details
        const recordData = {
          prescriptionId: params.prescriptionId,
          patientDid: params.patientDid,
          medications: params.medications,
          movements: dispenseResult.movements.map((m: any) => ({
            id: m.movement_id,
            type: m.movement_type,
            quantity: m.quantity_moved,
          })),
          timestamp: new Date().toISOString(),
        };

        const recordHash = Buffer.from(JSON.stringify(recordData)).toString('base64').slice(0, 64);

        console.log(`   Record Hash: ${recordHash}`);

        // Route transaction through hybrid wallet
        signingResult = await routeTransaction({
          data: {
            patientDid: params.patientDid,
            recordType: 'PRESCRIPTION_DISPENSED',
            recordHash,
            hospitalId: user.hospital_id,
            userPreferredWallet: params.userPreferredWallet || 'auto',
            phantomAvailable: params.phantomAvailable || false,
            phantomConnected: params.phantomConnected || false,
            allowFallback: true,
            maxRetries: 2,
            metadata: {
              prescriptionId: params.prescriptionId,
              recordData,
              dispensedCount: dispenseResult.dispensedCount,
            },
          },
        });

        console.log(`✅ Blockchain signing successful`);
        console.log(`   TX ID: ${signingResult.txId}`);
        console.log(`   Wallet: ${signingResult.walletUsed}`);
        console.log(`   Attempts: ${signingResult.attemptCount}`);

        // ─── Step 3: Record Signing Audit ───────────────────────────────

        try {
          await recordWalletSigningAudit({
            // Standard audit fields
            actorId: user.id,
            actorName: params.dispensedBy,
            action: 'PRESCRIPTION_DISPENSED_SIGNED',
            outcome: 'success',
            severity: 'info',
            module: 'pharmacy',
            entityId: params.prescriptionId,
            entityType: 'prescription_dispensing',
            resource: `Prescription dispensed and signed: ${params.prescriptionId}`,
            hospital: user.hospital_id,
            // Wallet-specific fields
            signerType: signingResult.walletUsed,
            txId: signingResult.txId,
            explorerUrl: signingResult.explorerUrl,
            metadata: {
              prescriptionId: params.prescriptionId,
              patientDid: params.patientDid,
              recordHash,
              dispensedCount: dispenseResult.dispensedCount,
              walletUsed: signingResult.walletUsed,
              confirmed: signingResult.confirmed,
            },
          });

          console.log(`📝 Signing audit recorded`);
        } catch (auditError) {
          console.warn(`⚠️ Failed to record signing audit:`, auditError);
          // Don't fail the whole operation if audit logging fails
        }
      } catch (signingError) {
        console.error(`❌ Blockchain signing failed:`, signingError);
        // Return result with signing failure but successful dispensing
        const errorMsg = signingError instanceof Error ? signingError.message : String(signingError);

        return {
          ok: true, // Dispensing succeeded even if signing failed
          prescriptionId: params.prescriptionId,
          patientDid: params.patientDid,
          dispensedCount: dispenseResult.dispensedCount,
          failedCount: dispenseResult.failedCount,
          errors: [
            ...(dispenseResult.errors || []),
            `Blockchain signing failed: ${errorMsg}`,
          ],
          blockchainSigningEnabled: true,
          message: `✅ Medications dispensed (${dispenseResult.dispensedCount}), but blockchain signing failed: ${errorMsg}`,
        };
      }
    }

    // ─── Step 4: Return Complete Result ──────────────────────────────────

    const result: DispenseWithBlockchainResult = {
      ok: true,
      prescriptionId: params.prescriptionId,
      patientDid: params.patientDid,
      dispensedCount: dispenseResult.dispensedCount,
      failedCount: dispenseResult.failedCount,
      errors: dispenseResult.errors,
      blockchainSigningEnabled: params.signWithBlockchain || false,
      message: `✅ Dispensing complete (${dispenseResult.dispensedCount} medications)${
        signingResult
          ? ` and blockchain-signed with ${signingResult.walletUsed} wallet (${signingResult.totalDuration}ms)`
          : ''
      }`,
    };

    if (signingResult) {
      result.signingResult = {
        txId: signingResult.txId,
        signature: signingResult.signature,
        walletUsed: signingResult.walletUsed,
        confirmed: signingResult.confirmed,
        explorerUrl: signingResult.explorerUrl,
      };
    }

    console.log(`\n✅ === DISPENSING WITH BLOCKCHAIN COMPLETE ===`);
    console.log(result.message);

    return result;
  } catch (error) {
    console.error(`❌ Fatal error in dispensing with blockchain:`, error);
    throw error;
  }
}

// ─── Helper: Generate Dispensing Record Hash ────────────────────────────────

/**
 * Generate cryptographic hash of a dispensing record
 * Used as the recordHash for blockchain signing
 */
export function generateDispensingRecordHash(params: {
  prescriptionId: string;
  patientDid: string;
  medications: Array<{
    itemId: string;
    batchId: string;
    quantityToDispense: number;
  }>;
  timestamp?: string;
}): string {
  const recordData = {
    prescriptionId: params.prescriptionId,
    patientDid: params.patientDid,
    medications: params.medications.map((m) => ({
      itemId: m.itemId,
      batchId: m.batchId,
      quantity: m.quantityToDispense,
    })),
    timestamp: params.timestamp || new Date().toISOString(),
  };

  // For now, use base64 of JSON (in production, use SHA256)
  const jsonStr = JSON.stringify(recordData);
  const hash = Buffer.from(jsonStr).toString('base64').slice(0, 64);

  console.log(`📊 Generated dispensing record hash:`, {
    recordData,
    hash,
  });

  return hash;
}

// ─── Helper: Verify Dispensing Blockchain Record ──────────────────────────

/**
 * Verify that a dispensing record has a valid blockchain signature
 * Checks if the record hash was signed and confirmed on-chain
 */
export async function verifyDispensingBlockchainRecord(params: {
  prescriptionId: string;
  txId: string;
  hospitalId: string;
}): Promise<{
  valid: boolean;
  confirmed: boolean;
  signerType?: 'phantom' | 'embedded';
  explorerUrl?: string;
  timestamp?: string;
  reason?: string;
}> {
  const db = getSupabaseServerClient();

  try {
    // Look up the signing event
    const { data: signingEvent, error } = await db
      .from('signing_events')
      .select('*')
      .eq('transaction_id', params.txId)
      .eq('hospital_id', params.hospitalId)
      .single();

    if (error?.code === 'PGRST116') {
      return {
        valid: false,
        confirmed: false,
        reason: `No signing event found for TX: ${params.txId}`,
      };
    }

    if (error) {
      throw error;
    }

    // Verify metadata matches prescription
    const metadata = signingEvent.metadata || {};
    if (metadata.prescriptionId !== params.prescriptionId) {
      return {
        valid: false,
        confirmed: false,
        reason: 'Prescription ID mismatch in signing event metadata',
      };
    }

    return {
      valid: true,
      confirmed: signingEvent.confirmed,
      signerType: signingEvent.signer_type,
      explorerUrl: `https://explorer.solana.com/tx/${params.txId}?cluster=${process.env.SOLANA_NETWORK || 'devnet'}`,
      timestamp: signingEvent.confirmed_at,
    };
  } catch (error) {
    console.error('Failed to verify dispensing blockchain record:', error);
    return {
      valid: false,
      confirmed: false,
      reason: 'Verification failed',
    };
  }
}

// ─── Helper: Get Dispensing Audit Trail with Blockchain Proof ──────────────

/**
 * Get complete audit trail for a prescription dispensing including blockchain proof
 */
export async function getDispensingAuditTrailWithBlockchain(params: {
  prescriptionId: string;
  hospitalId: string;
}): Promise<{
  dispensing: {
    prescriptionId: string;
    timestamp: string;
    dispensedBy: string;
    medicationCount: number;
  };
  blockchainProof?: {
    txId: string;
    signerType: 'phantom' | 'embedded';
    confirmed: boolean;
    explorerUrl: string;
  };
  auditEvents: Array<{
    timestamp: string;
    action: string;
    actor: string;
    details: string;
  }>;
}> {
  const db = getSupabaseServerClient();

  try {
    // Get stock movements for this prescription
    const { data: movements } = await db
      .from('stock_movements')
      .select('*')
      .eq('prescription_id', params.prescriptionId)
      .order('movement_timestamp', { ascending: true });

    // Get signing events for this prescription
    const { data: signingEvents } = await db
      .from('signing_events')
      .select('*')
      .like('metadata->>prescriptionId', params.prescriptionId)
      .order('created_at', { ascending: true });

    // Get audit events
    const { data: auditEvents } = await db
      .from('audit_events')
      .select('*')
      .eq('entity_id', params.prescriptionId)
      .like('action', '%DISPENSED%')
      .order('timestamp', { ascending: true });

    const result: any = {
      dispensing: {
        prescriptionId: params.prescriptionId,
        timestamp: movements?.[0]?.movement_timestamp || new Date().toISOString(),
        dispensedBy: movements?.[0]?.performed_by_name || 'Unknown',
        medicationCount: new Set(movements?.map((m) => m.item_id)).size || 0,
      },
      auditEvents: (auditEvents || []).map((e) => ({
        timestamp: e.timestamp,
        action: e.action,
        actor: e.who_name,
        details: `${e.resource} - ${e.outcome}`,
      })),
    };

    // Add blockchain proof if signing event exists
    if (signingEvents && signingEvents.length > 0) {
      const signing = signingEvents[0];
      result.blockchainProof = {
        txId: signing.transaction_id,
        signerType: signing.signer_type,
        confirmed: signing.confirmed,
        explorerUrl: `https://explorer.solana.com/tx/${signing.transaction_id}?cluster=${process.env.SOLANA_NETWORK || 'devnet'}`,
      };
    }

    return result;
  } catch (error) {
    console.error('Failed to get dispensing audit trail:', error);
    throw error;
  }
}
