import { GlowCard } from "@/components/dashboard/GlowCard";
import { Building2, Layers, Bed, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BuildingCardProps {
  building: any;
  floorsCount: number;
  wardsCount: number;
  bedsStats: { total: number; occupied: number; available: number };
  onSelect: () => void;
  onAddFloor: (e: React.MouseEvent) => void;
}

export function BuildingCard({
  building,
  floorsCount,
  wardsCount,
  bedsStats,
  onSelect,
  onAddFloor,
}: BuildingCardProps) {
  return (
    <div onClick={onSelect} className="cursor-pointer">
      <GlowCard accent="primary" glowOnHover={true}>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                  {building.building_name}
                </h3>
                {building.building_code && (
                  <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase">
                    Code: {building.building_code}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/60 transition-transform group-hover:translate-x-1" />
          </div>

          {building.description && (
            <p className="text-xs font-medium text-muted-foreground line-clamp-2">
              {building.description}
            </p>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center">
            <div className="p-2 rounded-xl bg-muted/40 border border-border/40">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Layers className="h-3.5 w-3.5" />
                <span className="text-[10px] font-extrabold uppercase">Floors</span>
              </div>
              <span className="text-sm font-extrabold font-display text-foreground">
                {floorsCount}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-muted/40 border border-border/40">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <span className="text-[10px] font-extrabold uppercase">Wards</span>
              </div>
              <span className="text-sm font-extrabold font-display text-foreground">
                {wardsCount}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-muted/40 border border-border/40">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Bed className="h-3.5 w-3.5" />
                <span className="text-[10px] font-extrabold uppercase">Beds</span>
              </div>
              <span className="text-sm font-extrabold font-display text-foreground">
                {bedsStats.total}
              </span>
            </div>
          </div>

          {/* Footer Action */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span>{bedsStats.available} Free</span>
              <span>·</span>
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span>{bedsStats.occupied} Occupied</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAddFloor(e);
              }}
              className="h-7 px-2.5 rounded-xl text-xs font-bold shadow-xs hover:bg-accent"
            >
              <Plus className="h-3 w-3 mr-1" />
              Floor
            </Button>
          </div>
        </div>
      </GlowCard>
    </div>
  );
}
