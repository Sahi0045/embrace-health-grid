import { motion } from "framer-motion";
import { Bed, User, Home, Activity, CheckCircle2, Shield, Wrench, Ban, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export interface FloorPlanGridProps {
  rooms: any[];
  beds: any[];
  wards: any[];
  zoom?: number;
  selectedWardId?: string | null;
  statusFilter?: string;
  searchQuery?: string;
  onSelectBed: (bed: any) => void;
  className?: string;
}

const BED_STATUS_CONFIG: Record<
  string,
  {
    bg: string;
    border: string;
    text: string;
    dot: string;
    label: string;
    icon: any;
  }
> = {
  available: {
    bg: "bg-success/10 hover:bg-success/20",
    border: "border-success/30 hover:border-success/50",
    text: "text-success",
    dot: "bg-success",
    label: "Available",
    icon: CheckCircle2,
  },
  occupied: {
    bg: "bg-primary/10 hover:bg-primary/20",
    border: "border-primary/30 hover:border-primary/50 ring-1 ring-primary/20",
    text: "text-primary",
    dot: "bg-primary",
    label: "Occupied",
    icon: User,
  },
  reserved: {
    bg: "bg-warning/10 hover:bg-warning/20",
    border: "border-warning/30 hover:border-warning/50",
    text: "text-warning-foreground",
    dot: "bg-warning",
    label: "Reserved",
    icon: Activity,
  },
  cleaning: {
    bg: "bg-blue-500/10 hover:bg-blue-500/20",
    border: "border-blue-400/30 hover:border-blue-400/50",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
    label: "Cleaning",
    icon: Activity,
  },
  maintenance: {
    bg: "bg-amber-500/10 hover:bg-amber-500/20",
    border: "border-amber-400/30 hover:border-amber-400/50",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    label: "Maint",
    icon: Wrench,
  },
  blocked: {
    bg: "bg-destructive/10 hover:bg-destructive/20",
    border: "border-destructive/30 hover:border-destructive/50",
    text: "text-destructive",
    dot: "bg-destructive",
    label: "Blocked",
    icon: Ban,
  },
  emergency_reserved: {
    bg: "bg-rose-500/10 hover:bg-rose-500/20",
    border: "border-rose-400/30 hover:border-rose-400/50",
    text: "text-rose-600",
    dot: "bg-rose-500",
    label: "Emergency",
    icon: Shield,
  },
};

const ROOM_TYPE_BADGES: Record<string, { bg: string; text: string }> = {
  icu: { bg: "bg-destructive/15 border-destructive/30", text: "text-destructive" },
  emergency: { bg: "bg-rose-500/15 border-rose-500/30", text: "text-rose-600" },
  general: { bg: "bg-primary/10 border-primary/20", text: "text-primary" },
  private: { bg: "bg-indigo-500/10 border-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400" },
  isolation: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-600" },
  operating: { bg: "bg-teal-500/15 border-teal-500/30", text: "text-teal-600" },
  recovery: { bg: "bg-cyan-500/15 border-cyan-500/30", text: "text-cyan-600" },
};

export function FloorPlanGrid({
  rooms,
  beds,
  wards,
  zoom = 1,
  selectedWardId,
  statusFilter = "all",
  searchQuery = "",
  onSelectBed,
  className = "",
}: FloorPlanGridProps) {
  // Filter rooms
  const filteredRooms = rooms.filter((room) => {
    // Ward filter
    if (selectedWardId && room.ward_id !== selectedWardId) {
      return false;
    }

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchRoom =
        (room.room_name || "").toLowerCase().includes(q) ||
        (room.room_number || "").toLowerCase().includes(q) ||
        (room.room_type || "").toLowerCase().includes(q);

      const roomBeds = beds.filter((b) => b.room_id === room.room_id);
      const matchBed = roomBeds.some(
        (b) =>
          (b.bed_number || "").toLowerCase().includes(q) ||
          (b.patient_did || "").toLowerCase().includes(q),
      );

      if (!matchRoom && !matchBed) return false;
    }

    // Status filter
    if (statusFilter !== "all") {
      const roomBeds = beds.filter((b) => b.room_id === room.room_id);
      const hasBedWithStatus = roomBeds.some((b) => b.status === statusFilter);
      if (!hasBedWithStatus && room.status !== statusFilter) {
        return false;
      }
    }

    return true;
  });

  if (filteredRooms.length === 0) {
    return (
      <EmptyState
        icon={Home}
        title="No Rooms Found on this Floor"
        description={
          searchQuery || statusFilter !== "all" || selectedWardId
            ? "Try clearing filters to view all clinical rooms and bed allocations."
            : "No rooms are currently configured on this floor plan."
        }
      />
    );
  }

  return (
    <div className={`w-full overflow-x-auto overflow-y-visible rounded-2xl border border-border/80 bg-background/50 p-4 sm:p-6 shadow-clinical-sm ${className}`}>
      {/* Zoom transform wrapper */}
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
          width: zoom > 1 ? `${zoom * 100}%` : "100%",
          transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
      >
        {filteredRooms.map((room) => {
          const roomBeds = beds.filter((b) => b.room_id === room.room_id);
          const ward = wards.find((w) => w.ward_id === room.ward_id);
          const roomTypeKey = (room.room_type || "general").toLowerCase();
          const typeBadge = ROOM_TYPE_BADGES[roomTypeKey] || ROOM_TYPE_BADGES.general;
          const occupiedCount = roomBeds.filter((b) => b.status === "occupied").length;
          const totalCount = roomBeds.length;

          return (
            <div
              key={room.room_id}
              className="rounded-2xl border border-border/80 bg-card p-4 shadow-clinical-sm hover:border-primary/40 hover:shadow-clinical transition-all flex flex-col justify-between space-y-4"
            >
              {/* Room Header */}
              <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-extrabold text-sm text-foreground tracking-tight">
                      {room.room_name || `Room ${room.room_number}`}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${typeBadge.bg} ${typeBadge.text}`}
                    >
                      {room.room_type || "Room"}
                    </span>
                  </div>
                  {ward && (
                    <span className="text-[10px] font-semibold text-muted-foreground block">
                      {ward.ward_name}
                    </span>
                  )}
                </div>

                {/* Capacity Counter */}
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold font-mono border ${
                      occupiedCount === totalCount && totalCount > 0
                        ? "bg-destructive/10 text-destructive border-destructive/20"
                        : occupiedCount > 0
                        ? "bg-warning/10 text-warning-foreground border-warning/20"
                        : "bg-success/10 text-success border-success/20"
                    }`}
                  >
                    {occupiedCount}/{totalCount}
                  </span>
                </div>
              </div>

              {/* Bed Slots Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                  <span>Bed Allocation</span>
                  <span>{totalCount} {totalCount === 1 ? "Slot" : "Slots"}</span>
                </div>

                {roomBeds.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground italic">
                    No beds placed in this room
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {roomBeds.map((bed) => {
                      const cfg = BED_STATUS_CONFIG[bed.status] || BED_STATUS_CONFIG.available;
                      const Icon = cfg.icon;

                      return (
                        <motion.button
                          key={bed.bed_id}
                          type="button"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => onSelectBed(bed)}
                          className={`rounded-xl border p-2 text-left transition-all flex flex-col justify-between gap-1.5 shadow-2xs ${cfg.bg} ${cfg.border}`}
                          title={`Bed ${bed.bed_number} (${cfg.label}) — Click to view details`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-1">
                              <Bed className={`h-3.5 w-3.5 ${cfg.text}`} />
                              <span className="font-display font-extrabold text-xs text-foreground tracking-tight">
                                {bed.bed_number}
                              </span>
                            </div>
                            <span className={`h-2 w-2 rounded-full ${cfg.dot} shadow-xs`} />
                          </div>

                          <div className="flex items-center justify-between text-[9px] w-full pt-1 border-t border-border/30">
                            <span className={`font-extrabold uppercase tracking-wider ${cfg.text}`}>
                              {cfg.label}
                            </span>
                            {bed.status === "occupied" && (
                              <span className="font-mono text-[8px] font-bold text-muted-foreground truncate max-w-[50px]">
                                {bed.patient_did ? bed.patient_did.slice(-4) : "Patient"}
                              </span>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Room Bottom Bar */}
              <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground pt-2 border-t border-border/40">
                <span className="flex items-center gap-1">
                  <Home className="h-3 w-3" />
                  {room.room_number ? `#${room.room_number}` : "Main"}
                </span>
                <span className="capitalize font-semibold text-foreground/80">
                  {room.status || "Operational"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
