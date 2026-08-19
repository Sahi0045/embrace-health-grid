/**
 * Wallet Status Indicator Component
 * Displays current blockchain wallet status in the sidebar
 * Shows: Connection status, wallet type, network, last signing activity
 */

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle2, Wallet, Zap, Shield } from "lucide-react";
import { SOLANA_CLIENT_CONFIG, getExplorerUrl } from "@/lib/solana-config.client";
import { useHybridWallet } from "@/lib/useHybridWallet";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WalletStatusProps {
  compact?: boolean; // Show minimal version for sidebar
  showNetwork?: boolean;
  showLastActivity?: boolean;
}

export interface WalletStatusData {
  mode: "phantom" | "embedded" | "loading" | "error";
  network: string;
  isConnected: boolean;
  lastActivityTime?: string;
  phantomAddress?: string;
  error?: string;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function WalletStatusIndicator(props: WalletStatusProps) {
  const { compact = false, showNetwork = true, showLastActivity = false } = props;

  const [status, setStatus] = useState<WalletStatusData>({
    mode: "loading",
    network: SOLANA_CLIENT_CONFIG.network,
    isConnected: false,
  });

  const { effectiveWalletMode, isPhantomConnected, phantomAddress, lastSigningTime } =
    useHybridWallet();

  // Update status when wallet state changes
  useEffect(() => {
    setStatus({
      mode: effectiveWalletMode,
      network: SOLANA_CLIENT_CONFIG.network,
      isConnected: effectiveWalletMode === "phantom" ? isPhantomConnected : true,
      lastActivityTime: lastSigningTime?.toISOString(),
      phantomAddress,
      error: undefined,
    });
  }, [effectiveWalletMode, isPhantomConnected, phantomAddress, lastSigningTime]);

  // ─── Render Compact Version (for sidebar) ──────────────────────────────

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700">
              {status.mode === "loading" && (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs text-slate-400">Loading...</span>
                </>
              )}

              {status.mode === "phantom" && status.isConnected && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-medium text-green-400">Phantom</span>
                </>
              )}

              {status.mode === "phantom" && !status.isConnected && (
                <>
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs text-yellow-400">Phantom Offline</span>
                </>
              )}

              {status.mode === "embedded" && (
                <>
                  <Shield className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-medium text-blue-400">Embedded</span>
                </>
              )}

              {status.mode === "error" && (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-400">Error</span>
                </>
              )}
            </div>
          </TooltipTrigger>

          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-2 text-sm">
              <div className="font-semibold">Wallet Status</div>

              <div className="space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-300">Mode:</span>
                  <span className="font-medium capitalize">{status.mode}</span>
                </div>

                {status.mode === "phantom" && (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-300">Connected:</span>
                      <span className="font-medium">{status.isConnected ? "✓ Yes" : "✗ No"}</span>
                    </div>
                    {status.phantomAddress && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-300">Address:</span>
                        <code className="text-xs font-mono">
                          {status.phantomAddress.slice(0, 8)}...
                        </code>
                      </div>
                    )}
                  </>
                )}

                {showNetwork && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-300">Network:</span>
                    <span className="font-medium capitalize">{status.network}</span>
                  </div>
                )}

                {showLastActivity && status.lastActivityTime && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-300">Last Activity:</span>
                    <span className="text-xs">
                      {new Date(status.lastActivityTime).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>

              {status.error && (
                <div className="mt-2 p-2 bg-red-950/50 rounded text-red-300 text-xs">
                  {status.error}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ─── Render Full Version ────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Wallet Status</h3>
      </div>

      {/* Main Status Card */}
      <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 space-y-3">
        {/* Mode and Connection */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.mode === "phantom" && <Wallet className="w-5 h-5 text-orange-500" />}
            {status.mode === "embedded" && <Shield className="w-5 h-5 text-blue-500" />}
            {status.mode === "loading" && (
              <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            )}
            {status.mode === "error" && <AlertCircle className="w-5 h-5 text-red-500" />}

            <div>
              <div className="text-sm font-semibold capitalize text-slate-100">
                {status.mode === "phantom" ? "Phantom Wallet" : "Embedded Wallet"}
              </div>
              <div className="text-xs text-slate-400">
                {status.mode === "phantom" && status.isConnected
                  ? "Connected"
                  : status.mode === "phantom"
                    ? "Offline"
                    : "Hospital Backend"}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          {status.mode === "phantom" && status.isConnected && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Ready
            </Badge>
          )}

          {status.mode === "phantom" && !status.isConnected && (
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
              <AlertCircle className="w-3 h-3 mr-1" />
              Offline
            </Badge>
          )}

          {status.mode === "embedded" && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
              <Shield className="w-3 h-3 mr-1" />
              Active
            </Badge>
          )}
        </div>

        {/* Network */}
        {showNetwork && (
          <div className="flex items-center justify-between text-sm py-2 border-t border-slate-700">
            <span className="text-slate-400">Network:</span>
            <Badge variant="outline" className="capitalize">
              <Zap className="w-3 h-3 mr-1" />
              {status.network}
            </Badge>
          </div>
        )}

        {/* Phantom Details */}
        {status.mode === "phantom" && status.phantomAddress && (
          <div className="text-xs py-2 border-t border-slate-700">
            <div className="text-slate-400 mb-1">Address:</div>
            <code className="block font-mono text-slate-300 break-all px-2 py-1 bg-slate-800/50 rounded">
              {status.phantomAddress}
            </code>
          </div>
        )}

        {/* Last Activity */}
        {showLastActivity && status.lastActivityTime && (
          <div className="flex items-center justify-between text-sm py-2 border-t border-slate-700">
            <span className="text-slate-400">Last Activity:</span>
            <span className="text-slate-300">
              {new Date(status.lastActivityTime).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {status.error && (
        <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/50 text-red-300 text-sm">
          <div className="flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{status.error}</div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-slate-500 space-y-1">
        <p>
          {status.mode === "phantom"
            ? "🔌 Using Phantom wallet for signing. Keep the extension connected."
            : "🏥 Using hospital backend wallet for signing. Transactions are automatically handled."}
        </p>
      </div>
    </div>
  );
}
