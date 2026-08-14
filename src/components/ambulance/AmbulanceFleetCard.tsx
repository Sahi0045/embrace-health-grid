import {
  Ambulance,
  MapPin,
  User,
  ShieldCheck,
  ChevronRight,
  Activity,
  Navigation,
  AlertTriangle,
  RotateCcw,
  Wrench,
  Radio,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AmbulanceRecord } from "@/lib/types";

interface AmbulanceFleetCardProps {
  ambulance: AmbulanceRecord;
  onSelect: (ambulance: AmbulanceRecord) => void;
}

const statusConfig: Record<
  string,
  {
    label: string;
    badgeCls: string;
    dotCls: string;
    accent: "primary" | "success" | "warning" | "destructive" | "none";
    icon: any;
  }
> = {
  available: {
    label: "Available",
    badgeCls: "border-success/30 bg-success/10 text-success",
    dotCls: "bg-success animate-pulse",
    accent: "success",
    icon: ShieldCheck,
  },
  "en-route": {
    label: "En Route",
    badgeCls: "border-warning/30 bg-warning/15 text-warning-foreground",
    dotCls: "bg-warning animate-pulse",
    accent: "warning",
    icon: Navigation,
  },
  "at-scene": {
    label: "At Scene",
    badgeCls: "border-destructive/30 bg-destructive/15 text-destructive",
    dotCls: "bg-destructive animate-pulse",
    accent: "destructive",
    icon: AlertTriangle,
  },
  returning: {
    label: "Returning",
    badgeCls: "border-primary/30 bg-primary/10 text-primary",
    dotCls: "bg-primary",
    accent: "primary",
    icon: RotateCcw,
  },
  maintenance: {
    label: "Maintenance",
    badgeCls: "border-border/80 bg-muted/40 text-muted-foreground",
    dotCls: "bg-muted-foreground/40",
    accent: "none",
    icon: Wrench,
  },
};

const typeLabels: Record<string, { label: string; tone: string }> = {
  als: {
    label: "ALS · Advanced Life Support",
    tone: "text-primary border-primary/20 bg-primary/10",
  },
  bls: {
    label: "BLS · Basic Life Support",
    tone: "text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/10",
  },
  neonatal: {
    label: "NICU · Neonatal Critical Care",
    tone: "text-pink-600 dark:text-pink-400 border-pink-500/20 bg-pink-500/10",
  },
  air: {
    label: "Air Ambulance · Helicopter",
    tone: "text-purple-600 dark:text-purple-400 border-purple-500/20 bg-purple-500/10",
  },
};

export function AmbulanceFleetCard({ ambulance, onSelect }: AmbulanceFleetCardProps) {
  const cfg = statusConfig[ambulance.status] || statusConfig.available;
  const typeMeta = typeLabels[ambulance.type] || {
    label: ambulance.type.toUpperCase(),
    tone: "text-muted-foreground border-border/80 bg-muted/30",
  };

  return (
    <GlowCard
      accent={cfg.accent}
      glowOnHover={true}
      className="p-5 md:p-6 flex flex-col justify-between h-full group cursor-pointer"
      onClick={() => onSelect(ambulance)}
    >
      <div className="space-y-4">
        {/* Card Header: Icon, ID & Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-xs transition-transform group-hover:scale-105 ${
                ambulance.status === "at-scene"
                  ? "bg-destructive/15 text-destructive"
                  : ambulance.status === "en-route"
                    ? "bg-warning/20 text-warning-foreground"
                    : ambulance.status === "available"
                      ? "bg-success/15 text-success"
                      : "bg-primary/15 text-primary"
              }`}
            >
              <Ambulance className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-extrabold font-display text-foreground tracking-tight group-hover:text-primary transition-colors">
                {ambulance.vehicleNo || ambulance.registration || ambulance.id}
              </div>
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase mt-1 ${typeMeta.tone}`}
              >
                {typeMeta.label}
              </span>
            </div>
          </div>

          <Badge
            variant="outline"
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${cfg.badgeCls}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotCls}`} />
            {cfg.label}
          </Badge>
        </div>

        {/* Location & Mission Info */}
        <div className="space-y-2 rounded-xl border border-border/60 bg-background/60 p-3 shadow-xs text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="font-medium text-foreground truncate">
              {ambulance.location || "Hospital Base Station"}
            </span>
          </div>

          <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/40">
            <div className="flex items-center gap-1.5 truncate">
              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">
                Driver:{" "}
                <span className="font-semibold text-foreground">
                  {ambulance.driver || "Unassigned"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground shrink-0">
              <Radio className="h-3 w-3 text-success animate-pulse" />
              <span>Live GPS</span>
            </div>
          </div>
        </div>

        {/* DID Key Identification */}
        <div className="font-mono text-[10px] text-muted-foreground/60 truncate pt-1 border-t border-border/40 flex items-center justify-between">
          <span className="truncate">{ambulance.did || `did:hosp:ambulance:${ambulance.id}`}</span>
          <span className="text-[9px] uppercase font-extrabold tracking-wider text-muted-foreground/80 shrink-0 ml-2">
            Verified Asset
          </span>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="pt-4 mt-2 flex items-center justify-between gap-2 border-t border-border/60">
        <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
          View Telemetry & Logs
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(ambulance);
          }}
          className="rounded-xl h-8 px-3 text-xs font-bold gap-1 shadow-xs hover:bg-primary hover:text-primary-foreground transition-all"
        >
          Inspect
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </GlowCard>
  );
}
