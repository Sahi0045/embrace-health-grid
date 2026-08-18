/**
 * Hybrid Wallet Settings Component
 * Allows users to choose between Phantom and Embedded wallets
 */

'use client';

import { useState, useEffect } from 'react';
import { useHybridWallet, usePhantomDetection } from '@/lib/useHybridWallet';
import { Wallet, Settings, CheckCircle, AlertCircle, Link as LinkIcon } from 'lucide-react';

export function HybridWalletSettings() {
  const wallet = useHybridWallet();
  const phantom = usePhantomDetection();
  const [saving, setSaving] = useState(false);

  const handleModeChange = async (mode: 'auto' | 'phantom' | 'embedded') => {
    try {
      setSaving(true);
      await wallet.setWalletMode(mode);
    } catch (error) {
      console.error('Failed to save wallet preference:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Wallet className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold">Blockchain Wallet Settings</h2>
      </div>

      {/* Current Status */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          Current Configuration
        </h3>

        <div className="space-y-2">
          {wallet.loading ? (
            <p className="text-gray-600 animate-pulse">Loading wallet settings...</p>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                <strong>Wallet Mode:</strong>{' '}
                {wallet.effectiveWalletMode === 'phantom' && (
                  <span className="text-green-600">🔗 Phantom</span>
                )}
                {wallet.effectiveWalletMode === 'embedded' && (
                  <span className="text-blue-600">✓ Embedded (Seamless)</span>
                )}
              </p>

              {phantom.isDetected && (
                <p className="text-sm text-gray-600">
                  <strong>Phantom:</strong>{' '}
                  {phantom.isConnected ? (
                    <span className="text-green-600">✓ Connected</span>
                  ) : (
                    <span className="text-amber-600">⚠ Detected but not connected</span>
                  )}
                </p>
              )}

              <p className="text-sm text-gray-600">
                <strong>Status:</strong> {wallet.getStatusMessage()}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Wallet Selection */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Choose Your Wallet
        </h3>

        {/* Auto-Detect Option */}
        <label className="flex items-start gap-4 p-4 border-2 border-transparent rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
          style={{
            borderColor: wallet.userPreference === 'auto' || (!wallet.userPreference && wallet.walletMode === 'auto') ? '#3b82f6' : '#e5e7eb',
          }}>
          <input
            type="radio"
            name="wallet-mode"
            value="auto"
            checked={wallet.userPreference === 'auto' || (!wallet.userPreference && wallet.walletMode === 'auto')}
            onChange={() => handleModeChange('auto')}
            disabled={saving || wallet.loading}
            className="mt-1 w-4 h-4 cursor-pointer"
          />
          <div className="flex-1">
            <h4 className="font-semibold text-base mb-1">🔄 Auto-Detect (Recommended)</h4>
            <p className="text-sm text-gray-600 mb-2">
              Automatically uses Phantom if installed, otherwise seamless embedded wallet.
            </p>
            <div className="text-xs bg-blue-50 text-blue-700 p-2 rounded inline-block">
              {phantom.isDetected
                ? 'Phantom detected. Will use Phantom for signing.'
                : 'Phantom not detected. Will use embedded wallet.'}
            </div>
          </div>
        </label>

        {/* Phantom Option (only if detected) */}
        {phantom.isDetected && (
          <label className="flex items-start gap-4 p-4 border-2 border-transparent rounded-lg cursor-pointer hover:bg-green-50 transition-colors"
            style={{
              borderColor: wallet.userPreference === 'phantom' ? '#22c55e' : '#e5e7eb',
            }}>
            <input
              type="radio"
              name="wallet-mode"
              value="phantom"
              checked={wallet.userPreference === 'phantom'}
              onChange={() => handleModeChange('phantom')}
              disabled={saving || wallet.loading}
              className="mt-1 w-4 h-4 cursor-pointer"
            />
            <div className="flex-1">
              <h4 className="font-semibold text-base mb-1 flex items-center gap-2">
                🔗 Phantom Wallet
                {phantom.isConnected && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                    Connected
                  </span>
                )}
              </h4>
              <p className="text-sm text-gray-600 mb-2">
                Sign transactions directly with your personal Phantom wallet. You control
                everything and see exactly what you're signing.
              </p>
              <div className="text-xs text-green-700 space-y-1">
                <p>✓ Your private key never leaves your device</p>
                <p>✓ You approve each transaction</p>
                <p>✓ You pay gas fees</p>
              </div>
            </div>
          </label>
        )}

        {/* Embedded Option */}
        <label className="flex items-start gap-4 p-4 border-2 border-transparent rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors"
          style={{
            borderColor: wallet.userPreference === 'embedded' ? '#6366f1' : '#e5e7eb',
          }}>
          <input
            type="radio"
            name="wallet-mode"
            value="embedded"
            checked={wallet.userPreference === 'embedded'}
            onChange={() => handleModeChange('embedded')}
            disabled={saving || wallet.loading}
            className="mt-1 w-4 h-4 cursor-pointer"
          />
          <div className="flex-1">
            <h4 className="font-semibold text-base mb-1">✓ Embedded Wallet (Seamless)</h4>
            <p className="text-sm text-gray-600 mb-2">
              Transactions are signed automatically by the hospital's backend. No prompts, no
              blockchain knowledge needed.
            </p>
            <div className="text-xs text-indigo-700 space-y-1">
              <p>✓ No wallet installation required</p>
              <p>✓ Hospital pays gas fees</p>
              <p>✓ Seamless experience</p>
            </div>
          </div>
        </label>
      </div>

      {/* How It Works */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
        <h4 className="font-semibold mb-3 flex items-center gap-2 text-amber-900">
          <AlertCircle className="w-5 h-5" />
          How It Works
        </h4>
        <div className="space-y-2 text-sm text-amber-900">
          <p>
            <strong>Phantom Mode:</strong> Your transactions are signed by YOUR Phantom wallet.
            You'll see a popup asking to approve. Your private key stays safe on your device.
          </p>
          <p>
            <strong>Embedded Mode:</strong> The hospital's wallet signs transactions on the
            backend. You don't see blockchain details—it just works.
          </p>
          <p>
            <strong>Both modes:</strong> Records are anchored to Solana blockchain for
            immutability proof.
          </p>
        </div>
      </div>

      {/* Connection Management */}
      {phantom.isDetected && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h4 className="font-semibold mb-3">Phantom Connection</h4>
          {phantom.isConnected ? (
            <button
              onClick={() => wallet.disconnectPhantom()}
              disabled={saving}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              Disconnect Phantom
            </button>
          ) : (
            <button
              onClick={() => wallet.connectPhantom()}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <LinkIcon className="w-4 h-4" />
              Connect Phantom
            </button>
          )}
        </div>
      )}

      {/* Error Message */}
      {wallet.error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-sm text-red-700">
          <strong>Error:</strong> {wallet.error}
        </div>
      )}

      {/* Info Links */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="font-semibold mb-3">Learn More</h4>
        <ul className="space-y-2 text-sm">
          <li>
            <a
              href="https://phantom.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              → Install Phantom Wallet
            </a>
          </li>
          <li>
            <a
              href="https://docs.phantom.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              → Phantom Documentation
            </a>
          </li>
          <li>
            <a
              href="https://docs.solana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              → Solana Documentation
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
