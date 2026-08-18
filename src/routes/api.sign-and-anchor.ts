/**
 * Sign and Anchor API Endpoint
 * Backend signing with embedded hospital wallet
 * Used as fallback when Phantom not available or user chooses embedded mode
 */

import { createServerFn } from '@tanstack/react-start';
import { getSupabaseServerClient, getVerifiedUser } from '@/lib/supabase.server';
import { solanaBlockchainService } from '@/lib/solana-blockchain.server';
import { recordSigningEvent } from './api.signing-events';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SignAndAnchorRequest {
  patientDid: string;
  recordType: string;
  recordHash: string;
  hospitalId: string;
  userWallet?: string; // If Phantom was used (for audit)
  metadata?: Record<string, unknown>;
}

export interface SignAndAnchorResponse {
  success: boolean;
  txId: string;
  signature: string;
  walletUsed: 'embedded';
  confirmed: boolean;
  explorerUrl: string;
}

// ─── Sign and Anchor with Embedded Wallet ────────────────────────────────────

/**
 * POST /api/sign-and-anchor
 * Sign transaction with hospital's embedded wallet and anchor to Solana blockchain
 *
 * This endpoint:
 * 1. Verifies user is authorized for this hospital
 * 2. Signs TX with embedded hospital wallet (server-side)
 * 3. Sends to Solana blockchain
 * 4. Records signing event in audit trail
 * 5. Returns TX ID for verification
 *
 * Response includes explorer URL so user can verify on-chain
 */
export const signAndAnchorWithEmbedded = createServerFn({
  method: 'POST',
})
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user) throw new Error('Unauthorized');
    return { user };
  })
  .handler(async (opts) => {
    const db = getSupabaseServerClient();
    const user = opts.data?.user || (await getVerifiedUser());

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { patientDid, recordType, recordHash, hospitalId, userWallet, metadata } =
      opts.data as SignAndAnchorRequest;

    // ─── Validation ──────────────────────────────────────────────────────────

    if (!patientDid || patientDid.length === 0) {
      throw new Error('Patient DID required');
    }
    if (!recordType || recordType.length === 0) {
      throw new Error('Record type required');
    }
    if (!recordHash || recordHash.length === 0) {
      throw new Error('Record hash required');
    }
    if (!hospitalId || hospitalId.length === 0) {
      throw new Error('Hospital ID required');
    }

    // Verify user has access to this hospital
    if (user.hospital_id !== hospitalId) {
      throw new Error('Unauthorized: User does not have access to this hospital');
    }

    try {
      console.log(`\n🔐 === EMBEDDED WALLET SIGNING ===`);
      console.log(`   Patient: ${patientDid}`);
      console.log(`   Record Type: ${recordType}`);
      console.log(`   Hash: ${recordHash.slice(0, 16)}...`);

      // ─── Step 1: Sign with embedded wallet (backend) ──────────────────────

      console.log(`⏳ Signing with embedded wallet...`);

      const txId = await solanaBlockchainService.anchorMedicalRecord({
        patientDid,
        recordType,
        recordHash,
        hospitalId,
        metadata: {
          ...metadata,
          signerType: 'embedded',
          userWallet: userWallet || null,
          signedAt: new Date().toISOString(),
        },
      });

      console.log(`✅ Signed and anchored: ${txId}`);

      // ─── Step 2: Record signing event in audit trail ─────────────────────

      console.log(`📝 Recording signing event...`);

      try {
        await recordSigningEvent({
          signerType: 'embedded',
          txId,
          recordType,
          recordHash,
          userWallet: userWallet || undefined,
          hospitalId,
          metadata: {
            ...metadata,
            userId: user.id,
            userName: user.user_metadata?.name || 'Unknown',
          },
        });

        console.log(`✅ Event recorded`);
      } catch (auditError) {
        console.warn(`⚠️ Failed to record audit event:`, auditError);
        // Don't fail the transaction if audit fails
      }

      // ─── Step 3: Generate explorer URL ────────────────────────────────────

      const network = process.env.SOLANA_NETWORK || 'devnet';
      const explorerUrl =
        network === 'mainnet'
          ? `https://explorer.solana.com/tx/${txId}`
          : `https://explorer.solana.com/tx/${txId}?cluster=${network}`;

      console.log(`🔗 Explorer: ${explorerUrl}\n`);

      return {
        success: true,
        txId,
        signature: txId,
        walletUsed: 'embedded',
        confirmed: true,
        explorerUrl,
      } as SignAndAnchorResponse;
    } catch (error) {
      console.error('❌ Embedded signing failed:', error);

      // Try to record failure event
      try {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await recordSigningEvent({
          signerType: 'embedded',
          txId: 'failed',
          recordType,
          recordHash,
          userWallet: userWallet || undefined,
          hospitalId,
          metadata: {
            error: errorMsg,
          },
        }).catch(() => {}); // Silently fail if audit recording fails
      } catch (_) {
        // Ignore
      }

      throw error;
    }
  });

// ─── Verify Blockchain Record ────────────────────────────────────────────────

/**
 * GET /api/sign-and-anchor/:txId/verify
 * Verify that a transaction was successfully anchored and confirmed
 */
export const verifyAnchoredRecord = createServerFn({
  method: 'GET',
})
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user) throw new Error('Unauthorized');
    return { user };
  })
  .handler(async (opts) => {
    const { txId } = opts.data || {};

    if (!txId) {
      throw new Error('Transaction ID required');
    }

    try {
      console.log(`🔍 Verifying transaction: ${txId}`);

      const result = await solanaBlockchainService.verifyAnchoredRecord(txId);

      return {
        txId,
        verified: result.verified,
        slot: result.slot,
        signature: result.signature,
        explorerUrl: result.explorerUrl,
        message: result.verified ? '✅ Record verified on blockchain' : '⏳ Awaiting confirmation',
      };
    } catch (error) {
      console.error('Verification failed:', error);
      throw error;
    }
  });

// ─── Get Transaction Status ──────────────────────────────────────────────────

/**
 * GET /api/sign-and-anchor/:txId/status
 * Get current status of a transaction (pending, confirmed, failed)
 */
export const getTransactionStatus = createServerFn({
  method: 'GET',
})
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user) throw new Error('Unauthorized');
    return { user };
  })
  .handler(async (opts) => {
    const db = getSupabaseServerClient();
    const user = opts.data?.user || (await getVerifiedUser());

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { txId } = opts.data || {};

    if (!txId) {
      throw new Error('Transaction ID required');
    }

    try {
      // Get from audit trail
      const { data, error } = await db
        .from('signing_events')
        .select('status, confirmed, error_message, created_at')
        .eq('transaction_id', txId)
        .eq('hospital_id', user.hospital_id)
        .single();

      if (error?.code === 'PGRST116') {
        throw new Error(`Transaction not found: ${txId}`);
      }

      if (error) {
        throw new Error(`Failed to fetch status: ${error.message}`);
      }

      return {
        txId,
        status: data.status,
        confirmed: data.confirmed,
        errorMessage: data.error_message,
        created_at: data.created_at,
      };
    } catch (error) {
      console.error('Failed to get transaction status:', error);
      throw error;
    }
  });

// ─── Get Hospital Wallet Balance ─────────────────────────────────────────────

/**
 * GET /api/sign-and-anchor/hospital/balance
 * Get hospital's embedded wallet balance (admin only)
 * Used to monitor if hospital has enough SOL for gas fees
 */
export const getHospitalWalletBalance = createServerFn({
  method: 'GET',
})
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user || user.role !== 'admin') throw new Error('Unauthorized - admin only');
    return { user };
  })
  .handler(async (opts) => {
    const user = opts.data?.user || (await getVerifiedUser());

    if (!user || user.role !== 'admin') {
      throw new Error('Only admins can view hospital wallet balance');
    }

    try {
      // Get hospital wallet public key from embedded_wallets table
      const db = getSupabaseServerClient();

      const { data: wallet, error } = await db
        .from('embedded_wallets')
        .select('public_key')
        .eq('hospital_id', user.hospital_id)
        .eq('owner_type', 'hospital')
        .eq('is_active', true)
        .single();

      if (error) {
        throw new Error('Hospital wallet not found');
      }

      // Get balance from blockchain
      const balance = await solanaBlockchainService.getBalance(wallet.public_key);

      // Convert lamports to SOL (1 SOL = 1 billion lamports)
      const solBalance = balance / 1_000_000_000;

      const status =
        solBalance > 1 ? '✅ Sufficient' : solBalance > 0.1 ? '⚠️ Low' : '❌ Critical';

      return {
        walletAddress: wallet.public_key,
        balanceLamports: balance,
        balanceSOL: solBalance.toFixed(6),
        status,
        warningThreshold: 0.1,
        criticalThreshold: 0.01,
      };
    } catch (error) {
      console.error('Failed to get hospital wallet balance:', error);
      throw error;
    }
  });

// ─── Request SOL Airdrop (Devnet Only) ───────────────────────────────────────

/**
 * POST /api/sign-and-anchor/hospital/airdrop
 * Request SOL airdrop for hospital wallet (Devnet/Testnet only)
 * Admin only - for testing purposes
 */
export const requestHospitalAirdrop = createServerFn({
  method: 'POST',
})
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user || user.role !== 'admin') throw new Error('Unauthorized - admin only');
    return { user };
  })
  .handler(async (opts) => {
    const network = process.env.SOLANA_NETWORK || 'devnet';

    if (network === 'mainnet') {
      throw new Error('Airdrops only available on Devnet/Testnet');
    }

    const user = opts.data?.user || (await getVerifiedUser());

    if (!user || user.role !== 'admin') {
      throw new Error('Only admins can request airdrops');
    }

    const { amount = 1 } = opts.data || {};

    try {
      console.log(`💰 Requesting ${amount} SOL airdrop for hospital wallet...`);

      // Get hospital wallet
      const db = getSupabaseServerClient();

      const { data: wallet, error } = await db
        .from('embedded_wallets')
        .select('public_key')
        .eq('hospital_id', user.hospital_id)
        .eq('owner_type', 'hospital')
        .eq('is_active', true)
        .single();

      if (error) {
        throw new Error('Hospital wallet not found');
      }

      // Request airdrop
      const signature = await solanaBlockchainService.requestAirdrop(
        wallet.public_key,
        amount
      );

      console.log(`✅ Airdrop requested: ${signature}`);

      return {
        success: true,
        amount,
        network,
        signature,
        message: `Requested ${amount} SOL airdrop. Transaction: ${signature}`,
      };
    } catch (error) {
      console.error('Failed to request airdrop:', error);
      throw error;
    }
  });
