/**
 * HyperledgerProvider — Global store initializer
 *
 * Wraps the entire application to:
 *  1. Boot the real-time data store once on mount
 *  2. Seed all patient/staff DIDs into the blockchain
 *  3. Expose a React context for store-ready status
 *  4. Listen for network restoration to trigger offline queue replay
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { initializeStore, storeEvents } from "@/lib/realtime-store";
import { toast } from "sonner";

interface HyperledgerContextValue {
  isReady: boolean;
  isSeeding: boolean;
}

const HyperledgerContext = createContext<HyperledgerContextValue>({
  isReady: false,
  isSeeding: true,
});

export function useHyperledger() {
  return useContext(HyperledgerContext);
}

export function HyperledgerProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isSeeding, setIsSeeding] = useState(true);

  useEffect(() => {
    setIsSeeding(true);

    // Initialize the real-time store (runs once per session, idempotent)
    initializeStore()
      .then(() => {
        setIsReady(true);
        setIsSeeding(false);
        // Check for pending transactions on startup
        checkPendingOfflineSync();
      })
      .catch((err) => {
        console.error("[HyperledgerProvider] Init failed:", err);
        setIsSeeding(false);
      });

    const handler = () => {
      setIsReady(true);
      setIsSeeding(false);
    };
    storeEvents.addEventListener("store:ready", handler);

    // Monitor connectivity status
    const handleOnline = () => {
      checkPendingOfflineSync();
    };

    window.addEventListener("online", handleOnline);

    return () => {
      storeEvents.removeEventListener("store:ready", handler);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const checkPendingOfflineSync = async () => {
    try {
      const { getOfflineQueue, syncOfflineQueue } = await import("@/lib/offline-queue");
      const pending = getOfflineQueue();
      if (pending.length === 0) return;

      toast.info("Connection Restored", {
        description: `You have ${pending.length} pending offline transactions.`,
        action: {
          label: "Continue",
          onClick: async () => {
            const loadingToastId = toast.loading("Synchronizing offline transactions…");
            try {
              const syncCount = await syncOfflineQueue();
              toast.dismiss(loadingToastId);
              if (syncCount > 0) {
                toast.success(`Synchronized ${syncCount} transactions with the blockchain.`);
              } else {
                toast.error("Failed to synchronize transactions. Please try again.");
              }
            } catch (err) {
              toast.dismiss(loadingToastId);
              toast.error("Sync error. Please try again.");
            }
          },
        },
        duration: Infinity, // Keep toast open until action is taken
      });
    } catch (err) {
      console.error("[HyperledgerProvider] Failed to check offline queue:", err);
    }
  };

  return (
    <HyperledgerContext.Provider value={{ isReady, isSeeding }}>
      {children}
    </HyperledgerContext.Provider>
  );
}
