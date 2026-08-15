/**
 * Solana Configuration (Client-Side)
 * Environment variables for Solana blockchain interaction from the browser
 */

import { type Commitment } from '@solana/web3.js';

// ─── Network Configuration ──────────────────────────────────────────────────

export type SolanaNetwork = 'devnet' | 'testnet' | 'mainnet';

export interface SolanaClientConfig {
  network: SolanaNetwork;
  rpcUrl: string;
  programId: string;
  commitment: Commitment;
  txTimeout: number;
  maxRetries: number;
  confirmationThreshold: number;
}

// ─── Load Configuration from Environment ────────────────────────────────────

export const SOLANA_CLIENT_CONFIG: SolanaClientConfig = (() => {
  const network = (process.env.REACT_APP_SOLANA_NETWORK || 'devnet') as SolanaNetwork;
  
  // Validate network
  if (!['devnet', 'testnet', 'mainnet'].includes(network)) {
    console.warn(`Invalid REACT_APP_SOLANA_NETWORK: ${network}, defaulting to devnet`);
  }

  // RPC URL mapping
  const rpcUrls: Record<SolanaNetwork, string> = {
    devnet: 'https://api.devnet.solana.com',
    testnet: 'https://api.testnet.solana.com',
    mainnet: 'https://api.mainnet-beta.solana.com',
  };

  const rpcUrl = process.env.REACT_APP_SOLANA_RPC_URL || rpcUrls[network];

  const programId = process.env.REACT_APP_HEALTH_GRID_PROGRAM_ID || '';
  if (!programId) {
    console.warn('REACT_APP_HEALTH_GRID_PROGRAM_ID not set. Blockchain operations may fail.');
  }

  const commitment = (process.env.REACT_APP_SOLANA_COMMITMENT || 'confirmed') as Commitment;

  const txTimeout = parseInt(process.env.REACT_APP_BLOCKCHAIN_TX_TIMEOUT_MS || '60000');
  const maxRetries = parseInt(process.env.REACT_APP_BLOCKCHAIN_MAX_RETRIES || '5');
  const confirmationThreshold = parseInt(
    process.env.REACT_APP_BLOCKCHAIN_CONFIRMATION_COUNT || '32'
  );

  return {
    network,
    rpcUrl,
    programId,
    commitment,
    txTimeout,
    maxRetries,
    confirmationThreshold,
  };
})();

// ─── Validation ────────────────────────────────────────────────────────────

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!SOLANA_CLIENT_CONFIG.network) {
    errors.push('Missing REACT_APP_SOLANA_NETWORK');
  }

  if (!SOLANA_CLIENT_CONFIG.rpcUrl) {
    errors.push('Missing REACT_APP_SOLANA_RPC_URL');
  }

  if (!SOLANA_CLIENT_CONFIG.programId) {
    errors.push('Missing REACT_APP_HEALTH_GRID_PROGRAM_ID');
  }

  if (SOLANA_CLIENT_CONFIG.txTimeout < 1000) {
    errors.push('REACT_APP_BLOCKCHAIN_TX_TIMEOUT_MS too low (minimum 1000ms)');
  }

  if (SOLANA_CLIENT_CONFIG.maxRetries < 1) {
    errors.push('REACT_APP_BLOCKCHAIN_MAX_RETRIES must be >= 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Logging ────────────────────────────────────────────────────────────────

export function logConfig(verbose = false): void {
  console.log(`\n📊 === SOLANA CLIENT CONFIG ===`);
  console.log(`   Network: ${SOLANA_CLIENT_CONFIG.network}`);
  console.log(`   RPC URL: ${SOLANA_CLIENT_CONFIG.rpcUrl}`);
  console.log(`   Program ID: ${SOLANA_CLIENT_CONFIG.programId?.slice(0, 16)}...`);
  console.log(`   Commitment: ${SOLANA_CLIENT_CONFIG.commitment}`);
  console.log(`   TX Timeout: ${SOLANA_CLIENT_CONFIG.txTimeout}ms`);
  console.log(`   Max Retries: ${SOLANA_CLIENT_CONFIG.maxRetries}`);
  console.log(`   Confirmation Threshold: ${SOLANA_CLIENT_CONFIG.confirmationThreshold} slots`);

  if (verbose) {
    const validation = validateConfig();
    console.log(`\n🔍 Validation:`, validation.valid ? 'PASS' : 'FAIL');
    if (!validation.valid) {
      validation.errors.forEach((error) => console.warn(`   ⚠️ ${error}`));
    }
  }
}

// ─── Explorer URL Helper ────────────────────────────────────────────────────

export function getExplorerUrl(txId: string): string {
  const baseUrl = 'https://explorer.solana.com/tx';
  const cluster =
    SOLANA_CLIENT_CONFIG.network === 'mainnet'
      ? ''
      : `?cluster=${SOLANA_CLIENT_CONFIG.network}`;
  return `${baseUrl}/${txId}${cluster}`;
}

// ─── Phantom Network Mapping ────────────────────────────────────────────────

export function getPhantomNetworkName(): string {
  const networkMap: Record<SolanaNetwork, string> = {
    devnet: 'devnet',
    testnet: 'testnet',
    mainnet: 'mainnet-beta',
  };
  return networkMap[SOLANA_CLIENT_CONFIG.network];
}

// ─── Gas Fee Estimation ────────────────────────────────────────────────────

export const GAS_FEE_ESTIMATES = {
  recent_average: 0.00025, // SOL
  minimum: 0.00005,
  maximum: 0.00100,
};

export function formatSOL(lamports: number): string {
  const sol = lamports / 1_000_000_000;
  return `${sol.toFixed(6)} SOL (${lamports} lamports)`;
}
