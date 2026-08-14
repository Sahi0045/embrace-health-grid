import {
  Wrench,
  CheckCircle2,
  Activity,
  AlertTriangle,
  XCircle,
  Cpu,
  Layers,
  MapPin,
  Calendar,
  ShieldCheck,
  Zap,
  Gauge,
  Stethoscope,
  HeartPulse,
  Syringe,
  Wind,
  Radio,
  ChevronRight,
  Hash,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GradientProgress } from "@/components/dashboard/GradientProgress";
import { motion } from "framer-motion";
import type { EquipmentRecord } from "@/lib/types";

interface EquipmentGridCardProps {
  equipment: EquipmentRecord;
  onSelect: (equipment: EquipmentRecord) => void;
}

export function EquipmentGridCard({ equipment, onSelect }: EquipmentGridCardProps) {
  // Type icon mapping
  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "mri":
        return Radio;
      case "ct":
        return Cpu;
      case "ventilator":
        return Wind;
      case "defibrillator":
      case "ecg":
        return HeartPulse;
      case "ultrasound":
        return Activity;
      case "infusion":
      case "dialysis":
        return Syringe;
      default:
        return Stethoscope;
    }
  };

  const TypeIcon = getTypeIcon(equipment.type);

  // Status configuration
  const statusConfig = {
    operational: {
      label: "Operational",
      icon: CheckCircle2,
      dotClass: "bg-success",
      badgeClass: "bg-success/10 text-success border-success/30",
      tone: "success" as const,
    },
    "in-use": {
      label: "In Active Use",
      icon: Activity,
      dotClass: "bg-cyan-500 animate-pulse",
      badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
      tone: "cyan" as const,
    },
    maintenance: {
      label: "Maintenance",
      icon: AlertTriangle,
      dotClass: "bg-warning",
      badgeClass: "bg-warning/10 text-warning-foreground dark:text-amber-400 border-warning/30",
      tone: "warning" as const,
    },
    offline: {
      label: "Offline / Staged",
      icon: XCircle,
      dotClass: "bg-destructive",
      badgeClass: "bg-destructive/10 text-destructive border-destructive/30",
      tone: "destructive" as const,
    },
  }[equipment.status] || {
    label: equipment.status,
    icon: CheckCircle2,
    dotClass: "bg-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground border-border",
    tone: "primary" as const,
  };

  // Utilization progress tone
  const getUtilizationTone = (val: number) => {
    if (val >= 80) return "primary";
    if (val >= 40) return "cyan";
    if (val > 0) return "success";
    return "warning";
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.012 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      onClick={() => onSelect(equipment)}
      className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 sm:p-5.5 shadow-clinical-sm hover:border-primary/40 hover:shadow-clinical-md transition-all relative flex flex-col justify-between"
    >
      <div className="space-y-4">
        {/* ─── 1. Top Meta Bar: ID + Type Pill (Left) & Status Badge (Right) ─ */}
        <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-[10px] font-extrabold text-foreground bg-muted/80 border border-border/60 px-2 py-0.5 rounded-md truncate shrink-0">
              {equipment.id}
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md truncate shrink-0">
              {equipment.type}
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold shrink-0 ${statusConfig.badgeClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotClass}`} />
            {statusConfig.label}
          </span>
        </div>

        {/* ─── 2. Main Identity: Large Modality Icon + Title + Manufacturer ── */}
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs group-hover:scale-105 transition-transform">
            <TypeIcon className="h-5.5 w-5.5" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-display font-extrabold text-base text-foreground tracking-tight leading-snug line-clamp-1 group-hover:text-primary transition-colors">
              {equipment.name}
            </h3>
            <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">
              <span className="font-semibold text-foreground/90">{equipment.manufacturer}</span>
              <span className="mx-1.5 text-muted-foreground/40">·</span>
              <span>{equipment.model}</span>
            </p>
          </div>
        </div>

        {/* ─── 3. Structured Clinical Location & Serial Box ─────────────────── */}
        <div className="rounded-xl bg-muted/30 border border-border/50 p-3 space-y-2 text-xs">
          {/* Department */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
              <Layers className="h-3.5 w-3.5 text-primary/70" />
              <span>Department:</span>
            </div>
            <span className="font-semibold text-foreground truncate text-right">
              {equipment.department}
            </span>
          </div>

          {/* Location / Ward */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
              <MapPin className="h-3.5 w-3.5 text-primary/70" />
              <span>Location:</span>
            </div>
            <span className="text-muted-foreground font-medium truncate text-right">
              Floor {equipment.floor} · {equipment.assignedWard || equipment.location}
            </span>
          </div>

          {/* Serial Number */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
            <span className="text-muted-foreground">Serial Number:</span>
            <span className="font-mono font-bold text-foreground">
              {equipment.serial}
            </span>
          </div>
        </div>

        {/* ─── 4. Live Utilization Telemetry ───────────────────────────────── */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Clinical Utilization
            </span>
            <span className="font-display font-extrabold text-foreground">
              {equipment.utilization}%
            </span>
          </div>
          <GradientProgress
            value={equipment.utilization}
            tone={getUtilizationTone(equipment.utilization)}
            height={6}
          />
        </div>
      </div>

      {/* ─── 5. Footer Row: Maintenance Timeline + Quick Action ─────────────── */}
      <div className="mt-4 pt-3.5 border-t border-border/60 flex items-center justify-between gap-3 text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground truncate">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
          <span className="truncate">
            Service:{" "}
            <strong className="text-foreground font-semibold">
              {equipment.nextMaintenance || "Scheduled"}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-1 text-primary font-bold text-xs shrink-0 group-hover:translate-x-0.5 transition-transform">
          <span>Manage</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </motion.div>
  );
}
