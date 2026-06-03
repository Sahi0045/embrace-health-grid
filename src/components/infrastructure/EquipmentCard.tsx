import { Wrench, CheckCircle, AlertTriangle, XCircle, Activity } from "lucide-react";
import type { EquipmentRecord } from "@/lib/mock-infrastructure";

interface EquipmentCardProps {
  equipment: EquipmentRecord;
}

const statusConfig = {
  operational: { label: "Operational", icon: CheckCircle, className: "text-success", badge: "bg-success/10 text-success" },
  "in-use": { label: "In Use", icon: Activity, className: "text-primary", badge: "bg-primary/10 text-primary" },
  maintenance: { label: "Maintenance", icon: Wrench, className: "text-warning-foreground", badge: "bg-warning/10 text-warning-foreground" },
  offline: { label: "Offline", icon: XCircle, className: "text-destructive", badge: "bg-destructive/10 text-destructive" },
};

export function EquipmentCard({ equipment }: EquipmentCardProps) {
  const cfg = statusConfig[equipment.status];
  const Icon = cfg.icon;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{equipment.name}</div>
          <div className="text-xs text-muted-foreground">{equipment.manufacturer} · {equipment.model}</div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0 ${cfg.badge}`}>
          <Icon className="h-3 w-3" />
          {cfg.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        <div><span className="text-muted-foreground/70">Dept:</span> {equipment.department}</div>
        <div><span className="text-muted-foreground/70">Floor:</span> {equipment.floor}</div>
        <div><span className="text-muted-foreground/70">S/N:</span> {equipment.serial}</div>
        <div><span className="text-muted-foreground/70">Next maint:</span> {equipment.nextMaintenance}</div>
      </div>

      <div className="mt-2 font-mono text-[10px] text-muted-foreground/50 truncate">{equipment.did}</div>
    </div>
  );
}
