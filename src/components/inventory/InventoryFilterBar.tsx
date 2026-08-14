import {
  Search,
  ArrowUpDown,
  Filter,
  Package,
  AlertTriangle,
  Clock,
  Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { InventoryCategory, InventoryStatus } from "@/lib/types";

export type InventoryStatusFilter = "all" | "normal" | "low_stock" | "critical" | "near_expiry" | "expired";

export interface InventoryFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (cat: string) => void;
  categories: InventoryCategory[];
  statusFilter: InventoryStatusFilter;
  onStatusFilterChange: (status: InventoryStatusFilter) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
  totalFilteredCount: number;
  statusCounts: Record<string, number>;
}

export function InventoryFilterBar({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
  totalFilteredCount,
  statusCounts,
}: InventoryFilterBarProps) {
  return (
    <div className="flex flex-col gap-3.5 bg-card border border-border/80 p-3.5 sm:p-4 rounded-2xl shadow-clinical-sm">
      {/* Top Row: Search Input + Status & Sort Selectors */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search SKU, item name, storage bay, supplier..."
            className="rounded-xl bg-background border border-border/80 pl-9.5 pr-4 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/40 h-9"
          />
        </div>

        {/* Sort & Quick Selectors */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="bg-background border border-border/80 rounded-xl px-3 py-1.5 shadow-clinical-xs text-xs font-extrabold text-foreground h-9 focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <option value="name-asc">Sort: Name (A → Z)</option>
              <option value="stock-asc">Sort: Stock (Lowest First)</option>
              <option value="stock-desc">Sort: Stock (Highest First)</option>
              <option value="expiry-asc">Sort: Expiry (Soonest First)</option>
              <option value="cost-desc">Sort: Valuation (Highest First)</option>
            </select>
          </div>

          <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted/40 border border-border/70 rounded-xl px-3 py-1.5 h-9 shrink-0">
            <span>Items:</span>
            <span className="font-extrabold font-mono text-foreground">{totalFilteredCount}</span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Category & Status Filter Pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2.5 border-t border-border/60">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none no-scrollbar">
          <button
            type="button"
            onClick={() => onStatusFilterChange("all")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
              statusFilter === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            All ({statusCounts.all || 0})
          </button>

          <button
            type="button"
            onClick={() => onStatusFilterChange("normal")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
              statusFilter === "normal"
                ? "bg-success text-success-foreground border-success shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Normal ({statusCounts.normal || 0})
          </button>

          <button
            type="button"
            onClick={() => onStatusFilterChange("low_stock")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
              statusFilter === "low_stock"
                ? "bg-warning text-warning-foreground border-warning shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Low Stock ({statusCounts.low_stock || 0})
          </button>

          <button
            type="button"
            onClick={() => onStatusFilterChange("critical")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
              statusFilter === "critical"
                ? "bg-destructive text-destructive-foreground border-destructive shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            Critical ({statusCounts.critical || 0})
          </button>

          <button
            type="button"
            onClick={() => onStatusFilterChange("near_expiry")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
              statusFilter === "near_expiry"
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            <Clock className="h-3 w-3" />
            Near Expiry ({statusCounts.near_expiry || 0})
          </button>
        </div>

        {/* Category Filter Selector / Dropdown on smaller views */}
        <div className="flex items-center gap-2 shrink-0">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="bg-background border border-border/80 rounded-xl px-2.5 py-1 text-xs font-bold text-foreground h-8 focus:ring-2 focus:ring-primary/40 cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.category_id} value={cat.category_id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
