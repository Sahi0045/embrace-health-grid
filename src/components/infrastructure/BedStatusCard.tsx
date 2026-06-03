import { Bed } from "lucide-react";
import type { BedRecord } from "@/lib/mock-infrastructure";

interface BedStatusCardProps {
  bed: BedRecord;
}

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  available: { label: "Available", className: "border-success/30 bg-success/5", dot: "bg-success" },
  occupied: { label: "Occupied", className: "border-primary/30 bg-primary/5", dot: "bg-primary" },
  maintenance: { label: "Maintenance", className: "border-warning/30 bg-warning/5", dot: "bg-warning" },
  reserved: { label: "Reserved", className: "border-chart-2/30 bg-chart-2/5", dot: "bg-chart-2" },
};

export function BedStatusCard({ bed }: BedStatusCardProps) {
  const cfg = statusConfig[bed.status];

  return (
    <div className={`rounded-xl border p-3 transition-shadow hover:shadow-clinical ${cfg.className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bed className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{bed.bedNo}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
          <span className="text-[10px] text-muted-foreground">{cfg.label}</span>
        </div>
      </div>

      <div className="mt-2 text-xs text-muted-foreground">{bed.ward}</div>

      {bed.patientName && (
        <div className="mt-2 border-t border-border pt-2">
          <div className="text-xs font-medium text-foreground truncate">{bed.patientName}</div>
          <div className="text-[10px] text-muted-foreground">{bed.patientMRN} · {bed.admitDate}</div>
        </div>
      )}
    </div>
  );
}
