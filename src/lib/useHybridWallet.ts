/**
 * useHybridWallet Hook
 * Client-side state management for hybrid wallet system
 * Manages: Phantom detection, wallet preference, signing state, recent activity
 */

import { useEffect, useState } from 'react';
import { getUserWalletPreference, saveUserWalletPreference } from '@/routes/api.wallet-preference';
import {
  isPhantomInstalled,
  connectPhantom as clientConnectPhantom,
  disconnectPhantom as clientDisconnectPhantom,
} from './hybrid-wallet.client';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPreference, setUserPreference] = useState<'phantom' | 'embedded' | 'auto'>('auto');
  
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
        setLoading(true);
        const pref = await getUserWalletPreference();
        if (pref) {
          setUserPreference(pref.walletMode);
          setState((prev) => ({
            ...prev,
            walletMode: pref.walletMode || 'auto',
            hospitalId,
          }));
        }
      } catch (err) {
        console.warn('Failed to load wallet preference:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    loadPreference();
  }, [hospitalId]);

  // ─── Detect Phantom Wallet ──────────────────────────────────────────────

  useEffect(() => {
    const detectPhantom = () => {
      const isPhantomAvailable = isPhantomInstalled();

      setState((prev) => ({
        ...prev,
        phantomAvailable: isPhantomAvailable,
      }));

      console.log(`🔍 Phantom Detection:`, {
        available: isPhantomAvailable,
        address: (window as any)?.solana?.publicKey?.toString?.(),
      });
    };

    // Detect on mount
    detectPhantom();

    // Listen for wallet connect/disconnect
    if ((window as any)?.solana?.on) {
      const handleConnect = () => {
        setState((prev) => ({
          ...prev,
          phantomConnected: true,
          phantomAddress: (window as any).solana?.publicKey?.toString?.(),
        }));

        console.log(`... Phantom Connected:`, (window as any).solana?.publicKey?.toString?.());
      };

      const handleDisconnect = () => {
        setState((prev) => ({
          ...prev,
          phantomConnected: false,
          phantomAddress: undefined,
        }));

        console.log(`... Phantom Disconnected`);
      };

      const handleAccountChanged = (newPublicKey: any) => {
        if (newPublicKey) {
          setState((prev) => ({
            ...prev,
            phantomAddress: newPublicKey.toString?.(),
          }));

          console.log(`... Phantom Account Changed:`, newPublicKey.toString?.());
        }
      };

      const handleNetworkChanged = (network: string) => {
        setState((prev) => ({
          ...prev,
          phantomNetwork: network,
        }));

        console.log(`... Phantom Network Changed:`, network);
      };

      try {
        (window as any).solana.on('connect', handleConnect);
        (window as any).solana.on('disconnect', handleDisconnect);
        (window as any).solana.on('accountChanged', handleAccountChanged);
        (window as any).solana.on('networkChanged', handleNetworkChanged);

        setState((prev) => ({ ...prev, isListening: true }));

        // Check initial connected state
        if ((window as any).solana?.publicKey) {
          setState((prev) => ({
            ...prev,
            phantomConnected: true,
            phantomAddress: (window as any).solana.publicKey.toString(),
          }));
        }
      } catch (err) {
        console.warn('Failed to attach Phantom listeners:', err);
      }

      // Cleanup
      return () => {
        try {
          (window as any).solana.off('connect', handleConnect);
          (window as any).solana.off('disconnect', handleDisconnect);
          (window as any).solana.off('accountChanged', handleAccountChanged);
          (window as any).solana.off('networkChanged', handleNetworkChanged);
        } catch (_) {}
      };
    }
  }, []);

  // ─── Save Wallet Preference ─────────────────────────────────────────────

  const setWalletMode = async (mode: 'auto' | 'phantom' | 'embedded') => {
    try {
      setLoading(true);
      setError(null);
      setUserPreference(mode);
      setState((prev) => ({ ...prev, walletMode: mode }));

      await saveUserWalletPreference({
        data: {
          walletMode: mode,
          phantomPublicKey:
            mode === 'phantom' && state.phantomAddress ? state.phantomAddress : null,
        }
      });

      console.log(`💾 Wallet preference saved:`, mode);
    } catch (err) {
      console.error('Failed to save wallet preference:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // ─── Connect / Disconnect Phantom ──────────────────────────────────────

  const connectPhantom = async () => {
    try {
      setError(null);
      setLoading(true);
      await clientConnectPhantom();
    } catch (err) {
      console.error('Failed to connect Phantom:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const disconnectPhantom = async () => {
    try {
      setError(null);
      setLoading(true);
      await clientDisconnectPhantom();
      
      const { disconnectPhantom: apiDisconnect } = await import('@/routes/api.wallet-preference');
      await apiDisconnect();
    } catch (err) {
      console.error('Failed to disconnect Phantom:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
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

  const setSigningError = (err: string) => {
    setState((prev) => ({
      ...prev,
      signingError: err,
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

  const effectiveWalletMode =
    userPreference !== 'auto'
      ? userPreference
      : state.phantomAvailable
        ? 'phantom'
        : 'embedded';

  const getStatusMessage = (): string => {
    if (loading) return 'Loading settings...';
    if (userPreference === 'phantom') {
      return state.phantomConnected ? 'Phantom connected and active.' : 'Phantom selected but offline.';
    }
    if (userPreference === 'embedded') {
      return 'Seamless embedded wallet active.';
    }
    // Auto mode
    return state.phantomAvailable
      ? 'Auto-detect: Using Phantom wallet.'
      : 'Auto-detect: Phantom not found, using embedded wallet.';
  };

  return {
    // Basic state
    loading,
    error,
    userPreference,
    effectiveWalletMode,
    getStatusMessage,

    // Methods
    connectPhantom,
    disconnectPhantom,
    setWalletMode,

    // Detection
    phantomAvailable: state.phantomAvailable,
    isPhantomConnected: state.phantomConnected,
    phantomAddress: state.phantomAddress,
    phantomNetwork: state.phantomNetwork,

    // Preferences
    walletMode: state.walletMode,

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

// ─── usePhantomDetection Hook ────────────────────────────────────────────────

export function usePhantomDetection() {
  const [isDetected, setIsDetected] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setIsDetected(isPhantomInstalled());
    
    const phantom = typeof window !== 'undefined' ? (window as any).solana : null;
    setIsConnected(!!phantom && phantom.isConnected);

    if (phantom && phantom.on) {
      const handleConnect = () => setIsConnected(true);
      const handleDisconnect = () => setIsConnected(false);

      phantom.on('connect', handleConnect);
      phantom.on('disconnect', handleDisconnect);

      return () => {
        phantom.off('connect', handleConnect);
        phantom.off('disconnect', handleDisconnect);
      };
    }
  }, []);

  return { isDetected, isConnected };
}

// ─── Global Type Extensions ─────────────────────────────────────────────────

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      publicKey?: { toString: () => string };
      signTransaction?: (tx: any) => Promise<any>;
      signMessage?: (msg: Uint8Array) => Promise<{ signature: Uint8Array; publicKey: any }>;
      connect?: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: any }>;
      disconnect?: () => Promise<void>;
      on?: (event: string, handler: any) => void;
      off?: (event: string, handler: any) => void;
      isConnected?: boolean;
    };
  }
}
