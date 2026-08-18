/**
 * useHybridWallet Hook
 * Client-side state management for hybrid wallet system
 * Manages: Phantom detection, wallet preference, signing state, recent activity
 */

import { useEffect, useState } from 'react';
import { getWalletPreference, saveWalletPreference } from '@/routes/api.wallet-preference';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HybridWalletState {
  // Wallet detection
  phantomAvailable: boolean;
  phantomConnected: boolean;
  phantomAddress?: string;
  phantomNetwork?: string;

  // User preferences
  walletMode: 'auto' | 'phantom' | 'embedded';
  hospitalId?: string;

  // Signing state
  isSigning: boolean;
  lastSigningTime?: Date;
  signingError?: string;

  // Connection events
  isListening: boolean;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useHybridWallet(hospitalId?: string) {
  const [state, setState] = useState<HybridWalletState>({
    phantomAvailable: false,
    phantomConnected: false,
    walletMode: 'auto',
    isSigning: false,
    isListening: false,
  });

  // ─── Load Wallet Preference ─────────────────────────────────────────────

  useEffect(() => {
    const loadPreference = async () => {
      try {
        if (!hospitalId) return;

        const pref = await getWalletPreference({ hospitalId });
        if (pref) {
          setState((prev) => ({
            ...prev,
            walletMode: pref.walletMode || 'auto',
            hospitalId,
          }));
        }
      } catch (err) {
        console.warn('Failed to load wallet preference:', err);
      }
    };

    loadPreference();
  }, [hospitalId]);

  // ─── Detect Phantom Wallet ──────────────────────────────────────────────

  useEffect(() => {
    const detectPhantom = () => {
      const isPhantomAvailable = !!window?.solana?.isPhantom;

      setState((prev) => ({
        ...prev,
        phantomAvailable: isPhantomAvailable,
      }));

      console.log(`🔍 Phantom Detection:`, {
        available: isPhantomAvailable,
        address: window?.solana?.publicKey?.toString?.(),
      });
    };

    // Detect on mount
    detectPhantom();

    // Listen for wallet connect/disconnect
    if (window?.solana?.on) {
      const handleConnect = () => {
        setState((prev) => ({
          ...prev,
          phantomConnected: true,
          phantomAddress: window.solana?.publicKey?.toString?.(),
        }));

        console.log(`✅ Phantom Connected:`, window.solana?.publicKey?.toString?.());
      };

      const handleDisconnect = () => {
        setState((prev) => ({
          ...prev,
          phantomConnected: false,
          phantomAddress: undefined,
        }));

        console.log(`❌ Phantom Disconnected`);
      };

      const handleAccountChanged = (newPublicKey: any) => {
        if (newPublicKey) {
          setState((prev) => ({
            ...prev,
            phantomAddress: newPublicKey.toString?.(),
          }));

          console.log(`🔄 Phantom Account Changed:`, newPublicKey.toString?.());
        }
      };

      const handleNetworkChanged = (network: string) => {
        setState((prev) => ({
          ...prev,
          phantomNetwork: network,
        }));

        console.log(`🌐 Phantom Network Changed:`, network);
      };

      try {
        window.solana.on('connect', handleConnect);
        window.solana.on('disconnect', handleDisconnect);
        window.solana.on('accountChanged', handleAccountChanged);
        window.solana.on('networkChanged', handleNetworkChanged);

        setState((prev) => ({ ...prev, isListening: true }));

        // Check initial connected state
        if (window.solana?.publicKey) {
          setState((prev) => ({
            ...prev,
            phantomConnected: true,
            phantomAddress: window.solana.publicKey.toString(),
          }));
        }
      } catch (err) {
        console.warn('Failed to attach Phantom listeners:', err);
      }

      // Cleanup
      return () => {
        try {
          window.solana.off('connect', handleConnect);
          window.solana.off('disconnect', handleDisconnect);
          window.solana.off('accountChanged', handleAccountChanged);
          window.solana.off('networkChanged', handleNetworkChanged);
        } catch (_) {}
      };
    }
  }, []);

  // ─── Save Wallet Preference ─────────────────────────────────────────────

  const setWalletMode = async (mode: 'auto' | 'phantom' | 'embedded') => {
    setState((prev) => ({ ...prev, walletMode: mode }));

    if (hospitalId) {
      try {
        await saveWalletPreference({
          hospitalId,
          walletMode: mode,
          phantomPublicKey:
            mode === 'phantom' && state.phantomAddress ? state.phantomAddress : null,
        });

        console.log(`💾 Wallet preference saved:`, mode);
      } catch (err) {
        console.error('Failed to save wallet preference:', err);
      }
    }
  };

  // ─── Record Signing Activity ─────────────────────────────────────────────

  const recordSigningActivity = () => {
    setState((prev) => ({
      ...prev,
      lastSigningTime: new Date(),
      isSigning: false,
    }));
  };

  const setSigningError = (error: string) => {
    setState((prev) => ({
      ...prev,
      signingError: error,
      isSigning: false,
    }));
  };

  // ─── Determine Active Wallet ────────────────────────────────────────────

  const getActiveWallet = (): 'phantom' | 'embedded' => {
    if (state.walletMode === 'phantom') {
      if (state.phantomConnected) return 'phantom';
      // Fallback if Phantom chosen but not connected
      console.warn('Phantom chosen but not connected, falling back to embedded');
      return 'embedded';
    }

    if (state.walletMode === 'embedded') {
      return 'embedded';
    }

    // Auto mode: prefer Phantom if connected
    if (state.phantomConnected) return 'phantom';
    return 'embedded';
  };

  return {
    // Detection
    phantomAvailable: state.phantomAvailable,
    isPhantomConnected: state.phantomConnected,
    phantomAddress: state.phantomAddress,
    phantomNetwork: state.phantomNetwork,

    // Preferences
    walletMode: state.walletMode,
    setWalletMode,

    // Signing state
    isSigning: state.isSigning,
    lastSigningTime: state.lastSigningTime,
    signingError: state.signingError,
    recordSigningActivity,
    setSigningError,

    // Active wallet determination
    getActiveWallet,

    // Connection state
    isListening: state.isListening,
  };
}

// ─── Global Type Extensions ─────────────────────────────────────────────────

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      publicKey?: { toString: () => string };
      signTransaction?: (tx: any) => Promise<any>;
      signMessage?: (msg: Uint8Array) => Promise<{ signature: Uint8Array; publicKey: any }>;
      connect?: () => Promise<{ publicKey: any }>;
      disconnect?: () => Promise<void>;
      on?: (event: string, handler: any) => void;
      off?: (event: string, handler: any) => void;
    };
  }
}
