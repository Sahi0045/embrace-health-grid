import {
  Wrench,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  Calendar,
  DollarSign,
  User,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import type { EquipmentRecord } from "@/lib/types";

interface EquipmentMaintenanceRadarProps {
  equipment: EquipmentRecord[];
  onSelectEquipment: (eq: EquipmentRecord) => void;
}

export function EquipmentMaintenanceRadar({
  equipment,
  onSelectEquipment,
}: EquipmentMaintenanceRadarProps) {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000);

  // Categorize equipment by SLA & Maintenance Urgency
  const underMaintenance = equipment.filter(
    (e) => e.status === "maintenance" || e.status === "offline",
  );

  const dueSoon = equipment.filter((e) => {
    if (e.status === "maintenance" || e.status === "offline") return false;
    if (!e.nextMaintenance || e.nextMaintenance === "N/A") return false;
    const due = new Date(e.nextMaintenance);
    return due <= thirtyDaysLater;
  });

  const calibrationTrack = equipment.filter(
    (e) => e.nextCalibration && e.nextCalibration !== "N/A",
  );

  const warrantyActive = equipment.filter(
    (e) => e.warrantyExpiry && e.warrantyExpiry !== "N/A",
  );

  return (
    <div className="space-y-6">
      {/* ─── Top Urgency Summary Banner ───────────────────────────────────── */}
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning-foreground dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
              Clinical Engineering Service Alert
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              <strong className="text-foreground">{underMaintenance.length}</strong> units currently in workshop repair ·{" "}
              <strong className="text-foreground">{dueSoon.length}</strong> units scheduled for preventive service within 30 days.
            </p>
          </div>
        </div>
      </div>

      {/* ─── 4 Radar Columns ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Column 1: Workshop & In-Progress Service */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-clinical-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-warning animate-pulse" />
              <h3 className="font-display font-extrabold text-sm text-foreground">
                In Workshop / Repair
              </h3>
            </div>
            <span className="font-mono text-xs font-bold text-warning-foreground dark:text-amber-400 bg-warning/10 px-2 py-0.5 rounded-md">
              {underMaintenance.length}
            </span>
          </div>

          {underMaintenance.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/10 rounded-xl">
              Zero active repair tickets. All units operational.
            </div>
          ) : (
            <div className="space-y-3">
              {underMaintenance.map((eq) => (
                <motion.div
                  key={eq.id}
                  whileHover={{ y: -2 }}
                  onClick={() => onSelectEquipment(eq)}
                  className="cursor-pointer p-3.5 rounded-xl border border-warning/30 bg-warning/5 hover:border-warning/60 transition-all space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground">
                      {eq.id}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-[9px] font-extrabold uppercase text-warning-foreground dark:text-amber-400">
                      {eq.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-foreground truncate">
                    {eq.name}
                  </h4>
                  <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>{eq.department}</span>
                    <span className="font-semibold text-foreground">{eq.location}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Scheduled in Next 30 Days */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-clinical-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="font-display font-extrabold text-sm text-foreground">
                Preventive (Next 30 Days)
              </h3>
            </div>
            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
              {dueSoon.length}
            </span>
          </div>

          {dueSoon.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/10 rounded-xl">
              No preventive maintenance due in next 30 days.
            </div>
          ) : (
            <div className="space-y-3">
              {dueSoon.map((eq) => (
                <motion.div
                  key={eq.id}
                  whileHover={{ y: -2 }}
                  onClick={() => onSelectEquipment(eq)}
                  className="cursor-pointer p-3.5 rounded-xl border border-border/80 bg-background/60 hover:border-primary/40 hover:bg-card transition-all space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground">
                      {eq.id}
                    </span>
                    <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {eq.nextMaintenance}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-foreground truncate">
                    {eq.name}
                  </h4>
                  <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>{eq.manufacturer}</span>
                    <span>{eq.assignedWard}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Column 3: ISO Metrology & Calibration */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-clinical-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <h3 className="font-display font-extrabold text-sm text-foreground">
                ISO Calibration Ledger
              </h3>
            </div>
            <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
              {calibrationTrack.length}
            </span>
          </div>

          <div className="space-y-3">
            {calibrationTrack.slice(0, 5).map((eq) => (
              <motion.div
                key={eq.id}
                whileHover={{ y: -2 }}
                onClick={() => onSelectEquipment(eq)}
                className="cursor-pointer p-3.5 rounded-xl border border-border/80 bg-background/60 hover:border-purple-500/40 hover:bg-card transition-all space-y-2"
              >
                <div className="flex justify-between items-start">
                  <span className="font-mono text-[10px] font-bold text-muted-foreground">
                    {eq.id}
                  </span>
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                    Next: {eq.nextCalibration}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-foreground truncate">
                  {eq.name}
                </h4>
                <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>ISO 80601 Certified</span>
                  <span>{eq.department}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
