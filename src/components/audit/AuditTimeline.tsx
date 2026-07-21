import { motion } from "framer-motion";
import {
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Info,
  Key,
  FileText,
  Ambulance,
  Pill,
} from "lucide-react";
import type { AuditEvent } from "@/lib/types";

interface AuditTimelineProps {
  events: AuditEvent[];
  limit?: number;
}

const catIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  access: Key,
  consent: ShieldCheck,
  credential: FileText,
  infrastructure: Ambulance,
  auth: ShieldCheck,
  prescription: Pill,
  emergency: AlertTriangle,
};

const severityDot: Record<string, string> = {
  info: "bg-primary",
  warning: "bg-warning",
  critical: "bg-destructive",
};

export function AuditTimeline({ events, limit = 50 }: AuditTimelineProps) {
  const displayed = events.slice(0, limit);

  return (
    <div className="relative pl-5 space-y-3">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
      {displayed.map((ev, i) => {
        const Icon = catIcons[ev.category] ?? Info;
        return (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.5) }}
            className="flex items-start gap-3"
          >
            <div
              className={`relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background ${severityDot[ev.severity]}`}
            />
            <div className="flex-1 min-w-0 rounded-lg border border-border bg-card px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">{ev.action}</span>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">{ev.at}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {ev.actor} · {ev.actorRole} → {ev.target}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
