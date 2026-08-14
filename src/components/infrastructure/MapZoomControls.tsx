import { Plus, Minus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MapZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
}

export function MapZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  minZoom = 0.6,
  maxZoom = 1.5,
  className = "",
}: MapZoomControlsProps) {
  const percentage = Math.round(zoom * 100);

  return (
    <div
      className={`inline-flex items-center gap-1 bg-card/90 backdrop-blur-md border border-border/80 rounded-xl p-1 shadow-clinical-sm ${className}`}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onZoomOut}
        disabled={zoom <= minZoom}
        className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40"
        title="Zoom Out"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>

      <button
        type="button"
        onClick={onResetZoom}
        className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold text-foreground hover:bg-muted transition-colors"
        title="Reset Zoom (100%)"
      >
        {percentage}%
      </button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onZoomIn}
        disabled={zoom >= maxZoom}
        className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40"
        title="Zoom In"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <div className="h-4 w-px bg-border/60 mx-0.5" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onResetZoom}
        className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
        title="Reset to Default View"
      >
        <RotateCcw className="h-3 w-3" />
      </Button>
    </div>
  );
}
