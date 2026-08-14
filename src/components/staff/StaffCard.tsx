import {
  Stethoscope,
  User,
  Clock,
  MapPin,
  CheckCircle2,
  ChevronRight,
  Activity,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { GradientProgress } from "@/components/dashboard/GradientProgress";
import { Button } from "@/components/ui/button";

export interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  role: "doctor" | "nurse" | "specialist" | "staff";
  department: string;
  specialty?: string;
  primaryDid?: string;
  employeeId?: string;
  avatarUrl?: string;
  phone?: string;
  availability: "available" | "busy" | "oncall" | "off";
  currentShift?: {
    id: string;
    shiftName: string;
    startsAt: string;
    endsAt: string;
    unit: string;
    confirmed: boolean;
    role: string;
  };
  workload: {
    activePatients: number;
    maxCapacity: number;
    percentage: number;
    hoursThisWeek: number;
  };
  attendance?: {
    lastAction: "in" | "out";
    recordedAt: string;
    location?: string;
  };
}

interface StaffCardProps {
  staff: StaffMember;
  onSelect: (staff: StaffMember) => void;
}

export function StaffCard({ staff, onSelect }: StaffCardProps) {
  // Status mapping
  const statusConfig = {
    available: {
      label: "Available",
      dotCls: "bg-success animate-pulse",
      textCls: "text-success",
      badgeCls: "border-success/30 bg-success/10 text-success",
      accent: "success" as const,
    },
    busy: {
      label: "In Consult",
      dotCls: "bg-warning",
      textCls: "text-warning-foreground",
      badgeCls: "border-warning/30 bg-warning/15 text-warning-foreground",
      accent: "warning" as const,
    },
    oncall: {
      label: "On Call",
      dotCls: "bg-rose-500 animate-pulse",
      textCls: "text-rose-600 dark:text-rose-400",
      badgeCls: "border-destructive/30 bg-destructive/15 text-destructive",
      accent: "destructive" as const,
    },
    off: {
      label: "Off Duty",
      dotCls: "bg-muted-foreground/40",
      textCls: "text-muted-foreground",
      badgeCls: "border-border/80 bg-muted/40 text-muted-foreground",
      accent: "none" as const,
    },
  }[staff.availability] || {
    label: "Unknown",
    dotCls: "bg-muted-foreground",
    textCls: "text-muted-foreground",
    badgeCls: "border-border text-muted-foreground",
    accent: "none" as const,
  };

  // Initials generator
  const getInitials = (name: string) => {
    return (
      name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "MD"
    );
  };

  // Workload tone
  const workloadTone =
    staff.workload.percentage > 85
      ? "destructive"
      : staff.workload.percentage > 60
        ? "primary"
        : "success";

  // Clean time formatting (e.g. 08:00:00 -> 08:00)
  const formatTime = (t?: string) => {
    if (!t) return "";
    const parts = t.split(":");
    return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : t;
  };

  return (
    <GlowCard
      accent={statusConfig.accent}
      glowOnHover={true}
      className="p-5 flex flex-col justify-between h-full space-y-4 cursor-pointer hover:border-primary/50 transition-all group"
    >
      {/* Top Section: Avatar + Name + Badges */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Avatar Initials with Status Dot */}
            <div className="relative shrink-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary font-display font-extrabold text-sm shadow-xs border border-primary/20">
                {getInitials(staff.fullName)}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${statusConfig.dotCls}`}
              />
            </div>

            {/* Name + Department */}
            <div className="min-w-0 flex-1">
              <h3 className="font-display font-extrabold text-base text-foreground tracking-tight truncate group-hover:text-primary transition-colors">
                {staff.fullName}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium truncate mt-0.5">
                <span>{staff.department}</span>
                {staff.specialty && (
                  <>
                    <span className="text-border/80">•</span>
                    <span className="truncate">{staff.specialty}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Availability Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold shrink-0 ${statusConfig.badgeCls}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotCls}`} />
            {statusConfig.label}
          </span>
        </div>

        {/* Role and DID Tag Line */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase">
            {staff.role}
          </span>
          {staff.primaryDid && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 border border-border/60 px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground truncate max-w-[170px]">
              <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
              {staff.primaryDid.slice(0, 16)}...
            </span>
          )}
        </div>
      </div>

      {/* Mid Section: Shift & Location with clean 2-column layout */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
            <Clock className="h-3 w-3 text-primary shrink-0" /> Shift
          </div>
          <div className="font-mono text-xs font-bold text-foreground truncate">
            {staff.currentShift
              ? `${formatTime(staff.currentShift.startsAt)} – ${formatTime(staff.currentShift.endsAt)}`
              : "Off Duty"}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
            <MapPin className="h-3 w-3 text-teal-500 shrink-0" /> Station
          </div>
          <div
            className="text-xs font-semibold text-foreground truncate"
            title={staff.currentShift?.unit || staff.attendance?.location || "Unassigned"}
          >
            {staff.currentShift?.unit || staff.attendance?.location || "Unassigned"}
          </div>
        </div>
      </div>

      {/* Workload Capacity Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Activity className="h-3 w-3 text-primary" /> Patient Load
          </span>
          <span className="font-mono text-[11px] font-bold text-foreground">
            {staff.workload.activePatients} / {staff.workload.maxCapacity} (
            {staff.workload.percentage}%)
          </span>
        </div>
        <GradientProgress value={staff.workload.percentage} tone={workloadTone} height={6} />
      </div>

      {/* Bottom Footer Action */}
      <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
        <div className="text-[11px] text-muted-foreground font-medium truncate">
          {staff.workload.hoursThisWeek}h logged this week
        </div>

        <Button
          onClick={() => onSelect(staff)}
          variant="outline"
          size="sm"
          className="rounded-xl text-xs font-bold h-8 px-3 gap-1 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all shrink-0"
        >
          View Details
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </GlowCard>
  );
}
