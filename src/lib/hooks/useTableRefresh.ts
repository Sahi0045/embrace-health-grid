import { useState, useCallback } from "react";

/**
 * A hook that returns a trigger function whose reference changes whenever
 * the trigger is invoked. This is used as a dependency in React Query keys
 * to force query refetches when manual operations (like Dialog submissions) succeed.
 */
export function useTableRefresh() {
  const [count, setCount] = useState(0);

  // Return a callback that changes reference only when count updates.
  // This allows React Query to detect the key change and refetch.
  const trigger = useCallback(() => {
    setCount((prev) => prev + 1);
  }, [count]);

  return trigger;
}
