import { ReactNode, useEffect, useMemo, useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

interface Props {
  children: ReactNode;
}

export function SolanaWalletProvider({ children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Set default endpoint to devnet
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);

  // Standard wallet adapters
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {mounted ? (
            children
          ) : (
            <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground animate-pulse">
              Initializing secure ledger context...
            </div>
          )}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
