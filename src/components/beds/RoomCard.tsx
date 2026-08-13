import { GlowCard } from "@/components/dashboard/GlowCard";
import { BedCell } from "./BedCell";
import { Home, Plus, Edit2, CheckCircle2, Ban, Wrench, Clock, Users, Shield, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RoomCardProps {
  room: any;
  beds: any[];
  onSelectBed: (bed: any) => void;
  onUpdateRoomStatus: () => void;
  onAddBed: () => void;
}

const ROOM_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  available: { label: "Available", bg: "bg-success/10", text: "text-success", border: "border-success/20", icon: CheckCircle2 },
  occupied: { label: "Occupied", bg: "bg-primary/10", text: "text-primary", border: "border-primary/20", icon: Users },
  reserved: { label: "Reserved", bg: "bg-warning/10", text: "text-warning-foreground", border: "border-warning/20", icon: Clock },
  cleaning: { label: "Cleaning", bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-200", icon: Activity },
  maintenance: { label: "Maintenance", bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-200", icon: Wrench },
  blocked: { label: "Blocked", bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20", icon: Ban },
  emergency_reserved: { label: "Emergency", bg: "bg-red-600/10", text: "text-red-600 dark:text-red-400", border: "border-red-200", icon: Shield },
};

export function RoomCard({
  room,
  beds,
  onSelectBed,
  onUpdateRoomStatus,
  onAddBed,
}: RoomCardProps) {
  const statusCfg = ROOM_STATUS_CONFIG[room.status || "available"] || ROOM_STATUS_CONFIG.available;
  const StatusIcon = statusCfg.icon;

  return (
    <GlowCard accent="none" glowOnHover={false} className="h-full flex flex-col justify-between">
      <div className="p-5 space-y-4">
        {/* Room Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shrink-0">
              <Home className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                {room.room_name}
              </h3>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                {room.room_type || "General"} · No. {room.room_number || "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onUpdateRoomStatus}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition-colors ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
            >
              <StatusIcon className="h-3 w-3" />
              <span>{statusCfg.label}</span>
              <Edit2 className="h-2.5 w-2.5 ml-0.5 opacity-60 hover:opacity-100" />
            </button>
          </div>
        </div>

        {/* Beds Mini Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
            <span>Beds ({beds.length}/{room.capacity || 1})</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddBed}
              className="h-6 px-1.5 text-[10px] font-extrabold text-primary hover:bg-primary/10 rounded-lg gap-1"
            >
              <Plus className="h-3 w-3" />
              Add Bed
            </Button>
          </div>

          {beds.length === 0 ? (
            <div className="border border-dashed border-border/80 rounded-xl p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">No beds assigned</p>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddBed}
                className="mt-2 h-7 text-xs font-bold rounded-xl"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Bed
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {beds.map((bed) => (
                <BedCell
                  key={bed.bed_id}
                  bed={bed}
                  onClick={() => onSelectBed(bed)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </GlowCard>
  );
}
