import {
  Wrench,
  CheckCircle2,
  Activity,
  AlertTriangle,
  XCircle,
  Cpu,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import type { EquipmentRecord } from "@/lib/types";

export interface EquipmentKpiStats {
  total: number;
  operational: number;
  inUse: number;
  maintenance: number;
  offline: number;
  avgUtilization: number;
}

interface EquipmentKpiBarProps {
  stats: EquipmentKpiStats;
  equipment?: EquipmentRecord[];
  activeFilter?: string;
  onSelectStatus?: (status: any) => void;
  className?: string;
}

export function EquipmentKpiBar({
  stats,
  equipment = [],
  activeFilter = "all",
  onSelectStatus,
  className = "",
}: EquipmentKpiBarProps) {
  const operationalRate =
    stats.total > 0 ? Math.round(((stats.operational + stats.inUse) / stats.total) * 100) : 0;

  const sparklineHistorical = [
    stats.total - 2,
    stats.total - 1,
    stats.total,
    stats.total,
    stats.total + 1,
    stats.total,
  ];

  const cards = [
    {
      id: "all",
      label: "Total Equipment",
      value: stats.total,
      subValue: `${operationalRate}% Operational Readiness`,
      icon: Cpu,
      tone: "primary" as const,
      sparklineTone: "primary" as const,
      data: sparklineHistorical,
      active: activeFilter === "all",
    },
    {
      id: "operational",
      label: "Operational",
      value: stats.operational,
      subValue: "Standby & Available",
      icon: CheckCircle2,
      tone: "success" as const,
      sparklineTone: "success" as const,
      data: [stats.operational - 1, stats.operational, stats.operational + 1, stats.operational],
      active: activeFilter === "operational",
    },
    {
      id: "in-use",
      label: "In Active Clinical Use",
      value: stats.inUse,
      subValue: `Avg ${stats.avgUtilization}% Utilization`,
      icon: Activity,
      tone: "cyan" as const,
      sparklineTone: "primary" as const,
      data: [stats.inUse - 1, stats.inUse + 1, stats.inUse, stats.inUse],
      active: activeFilter === "in-use",
    },
    {
      id: "maintenance",
      label: "Under Maintenance",
      value: stats.maintenance,
      subValue: "Service / Calibration",
      icon: AlertTriangle,
      tone: "warning" as const,
      sparklineTone: "warning" as const,
      data: [stats.maintenance + 1, stats.maintenance, stats.maintenance],
      active: activeFilter === "maintenance",
    },
    {
      id: "offline",
      label: "Offline / Decommissioned",
      value: stats.offline,
      subValue: "Awaiting Biomedical Inspection",
      icon: XCircle,
      tone: "destructive" as const,
      sparklineTone: "destructive" as const,
      data: [stats.offline + 1, stats.offline, stats.offline],
      active: activeFilter === "offline",
    },
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Hero Banner + KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const isSelected = card.active;

          const toneStyles = {
            primary: {
              iconBg: "bg-primary/15 text-primary",
              border: isSelected
                ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                : "border-border/80 hover:border-primary/40",
              valueText: "text-foreground",
            },
            success: {
              iconBg: "bg-success/15 text-success",
              border: isSelected
                ? "border-success ring-2 ring-success/30 bg-success/5"
                : "border-border/80 hover:border-success/40",
              valueText: "text-foreground",
            },
            cyan: {
              iconBg: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
              border: isSelected
                ? "border-cyan-500 ring-2 ring-cyan-500/30 bg-cyan-500/5"
                : "border-border/80 hover:border-cyan-500/40",
              valueText: "text-foreground",
            },
            warning: {
              iconBg: "bg-warning/15 text-warning-foreground dark:text-amber-400",
              border: isSelected
                ? "border-warning ring-2 ring-warning/30 bg-warning/5"
                : "border-border/80 hover:border-warning/40",
              valueText: "text-foreground",
            },
            destructive: {
              iconBg: "bg-destructive/15 text-destructive",
              border: isSelected
                ? "border-destructive ring-2 ring-destructive/30 bg-destructive/5"
                : "border-border/80 hover:border-destructive/40",
              valueText: "text-foreground",
            },
          }[card.tone];

          return (
            <motion.div
              key={card.id}
              whileHover={{ y: -3, scale: 1.015 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              onClick={() => onSelectStatus && onSelectStatus(card.id)}
              className={`cursor-pointer rounded-2xl border p-4 sm:p-5 bg-card shadow-clinical-sm transition-all relative overflow-hidden flex flex-col justify-between ${toneStyles.border}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider block truncate">
                    {card.label}
                  </span>
                  <div className="mt-1 text-2xl sm:text-3xl font-extrabold font-display text-foreground tracking-tight">
                    {card.value}
                  </div>
                </div>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs ${toneStyles.iconBg}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground truncate">
                  {card.subValue}
                </span>
                <div className="w-14 h-5 shrink-0 opacity-80">
                  <Sparkline data={card.data} tone={card.sparklineTone} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
