/**
 * useHybridWallet Hook
 * Manages hybrid wallet state (Phantom + Embedded detection and switching)
 * 
 * Usage:
 *   const wallet = useHybridWallet();
 *   if (wallet.isPhantomDetected) { ... }
 *   const result = await wallet.sign(txData);
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getWalletStatus,
  getUserWalletPreference,
  saveUserWalletPreference,
  signAndAnchorTransaction,
  connectPhantom,
  disconnectPhantom,
  isPhantomInstalled,
  getWalletErrorMessage,
  onPhantomAccountChange,
  onPhantomNetworkChange,
  type WalletMode,
  type HybridWalletState,
  type SigningResult,
  type TransactionPayload,
} from './hybrid-wallet.client';

export interface UseHybridWalletResult extends HybridWalletState {
  // Actions
  sign: (data: TransactionPayload, options?: any) => Promise<SigningResult>;
  setWalletMode: (mode: WalletMode) => Promise<void>;
  connectPhantom: () => Promise<{ publicKey: string }>;
  disconnectPhantom: () => Promise<void>;

  // Computed
  effectiveWalletMode: WalletMode;
  shouldShowPhantomOption: boolean;
  isSigningReady: boolean;

  // Helpers
  getStatusMessage: () => string;
}

/**
 * Hook to manage hybrid wallet selection and signing
 */
export function useHybridWallet(): UseHybridWalletResult {
  const [state, setState] = useState<HybridWalletState>({
    walletMode: 'embedded',
    isPhantomDetected: false,
    isPhantomConnected: false,
    phantomPublicKey: null,
    userPreference: null,
    loading: true,
    error: null,
  });

  const unsubscribeRef = useRef<(() => void)[]>([]);

  // Initialize wallet state on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const status = await getWalletStatus();
        setState({
          ...status,
          loading: false,
        });

        // Subscribe to Phantom changes if connected
        if (isPhantomInstalled()) {
          const unsubscribeAccount = onPhantomAccountChange((publicKey) => {
            setState((prev) => ({
              ...prev,
              phantomPublicKey: publicKey,
              isPhantomConnected: !!publicKey,
            }));
          });

          const unsubscribeNetwork = onPhantomNetworkChange((network) => {
            console.log('Phantom network changed:', network);
            // Handle network change if needed
          });

          unsubscribeRef.current = [unsubscribeAccount, unsubscribeNetwork];
        }
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: getWalletErrorMessage(error),
        }));
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      unsubscribeRef.current.forEach((unsubscribe) => unsubscribe?.());
    };
  }, []);

  // Determine effective wallet mode (considering preferences)
  const effectiveWalletMode: WalletMode = (() => {
    if (state.userPreference && state.userPreference !== 'auto') {
      return state.userPreference;
    }
    return state.walletMode;
  })();

  // Sign transaction with selected wallet
  const sign = useCallback(
    async (data: TransactionPayload, options?: any): Promise<SigningResult> => {
      try {
        setState((prev) => ({ ...prev, error: null }));

        const result = await signAndAnchorTransaction(data, {
          forceMode:
            effectiveWalletMode !== 'auto' ? (effectiveWalletMode as any) : undefined,
          showProgress: options?.showProgress,
        });

        return result;
      } catch (error) {
        const errorMessage = getWalletErrorMessage(error);
        setState((prev) => ({ ...prev, error: errorMessage }));
        throw error;
      }
    },
    [effectiveWalletMode]
  );

  // Update wallet mode preference
  const setWalletMode = useCallback(async (mode: WalletMode) => {
    try {
      await saveUserWalletPreference(mode);
      setState((prev) => ({
        ...prev,
        userPreference: mode,
        walletMode: mode === 'auto' ? (prev.isPhantomDetected ? 'phantom' : 'embedded') : mode,
      }));
    } catch (error) {
      const errorMessage = getWalletErrorMessage(error);
      setState((prev) => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  // Connect Phantom wallet
  const handleConnectPhantom = useCallback(async () => {
    try {
      const { publicKey } = await connectPhantom();
      setState((prev) => ({
        ...prev,
        isPhantomConnected: true,
        phantomPublicKey: publicKey,
      }));
      return { publicKey };
    } catch (error) {
      const errorMessage = getWalletErrorMessage(error);
      setState((prev) => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  // Disconnect Phantom wallet
  const handleDisconnectPhantom = useCallback(async () => {
    try {
      await disconnectPhantom();
      setState((prev) => ({
        ...prev,
        isPhantomConnected: false,
        phantomPublicKey: null,
      }));
    } catch (error) {
      const errorMessage = getWalletErrorMessage(error);
      setState((prev) => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  // Determine if Phantom option should be shown
  const shouldShowPhantomOption = state.isPhantomDetected || state.isPhantomConnected;

  // Determine if we're ready to sign
  const isSigningReady =
    !state.loading && effectiveWalletMode === 'embedded'
      ? true
      : effectiveWalletMode === 'phantom'
        ? state.isPhantomConnected
        : false;

  // Get human-readable status message
  const getStatusMessage = (): string => {
    if (state.loading) {
      return 'Loading wallet configuration...';
    }

    if (state.error) {
      return `Error: ${state.error}`;
    }

    switch (effectiveWalletMode) {
      case 'phantom':
        if (state.isPhantomConnected) {
          return `✓ Connected to Phantom (${state.phantomPublicKey?.slice(0, 8)}...)`;
        } else {
          return '🔗 Phantom detected. Click to connect.';
        }

      case 'embedded':
        return '✓ Using embedded wallet (seamless)';

      case 'auto':
        if (state.isPhantomDetected && state.isPhantomConnected) {
          return `✓ Auto-detected: Phantom (${state.phantomPublicKey?.slice(0, 8)}...)`;
        } else if (state.isPhantomDetected && !state.isPhantomConnected) {
          return '🔗 Auto-detected: Phantom available';
        } else {
          return '✓ Auto-detected: Using embedded wallet';
        }

      default:
        return 'Wallet ready';
    }
  };

  return {
    ...state,
    effectiveWalletMode,
    shouldShowPhantomOption,
    isSigningReady,
    sign,
    setWalletMode,
    connectPhantom: handleConnectPhantom,
    disconnectPhantom: handleDisconnectPhantom,
    getStatusMessage,
  };
}

/**
 * Hook to detect Phantom wallet presence
 * Simpler alternative for just checking availability
 */
export function usePhantomDetection() {
  const [isDetected, setIsDetected] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setIsDetected(isPhantomInstalled());

    if (isPhantomInstalled()) {
      const unsubscribe = onPhantomAccountChange((publicKey) => {
        setIsConnected(!!publicKey);
      });

      return () => unsubscribe();
    }
  }, []);

  return { isDetected, isConnected };
}

/**
 * Hook to manage wallet signing with progress tracking
 */
export function useWalletSigning() {
  const wallet = useHybridWallet();
  const [isSigning, setIsSigning] = useState(false);
  const [signingProgress, setSigningProgress] = useState<{
    stage: 'building' | 'signing' | 'confirming';
    message: string;
  } | null>(null);

  const signTransaction = useCallback(
    async (data: TransactionPayload) => {
      try {
        setIsSigning(true);
        setSigningProgress({ stage: 'building', message: 'Building transaction...' });

        if (wallet.effectiveWalletMode === 'phantom') {
          setSigningProgress({
            stage: 'signing',
            message: 'Approve in Phantom wallet...',
          });
        } else {
          setSigningProgress({
            stage: 'signing',
            message: 'Signing with embedded wallet...',
          });
        }

        const result = await wallet.sign(data, { showProgress: true });

        setSigningProgress({
          stage: 'confirming',
          message: 'Confirming on blockchain...',
        });

        return result;
      } finally {
        setIsSigning(false);
        setSigningProgress(null);
      }
    },
    [wallet]
  );

  return {
    isSigning,
    signingProgress,
    signTransaction,
    walletStatus: wallet.getStatusMessage(),
  };
}
