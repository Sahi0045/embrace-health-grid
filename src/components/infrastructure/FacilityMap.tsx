import { motion } from "framer-motion";
import { Building2, Bed, Activity, Ambulance, Stethoscope } from "lucide-react";

interface FacilityZone {
  id: string;
  label: string;
  type: "ward" | "icu" | "emergency" | "surgery" | "radiology" | "pharmacy" | "admin" | "parking";
  floor: number;
  occupancy?: number;
  capacity?: number;
  status: "active" | "busy" | "closed" | "maintenance";
  color?: string;
}

interface FacilityMapProps {
  buildingName?: string;
  zones: FacilityZone[];
  selectedZone?: string;
  onZoneClick?: (zone: FacilityZone) => void;
}

const typeColors: Record<FacilityZone["type"], string> = {
  ward: "bg-primary/10 border-primary/30 hover:bg-primary/20",
  icu: "bg-destructive/10 border-destructive/30 hover:bg-destructive/20",
  emergency: "bg-destructive/15 border-destructive/40 hover:bg-destructive/25",
  surgery: "bg-chart-2/10 border-chart-2/30 hover:bg-chart-2/20",
  radiology: "bg-chart-4/10 border-chart-4/30 hover:bg-chart-4/20",
  pharmacy: "bg-success/10 border-success/30 hover:bg-success/20",
  admin: "bg-muted border-border hover:bg-muted/80",
  parking: "bg-muted/60 border-border",
};

const statusBadge: Record<FacilityZone["status"], string> = {
  active: "bg-success/15 text-success",
  busy: "bg-warning/15 text-warning-foreground",
  closed: "bg-muted text-muted-foreground",
  maintenance: "bg-destructive/10 text-destructive",
};

const typeIcon: Record<FacilityZone["type"], React.ComponentType<{ className?: string }>> = {
  ward: Bed,
  icu: Activity,
  emergency: Ambulance,
  surgery: Stethoscope,
  radiology: Building2,
  pharmacy: Building2,
  admin: Building2,
  parking: Building2,
};

export function FacilityMap({ buildingName = "Main Block", zones, selectedZone, onZoneClick }: FacilityMapProps) {
  const floors = [...new Set(zones.map(z => z.floor))].sort((a, b) => b - a);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{buildingName}</span>
        <span className="text-xs text-muted-foreground ml-1">— Facility Map</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4 text-[10px]">
        {(["ward", "icu", "emergency", "surgery", "radiology", "pharmacy"] as const).map(type => (
          <div key={type} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${typeColors[type].split(" ").slice(0, 2).join(" ")}`}>
            <div className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
            <span className="capitalize text-foreground">{type}</span>
          </div>
        ))}
      </div>

      {/* Floor-by-floor layout */}
      <div className="space-y-3">
        {floors.map(floor => (
          <div key={floor}>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {floor === 0 ? "Ground Floor" : `Floor ${floor}`}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {zones.filter(z => z.floor === floor).map(zone => {
                const Icon = typeIcon[zone.type];
                const isSelected = zone.id === selectedZone;
                const pct = zone.occupancy != null && zone.capacity ? Math.round(zone.occupancy / zone.capacity * 100) : null;

                return (
                  <motion.button
                    key={zone.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onZoneClick?.(zone)}
                    className={`rounded-xl border p-3 text-left transition-all ${typeColors[zone.type]} ${isSelected ? "ring-2 ring-primary" : ""} ${onZoneClick ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon className="h-3.5 w-3.5 text-foreground/60" />
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusBadge[zone.status]}`}>
                        {zone.status}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-foreground leading-tight">{zone.label}</div>
                    {pct !== null && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                          <span>{zone.occupancy}/{zone.capacity}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-background/50">
                          <div
                            className={`h-full rounded-full transition-all ${pct > 90 ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-success"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
