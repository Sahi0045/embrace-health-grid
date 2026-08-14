import {
  Ambulance,
  CheckCircle2,
  Navigation,
  AlertTriangle,
  RotateCcw,
  Wrench,
  Radio,
  ShieldCheck,
  Activity,
  Users,
  Layers,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import type { AmbulanceRecord } from "@/lib/types";

export interface AmbulanceKpiStats {
  total: number;
  available: number;
  enRoute: number;
  atScene: number;
  returning: number;
  maintenance: number;
}

interface AmbulanceKpiBarProps {
  stats: AmbulanceKpiStats;
  ambulances?: AmbulanceRecord[];
  activeFilter?: string;
  onSelectStatus?: (status: any) => void;
  className?: string;
}

export function AmbulanceKpiBar({
  stats,
  ambulances = [],
  activeFilter = "all",
  onSelectStatus,
  className = "",
}: AmbulanceKpiBarProps) {
  const readinessRate = stats.total > 0 ? Math.round((stats.available / stats.total) * 100) : 0;
  const onMissionCount = stats.enRoute + stats.atScene + stats.returning;

  // Real data calculations derived directly from live database records
  const assignedCrewCount = ambulances.filter(
    (a) => a.driver && a.driver !== "Unassigned" && a.driver.trim().length > 0,
  ).length;
  const crewStaffingRate =
    stats.total > 0 ? Math.round((assignedCrewCount / stats.total) * 100) : 0;

  const alsFleetCount = ambulances.filter(
    (a) => (a.type || "").toLowerCase() === "als",
  ).length;
  const blsFleetCount = ambulances.filter(
    (a) => (a.type || "").toLowerCase() === "bls",
  ).length;

  const pipelineStages = [
    {
      key: "available",
      step: "01",
      title: "Ready at Base",
      count: stats.available,
      icon: CheckCircle2,
      dotCls: "bg-success animate-pulse",
      badgeCls: "bg-success/15 text-success border-success/30",
      activeCls: "border-success ring-2 ring-success/30 bg-success/5 shadow-clinical-sm",
      hoverCls: "hover:border-success/40",
      accentText: "text-success",
      subtext: "Standby in emergency bay",
    },
    {
      key: "en-route",
      step: "02",
      title: "Dispatched",
      count: stats.enRoute,
      icon: Navigation,
      dotCls: "bg-warning animate-pulse",
      badgeCls: "bg-warning/20 text-warning-foreground border-warning/30",
      activeCls: "border-warning ring-2 ring-warning/30 bg-warning/5 shadow-clinical-sm",
      hoverCls: "hover:border-warning/40",
      accentText: "text-warning-foreground",
      subtext: "In transit to incident",
    },
    {
      key: "at-scene",
      step: "03",
      title: "At Scene",
      count: stats.atScene,
      icon: AlertTriangle,
      dotCls: "bg-destructive animate-pulse",
      badgeCls: "bg-destructive/15 text-destructive border-destructive/30",
      activeCls: "border-destructive ring-2 ring-destructive/30 bg-destructive/5 shadow-clinical-sm",
      hoverCls: "hover:border-destructive/40",
      accentText: "text-destructive",
      subtext: "On-site patient care",
    },
    {
      key: "returning",
      step: "04",
      title: "Returning",
      count: stats.returning,
      icon: RotateCcw,
      dotCls: "bg-primary",
      badgeCls: "bg-primary/15 text-primary border-primary/30",
      activeCls: "border-primary ring-2 ring-primary/30 bg-primary/5 shadow-clinical-sm",
      hoverCls: "hover:border-primary/40",
      accentText: "text-primary",
      subtext: "Inbound to hospital",
    },
  ];

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch ${className}`}>
      {/* ─── Cột Trái (6 cols): Fleet Readiness & Capacity Command ─── */}
      <div className="lg:col-span-6 flex flex-col h-full">
        <GlowCard
          accent="primary"
          glowOnHover={false}
          className="p-6 flex flex-col justify-between h-full space-y-4 border-border/80"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-xs border border-primary/20">
                <Ambulance className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                  Emergency Readiness
                </div>
                <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                  Fleet Command Deck
                </h3>
              </div>
            </div>

            <Badge
              variant="outline"
              className="rounded-full border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-extrabold text-primary uppercase flex items-center gap-1.5 shrink-0"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Live Telemetry
            </Badge>
          </div>

          {/* Core Hero Gauge Block */}
          <div className="p-4 rounded-2xl border border-border/60 bg-background/80 shadow-xs flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-baseline gap-2.5">
                <span className="text-3xl sm:text-4xl font-extrabold font-display text-foreground">
                  {readinessRate}%
                </span>
                <span className="text-xs font-extrabold text-success px-2 py-0.5 rounded-md bg-success/10 border border-success/20">
                  {stats.available} of {stats.total} Ready
                </span>
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {readinessRate >= 50
                  ? "Sufficient standby units for immediate emergency dispatch."
                  : "High dispatch load — standby capacity is currently limited."}
              </p>
            </div>

            {/* Visual Ring Gauge */}
            <div className="relative flex items-center justify-center h-16 w-16 shrink-0">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-border/60"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <motion.path
                  initial={{ strokeDasharray: "0, 100" }}
                  animate={{ strokeDasharray: `${readinessRate}, 100` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="text-success"
                  strokeWidth="3"
                  strokeDasharray={`${readinessRate}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <ShieldCheck className="h-4.5 w-4.5 text-success" />
              </div>
            </div>
          </div>

          {/* Real Operational Metrics Derived from Database */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl border border-border/60 bg-background/60 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Fleet Fleet Types
                </div>
                <div className="text-xs font-bold text-foreground">
                  {alsFleetCount} ALS · {blsFleetCount} BLS
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-border/60 bg-background/60 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Crew Assignment
                </div>
                <div className="text-xs font-bold text-foreground">
                  {assignedCrewCount}/{stats.total} ({crewStaffingRate}%) Assigned
                </div>
              </div>
            </div>
          </div>

          {/* Multi-segmented Capacity Visual Bar + Status Legend */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              <span>Fleet Status Breakdown</span>
              <span className="font-mono">{stats.total} Registered Vehicles</span>
            </div>

            <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden flex gap-1 p-0.5">
              {stats.available > 0 && (
                <div
                  style={{ width: `${(stats.available / Math.max(1, stats.total)) * 100}%` }}
                  className="h-full bg-success rounded-full transition-all duration-500"
                />
              )}
              {stats.enRoute > 0 && (
                <div
                  style={{ width: `${(stats.enRoute / Math.max(1, stats.total)) * 100}%` }}
                  className="h-full bg-warning rounded-full transition-all duration-500"
                />
              )}
              {stats.atScene > 0 && (
                <div
                  style={{ width: `${(stats.atScene / Math.max(1, stats.total)) * 100}%` }}
                  className="h-full bg-destructive rounded-full transition-all duration-500"
                />
              )}
              {stats.returning > 0 && (
                <div
                  style={{ width: `${(stats.returning / Math.max(1, stats.total)) * 100}%` }}
                  className="h-full bg-primary rounded-full transition-all duration-500"
                />
              )}
              {stats.maintenance > 0 && (
                <div
                  style={{ width: `${(stats.maintenance / Math.max(1, stats.total)) * 100}%` }}
                  className="h-full bg-muted-foreground/40 rounded-full transition-all duration-500"
                />
              )}
            </div>

            {/* Micro Status Legend */}
            <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground pt-0.5">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Ready ({stats.available})
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" /> En-Route ({stats.enRoute})
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Scene ({stats.atScene})
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Inbound ({stats.returning})
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Bay ({stats.maintenance})
              </span>
            </div>
          </div>

          {/* Clean 3-Cell Metric Grid Footer */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60 text-center">
            <div className="p-2.5 rounded-xl bg-card border border-border/70 shadow-xs">
              <div className="text-lg font-extrabold font-display text-foreground">{stats.total}</div>
              <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mt-0.5">
                Total Fleet
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-border/70 shadow-xs">
              <div className="text-lg font-extrabold font-display text-warning-foreground">{onMissionCount}</div>
              <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mt-0.5">
                Active Missions
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-border/70 shadow-xs">
              <div className="text-lg font-extrabold font-display text-muted-foreground">{stats.maintenance}</div>
              <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mt-0.5">
                In Repair Bay
              </div>
            </div>
          </div>
        </GlowCard>
      </div>

      {/* ─── Cột Phải (6 cols): Spacious 2x2 Mission Lifecycle Matrix ─── */}
      <div className="lg:col-span-6 flex flex-col h-full">
        <GlowCard
          accent="none"
          glowOnHover={false}
          className="p-6 flex flex-col justify-between h-full space-y-4 border-border/80"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warning/15 text-warning-foreground shadow-xs border border-warning/20">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Dispatch Lifecycle
                </div>
                <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                  Emergency Mission Pipeline
                </h3>
              </div>
            </div>

            {activeFilter !== "all" && onSelectStatus && (
              <button
                type="button"
                onClick={() => onSelectStatus("all")}
                className="text-xs font-extrabold text-primary hover:underline"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* 2x2 Spacious Flow Matrix (Roomy, Clean & Fully Readable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {pipelineStages.map((stage) => {
              const Icon = stage.icon;
              const isSelected = activeFilter === stage.key;

              return (
                <div
                  key={stage.key}
                  onClick={() => onSelectStatus?.(isSelected ? "all" : stage.key)}
                  className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-2.5 ${
                    isSelected
                      ? stage.activeCls
                      : `border-border/80 bg-background/80 ${stage.hoverCls} hover:shadow-clinical-xs hover:border-border`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${stage.badgeCls}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-[10px] font-mono font-extrabold text-muted-foreground">
                        STAGE {stage.step}
                      </span>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${stage.dotCls}`} />
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-xs font-extrabold text-foreground tracking-tight">
                        {stage.title}
                      </div>
                      <div className={`text-2xl font-extrabold font-display ${stage.accentText}`}>
                        {stage.count}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                      {stage.subtext}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Dock: Maintenance Bay & Telemetry Sync */}
          <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div
              onClick={() => onSelectStatus?.(activeFilter === "maintenance" ? "all" : "maintenance")}
              className={`flex items-center gap-2.5 p-2.5 px-3.5 rounded-xl border cursor-pointer transition-all ${
                activeFilter === "maintenance"
                  ? "border-muted-foreground ring-2 ring-muted-foreground/30 bg-muted/40 shadow-xs"
                  : "border-border/80 bg-background/80 hover:border-border hover:bg-muted/30"
              }`}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Wrench className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="font-extrabold text-foreground">Maintenance Bay: </span>
                <span className="font-mono font-bold text-muted-foreground">
                  {stats.maintenance} units
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px] self-end sm:self-auto">
              <Radio className="h-3.5 w-3.5 text-success animate-pulse" />
              <span>Realtime GPS Synchronized</span>
            </div>
          </div>
        </GlowCard>
      </div>
    </div>
  );
}
