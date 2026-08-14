import { Home, Bed, Activity, CheckCircle2, AlertTriangle, Layers, Filter } from "lucide-react";
import { GradientProgress } from "@/components/dashboard/GradientProgress";
import { Button } from "@/components/ui/button";

export interface WardUtilizationSidebarProps {
  wards: any[];
  rooms: any[];
  beds: any[];
  selectedWardId: string | null;
  onSelectWard: (wardId: string | null) => void;
  className?: string;
}

export function WardUtilizationSidebar({
  wards,
  rooms,
  beds,
  selectedWardId,
  onSelectWard,
  className = "",
}: WardUtilizationSidebarProps) {
  // Compute utilization per ward
  const wardMetrics = wards.map((ward) => {
    const wardBeds = beds.filter((b) => b.ward_id === ward.ward_id);
    const wardRooms = rooms.filter((r) => r.ward_id === ward.ward_id);
    const total = wardBeds.length;
    const occupied = wardBeds.filter((b) => b.status === "occupied").length;
    const available = wardBeds.filter((b) => b.status === "available").length;
    const maintenance = wardBeds.filter(
      (b) => b.status === "maintenance" || b.status === "cleaning" || b.status === "blocked",
    ).length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    let tone: "success" | "warning" | "destructive" | "primary" = "success";
    if (occupancyRate >= 85) tone = "destructive";
    else if (occupancyRate >= 60) tone = "warning";
    else tone = "success";

    return {
      ward,
      total,
      occupied,
      available,
      maintenance,
      roomsCount: wardRooms.length,
      occupancyRate,
      tone,
    };
  });

  const totalBeds = beds.length;
  const totalOccupied = beds.filter((b) => b.status === "occupied").length;
  const totalAvailable = beds.filter((b) => b.status === "available").length;
  const overallRate = totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100) : 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header & Filter Reset */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-clinical-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-primary" />
            <h3 className="font-display font-extrabold text-sm text-foreground tracking-tight">
              Ward Utilization
            </h3>
          </div>
          {selectedWardId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSelectWard(null)}
              className="h-6 text-[10px] font-extrabold text-primary hover:bg-primary/10 px-2 rounded-lg"
            >
              Clear Filter
            </Button>
          )}
        </div>

        {/* Floor Overview Progress */}
        <div className="p-3 rounded-xl bg-background/80 border border-border/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Floor Occupancy
            </span>
            <span className="font-mono font-extrabold text-xs text-foreground">
              {totalOccupied}/{totalBeds} ({overallRate}%)
            </span>
          </div>
          <GradientProgress
            value={overallRate}
            tone={overallRate >= 85 ? "destructive" : overallRate >= 60 ? "warning" : "primary"}
            height={6}
          />
          <div className="flex items-center justify-between text-[10px] font-extrabold text-muted-foreground pt-1 border-t border-border/40">
            <span className="text-success flex items-center gap-1">
              <CheckCircle2 className="h-2.5 w-2.5" /> {totalAvailable} Available
            </span>
            <span className="text-primary flex items-center gap-1">
              <Bed className="h-2.5 w-2.5" /> {totalOccupied} Occupied
            </span>
          </div>
        </div>
      </div>

      {/* Ward Cards List */}
      <div className="space-y-2.5">
        {wardMetrics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
            <Home className="h-6 w-6 mx-auto text-muted-foreground/60 mb-2" />
            No clinical wards found on this floor.
          </div>
        ) : (
          wardMetrics.map(
            ({ ward, total, occupied, available, roomsCount, occupancyRate, tone }) => {
              const isSelected = ward.ward_id === selectedWardId;

              return (
                <div
                  key={ward.ward_id}
                  onClick={() => onSelectWard(isSelected ? null : ward.ward_id)}
                  className={`rounded-2xl border p-3.5 transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5 shadow-clinical-sm"
                      : "border-border/80 bg-card hover:border-primary/40 hover:shadow-clinical-xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-extrabold text-xs text-foreground tracking-tight">
                          {ward.ward_name}
                        </span>
                        {ward.ward_type && (
                          <span className="inline-flex items-center rounded-md bg-muted/80 px-1.5 py-0.2 text-[9px] font-extrabold uppercase text-muted-foreground">
                            {ward.ward_type}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {roomsCount} {roomsCount === 1 ? "Room" : "Rooms"} • {total}{" "}
                        {total === 1 ? "Bed" : "Beds"}
                      </span>
                    </div>

                    <span
                      className={`font-mono text-xs font-extrabold px-1.5 py-0.5 rounded-lg border ${
                        tone === "destructive"
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : tone === "warning"
                            ? "bg-warning/10 text-warning-foreground border-warning/20"
                            : "bg-success/10 text-success border-success/20"
                      }`}
                    >
                      {occupancyRate}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <GradientProgress value={occupancyRate} tone={tone} height={5} />

                  {/* Metrics detail row */}
                  <div className="flex items-center justify-between text-[10px] font-extrabold pt-2 mt-2 border-t border-border/40 text-muted-foreground">
                    <span>
                      <strong className="text-foreground">{occupied}</strong> Occupied
                    </span>
                    <span>
                      <strong className="text-success">{available}</strong> Free
                    </span>
                    {ward.code && (
                      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
                        #{ward.code}
                      </span>
                    )}
                  </div>
                </div>
              );
            },
          )
        )}
      </div>
    </div>
  );
}
