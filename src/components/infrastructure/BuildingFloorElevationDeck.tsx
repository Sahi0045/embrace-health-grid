import { memo } from "react";
import { Building2, Layers, CheckCircle2, Bed, Activity, ShieldAlert } from "lucide-react";
import { GradientProgress } from "@/components/dashboard/GradientProgress";

export interface BuildingFloorElevationDeckProps {
  buildings: any[];
  floors: any[];
  selectedBuildingId: string;
  selectedFloorId: string;
  onSelectBuilding: (buildingId: string) => void;
  onSelectFloor: (floorId: string) => void;
  statsByFloor: Record<string, { totalBeds: number; occupiedBeds: number; availableBeds: number; roomsCount: number }>;
  className?: string;
}

export const BuildingFloorElevationDeck = memo(function BuildingFloorElevationDeck({
  buildings,
  floors,
  selectedBuildingId,
  selectedFloorId,
  onSelectBuilding,
  onSelectFloor,
  statsByFloor,
  className = "",
}: BuildingFloorElevationDeckProps) {
  const currentFloors = floors.filter((f) => f.building_id === selectedBuildingId);
  const sortedFloors = [...currentFloors].sort((a, b) => (b.floor_number ?? 0) - (a.floor_number ?? 0));

  return (
    <div className={`space-y-3.5 w-full ${className}`}>
      {/* Building Switcher Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border/80 p-2 rounded-2xl shadow-clinical-sm w-full">
        <div className="flex flex-wrap items-center gap-2 w-full">
          {buildings.map((b) => {
            const isSelected = b.building_id === selectedBuildingId;
            return (
              <button
                key={b.building_id}
                type="button"
                onClick={() => onSelectBuilding(b.building_id)}
                className={`flex-1 sm:flex-initial inline-flex items-center gap-2.5 rounded-xl px-3.5 sm:px-4 py-2.5 text-xs font-extrabold transition-all border ${
                  isSelected
                    ? "bg-gradient-to-r from-primary to-blue-600 text-primary-foreground border-primary shadow-clinical-sm shadow-primary/20 scale-[1.01]"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                <Building2 className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary-foreground" : "text-primary"}`} />
                <div className="text-left min-w-0">
                  <div className="leading-tight truncate font-extrabold">{b.building_name}</div>
                  <div className={`text-[10px] font-mono font-medium truncate ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {b.building_code || "Main Complex"} • {b.total_floors || 3} Floors
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="hidden lg:flex items-center gap-2 pr-2 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground shrink-0">
          <Layers className="h-4 w-4 text-primary" />
          <span>Spatial Floor Matrix</span>
        </div>
      </div>

      {/* Floor Elevation Level Cards (Stacked 1-col on mobile, 2-col on tablet, 4-col on desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
        {sortedFloors.map((floor) => {
          const isSelected = floor.floor_id === selectedFloorId;
          const stats = statsByFloor[floor.floor_id] || { totalBeds: 0, occupiedBeds: 0, availableBeds: 0, roomsCount: 0 };
          const occupancyRate = stats.totalBeds > 0 ? Math.round((stats.occupiedBeds / stats.totalBeds) * 100) : 0;

          let progressTone: "success" | "warning" | "destructive" | "primary" = "success";
          if (occupancyRate >= 85) progressTone = "destructive";
          else if (occupancyRate >= 60) progressTone = "warning";
          else progressTone = "success";

          return (
            <button
              key={floor.floor_id}
              type="button"
              onClick={() => onSelectFloor(floor.floor_id)}
              className={`rounded-2xl border p-4 text-left transition-all relative overflow-hidden flex flex-col justify-between gap-3 w-full ${
                isSelected
                  ? "border-primary ring-2 ring-primary/30 bg-primary/5 shadow-clinical-md scale-[1.01]"
                  : "border-border/80 bg-card hover:border-primary/40 hover:shadow-clinical-sm"
              }`}
            >
              {/* Active Indicator Strip */}
              {isSelected && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-blue-600" />
              )}

              {/* Floor Level & Specialty Header */}
              <div className="flex items-start justify-between gap-2 w-full">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`font-mono text-xs font-black px-2 py-0.5 rounded-lg border shrink-0 ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted text-foreground border-border/80"
                      }`}
                    >
                      {floor.short_code || `L${floor.floor_number}`}
                    </span>
                    <span className="font-display font-extrabold text-sm text-foreground tracking-tight truncate">
                      {floor.floor_name || `Floor ${floor.floor_number}`}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground truncate">
                    {floor.specialty || floor.description || "Clinical Wards"}
                  </p>
                </div>

                <span
                  className={`font-mono text-xs font-black px-2 py-0.5 rounded-md shrink-0 ${
                    progressTone === "destructive"
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : progressTone === "warning"
                      ? "bg-warning/10 text-warning-foreground border border-warning/20"
                      : "bg-success/10 text-success border border-success/20"
                  }`}
                >
                  {occupancyRate}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full">
                <GradientProgress value={occupancyRate} tone={progressTone} height={5} />
              </div>

              {/* Footer Counters */}
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground pt-1 border-t border-border/40 w-full">
                <span className="flex items-center gap-1 truncate">
                  <Bed className="h-3 w-3 text-primary shrink-0" />
                  <strong className="text-foreground">{stats.occupiedBeds}</strong>/{stats.totalBeds} Beds
                </span>
                <span className="flex items-center gap-1 text-success shrink-0">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  <strong>{stats.availableBeds}</strong> Free
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
