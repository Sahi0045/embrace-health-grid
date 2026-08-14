import { motion } from "framer-motion";
import {
  Package,
  AlertTriangle,
  ShieldAlert,
  Clock,
  CircleDollarSign,
  Layers,
  ChevronRight,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { DonutChart, DonutDataItem } from "@/components/dashboard/MiniChart";
import type { InventoryCategory } from "@/lib/types";

export interface InventoryKpiStats {
  totalItems: number;
  lowStockCount: number;
  criticalCount: number;
  nearExpiryCount: number;
  reorderPendingCount: number;
  totalStockValuation: number;
  categoryBreakdown: Record<string, number>;
}

export interface InventoryKpiBarProps {
  stats: InventoryKpiStats;
  categories: InventoryCategory[];
  activeFilter?: string;
  onSelectCategory?: (categoryId: string) => void;
}

export function InventoryKpiBar({
  stats,
  categories,
  activeFilter,
  onSelectCategory,
}: InventoryKpiBarProps) {
  // Format Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Build Category Donut Chart Data
  const donutData: DonutDataItem[] = categories.map((cat) => ({
    name: cat.name,
    value: stats.categoryBreakdown[cat.category_id] || 0,
    color: cat.color_code || "#3b82f6",
  }));

  const totalItems = stats.totalItems || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
      {/* Hero Bento Card: Total Inventory Portfolio & Category Distribution */}
      <div className="lg:col-span-7 flex flex-col">
        <GlowCard className="p-6 md:p-7 flex flex-col justify-between h-full space-y-6">
          {/* Header Row */}
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-xs">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                  Hospital Supply Chain Matrix
                </h3>
                <p className="text-xs font-medium text-muted-foreground">
                  Active SKU catalog & category allocation index
                </p>
              </div>
            </div>
          </div>

          {/* Donut & Structured Category Breakdown Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center flex-1">
            {/* Donut Chart Column */}
            <div className="sm:col-span-5 flex flex-col items-center justify-center py-2">
              <DonutChart
                data={donutData}
                centerLabel={stats.totalItems.toString()}
                centerSublabel="Total SKUs"
                height={175}
                innerRadius={52}
                outerRadius={72}
              />
            </div>

            {/* Category Structured Grid List */}
            <div className="sm:col-span-7 flex flex-col justify-center space-y-1.5">
              {categories.map((cat) => {
                const count = stats.categoryBreakdown[cat.category_id] || 0;
                const percentage = Math.round((count / totalItems) * 100);
                const isSelected = activeFilter === cat.category_id;

                return (
                  <motion.button
                    key={cat.category_id}
                    type="button"
                    whileHover={{ x: 3 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    onClick={() => onSelectCategory && onSelectCategory(isSelected ? "all" : cat.category_id)}
                    className={`group w-full flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary shadow-xs ring-2 ring-primary/20"
                        : "border-border/60 bg-background/60 hover:bg-muted/40 hover:border-border text-foreground hover:shadow-clinical-xs"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.color_code }}
                      />
                      <span className="text-xs font-bold truncate group-hover:text-primary transition-colors">
                        {cat.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Mini Bar */}
                      <div className="w-12 h-1.5 rounded-full bg-muted/80 overflow-hidden hidden sm:block">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: cat.color_code,
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
                  </motion.button>
                );
              })}
            </div>
          </div>
        </GlowCard>
      </div>

      {/* KPI Quad: 4 Operational Tiles */}
      <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        <KpiTile
          label="Low Stock Alerts"
          value={stats.lowStockCount}
          tone="warning"
          icon={AlertTriangle}
          delta={stats.lowStockCount > 0 ? "Needs Reorder" : "Stock Healthy"}
          sparklineData={[4, 6, 8, 7, 10, stats.lowStockCount]}
          className="h-full"
        />

        <KpiTile
          label="Critical / Stockout"
          value={stats.criticalCount}
          tone="destructive"
          icon={ShieldAlert}
          delta={stats.criticalCount > 0 ? "Urgent Replenish" : "Zero Stockout"}
          sparklineData={[1, 3, 2, 4, 3, stats.criticalCount]}
          className="h-full"
        />

        <KpiTile
          label="Near Expiry (≤30d)"
          value={stats.nearExpiryCount}
          tone={stats.nearExpiryCount > 0 ? "warning" : "default"}
          icon={Clock}
          delta={stats.nearExpiryCount > 0 ? "Batch Rotation" : "All Batches Valid"}
          sparklineData={[2, 4, 3, 5, 4, stats.nearExpiryCount]}
          className="h-full"
        />

        <KpiTile
          label="Total Valuation"
          value={formatCurrency(stats.totalStockValuation)}
          tone="success"
          icon={CircleDollarSign}
          delta="Audited Live"
          sparklineData={[18000, 19500, 21000, 23000, 24000, stats.totalStockValuation]}
          className="h-full"
        />
      </div>
    </div>
  );
}
