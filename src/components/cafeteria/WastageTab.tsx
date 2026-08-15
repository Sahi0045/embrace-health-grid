import { motion } from "framer-motion";
import {
  Trash2,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  PieChart,
  User,
  Scale,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { DonutChart, DonutDataItem } from "@/components/dashboard/MiniChart";
import { GradientProgress } from "@/components/dashboard/GradientProgress";
import { EmptyState } from "@/components/EmptyState";
import type { FoodWastageLog } from "@/lib/types";

interface WastageTabProps {
  logs: FoodWastageLog[];
}

const REASON_CONFIGS: Record<string, { label: string; color: string; bg: string }> = {
  overproduction: { label: "Overproduction", color: "#f59e0b", bg: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  spoilage: { label: "Spoilage", color: "#ef4444", bg: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  unconsumed_tray: { label: "Unconsumed Tray", color: "#3b82f6", bg: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  expired_stock: { label: "Expired Stock", color: "#8b5cf6", bg: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  damaged: { label: "Prep Damage", color: "#6b7280", bg: "bg-muted text-muted-foreground border-border/60" },
};

export function WastageTab({ logs }: WastageTabProps) {
  // Aggregate stats
  const totalWastedKg = logs.reduce((sum, l) => sum + l.quantity_wasted, 0);
  const totalCostImpact = logs.reduce((sum, l) => sum + l.cost_impact, 0);

  // Group by reason for donut chart
  const reasonCounts: Record<string, number> = {};
  for (const log of logs) {
    reasonCounts[log.reason] = (reasonCounts[log.reason] || 0) + log.quantity_wasted;
  }

  const donutData: DonutDataItem[] = Object.keys(REASON_CONFIGS).map((reasonKey) => ({
    name: REASON_CONFIGS[reasonKey].label,
    value: Math.round((reasonCounts[reasonKey] || 0) * 10) / 10,
    color: REASON_CONFIGS[reasonKey].color,
  }));

  // Target reduction goal: 75% achieved towards hospital sustainability target
  const sustainabilityGoalPercent = 82;

  return (
    <div className="space-y-6">
      {/* 1. Top Analytics Deck: Sustainability & Reason Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Left Hero Card: Sustainability Target & Totals (7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <GlowCard accent="primary" className="p-5 sm:p-6 bg-card border border-border/80 rounded-2xl shadow-clinical-md flex flex-col justify-between h-full">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-xs">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground tracking-tight">
                    Food Waste & Sustainability Target
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Monitoring prep loss, tray returns, and hospital carbon offset
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                -18% MoM
              </span>
            </div>

            {/* Middle: Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
              <div className="p-3 rounded-xl bg-background border border-border/60">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Total Logged Weight</p>
                <div className="text-xl font-black text-foreground mt-1">
                  {Math.round(totalWastedKg * 10) / 10} <span className="text-xs text-muted-foreground font-bold">kg</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-background border border-border/60">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Estimated Cost Impact</p>
                <div className="text-xl font-black text-rose-500 mt-1">
                  ${totalCostImpact.toFixed(2)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-background border border-border/60 col-span-2 sm:col-span-1">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Logs Recorded</p>
                <div className="text-xl font-black text-foreground mt-1">
                  {logs.length} <span className="text-xs text-muted-foreground font-bold">entries</span>
                </div>
              </div>
            </div>

            {/* Sustainability Goal Progress Bar */}
            <div className="pt-3 border-t border-border/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">Zero-Waste Hospital Target Compliance</span>
                <span className="font-extrabold text-emerald-500">{sustainabilityGoalPercent}% On Track</span>
              </div>
              <GradientProgress value={sustainabilityGoalPercent} tone="success" height={10} />
            </div>
          </GlowCard>
        </div>

        {/* Right Donut Chart: Wastage Breakdown by Reason (5 cols) */}
        <div className="lg:col-span-5 flex flex-col">
          <GlowCard accent="none" className="p-5 sm:p-6 bg-card border border-border/80 rounded-2xl shadow-clinical-md flex flex-col justify-between h-full">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Loss Factor Distribution
              </h4>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex items-center justify-center my-3">
              <DonutChart data={donutData} height={140} innerRadius={40} outerRadius={58} />
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-border/60 text-xs">
              {Object.keys(REASON_CONFIGS).map((reasonKey) => {
                const config = REASON_CONFIGS[reasonKey];
                const amount = Math.round((reasonCounts[reasonKey] || 0) * 10) / 10;
                return (
                  <div key={reasonKey} className="flex items-center justify-between p-1.5 rounded-lg bg-background/60 text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
                      <span className="truncate text-muted-foreground">{config.label}</span>
                    </div>
                    <span className="font-bold text-foreground ml-1">{amount}kg</span>
                  </div>
                );
              })}
            </div>
          </GlowCard>
        </div>
      </div>

      {/* 2. Wastage Daily Log Table */}
      <div className="bg-card border border-border/80 rounded-2xl shadow-clinical-sm overflow-hidden">
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-extrabold text-foreground">Daily Food Wastage Ledger</h4>
            <p className="text-xs text-muted-foreground">Detailed logs recorded by kitchen supervisors</p>
          </div>
          <span className="text-xs font-bold text-muted-foreground">{logs.length} Total Logs</span>
        </div>

        {logs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Trash2}
              title="No Food Wastage Logs"
              description="No wastage records have been logged yet for this period."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b border-border/60 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Meal Type</th>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Cost Impact</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.map((log) => {
                  const reasonConfig = REASON_CONFIGS[log.reason] || REASON_CONFIGS.overproduction;

                  return (
                    <tr key={log.log_id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-muted-foreground whitespace-nowrap">
                        {log.date}
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize font-bold text-foreground bg-muted px-2 py-0.5 rounded-md text-[11px]">
                          {log.meal_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">
                        {log.item_name}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-foreground whitespace-nowrap">
                        {log.quantity_wasted} <span className="text-[10px] text-muted-foreground">{log.unit}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-500 whitespace-nowrap">
                        ${log.cost_impact.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${reasonConfig.bg}`}>
                          {reasonConfig.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {log.logged_by}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
