import { useEffect } from "react";

/**
 * useSpotlightTarget — Detects deep-link highlight targets from query params or element IDs,
 * scrolls the target element into view smoothly, and activates a non-destructive clinical spotlight pulse.
 */
export function useSpotlightTarget(highlightId?: string | null): void {
  useEffect(() => {
    if (!highlightId || typeof window === "undefined") return;

    const timer = setTimeout(() => {
      // Look for element with data-spotlight-id or id or data-id
      const target =
        document.querySelector(`[data-spotlight-id="${highlightId}"]`) ||
        document.getElementById(highlightId) ||
        document.querySelector(`[data-id="${highlightId}"]`) ||
        document.querySelector(`[data-item-id="${highlightId}"]`);

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("clinical-spotlight");

        const removeTimer = setTimeout(() => {
          target.classList.remove("clinical-spotlight");
        }, 3800);

        return () => clearTimeout(removeTimer);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [highlightId]);
}
