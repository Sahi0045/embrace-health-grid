import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Hash,
  Link2,
  Loader2,
  ShieldCheck,
  TreePine,
  Wallet,
  Zap,
} from "lucide-react";

export interface RoomVerificationPanelProps {
  isDoctor: boolean;
  dailyEvents: any[];
  dailyRoot: string | null;
  dailyDate: string;
  publishedRoots: any[];
  connected: boolean;
  publicKey: any;
  onPublish: () => void;
  publishing: boolean;
  onShowConfirm: () => void;
}

export function RoomVerificationPanel({
  isDoctor,
  dailyEvents,
  dailyRoot,
  dailyDate,
  publishedRoots,
  connected,
  publicKey,
  publishing,
  onShowConfirm,
}: RoomVerificationPanelProps) {
  const [copiedText, setCopiedText] = useState("");

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(""), 2000);
    } catch {
      /* silent */
    }
  };

  if (!isDoctor) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3 shadow-clinical-sm">
        <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto" />
        <h3 className="font-display font-extrabold text-base text-foreground">
          Doctor Verification Access
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Cryptographic Merkle Root signing and Solana devnet anchoring are reserved for verified
          Doctor profiles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Daily Proof Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-5 shadow-clinical-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15 text-warning-foreground">
              <TreePine className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                Daily Verification Proof
              </h3>
              <p className="text-xs text-muted-foreground">
                {dailyDate ? `${dailyDate} · ` : ""}
                {dailyEvents.length} Merkle leaf event{dailyEvents.length !== 1 ? "s" : ""} today
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onShowConfirm}
            disabled={publishing || dailyEvents.length === 0 || !connected}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all shadow-clinical-sm shrink-0"
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            <span>{connected ? "Publish to Solana Devnet" : "Wallet Required"}</span>
          </button>
        </div>

        {/* Wallet Connection Status */}
        {!connected ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-warning-foreground" />
                <span>Phantom Wallet Disconnected</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Connect your Solana wallet to sign today's cryptographic Merkle root.
              </p>
            </div>
            <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !rounded-xl !h-9 !text-xs !font-bold !px-3 shrink-0" />
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2.5">
              <Wallet className="h-4 w-4 text-success shrink-0" />
              <span className="text-success font-extrabold">Solana Wallet Connected:</span>
              <span className="font-mono text-foreground font-bold">
                {publicKey?.toBase58().slice(0, 8)}…{publicKey?.toBase58().slice(-6)}
              </span>
            </div>
            <Badge
              variant="outline"
              className="bg-success/20 text-success border-success/40 text-[9px] font-mono"
            >
              DEVNET
            </Badge>
          </div>
        )}

        {/* Merkle Root Box */}
        {dailyRoot && (
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
              <span>Calculated Merkle Root Hash</span>
              <span className="font-mono text-primary">SHA-256</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg bg-background border border-border px-3.5 py-2">
              <span className="font-mono text-xs text-primary font-extrabold break-all flex-1">
                {dailyRoot}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(dailyRoot)}
                className="shrink-0 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Copy root hash"
              >
                <Copy
                  className={`h-4 w-4 ${
                    copiedText === dailyRoot ? "text-success" : "text-muted-foreground"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-foreground mt-0.5" />
          <span className="leading-normal">
            Only the cryptographic Merkle Root hash is published on-chain. Patient clinical records
            and individual room identities remain encrypted at rest (§ 164.312 HIPAA compliant).
          </span>
        </div>
      </div>

      {/* Published Roots Log */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-clinical-sm">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <Link2 className="h-4.5 w-4.5 text-primary" />
            <h3 className="font-display font-extrabold text-base text-foreground">
              Anchored Proof History
            </h3>
          </div>
          <Badge variant="outline" className="text-xs font-bold font-mono">
            {publishedRoots.length} Anchored
          </Badge>
        </div>

        {publishedRoots.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            No proof records published to devnet yet.
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {publishedRoots.map((root, index) => (
              <div
                key={root.rootId || `root-${index}-${root.txHash || root.merkleRoot}`}
                className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 border border-success/30 px-2.5 py-0.5 text-[10px] font-extrabold text-success">
                    <CheckCircle2 className="h-3 w-3" /> Anchored
                  </span>
                  <span className="text-muted-foreground text-[11px] font-medium">
                    {new Date(root.publishedAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="font-mono text-[11px] text-foreground flex items-center justify-between gap-2">
                    <span className="text-muted-foreground font-sans font-medium text-[10px] uppercase">
                      Merkle Root:
                    </span>
                    <span className="text-primary truncate font-bold">{root.merkleRoot}</span>
                  </div>
                  <div className="font-mono text-[11px] text-foreground flex items-center justify-between gap-2">
                    <span className="text-muted-foreground font-sans font-medium text-[10px] uppercase">
                      Tx Hash:
                    </span>
                    <span className="truncate">{root.txHash}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[10px] text-muted-foreground border-t border-border/40 pt-2 font-medium">
                  <span>
                    <Hash className="inline h-3 w-3 mr-0.5" />
                    {root.eventCount} Events
                  </span>
                  <span>
                    <ExternalLink className="inline h-3 w-3 mr-0.5" />
                    {root.network || "Solana Devnet"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
