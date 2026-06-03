import { ShieldCheck, ShieldX, AlertTriangle, Info } from "lucide-react";
import type { AuditEvent } from "@/lib/mock-audit";

interface AuditEventCardProps {
  event: AuditEvent;
}

const severityConfig = {
  info: { icon: Info, className: "text-primary bg-primary/10 border-primary/20", badge: "bg-primary/10 text-primary" },
  warning: { icon: AlertTriangle, className: "text-warning-foreground bg-warning/10 border-warning/30", badge: "bg-warning/10 text-warning-foreground" },
  critical: { icon: ShieldX, className: "text-destructive bg-destructive/10 border-destructive/20", badge: "bg-destructive/10 text-destructive" },
};

const resultConfig = {
  success: "text-success",
  denied: "text-destructive",
  error: "text-warning-foreground",
};

const catColors: Record<string, string> = {
  access: "bg-primary/10 text-primary",
  consent: "bg-chart-2/10 text-chart-2",
  credential: "bg-chart-3/10 text-chart-3",
  infrastructure: "bg-chart-4/10 text-chart-4",
  auth: "bg-chart-5/10 text-chart-5",
  prescription: "bg-success/10 text-success",
  emergency: "bg-destructive/10 text-destructive",
};

export function AuditEventCard({ event }: AuditEventCardProps) {
  const sev = severityConfig[event.severity];
  const Icon = sev.icon;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${sev.className}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{event.action}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${catColors[event.category] ?? "bg-muted text-muted-foreground"}`}>
            {event.category}
          </span>
          <span className={`text-xs font-medium ${resultConfig[event.result]}`}>{event.result}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground truncate">{event.details}</div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>Actor: <span className="font-medium text-foreground">{event.actor}</span> ({event.actorRole})</span>
          <span>Target: <span className="font-medium text-foreground">{event.target}</span></span>
          <span>IP: {event.ip}</span>
          <span>{event.at}</span>
        </div>
        <div className="mt-1 font-mono text-[10px] text-muted-foreground/50 truncate">{event.hash}</div>
      </div>
    </div>
  );
}
