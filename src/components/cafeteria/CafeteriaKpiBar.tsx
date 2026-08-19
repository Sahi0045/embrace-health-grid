import { motion } from "framer-motion";
import {
  UtensilsCrossed,
  ChefHat,
  Truck,
  HeartPulse,
  AlertTriangle,
  TrendingDown,
  Building2,
  Apple,
  Sparkles,
  Flame,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { DonutChart, DonutDataItem } from "@/components/dashboard/MiniChart";
import { Sparkline } from "@/components/dashboard/Sparkline";
import type { CafeteriaDashboardStats, CafeteriaMenuItem, FoodWastageLog } from "@/lib/types";

interface CafeteriaKpiBarProps {
  stats: CafeteriaDashboardStats;
  menu?: CafeteriaMenuItem[];
  wastage?: FoodWastageLog[];
  activeCategory?: string;
  onSelectCategory?: (cat: string) => void;
}

const MEAL_CATEGORY_CONFIGS = [
  { id: "breakfast", name: "Breakfast", color: "#f59e0b" },
  { id: "lunch", name: "Lunch", color: "#3b82f6" },
  { id: "dinner", name: "Dinner", color: "#8b5cf6" },
  { id: "snack", name: "Snacks", color: "#10b981" },
  { id: "beverage", name: "Beverages", color: "#ec4899" },
];

export function CafeteriaKpiBar({
  stats,
  menu = [],
  wastage = [],
  activeCategory,
  onSelectCategory,
}: CafeteriaKpiBarProps) {
  // Count menu categories
  const categoryCounts: Record<string, number> = {};
  for (const c of MEAL_CATEGORY_CONFIGS) {
    categoryCounts[c.id] = menu.filter((m) => m.category === c.id).length;
  }

  const totalMeals = menu.length || 1;

  const donutData: DonutDataItem[] = MEAL_CATEGORY_CONFIGS.map((c) => ({
    name: c.name,
    value: categoryCounts[c.id] || 0,
    color: c.color,
  }));

  // Sparkline data for 7-day wastage trend
  const wastageSparklineData =
    wastage.length >= 5
      ? wastage
          .slice(0, 10)
          .map((w) => w.quantity_wasted)
          .reverse()
      : [14.2, 12.8, 15.5, 11.2, 9.8, 8.4, stats.todayWastageKg || 7.2];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
      {/* 1. Left Bento Hero Deck: Menu Portfolio & Category Distribution (7 cols) */}
      <div className="lg:col-span-7 flex flex-col">
        <GlowCard
          accent="primary"
          className="p-6 md:p-7 flex flex-col justify-between h-full space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-xs">
                <UtensilsCrossed className="h-5.5 w-5.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                    Food Service & Dietary Matrix
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-extrabold text-success border border-success/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    LIVE KITCHEN TELEMETRY
                  </span>
                </div>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">
                  Nutritional catalog, dietary compliance & smart meal delivery dispatch
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <div className="text-right">
                <p className="text-[11px] font-medium text-muted-foreground">Catalog Volume</p>
                <p className="text-lg font-black text-foreground tracking-tight">
                  {menu.length || stats.activeMenuItems} Meals
                </p>
              </div>
            </div>
          </div>

          {/* Donut Chart & Category Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center flex-1">
            {/* Donut Chart */}
            <div className="sm:col-span-5 flex flex-col items-center justify-center py-2">
              <DonutChart
                data={donutData}
                centerLabel={menu.length.toString()}
                centerSublabel="Total Meals"
                height={175}
                innerRadius={50}
                outerRadius={70}
              />
            </div>

            {/* Category List */}
            <div className="sm:col-span-7 flex flex-col justify-center space-y-1.5">
              {MEAL_CATEGORY_CONFIGS.map((cat) => {
                const count = categoryCounts[cat.id] || 0;
                const percentage = Math.round((count / totalMeals) * 100);
                const isSelected = activeCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onSelectCategory?.(isSelected ? "all" : cat.id)}
                    className={`group w-full flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary shadow-xs ring-2 ring-primary/20"
                        : "border-border/60 bg-background/60 hover:bg-muted/40 hover:border-border text-foreground hover:shadow-clinical-xs"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-xs font-bold truncate group-hover:text-primary transition-colors">
                        {cat.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {percentage}%
                      </span>
                      <span className="rounded-lg bg-muted px-2 py-0.5 text-xs font-extrabold text-foreground min-w-[28px] text-center border border-border/40">
                        {count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom highlight badges */}
          <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-border/60 text-center">
            <div className="p-2.5 rounded-xl bg-background/60 border border-border/60 shadow-clinical-xs">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Patient Plans
              </p>
              <p className="text-sm font-black text-primary mt-0.5">
                {stats.activeDietaryPlans} Active
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-background/60 border border-border/60 shadow-clinical-xs">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Avg Rating
              </p>
              <p className="text-sm font-black text-amber-500 mt-0.5">
                ⭐ {stats.averageMealRating}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-background/60 border border-border/60 shadow-clinical-xs">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Active Vendors
              </p>
              <p className="text-sm font-black text-emerald-500 mt-0.5">
                {stats.activeVendorsCount} Certified
              </p>
            </div>
          </div>
        </GlowCard>
      </div>

      {/* 2. Right Operational Metrics (5 cols: 2x2 grid) */}
      <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Metric 1: Pending Deliveries */}
        <GlowCard
          accent={stats.pendingDeliveries > 0 ? "warning" : "primary"}
          className="p-5 md:p-6 flex flex-col justify-between h-full space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Meal Dispatch
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 shadow-xs border border-amber-500/20">
              <Truck className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="my-1">
            <div className="text-3xl font-black text-foreground">{stats.pendingDeliveries}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Active delivery queue</p>
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-border/50 text-xs">
            <span className="text-muted-foreground">Delivered today:</span>
            <span className="font-bold text-emerald-500">{stats.deliveredToday} meals</span>
          </div>
        </GlowCard>

        {/* Metric 2: Dietary Care Compliance */}
        <GlowCard
          accent="success"
          className="p-5 md:p-6 flex flex-col justify-between h-full space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Dietary Plans
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 shadow-xs border border-emerald-500/20">
              <HeartPulse className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="my-1">
            <div className="text-3xl font-black text-foreground">{stats.activeDietaryPlans}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Patient tailored diets</p>
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-border/50 text-xs">
            <span className="text-muted-foreground">Special diets:</span>
            <span className="font-bold text-primary">100% compliant</span>
          </div>
        </GlowCard>

        {/* Metric 3: Low Kitchen Stock Alerts */}
        <GlowCard
          accent={stats.lowKitchenStockCount > 0 ? "destructive" : "none"}
          className="p-5 md:p-6 flex flex-col justify-between h-full space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Kitchen Stock
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500 shadow-xs border border-rose-500/20">
              <ChefHat className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="my-1">
            <div className="text-3xl font-black text-foreground">{stats.lowKitchenStockCount}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Items needing restock</p>
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-border/50 text-xs">
            <span className="text-muted-foreground">Pantry status:</span>
            <span
              className={`font-bold ${stats.lowKitchenStockCount > 0 ? "text-rose-500" : "text-emerald-500"}`}
            >
              {stats.lowKitchenStockCount > 0 ? "Action Required" : "Optimal"}
            </span>
          </div>
        </GlowCard>

        {/* Metric 4: Daily Wastage & Reduction Sparkline */}
        <GlowCard
          accent="primary"
          className="p-5 md:p-6 flex flex-col justify-between h-full space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Food Wastage
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-500 shadow-xs border border-purple-500/20">
              <TrendingDown className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="my-1 flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-black text-foreground">
                {stats.todayWastageKg}{" "}
                <span className="text-sm font-bold text-muted-foreground">kg</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Recorded today</p>
            </div>
            <div className="w-20">
              <Sparkline data={wastageSparklineData} tone="primary" height={32} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-border/50 text-xs">
            <span className="text-muted-foreground">Waste reduction:</span>
            <span className="font-bold text-emerald-500">-18% vs target</span>
          </div>
        </GlowCard>
      </div>
    </div>
  );
}
