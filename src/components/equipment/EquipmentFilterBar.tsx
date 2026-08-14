import {
  Search,
  ArrowUpDown,
  Filter,
  Layers,
  Wrench,
  CheckCircle2,
  Activity,
  AlertTriangle,
  XCircle,
  Stethoscope,
  X,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { EquipmentStatus } from "@/lib/types";

export type EquipmentStatusFilter = "all" | EquipmentStatus;

export interface EquipmentFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (dept: string) => void;
  departments: string[];
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  types: string[];
  statusFilter: EquipmentStatusFilter;
  onStatusFilterChange: (status: EquipmentStatusFilter) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
  totalFilteredCount: number;
  statusCounts: Record<string, number>;
}

export function EquipmentFilterBar({
  searchQuery,
  onSearchChange,
  departmentFilter,
  onDepartmentFilterChange,
  departments,
  typeFilter,
  onTypeFilterChange,
  types,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
  totalFilteredCount,
  statusCounts,
}: EquipmentFilterBarProps) {
  const statusPills: { id: EquipmentStatusFilter; label: string; icon: any; countKey: string }[] = [
    { id: "all", label: "All Units", icon: Layers, countKey: "all" },
    { id: "operational", label: "Operational", icon: CheckCircle2, countKey: "operational" },
    { id: "in-use", label: "In Use", icon: Activity, countKey: "in-use" },
    { id: "maintenance", label: "Maintenance", icon: AlertTriangle, countKey: "maintenance" },
    { id: "offline", label: "Offline", icon: XCircle, countKey: "offline" },
  ];

  return (
    <div className="flex flex-col gap-3.5 bg-card border border-border/80 p-3.5 sm:p-4 rounded-2xl shadow-clinical-sm">
      {/* ─── ROW 1: Search Input (Left) + Dropdown Filters & Sort (Right) ─── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search equipment name, serial, model, ward..."
            className="rounded-xl bg-background border border-border/80 pl-9.5 pr-8 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/40 h-9"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters & Sort Group */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {/* Department Selector */}
          <div className="relative">
            <select
              value={departmentFilter}
              onChange={(e) => onDepartmentFilterChange(e.target.value)}
              className="appearance-none bg-background border border-border/80 rounded-xl pl-3.5 pr-8 py-1.5 text-xs font-bold text-foreground shadow-xs focus:ring-2 focus:ring-primary/40 outline-none h-9 cursor-pointer"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Equipment Modality Selector */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value)}
              className="appearance-none bg-background border border-border/80 rounded-xl pl-3.5 pr-8 py-1.5 text-xs font-bold text-foreground shadow-xs focus:ring-2 focus:ring-primary/40 outline-none h-9 cursor-pointer"
            >
              <option value="all">All Modalities</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Sort Selector */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="appearance-none bg-background border border-border/80 rounded-xl pl-3.5 pr-8 py-1.5 text-xs font-bold text-foreground shadow-xs focus:ring-2 focus:ring-primary/40 outline-none h-9 cursor-pointer"
            >
              <option value="name-asc">Sort: Name (A → Z)</option>
              <option value="name-desc">Sort: Name (Z → A)</option>
              <option value="utilization-desc">Sort: Utilization (High → Low)</option>
              <option value="utilization-asc">Sort: Utilization (Low → High)</option>
              <option value="maint-soon">Sort: Next Service (Soonest)</option>
              <option value="status">Sort: Status</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ─── ROW 2: Status Filter Pills (Left) + Units Counter (Right) ─────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-border/50">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {statusPills.map((pill) => {
            const Icon = pill.icon;
            const isActive = statusFilter === pill.id;
            const count = statusCounts[pill.countKey] || 0;

            return (
              <button
                key={pill.id}
                onClick={() => onStatusFilterChange(pill.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold transition-all shrink-0 ${
                  isActive
                    ? "bg-primary text-primary-foreground border border-primary shadow-xs"
                    : "border border-border/80 text-muted-foreground hover:border-border hover:text-foreground bg-background"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{pill.label}</span>
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold ${
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Results Counter */}
        <div className="text-xs font-medium text-muted-foreground shrink-0 self-end sm:self-auto">
          Showing <span className="font-bold font-mono text-foreground">{totalFilteredCount}</span> units
        </div>
      </div>
    </div>
  );
}
