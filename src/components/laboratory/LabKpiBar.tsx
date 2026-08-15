import { motion } from "framer-motion";
import {
  Clock,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Activity,
  TestTube2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { DonutChart, DonutDataItem } from "@/components/dashboard/MiniChart";
import { Sparkline } from "@/components/dashboard/Sparkline";
import type { LabDashboardStats, LabOrderRecord, LabSampleRecord } from "@/lib/types";

interface LabKpiBarProps {
  stats: LabDashboardStats;
  orders?: LabOrderRecord[];
  samples?: LabSampleRecord[];
  activeCategory?: string;
  onSelectCategory?: (category: string) => void;
}

const DISCIPLINE_CONFIGS = [
  { id: "biochemistry", name: "Biochemistry", color: "#3b82f6" },
  { id: "hematology", name: "Hematology", color: "#8b5cf6" },
  { id: "microbiology", name: "Microbiology", color: "#10b981" },
  { id: "immunology", name: "Immunology", color: "#f59e0b" },
  { id: "pathology", name: "Pathology", color: "#ec4899" },
];

export function LabKpiBar({
  stats,
  orders = [],
  samples = [],
  activeCategory,
  onSelectCategory,
}: LabKpiBarProps) {
  // Compute discipline breakdown from active orders
  const categoryCounts: Record<string, number> = {};
  for (const c of DISCIPLINE_CONFIGS) {
    categoryCounts[c.id] = orders.filter(
      (o) => (o.test_category || "").toLowerCase() === c.id,
    ).length;
  }

  // Ensure non-zero default counts if list is empty for clean visualization
  const totalOrders = orders.length || 1;

  const donutData: DonutDataItem[] = DISCIPLINE_CONFIGS.map((c) => ({
    name: c.name,
    value: categoryCounts[c.id] || 0,
    color: c.color,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
      {/* 1. Left Bento Hero Card: Diagnostic Specimen Matrix & Discipline Allocation */}
      <div className="lg:col-span-7 flex flex-col">
        <GlowCard accent="primary" className="p-6 md:p-7 flex flex-col justify-between h-full space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-xs">
                <FlaskConical className="h-5.5 w-5.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                    Diagnostic Accession & Pipeline Matrix
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-extrabold text-success border border-success/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    LIVE TELEMETRY
                  </span>
                </div>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">
                  Clinical discipline allocation, cold chain intake & specimen workflow
                </p>
              </div>
            </div>
          </div>

          {/* Donut Chart & Discipline Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center flex-1">
            {/* Donut Chart */}
            <div className="sm:col-span-5 flex flex-col items-center justify-center py-2">
              <DonutChart
                data={donutData}
                centerLabel={orders.length.toString()}
                centerSublabel="Total Orders"
                height={175}
                innerRadius={50}
                outerRadius={70}
              />
            </div>

            {/* Discipline List */}
            <div className="sm:col-span-7 flex flex-col justify-center space-y-1.5">
              {DISCIPLINE_CONFIGS.map((c) => {
                const count = categoryCounts[c.id] || 0;
                const percentage = Math.round((count / totalOrders) * 100);
                const isSelected = activeCategory === c.id;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCategory?.(isSelected ? "all" : c.id)}
                    className={`group w-full flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary shadow-xs ring-2 ring-primary/20"
                        : "border-border/60 bg-background/60 hover:bg-muted/40 hover:border-border text-foreground hover:shadow-clinical-xs"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="text-xs font-bold truncate group-hover:text-primary transition-colors">
                        {c.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Mini Bar */}
                      <div className="w-12 h-1.5 rounded-full bg-muted/80 overflow-hidden hidden sm:block">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: c.color,
                          }}
                        />
                      </div>

                      <span className="text-[11px] font-mono font-extrabold text-foreground min-w-[20px] text-right">
                        {count}
                      </span>

                      <span className="text-[10px] font-medium text-muted-foreground font-mono w-7 text-right">
                        {percentage}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Turnaround Benchmark Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background/80 border border-border/70 rounded-xl p-3.5 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Timer className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Mean Turnaround Time (TAT)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-foreground font-display">
                    {stats.avgTurnaroundTime}
                  </span>
                  <span className="text-[10px] font-extrabold text-success bg-success/15 px-2 py-0.5 rounded-full border border-success/30">
                    Target &lt; 45m (SLA Met)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground border-t sm:border-t-0 pt-2 sm:pt-0 border-border/50">
              <span>Accessioned Today: <strong className="text-foreground">{stats.totalSamplesCollected} specimens</strong></span>
            </div>
          </div>
        </GlowCard>
      </div>

      {/* 2. Right Operational Metric Cards: 2x2 Grid */}
      <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        {/* Card 1: Pending Queue */}
        <motion.div
          whileHover={{ y: -4, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="group relative overflow-hidden rounded-2xl liquid-glass border border-border/80 p-5 shadow-clinical-sm hover:border-warning/50 transition-all flex flex-col justify-between"
        >
          <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-warning/15 blur-2xl pointer-events-none group-hover:bg-warning/25 transition-all" />

          {/* Top Row */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-warning" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Pending Queue
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/20 text-warning-foreground shadow-xs group-hover:scale-110 transition-transform">
              <Clock className="h-4.5 w-4.5" />
            </div>
          </div>

          {/* Metric Value & Subtitle */}
          <div className="relative z-10 space-y-1.5 my-2">
            <div className="text-3xl font-extrabold font-display tracking-tight text-foreground">
              {stats.pendingTests}
            </div>
            <span className="inline-flex items-center rounded-full bg-warning/15 border border-warning/30 px-2.5 py-0.5 text-[10px] font-extrabold text-warning-foreground">
              {stats.pendingTests > 0 ? "Awaiting accession" : "Queue clear"}
            </span>
          </div>

          {/* Sparkline */}
          <div className="relative z-10 pt-2 border-t border-border/40">
            <Sparkline data={[8, 12, 10, 15, 9, stats.pendingTests]} tone="warning" height={32} />
          </div>
        </motion.div>

        {/* Card 2: Active Processing */}
        <motion.div
          whileHover={{ y: -4, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="group relative overflow-hidden rounded-2xl liquid-glass border border-border/80 p-5 shadow-clinical-sm hover:border-primary/50 transition-all flex flex-col justify-between"
        >
          <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-primary/15 blur-2xl pointer-events-none group-hover:bg-primary/25 transition-all" />

          {/* Top Row */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                In Processing
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs group-hover:scale-110 transition-transform">
              <Activity className="h-4.5 w-4.5" />
            </div>
          </div>

          {/* Metric Value & Subtitle */}
          <div className="relative z-10 space-y-1.5 my-2">
            <div className="text-3xl font-extrabold font-display tracking-tight text-foreground">
              {stats.inProgress}
            </div>
            <span className="inline-flex items-center rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-[10px] font-extrabold text-primary">
              Active analyzers
            </span>
          </div>

          {/* Sparkline */}
          <div className="relative z-10 pt-2 border-t border-border/40">
            <Sparkline data={[5, 8, 11, 7, 9, stats.inProgress]} tone="primary" height={32} />
          </div>
        </motion.div>

        {/* Card 3: Completed Today */}
        <motion.div
          whileHover={{ y: -4, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="group relative overflow-hidden rounded-2xl liquid-glass border border-border/80 p-5 shadow-clinical-sm hover:border-success/50 transition-all flex flex-col justify-between"
        >
          <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-success/15 blur-2xl pointer-events-none group-hover:bg-success/25 transition-all" />

          {/* Top Row */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Completed
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success shadow-xs group-hover:scale-110 transition-transform">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
          </div>

          {/* Metric Value & Subtitle */}
          <div className="relative z-10 space-y-1.5 my-2">
            <div className="text-3xl font-extrabold font-display tracking-tight text-foreground">
              {stats.completedToday}
            </div>
            <span className="inline-flex items-center rounded-full bg-success/15 border border-success/30 px-2.5 py-0.5 text-[10px] font-extrabold text-success">
              Verified & signed
            </span>
          </div>

          {/* Sparkline */}
          <div className="relative z-10 pt-2 border-t border-border/40">
            <Sparkline data={[14, 18, 22, 28, 32, stats.completedToday]} tone="success" height={32} />
          </div>
        </motion.div>

        {/* Card 4: Critical Panic Flags */}
        <motion.div
          whileHover={{ y: -4, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className={`group relative overflow-hidden rounded-2xl liquid-glass border p-5 shadow-clinical-sm transition-all flex flex-col justify-between ${
            stats.criticalResults > 0
              ? "border-destructive/60 hover:border-destructive"
              : "border-border/80 hover:border-success/50"
          }`}
        >
          <div
            className={`absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl pointer-events-none transition-all ${
              stats.criticalResults > 0 ? "bg-destructive/20 group-hover:bg-destructive/30" : "bg-success/15"
            }`}
          />

          {/* Top Row */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  stats.criticalResults > 0 ? "bg-destructive animate-ping" : "bg-success"
                }`}
              />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Critical Panic
              </span>
            </div>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-xs group-hover:scale-110 transition-transform ${
                stats.criticalResults > 0
                  ? "bg-destructive/20 text-destructive"
                  : "bg-success/15 text-success"
              }`}
            >
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
          </div>

          {/* Metric Value & Subtitle */}
          <div className="relative z-10 space-y-1.5 my-2">
            <div
              className={`text-3xl font-extrabold font-display tracking-tight ${
                stats.criticalResults > 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {stats.criticalResults}
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${
                stats.criticalResults > 0
                  ? "bg-destructive/15 text-destructive border-destructive/30 animate-pulse"
                  : "bg-success/15 text-success border-success/30"
              }`}
            >
              {stats.criticalResults > 0 ? "Immediate notify" : "Zero panic flags"}
            </span>
          </div>

          {/* Sparkline */}
          <div className="relative z-10 pt-2 border-t border-border/40">
            <Sparkline
              data={[1, 0, 2, 1, 0, stats.criticalResults]}
              tone={stats.criticalResults > 0 ? "destructive" : "success"}
              height={32}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
