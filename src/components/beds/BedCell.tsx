import { Bed as BedIcon } from "lucide-react";

interface BedCellProps {
  bed: any;
  onClick: (e: React.MouseEvent) => void;
}

const BED_STATUS_STYLES: Record<string, { dot: string; bg: string; border: string; text: string }> =
  {
    available: {
      dot: "bg-success",
      bg: "bg-success/5 hover:bg-success/15",
      border: "border-success/30",
      text: "text-success",
    },
    occupied: {
      dot: "bg-primary",
      bg: "bg-primary/5 hover:bg-primary/15",
      border: "border-primary/30",
      text: "text-primary",
    },
    reserved: {
      dot: "bg-warning",
      bg: "bg-warning/10 hover:bg-warning/20",
      border: "border-warning/30",
      text: "text-warning-foreground",
    },
    // `cleaning` takes the teal-blue chart hue so it stays distinguishable from
    // `reserved` (warning) — collapsing both onto warning would make two
    // different bed states look identical on the ward grid.
    cleaning: {
      dot: "bg-chart-4",
      bg: "bg-chart-4/10 hover:bg-chart-4/20",
      border: "border-chart-4/30",
      text: "text-chart-4",
    },
    maintenance: {
      dot: "bg-chart-3",
      bg: "bg-chart-3/10 hover:bg-chart-3/20",
      border: "border-chart-3/30",
      text: "text-chart-3",
    },
    blocked: {
      dot: "bg-destructive",
      bg: "bg-destructive/10 hover:bg-destructive/20",
      border: "border-destructive/30",
      text: "text-destructive",
    },
    // Genuinely urgent, so it shares `destructive` with `blocked` but keeps the
    // pulse to tell them apart.
    emergency_reserved: {
      dot: "bg-destructive animate-pulse",
      bg: "bg-destructive/10 hover:bg-destructive/20",
      border: "border-destructive/40",
      text: "text-destructive",
    },
  };

export function BedCell({ bed, onClick }: BedCellProps) {
  const status = bed.status || "available";
  const style = BED_STATUS_STYLES[status] || BED_STATUS_STYLES.available;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group/bed flex items-center justify-between p-2 rounded-xl border transition-all duration-200 shadow-xs text-left ${style.bg} ${style.border}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2 w-2 rounded-full shrink-0 ${style.dot}`} />
        <BedIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-mono text-xs font-extrabold text-foreground truncate">
          {bed.bed_number || bed.bed_id}
        </span>
      </div>

      <span
        className={`text-[10px] font-extrabold uppercase tracking-wider shrink-0 ml-1 ${style.text}`}
      >
        {bed.bed_type || status}
      </span>
    </button>
  );
}
