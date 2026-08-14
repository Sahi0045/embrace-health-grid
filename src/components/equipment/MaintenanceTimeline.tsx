import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  User,
  FileText,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MaintenanceLogEntry } from "@/lib/types";

interface MaintenanceTimelineProps {
  logs: MaintenanceLogEntry[];
  loading?: boolean;
}

export function MaintenanceTimeline({ logs, loading = false }: MaintenanceTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse flex items-start gap-3 p-3.5 rounded-xl border border-border bg-muted/20"
          >
            <div className="h-8 w-8 rounded-lg bg-muted/60" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-muted/60 rounded w-1/3" />
              <div className="h-3 bg-muted/40 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center bg-muted/10">
        <Wrench className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
        <h4 className="text-xs font-bold text-foreground">No Maintenance Logs Found</h4>
        <p className="text-[11px] text-muted-foreground mt-1 max-w-xs mx-auto">
          No preventive maintenance, calibration, or repair records logged yet for this equipment.
        </p>
      </div>
    );
  }

  const getTypeConfig = (type: string) => {
    switch (type) {
      case "calibration":
        return {
          label: "Calibration Audit",
          icon: Sparkles,
          iconBg: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
        };
      case "preventive":
        return {
          label: "Preventive Service",
          icon: Wrench,
          iconBg: "bg-primary/15 text-primary",
        };
      case "corrective":
        return {
          label: "Corrective Repair",
          icon: AlertTriangle,
          iconBg: "bg-warning/15 text-warning-foreground dark:text-amber-400",
        };
      default:
        return {
          label: "Routine Inspection",
          icon: CheckCircle2,
          iconBg: "bg-success/15 text-success",
        };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-extrabold text-success uppercase">
            Completed
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase">
            In Progress
          </span>
        );
      case "overdue":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-extrabold text-destructive uppercase">
            Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-extrabold text-muted-foreground uppercase">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      {logs.map((log) => {
        const typeCfg = getTypeConfig(log.maintenanceType);
        const Icon = typeCfg.icon;

        return (
          <div
            key={log.logId}
            className="rounded-2xl border border-border/80 bg-background/60 p-4 shadow-xs hover:border-border transition-colors space-y-2.5"
          >
            {/* Top: Type Icon, Description, Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${typeCfg.iconBg}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      {typeCfg.label}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/60">
                      {log.logId}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-foreground leading-snug mt-0.5">
                    {log.description}
                  </h4>
                </div>
              </div>
              {getStatusBadge(log.status)}
            </div>

            {/* Meta Row: Technician, Performed Date, Cost */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5 truncate">
                <User className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <span className="truncate">{log.performedBy}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <Calendar className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <span>{new Date(log.performedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate sm:justify-end">
                <DollarSign className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <span className="font-mono font-bold text-foreground">
                  ${log.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Notes if available */}
            {log.notes && (
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40 text-[11px] text-muted-foreground">
                <span className="font-bold text-foreground">Technician Notes: </span>
                {log.notes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
