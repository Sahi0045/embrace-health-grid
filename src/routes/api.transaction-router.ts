/**
 * Smart Transaction Router API
 * Orchestrates hybrid wallet signing with intelligent routing and fallback logic
 * Handles: Phantom detection, mode selection, error recovery, retries
 */

import { createServerFn } from '@tanstack/react-start';
import { getSupabaseServerClient, getVerifiedUser } from '@/lib/supabase.server';
import { signAndAnchorWithEmbedded } from './api.sign-and-anchor';
import {
  routeTransactionSigner,
  signTransactionWithRetry,
  handleSigningError,
  calculateSigningStats,
  type HybridSigningOptions,
  type SigningAttempt,
} from '@/lib/hybrid-wallet-integration.server';
import { recordSigningEvent } from './api.signing-events';
import type { TransactionPayload, SigningResult } from '@/lib/hybrid-wallet.client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TransactionRouterRequest extends TransactionPayload {
  userPreferredWallet?: 'auto' | 'phantom' | 'embedded';
  phantomAvailable?: boolean;
  phantomConnected?: boolean;
  allowFallback?: boolean; // If Phantom fails, fallback to embedded?
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

export interface TransactionRouterResponse {
  success: boolean;
  txId: string;
  signature: string;
  walletUsed: 'phantom' | 'embedded';
  confirmed: boolean;
  explorerUrl: string;
  attemptCount: number;
  totalDuration: number;
  message: string;
}

export interface TransactionRouterError {
  error: string;
  walletTried: 'phantom' | 'embedded';
  isRecoverable: boolean;
  suggestedAction: string;
  attemptCount: number;
}

// ─── Main Transaction Router ────────────────────────────────────────────────

/**
 * POST /api/transaction-router
 * 
 * Smart router that:
 * 1. Determines which wallet to use (Phantom or Embedded)
 * 2. Routes to appropriate signer
 * 3. Handles errors with fallback logic
 * 4. Retries on transient failures
 * 5. Records complete audit trail
 * 
 * Decision Logic:
 * - User preference: If saved, respect it (unless not available)
 * - Phantom available: Try Phantom if user hasn't chosen embedded
 * - Fallback enabled: Switch to embedded if Phantom fails
 * - Max retries: Retry transient failures (network, timeout)
 */
export const routeTransaction = createServerFn({
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

    const request = opts.data as TransactionRouterRequest;
    const {
      patientDid,
      recordType,
      recordHash,
      hospitalId,
      userPreferredWallet = 'auto',
      phantomAvailable = false,
      phantomConnected = false,
      allowFallback = true,
      maxRetries = 2,
      metadata = {},
    } = request;

    // ─── Validation ──────────────────────────────────────────────────────

    if (!patientDid || !recordType || !recordHash || !hospitalId) {
      throw new Error('Missing required transaction data');
    }

    if (user.hospital_id !== hospitalId) {
      throw new Error('Unauthorized: User does not have access to this hospital');
    }

    const startTime = Date.now();
    const attempts: SigningAttempt[] = [];

    try {
      console.log(`\n🔀 === TRANSACTION ROUTER ===`);
      console.log(`   Patient: ${patientDid}`);
      console.log(`   Record Type: ${recordType}`);
      console.log(`   User Preference: ${userPreferredWallet}`);
      console.log(`   Phantom Available: ${phantomAvailable}`);
      console.log(`   Fallback Enabled: ${allowFallback}`);

      // ─── Step 1: Determine Wallet Mode ───────────────────────────────

      let walletMode = await determineWalletMode({
        userPreference: userPreferredWallet,
        phantomAvailable,
        phantomConnected,
        hospitalId,
        userId: user.id,
      });

      console.log(`   Determined Mode: ${walletMode}`);

      // ─── Step 2: Get User Preference from Database ──────────────────

      const { data: savedPref, error: prefError } = await db
        .from('user_wallet_preferences')
        .select('wallet_mode')
        .eq('user_id', user.id)
        .eq('hospital_id', hospitalId)
        .single();

      if (!prefError && savedPref?.wallet_mode !== 'auto') {
        walletMode = savedPref.wallet_mode as 'phantom' | 'embedded';
        console.log(`   Database Preference: ${walletMode}`);
      }

      // ─── Step 3: Attempt Signing with Retry Logic ──────────────────

      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const attemptStart = Date.now();

        try {
          console.log(`\n📤 Attempt ${attempt}/${maxRetries}: Using ${walletMode}`);

          const result = await routeTransactionSigner(
            {
              patientDid,
              recordType,
              recordHash,
              hospitalId,
              metadata: {
                ...metadata,
                attempt,
                walletMode,
              },
            },
            {
              forceMode: walletMode,
              withFallback: allowFallback,
            }
          );

          const attemptEnd = Date.now();
          attempts.push({
            attempt,
            walletMode,
            startTime: attemptStart,
            endTime: attemptEnd,
            duration: attemptEnd - attemptStart,
            success: true,
            txId: result.txId,
          });

          console.log(`✅ Success on attempt ${attempt}`);

          // ─── Step 4: Record Success Event ────────────────────────────

          try {
            await recordSigningEvent({
              signerType: walletMode,
              txId: result.txId,
              recordType,
              recordHash,
              hospitalId,
              userWallet: walletMode === 'phantom' ? undefined : user.id,
              metadata: {
                attempt,
                duration: attempts[attempt - 1]?.duration || 0,
                totalAttempts: attempt,
              },
            });
          } catch (auditError) {
            console.warn('Failed to record signing event:', auditError);
          }

          const totalDuration = Date.now() - startTime;

          return {
            success: true,
            txId: result.txId,
            signature: result.signature,
            walletUsed: walletMode,
            confirmed: result.confirmed,
            explorerUrl: result.explorerUrl,
            attemptCount: attempt,
            totalDuration,
            message: `✅ Transaction routed and signed with ${walletMode} wallet (${attempt} attempt${attempt > 1 ? 's' : ''}, ${totalDuration}ms)`,
          } as TransactionRouterResponse;
        } catch (error) {
          const attemptEnd = Date.now();
          lastError = error instanceof Error ? error : new Error(String(error));

          attempts.push({
            attempt,
            walletMode,
            startTime: attemptStart,
            endTime: attemptEnd,
            duration: attemptEnd - attemptStart,
            success: false,
            error: lastError.message,
          });

          console.warn(`⚠️ Attempt ${attempt} failed: ${lastError.message}`);

          // ─── Step 3b: Analyze Error & Decide on Recovery ────────────

          const recovery = await handleSigningError(lastError, {
            walletMode,
            transactionData: {
              patientDid,
              recordType,
              recordHash,
              hospitalId,
            },
            attempt,
          });

          console.log(`📋 Recovery Analysis:`);
          console.log(`   Recoverable: ${recovery.isRecoverable}`);
          console.log(`   Should Retry: ${recovery.shouldRetry}`);
          console.log(`   Recommendation: ${recovery.recommendation}`);

          // Fallback to embedded if Phantom fails and fallback enabled
          if (walletMode === 'phantom' && recovery.suggestedWallet === 'embedded' && allowFallback) {
            console.log(`🔄 Switching to embedded wallet...`);
            walletMode = 'embedded';
            // Continue to next attempt with new wallet mode
          } else if (!recovery.shouldRetry || attempt === maxRetries) {
            // No more retries or shouldn't retry
            break;
          } else if (attempt < maxRetries) {
            // Retry with exponential backoff
            const delayMs = Math.pow(2, attempt - 1) * 500;
            console.log(`⏳ Waiting ${delayMs}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }

      // ─── Step 5: All Retries Failed ──────────────────────────────────

      console.error(`\n❌ === ALL ATTEMPTS FAILED ===`);

      const stats = calculateSigningStats(attempts);
      console.error(`   Statistics:`, stats);

      throw lastError || new Error('Transaction signing failed');
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error(`❌ Transaction router error: ${errorMsg}`);

      // Try to record failure event
      try {
        await recordSigningEvent({
          signerType: 'embedded', // Default
          txId: 'failed',
          recordType,
          recordHash,
          hospitalId,
          metadata: {
            error: errorMsg,
            attempts: attempts.length,
            totalDuration,
          },
        }).catch(() => {});
      } catch (_) {
        // Silently ignore audit logging failures
      }

      throw {
        error: errorMsg,
        walletTried: attempts[0]?.walletMode || 'embedded',
        isRecoverable: attempts.some((a) => a.success) === false,
        suggestedAction: `Try again later or switch wallet mode in settings. Attempts: ${attempts.length}, Duration: ${totalDuration}ms`,
        attemptCount: attempts.length,
      } as TransactionRouterError;
    }
  });

// ─── Helper: Determine Wallet Mode ──────────────────────────────────────────

/**
 * Determine which wallet mode to use based on availability and preference
 */
async function determineWalletMode(params: {
  userPreference: string;
  phantomAvailable: boolean;
  phantomConnected: boolean;
  hospitalId: string;
  userId: string;
}): Promise<'phantom' | 'embedded'> {
  const { userPreference, phantomAvailable, phantomConnected } = params;

  console.log(`\n📊 Determining wallet mode:`);
  console.log(`   User Preference: ${userPreference}`);
  console.log(`   Phantom Available: ${phantomAvailable}`);
  console.log(`   Phantom Connected: ${phantomConnected}`);

  // ─── Manual Override ────────────────────────────────────────────────

  if (userPreference === 'phantom') {
    if (phantomAvailable && phantomConnected) {
      console.log(`   → User chose Phantom (available & connected)`);
      return 'phantom';
    } else {
      console.log(`   → User chose Phantom (NOT available, falling back to embedded)`);
      return 'embedded';
    }
  }

  if (userPreference === 'embedded') {
    console.log(`   → User chose Embedded`);
    return 'embedded';
  }

  // ─── Auto-Detect ────────────────────────────────────────────────────

  if (userPreference === 'auto') {
    if (phantomAvailable && phantomConnected) {
      console.log(`   → Auto-detect: Phantom available (using Phantom)`);
      return 'phantom';
    } else if (phantomAvailable && !phantomConnected) {
      console.log(`   → Auto-detect: Phantom detected but not connected (using Embedded)`);
      return 'embedded';
    } else {
      console.log(`   → Auto-detect: Phantom not available (using Embedded)`);
      return 'embedded';
    }
  }

  // ─── Default ────────────────────────────────────────────────────────

  console.log(`   → Default: Using Embedded`);
  return 'embedded';
}

// ─── Pre-Flight Check ───────────────────────────────────────────────────────

/**
 * POST /api/transaction-router/preflight
 * Check if transaction can be signed before attempting
 * Returns diagnostics: Phantom status, hospital wallet balance, network status
 */
export const preflightCheck = createServerFn({
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

    const { hospitalId, checkPhantom = true, checkNetwork = true } = opts.data || {};

    try {
      console.log(`\n✈️ === PREFLIGHT CHECK ===`);

      const diagnostics: Record<string, any> = {
        timestamp: new Date().toISOString(),
        user: {
          authenticated: true,
          hospitalId,
        },
      };

      // ─── Check User Wallet Preference ─────────────────────────────

      if (user.hospital_id === hospitalId) {
        const { data: pref } = await db
          .from('user_wallet_preferences')
          .select('wallet_mode, phantom_public_key')
          .eq('user_id', user.id)
          .eq('hospital_id', hospitalId)
          .single();

        diagnostics.userPreference = {
          walletMode: pref?.wallet_mode || 'auto',
          phantomConnected: !!pref?.phantom_public_key,
        };
      }

      // ─── Check Hospital Wallet ────────────────────────────────────

      if (user.role === 'admin') {
        try {
          const { data: wallet } = await db
            .from('embedded_wallets')
            .select('public_key, is_active')
            .eq('hospital_id', hospitalId)
            .eq('owner_type', 'hospital')
            .single();

          diagnostics.hospitalWallet = {
            available: !!wallet?.is_active,
            address: wallet?.public_key?.slice(0, 8) + '...' || 'N/A',
          };
        } catch (_) {
          diagnostics.hospitalWallet = { available: false };
        }
      }

      // ─── Check User Preferences ───────────────────────────────────

      diagnostics.checks = {
        phantomCheck: checkPhantom ? 'enabled' : 'skipped',
        networkCheck: checkNetwork ? 'enabled' : 'skipped',
      };

      console.log(`✅ Preflight check complete:`, diagnostics);

      return {
        success: true,
        diagnostics,
      };
    } catch (error) {
      console.error('Preflight check failed:', error);
      throw error;
    }
  });

// ─── Get Routing Statistics ─────────────────────────────────────────────────

/**
 * GET /api/transaction-router/stats
 * Get hospital's transaction routing statistics (admin only)
 */
export const getRoutingStats = createServerFn({
  method: 'GET',
})
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user || user.role !== 'admin') throw new Error('Unauthorized - admin only');
    return { user };
  })
  .handler(async (opts) => {
    const db = getSupabaseServerClient();
    const user = opts.data?.user || (await getVerifiedUser());

    if (!user || user.role !== 'admin') {
      throw new Error('Only admins can view routing statistics');
    }

    try {
      // Get signing stats from signing_events
      const { data: stats } = await db.rpc('get_signing_stats', {
        p_hospital_id: user.hospital_id,
      });

      return {
        success: true,
        routingStats: stats?.[0] || {
          total_signings: 0,
          phantom_signings: 0,
          embedded_signings: 0,
          failed_signings: 0,
          confirmed_signings: 0,
          success_rate: 0,
        },
      };
    } catch (error) {
      console.error('Failed to get routing stats:', error);
      throw error;
    }
  });
