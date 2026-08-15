import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Siren,
  PhoneCall,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LabResultRecord } from "@/lib/types";

interface CriticalResultBannerProps {
  criticalResults: LabResultRecord[];
  onAcknowledge?: (labId: string) => void;
  onNotifyTeam?: (result: LabResultRecord) => void;
  onViewResult?: (result: LabResultRecord) => void;
}

export function CriticalResultBanner({
  criticalResults,
  onAcknowledge,
  onNotifyTeam,
  onViewResult,
}: CriticalResultBannerProps) {
  if (criticalResults.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="relative overflow-hidden rounded-2xl border border-destructive/60 bg-destructive/10 p-5 shadow-clinical-md ring-1 ring-destructive/30 space-y-3.5"
      >
        {/* Background Ambient Glow Spot */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-destructive/20 blur-2xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive text-destructive-foreground shadow-md animate-pulse">
              <Siren className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-destructive">
                  Critical Panic Finding Alert
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-ping" />
              </div>
              <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                {criticalResults.length} Critical Laboratory Values Requiring Immediate Clinical Action
              </h3>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/20 border border-destructive/40 px-3 py-1 text-xs font-extrabold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Stat Protocol Active
          </span>
        </div>

        {/* Critical findings list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
          {criticalResults.map((item) => (
            <div
              key={item.lab_id}
              className="flex items-center justify-between gap-3 rounded-xl bg-background/90 border border-destructive/40 p-3.5 shadow-xs hover:border-destructive transition-all"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-foreground truncate">
                    {item.test_name}
                  </span>
                  <span className="font-mono text-[10px] text-destructive bg-destructive/15 px-1.5 py-0.5 rounded font-extrabold">
                    {item.critical_flag?.toUpperCase() || "PANIC"}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Patient: <strong className="text-foreground">{item.patient_name}</strong> ({item.patient_mrn})
                </p>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-extrabold font-display text-destructive">
                    {item.result_value} {item.unit}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    (Ref: {item.reference_range})
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <Button
                  size="sm"
                  onClick={() => onNotifyTeam?.(item)}
                  className="h-7 px-2.5 rounded-lg bg-destructive text-destructive-foreground text-[11px] font-extrabold gap-1 hover:bg-destructive/90 shadow-xs"
                >
                  <PhoneCall className="h-3 w-3" />
                  <span>Notify MD</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewResult?.(item)}
                  className="h-7 px-2.5 rounded-lg text-[11px] font-bold gap-1 border-border/80"
                >
                  <span>Details</span>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
