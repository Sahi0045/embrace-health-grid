/**
 * Hybrid Wallet Integration (Server-Side)
 * Bridges client-side wallet selection with backend signing
 * Handles transaction routing and error recovery
 */

import { signAndAnchorWithEmbedded } from '@/routes/api.sign-and-anchor';
import { recordSigningEvent } from '@/routes/api.signing-events';
import type { SigningResult, TransactionPayload } from '@/lib/hybrid-wallet.client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HybridSigningOptions {
  forceMode?: 'phantom' | 'embedded';
  withFallback?: boolean; // If Phantom fails, fallback to embedded?
  timeout?: number;
}

export interface SigningAttempt {
  attempt: number;
  walletMode: 'phantom' | 'embedded';
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  txId?: string;
  error?: string;
}

// ─── Server-Side Signing Router ──────────────────────────────────────────────

/**
 * Route transaction to appropriate signer (Phantom or Embedded)
 * This is called from the backend when client chooses embedded mode
 * 
 * Decision tree:
 * 1. If forceMode specified, use that
 * 2. If Phantom signing chosen and available, use Phantom
 * 3. Fallback to embedded (backend) signing
 */
export async function routeTransactionSigner(
  transactionData: TransactionPayload,
  options: HybridSigningOptions = {}
): Promise<SigningResult> {
  const { forceMode, withFallback = true, timeout = 60000 } = options;

  let signerMode: 'phantom' | 'embedded' = forceMode || 'embedded';
  let lastError: Error | null = null;

  console.log(`\n🔀 === ROUTING TRANSACTION ===`);
  console.log(`   Force Mode: ${forceMode || 'none'}`);
  console.log(`   Primary Signer: ${signerMode}`);
  console.log(`   Fallback Enabled: ${withFallback}`);

  try {
    // ─── Phantom Mode (if chosen) ────────────────────────────────────────

    if (signerMode === 'phantom') {
      try {
        console.log(`\n⏳ Attempting Phantom signing...`);

        // Note: Phantom signing happens on client-side
        // This is just to indicate we're expecting Phantom to handle it
        // The actual Phantom integration is in hybrid-wallet.client.ts

        console.log(
          `ℹ️  Phantom signing: Client will handle via window.solana.signTransaction()`
        );
        console.log(`⚠️  This should not reach server - client-side Phantom integration issue`);

        throw new Error('Phantom signing should be handled on client-side');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ Phantom signing failed:`, lastError.message);

        if (withFallback) {
          console.log(`🔄 Falling back to embedded wallet...`);
          signerMode = 'embedded';
        } else {
          throw lastError;
        }
      }
    }

    // ─── Embedded Mode (primary or fallback) ─────────────────────────────

    if (signerMode === 'embedded') {
      try {
        console.log(`\n⏳ Signing with embedded wallet (backend)...`);

        const startTime = Date.now();

        const result = await signAndAnchorWithEmbedded({
          data: {
            patientDid: transactionData.patientDid,
            recordType: transactionData.recordType,
            recordHash: transactionData.recordHash,
            hospitalId: transactionData.hospitalId,
            metadata: transactionData.metadata,
          }
        });

        const duration = Date.now() - startTime;

        console.log(`✅ Embedded signing successful (${duration}ms)`);
        console.log(`   TX ID: ${result.txId}`);

        return {
          txId: result.txId,
          walletUsed: 'embedded',
          signature: result.signature,
          timestamp: new Date(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ Embedded signing failed:`, lastError.message);
        throw lastError;
      }
    }

    throw new Error('No valid signer mode available');
  } catch (error) {
    console.error(`\n❌ === SIGNING FAILED ===`);
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);

    throw error;
  }
}

// ─── Transaction with Retry Logic ───────────────────────────────────────────

/**
 * Sign transaction with exponential backoff retry
 * Useful for network failures or temporary unavailability
 */
export async function signTransactionWithRetry(
  transactionData: TransactionPayload,
  options: HybridSigningOptions & { maxRetries?: number } = {}
): Promise<SigningResult> {
  const { maxRetries = 3, ...routerOptions } = options;

  const attempts: SigningAttempt[] = [];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();

    try {
      console.log(`\n📤 Signing attempt ${attempt}/${maxRetries}...`);

      const result = await routeTransactionSigner(transactionData, routerOptions);

      const endTime = Date.now();
      attempts.push({
        attempt,
        walletMode: result.walletUsed,
        startTime,
        endTime,
        duration: endTime - startTime,
        success: true,
        txId: result.txId,
      });

      console.log(`✅ Success on attempt ${attempt}`);
      return result;
    } catch (error) {
      const endTime = Date.now();
      const errorMsg = error instanceof Error ? error.message : String(error);

      attempts.push({
        attempt,
        walletMode: 'embedded',
        startTime,
        endTime,
        duration: endTime - startTime,
        success: false,
        error: errorMsg,
      });

      console.warn(`⚠️ Attempt ${attempt} failed: ${errorMsg}`);

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`⏳ Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.error(`❌ All ${maxRetries} attempts failed`);
        throw error;
      }
    }
  }

  throw new Error(`Failed to sign transaction after ${maxRetries} attempts`);
}

// ─── Get Signing Recommendation ──────────────────────────────────────────────

/**
 * Recommend which signer to use based on system state
 * Takes into account Phantom availability, recent failures, etc.
 */
export async function getSigningRecommendation(
  hospitalId: string,
  options: { phantomAvailable?: boolean } = {}
): Promise<'phantom' | 'embedded'> {
  // For now, simple logic:
  // If Phantom available -> recommend Phantom
  // Otherwise -> recommend embedded

  if (options.phantomAvailable) {
    return 'phantom';
  }

  // Could add more sophisticated logic here:
  // - Check recent signing failure rate
  // - Check hospital wallet balance
  // - Check network conditions
  // - Check user preference

  return 'embedded';
}

// ─── Error Recovery ─────────────────────────────────────────────────────────

/**
 * Handle signing errors with appropriate recovery strategies
 */
export async function handleSigningError(
  error: Error,
  context: {
    walletMode: 'phantom' | 'embedded';
    transactionData: TransactionPayload;
    attempt: number;
  }
): Promise<{
  isRecoverable: boolean;
  recommendation: string;
  shouldRetry: boolean;
  suggestedWallet?: 'phantom' | 'embedded';
}> {
  const { walletMode, transactionData, attempt } = context;

  const errorMsg = error.message.toLowerCase();

  console.log(`\n🔍 Analyzing error: ${error.message}`);

  // ─── Phantom Errors ──────────────────────────────────────────────────────

  if (walletMode === 'phantom') {
    if (errorMsg.includes('user rejected')) {
      return {
        isRecoverable: false,
        recommendation: 'User cancelled the transaction in Phantom',
        shouldRetry: false,
      };
    }

    if (errorMsg.includes('connection')) {
      return {
        isRecoverable: true,
        recommendation: 'Phantom connection lost. Try again.',
        shouldRetry: true,
        suggestedWallet: 'embedded',
      };
    }

    if (errorMsg.includes('balance')) {
      return {
        isRecoverable: false,
        recommendation: 'Insufficient balance in Phantom wallet for gas fees',
        shouldRetry: false,
        suggestedWallet: 'embedded',
      };
    }

    // Default: fall back to embedded
    return {
      isRecoverable: true,
      recommendation: 'Phantom signing failed. Falling back to embedded wallet.',
      shouldRetry: true,
      suggestedWallet: 'embedded',
    };
  }

  // ─── Embedded Errors ─────────────────────────────────────────────────────

  if (walletMode === 'embedded') {
    if (errorMsg.includes('hospital wallet')) {
      return {
        isRecoverable: false,
        recommendation:
          'Hospital wallet not available. Contact administrator.',
        shouldRetry: false,
      };
    }

    if (errorMsg.includes('balance') || errorMsg.includes('insufficient')) {
      return {
        isRecoverable: false,
        recommendation:
          'Insufficient SOL balance in hospital wallet. Contact administrator.',
        shouldRetry: false,
      };
    }

    if (errorMsg.includes('network')) {
      return {
        isRecoverable: true,
        recommendation: 'Network error. Retrying...',
        shouldRetry: attempt < 3,
      };
    }

    if (errorMsg.includes('timeout')) {
      return {
        isRecoverable: true,
        recommendation: 'Transaction timeout. Retrying...',
        shouldRetry: attempt < 3,
      };
    }
  }

  // ─── Unknown Error ──────────────────────────────────────────────────────

  return {
    isRecoverable: true,
    recommendation: `Unknown error: ${error.message}. Retrying...`,
    shouldRetry: attempt < 3,
  };
}

// ─── Signing Statistics ──────────────────────────────────────────────────────

export interface SigningStatistics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  averageDuration: number;
  successRate: number;
  phantomUsageRate: number;
}

/**
 * Calculate signing statistics from attempts
 */
export function calculateSigningStats(attempts: SigningAttempt[]): SigningStatistics {
  if (attempts.length === 0) {
    return {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      averageDuration: 0,
      successRate: 0,
      phantomUsageRate: 0,
    };
  }

  const successful = attempts.filter((a) => a.success);
  const failed = attempts.filter((a) => !a.success);
  const phantom = attempts.filter((a) => a.walletMode === 'phantom');

  const totalDuration = successful.reduce((sum, a) => sum + (a.duration || 0), 0);
  const avgDuration = successful.length > 0 ? totalDuration / successful.length : 0;

  return {
    totalAttempts: attempts.length,
    successfulAttempts: successful.length,
    failedAttempts: failed.length,
    averageDuration: Math.round(avgDuration),
    successRate: Math.round((successful.length / attempts.length) * 100),
    phantomUsageRate: Math.round((phantom.length / attempts.length) * 100),
  };
}
