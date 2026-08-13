import { ChevronRight, Building2, Layers, Home, Hospital } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InfraBreadcrumbProps {
  selectedBuilding: any;
  selectedFloor: any;
  selectedWard: any;
  onReset: () => void;
  onSelectBuilding: () => void;
  onSelectFloor: () => void;
}

export function InfraBreadcrumb({
  selectedBuilding,
  selectedFloor,
  selectedWard,
  onReset,
  onSelectBuilding,
  onSelectFloor,
}: InfraBreadcrumbProps) {
  return (
    <div className="flex items-center flex-wrap gap-1.5 bg-card border border-border/80 p-3 rounded-2xl shadow-clinical-sm text-xs font-bold">
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="h-7 px-2 text-xs font-extrabold text-muted-foreground hover:text-foreground gap-1.5 rounded-xl"
      >
        <Hospital className="h-3.5 w-3.5 text-primary" />
        <span>All Buildings</span>
      </Button>

      {selectedBuilding && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onSelectBuilding}
            className={`h-7 px-2 text-xs font-extrabold gap-1.5 rounded-xl ${
              !selectedFloor
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span>{selectedBuilding.building_name}</span>
          </Button>
        </>
      )}

      {selectedFloor && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onSelectFloor}
            className={`h-7 px-2 text-xs font-extrabold gap-1.5 rounded-xl ${
              !selectedWard
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>{selectedFloor.floor_name}</span>
          </Button>
        </>
      )}

      {selectedWard && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-extrabold">
            <Home className="h-3.5 w-3.5" />
            <span>{selectedWard.ward_name}</span>
          </div>
        </>
      )}
    </div>
  );
}
