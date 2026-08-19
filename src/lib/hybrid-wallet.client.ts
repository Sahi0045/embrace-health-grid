/**
 * Hybrid Wallet Client
 * Seamless integration of Phantom (user signing) + Embedded (backend signing) wallets
 *
 * Usage:
 *   const { walletMode, isConnected } = useHybridWallet();
 *   const { txId } = await signAndAnchorTransaction(data);
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WalletMode = "phantom" | "embedded" | "auto";

export interface HybridWalletState {
  walletMode: WalletMode;
  isPhantomDetected: boolean;
  isPhantomConnected: boolean;
  phantomPublicKey: string | null;
  userPreference: WalletMode | null;
  loading: boolean;
  error: string | null;
}

export interface TransactionPayload {
  patientDid: string;
  recordType: string;
  recordHash: string;
  hospitalId: string;
  metadata?: Record<string, unknown>;
}

export interface SigningResult {
  txId: string;
  walletUsed: "phantom" | "embedded";
  signature: string;
  userWallet?: string; // If Phantom mode
  timestamp: Date;
  confirmed?: boolean;
  explorerUrl?: string;
}

// ─── Phantom Wallet Integration ──────────────────────────────────────────────

/**
 * Check if Phantom wallet is available
 */
export function isPhantomInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).solana?.isPhantom;
}

/**
 * Get Phantom provider
 */
function getPhantomProvider() {
  if (typeof window === "undefined") return null;
  const phantom = (window as any).solana;
  return phantom?.isPhantom ? phantom : null;
}

/**
 * Connect to Phantom wallet
 * Prompts user to authorize connection
 */
export async function connectPhantom(): Promise<{ publicKey: string }> {
  const phantom = getPhantomProvider();
  if (!phantom) {
    throw new Error("Phantom wallet not found. Install from https://phantom.app");
  }

  try {
    const { publicKey } = await phantom.connect();
    console.log("✅ Connected to Phantom:", publicKey.toBase58());
    return { publicKey: publicKey.toBase58() };
  } catch (error) {
    console.error("❌ Failed to connect to Phantom:", error);
    throw error;
  }
}

/**
 * Disconnect from Phantom wallet
 */
export async function disconnectPhantom(): Promise<void> {
  const phantom = getPhantomProvider();
  if (phantom && phantom.disconnect) {
    await phantom.disconnect();
    console.log("✅ Disconnected from Phantom");
  }
}

/**
 * Sign transaction with Phantom wallet
 * Sends to user's Phantom extension for approval
 */
export async function signWithPhantom(transactionData: TransactionPayload): Promise<SigningResult> {
  const phantom = getPhantomProvider();
  if (!phantom) {
    throw new Error("Phantom wallet not available");
  }

  try {
    // Step 1: Connect if not already connected
    let publicKey: PublicKey;
    try {
      const { publicKey: pk } = await phantom.connect({ onlyIfTrusted: true });
      publicKey = pk;
    } catch {
      const { publicKey: pk } = await phantom.connect();
      publicKey = pk;
    }

    // Step 2: Build transaction
    const connection = new Connection(
      process.env.REACT_APP_SOLANA_RPC_URL || "https://api.devnet.solana.com",
    );

    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    // Create transaction with instruction
    const message = new TransactionMessage({
      payerKey: publicKey,
      recentBlockhash: blockhash,
      instructions: [
        {
          programId: new PublicKey(process.env.REACT_APP_HEALTH_GRID_PROGRAM_ID!),
          keys: [
            {
              pubkey: publicKey,
              isSigner: true,
              isWritable: false,
            },
          ],
          data: Buffer.concat([
            Buffer.from([1]), // Instruction discriminator
            Buffer.from(transactionData.recordType.padEnd(32, "\0")),
            Buffer.from(transactionData.recordHash, "hex"),
            Buffer.from(transactionData.patientDid.padEnd(64, "\0")),
          ]),
        },
      ],
    }).compileToV0Message();

    const versionedTx = new VersionedTransaction(message);

    // Step 3: Send to Phantom for signing
    // This triggers the Phantom popup where user approves/denies
    const signedTx = await phantom.signTransaction(versionedTx);

    console.log("✅ Transaction signed by Phantom");

    // Step 4: Send signed transaction to blockchain
    const txId = await connection.sendRawTransaction(signedTx.serialize(), {
      maxRetries: 5,
      skipPreflight: false,
    });

    console.log(`📤 Transaction sent: ${txId}`);

    // Step 5: Wait for confirmation
    const confirmation = await connection.confirmTransaction(txId, "confirmed");
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    console.log(`✅ Transaction confirmed: ${txId}`);

    // Step 6: Save to backend for audit trail
    await savePhantomsigningEvent({
      txId,
      userWallet: publicKey.toBase58(),
      recordHash: transactionData.recordHash,
      recordType: transactionData.recordType,
      hospitalId: transactionData.hospitalId,
    });

    return {
      txId,
      walletUsed: "phantom",
      signature: txId,
      userWallet: publicKey.toBase58(),
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("❌ Phantom signing failed:", error);
    throw error;
  }
}

// ─── Embedded Wallet Integration ─────────────────────────────────────────────

/**
 * Sign transaction using embedded wallet (backend)
 * No user prompts, seamless experience
 */
export async function signWithEmbedded(
  transactionData: TransactionPayload,
): Promise<SigningResult> {
  try {
    // Send to backend - backend uses hospital wallet to sign
    const response = await fetch("/api/sign-and-anchor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        patientDid: transactionData.patientDid,
        recordType: transactionData.recordType,
        recordHash: transactionData.recordHash,
        hospitalId: transactionData.hospitalId,
        metadata: transactionData.metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Backend error: ${error.message}`);
    }

    const { txId, signature } = await response.json();

    console.log(`✅ Transaction signed with embedded wallet: ${txId}`);

    return {
      txId,
      walletUsed: "embedded",
      signature,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("❌ Embedded signing failed:", error);
    throw error;
  }
}

// ─── Hybrid Wallet Selection ─────────────────────────────────────────────────

/**
 * Sign and anchor transaction using hybrid wallet logic
 *
 * Decision tree:
 * 1. Check user preference (manual override)
 * 2. Check if Phantom available and connected
 * 3. Fallback to embedded
 */
export async function signAndAnchorTransaction(
  transactionData: TransactionPayload,
  options: {
    forceMode?: "phantom" | "embedded";
    showProgress?: boolean;
  } = {},
): Promise<SigningResult> {
  try {
    // Determine which wallet to use
    let walletMode: "phantom" | "embedded" = "embedded";

    if (options.forceMode) {
      walletMode = options.forceMode;
    } else if (isPhantomInstalled() && getPhantomProvider()) {
      // Auto-detect Phantom
      walletMode = "phantom";
    }

    console.log(`🔄 Signing with: ${walletMode}`);

    // Route to appropriate signer
    if (walletMode === "phantom") {
      try {
        return await signWithPhantom(transactionData);
      } catch (error) {
        console.warn("Phantom signing failed, falling back to embedded:", error);
        // Fallback to embedded if Phantom fails
        return await signWithEmbedded(transactionData);
      }
    } else {
      return await signWithEmbedded(transactionData);
    }
  } catch (error) {
    console.error("❌ Transaction signing failed:", error);
    throw error;
  }
}

// ─── User Preference Management ──────────────────────────────────────────────

/**
 * Get user's wallet preference
 */
export async function getUserWalletPreference(): Promise<WalletMode> {
  try {
    const response = await fetch("/api/wallet-preference");
    if (!response.ok) return "auto";

    const { walletMode } = await response.json();
    return walletMode as WalletMode;
  } catch (error) {
    console.error("Failed to fetch wallet preference:", error);
    return "auto";
  }
}

/**
 * Save user's wallet preference
 */
export async function saveUserWalletPreference(walletMode: WalletMode): Promise<void> {
  try {
    const response = await fetch("/api/wallet-preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletMode }),
    });

    if (!response.ok) {
      throw new Error("Failed to save preference");
    }

    console.log(`✅ Wallet preference saved: ${walletMode}`);
  } catch (error) {
    console.error("Failed to save wallet preference:", error);
    throw error;
  }
}

// ─── Audit Trail Recording ──────────────────────────────────────────────────

/**
 * Record Phantom signing event for audit trail
 */
async function savePhantomsigningEvent(params: {
  txId: string;
  userWallet: string;
  recordHash: string;
  recordType: string;
  hospitalId: string;
}): Promise<void> {
  try {
    await fetch("/api/signing-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signerType: "phantom",
        txId: params.txId,
        userWallet: params.userWallet,
        recordHash: params.recordHash,
        recordType: params.recordType,
        hospitalId: params.hospitalId,
      }),
    });
  } catch (error) {
    console.warn("Failed to record signing event:", error);
    // Don't throw - transaction already sent, just audit logging failed
  }
}

// ─── Wallet Status ──────────────────────────────────────────────────────────

/**
 * Get current wallet status
 */
export async function getWalletStatus(): Promise<HybridWalletState> {
  const isPhantomDetected = isPhantomInstalled();
  const phantom = getPhantomProvider();
  const userPreference = await getUserWalletPreference();

  let walletMode: WalletMode;
  if (userPreference !== "auto") {
    walletMode = userPreference;
  } else if (isPhantomDetected) {
    walletMode = "phantom";
  } else {
    walletMode = "embedded";
  }

  return {
    walletMode,
    isPhantomDetected,
    isPhantomConnected: !!phantom && phantom.isConnected,
    phantomPublicKey: phantom?.publicKey?.toBase58() || null,
    userPreference,
    loading: false,
    error: null,
  };
}

// ─── Connection Monitoring ──────────────────────────────────────────────────

/**
 * Listen for Phantom account changes
 */
export function onPhantomAccountChange(callback: (publicKey: string | null) => void): () => void {
  const phantom = getPhantomProvider();
  if (!phantom) return () => {};

  const handler = (publicKeys: PublicKey[]) => {
    if (publicKeys.length > 0) {
      callback(publicKeys[0].toBase58());
    } else {
      callback(null);
    }
  };

  phantom.on("accountChanged", handler);

  // Return unsubscribe function
  return () => phantom.off("accountChanged", handler);
}

/**
 * Listen for Phantom network changes
 */
export function onPhantomNetworkChange(callback: (network: string) => void): () => void {
  const phantom = getPhantomProvider();
  if (!phantom) return () => {};

  const handler = (network: any) => {
    callback(network?.chainId || "unknown");
  };

  phantom.on("networkChanged", handler);

  // Return unsubscribe function
  return () => phantom.off("networkChanged", handler);
}

// ─── Error Handling ─────────────────────────────────────────────────────────

/**
 * User-friendly error messages
 */
export function getWalletErrorMessage(error: any): string {
  if (!error) return "Unknown error";

  const message = error.message || String(error);

  if (message.includes("User rejected")) {
    return "You cancelled the transaction in Phantom.";
  }
  if (message.includes("Phantom")) {
    return "Phantom wallet error. Make sure Phantom is open and connected.";
  }
  if (message.includes("network")) {
    return "Network error. Check your internet connection.";
  }
  if (message.includes("Balance")) {
    return "Insufficient balance. The wallet needs SOL for gas fees.";
  }

  return `Signing failed: ${message}`;
}
