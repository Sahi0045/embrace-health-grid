import { motion } from "framer-motion";
import {
  Package,
  AlertTriangle,
  Clock,
  MapPin,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
} from "lucide-react";
import { GradientProgress } from "@/components/dashboard/GradientProgress";
import type { InventoryItem, InventoryCategory } from "@/lib/types";

export interface InventoryItemCardProps {
  item: InventoryItem;
  category?: InventoryCategory;
  onSelect: (item: InventoryItem) => void;
}

export function InventoryItemCard({ item, category, onSelect }: InventoryItemCardProps) {
  // Calculate availability
  const availableStock = Math.max(0, item.current_stock - item.reserved_stock);
  const stockPercentage = Math.min(
    100,
    Math.round((item.current_stock / (item.reorder_level * 3 || 100)) * 100),
  );

  // Status Tone Determination
  const isCritical = item.status === "critical" || item.current_stock === 0;
  const isLowStock = item.status === "low_stock" || item.current_stock <= item.reorder_level;

  let tone: "primary" | "success" | "warning" | "destructive" = "success";
  if (isCritical) {
    tone = "destructive";
  } else if (isLowStock) {
    tone = "warning";
  }

  // Expiry calculation
  const now = new Date();
  const expiryDate = item.expiry_date ? new Date(item.expiry_date) : null;
  const daysToExpiry = expiryDate
    ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isNearExpiry = daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry > 0;
  const isExpired = daysToExpiry !== null && daysToExpiry <= 0;

  // Format Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <motion.div
      data-spotlight-id={item.item_id}
      data-id={item.item_id}
      id={item.item_id}
      whileHover={{ y: -4, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      onClick={() => onSelect(item)}
      className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-clinical-sm hover:border-primary/40 hover:shadow-clinical-md transition-all cursor-pointer overflow-hidden space-y-4"
    >
      {/* Top Row: Category Pill & Status Badge */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase truncate max-w-[170px]"
          style={{
            borderColor: `${category?.color_code || "#3b82f6"}40`,
            backgroundColor: `${category?.color_code || "#3b82f6"}10`,
            color: category?.color_code || "var(--color-primary)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: category?.color_code || "#3b82f6" }}
          />
          <span className="truncate">{category?.name || item.category_id}</span>
        </span>

        {/* Status Indicator Pill */}
        {isCritical ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 border border-destructive/30 px-2 py-0.5 text-[10px] font-extrabold text-destructive uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            Critical
          </span>
        ) : isLowStock ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 border border-warning/30 px-2 py-0.5 text-[10px] font-extrabold text-warning-foreground uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Low Stock
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/30 px-2 py-0.5 text-[10px] font-extrabold text-success uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Normal
          </span>
        )}
      </div>

      {/* Item Title & SKU */}
      <div className="space-y-1">
        <h3 className="font-display font-extrabold text-base text-foreground tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
          {item.name}
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-[11px] font-bold text-muted-foreground bg-muted/50 rounded-md px-1.5 py-0.5">
            {item.sku}
          </span>
          {item.unit_cost > 0 && (
            <span className="text-[11px] font-semibold text-muted-foreground">
              • {formatCurrency(item.unit_cost)} / {item.unit}
            </span>
          )}
        </div>
      </div>

      {/* Stock Level Display & Progress */}
      <div className="space-y-2 bg-background/60 rounded-xl p-3 border border-border/60">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-extrabold font-display ${
                isCritical
                  ? "text-destructive"
                  : isLowStock
                    ? "text-warning-foreground"
                    : "text-foreground"
              }`}
            >
              {item.current_stock}
            </span>
            <span className="text-xs font-bold text-muted-foreground uppercase">
              {item.unit} in stock
            </span>
          </div>

          <div className="text-[11px] font-medium text-muted-foreground">
            Reorder at{" "}
            <span className="font-bold font-mono text-foreground">{item.reorder_level}</span>
          </div>
        </div>

        <GradientProgress value={stockPercentage} tone={tone} height={6} />

        <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground pt-0.5">
          <span>
            Available: <strong className="text-foreground font-mono">{availableStock}</strong>
          </span>
          <span>
            Reserved: <strong className="text-foreground font-mono">{item.reserved_stock}</strong>
          </span>
        </div>
      </div>

      {/* Expiry & Meta Details */}
      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60">
        <div className="flex items-center gap-1.5 min-w-0 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          <span className="truncate text-[11px] font-medium">
            {item.storage_location || "Central Storage"}
          </span>
        </div>

        <div className="flex items-center justify-end gap-1.5 min-w-0">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          {isExpired ? (
            <span className="text-[11px] font-extrabold text-destructive">Expired</span>
          ) : isNearExpiry ? (
            <span className="text-[11px] font-extrabold text-warning-foreground">
              Exp in {daysToExpiry}d
            </span>
          ) : (
            <span className="text-[11px] font-medium text-muted-foreground truncate">
              {item.expiry_date || "No expiry"}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
