import { GlowCard } from "@/components/dashboard/GlowCard";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  AlertTriangle,
  Package,
  Wrench,
  Bed,
  Ambulance,
  Siren,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  MapPin,
  Building2,
  Eye,
  Check,
} from "lucide-react";
import type { CentralAlert, AlertCategory, AlertSeverity } from "@/lib/types";

export interface AlertFeedCardProps {
  alert: CentralAlert;
  onAcknowledge: (alert: CentralAlert) => void;
  onResolve: (alert: CentralAlert) => void;
  onInspect: (alert: CentralAlert) => void;
  onJumpToSource: (alert: CentralAlert) => void;
  isUpdating?: boolean;
}

function getCategoryMeta(cat: AlertCategory) {
  switch (cat) {
    case "emergency":
      return {
        label: "Emergency Broadcast",
        icon: Siren,
        badgeStyle: "bg-destructive/15 text-destructive border-destructive/30",
      };
    case "bed_shortage":
      return {
        label: "Bed Capacity Alert",
        icon: Bed,
        badgeStyle: "bg-warning/20 text-warning-foreground border-warning/30",
      };
    case "low_stock":
      return {
        label: "Supply Low Stock",
        icon: Package,
        badgeStyle: "bg-destructive/15 text-destructive border-destructive/30",
      };
    case "near_expiry":
      return {
        label: "Near Expiry Alert",
        icon: Clock,
        badgeStyle: "bg-warning/20 text-warning-foreground border-warning/30",
      };
    case "equipment_failure":
      return {
        label: "Biomedical Asset",
        icon: Wrench,
        badgeStyle: "bg-chart-2/15 text-chart-2 border-chart-2/30",
      };
    case "ambulance":
      return {
        label: "Ambulance Telemetry",
        icon: Ambulance,
        badgeStyle: "bg-primary/15 text-primary border-primary/30",
      };
    case "security":
      return {
        label: "Security & Compliance",
        icon: ShieldAlert,
        badgeStyle: "bg-destructive/15 text-destructive border-destructive/30",
      };
    default:
      return {
        label: "Clinical Alert",
        icon: AlertTriangle,
        badgeStyle: "bg-primary/10 text-primary border-primary/20",
      };
  }
}

function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

export function AlertFeedCard({
  alert,
  onAcknowledge,
  onResolve,
  onInspect,
  onJumpToSource,
  isUpdating = false,
}: AlertFeedCardProps) {
  const meta = getCategoryMeta(alert.category);
  const Icon = meta.icon;

  const glowAccent =
    alert.severity === "critical"
      ? "destructive"
      : alert.severity === "warning"
        ? "warning"
        : "primary";

  return (
    <GlowCard accent={glowAccent} className="p-5 md:p-6 space-y-4">
      {/* Header: Category Badge + Severity Status Dot + Timestamp */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Category Pill */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${meta.badgeStyle}`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{meta.label}</span>
          </span>

          {/* Severity Indicator */}
          <div className="flex items-center gap-1.5 bg-background/80 border border-border/80 rounded-full px-2.5 py-0.5">
            <span
              className={`h-2 w-2 rounded-full ${
                alert.severity === "critical"
                  ? "bg-destructive animate-pulse"
                  : alert.severity === "warning"
                    ? "bg-warning"
                    : "bg-primary"
              }`}
            />
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">
              {alert.severity}
            </span>
          </div>

          {/* Status Badge */}
          {alert.status === "acknowledged" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase">
              <Check className="h-3 w-3" />
              <span>Acknowledged</span>
            </span>
          )}

          {alert.status === "resolved" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-success/15 border border-success/30 px-2 py-0.5 text-[10px] font-extrabold text-success uppercase">
              <CheckCircle2 className="h-3 w-3" />
              <span>Resolved</span>
            </span>
          )}
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatRelativeTime(alert.created_at)}</span>
          <span className="text-border">·</span>
          <span className="font-mono text-[10px] opacity-75">
            {new Date(alert.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* Main Alert Payload Body */}
      <div className="space-y-1.5">
        <h3 className="font-display font-extrabold text-base text-foreground tracking-tight flex items-center gap-2">
          {alert.title}
        </h3>
        <p className="text-xs font-medium text-muted-foreground leading-relaxed">{alert.message}</p>
      </div>

      {/* Metadata Badges (Department, Location, Actor, etc.) */}
      <div className="flex items-center gap-3 flex-wrap pt-1 text-[11px] font-medium text-muted-foreground">
        {alert.department && (
          <div className="flex items-center gap-1 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/60">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span>{alert.department}</span>
          </div>
        )}

        {alert.location && (
          <div className="flex items-center gap-1 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/60">
            <MapPin className="h-3.5 w-3.5 text-warning-foreground" />
            <span>{alert.location}</span>
          </div>
        )}

        {alert.actor && (
          <div className="flex items-center gap-1 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/60">
            <span className="font-bold text-foreground">Initiator:</span>
            <span>{alert.actor}</span>
          </div>
        )}

        <div className="ml-auto font-mono text-[10px] text-muted-foreground/80">
          Src: <span className="font-bold">{alert.source_table}</span>
        </div>
      </div>

      {/* Internal Divider */}
      <div className="border-t border-border/60 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Deep-link Action: Jump to Source with Spotlight */}
        {alert.target_url ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onJumpToSource(alert)}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 hover:border-primary/50 hover:bg-primary/5 text-primary shadow-xs"
          >
            <span>Jump to Source</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <div />
        )}

        {/* Context Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onInspect(alert)}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 hover:bg-accent"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Details</span>
          </Button>

          {alert.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              disabled={isUpdating}
              onClick={() => onAcknowledge(alert)}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Acknowledge</span>
            </Button>
          )}

          {alert.status !== "resolved" && (
            <Button
              variant="outline"
              size="sm"
              disabled={isUpdating}
              onClick={() => onResolve(alert)}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 border-success/40 bg-success/10 text-success hover:bg-success/20"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Resolve</span>
            </Button>
          )}
        </div>
      </div>
    </GlowCard>
  );
}
