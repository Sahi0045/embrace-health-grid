import {
  Search,
  X,
  LayoutGrid,
  Siren,
  Bed,
  Package,
  Clock,
  Activity,
  Truck,
  ShieldAlert,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { AlertCategory, AlertSeverity } from "@/lib/types";

export interface AlertFilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  selectedSeverity: string;
  onSeverityChange: (sev: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  totalAlerts: number;
}

interface CategoryItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CATEGORIES: CategoryItem[] = [
  { id: "all", label: "All Categories", icon: LayoutGrid },
  { id: "emergency", label: "Emergency Codes", icon: Siren },
  { id: "bed_shortage", label: "Bed Shortages", icon: Bed },
  { id: "low_stock", label: "Low Stock", icon: Package },
  { id: "near_expiry", label: "Near Expiry", icon: Clock },
  { id: "equipment_failure", label: "Biomed Equipment", icon: Activity },
  { id: "ambulance", label: "Ambulance Fleet", icon: Truck },
  { id: "security", label: "Security & Fraud", icon: ShieldAlert },
];

const SEVERITIES: { id: string; label: string; dotClass: string }[] = [
  { id: "all", label: "All Priorities", dotClass: "bg-muted-foreground" },
  { id: "critical", label: "Critical Priority", dotClass: "bg-destructive animate-pulse" },
  { id: "warning", label: "Warning Notice", dotClass: "bg-warning" },
  { id: "info", label: "Informational", dotClass: "bg-sky-500" },
];

export function AlertFilterBar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedSeverity,
  onSeverityChange,
  selectedStatus,
  onStatusChange,
  totalAlerts,
}: AlertFilterBarProps) {
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [severityMenuOpen, setSeverityMenuOpen] = useState(false);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const severityDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryMenuOpen(false);
      }
      if (severityDropdownRef.current && !severityDropdownRef.current.contains(e.target as Node)) {
        setSeverityMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasActiveRefinements =
    selectedCategory !== "all" || selectedSeverity !== "all" || searchQuery.trim() !== "";

  const handleResetRefinements = () => {
    onSearchChange("");
    onCategoryChange("all");
    onSeverityChange("all");
  };

  const activeCategoryObj = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];
  const activeSeverityObj = SEVERITIES.find((s) => s.id === selectedSeverity) || SEVERITIES[0];

  const CategoryIcon = activeCategoryObj.icon;

  return (
    <div className="bg-card border border-border/80 rounded-2xl shadow-clinical-sm transition-all relative z-20">
      {/* ── Top Tier: Search Bar & Status Tabs ── */}
      <div className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
          <input
            type="text"
            placeholder="Search alerts by clinical unit, asset, code, or payload message..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl bg-background border border-border/80 pl-9.5 pr-8 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground/60"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-md hover:bg-muted"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-muted/60 border border-border/80 rounded-xl p-1 shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => onStatusChange("all")}
            className={`px-3 py-1 rounded-lg text-[11px] font-extrabold uppercase transition-all ${
              selectedStatus === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("active")}
            className={`px-3 py-1 rounded-lg text-[11px] font-extrabold uppercase transition-all ${
              selectedStatus === "active"
                ? "bg-warning text-warning-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("acknowledged")}
            className={`px-3 py-1 rounded-lg text-[11px] font-extrabold uppercase transition-all ${
              selectedStatus === "acknowledged"
                ? "bg-primary/20 text-primary font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            }`}
          >
            Ack'd
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("resolved")}
            className={`px-3 py-1 rounded-lg text-[11px] font-extrabold uppercase transition-all ${
              selectedStatus === "resolved"
                ? "bg-muted text-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            }`}
          >
            Resolved
          </button>
        </div>
      </div>

      {/* ── Bottom Tier: Filters & Incident Counts ── */}
      <div className="px-3 py-2.5 sm:px-4 sm:py-2.5 border-t border-border/60 bg-muted/20 rounded-b-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left filter dropdowns */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
            <SlidersHorizontal className="h-3 w-3" /> Filters:
          </span>

          {/* Category Dropdown */}
          <div className="relative" ref={categoryDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setCategoryMenuOpen(!categoryMenuOpen);
                setSeverityMenuOpen(false);
              }}
              className={`inline-flex items-center gap-2 h-8 px-3 rounded-xl text-xs font-bold border transition-all ${
                selectedCategory !== "all"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-background border-border/80 text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <CategoryIcon
                className={`h-3.5 w-3.5 ${selectedCategory !== "all" ? "text-primary-foreground" : "text-muted-foreground"}`}
              />
              <span>{activeCategoryObj.label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${categoryMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {categoryMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-60 rounded-2xl bg-card border border-border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground border-b border-border/50">
                  Filter by Category
                </div>
                <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
                  {CATEGORIES.map((cat) => {
                    const isCur = selectedCategory === cat.id;
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          onCategoryChange(cat.id);
                          setCategoryMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                          isCur
                            ? "bg-primary/10 text-primary font-bold"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            className={`h-3.5 w-3.5 ${isCur ? "text-primary" : "text-muted-foreground"}`}
                          />
                          <span>{cat.label}</span>
                        </div>
                        {isCur && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Priority Dropdown */}
          <div className="relative" ref={severityDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setSeverityMenuOpen(!severityMenuOpen);
                setCategoryMenuOpen(false);
              }}
              className={`inline-flex items-center gap-2 h-8 px-3 rounded-xl text-xs font-bold border transition-all ${
                selectedSeverity !== "all"
                  ? "bg-primary/10 border-primary/40 text-primary shadow-xs"
                  : "bg-background border-border/80 text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${activeSeverityObj.dotClass}`} />
              <span>{activeSeverityObj.label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${severityMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {severityMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-52 rounded-2xl bg-card border border-border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground border-b border-border/50">
                  Filter by Priority
                </div>
                <div className="py-1 space-y-0.5">
                  {SEVERITIES.map((sev) => {
                    const isCur = selectedSeverity === sev.id;
                    return (
                      <button
                        key={sev.id}
                        type="button"
                        onClick={() => {
                          onSeverityChange(sev.id);
                          setSeverityMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                          isCur
                            ? "bg-primary/10 text-primary font-bold"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${sev.dotClass}`} />
                          <span>{sev.label}</span>
                        </div>
                        {isCur && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Reset */}
          {hasActiveRefinements && (
            <button
              type="button"
              onClick={handleResetRefinements}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10"
              title="Reset search & filters"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Total Events Counter */}
        <div className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
          Showing <span className="font-bold text-foreground">{totalAlerts}</span> total incidents
        </div>
      </div>
    </div>
  );
}
