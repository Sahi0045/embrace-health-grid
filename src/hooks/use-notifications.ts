/**
 * useNotifications — subscribes to the in-memory notification store and to
 * Solana Devnet WebSocket events, translating each event type into an
 * actionable notification.
 */

import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/api";
import {
  addNotification,
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  notificationStore,
} from "@/lib/notifications";
import type { Notification } from "@/lib/notifications";

// ─── Module-level WS singleton ────────────────────────────────────────────────
// Kept at module scope so multiple hook instances share a single connection
// and avoid flooding the server with duplicate sockets.
let _notifWs: WebSocket | null = null;
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

function initNotifWebSocket() {
  if (typeof window === "undefined" || _wsInitialized) return;
  _wsInitialized = true;

  const wsUrl = API_BASE_URL.replace("http", "ws");
  try {
    _notifWs = new WebSocket(wsUrl);

    _notifWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { event: string; data: unknown };
        handleNotifWsEvent(msg.event);
      } catch {
        // ignore malformed frames
      }
    };

    _notifWs.onerror = () => {};

    _notifWs.onclose = () => {
      _notifWs = null;
      _wsInitialized = false;
      // Reconnect after a short backoff when the server is live
      setTimeout(initNotifWebSocket, 6000);
    };
  } catch {
    _wsInitialized = false;
  }
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
