import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ShieldAlert,
  Clock,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { acknowledgeInventoryAlert } from "@/lib/api";
import type { InventoryAlert } from "@/lib/types";

export interface InventoryAlertPanelProps {
  alerts: InventoryAlert[];
  onSelectAlertItem?: (itemId: string) => void;
  onDismissAlert?: (alertId: string) => void;
}

export function InventoryAlertPanel({
  alerts,
  onSelectAlertItem,
  onDismissAlert,
}: InventoryAlertPanelProps) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  const handleAcknowledge = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (onDismissAlert) {
      onDismissAlert(alertId);
    }
    toast.success("Alert acknowledged");

    try {
      await acknowledgeInventoryAlert(alertId);
    } catch (err: any) {
      console.warn("Alert dismissal background sync:", err?.message || err);
    }
  };

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <div>
      <GlowCard glowOnHover={false} className="p-5 md:p-6 border-destructive/30 bg-destructive/5 dark:bg-destructive/10 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-destructive/20 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/20 text-destructive shadow-xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                  Critical Supply Chain & Stock Alerts
                </h3>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-extrabold text-destructive-foreground">
                  {alerts.length}
                </span>
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                Action required: {criticalCount} critical thresholds breached, {warningCount} near-expiry rotations pending
              </p>
            </div>
          </div>
        </div>

        {/* Alerts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {alerts.map((alert) => {
              const isCritical = alert.severity === "critical";
              const isExpiry = alert.alert_type === "near_expiry" || alert.alert_type === "expired";

              return (
                <motion.div
                  key={alert.alert_id}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    layout: { duration: 0.25, ease: "easeInOut" },
                    opacity: { duration: 0.15 },
                  }}
                  onClick={() => onSelectAlertItem && onSelectAlertItem(alert.item_id)}
                  className={`group relative flex items-start justify-between gap-3 p-3.5 rounded-2xl border transition-colors cursor-pointer ${
                    isCritical
                      ? "bg-card/90 border-destructive/30 hover:border-destructive/60 hover:shadow-clinical-sm"
                      : "bg-card/90 border-warning/30 hover:border-warning/60 hover:shadow-clinical-sm"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        isCritical
                          ? "bg-destructive/15 text-destructive"
                          : "bg-warning/15 text-warning-foreground"
                      }`}
                    >
                      {isCritical ? (
                        <ShieldAlert className="h-4 w-4" />
                      ) : isExpiry ? (
                        <Clock className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-extrabold text-foreground group-hover:text-primary transition-colors">
                          {alert.item_id}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.2 text-[9px] font-extrabold uppercase tracking-wider ${
                            isCritical
                              ? "bg-destructive/15 text-destructive border border-destructive/20"
                              : "bg-warning/15 text-warning-foreground border border-warning/20"
                          }`}
                        >
                          {alert.alert_type.replace("_", " ")}
                        </span>
                      </div>

                      <p className="text-[11px] font-medium text-muted-foreground line-clamp-2 leading-snug">
                        {alert.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleAcknowledge(alert.alert_id, e)}
                      className="rounded-xl h-7 px-2.5 text-[10px] font-bold shadow-xs hover:bg-accent cursor-pointer"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                      Dismiss
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </GlowCard>
    </div>
  );
}
