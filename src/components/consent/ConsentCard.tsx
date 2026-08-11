import { ShieldCheck, ShieldX, Clock, User, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export type ConsentStatus = "active" | "pending" | "revoked" | "expired";

export interface ConsentRecord {
  id: string;
  requester: string;
  requesterRole: string;
  reason: string;
  grantedAt: string;
  expiresAt: string;
  status: ConsentStatus;
}

interface ConsentCardProps {
  consent: ConsentRecord;
  onRevoke?: (id: string) => void;
  onApprove?: (id: string) => void;
}

const statusConfig: Record<ConsentStatus, { badge: string; icon: typeof ShieldCheck }> = {
  active: { badge: "bg-success/10 text-success", icon: ShieldCheck },
  pending: { badge: "bg-warning/10 text-warning-foreground", icon: Clock },
  revoked: { badge: "bg-destructive/10 text-destructive", icon: ShieldX },
  expired: { badge: "bg-muted text-muted-foreground", icon: ShieldX },
};

export function ConsentCard({ consent, onRevoke, onApprove }: ConsentCardProps) {
  const cfg = statusConfig[consent.status];
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-border bg-card p-4 shadow-clinical transition-shadow duration-300 hover:shadow-clinical-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
            {consent.requester
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">
              {consent.requester}
            </div>
            <div className="text-xs text-muted-foreground">{consent.requesterRole}</div>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0 ${cfg.badge}`}
        >
          <Icon className="h-3 w-3" />
          {consent.status}
        </span>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">{consent.reason}</div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Granted {consent.grantedAt}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Expires {consent.expiresAt}</span>
        </div>
      </div>

      {(consent.status === "pending" || consent.status === "active") && (
        <div className="mt-3 flex gap-2">
          {consent.status === "pending" && onApprove && (
            <button
              onClick={() => onApprove(consent.id)}
              className="flex-1 rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/25 transition-colors"
            >
              Approve
            </button>
          )}
          {consent.status === "active" && onRevoke && (
            <button
              onClick={() => onRevoke(consent.id)}
              className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              Revoke
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
