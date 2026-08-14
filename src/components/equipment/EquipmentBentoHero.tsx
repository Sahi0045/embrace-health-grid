import {
  Cpu,
  CheckCircle2,
  Activity,
  AlertTriangle,
  XCircle,
  Zap,
  ShieldCheck,
  Radio,
  Sparkles,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { motion } from "framer-motion";
import type { EquipmentRecord, EquipmentStatus } from "@/lib/types";

export interface EquipmentKpiStats {
  total: number;
  operational: number;
  inUse: number;
  maintenance: number;
  offline: number;
  avgUtilization: number;
}

interface EquipmentBentoHeroProps {
  stats: EquipmentKpiStats;
  equipment?: EquipmentRecord[];
  activeFilter?: string;
  onSelectStatus?: (status: any) => void;
  className?: string;
}

export function EquipmentBentoHero({
  stats,
  equipment = [],
  activeFilter = "all",
  onSelectStatus,
  className = "",
}: EquipmentBentoHeroProps) {
  const operationalPlusInUse = stats.operational + stats.inUse;
  const readinessRate =
    stats.total > 0 ? Math.round((operationalPlusInUse / stats.total) * 100) : 0;

  // Department Load calculations
  const departments = [
    { name: "Radiology & Imaging", key: "radiology", tone: "primary", icon: Radio },
    { name: "Intensive Care (ICU)", key: "icu", tone: "cyan", icon: Activity },
    { name: "Emergency & Trauma", key: "emergency", tone: "amber", icon: Zap },
    { name: "Surgery & OR Wings", key: "surgery", tone: "indigo", icon: Layers },
    { name: "Renal & Outpatient", key: "outpatient", tone: "emerald", icon: ShieldCheck },
  ];

  const deptMetrics = departments.map((dept) => {
    const deptItems = equipment.filter(
      (e) =>
        (e.department || "").toLowerCase().includes(dept.key) ||
        (dept.key === "radiology" && (e.type === "mri" || e.type === "ct" || e.type === "xray")) ||
        (dept.key === "icu" && e.type === "ventilator") ||
        (dept.key === "emergency" && e.type === "defibrillator") ||
        (dept.key === "surgery" && e.type === "infusion") ||
        (dept.key === "outpatient" && (e.type === "ecg" || e.type === "dialysis")),
    );
    const avgLoad =
      deptItems.length > 0
        ? Math.round(deptItems.reduce((acc, curr) => acc + (curr.utilization || 0), 0) / deptItems.length)
        : 65;
    return { ...dept, count: deptItems.length || 1, avgLoad };
  });

  const pods = [
    {
      id: "operational",
      label: "Operational Standby",
      count: stats.operational,
      delta: stats.operational > 0 ? "Ready to Deploy" : "0 Standby",
      icon: CheckCircle2,
      tone: "success" as const,
      sparkline: [2, 4, 3, 5, 4, stats.operational],
      active: activeFilter === "operational",
    },
    {
      id: "in-use",
      label: "In Active Stream",
      count: stats.inUse,
      delta: `${stats.avgUtilization}% Live Load`,
      icon: Activity,
      tone: "cyan" as const,
      sparkline: [3, 5, 4, 6, 7, stats.inUse],
      active: activeFilter === "in-use",
    },
    {
      id: "maintenance",
      label: "Under Maintenance",
      count: stats.maintenance,
      delta: stats.maintenance > 0 ? "In Workshop" : "Healthy Fleet",
      icon: AlertTriangle,
      tone: "warning" as const,
      sparkline: [1, 2, 1, 3, 2, stats.maintenance],
      active: activeFilter === "maintenance",
    },
    {
      id: "offline",
      label: "Offline Buffer",
      count: stats.offline,
      delta: stats.offline > 0 ? "Staged Storage" : "0 Offline",
      icon: XCircle,
      tone: "destructive" as const,
      sparkline: [0, 1, 0, 1, 0, stats.offline],
      active: activeFilter === "offline",
    },
  ];

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-5 ${className}`}>
      {/* ─── LEFT: Fleet Vitality & Telemetry Command Hub (7 Cols) ────────── */}
      <div className="lg:col-span-7 rounded-2xl border border-border/80 bg-card p-6 shadow-clinical-sm relative overflow-hidden flex flex-col justify-between">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div>
          {/* Header Row */}
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  Biomedical Asset Operations
                </span>
                <h3 className="text-lg font-extrabold font-display text-foreground tracking-tight flex items-center gap-2">
                  <span>Fleet Vitality & Telemetry Deck</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-extrabold text-success border border-success/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    LIVE
                  </span>
                </h3>
              </div>
            </div>

            <button
              onClick={() => onSelectStatus && onSelectStatus("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all border ${
                activeFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-background border-border/80 text-muted-foreground hover:text-foreground"
              }`}
            >
              View All ({stats.total})
            </button>
          </div>

          {/* Hero Gauge & Stats Split */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
            {/* Circular Vitality Gauge (5 cols) - Clean Seamless Layout Without Inner Box */}
            <div className="sm:col-span-5 flex flex-col items-center justify-center p-2 relative">
              <div className="relative flex items-center justify-center">
                {/* SVG Radial Meter */}
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="52"
                    className="stroke-muted/40"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <motion.circle
                    cx="64"
                    cy="64"
                    r="52"
                    className="stroke-primary"
                    strokeWidth="10"
                    strokeDasharray={326.7}
                    initial={{ strokeDashoffset: 326.7 }}
                    animate={{
                      strokeDashoffset: 326.7 - (326.7 * readinessRate) / 100,
                    }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-extrabold font-display text-foreground tracking-tight">
                    {readinessRate}%
                  </span>
                  <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">
                    Readiness
                  </span>
                </div>
              </div>

              <div className="mt-2 text-center">
                <span className="text-xs font-bold text-foreground">
                  {operationalPlusInUse} of {stats.total} Active Units
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Operational & Clinical Stream
                </p>
              </div>
            </div>

            {/* Department Load Distribution Telemetry (7 cols) */}
            <div className="sm:col-span-7 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground mb-1">
                <span className="uppercase tracking-wider">Departmental Workload</span>
                <span>Live Average: {stats.avgUtilization}%</span>
              </div>

              {deptMetrics.map((dept) => {
                const getBarColor = (val: number) => {
                  if (val >= 85) return "bg-rose-500";
                  if (val >= 65) return "bg-blue-500";
                  return "bg-emerald-500";
                };

                return (
                  <div key={dept.name} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-foreground truncate max-w-[170px]">
                        {dept.name}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-muted-foreground">
                        {dept.avgLoad}% load
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${dept.avgLoad}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-full rounded-full ${getBarColor(dept.avgLoad)}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Horizontal Quick Metrics */}
        <div className="mt-6 pt-4 border-t border-border/60 grid grid-cols-3 gap-2 text-center">
          <div className="px-2">
            <div className="text-lg font-extrabold font-display text-foreground">
              {stats.total}
            </div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Total Assets
            </div>
          </div>
          <div className="px-2 border-x border-border/60">
            <div className="text-lg font-extrabold font-display text-cyan-600 dark:text-cyan-400">
              {stats.inUse}
            </div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              In Live Use
            </div>
          </div>
          <div className="px-2">
            <div className="text-lg font-extrabold font-display text-warning-foreground dark:text-amber-400">
              {stats.maintenance}
            </div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Service Queue
            </div>
          </div>
        </div>
      </div>

      {/* ─── RIGHT: 4 Segmented Interactive Telemetry Pods (5 Cols) - Inventory Style ─────── */}
      <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        {pods.map((pod) => {
          const Icon = pod.icon;
          const isSelected = pod.active;

          const toneStyles = {
            success: {
              iconBg: "bg-success/15 text-success dark:bg-success/25 dark:text-success",
              glowBorder: isSelected
                ? "border-success ring-2 ring-success/30 shadow-clinical-sm bg-success/5"
                : "border-border/80 hover:border-success/40 bg-card",
              accentDot: "bg-success",
              sparkTone: "success" as const,
              deltaColor: "text-success",
            },
            default: {
              iconBg: "bg-primary/15 text-primary dark:bg-primary/25 dark:text-primary-foreground",
              glowBorder: isSelected
                ? "border-primary ring-2 ring-primary/30 shadow-clinical-sm bg-primary/5"
                : "border-border/80 hover:border-primary/40 bg-card",
              accentDot: "bg-primary",
              sparkTone: "primary" as const,
              deltaColor: "text-primary",
            },
            warning: {
              iconBg: "bg-warning/20 text-warning-foreground dark:bg-warning/30 dark:text-warning-foreground",
              glowBorder: isSelected
                ? "border-warning ring-2 ring-warning/30 shadow-clinical-sm bg-warning/5"
                : "border-border/80 hover:border-warning/40 bg-card",
              accentDot: "bg-warning",
              sparkTone: "warning" as const,
              deltaColor: "text-warning-foreground dark:text-amber-400",
            },
            destructive: {
              iconBg: "bg-destructive/15 text-destructive dark:bg-destructive/25 dark:text-destructive",
              glowBorder: isSelected
                ? "border-destructive ring-2 ring-destructive/30 shadow-clinical-sm bg-destructive/5"
                : "border-border/80 hover:border-destructive/40 bg-card",
              accentDot: "bg-destructive",
              sparkTone: "destructive" as const,
              deltaColor: "text-destructive",
            },
          }[pod.tone === "cyan" ? "default" : pod.tone];

          return (
            <motion.div
              key={pod.id}
              whileHover={{ y: -4, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              onClick={() => onSelectStatus && onSelectStatus(pod.id)}
              className={`group relative overflow-hidden rounded-2xl border p-5 shadow-clinical transition-all cursor-pointer flex flex-col justify-between ${toneStyles.glowBorder}`}
            >
              {/* Background Ambient Glow Spot */}
              <div
                className={`absolute -top-12 -right-12 h-28 w-28 rounded-full blur-2xl opacity-15 transition-opacity duration-300 group-hover:opacity-30 pointer-events-none ${toneStyles.accentDot}`}
              />

              {/* Top Header: Dot + Label & Icon on Top-Right */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${toneStyles.accentDot}`} />
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90 truncate">
                    {pod.label}
                  </span>
                </div>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 shadow-sm ${toneStyles.iconBg}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              {/* Main Stat & Delta Subtext */}
              <div className="relative z-10 space-y-1 my-2">
                <div className="flex items-baseline justify-between gap-2">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="text-3xl font-extrabold tracking-tight text-foreground font-display"
                  >
                    {pod.count}
                  </motion.div>
                  <span className={`text-xs font-semibold ${toneStyles.deltaColor} truncate max-w-[130px] text-right`}>
                    {pod.delta}
                  </span>
                </div>
              </div>

              {/* Full Width Bottom Sparkline Graph */}
              <div className="relative z-10 pt-1 -mb-1">
                <Sparkline data={pod.sparkline} tone={toneStyles.sparkTone} height={34} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
