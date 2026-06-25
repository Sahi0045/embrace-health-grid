/**
 * useNotifications — subscribes to the in-memory notification store.
 *
 * Fabric WebSocket notification integration has been removed.
 */

import { useState, useEffect } from "react";
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  notificationStore,
} from "@/lib/notifications";
import type { Notification } from "@/lib/notifications";

function initNotifConnection() {
  return;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(() => getNotifications());
  const [unreadCount, setUnreadCount] = useState(() => getUnreadCount());

  useEffect(() => {
    const onUpdate = () => {
      setNotifications([...getNotifications()]);
      setUnreadCount(getUnreadCount());
    };

    notificationStore.addEventListener("notifications:update", onUpdate);
    initNotifConnection();

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
