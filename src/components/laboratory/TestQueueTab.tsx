import { motion } from "framer-motion";
import {
  FlaskConical,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Stethoscope,
  FileText,
  Play,
  Check,
  ChevronRight,
  TestTube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import type { LabOrderRecord } from "@/lib/types";

interface TestQueueTabProps {
  orders: LabOrderRecord[];
  onUpdateStatus: (orderId: string, status: "pending" | "in_progress" | "completed" | "cancelled") => void;
  onRecordResultClick: (order: LabOrderRecord) => void;
}

export function TestQueueTab({
  orders,
  onUpdateStatus,
  onRecordResultClick,
}: TestQueueTabProps) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No test orders in queue"
        description="There are currently no active or pending lab test orders matching your filter criteria."
      />
    );
  }

  return (
    <div className="space-y-3.5">
      {orders.map((order, index) => {
        const isStat = order.priority === "stat";
        const isUrgent = order.priority === "urgent";

        return (
          <motion.div
            key={order.order_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
            className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 ${
              isStat
                ? "border-destructive/40 bg-card shadow-clinical-sm hover:border-destructive/70"
                : "border-border/80 bg-card shadow-clinical-sm hover:border-primary/40"
            }`}
          >
            {/* Ambient accent line for STAT items */}
            {isStat && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive via-red-500 to-amber-500" />
            )}

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left Column: Test & Patient Overview */}
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Priority Tag */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                      isStat
                        ? "bg-destructive/15 text-destructive border-destructive/30 animate-pulse"
                        : isUrgent
                          ? "bg-warning/15 text-warning-foreground border-warning/30"
                          : "bg-muted text-muted-foreground border-border/80"
                    }`}
                  >
                    {isStat && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
                    {order.priority.toUpperCase()}
                  </span>

                  {/* Category Pill */}
                  <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase">
                    {order.test_category || "Biochemistry"}
                  </span>

                  {/* Order ID & Time */}
                  <span className="font-mono text-[11px] font-bold text-muted-foreground">
                    #{order.order_id}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(order.ordered_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Test Name & Specimen */}
                <div>
                  <h3 className="font-display font-extrabold text-base text-foreground tracking-tight flex items-center gap-2">
                    <TestTube className="h-4.5 w-4.5 text-primary shrink-0" />
                    <span className="truncate">{order.test_name}</span>
                  </h3>
                  {order.specimen_type && (
                    <p className="text-xs font-medium text-muted-foreground mt-0.5">
                      Specimen: <span className="text-foreground font-semibold">{order.specimen_type}</span>
                    </p>
                  )}
                </div>

                {/* Patient & Doctor Context */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span className="text-foreground font-bold">{order.patient_name}</span>
                    {order.patient_mrn && (
                      <span className="font-mono text-[10px] bg-muted/60 px-1.5 py-0.5 rounded">
                        {order.patient_mrn}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Ordered by: <strong className="text-foreground">{order.doctor_name || "Physician"}</strong></span>
                  </div>
                </div>

                {/* Clinical Indication Notes */}
                {order.clinical_notes && (
                  <div className="rounded-xl bg-background/80 border border-border/60 p-2 text-xs text-muted-foreground flex items-start gap-1.5 mt-2">
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="italic">{order.clinical_notes}</span>
                  </div>
                )}
              </div>

              {/* Right Column: Status & Action Group */}
              <div className="flex flex-wrap lg:flex-col items-end justify-between lg:justify-center gap-3 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-border/60">
                {/* Status Indicator */}
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                      order.status === "completed"
                        ? "bg-success/15 text-success border border-success/30"
                        : order.status === "in_progress"
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-warning/15 text-warning-foreground border border-warning/30"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        order.status === "completed"
                          ? "bg-success"
                          : order.status === "in_progress"
                            ? "bg-primary animate-pulse"
                            : "bg-warning"
                      }`}
                    />
                    {order.status === "in_progress"
                      ? "IN PROCESS"
                      : order.status === "completed"
                        ? "COMPLETED"
                        : "PENDING"}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {order.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => onUpdateStatus(order.order_id, "in_progress")}
                      className="h-8 rounded-xl bg-primary text-primary-foreground text-xs font-bold gap-1.5 shadow-xs hover:bg-primary/90"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Start Process</span>
                    </Button>
                  )}

                  {order.status === "in_progress" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRecordResultClick(order)}
                        className="h-8 rounded-xl text-xs font-bold gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                      >
                        <FlaskConical className="h-3.5 w-3.5" />
                        <span>Enter Result</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onUpdateStatus(order.order_id, "completed")}
                        className="h-8 rounded-xl bg-success text-success-foreground text-xs font-bold gap-1.5 hover:bg-success/90 shadow-xs"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Complete</span>
                      </Button>
                    </>
                  )}

                  {order.status === "completed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRecordResultClick(order)}
                      className="h-8 rounded-xl text-xs font-bold gap-1 hover:bg-accent"
                    >
                      <span>View Record</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
