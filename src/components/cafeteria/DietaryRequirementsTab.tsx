import { motion } from "framer-motion";
import {
  HeartPulse,
  AlertTriangle,
  User,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Sparkles,
  Bed,
  FileText,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import type { DietaryRequirement, MealPlanStatus } from "@/lib/types";

interface DietaryRequirementsTabProps {
  requirements: DietaryRequirement[];
  onUpdateStatus: (requirementId: string, nextStatus: MealPlanStatus) => void;
}

const PLAN_STATUS_STYLES: Record<MealPlanStatus, { label: string; color: string; border: string }> =
  {
    active: {
      label: "Active Plan",
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/20",
    },
    pending: {
      label: "Pending Assessment",
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      border: "border-amber-500/20",
    },
    review: {
      label: "Clinical Review",
      color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      border: "border-sky-500/20",
    },
    suspended: {
      label: "Suspended",
      color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      border: "border-rose-500/20",
    },
  };

export function DietaryRequirementsTab({
  requirements,
  onUpdateStatus,
}: DietaryRequirementsTabProps) {
  if (requirements.length === 0) {
    return (
      <EmptyState
        icon={HeartPulse}
        title="No Dietary Records Registered"
        description="There are currently no patient dietary profiles active in the clinical food system."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
      {requirements.map((diet) => {
        const statusConfig = PLAN_STATUS_STYLES[diet.meal_plan_status] || PLAN_STATUS_STYLES.active;
        const hasAllergies = diet.allergies.length > 0;

        return (
          <GlowCard
            key={diet.requirement_id}
            accent={hasAllergies ? "warning" : "primary"}
            className="p-5 flex flex-col justify-between h-full bg-card border border-border/80 rounded-2xl shadow-clinical-xs transition-all hover:border-primary/40"
          >
            {/* Header: Patient Info + Meal Plan Status */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/60">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-foreground tracking-tight">
                    {diet.patient_name}
                  </h4>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                  <span className="font-mono">{diet.patient_mrn}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                    <Bed className="h-3 w-3 text-primary" /> {diet.room_number || "Ward 3B"}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${statusConfig.color} ${statusConfig.border}`}
              >
                {statusConfig.label}
              </span>
            </div>

            {/* Middle: Dietary Requirements & Allergies */}
            <div className="my-3 space-y-3 flex-1">
              {/* Requirements Tags */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Prescribed Nutrition
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {diet.requirements.map((req, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20"
                    >
                      {req}
                    </span>
                  ))}
                </div>
              </div>

              {/* Allergies Warning Flags */}
              {hasAllergies && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    <span>Clinical Allergens:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {diet.allergies.map((allergy, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black bg-rose-600 text-white"
                      >
                        ⚠️ {allergy}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Clinical Notes */}
              {diet.notes && (
                <p className="text-[11px] text-muted-foreground italic line-clamp-2">
                  "{diet.notes}"
                </p>
              )}
            </div>

            {/* Footer: Prescribed by & Status Actions */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs">
              <div className="text-[11px] text-muted-foreground">
                By:{" "}
                <span className="font-semibold text-foreground">
                  {diet.prescribed_by || "Attending Dietitian"}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {diet.meal_plan_status !== "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onUpdateStatus(diet.requirement_id, "active")}
                    className="h-7 px-2 text-[10px] font-bold rounded-lg border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                  >
                    Activate
                  </Button>
                )}
                {diet.meal_plan_status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onUpdateStatus(diet.requirement_id, "review")}
                    className="h-7 px-2 text-[10px] font-bold rounded-lg border-sky-500/30 text-sky-600 hover:bg-sky-500/10 cursor-pointer"
                  >
                    Review
                  </Button>
                )}
              </div>
            </div>
          </GlowCard>
        );
      })}
    </div>
  );
}
