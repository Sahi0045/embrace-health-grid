/**
 * NotificationBell — header bell icon with real-time unread badge and
 * an animated dropdown showing the last 8 notifications.
 */

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  ShieldAlert,
  UserCheck,
  BadgeCheck,
  Layers,
  TestTube2,
  Calendar,
  AlertTriangle,
  CheckCheck,
} from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import type { Notification } from "@/lib/notifications";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

function NotifIcon({ type }: { type: Notification["type"] }) {
  const cls = "h-4 w-4 flex-shrink-0 mt-0.5";
  switch (type) {
    case "consent_request":
      return <UserCheck className={`${cls} text-primary`} />;
    case "block_committed":
      return <Layers className={`${cls} text-chart-2`} />;
    case "credential_issued":
      return <BadgeCheck className={`${cls} text-success`} />;
    case "fraud_alert":
      return <ShieldAlert className={`${cls} text-destructive`} />;
    case "lab_ready":
      return <TestTube2 className={`${cls} text-chart-3`} />;
    case "appointment":
      return <Calendar className={`${cls} text-primary`} />;
    case "emergency":
      return <AlertTriangle className={`${cls} text-destructive`} />;
  }
}

function severityBorder(severity: Notification["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-l-2 border-l-destructive";
    case "warning":
      return "border-l-2 border-l-warning";
    case "info":
    default:
      return "border-l-2 border-l-transparent";
  }
}

function severityBg(severity: Notification["severity"]): string {
  switch (severity) {
    case "critical":
      return "bg-destructive/[0.04]";
    case "warning":
      return "bg-warning/10";
    default:
      return "";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const recent = notifications.slice(0, 8);

  return (
    <div ref={containerRef} className="relative">
      {/* ── Bell button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open notifications"
        aria-haspopup="true"
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-4.5 w-4.5" />

        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-0.75 text-[9px] font-bold leading-none text-white"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* ── Dropdown ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="notif-dropdown"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-clinical-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                    {unreadCount}
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-105 overflow-y-auto divide-y divide-border/50">
              {recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Bell className="h-5 w-5 text-muted-foreground/60" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">All clear</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">No notifications yet</p>
                  </div>
                </div>
              ) : (
                recent.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={[
                      "group w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors",
                      "hover:bg-accent/60",
                      severityBorder(n.severity),
                      severityBg(n.severity),
                      !n.read ? "bg-primary/[0.025]" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {/* Type icon */}
                    <NotifIcon type={n.type} />

                    {/* Content */}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`truncate text-xs font-semibold ${!n.read ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {n.title}
                        </span>
                        <span className="flex-shrink-0 text-[10px] leading-4 text-muted-foreground">
                          {formatRelativeTime(n.timestamp)}
                        </span>
                      </div>
                      <span className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {n.message}
                      </span>
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
