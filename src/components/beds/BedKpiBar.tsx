import { KpiTile } from "@/components/dashboard/KpiTile";
import { Bed, Activity, CheckCircle2, Wrench } from "lucide-react";

interface BedKpiBarProps {
  bedStats: {
    total?: number;
    available?: number;
    occupied?: number;
    reserved?: number;
    cleaning?: number;
    maintenance?: number;
    blocked?: number;
    emergency_reserved?: number;
  };
  roomStats?: {
    total?: number;
    available?: number;
    occupied?: number;
  };
  gridClassName?: string;
}

export function BedKpiBar({
  bedStats,
  gridClassName = "grid gap-4 grid-cols-1 sm:grid-cols-2",
}: BedKpiBarProps) {
  const total = bedStats.total || 0;
  const occupied = bedStats.occupied || 0;
  const available = bedStats.available || 0;
  const maintenance = (bedStats.maintenance || 0) + (bedStats.cleaning || 0);

  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <div className={gridClassName}>
      <KpiTile
        label="Total Beds"
        value={total}
        delta={`${occupied} occupied · ${available} free`}
        icon={Bed}
        tone="default"
        className="h-full"
      />
      <KpiTile
        label="Occupancy Rate"
        value={`${occupancyRate}%`}
        delta={`${total - occupied} beds available`}
        icon={Activity}
        tone={occupancyRate > 85 ? "warning" : "default"}
        className="h-full"
      />
      <KpiTile
        label="Available Now"
        value={available}
        delta="Ready for admission"
        icon={CheckCircle2}
        tone="success"
        className="h-full"
      />
      <KpiTile
        label="Under Service"
        value={maintenance}
        delta={`${bedStats.cleaning || 0} cleaning · ${bedStats.maintenance || 0} repair`}
        icon={Wrench}
        tone={maintenance > 0 ? "warning" : "default"}
        className="h-full"
      />
    </div>
  );
}
