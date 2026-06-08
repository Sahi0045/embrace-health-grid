/**
 * Convex Client - Handles live reactive database synchronization
 * Connects to live Convex deployment if VITE_CONVEX_URL is present.
 */

import { ConvexReactClient } from "convex/react";

const convexUrl = (import.meta as any).env?.VITE_CONVEX_URL || "https://dummy-url.convex.cloud";

export const convexClient = new ConvexReactClient(convexUrl);

export const isConvexConfigured = () => {
  const url = (import.meta as any).env?.VITE_CONVEX_URL;
  return !!url && url !== "https://dummy-url.convex.cloud";
};
