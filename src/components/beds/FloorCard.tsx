import { GlowCard } from "@/components/dashboard/GlowCard";
import { Layers, Home, Bed, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloorCardProps {
  floor: any;
  wardsCount: number;
  roomsCount: number;
  bedsCount: number;
  onSelect: () => void;
  onAddWard: (e: React.MouseEvent) => void;
}

export function FloorCard({
  floor,
  wardsCount,
  roomsCount,
  bedsCount,
  onSelect,
  onAddWard,
}: FloorCardProps) {
  return (
    <div onClick={onSelect} className="cursor-pointer">
      <GlowCard accent="primary" glowOnHover={true}>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                  {floor.floor_name}
                </h3>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Floor {floor.floor_number}
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/60 transition-transform group-hover:translate-x-1" />
          </div>

          {floor.description && (
            <p className="text-xs font-medium text-muted-foreground line-clamp-2">
              {floor.description}
            </p>
          )}

          {/* Metrics summary */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center">
            <div className="p-2 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[10px] font-extrabold uppercase text-muted-foreground">Wards</div>
              <div className="text-sm font-extrabold font-display text-foreground">{wardsCount}</div>
            </div>
            <div className="p-2 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[10px] font-extrabold uppercase text-muted-foreground">Rooms</div>
              <div className="text-sm font-extrabold font-display text-foreground">{roomsCount}</div>
            </div>
            <div className="p-2 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[10px] font-extrabold uppercase text-muted-foreground">Beds</div>
              <div className="text-sm font-extrabold font-display text-foreground">{bedsCount}</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <span className="text-[11px] font-bold text-muted-foreground">
              {wardsCount} Wards Configured
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAddWard(e);
              }}
              className="h-7 px-2.5 rounded-xl text-xs font-bold shadow-xs hover:bg-accent"
            >
              <Plus className="h-3 w-3 mr-1" />
              Ward
            </Button>
          </div>
        </div>
      </GlowCard>
    </div>
  );
}
