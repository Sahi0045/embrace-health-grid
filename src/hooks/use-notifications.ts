/**
 * useNotifications — subscribes to the in-memory notification store and to
 * Solana Devnet WebSocket events, translating each event type into an
 * actionable notification.
 */

import { useState, useEffect } from "react";
/**
 * Read the base URL from env rather than importing it from @/lib/api.
 *
 * api.ts now delegates to TanStack Start server functions. The admin portal is a
 * Vite SPA that also consumes this hook, and importing that chain pulls
 * @tanstack/start-server-core into a browser bundle, breaking the build.
 */
const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "http://localhost:3001";
import {
  addNotification,
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  notificationStore,
} from "@/lib/notifications";
import type { Notification } from "@/lib/notifications";

// ─── Module-level init guard ──────────────────────────────────────────────────
// Kept at module scope so multiple hook instances subscribe only once rather
// than flooding the server with duplicate listeners.
//
// The old `_notifWs` socket handle is gone: this hook no longer opens its own
// WebSocket (nothing assigned or read it after the Express WS server was
// decommissioned — live updates now come from Supabase Realtime).
let _wsInitialized = false;

function handleNotifWsEvent(event: string) {
  switch (event) {
    case "consent:granted":
      addNotification({
        type: "consent_request",
        title: "Consent Granted",
        message: "A patient has granted on-chain consent to access their medical records.",
        severity: "info",
      });
      break;

    case "fraud:detected":
      addNotification({
        type: "fraud_alert",
        title: "Fraud Alert Detected",
        message:
          "Suspicious activity has been flagged on the Solana network. Immediate review required.",
        severity: "critical",
      });
      break;

    case "credential:issued":
      addNotification({
        type: "credential_issued",
        title: "Credential Issued",
        message: "A new verifiable credential has been issued and committed to the blockchain.",
        severity: "info",
      });
      break;

    case "block:committed":
      addNotification({
        type: "block_committed",
        title: "Block Committed",
        message: "A new slot has been confirmed on the Solana Devnet anchor program.",
        severity: "info",
      });
      break;

    case "audit:logged":
      addNotification({
        type: "block_committed",
        title: "Audit Event Logged",
        message: "A new tamper-proof audit record has been committed to the immutable ledger.",
        severity: "info",
      });
      break;
  }
}

import { storeEvents } from "@/lib/live-store";

function initNotifWebSocket() {
  if (typeof window === "undefined" || _wsInitialized) return;
  _wsInitialized = true;

  storeEvents.addEventListener("ws:message", (e: Event) => {
    try {
      const customEvent = e as CustomEvent<{ event: string; data: unknown }>;
      if (customEvent?.detail?.event) {
        handleNotifWsEvent(customEvent.detail.event);
      }
    } catch {
      // ignore
    }
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(() => getNotifications());
  const [unreadCount, setUnreadCount] = useState(() => getUnreadCount());

  useEffect(() => {
    const onUpdate = () => {
      setNotifications([...getNotifications()]);
      setUnreadCount(getUnreadCount());
    };

    notificationStore.addEventListener("notifications:update", onUpdate);

    // Ensure the WebSocket is running (no-op if already connected)
    initNotifWebSocket();

    return () => {
      notificationStore.removeEventListener("notifications:update", onUpdate);
    };
  }, []);

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
  };
}
