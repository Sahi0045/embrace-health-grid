import { useEffect, useState } from "react";

/** Simulates an async fetch so we can show loading states in the demo. */
export function useSimulatedLoading(delayMs = 600) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return loading;
}
