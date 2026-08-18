/**
 * Signing Progress Feedback Component
 * Shows real-time progress during blockchain signing operations
 * Stages: Building → Signing → Confirming → Complete
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2, Loader, Zap } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export enum SigningStage {
  Building = 'building',
  Signing = 'signing',
  Confirming = 'confirming',
  Complete = 'complete',
  Error = 'error',
}

export interface SigningProgressState {
  stage: SigningStage;
  progress: number; // 0-100
  message: string;
  walletUsed?: 'phantom' | 'embedded';
  txId?: string;
  error?: string;
}

export interface SigningProgressProps {
  isOpen: boolean;
  state: SigningProgressState;
  onClose?: () => void;
  estimatedTime?: number; // ms
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SigningProgressFeedback(props: SigningProgressProps) {
  const { isOpen, state, onClose, estimatedTime = 30000 } = props;
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer for elapsed time
  useEffect(() => {
    if (!isOpen) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 100);
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen]);

  // ─── Stage Information ───────────────────────────────────────────────────

  const stageInfo: Record<SigningStage, { label: string; description: string }> = {
    [SigningStage.Building]: {
      label: 'Building Transaction',
      description: 'Preparing the blockchain transaction with all required data...',
    },
    [SigningStage.Signing]: {
      label: 'Awaiting Signature',
      description:
        state.walletUsed === 'phantom'
          ? 'Please approve the transaction in Phantom wallet...'
          : 'Signing with hospital backend wallet...',
    },
    [SigningStage.Confirming]: {
      label: 'Confirming on Blockchain',
      description: 'Broadcasting transaction to Solana network and waiting for confirmation...',
    },
    [SigningStage.Complete]: {
      label: 'Transaction Complete',
      description: 'Your transaction has been successfully recorded on the blockchain.',
    },
    [SigningStage.Error]: {
      label: 'Signing Failed',
      description: state.error || 'An error occurred during signing.',
    },
  };

  const info = stageInfo[state.stage];

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Blockchain Signing</DialogTitle>
          <DialogDescription>
            {state.walletUsed && (
              <span className="capitalize">Using {state.walletUsed} wallet</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Main Content */}
        <div className="space-y-6 py-4">
          {/* Stage Indicator */}
          <div className="flex items-start gap-4">
            {state.stage === SigningStage.Error ? (
              <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0 mt-1" />
            ) : state.stage === SigningStage.Complete ? (
              <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0 mt-1" />
            ) : (
              <Loader className="w-8 h-8 text-blue-500 flex-shrink-0 mt-1 animate-spin" />
            )}

            <div className="flex-1">
              <h3 className="font-semibold text-slate-100">{info.label}</h3>
              <p className="text-sm text-slate-400 mt-1">{info.description}</p>
            </div>
          </div>

          {/* Progress Bar */}
          {state.stage !== SigningStage.Complete && state.stage !== SigningStage.Error && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Progress</span>
                <span className="text-slate-300">{Math.min(100, state.progress)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                  style={{ width: `${Math.min(100, state.progress)}%` }}
                />
              </div>
            </div>
          )}

          {/* Transaction Details */}
          {state.walletUsed && (
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Details</div>
              <div className="space-y-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Wallet:</span>
                  <span className="font-mono text-slate-300 capitalize">{state.walletUsed}</span>
                </div>

                {state.stage === SigningStage.Signing && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Status:</span>
                    <span className="text-amber-400 font-medium flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Awaiting Approval
                    </span>
                  </div>
                )}

                {state.txId && (
                  <div className="space-y-1">
                    <div className="text-xs text-slate-400">Transaction ID:</div>
                    <code className="text-xs font-mono text-slate-300 break-all">
                      {state.txId.slice(0, 16)}...
                    </code>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Details */}
          {state.stage === SigningStage.Error && state.error && (
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/50">
              <p className="text-sm text-red-300">{state.error}</p>
            </div>
          )}

          {/* Time Elapsed */}
          {state.stage !== SigningStage.Complete && state.stage !== SigningStage.Error && (
            <div className="flex justify-between text-xs text-slate-500">
              <span>Elapsed: {formatTime(elapsedTime)}</span>
              {estimatedTime && (
                <span>Estimated: {formatTime(estimatedTime)}</span>
              )}
            </div>
          )}

          {/* Success Message */}
          {state.stage === SigningStage.Complete && state.txId && (
            <div className="p-3 rounded-lg bg-green-950/30 border border-green-500/50">
              <p className="text-sm text-green-300 mb-2">
                ✓ Transaction successfully recorded on blockchain
              </p>
              <a
                href={`https://explorer.solana.com/tx/${state.txId}?cluster=${process.env.REACT_APP_SOLANA_NETWORK || 'devnet'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-400 hover:text-green-300 underline break-all"
              >
                View on Solana Explorer →
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-4 border-t border-slate-700">
          {state.stage === SigningStage.Complete || state.stage === SigningStage.Error ? (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              {state.stage === SigningStage.Error ? 'Try Again' : 'Done'}
            </button>
          ) : (
            <div className="flex-1 px-4 py-2 text-center text-sm text-slate-400">
              Do not close this window...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Utility: Format Time ─────────────────────────────────────────────────

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// ─── Hook: Use Signing Progress ──────────────────────────────────────────

export function useSigningProgress() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<SigningProgressState>({
    stage: SigningStage.Building,
    progress: 0,
    message: '',
  });

  const setStage = (stage: SigningStage, progress?: number) => {
    setState((prev) => ({
      ...prev,
      stage,
      progress: progress ?? prev.progress,
    }));
  };

  const setProgress = (progress: number) => {
    setState((prev) => ({ ...prev, progress }));
  };

  const setWallet = (wallet: 'phantom' | 'embedded') => {
    setState((prev) => ({ ...prev, walletUsed: wallet }));
  };

  const setTxId = (txId: string) => {
    setState((prev) => ({ ...prev, txId }));
  };

  const setError = (error: string) => {
    setState((prev) => ({ ...prev, stage: SigningStage.Error, error }));
  };

  const complete = () => {
    setState((prev) => ({ ...prev, stage: SigningStage.Complete, progress: 100 }));
  };

  const reset = () => {
    setIsOpen(false);
    setState({
      stage: SigningStage.Building,
      progress: 0,
      message: '',
    });
  };

  return {
    isOpen,
    setIsOpen,
    state,
    setStage,
    setProgress,
    setWallet,
    setTxId,
    setError,
    complete,
    reset,
  };
}
