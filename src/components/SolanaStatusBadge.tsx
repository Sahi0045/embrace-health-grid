import { useEffect, useState } from "react";
import { Connection, clusterApiUrl, type Cluster } from "@solana/web3.js";

type Status = "checking" | "live" | "unreachable";

/**
 * Solana RPC reachability, actually measured.
 *
 * The header used to render a pulsing green dot and the words "Solana devnet —
 * Live" as a constant, on every page, with nothing behind it. It stayed green
 * while the RPC was unreachable and while anchoring was failing, which on a
 * product whose premise is on-chain provenance is the one indicator that must
 * not be decorative.
 *
 * This asks the configured cluster for its version and reports what came back.
 */
export function SolanaStatusBadge() {
  const network = (import.meta.env.VITE_SOLANA_NETWORK || "devnet").replace("-beta", "");
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const endpoint = import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl(network as Cluster);
        const connection = new Connection(endpoint, "confirmed");
        // getVersion is the cheapest liveness probe the RPC offers.
        await Promise.race([
          connection.getVersion(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
        ]);
        if (!cancelled) setStatus("live");
      } catch {
        if (!cancelled) setStatus("unreachable");
      }
    };

    void check();
    // Re-probe periodically so a cluster that drops out stops reading as live.
    const timer = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [network]);

  const dot =
    status === "live"
      ? "bg-success animate-pulse"
      : status === "unreachable"
        ? "bg-destructive"
        : "bg-muted-foreground";

  const label = status === "live" ? "Live" : status === "unreachable" ? "Unreachable" : "Checking…";

  return (
    <div className="flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      <span>
        Solana {network} — {label}
      </span>
    </div>
  );
}
