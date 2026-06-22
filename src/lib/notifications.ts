/**
 * Notification Store — singleton EventTarget-based notification system
 * Shared across all components; emits "notifications:update" on changes.
 */

export interface Notification {
  id: string;
  type:
    | "consent_request"
    | "block_committed"
    | "credential_issued"
    | "fraud_alert"
    | "lab_ready"
    | "appointment"
    | "emergency";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  severity: "info" | "warning" | "critical";
  link?: string;
}

// ─── Singleton store ──────────────────────────────────────────────────────────
export const notificationStore = new EventTarget();
const _notifications: Notification[] = [];

function seedSampleNotifications() {
  const now = Date.now();

  _notifications.push({
    id: `seed-0-${now}`,
    type: "consent_request",
    title: "Consent Request Pending",
    message:
      "Patient did:fabric:pat-001 has a pending consent request from Dr. Martinez for radiology records.",
    timestamp: now - 15 * 60 * 1000,
    read: false,
    severity: "info",
  });

  _notifications.push({
    id: `seed-1-${now}`,
    type: "fraud_alert",
    title: "Fraud Alert — High Risk",
    message:
      "Anomalous credential usage detected for did:fabric:pat-042. Risk score: 87/100. Immediate review required.",
    timestamp: now - 8 * 60 * 1000,
    read: false,
    severity: "critical",
  });

  _notifications.push({
    id: `seed-2-${now}`,
    type: "block_committed",
    title: "Block #4,218 Committed",
    message: "New block committed to embrace-health-channel with 3 transactions.",
    timestamp: now - 2 * 60 * 1000,
    read: false,
    severity: "info",
  });
}

function ensureSeeded() {
  if (_notifications.length === 0) {
    seedSampleNotifications();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function addNotification(n: Omit<Notification, "id" | "read" | "timestamp">) {
  const notification: Notification = {
    ...n,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    read: false,
    timestamp: Date.now(),
  };
  _notifications.unshift(notification);
  notificationStore.dispatchEvent(new Event("notifications:update"));
}

export function getNotifications(): Notification[] {
  ensureSeeded();
  return _notifications;
}

export function markAllRead() {
  ensureSeeded();
  _notifications.forEach((n) => {
    n.read = true;
  });
  notificationStore.dispatchEvent(new Event("notifications:update"));
}

export function markRead(id: string) {
  ensureSeeded();
  const n = _notifications.find((n) => n.id === id);
  if (n) n.read = true;
  notificationStore.dispatchEvent(new Event("notifications:update"));
}

export function getUnreadCount(): number {
  ensureSeeded();
  return _notifications.filter((n) => !n.read).length;
}
