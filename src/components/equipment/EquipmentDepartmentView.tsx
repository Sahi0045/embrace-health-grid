import {
  Radio,
  Activity,
  Zap,
  Layers,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  Syringe,
  Wind,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { GradientProgress } from "@/components/dashboard/GradientProgress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import type { EquipmentRecord } from "@/lib/types";

interface EquipmentDepartmentViewProps {
  equipment: EquipmentRecord[];
  onSelectEquipment: (eq: EquipmentRecord) => void;
}

export function EquipmentDepartmentView({
  equipment,
  onSelectEquipment,
}: EquipmentDepartmentViewProps) {
  // Define Clinical Department Clusters
  const clusters = [
    {
      id: "radiology",
      name: "Radiology & Diagnostic Imaging Suite",
      location: "Building A · Floor 1",
      icon: Radio,
      tone: "primary",
      filterFn: (e: EquipmentRecord) =>
        (e.department || "").toLowerCase().includes("radiology") ||
        e.type === "mri" ||
        e.type === "ct" ||
        e.type === "xray" ||
        e.type === "ultrasound",
    },
    {
      id: "icu",
      name: "Intensive Care Unit (ICU) & Critical Care",
      location: "Main Tower · Floor 3",
      icon: Wind,
      tone: "cyan",
      filterFn: (e: EquipmentRecord) =>
        (e.department || "").toLowerCase().includes("icu") ||
        (e.department || "").toLowerCase().includes("intensive") ||
        e.type === "ventilator",
    },
    {
      id: "emergency",
      name: "Emergency & Trauma Resuscitation Bay",
      location: "Ground Floor · Rapid Access",
      icon: Zap,
      tone: "amber",
      filterFn: (e: EquipmentRecord) =>
        (e.department || "").toLowerCase().includes("emergency") ||
        e.type === "defibrillator" ||
        e.type === "oxygen-cylinder",
    },
    {
      id: "surgery",
      name: "Operating Theatres & Surgical Suites",
      location: "Surgical Wing · Floor 2",
      icon: Syringe,
      tone: "indigo",
      filterFn: (e: EquipmentRecord) =>
        (e.department || "").toLowerCase().includes("surg") || e.type === "infusion",
    },
    {
      id: "nephrology",
      name: "Nephrology & Hemodialysis Center",
      location: "Specialty Block · Floor 4",
      icon: HeartPulse,
      tone: "purple",
      filterFn: (e: EquipmentRecord) =>
        (e.department || "").toLowerCase().includes("nephro") ||
        (e.department || "").toLowerCase().includes("dialysis") ||
        e.type === "dialysis",
    },
    {
      id: "general",
      name: "General Outpatient & Mobile Fleet",
      location: "Outpatient Pavillion · Floor 1",
      icon: Stethoscope,
      tone: "emerald",
      filterFn: (e: EquipmentRecord) =>
        e.type === "ecg" ||
        e.type === "wheelchair" ||
        (!e.department?.toLowerCase().includes("radiology") &&
          !e.department?.toLowerCase().includes("icu") &&
          !e.department?.toLowerCase().includes("emergency") &&
          !e.department?.toLowerCase().includes("surg") &&
          !e.department?.toLowerCase().includes("nephro")),
    },
  ];

  return (
    <div className="space-y-6">
      {clusters.map((cluster) => {
        const Icon = cluster.icon;
        const items = equipment.filter(cluster.filterFn);
        if (items.length === 0) return null;

        const totalUtil = items.reduce((acc, curr) => acc + (curr.utilization || 0), 0);
        const avgUtil = Math.round(totalUtil / items.length);

        const operationalCount = items.filter((e) => e.status === "operational").length;
        const inUseCount = items.filter((e) => e.status === "in-use").length;
        const maintCount = items.filter((e) => e.status === "maintenance").length;
        const offlineCount = items.filter((e) => e.status === "offline").length;

        return (
          <div
            key={cluster.id}
            className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-clinical-sm space-y-4"
          >
            {/* Cluster Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                    {cluster.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-primary/70" />
                      {cluster.location}
                    </span>
                    <span>·</span>
                    <span>
                      <strong className="text-foreground">{items.length}</strong> Devices Assigned
                    </span>
                  </div>
                </div>
              </div>

              {/* Department Readiness & Utilization Summary */}
              <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {operationalCount} Ready
                  </span>
                  <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                    <Activity className="h-3.5 w-3.5" />
                    {inUseCount} Active
                  </span>
                  {maintCount > 0 && (
                    <span className="flex items-center gap-1 text-warning-foreground dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {maintCount} Service
                    </span>
                  )}
                </div>

                <div className="w-32 hidden md:block">
                  <div className="flex justify-between text-[10px] font-bold text-muted-foreground mb-1">
                    <span>Cluster Load</span>
                    <span>{avgUtil}%</span>
                  </div>
                  <GradientProgress
                    value={avgUtil}
                    tone={avgUtil >= 80 ? "primary" : "cyan"}
                    height={5}
                  />
                </div>
              </div>
            </div>

            {/* Equipment Items in this Department Cluster */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {items.map((eq) => {
                const statusTone =
                  {
                    operational: "text-success bg-success/10 border-success/30",
                    "in-use": "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
                    maintenance:
                      "text-warning-foreground dark:text-amber-400 bg-warning/10 border-warning/30",
                    offline: "text-destructive bg-destructive/10 border-destructive/30",
                  }[eq.status] || "text-muted-foreground bg-muted border-border";

                return (
                  <motion.div
                    key={eq.id}
                    whileHover={{ y: -2, scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    onClick={() => onSelectEquipment(eq)}
                    className="cursor-pointer rounded-xl border border-border/80 bg-background/60 p-3.5 hover:border-primary/40 hover:bg-card shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] font-bold text-muted-foreground">
                            {eq.id}
                          </span>
                          <h4 className="font-display font-bold text-xs text-foreground truncate mt-0.5">
                            {eq.name}
                          </h4>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {eq.manufacturer} · {eq.model}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase shrink-0 ${statusTone}`}
                        >
                          {eq.status}
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          {eq.assignedWard || eq.location}
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {eq.utilization}% load
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
