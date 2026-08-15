import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  User,
  FlaskConical,
  Award,
  Hash,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { LabResultRecord } from "@/lib/types";

interface LabResultsTabProps {
  results: LabResultRecord[];
  onResultClick?: (res: LabResultRecord) => void;
}

export function LabResultsTab({ results, onResultClick }: LabResultsTabProps) {
  if (results.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No test results recorded"
        description="Completed laboratory analytical findings will appear here once verified by a pathologist."
      />
    );
  }

  return (
    <div className="space-y-3.5">
      {results.map((res, index) => {
        const isCritical =
          res.is_critical ||
          res.status === "critical" ||
          res.critical_flag?.startsWith("critical") ||
          res.critical_flag === "panic";

        const isAbnormal = res.status === "abnormal" || res.critical_flag === "low" || res.critical_flag === "high";

        return (
          <motion.div
            key={res.lab_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
            onClick={() => onResultClick?.(res)}
            className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 cursor-pointer ${
              isCritical
                ? "border-destructive/60 bg-destructive/5 shadow-clinical-md ring-1 ring-destructive/30 hover:border-destructive hover:shadow-clinical-lg"
                : isAbnormal
                  ? "border-warning/50 bg-warning/5 shadow-clinical-sm hover:border-warning"
                  : "border-border/80 bg-card shadow-clinical-sm hover:border-primary/40"
            }`}
          >
            {/* Critical alert top indicator */}
            {isCritical && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive via-red-500 to-amber-500 animate-pulse" />
            )}

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left Column: Test & Patient */}
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                      isCritical
                        ? "bg-destructive text-destructive-foreground border-destructive animate-pulse"
                        : isAbnormal
                          ? "bg-warning/20 text-warning-foreground border-warning/40"
                          : "bg-success/15 text-success border-success/30"
                    }`}
                  >
                    {isCritical ? (
                      <>
                        <AlertTriangle className="h-3 w-3" />
                        CRITICAL PANIC
                      </>
                    ) : isAbnormal ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                        ABNORMAL
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        NORMAL
                      </>
                    )}
                  </span>

                  {/* Discipline Category */}
                  <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase">
                    {res.category || "Biochemistry"}
                  </span>

                  <span className="font-mono text-[11px] font-bold text-muted-foreground">
                    #{res.lab_id}
                  </span>
                </div>

                {/* Test Name */}
                <div>
                  <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                    {res.test_name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <User className="h-3.5 w-3.5 text-primary" />
                      {res.patient_name || "Patient Record"}
                    </span>
                    {res.patient_mrn && (
                      <span className="font-mono text-[10px] bg-muted/70 px-1.5 py-0.5 rounded">
                        {res.patient_mrn}
                      </span>
                    )}
                  </div>
                </div>

                {/* Verification & Doctor */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground pt-1">
                  {res.verified_by && (
                    <span className="flex items-center gap-1 text-success font-medium">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified by: {res.verified_by}
                    </span>
                  )}
                  {res.resulted_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(res.resulted_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Column: Quantitative Findings & Reference Range */}
              <div className="flex items-center gap-4 shrink-0 bg-background/80 border border-border/70 rounded-xl p-3.5 shadow-xs">
                {/* Result Value */}
                <div className="text-right pr-4 border-r border-border/60">
                  <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider block">
                    Observed Value
                  </span>
                  <div className="flex items-baseline gap-1 justify-end">
                    <span
                      className={`text-2xl font-extrabold font-display ${
                        isCritical
                          ? "text-destructive"
                          : isAbnormal
                            ? "text-warning-foreground"
                            : "text-success"
                      }`}
                    >
                      {res.result_value || "—"}
                    </span>
                    {res.unit && (
                      <span className="text-xs font-bold text-muted-foreground">
                        {res.unit}
                      </span>
                    )}
                  </div>
                </div>

                {/* Reference Range */}
                <div className="text-left min-w-[110px]">
                  <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider block">
                    Reference Range
                  </span>
                  <span className="text-xs font-semibold text-foreground block mt-0.5 font-mono">
                    {res.reference_range || "N/A"}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Standard Population
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
