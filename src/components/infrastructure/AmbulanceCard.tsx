import { Ambulance, MapPin, User } from "lucide-react";
import type { AmbulanceRecord } from "@/lib/types";

interface AmbulanceCardProps {
  ambulance: AmbulanceRecord;
}

const statusConfig: Record<string, { label: string; badge: string; dot: string }> = {
  available: { label: "Available", badge: "bg-success/10 text-success", dot: "bg-success" },
  "en-route": { label: "En Route", badge: "bg-warning/10 text-warning-foreground", dot: "bg-warning" },
  "at-scene": { label: "At Scene", badge: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  returning: { label: "Returning", badge: "bg-primary/10 text-primary", dot: "bg-primary" },
  maintenance: { label: "Maintenance", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

const typeLabels: Record<string, string> = {
  als: "ALS",
  bls: "BLS",
  neonatal: "Neonatal",
  air: "Air Ambulance",
};

export function AmbulanceCard({ ambulance }: AmbulanceCardProps) {
  const cfg = statusConfig[ambulance.status];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
            <Ambulance className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{ambulance.vehicleNo}</div>
            <div className="text-[11px] text-muted-foreground">{typeLabels[ambulance.type]}</div>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${cfg.badge}`}>
          <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{ambulance.location}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3 shrink-0" />
          <span>{ambulance.driver} · {ambulance.paramedic}</span>
        </div>
      </div>

      <div className="mt-2 font-mono text-[10px] text-muted-foreground/50 truncate">{ambulance.did}</div>
    </div>
  );
}
