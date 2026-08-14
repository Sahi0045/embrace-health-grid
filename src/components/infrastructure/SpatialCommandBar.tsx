import { memo } from "react";
import { Search, X, LayoutGrid, Layers, Plus, Minus, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface SpatialCommandBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  statusCounts: Record<string, number>;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  viewMode: "wings" | "compact";
  onViewModeChange: (mode: "wings" | "compact") => void;
  className?: string;
}

const FILTER_PILLS = [
  { id: "all", label: "All Beds", color: "bg-muted-foreground" },
  { id: "available", label: "Available", color: "bg-success" },
  { id: "occupied", label: "Occupied", color: "bg-primary" },
  { id: "reserved", label: "Reserved", color: "bg-warning" },
  { id: "cleaning", label: "Cleaning", color: "bg-blue-500" },
  { id: "maintenance", label: "Maintenance", color: "bg-amber-500" },
  { id: "emergency_reserved", label: "Emergency", color: "bg-rose-500" },
];

export const SpatialCommandBar = memo(function SpatialCommandBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  viewMode,
  onViewModeChange,
  className = "",
}: SpatialCommandBarProps) {
  const percentage = Math.round(zoom * 100);

  return (
    <div className={`space-y-3 w-full ${className}`}>
      {/* Top Action Strip: Flat, un-nested, clean search and controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
        {/* Standalone Search Input */}
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search room #, station, patient, MRN..."
            className="rounded-xl bg-card border border-border/80 pl-9.5 pr-8 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/40 h-10 shadow-clinical-xs w-full"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* View Switcher & Zoom Deck */}
        <div className="flex items-center gap-2.5 justify-between sm:justify-end">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center gap-1 bg-card border border-border/80 p-1 rounded-xl shadow-clinical-xs">
            <button
              type="button"
              onClick={() => onViewModeChange("wings")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all ${
                viewMode === "wings"
                  ? "bg-gradient-to-r from-primary to-blue-600 text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
              title="Spatial Wing Floorplan"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Wing Canvas</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("compact")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all ${
                viewMode === "compact"
                  ? "bg-gradient-to-r from-primary to-blue-600 text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
              title="Compact Matrix View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Matrix</span>
            </button>
          </div>

          {/* Zoom Controls (80% Compact ↔ 100% Standard ↔ 120% Focus) */}
          <div className="inline-flex items-center gap-1 bg-card border border-border/80 rounded-xl p-1 shadow-clinical-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onZoomOut}
              disabled={zoom <= 0.8}
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40"
              title="Zoom Out (Compact Overview 80%)"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <button
              type="button"
              onClick={onResetZoom}
              className="px-2.5 py-0.5 rounded-md font-mono text-[11px] font-bold text-foreground hover:bg-muted transition-colors"
              title="Reset Zoom (Standard 100%)"
            >
              {percentage}%
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onZoomIn}
              disabled={zoom >= 1.2}
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40"
              title="Zoom In (Detailed Focus 120%)"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <div className="h-4 w-px bg-border/60 mx-0.5" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetZoom}
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
              title="Reset View"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Status Chips: Clean interactive pill bar directly on the page */}
      <div className="flex flex-wrap items-center gap-2 w-full pt-0.5">
        {FILTER_PILLS.map((pill) => {
          const isSelected = statusFilter === pill.id;
          const count = pill.id === "all" ? Object.values(statusCounts).reduce((a, b) => a + b, 0) : (statusCounts[pill.id] || 0);

          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => onStatusFilterChange(pill.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all border ${
                isSelected
                  ? "bg-gradient-to-r from-primary to-blue-600 text-primary-foreground border-primary shadow-clinical-xs scale-[1.01]"
                  : "border-border/80 bg-card text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/40 shadow-2xs"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${pill.color} ${pill.id === "occupied" && isSelected ? "animate-pulse" : ""}`} />
              <span>{pill.label}</span>
              <span
                className={`font-mono text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                  isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
