import { Layers } from "lucide-react";

export interface FloorStats {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  roomsCount: number;
}

export interface FloorSelectorProps {
  floors: any[];
  selectedFloorId: string | null;
  onSelectFloor: (floorId: string) => void;
  statsByFloor?: Record<string, FloorStats>;
  className?: string;
}

export function FloorSelector({
  floors,
  selectedFloorId,
  onSelectFloor,
  statsByFloor = {},
  className = "",
}: FloorSelectorProps) {
  if (!floors || floors.length === 0) {
    return null;
  }

  // Sort floors ascending or ground up
  const sortedFloors = [...floors].sort((a, b) => (a.floor_number ?? 0) - (b.floor_number ?? 0));

  return (
    <div className={`flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar ${className}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-1 shrink-0">
        <Layers className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] uppercase tracking-wider font-extrabold">Floors:</span>
      </div>

      {sortedFloors.map((floor) => {
        const isSelected = floor.floor_id === selectedFloorId;
        const stats = statsByFloor[floor.floor_id];
        const floorLabel =
          floor.floor_name ||
          (floor.floor_number === 0
            ? "Ground Floor"
            : `Floor ${floor.floor_number}`);

        return (
          <button
            key={floor.floor_id}
            type="button"
            onClick={() => onSelectFloor(floor.floor_id)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all shrink-0 border ${
              isSelected
                ? "bg-primary text-primary-foreground border-primary shadow-clinical-sm shadow-primary/20 scale-[1.02]"
                : "border-border/80 bg-background text-muted-foreground hover:border-border hover:text-foreground hover:bg-card"
            }`}
          >
            <span>{floorLabel}</span>
            {stats && (
              <span
                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-mono font-extrabold ${
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted/80 text-muted-foreground"
                }`}
              >
                {stats.occupiedBeds}/{stats.totalBeds} Beds
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
