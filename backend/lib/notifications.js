import { getAllState, putState } from "../world-state-db.js";
import { randomUUID } from "crypto";

const NS = "notifications";

function notifKey(userEmail, id) {
  return `${userEmail}::${id}`;
}

export function pushNotification({ userEmail, type, title, message, severity = "info", link }) {
  const id = `notif-${randomUUID().slice(0, 8)}`;
  const notif = {
    id,
    userEmail,
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    severity,
    link: link || null,
  };
  putState(NS, notifKey(userEmail, id), notif, randomUUID());
  return notif;
}

export function getNotificationsForUser(userEmail) {
  const all = getAllState(NS)
    .map((e) => e.value)
    .filter((n) => n.userEmail === userEmail)
    .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return {
    notifications: all,
    unreadCount: all.filter((n) => !n.read).length,
  };
}

export function markAllRead(userEmail) {
  const all = getAllState(NS).filter((e) => e.value?.userEmail === userEmail);
  all.forEach((e) => {
    e.value.read = true;
    putState(NS, e.key, e.value, randomUUID());
  });
}

export function markRead(userEmail, id) {
  const entry = getAllState(NS).find((e) => e.value?.id === id && e.value?.userEmail === userEmail);
  if (entry) {
    entry.value.read = true;
    putState(NS, entry.key, entry.value, randomUUID());
  }
}
