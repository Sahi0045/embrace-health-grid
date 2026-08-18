/**
 * Hybrid Wallet System Tests
 * Unit tests for wallet detection, preference management, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useHybridWallet } from '@/lib/useHybridWallet';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock Phantom wallet
const mockPhantomWallet = {
  isPhantom: true,
  publicKey: { toString: () => 'test-phantom-address-1234567890' },
  signTransaction: vi.fn(),
  signMessage: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

// Mock API calls
vi.mock('@/routes/api.wallet-preference', () => ({
  getUserWalletPreference: vi.fn(),
  saveUserWalletPreference: vi.fn(),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useHybridWallet', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    delete (window as any).solana;
  });

  // ─── Phantom Detection ───────────────────────────────────────────────

  describe('Phantom Detection', () => {
    it('detects Phantom wallet when available', () => {
      window.solana = mockPhantomWallet;

      const { result } = renderHook(() => useHybridWallet());

      expect(result.current.phantomAvailable).toBe(true);
    });

    it('returns false when Phantom is not available', () => {
      delete (window as any).solana;

      const { result } = renderHook(() => useHybridWallet());

      expect(result.current.phantomAvailable).toBe(false);
    });

    it('detects Phantom connection state', () => {
      window.solana = mockPhantomWallet;

      const { result } = renderHook(() => useHybridWallet());

      expect(result.current.isPhantomConnected).toBe(true);
    });

    it('detects Phantom public key', () => {
      window.solana = mockPhantomWallet;

      const { result } = renderHook(() => useHybridWallet());

      expect(result.current.phantomAddress).toBe('test-phantom-address-1234567890');
    });
  });

  // ─── Wallet Mode Management ──────────────────────────────────────────

  describe('Wallet Mode Management', () => {
    it('defaults to auto mode', () => {
      const { result } = renderHook(() => useHybridWallet());

      expect(result.current.walletMode).toBe('auto');
    });

    it('allows changing to phantom mode', async () => {
      window.solana = mockPhantomWallet;

      const { result } = renderHook(() => useHybridWallet('hospital-123'));

      await act(async () => {
        await result.current.setWalletMode('phantom');
      });

      expect(result.current.walletMode).toBe('phantom');
    });

    it('allows changing to embedded mode', async () => {
      const { result } = renderHook(() => useHybridWallet('hospital-123'));

      await act(async () => {
        await result.current.setWalletMode('embedded');
      });

      expect(result.current.walletMode).toBe('embedded');
    });
  });

  // ─── Active Wallet Determination ────────────────────────────────────

  describe('Active Wallet Determination', () => {
    it('returns embedded when Phantom not available and auto mode', () => {
      delete (window as any).solana;

      const { result } = renderHook(() => useHybridWallet());

      expect(result.current.getActiveWallet()).toBe('embedded');
    });

    it('returns phantom when available and auto mode', () => {
      window.solana = mockPhantomWallet;

      const { result } = renderHook(() => useHybridWallet());

      expect(result.current.getActiveWallet()).toBe('phantom');
    });

    it('returns phantom in phantom mode even if just connected', async () => {
      window.solana = mockPhantomWallet;

      const { result } = renderHook(() => useHybridWallet('hospital-123'));

      await act(async () => {
        await result.current.setWalletMode('phantom');
      });

      expect(result.current.getActiveWallet()).toBe('phantom');
    });

    it('returns embedded in embedded mode regardless of Phantom', () => {
      window.solana = mockPhantomWallet;

      const { result } = renderHook(() => useHybridWallet('hospital-123'));

      act(() => {
        result.current.setWalletMode('embedded');
      });

      expect(result.current.getActiveWallet()).toBe('embedded');
    });

    it('falls back to embedded when Phantom mode selected but not connected', () => {
      window.solana = { ...mockPhantomWallet, publicKey: undefined };

      const { result } = renderHook(() => useHybridWallet('hospital-123'));

      act(() => {
        result.current.setWalletMode('phantom');
      });

      expect(result.current.getActiveWallet()).toBe('embedded');
    });
  });

  // ─── Signing Activity Tracking ──────────────────────────────────────

  describe('Signing Activity Tracking', () => {
    it('records signing activity timestamp', () => {
      const { result } = renderHook(() => useHybridWallet());

      const beforeTime = new Date();

      act(() => {
        result.current.recordSigningActivity();
      });

      const afterTime = new Date();

      expect(result.current.lastSigningTime).toBeDefined();
      expect(result.current.lastSigningTime!.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
      expect(result.current.lastSigningTime!.getTime()).toBeLessThanOrEqual(
        afterTime.getTime()
      );
    });

    it('marks signing as not in progress after recording', () => {
      const { result } = renderHook(() => useHybridWallet());

      act(() => {
        result.current.recordSigningActivity();
      });

      expect(result.current.isSigning).toBe(false);
    });

    it('sets signing error', () => {
      const { result } = renderHook(() => useHybridWallet());

      act(() => {
        result.current.setSigningError('Transaction failed');
      });

      expect(result.current.signingError).toBe('Transaction failed');
      expect(result.current.isSigning).toBe(false);
    });
  });

  // ─── Event Listening ────────────────────────────────────────────────

  describe('Event Listening', () => {
    it('sets up listeners when Phantom is available', () => {
      const onMock = vi.fn();
      window.solana = { ...mockPhantomWallet, on: onMock };

      renderHook(() => useHybridWallet());

      // Should call on for each event
      expect(onMock).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(onMock).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(onMock).toHaveBeenCalledWith('accountChanged', expect.any(Function));
      expect(onMock).toHaveBeenCalledWith('networkChanged', expect.any(Function));
    });

    it('cleans up listeners on unmount', () => {
      const offMock = vi.fn();
      window.solana = { ...mockPhantomWallet, off: offMock };

      const { unmount } = renderHook(() => useHybridWallet());

      unmount();

      // Should call off for each event
      expect(offMock).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(offMock).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });
  });

  // ─── Connection State Changes ───────────────────────────────────────

  describe('Connection State Changes', () => {
    it('detects when Phantom connects', async () => {
      let connectHandler: any;

      const onMock = vi.fn((event, handler) => {
        if (event === 'connect') connectHandler = handler;
      });

      window.solana = { ...mockPhantomWallet, on: onMock };

      const { result } = renderHook(() => useHybridWallet());

      // Simulate Phantom connect event
      act(() => {
        connectHandler?.();
      });

      await waitFor(() => {
        expect(result.current.isPhantomConnected).toBe(true);
      });
    });

    it('detects when Phantom disconnects', async () => {
      let disconnectHandler: any;

      const onMock = vi.fn((event, handler) => {
        if (event === 'disconnect') disconnectHandler = handler;
      });

      window.solana = { ...mockPhantomWallet, on: onMock };

      const { result } = renderHook(() => useHybridWallet());

      // Simulate Phantom disconnect event
      act(() => {
        disconnectHandler?.();
      });

      await waitFor(() => {
        expect(result.current.isPhantomConnected).toBe(false);
      });
    });

    it('detects account changes', async () => {
      let accountChangeHandler: any;

      const onMock = vi.fn((event, handler) => {
        if (event === 'accountChanged') accountChangeHandler = handler;
      });

      window.solana = { ...mockPhantomWallet, on: onMock };

      const { result } = renderHook(() => useHybridWallet());

      const newPublicKey = {
        toString: () => 'new-phantom-address-9999999999',
      };

      // Simulate account change
      act(() => {
        accountChangeHandler?.(newPublicKey);
      });

      await waitFor(() => {
        expect(result.current.phantomAddress).toBe('new-phantom-address-9999999999');
      });
    });
  });
});

// ─── Integration Scenario Tests ──────────────────────────────────────────

describe('Hybrid Wallet Integration Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).solana;
  });

  it('handles user switching from Phantom to Embedded', async () => {
    window.solana = mockPhantomWallet;

    const { result } = renderHook(() => useHybridWallet('hospital-123'));

    expect(result.current.getActiveWallet()).toBe('phantom');

    // User decides to use embedded instead
    await act(async () => {
      await result.current.setWalletMode('embedded');
    });

    expect(result.current.walletMode).toBe('embedded');
    expect(result.current.getActiveWallet()).toBe('embedded');
  });

  it('handles Phantom becoming unavailable mid-session', async () => {
    window.solana = mockPhantomWallet;

    const { result } = renderHook(() => useHybridWallet());

    expect(result.current.getActiveWallet()).toBe('phantom');

    // Phantom becomes unavailable (user closes extension)
    delete (window as any).solana;

    // System should still work (fallback logic)
    expect(result.current.phantomAvailable).toBe(false);
  });

  it('recovers when Phantom reconnects after disconnect', async () => {
    let disconnectHandler: any;
    let connectHandler: any;

    const onMock = vi.fn((event, handler) => {
      if (event === 'disconnect') disconnectHandler = handler;
      if (event === 'connect') connectHandler = handler;
    });

    window.solana = { ...mockPhantomWallet, on: onMock };

    const { result } = renderHook(() => useHybridWallet('hospital-123'));

    expect(result.current.isPhantomConnected).toBe(true);

    // Disconnect
    act(() => {
      disconnectHandler?.();
    });

    await waitFor(() => {
      expect(result.current.isPhantomConnected).toBe(false);
    });

    // Reconnect
    act(() => {
      connectHandler?.();
    });

    await waitFor(() => {
      expect(result.current.isPhantomConnected).toBe(true);
    });
  });
});

// ─── Error Cases ────────────────────────────────────────────────────────

describe('Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).solana;
  });

  it('gracefully handles missing Phantom API', () => {
    window.solana = undefined;

    const { result } = renderHook(() => useHybridWallet());

    expect(result.current.phantomAvailable).toBe(false);
    expect(result.current.getActiveWallet()).toBe('embedded');
  });

  it('handles failed listener attachment', () => {
    const onMock = vi.fn(() => {
      throw new Error('Failed to attach listener');
    });

    window.solana = { ...mockPhantomWallet, on: onMock };

    // Should not throw
    expect(() => {
      renderHook(() => useHybridWallet());
    }).not.toThrow();
  });

  it('handles Phantom mode when Phantom is not installed', async () => {
    delete (window as any).solana;

    const { result } = renderHook(() => useHybridWallet('hospital-123'));

    // User tries to select Phantom mode despite not having it
    await act(async () => {
      await result.current.setWalletMode('phantom');
    });

    // Should fall back to embedded
    expect(result.current.getActiveWallet()).toBe('embedded');
  });
});
