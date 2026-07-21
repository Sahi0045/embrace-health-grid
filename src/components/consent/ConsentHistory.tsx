import { motion } from "framer-motion";
import { ShieldCheck, ShieldX, Clock, Calendar } from "lucide-react";
import type { ConsentRecord } from "./ConsentCard";

interface ConsentHistoryProps {
  consents: ConsentRecord[];
}

const statusIcon = {
  active: ShieldCheck,
  pending: Clock,
  revoked: ShieldX,
  expired: ShieldX,
};

const statusColor = {
  active: "text-success",
  pending: "text-warning-foreground",
  revoked: "text-destructive",
  expired: "text-muted-foreground",
};

const statusLine = {
  active: "bg-success",
  pending: "bg-warning",
  revoked: "bg-destructive",
  expired: "bg-muted-foreground",
};

export function ConsentHistory({ consents }: ConsentHistoryProps) {
  return (
    <div className="relative pl-5 space-y-4">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
      {consents.map((c, i) => {
        const Icon = statusIcon[c.status];
        return (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-start gap-3"
          >
            <div
              className={`relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-2 ring-background ${statusLine[c.status]}`}
            >
              <Icon className="h-3 w-3 text-white" />
            </div>
            <div className="flex-1 min-w-0 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{c.requester}</span>
                  <span className="text-xs text-muted-foreground">· {c.requesterRole}</span>
                </div>
                <span className={`text-[10px] font-semibold uppercase ${statusColor[c.status]}`}>
                  {c.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{c.reason}</div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Granted {c.grantedAt}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Expires {c.expiresAt}
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
