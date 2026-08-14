import {
  Search,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  CalendarRange,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";

export type StaffViewMode = "grid" | "roster" | "departments";
export type StaffRoleFilter = "all" | "doctor" | "nurse" | "specialist" | "staff";
export type StaffAvailabilityFilter = "all" | "available" | "busy" | "oncall" | "off";

interface StaffFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (dept: string) => void;
  departments: string[];
  roleFilter: StaffRoleFilter;
  onRoleFilterChange: (role: StaffRoleFilter) => void;
  availabilityFilter: StaffAvailabilityFilter;
  onAvailabilityFilterChange: (status: StaffAvailabilityFilter) => void;
  shiftFilter: string;
  onShiftFilterChange: (shift: string) => void;
  viewMode: StaffViewMode;
  onViewModeChange: (mode: StaffViewMode) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
  totalFilteredCount: number;
}

export function StaffFilterBar({
  searchQuery,
  onSearchChange,
  departmentFilter,
  onDepartmentFilterChange,
  departments,
  roleFilter,
  onRoleFilterChange,
  availabilityFilter,
  onAvailabilityFilterChange,
  shiftFilter,
  onShiftFilterChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortByChange,
  totalFilteredCount,
}: StaffFilterBarProps) {
  return (
    <div className="space-y-3 bg-card border border-border/80 p-3.5 sm:p-4 rounded-2xl shadow-clinical-sm">
      {/* Top Row: View Mode Switcher + Quick Search + Sort */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* View Mode Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${
              viewMode === "grid"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Staff Directory Cards ({totalFilteredCount})
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange("roster")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${
              viewMode === "roster"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Duty Roster Matrix
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange("departments")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${
              viewMode === "departments"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Department Workload
          </button>
        </div>

        {/* Search Bar + Sort */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search clinician by name, specialty, DID or ID..."
              className="rounded-xl bg-background border border-border/80 pl-9.5 pr-4 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/40 h-9"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="bg-background border border-border/80 rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-foreground h-9 focus:ring-2 focus:ring-primary/40"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="workload-desc">Workload (High → Low)</option>
              <option value="department">Department</option>
              <option value="status">Availability Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bottom Filter Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-border/60">
        {/* Role Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mr-1.5 hidden sm:inline">
            Role:
          </span>
          {(
            [
              { id: "all", label: "All Roles" },
              { id: "doctor", label: "Doctors" },
              { id: "nurse", label: "Nurses" },
              { id: "specialist", label: "Specialists" },
              { id: "staff", label: "Support Staff" },
            ] as const
          ).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onRoleFilterChange(r.id)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                roleFilter === r.id
                  ? "bg-primary text-primary-foreground font-black shadow-xs"
                  : "text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Dropdowns for Department, Shift & Availability */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Department Select */}
          <select
            value={departmentFilter}
            onChange={(e) => onDepartmentFilterChange(e.target.value)}
            className="bg-background border border-border/80 rounded-xl px-2.5 py-1 text-xs font-semibold text-foreground h-8 focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Shift Select */}
          <select
            value={shiftFilter}
            onChange={(e) => onShiftFilterChange(e.target.value)}
            className="bg-background border border-border/80 rounded-xl px-2.5 py-1 text-xs font-semibold text-foreground h-8 focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">All Shifts</option>
            <option value="morning">Morning (07:00 - 15:00)</option>
            <option value="evening">Evening (15:00 - 23:00)</option>
            <option value="night">Night (23:00 - 07:00)</option>
            <option value="oncall">On-Call Duty</option>
          </select>

          {/* Status Select */}
          <select
            value={availabilityFilter}
            onChange={(e) => onAvailabilityFilterChange(e.target.value as StaffAvailabilityFilter)}
            className="bg-background border border-border/80 rounded-xl px-2.5 py-1 text-xs font-semibold text-foreground h-8 focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">All Statuses</option>
            <option value="available">● Available</option>
            <option value="busy">● Busy / In Consult</option>
            <option value="oncall">● Emergency On-Call</option>
            <option value="off">● Off Duty</option>
          </select>
        </div>
      </div>
    </div>
  );
}
