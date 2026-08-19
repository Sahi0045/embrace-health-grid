/**
 * Sign and Anchor API Endpoint
 * Backend signing with embedded hospital wallet
 * Used as fallback when Phantom not available or user chooses embedded mode
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient, getVerifiedUser } from "@/lib/supabase.server";
import { solanaBlockchainService } from "@/lib/solana-blockchain.server";
import { recordSigningEvent } from "./api.signing-events";

const nonEmptyString = z.string().trim().min(1);
const transactionIdSchema = z.object({ txId: nonEmptyString });
const signAndAnchorRequestSchema = z.object({
  patientDid: nonEmptyString,
  recordType: nonEmptyString,
  recordHash: nonEmptyString,
  hospitalId: nonEmptyString,
  userWallet: z.string().trim().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});
const airdropRequestSchema = z
  .object({
    amount: z.number().positive().max(10).optional(),
  })
  .optional()
  .transform((data) => data ?? {});

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
  walletUsed: "embedded";
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
  method: "POST",
})
  .validator(signAndAnchorRequestSchema)
  .handler(async ({ data }) => {
    const db = getSupabaseServerClient();
    const user = await getVerifiedUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: profile } = await db
      .from("profiles")
      .select("hospital_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      throw new Error("User profile not found");
    }

    const { patientDid, recordType, recordHash, hospitalId, userWallet, metadata } = data;

    // ─── Validation ──────────────────────────────────────────────────────────

    if (!patientDid || patientDid.length === 0) {
      throw new Error("Patient DID required");
    }
    if (!recordType || recordType.length === 0) {
      throw new Error("Record type required");
    }
    if (!recordHash || recordHash.length === 0) {
      throw new Error("Record hash required");
    }
    if (!hospitalId || hospitalId.length === 0) {
      throw new Error("Hospital ID required");
    }

    // Verify user has access to this hospital
    if (profile.hospital_id !== hospitalId) {
      throw new Error("Unauthorized: User does not have access to this hospital");
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
          signerType: "embedded",
          userWallet: userWallet || null,
          signedAt: new Date().toISOString(),
        },
      });

      console.log(`✅ Signed and anchored: ${txId}`);

      // ─── Step 2: Record signing event in audit trail ─────────────────────

      console.log(`📝 Recording signing event...`);

      try {
        await recordSigningEvent({
          data: {
            signerType: "embedded",
            txId,
            recordType,
            recordHash,
            userWallet: userWallet || undefined,
            hospitalId,
            metadata: {
              ...metadata,
              userId: user.id,
              userName: user.user_metadata?.name || "Unknown",
            },
          },
        });

        console.log(`✅ Event recorded`);
      } catch (auditError) {
        console.warn(`⚠️ Failed to record audit event:`, auditError);
        // Don't fail the transaction if audit fails
      }

      // ─── Step 3: Generate explorer URL ────────────────────────────────────

      const network = process.env.SOLANA_NETWORK || "devnet";
      const explorerUrl =
        network === "mainnet"
          ? `https://explorer.solana.com/tx/${txId}`
          : `https://explorer.solana.com/tx/${txId}?cluster=${network}`;

      console.log(`🔗 Explorer: ${explorerUrl}\n`);

      return {
        success: true,
        txId,
        signature: txId,
        walletUsed: "embedded",
        confirmed: true,
        explorerUrl,
      } as SignAndAnchorResponse;
    } catch (error) {
      console.error("❌ Embedded signing failed:", error);

      // Try to record failure event
      try {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await recordSigningEvent({
          data: {
            signerType: "embedded",
            txId: "failed",
            recordType,
            recordHash,
            userWallet: userWallet || undefined,
            hospitalId,
            metadata: {
              error: errorMsg,
            },
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
  method: "GET",
})
  .validator(transactionIdSchema)
  .handler(async ({ data }) => {
    const user = await getVerifiedUser();
    if (!user) {
      throw new Error("Authentication required");
    }

    const { txId } = data;

    if (!txId) {
      throw new Error("Transaction ID required");
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
        message: result.verified ? "✅ Record verified on blockchain" : "⏳ Awaiting confirmation",
      };
    } catch (error) {
      console.error("Verification failed:", error);
      throw error;
    }
  });

// ─── Get Transaction Status ──────────────────────────────────────────────────

/**
 * GET /api/sign-and-anchor/:txId/status
 * Get current status of a transaction (pending, confirmed, failed)
 */
export const getTransactionStatus = createServerFn({
  method: "GET",
})
  .validator(transactionIdSchema)
  .handler(async ({ data }) => {
    const db = getSupabaseServerClient();
    const user = await getVerifiedUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: profile } = await db
      .from("profiles")
      .select("hospital_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      throw new Error("User profile not found");
    }

    const { txId } = data;

    if (!txId) {
      throw new Error("Transaction ID required");
    }

    try {
      // Get from audit trail
      const { data: record, error } = await db
        .from("signing_events")
        .select("status, confirmed, error_message, created_at")
        .eq("transaction_id", txId)
        .eq("hospital_id", profile.hospital_id)
        .single();

      if (error?.code === "PGRST116") {
        throw new Error(`Transaction not found: ${txId}`);
      }

      if (error) {
        throw new Error(`Failed to fetch status: ${error.message}`);
      }

      return {
        txId,
        status: record.status,
        confirmed: record.confirmed,
        errorMessage: record.error_message,
        created_at: record.created_at,
      };
    } catch (error) {
      console.error("Failed to get transaction status:", error);
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
  method: "GET",
}).handler(async () => {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const db = getSupabaseServerClient();
  const { data: profile } = await db
    .from("profiles")
    .select("hospital_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    throw new Error("Only admins can view hospital wallet balance");
  }

  try {
    // Get hospital wallet public key from embedded_wallets table
    const { data: wallet, error } = await db
      .from("embedded_wallets")
      .select("public_key")
      .eq("hospital_id", profile.hospital_id)
      .eq("owner_type", "hospital")
      .eq("is_active", true)
      .single();

    if (error) {
      throw new Error("Hospital wallet not found");
    }

    // Get balance from blockchain
    const balance = await solanaBlockchainService.getBalance(wallet.public_key);

    // Convert lamports to SOL (1 SOL = 1 billion lamports)
    const solBalance = balance / 1_000_000_000;

    const status = solBalance > 1 ? "✅ Sufficient" : solBalance > 0.1 ? "⚠️ Low" : "❌ Critical";

    return {
      walletAddress: wallet.public_key,
      balanceLamports: balance,
      balanceSOL: solBalance.toFixed(6),
      status,
      warningThreshold: 0.1,
      criticalThreshold: 0.01,
    };
  } catch (error) {
    console.error("Failed to get hospital wallet balance:", error);
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
  method: "POST",
})
  .validator(airdropRequestSchema)
  .handler(async ({ data }) => {
    const network = process.env.SOLANA_NETWORK || "devnet";

    if (network === "mainnet") {
      throw new Error("Airdrops only available on Devnet/Testnet");
    }

    const user = await getVerifiedUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const db = getSupabaseServerClient();
    const { data: profile } = await db
      .from("profiles")
      .select("hospital_id, role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      throw new Error("Only admins can request airdrops");
    }

    const { amount = 1 } = data;

    try {
      console.log(`💰 Requesting ${amount} SOL airdrop for hospital wallet...`);

      // Get hospital wallet
      const { data: wallet, error } = await db
        .from("embedded_wallets")
        .select("public_key")
        .eq("hospital_id", profile.hospital_id)
        .eq("owner_type", "hospital")
        .eq("is_active", true)
        .single();

      if (error) {
        throw new Error("Hospital wallet not found");
      }

      // Request airdrop
      const signature = await solanaBlockchainService.requestAirdrop(wallet.public_key, amount);

      console.log(`✅ Airdrop requested: ${signature}`);

      return {
        success: true,
        amount,
        network,
        signature,
        message: `Requested ${amount} SOL airdrop. Transaction: ${signature}`,
      };
    } catch (error) {
      console.error("Failed to request airdrop:", error);
      throw error;
    }
  });
