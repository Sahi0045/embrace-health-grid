import { motion } from "framer-motion";
import { ShieldCheck, ShieldX, Plus, Eye, RefreshCw } from "lucide-react";

export type CredentialTimelineEvent = {
  id: string;
  action: "issued" | "verified" | "revoked" | "renewed" | "expired";
  label: string;
  issuer?: string;
  at: string;
};

const actionConfig = {
  issued: { icon: Plus, color: "text-primary bg-primary/10 border-primary/20" },
  verified: { icon: ShieldCheck, color: "text-success bg-success/10 border-success/20" },
  revoked: { icon: ShieldX, color: "text-destructive bg-destructive/10 border-destructive/20" },
  renewed: { icon: RefreshCw, color: "text-chart-2 bg-chart-2/10 border-chart-2/20" },
  expired: { icon: Eye, color: "text-muted-foreground bg-muted border-border" },
};

interface CredentialTimelineProps {
  events: CredentialTimelineEvent[];
}

export function CredentialTimeline({ events }: CredentialTimelineProps) {
  return (
    <div className="relative space-y-4 pl-6">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
      {events.map((ev, i) => {
        const cfg = actionConfig[ev.action];
        const Icon = cfg.icon;
        return (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-start gap-3"
          >
            <div className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${cfg.color}`}>
              <Icon className="h-3 w-3" />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="text-sm font-medium text-foreground">{ev.label}</div>
              {ev.issuer && <div className="text-xs text-muted-foreground">{ev.issuer}</div>}
              <div className="mt-0.5 text-[11px] text-muted-foreground">{ev.at}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
