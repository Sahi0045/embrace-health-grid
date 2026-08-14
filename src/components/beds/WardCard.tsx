import { GlowCard } from "@/components/dashboard/GlowCard";
import { GradientProgress } from "@/components/dashboard/GradientProgress";
import { Home, Bed, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WardCardProps {
  ward: any;
  roomsCount: number;
  bedsStats: { total: number; occupied: number; available: number };
  onSelect: () => void;
  onAddRoom: (e: React.MouseEvent) => void;
}

const WARD_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ICU: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20" },
  Emergency: { bg: "bg-warning/15", text: "text-warning-foreground", border: "border-warning/30" },
  Pediatric: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/20",
  },
  Maternity: {
    bg: "bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/20",
  },
  General: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
};

export function WardCard({ ward, roomsCount, bedsStats, onSelect, onAddRoom }: WardCardProps) {
  const typeStyle = WARD_TYPE_COLORS[ward.ward_type || "General"] || WARD_TYPE_COLORS.General;

  // Utilization rate based on beds occupied vs total
  const utilization =
    bedsStats.total > 0 ? Math.round((bedsStats.occupied / bedsStats.total) * 100) : 0;
  const progressTone = utilization > 85 ? "destructive" : utilization > 60 ? "warning" : "success";

  return (
    <div onClick={onSelect} className="cursor-pointer">
      <GlowCard accent="primary" glowOnHover={true}>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm">
                <Home className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                  {ward.ward_name}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {ward.ward_code && (
                    <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                      {ward.ward_code}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
                  >
                    {ward.ward_type || "General"}
                  </span>
                </div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/60 transition-transform group-hover:translate-x-1" />
          </div>

          {/* Utilization progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-muted-foreground">Ward Occupancy</span>
              <span className="text-foreground font-mono">
                {utilization}% ({bedsStats.occupied}/{bedsStats.total} beds)
              </span>
            </div>
            <GradientProgress value={utilization} tone={progressTone} height={8} />
          </div>

          {/* Summary Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <span className="text-[11px] font-bold text-muted-foreground">
              {roomsCount} Rooms · {bedsStats.available} Available
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAddRoom(e);
              }}
              className="h-7 px-2.5 rounded-xl text-xs font-bold shadow-xs hover:bg-accent"
            >
              <Plus className="h-3 w-3 mr-1" />
              Room
            </Button>
          </div>
        </div>
      </GlowCard>
    </div>
  );
}
