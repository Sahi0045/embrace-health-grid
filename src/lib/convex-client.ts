/**
 * Convex Client - Handles live reactive database synchronization
 * Connects to live Convex deployment if VITE_CONVEX_URL is present.
 */

import { ConvexReactClient } from "convex/react";

const rawUrl = import.meta.env?.VITE_CONVEX_URL;
if (!rawUrl && import.meta.env?.PROD) {
  console.error("FATAL: VITE_CONVEX_URL is required in production environment!");
}
const convexUrl = rawUrl || "";

export const convexClient = new ConvexReactClient(convexUrl || "https://placeholder.convex.cloud");

export const isConvexConfigured = () => {
  const url = import.meta.env?.VITE_CONVEX_URL;
  return !!url && url.startsWith("https://");
};
