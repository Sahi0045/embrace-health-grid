import { Search, ArrowUpDown, Plus, Filter, Trash2, Building2, Utensils, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CafeteriaTabType = "menu" | "stock" | "dietary" | "delivery" | "vendors" | "wastage";
export type CafeteriaStatusFilter =
  | "all"
  | "active"
  | "inactive"
  | "low_stock"
  | "pending"
  | "delivered";

interface CafeteriaFilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  statusFilter: CafeteriaStatusFilter;
  onStatusChange: (status: CafeteriaStatusFilter) => void;
  categoryFilter: string;
  onCategoryChange: (cat: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  activeTab: CafeteriaTabType;
  onAddMenuItemClick: () => void;
  onLogWastageClick: () => void;
  onAddVendorClick: () => void;
  counts: {
    menuTotal: number;
    stockTotal: number;
    dietaryTotal: number;
    deliveryTotal: number;
    vendorsTotal: number;
    wastageTotal: number;
  };
}

const CATEGORIES_BY_TAB: Record<CafeteriaTabType, { id: string; label: string }[]> = {
  menu: [
    { id: "all", label: "All Meal Categories" },
    { id: "breakfast", label: "Breakfast" },
    { id: "lunch", label: "Lunch" },
    { id: "dinner", label: "Dinner" },
    { id: "snack", label: "Snacks" },
    { id: "beverage", label: "Beverages" },
  ],
  stock: [
    { id: "all", label: "All Stock Categories" },
    { id: "produce", label: "Produce" },
    { id: "dairy", label: "Dairy & Eggs" },
    { id: "meat", label: "Meat & Poultry" },
    { id: "dry_goods", label: "Dry Goods" },
    { id: "beverages", label: "Beverages" },
    { id: "bakery", label: "Bakery" },
    { id: "frozen", label: "Frozen Goods" },
  ],
  dietary: [
    { id: "all", label: "All Dietary Plans" },
    { id: "active", label: "Active Plans" },
    { id: "review", label: "Under Review" },
    { id: "pending", label: "Pending" },
  ],
  delivery: [
    { id: "all", label: "All Delivery States" },
    { id: "preparing", label: "Kitchen Preparing" },
    { id: "dispatched", label: "In Transit" },
    { id: "delivered", label: "Delivered" },
  ],
  vendors: [
    { id: "all", label: "All Vendors" },
    { id: "active", label: "Active Contract" },
    { id: "pending", label: "Pending Renewal" },
    { id: "expired", label: "Expired" },
  ],
  wastage: [
    { id: "all", label: "All Wastage Reasons" },
    { id: "overproduction", label: "Overproduction" },
    { id: "spoilage", label: "Spoilage" },
    { id: "unconsumed_tray", label: "Unconsumed Tray" },
    { id: "expired_stock", label: "Expired Stock" },
  ],
};

export function CafeteriaFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  categoryFilter,
  onCategoryChange,
  sortBy,
  onSortChange,
  activeTab,
  onAddMenuItemClick,
  onLogWastageClick,
  onAddVendorClick,
  counts,
}: CafeteriaFilterBarProps) {
  const currentCategories = CATEGORIES_BY_TAB[activeTab] || CATEGORIES_BY_TAB.menu;

  const currentTabCount = {
    menu: counts.menuTotal,
    stock: counts.stockTotal,
    dietary: counts.dietaryTotal,
    delivery: counts.deliveryTotal,
    vendors: counts.vendorsTotal,
    wastage: counts.wastageTotal,
  }[activeTab];

  return (
    <div className="space-y-3 bg-card border border-border/80 p-4 rounded-2xl shadow-clinical-sm">
      {/* Top row: Search input + Primary Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search meals, pantry ingredients, patient diets, vendors, or rooms..."
            className="w-full rounded-xl bg-background border border-border/80 pl-9.5 pr-8 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground/60"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-lg cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Action Buttons Trigger */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === "menu" && (
            <Button
              size="sm"
              onClick={onAddMenuItemClick}
              className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold shadow-clinical-md shadow-primary/25 hover:shadow-clinical transition-all gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Menu Item</span>
            </Button>
          )}

          {activeTab === "wastage" && (
            <Button
              size="sm"
              onClick={onLogWastageClick}
              className="h-9 px-3.5 rounded-xl bg-rose-600 text-white font-extrabold shadow-clinical-md shadow-rose-600/25 hover:bg-rose-700 transition-all gap-1.5 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Log Food Wastage</span>
            </Button>
          )}

          {activeTab === "vendors" && (
            <Button
              size="sm"
              onClick={onAddVendorClick}
              className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold shadow-clinical-md shadow-primary/25 hover:shadow-clinical transition-all gap-1.5 cursor-pointer"
            >
              <Building2 className="h-4 w-4" />
              <span>Add Vendor</span>
            </Button>
          )}

          {/* Quick Universal Menu Creator button when on other tabs */}
          {activeTab !== "menu" && activeTab !== "wastage" && activeTab !== "vendors" && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAddMenuItemClick}
              className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-border/80 hover:bg-accent cursor-pointer"
            >
              <Utensils className="h-3.5 w-3.5 text-primary" />
              <span>Add Menu Item</span>
            </Button>
          )}
        </div>
      </div>

      {/* Bottom row: Filter selectors & Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/40 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-border/80 rounded-xl px-2.5 py-1 shadow-xs">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={categoryFilter}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="bg-transparent text-xs font-extrabold focus:outline-none text-foreground cursor-pointer"
            >
              {currentCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Quick Pills */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onStatusChange("all")}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "border-border/80 text-muted-foreground hover:border-border bg-background"
              }`}
            >
              All <span className="opacity-70">({currentTabCount})</span>
            </button>
            <button
              onClick={() => onStatusChange("active")}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
                statusFilter === "active"
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                  : "border-border/80 text-muted-foreground hover:border-border bg-background"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => onStatusChange("low_stock")}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
                statusFilter === "low_stock"
                  ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                  : "border-border/80 text-muted-foreground hover:border-border bg-background"
              }`}
            >
              Alerts
            </button>
          </div>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="flex items-center gap-1.5 bg-background border border-border/80 rounded-xl px-2.5 py-1 shadow-xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="bg-transparent text-xs font-extrabold focus:outline-none text-foreground cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name-asc">Name (A → Z)</option>
              <option value="name-desc">Name (Z → A)</option>
              <option value="calories-asc">Calories (Low → High)</option>
              <option value="calories-desc">Calories (High → Low)</option>
              <option value="price-asc">Price (Low → High)</option>
              <option value="price-desc">Price (High → Low)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
