import { memo } from "react";
import {
  Bed,
  Heart,
  Activity,
  CheckCircle2,
  Shield,
  Clock,
  Wrench,
  Ban,
  Stethoscope,
  MapPin,
  Sparkles,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { GradientProgress } from "@/components/dashboard/GradientProgress";

export interface SpatialFloorCanvasProps {
  rooms: any[];
  beds: any[];
  wards: any[];
  zoom?: number;
  statusFilter?: string;
  searchQuery?: string;
  viewMode?: "wings" | "compact";
  onSelectBed: (bed: any) => void;
  className?: string;
}

const BED_THEME: Record<
  string,
  {
    bg: string;
    border: string;
    text: string;
    dot: string;
    label: string;
    icon: any;
    glow: string;
  }
> = {
  available: {
    bg: "bg-success/5 hover:bg-success/15 border-success/30 hover:border-success/60",
    border: "border-success/30",
    text: "text-success",
    dot: "bg-success",
    label: "Available",
    icon: CheckCircle2,
    glow: "hover:shadow-[0_0_15px_rgba(16,185,129,0.12)]",
  },
  occupied: {
    bg: "bg-primary/5 hover:bg-primary/15 border-primary/30 hover:border-primary/60 ring-1 ring-primary/20",
    border: "border-primary/30",
    text: "text-primary",
    dot: "bg-primary",
    label: "Occupied",
    icon: CheckCircle2,
    glow: "hover:shadow-[0_0_15px_rgba(59,130,246,0.12)]",
  },
  reserved: {
    bg: "bg-warning/5 hover:bg-warning/15 border-warning/30 hover:border-warning/60",
    border: "border-warning/30",
    text: "text-warning-foreground",
    dot: "bg-warning",
    label: "Reserved",
    icon: Clock,
    glow: "hover:shadow-[0_0_15px_rgba(245,158,11,0.12)]",
  },
  cleaning: {
    bg: "bg-blue-500/5 hover:bg-blue-500/15 border-blue-400/30 hover:border-blue-400/60",
    border: "border-blue-400/30",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
    label: "Cleaning",
    icon: Activity,
    glow: "hover:shadow-[0_0_15px_rgba(59,130,246,0.12)]",
  },
  maintenance: {
    bg: "bg-amber-500/5 hover:bg-amber-500/15 border-amber-400/30 hover:border-amber-400/60",
    border: "border-amber-400/30",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    label: "Maint",
    icon: Wrench,
    glow: "hover:shadow-[0_0_15px_rgba(245,158,11,0.12)]",
  },
  blocked: {
    bg: "bg-destructive/5 hover:bg-destructive/15 border-destructive/30 hover:border-destructive/60",
    border: "border-destructive/30",
    text: "text-destructive",
    dot: "bg-destructive",
    label: "Blocked",
    icon: Ban,
    glow: "hover:shadow-[0_0_15px_rgba(239,68,68,0.12)]",
  },
  emergency_reserved: {
    bg: "bg-rose-500/5 hover:bg-rose-500/15 border-rose-400/30 hover:border-rose-400/60 ring-1 ring-rose-400/20",
    border: "border-rose-400/30",
    text: "text-rose-600",
    dot: "bg-rose-500",
    label: "Emergency",
    icon: Shield,
    glow: "hover:shadow-[0_0_15px_rgba(244,63,94,0.12)]",
  },
};

const ROOM_TYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  icu: { bg: "bg-destructive/10 border-destructive/30", text: "text-destructive", label: "ICU Critical" },
  emergency: { bg: "bg-rose-500/10 border-rose-500/30", text: "text-rose-600", label: "Emergency Bay" },
  general: { bg: "bg-primary/10 border-primary/20", text: "text-primary", label: "General Care" },
  private: { bg: "bg-indigo-500/10 border-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400", label: "VIP Suite" },
  isolation: { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-600", label: "Isolation" },
  surgery: { bg: "bg-teal-500/10 border-teal-500/30", text: "text-teal-600", label: "PACU Recovery" },
  recovery: { bg: "bg-cyan-500/10 border-cyan-500/30", text: "text-cyan-600", label: "Day Recovery" },
};

export const SpatialFloorCanvas = memo(function SpatialFloorCanvas({
  rooms,
  beds,
  wards,
  zoom = 1,
  statusFilter = "all",
  searchQuery = "",
  viewMode = "wings",
  onSelectBed,
  className = "",
}: SpatialFloorCanvasProps) {
  const query = searchQuery.toLowerCase().trim();

  const isLargeFocus = zoom >= 1.2;
  const isCompactOverview = zoom <= 0.8;

  // Filter matching beds
  const filteredBeds = beds.filter((bed) => {
    if (statusFilter !== "all" && bed.status !== statusFilter) {
      return false;
    }

    if (query) {
      const matchBedNumber = (bed.bed_number || "").toLowerCase().includes(query);
      const matchPatientName = (bed.patient_name || "").toLowerCase().includes(query);
      const matchMRN = (bed.patient_mrn || "").toLowerCase().includes(query);
      const matchDID = (bed.patient_did || "").toLowerCase().includes(query);
      const matchType = (bed.bed_type || "").toLowerCase().includes(query);

      const room = rooms.find((r) => r.room_id === bed.room_id);
      const matchRoom = room && (
        (room.room_name || "").toLowerCase().includes(query) ||
        (room.room_number || "").toLowerCase().includes(query)
      );

      if (!matchBedNumber && !matchPatientName && !matchMRN && !matchDID && !matchType && !matchRoom) {
        return false;
      }
    }

    return true;
  });

  const matchingBedRoomIds = new Set(filteredBeds.map((b) => b.room_id));
  const filteredRooms = rooms.filter((r) => {
    if (query || statusFilter !== "all") {
      return matchingBedRoomIds.has(r.room_id);
    }
    return true;
  });

  const matchingWardIds = new Set(filteredRooms.map((r) => r.ward_id));
  const activeWards = wards.filter((w) => matchingWardIds.has(w.ward_id));

  if (activeWards.length === 0 && filteredRooms.length === 0) {
    return (
      <EmptyState
        icon={Bed}
        title="No Clinical Stations Match Search"
        description="No beds or clinical rooms match the current search query and status filter criteria."
      />
    );
  }

  const gridColumnClass = isLargeFocus
    ? "grid-cols-1 lg:grid-cols-2 gap-5"
    : isCompactOverview
    ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3"
    : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4";

  return (
    <div className={`space-y-6 sm:space-y-7 w-full ${className}`}>
      {activeWards.map((ward) => {
        const wardRooms = filteredRooms.filter((r) => r.ward_id === ward.ward_id);
        const wardBeds = beds.filter((b) => b.ward_id === ward.ward_id);
        const occupiedCount = wardBeds.filter((b) => b.status === "occupied").length;
        const totalCount = wardBeds.length;
        const occupancyRate = totalCount > 0 ? Math.round((occupiedCount / totalCount) * 100) : 0;

        return (
          <div
            key={ward.ward_id}
            className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-clinical space-y-5 w-full transition-all duration-200"
          >
            {/* Wing Header Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-border/60 w-full">
              <div className="space-y-1 w-full sm:w-auto">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                    <Stethoscope className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                        {ward.ward_name}
                      </h3>
                      <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-mono font-extrabold uppercase text-primary shrink-0">
                        {ward.ward_code || "WING"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium mt-0.5">
                      <span>{ward.wing || "Clinical Wing"}</span>
                      <span>•</span>
                      <span className="text-foreground font-semibold">{ward.lead_physician || "Lead Physician"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wing Capacity Progress */}
              <div className="w-full sm:w-52 shrink-0 pt-1 sm:pt-0">
                <div className="flex justify-between text-[11px] font-extrabold mb-1">
                  <span className="text-muted-foreground uppercase tracking-wider">Wing Occupancy</span>
                  <span className="font-mono text-foreground">{occupiedCount}/{totalCount} ({occupancyRate}%)</span>
                </div>
                <GradientProgress
                  value={occupancyRate}
                  tone={occupancyRate >= 85 ? "destructive" : occupancyRate >= 60 ? "warning" : "success"}
                  height={5}
                />
              </div>
            </div>

            {/* Grid of Room Cards (Hardware Accelerated Responsive Grid) */}
            <div className={`grid ${gridColumnClass} items-start w-full transition-all duration-200`}>
              {wardRooms.map((room) => {
                const roomBeds = filteredBeds.filter((b) => b.room_id === room.room_id);
                const roomTypeKey = (room.room_type || "general").toLowerCase();
                const typeStyle = ROOM_TYPE_STYLE[roomTypeKey] || ROOM_TYPE_STYLE.general;
                const roomOccupied = roomBeds.filter((b) => b.status === "occupied").length;

                return (
                  <div
                    key={room.room_id}
                    className={`rounded-2xl border border-border/80 bg-background/90 shadow-clinical-sm hover:border-primary/40 hover:shadow-clinical-md transition-all duration-150 flex flex-col w-full ${
                      isLargeFocus ? "p-5 space-y-4" : isCompactOverview ? "p-3 space-y-2.5" : "p-4 space-y-3.5"
                    }`}
                  >
                    {/* Room Header */}
                    <div className="border-b border-border/60 pb-2.5 space-y-1.5 w-full">
                      {/* Row 1: Title + Active Counter */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-display font-extrabold text-foreground tracking-tight truncate ${isLargeFocus ? "text-base" : "text-sm"}`}>
                          {room.room_name || `Room ${room.room_number}`}
                        </span>
                        <span
                          className={`font-mono text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${
                            roomOccupied === roomBeds.length && roomBeds.length > 0
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : roomOccupied > 0
                              ? "bg-warning/10 text-warning-foreground border-warning/20"
                              : "bg-success/10 text-success border-success/20"
                          }`}
                        >
                          {roomOccupied}/{roomBeds.length} Active
                        </span>
                      </div>

                      {/* Row 2: Type Pill + Location */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shrink-0 whitespace-nowrap ${typeStyle.bg} ${typeStyle.text}`}
                        >
                          {typeStyle.label}
                        </span>
                        {room.nurse_station && (
                          <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 shrink-0 truncate">
                            <MapPin className="h-2.5 w-2.5 text-primary shrink-0" />
                            {room.nurse_station}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bed Stations List */}
                    <div className={`w-full ${isLargeFocus ? "space-y-3" : isCompactOverview ? "space-y-2" : "space-y-2.5"}`}>
                      {roomBeds.map((bed) => {
                        const theme = BED_THEME[bed.status] || BED_THEME.available;
                        const isOccupied = bed.status === "occupied";

                        return (
                          <button
                            key={bed.bed_id}
                            type="button"
                            onClick={() => onSelectBed(bed)}
                            className={`w-full rounded-2xl border text-left transition-all duration-150 transform-gpu hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] relative overflow-hidden flex flex-col shadow-2xs ${theme.bg} ${theme.border} ${theme.glow} ${
                              isLargeFocus ? "p-4 gap-2.5" : isCompactOverview ? "p-2.5 gap-1.5" : "p-3 sm:p-3.5 gap-2"
                            }`}
                          >
                            {/* Station Header */}
                            <div className="flex items-center justify-between gap-2 w-full">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className={`shrink-0 flex items-center justify-center rounded-xl bg-card border border-border/80 shadow-2xs ${
                                  isLargeFocus ? "h-8 w-8" : "h-7 w-7"
                                }`}>
                                  <Bed className={`h-3.5 w-3.5 ${theme.text}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className={`font-display font-black text-foreground tracking-tight truncate ${isLargeFocus ? "text-sm" : "text-xs"}`}>
                                    Station {bed.bed_number}
                                  </div>
                                  <div className="text-[10px] font-medium text-muted-foreground truncate">
                                    {bed.bed_type || "Standard Bed"}
                                  </div>
                                </div>
                              </div>

                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border shrink-0 whitespace-nowrap bg-card/90 ${theme.text}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${theme.dot} ${isOccupied ? "animate-pulse" : ""}`} />
                                {theme.label}
                              </span>
                            </div>

                            {/* Station Details */}
                            {isOccupied ? (
                              <div className="space-y-2 pt-2 border-t border-border/40 w-full">
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-extrabold text-[9px]">
                                      {(bed.patient_name || "P")[0]}
                                    </div>
                                    <span className={`font-display font-extrabold text-foreground truncate ${isLargeFocus ? "text-sm" : "text-xs"}`}>
                                      {bed.patient_name || "Assigned Patient"}
                                    </span>
                                  </div>

                                  {bed.patient_condition && (
                                    <span
                                      className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[9px] font-black uppercase shrink-0 whitespace-nowrap ${
                                        bed.patient_condition === "Critical"
                                          ? "bg-destructive/15 text-destructive border border-destructive/30"
                                          : bed.patient_condition === "Recovery"
                                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-300"
                                          : "bg-success/15 text-success border border-success/30"
                                      }`}
                                    >
                                      {bed.patient_condition}
                                    </span>
                                  )}
                                </div>

                                {/* Telemetry Vitals Mini Strip */}
                                {bed.vitals && (
                                  <div className={`flex items-center justify-between font-mono font-bold bg-card/90 rounded-lg p-2 border border-border/60 whitespace-nowrap overflow-hidden w-full ${
                                    isLargeFocus ? "text-xs" : "text-[10px]"
                                  }`}>
                                    <span className="flex items-center gap-1.5 text-primary shrink-0">
                                      <Heart className="h-3 w-3 text-rose-500 animate-pulse" />
                                      {bed.vitals.hr} bpm
                                    </span>
                                    <span className="text-muted-foreground shrink-0">
                                      {bed.vitals.bp}
                                    </span>
                                    <span className="text-teal-600 font-extrabold shrink-0">
                                      SpO2 {bed.vitals.spo2}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-semibold w-full">
                                <span className="flex items-center gap-1 text-success whitespace-nowrap truncate">
                                  <Sparkles className="h-3 w-3 shrink-0" /> Ready for allocation
                                </span>
                                <span className="text-[9px] font-mono whitespace-nowrap shrink-0">Clean & Ready</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
