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
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
              {status.mode === "loading" && (
                <>
                  <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                  <span className="text-xs text-muted-foreground">Loading...</span>
                </>
              )}

              {status.mode === "phantom" && status.isConnected && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="text-xs font-medium text-success">Phantom</span>
                </>
              )}

              {status.mode === "phantom" && !status.isConnected && (
                <>
                  <AlertCircle className="w-4 h-4 text-warning" />
                  <span className="text-xs text-warning">Phantom Offline</span>
                </>
              )}

              {status.mode === "embedded" && (
                <>
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-primary">Embedded</span>
                </>
              )}

              {status.mode === "error" && (
                <>
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-xs text-destructive">Error</span>
                </>
              )}
            </div>
          </TooltipTrigger>

          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-2 text-sm">
              <div className="font-semibold">Wallet Status</div>

              <div className="space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Mode:</span>
                  <span className="font-medium capitalize">{status.mode}</span>
                </div>

                {status.mode === "phantom" && (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Connected:</span>
                      <span className="font-medium">{status.isConnected ? "✓ Yes" : "✗ No"}</span>
                    </div>
                    {status.phantomAddress && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Address:</span>
                        <code className="text-xs font-mono">
                          {status.phantomAddress.slice(0, 8)}...
                        </code>
                      </div>
                    )}
                  </>
                )}

                {showNetwork && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Network:</span>
                    <span className="font-medium capitalize">{status.network}</span>
                  </div>
                )}

                {showLastActivity && status.lastActivityTime && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Last Activity:</span>
                    <span className="text-xs">
                      {new Date(status.lastActivityTime).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>

              {status.error && (
                <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive text-xs">
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
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Wallet Status</h3>
      </div>

      {/* Main Status Card */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
        {/* Mode and Connection */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.mode === "phantom" && <Wallet className="w-5 h-5 text-accent" />}
            {status.mode === "embedded" && <Shield className="w-5 h-5 text-primary" />}
            {status.mode === "loading" && (
              <div className="w-5 h-5 rounded-full border-2 border-warning border-t-transparent animate-spin" />
            )}
            {status.mode === "error" && <AlertCircle className="w-5 h-5 text-destructive" />}

            <div>
              <div className="text-sm font-semibold capitalize text-foreground">
                {status.mode === "phantom" ? "Phantom Wallet" : "Embedded Wallet"}
              </div>
              <div className="text-xs text-muted-foreground">
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
            <Badge className="bg-success/15 text-success border-success/40">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Ready
            </Badge>
          )}

          {status.mode === "phantom" && !status.isConnected && (
            <Badge className="bg-warning/15 text-warning border-warning/40">
              <AlertCircle className="w-3 h-3 mr-1" />
              Offline
            </Badge>
          )}

          {status.mode === "embedded" && (
            <Badge className="bg-primary/15 text-primary border-primary/40">
              <Shield className="w-3 h-3 mr-1" />
              Active
            </Badge>
          )}
        </div>

        {/* Network */}
        {showNetwork && (
          <div className="flex items-center justify-between text-sm py-2 border-t border-border">
            <span className="text-muted-foreground">Network:</span>
            <Badge variant="outline" className="capitalize">
              <Zap className="w-3 h-3 mr-1" />
              {status.network}
            </Badge>
          </div>
        )}

        {/* Phantom Details */}
        {status.mode === "phantom" && status.phantomAddress && (
          <div className="text-xs py-2 border-t border-border">
            <div className="text-muted-foreground mb-1">Address:</div>
            <code className="block font-mono text-muted-foreground break-all px-2 py-1 bg-muted/50 rounded">
              {status.phantomAddress}
            </code>
          </div>
        )}

        {/* Last Activity */}
        {showLastActivity && status.lastActivityTime && (
          <div className="flex items-center justify-between text-sm py-2 border-t border-border">
            <span className="text-muted-foreground">Last Activity:</span>
            <span className="text-muted-foreground">
              {new Date(status.lastActivityTime).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {status.error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/40 text-destructive text-sm">
          <div className="flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{status.error}</div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          {status.mode === "phantom"
            ? "🔌 Using Phantom wallet for signing. Keep the extension connected."
            : "🏥 Using hospital backend wallet for signing. Transactions are automatically handled."}
        </p>
      </div>
    </div>
  );
}
