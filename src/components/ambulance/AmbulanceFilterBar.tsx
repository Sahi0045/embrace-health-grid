import {
  Search,
  ArrowUpDown,
  Filter,
  Ambulance,
  CheckCircle2,
  Navigation,
  AlertTriangle,
  RotateCcw,
  Wrench,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type AmbulanceStatusFilter =
  | "all"
  | "available"
  | "en-route"
  | "at-scene"
  | "returning"
  | "maintenance";

export type AmbulanceTypeFilter = "all" | "als" | "bls" | "neonatal" | "air";

interface AmbulanceFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: AmbulanceStatusFilter;
  onStatusFilterChange: (s: AmbulanceStatusFilter) => void;
  typeFilter: AmbulanceTypeFilter;
  onTypeFilterChange: (t: AmbulanceTypeFilter) => void;
  sortBy: string;
  onSortByChange: (s: string) => void;
  totalFilteredCount: number;
  statusCounts: Record<string, number>;
}

export function AmbulanceFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  sortBy,
  onSortByChange,
  totalFilteredCount,
  statusCounts,
}: AmbulanceFilterBarProps) {
  const statusOptions: { key: AmbulanceStatusFilter; label: string; icon: any; count: number }[] = [
    { key: "all", label: "All Vehicles", icon: Ambulance, count: statusCounts.all ?? 0 },
    {
      key: "available",
      label: "Available",
      icon: CheckCircle2,
      count: statusCounts.available ?? 0,
    },
    { key: "en-route", label: "En-Route", icon: Navigation, count: statusCounts["en-route"] ?? 0 },
    {
      key: "at-scene",
      label: "At Scene",
      icon: AlertTriangle,
      count: statusCounts["at-scene"] ?? 0,
    },
    { key: "returning", label: "Returning", icon: RotateCcw, count: statusCounts.returning ?? 0 },
    {
      key: "maintenance",
      label: "Maintenance",
      icon: Wrench,
      count: statusCounts.maintenance ?? 0,
    },
  ];

  return (
    <div className="space-y-3.5 bg-card border border-border/80 p-3.5 rounded-2xl shadow-clinical-sm">
      {/* Top Row: Search Input, Type Dropdown, Sort Dropdown & Count Badge */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search vehicle ID, license plate, driver, location, DID..."
            className="rounded-xl bg-background border border-border/80 pl-9.5 pr-4 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/40 h-9"
          />
        </div>

        {/* Type Filter & Sort Controls */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Vehicle Type Selector */}
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value as AmbulanceTypeFilter)}
            className="bg-card border border-border/80 rounded-xl px-3 py-1.5 shadow-clinical-xs text-xs font-extrabold text-foreground h-9 focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">All Vehicle Types</option>
            <option value="als">ALS (Advanced Life Support)</option>
            <option value="bls">BLS (Basic Life Support)</option>
            <option value="neonatal">Neonatal Intensive Care</option>
            <option value="air">Air Ambulance Helicopter</option>
          </select>

          {/* Sort Selector */}
          <div className="relative flex items-center">
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="bg-card border border-border/80 rounded-xl px-3 pr-8 py-1.5 shadow-clinical-xs text-xs font-extrabold text-foreground h-9 focus:ring-2 focus:ring-primary/40 appearance-none"
            >
              <option value="vehicle-asc">Vehicle ID (A-Z)</option>
              <option value="status">Status Priority</option>
              <option value="type">Vehicle Type</option>
            </select>
            <ArrowUpDown className="absolute right-2.5 pointer-events-none h-3.5 w-3.5 text-muted-foreground" />
          </div>

          {/* Count Badge */}
          <Badge
            variant="outline"
            className="rounded-xl border-border/80 bg-background px-3 py-1.5 text-xs font-extrabold text-muted-foreground h-9 shrink-0"
          >
            {totalFilteredCount} Units
          </Badge>
        </div>
      </div>

      {/* Bottom Row: Status Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar pt-1 border-t border-border/50">
        {statusOptions.map((opt) => {
          const Icon = opt.icon;
          const isActive = statusFilter === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onStatusFilterChange(opt.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider transition-all shrink-0 ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "border-border/80 text-muted-foreground hover:border-border bg-background"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{opt.label}</span>
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-mono ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {opt.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
