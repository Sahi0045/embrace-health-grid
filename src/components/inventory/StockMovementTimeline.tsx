import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Clock,
  UserCheck,
  FileText,
  History,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StockMovement } from "@/lib/types";

export interface StockMovementTimelineProps {
  movements: StockMovement[];
  loading?: boolean;
}

export function StockMovementTimeline({
  movements,
  loading = false,
}: StockMovementTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-muted/40"
          >
            <div className="h-8 w-8 bg-muted rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!movements || movements.length === 0) {
    return (
      <div className="border border-dashed border-border/80 rounded-2xl p-8 text-center space-y-2">
        <History className="h-6 w-6 text-muted-foreground mx-auto" />
        <p className="text-xs font-bold text-foreground">No Stock Movement History</p>
        <p className="text-[11px] text-muted-foreground">
          Transactions will be recorded when inventory is received or dispatched.
        </p>
      </div>
    );
  }

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-2.5">
      {movements.map((move, index) => {
        const isEntry = move.movement_type === "IN";
        const isExit = move.movement_type === "OUT";
        const isAdjust = move.movement_type === "ADJUSTMENT";

        return (
          <motion.div
            key={move.movement_id || index}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: index * 0.04 }}
            className="group flex items-start justify-between gap-3 p-3 rounded-xl border border-border/60 bg-background/80 hover:border-primary/40 hover:bg-card transition-all"
          >
            <div className="flex items-start gap-3 min-w-0">
              {/* Type Icon Badge */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold ${
                  isEntry
                    ? "bg-success/15 text-success"
                    : isExit
                    ? "bg-destructive/15 text-destructive"
                    : "bg-primary/15 text-primary"
                }`}
              >
                {isEntry ? (
                  <ArrowDownLeft className="h-4 w-4" />
                ) : isExit ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </div>

              {/* Movement Details */}
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[10px] font-extrabold uppercase ${
                      isEntry
                        ? "bg-success/10 text-success border border-success/20"
                        : isExit
                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                        : "bg-primary/10 text-primary border border-primary/20"
                    }`}
                  >
                    {move.movement_type}
                  </span>

                  <span className="text-xs font-extrabold font-display text-foreground">
                    {isEntry ? `+${move.quantity}` : isExit ? `-${Math.abs(move.quantity)}` : `${move.quantity > 0 ? "+" : ""}${move.quantity}`} units
                  </span>

                  <span className="text-[11px] font-mono text-muted-foreground">
                    ({move.previous_stock} → {move.new_stock})
                  </span>
                </div>

                <p className="text-[11px] font-medium text-muted-foreground truncate">
                  {move.reason || "Manual inventory adjustment"}
                </p>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80 pt-0.5">
                  <span className="flex items-center gap-1 font-medium">
                    <UserCheck className="h-3 w-3" />
                    {move.performed_by_name || "Clinician"}
                  </span>
                </div>
              </div>
            </div>

            {/* Timestamp */}
            <div className="text-[11px] font-medium text-muted-foreground shrink-0 self-start">
              {formatTimestamp(move.recorded_at)}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
