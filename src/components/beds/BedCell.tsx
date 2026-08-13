import { Bed as BedIcon } from "lucide-react";

interface BedCellProps {
  bed: any;
  onClick: (e: React.MouseEvent) => void;
}

const BED_STATUS_STYLES: Record<string, { dot: string; bg: string; border: string; text: string }> = {
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
  cleaning: {
    dot: "bg-blue-500",
    bg: "bg-blue-500/10 hover:bg-blue-500/20",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-600 dark:text-blue-400",
  },
  maintenance: {
    dot: "bg-amber-500",
    bg: "bg-amber-500/10 hover:bg-amber-500/20",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-600 dark:text-amber-400",
  },
  blocked: {
    dot: "bg-destructive",
    bg: "bg-destructive/10 hover:bg-destructive/20",
    border: "border-destructive/30",
    text: "text-destructive",
  },
  emergency_reserved: {
    dot: "bg-red-600 animate-pulse",
    bg: "bg-red-500/10 hover:bg-red-500/20",
    border: "border-red-300 dark:border-red-800",
    text: "text-red-600 dark:text-red-400",
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

      <span className={`text-[10px] font-extrabold uppercase tracking-wider shrink-0 ml-1 ${style.text}`}>
        {bed.bed_type || status}
      </span>
    </button>
  );
}
