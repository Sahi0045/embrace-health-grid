import {
  X,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Database,
  Building2,
  MapPin,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import type { CentralAlert } from "@/lib/types";

export interface AlertDetailDialogProps {
  alert: CentralAlert | null;
  onClose: () => void;
  onAcknowledge: (alert: CentralAlert) => void;
  onResolve: (alert: CentralAlert) => void;
  onJumpToSource: (alert: CentralAlert) => void;
}

export function AlertDetailDialog({
  alert,
  onClose,
  onAcknowledge,
  onResolve,
  onJumpToSource,
}: AlertDetailDialogProps) {
  if (!alert) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-foreground/40 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-clinical-xl z-10 space-y-6 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  alert.severity === "critical"
                    ? "bg-destructive/15 text-destructive"
                    : alert.severity === "warning"
                      ? "bg-warning/15 text-warning-foreground"
                      : "bg-primary/15 text-primary"
                }`}
              >
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                  Telemetry & Incident Inspector
                </h3>
                <p className="text-[11px] font-medium text-muted-foreground">
                  Event ID: <span className="font-mono font-bold text-foreground">{alert.id}</span>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-1.5 hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Severity & Category Banner */}
          <div className="rounded-xl bg-background/80 border border-border/80 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                    alert.severity === "critical"
                      ? "bg-destructive/15 text-destructive border-destructive/30"
                      : alert.severity === "warning"
                        ? "bg-warning/20 text-warning-foreground border-warning/30"
                        : "bg-primary/10 text-primary border-primary/20"
                  }`}
                >
                  {alert.severity} Priority
                </span>

                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-extrabold uppercase text-muted-foreground">
                  {alert.category}
                </span>

                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-extrabold uppercase text-muted-foreground">
                  Status: {alert.status}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{new Date(alert.created_at).toLocaleString()}</span>
              </div>
            </div>

            <h4 className="font-display font-bold text-sm text-foreground pt-1">{alert.title}</h4>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">
              {alert.message}
            </p>
          </div>

          {/* Forensic / Metadata Details Grid */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground border-l-2 border-primary/30 pl-3">
              Diagnostic & Telemetry Payload
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-muted-foreground">
                  Source Database Table
                </div>
                <div className="font-mono text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-primary" />
                  <span>{alert.source_table}</span>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-muted-foreground">
                  Source Record Reference
                </div>
                <div className="font-mono text-xs font-bold text-foreground">{alert.source_id}</div>
              </div>

              {alert.department && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                  <div className="text-[10px] font-extrabold uppercase text-muted-foreground">
                    Assigned Unit / Department
                  </div>
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    <span>{alert.department}</span>
                  </div>
                </div>
              )}

              {alert.location && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                  <div className="text-[10px] font-extrabold uppercase text-muted-foreground">
                    Physical Spatial Location
                  </div>
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-warning-foreground" />
                    <span>{alert.location}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Metadata JSON block */}
            {alert.metadata && Object.keys(alert.metadata).length > 0 && (
              <div className="pt-2">
                <div className="rounded-xl bg-background border border-border/80 p-3 font-mono text-[11px] text-muted-foreground space-y-1 overflow-x-auto">
                  {Object.entries(alert.metadata).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-4 py-0.5 border-b border-border/40 last:border-0"
                    >
                      <span className="font-bold text-foreground">{k}:</span>
                      <span className="text-primary">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="border-t border-border/60 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {alert.target_url ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onJumpToSource(alert);
                }}
                className="h-9 rounded-xl text-xs font-bold gap-1.5 border-primary text-primary hover:bg-primary/10"
              >
                <span>Navigate to Source Location</span>
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {alert.status === "active" && (
                <Button
                  size="sm"
                  onClick={() => {
                    onAcknowledge(alert);
                    onClose();
                  }}
                  className="h-9 rounded-xl text-xs font-extrabold gap-1.5 bg-primary text-primary-foreground"
                >
                  <Check className="h-4 w-4" />
                  <span>Acknowledge</span>
                </Button>
              )}

              {alert.status !== "resolved" && (
                <Button
                  size="sm"
                  onClick={() => {
                    onResolve(alert);
                    onClose();
                  }}
                  className="h-9 rounded-xl text-xs font-extrabold gap-1.5 bg-success text-success-foreground"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Mark Resolved</span>
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
