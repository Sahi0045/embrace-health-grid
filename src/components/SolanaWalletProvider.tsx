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

  // Standard wallet adapters (empty array detects installed browser wallets like Phantom/Solflare automatically)
  const wallets = useMemo(() => [], []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
