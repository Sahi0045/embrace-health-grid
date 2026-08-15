import { Search, ArrowUpDown, Plus, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LabOrderPriority, LabOrderStatus } from "@/lib/types";

export type LabStatusFilter = "all" | LabOrderStatus;
export type LabPriorityFilter = "all" | LabOrderPriority;

interface LabFilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  statusFilter: LabStatusFilter;
  onStatusChange: (status: LabStatusFilter) => void;
  priorityFilter: LabPriorityFilter;
  onPriorityChange: (priority: LabPriorityFilter) => void;
  categoryFilter: string;
  onCategoryChange: (cat: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  onNewOrderClick: () => void;
  counts: {
    all: number;
    pending: number;
    in_progress: number;
    completed: number;
    stat: number;
  };
}

const categories = [
  { id: "all", label: "All Categories" },
  { id: "hematology", label: "Hematology" },
  { id: "biochemistry", label: "Biochemistry" },
  { id: "microbiology", label: "Microbiology" },
  { id: "immunology", label: "Immunology" },
  { id: "pathology", label: "Pathology" },
];

export function LabFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  categoryFilter,
  onCategoryChange,
  sortBy,
  onSortChange,
  onNewOrderClick,
  counts,
}: LabFilterBarProps) {
  return (
    <div className="space-y-3 bg-card border border-border/80 p-4 rounded-2xl shadow-clinical-sm">
      {/* Top row: Search input + Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by test, patient name, MRN, order #, or barcode..."
            className="w-full rounded-xl bg-background border border-border/80 pl-9.5 pr-8 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground/60"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-lg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort & Action CTA */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-background border border-border/80 rounded-xl px-2.5 py-1.5 shadow-xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              aria-label="Sort lab items"
              className="bg-transparent text-xs font-extrabold focus:outline-none text-foreground cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="priority">Priority (STAT first)</option>
              <option value="patient">Patient Name (A-Z)</option>
              <option value="test">Test Name (A-Z)</option>
            </select>
          </div>

          <Button
            onClick={onNewOrderClick}
            size="sm"
            className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold shadow-clinical-md shadow-primary/25 hover:shadow-clinical transition-all gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Order Test</span>
          </Button>
        </div>
      </div>

      {/* Filter Pills Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/40">
        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">
            Status:
          </span>

          <button
            onClick={() => onStatusChange("all")}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            All <span className="opacity-70">({counts.all})</span>
          </button>

          <button
            onClick={() => onStatusChange("pending")}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
              statusFilter === "pending"
                ? "bg-warning text-warning-foreground border-warning shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Pending <span className="opacity-70">({counts.pending})</span>
          </button>

          <button
            onClick={() => onStatusChange("in_progress")}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
              statusFilter === "in_progress"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            In Progress <span className="opacity-70">({counts.in_progress})</span>
          </button>

          <button
            onClick={() => onStatusChange("completed")}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
              statusFilter === "completed"
                ? "bg-success text-success-foreground border-success shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Completed <span className="opacity-70">({counts.completed})</span>
          </button>
        </div>

        {/* Priority Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">
            Priority:
          </span>

          <button
            onClick={() => onPriorityChange("all")}
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
              priorityFilter === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            All
          </button>

          <button
            onClick={() => onPriorityChange("stat")}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
              priorityFilter === "stat"
                ? "bg-destructive text-destructive-foreground border-destructive shadow-xs animate-pulse"
                : "border-destructive/40 text-destructive hover:bg-destructive/10 bg-background"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            STAT ({counts.stat})
          </button>

          <button
            onClick={() => onPriorityChange("urgent")}
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
              priorityFilter === "urgent"
                ? "bg-warning text-warning-foreground border-warning shadow-xs"
                : "border-warning/40 text-warning-foreground hover:bg-warning/10 bg-background"
            }`}
          >
            Urgent
          </button>

          <button
            onClick={() => onPriorityChange("routine")}
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
              priorityFilter === "routine"
                ? "bg-muted text-foreground border-border shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border bg-background"
            }`}
          >
            Routine
          </button>
        </div>
      </div>

      {/* Category selector row */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border/30">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
          Discipline:
        </span>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => onCategoryChange(c.id)}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
              categoryFilter === c.id
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
