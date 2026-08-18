import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  Keypair,
} from '@solana/web3.js';
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
    this.programId = new PublicKey(process.env.HEALTH_GRID_PROGRAM_ID || '11111111111111111111111111111111');
    this.network = (process.env.SOLANA_NETWORK || 'devnet') as any;
  }

  /**
   * Anchor a medical record to Solana blockchain
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

      // Step 2: Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

      // Step 3: Build instruction
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
          Buffer.from([0]), // Instruction discriminator
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

      // Step 5: Sign transaction
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
        wallet_id: crypto.randomUUID(),
        operation_type: 'anchor_record',
        solana_tx_id: txId,
        program_id: this.programId.toBase58(),
        status: 'confirmed',
        confirmation_status: 'confirmed',
        confirmation_count: 32,
        slot: confirmation.context.slot,
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
   */
  async verifyAnchoredRecord(txId: string): Promise<{
    verified: boolean;
    slot: number | null;
    signature: string | null;
    explorerUrl: string;
  }> {
    try {
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

      if (tx.meta?.err) {
        return {
          verified: false,
          slot: tx.slot,
          signature: txId,
          explorerUrl: this.getExplorerUrl(txId),
        };
      }

      const commitment = await this.connection.getSignatureStatus(txId);
      const isFinalized = commitment.value?.confirmationStatus === 'finalized';

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
   * Get balance for a wallet public key
   */
  async getBalance(publicKey: string): Promise<number> {
    try {
      const pubkey = new PublicKey(publicKey);
      return await this.connection.getBalance(pubkey);
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * Request SOL airdrop
   */
  async requestAirdrop(publicKey: string, amount: number): Promise<string> {
    try {
      const pubkey = new PublicKey(publicKey);
      const lamports = amount * 1_000_000_000;
      const signature = await this.connection.requestAirdrop(pubkey, lamports);
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');
      return signature;
    } catch (error) {
      console.error('Failed to request airdrop:', error);
      throw error;
    }
  }

  /**
   * Get record history for a patient
   */
  async getRecordHistory(patientDid: string): Promise<any[]> {
    console.log(`🔍 Querying record history for ${patientDid}`);
    return [];
  }

  /**
   * Wait for transaction confirmation
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
      maxRetries = 120,
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

  private getExplorerUrl(txId: string): string {
    const baseUrl = 'https://explorer.solana.com/tx';
    const params = this.network === 'mainnet' ? '' : `?cluster=${this.network}`;
    return `${baseUrl}/${txId}${params}`;
  }
}

export const solanaBlockchainService = new SolanaBlockchainService();
