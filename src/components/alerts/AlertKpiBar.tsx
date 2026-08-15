import { motion } from "framer-motion";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { AlertTriangle, ShieldAlert, CheckCircle2, BellRing } from "lucide-react";
import type { CentralAlertStats } from "@/lib/types";

export interface AlertKpiBarProps {
  stats: CentralAlertStats;
}

export function AlertKpiBar({ stats }: AlertKpiBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
    >
      <KpiTile
        label="Active Alerts"
        value={stats.active}
        delta={`${stats.total} Total Detected`}
        icon={BellRing}
        tone={stats.active > 0 ? "warning" : "default"}
      />

      <KpiTile
        label="Critical Priority"
        value={stats.critical}
        delta={stats.critical > 0 ? "Immediate Action Required" : "Zero Critical"}
        icon={ShieldAlert}
        tone={stats.critical > 0 ? "destructive" : "success"}
      />

      <KpiTile
        label="Acknowledged"
        value={stats.acknowledged}
        delta="Under Active Investigation"
        icon={AlertTriangle}
        tone="default"
      />

      <KpiTile
        label="Resolved Today"
        value={stats.resolvedToday}
        delta="Incidents Cleared"
        icon={CheckCircle2}
        tone="success"
      />
    </motion.div>
  );
}
