/**
 * HyperledgerProvider — Global store initializer
 *
 * Wraps the entire application to:
 *  1. Boot the real-time data store once on mount
 *  2. Seed all patient/staff DIDs into the blockchain
 *  3. Expose a React context for store-ready status
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { initializeStore, storeEvents } from "@/lib/realtime-store";

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
    return () => storeEvents.removeEventListener("store:ready", handler);
  }, []);

  return (
    <HyperledgerContext.Provider value={{ isReady, isSeeding }}>
      {children}
    </HyperledgerContext.Provider>
  );
}
