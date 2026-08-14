import { CheckCircle2, User, Clock, Activity, Wrench, Ban, ShieldAlert } from "lucide-react";

export interface MapLegendProps {
  className?: string;
}

const LEGEND_ITEMS = [
  { label: "Available", color: "bg-success", text: "text-success", icon: CheckCircle2 },
  { label: "Occupied", color: "bg-primary", text: "text-primary", icon: User },
  { label: "Reserved", color: "bg-warning", text: "text-warning-foreground", icon: Clock },
  { label: "Cleaning", color: "bg-blue-500", text: "text-blue-500", icon: Activity },
  { label: "Maintenance", color: "bg-amber-500", text: "text-amber-500", icon: Wrench },
  { label: "Blocked", color: "bg-destructive", text: "text-destructive", icon: Ban },
  { label: "Emergency", color: "bg-rose-500", text: "text-rose-500", icon: ShieldAlert },
];

export function MapLegend({ className = "" }: MapLegendProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 text-xs ${className}`}>
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mr-1">
        Bed Status:
      </span>
      {LEGEND_ITEMS.map((item) => (
        <div
          key={item.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-2.5 py-0.5 shadow-2xs"
        >
          <span className={`h-2 w-2 rounded-full ${item.color}`} />
          <span className="text-[10px] font-extrabold text-foreground tracking-wide">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
