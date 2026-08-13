import { DonutChart } from "@/components/dashboard/MiniChart";
import { GlowCard } from "@/components/dashboard/GlowCard";

interface BedStatusDonutProps {
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
}

export function BedStatusDonut({ bedStats }: BedStatusDonutProps) {
  const available = bedStats.available || 0;
  const occupied = bedStats.occupied || 0;
  const reserved = (bedStats.reserved || 0) + (bedStats.emergency_reserved || 0);
  const maintenance = (bedStats.maintenance || 0) + (bedStats.cleaning || 0);
  const blocked = bedStats.blocked || 0;

  const data = [
    { name: "Available", value: available, color: "var(--color-success, #10b981)" },
    { name: "Occupied", value: occupied, color: "var(--color-primary, #3b82f6)" },
    { name: "Reserved", value: reserved, color: "#06b6d4" },
    { name: "Maintenance", value: maintenance, color: "var(--color-warning, #f59e0b)" },
    { name: "Blocked", value: blocked, color: "var(--color-destructive, #ef4444)" },
  ];

  return (
    <GlowCard accent="primary" glowOnHover={false} className="h-full p-5 flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Bed Distribution Breakdown
          </span>
        </div>
        <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-extrabold text-primary">
          {bedStats.total || 0} Total Beds
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center my-1">
        <DonutChart
          data={data}
          centerLabel={String(available)}
          centerSublabel="Available"
          height={160}
          innerRadius={48}
          outerRadius={68}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-border/60">
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20 text-[10px] font-extrabold">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span>Available ({available})</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-extrabold">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span>Occupied ({occupied})</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-warning/15 text-warning-foreground border border-warning/30 text-[10px] font-extrabold">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          <span>Service ({maintenance})</span>
        </div>
      </div>
    </GlowCard>
  );
}
