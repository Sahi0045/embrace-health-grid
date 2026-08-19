import { motion } from "framer-motion";
import {
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Utensils,
  User,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import type { MealDeliveryRecord, DeliveryStatus } from "@/lib/types";

interface MealDeliveryTabProps {
  deliveries: MealDeliveryRecord[];
  onAdvanceStage: (deliveryId: string, nextStatus: DeliveryStatus) => void;
}

const STAGE_ORDER: DeliveryStatus[] = ["preparing", "dispatched", "delivered"];

const STATUS_CONFIGS: Record<DeliveryStatus, { label: string; color: string; border: string }> = {
  preparing: {
    label: "Kitchen Prep",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    border: "border-amber-500/20",
  },
  dispatched: {
    label: "In Transit",
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    border: "border-sky-500/20",
  },
  delivered: {
    label: "Delivered",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    border: "border-rose-500/20",
  },
};

export function MealDeliveryTab({ deliveries, onAdvanceStage }: MealDeliveryTabProps) {
  if (deliveries.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="Meal Delivery Queue Clear"
        description="There are currently no active patient meal dispatches scheduled in the queue."
      />
    );
  }

  return (
    <div className="space-y-4">
      {deliveries.map((delivery) => {
        const config = STATUS_CONFIGS[delivery.delivery_status] || STATUS_CONFIGS.preparing;
        const currentStageIndex = STAGE_ORDER.indexOf(delivery.delivery_status);
        const canAdvance = currentStageIndex !== -1 && currentStageIndex < STAGE_ORDER.length - 1;
        const nextStatus = canAdvance ? STAGE_ORDER[currentStageIndex + 1] : null;

        return (
          <GlowCard
            key={delivery.delivery_id}
            accent={
              delivery.delivery_status === "delivered"
                ? "success"
                : delivery.delivery_status === "dispatched"
                  ? "primary"
                  : "warning"
            }
            className="p-4 sm:p-5 bg-card border border-border/80 rounded-2xl shadow-clinical-xs transition-all hover:border-primary/40"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left Column: Patient & Meal Details */}
              <div className="flex items-start sm:items-center gap-4 flex-1">
                <div className={`p-3 rounded-2xl shrink-0 border ${config.color} ${config.border}`}>
                  <Utensils className="h-5 w-5" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-black text-foreground tracking-tight">
                      {delivery.patient_name}
                    </h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-primary/10 text-primary border border-primary/20">
                      📍 {delivery.room_number}
                    </span>
                    <span className="text-xs uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                      {delivery.meal_type}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-foreground">{delivery.menu_item_name}</p>

                  {delivery.dietary_notes && (
                    <p className="text-[11px] text-muted-foreground italic">
                      Special note: {delivery.dietary_notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Middle: 3-Stage Progress Pipeline */}
              <div className="flex items-center gap-2 sm:gap-4 py-2 lg:py-0 border-y lg:border-y-0 border-border/60">
                {STAGE_ORDER.map((stage, idx) => {
                  const isCompleted = currentStageIndex >= idx;
                  const isCurrent = currentStageIndex === idx;

                  return (
                    <div key={stage} className="flex items-center gap-2">
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all border ${
                          isCurrent
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : isCompleted
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-muted/40 text-muted-foreground/60 border-border/40"
                        }`}
                      >
                        {isCompleted && !isCurrent ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        )}
                        <span className="capitalize">{stage}</span>
                      </div>

                      {idx < STAGE_ORDER.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Time & Advance Button */}
              <div className="flex items-center justify-between lg:justify-end gap-3 self-stretch lg:self-auto">
                <div className="text-left lg:text-right text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      Scheduled:{" "}
                      {new Date(delivery.scheduled_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {delivery.delivered_at && (
                    <p className="text-emerald-500 font-bold">
                      Delivered:{" "}
                      {new Date(delivery.delivered_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>

                {canAdvance && nextStatus && (
                  <Button
                    size="sm"
                    onClick={() => onAdvanceStage(delivery.delivery_id, nextStatus)}
                    className="rounded-xl px-3.5 py-2 text-xs font-bold gap-1 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer"
                  >
                    <span>Mark {nextStatus}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}

                {delivery.delivery_status === "delivered" && (
                  <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" /> Completed
                  </span>
                )}
              </div>
            </div>
          </GlowCard>
        );
      })}
    </div>
  );
}
