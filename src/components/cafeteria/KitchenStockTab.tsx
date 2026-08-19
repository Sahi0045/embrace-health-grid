import { motion } from "framer-motion";
import {
  Package,
  AlertTriangle,
  Clock,
  Building2,
  MapPin,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowDownRight,
  TrendingUp,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";
import type { KitchenStockItem } from "@/lib/types";

interface KitchenStockTabProps {
  stock: KitchenStockItem[];
}

export function KitchenStockTab({ stock }: KitchenStockTabProps) {
  if (stock.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Kitchen Pantry Stock Empty"
        description="No raw ingredients or kitchen supplies currently registered. Add ingredients or sync inventory to monitor stock levels."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
      {stock.map((item) => {
        const isLowStock = item.status === "low_stock" || item.quantity <= item.reorder_level;
        const isExpired = item.status === "expired";

        // Compute stock percentage relative to 2.5x reorder level
        const maxExpected = Math.max(item.reorder_level * 2.5, item.quantity, 1);
        const percent = Math.min(100, Math.round((item.quantity / maxExpected) * 100));

        // Format expiry
        const isNearExpiry = item.expiry_date
          ? new Date(item.expiry_date).getTime() - Date.now() < 7 * 24 * 3600 * 1000
          : false;

        return (
          <GlowCard
            key={item.stock_id}
            accent={isExpired ? "destructive" : isLowStock ? "warning" : "primary"}
            className="p-5 flex flex-col justify-between h-full bg-card border border-border/80 rounded-2xl shadow-clinical-xs transition-all hover:border-primary/40"
          >
            {/* Header: Name + Status Badge */}
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-border/60">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-foreground tracking-tight line-clamp-1">
                    {item.item_name}
                  </h4>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                    {item.category}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span>{item.storage_location || "Kitchen Cold Storage"}</span>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  isExpired
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : isLowStock
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                }`}
              >
                {isExpired ? (
                  <>
                    <AlertTriangle className="h-2.5 w-2.5" /> Expired
                  </>
                ) : isLowStock ? (
                  <>
                    <AlertTriangle className="h-2.5 w-2.5" /> Low Stock
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-2.5 w-2.5" /> Adequate
                  </>
                )}
              </span>
            </div>

            {/* Middle: Quantity Progress Bar */}
            <div className="my-3 space-y-1.5">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground font-medium">Current Stock:</span>
                <div className="text-right">
                  <span className="text-base font-black text-foreground">{item.quantity}</span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1">
                    {item.unit}
                  </span>
                </div>
              </div>

              {/* Progress track */}
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isExpired ? "bg-rose-500" : isLowStock ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                <span>
                  Reorder Point: {item.reorder_level} {item.unit}
                </span>
                <span>Unit Cost: ${item.unit_cost.toFixed(2)}</span>
              </div>
            </div>

            {/* Footer: Supplier & Expiry */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate text-[11px] font-medium">
                  {item.supplier || "Metro Wholesale Food"}
                </span>
              </div>

              {item.expiry_date && (
                <div
                  className={`flex items-center gap-1 text-[11px] font-semibold ${
                    isNearExpiry ? "text-rose-500 font-bold" : "text-muted-foreground"
                  }`}
                  title="Stock Expiration Date"
                >
                  <Calendar className="h-3 w-3" />
                  <span>{item.expiry_date}</span>
                </div>
              )}
            </div>
          </GlowCard>
        );
      })}
    </div>
  );
}
