import { motion } from "framer-motion";
import {
  Camera,
  Activity,
  CheckCircle,
  Clock,
  User,
  Stethoscope,
  ChevronRight,
  FileImage,
  Play,
  Check,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import type { RadiologyOrderRecord, RadiologyModality } from "@/lib/types";

interface RadiologyTabProps {
  orders: RadiologyOrderRecord[];
  onUpdateStatus: (
    orderId: string,
    status: "scheduled" | "in_progress" | "completed" | "reported",
  ) => void;
}

const IMAGING_EQUIPMENT = [
  {
    id: "EQ-MRI-001",
    name: "Siemens MAGNETOM Vida 3T MRI",
    modality: "MRI Scanner",
    room: "Radiology Suite 101",
    status: "in-use",
    utilization: 88,
  },
  {
    id: "EQ-CT-001",
    name: "Canon Aquilion ONE PRISM 640-Slice CT",
    modality: "Computed Tomography",
    room: "Radiology Suite 102",
    status: "in-use",
    utilization: 94,
  },
  {
    id: "EQ-XRAY-001",
    name: "Siemens Mobilett Elara Max Digital X-Ray",
    modality: "Digital Radiography",
    room: "Mobile Ward Unit",
    status: "operational",
    utilization: 62,
  },
  {
    id: "EQ-US-001",
    name: "GE LOGIQ E10 High-Res Ultrasound",
    modality: "Diagnostic Ultrasound",
    room: "Ultrasound Bay 3",
    status: "operational",
    utilization: 45,
  },
];

function getModalityBadgeStyle(modality: RadiologyModality) {
  switch (modality.toLowerCase()) {
    case "mri":
      return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30";
    case "ct":
      return "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30";
    case "xray":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "ultrasound":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    default:
      return "bg-primary/10 text-primary border-primary/20";
  }
}

export function RadiologyTab({ orders, onUpdateStatus }: RadiologyTabProps) {
  return (
    <div className="space-y-6">
      {/* 1. Imaging Equipment Status Deck */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Camera className="h-4.5 w-4.5 text-primary" />
          <h3 className="font-display font-extrabold text-sm text-foreground uppercase tracking-wider">
            Diagnostic Imaging Systems & Telemetry
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {IMAGING_EQUIPMENT.map((eq) => (
            <div
              key={eq.id}
              className="rounded-2xl border border-border/80 bg-card p-4 shadow-clinical-xs hover:border-primary/40 transition-all space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-muted-foreground">
                  {eq.id}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase text-success bg-success/15 px-2 py-0.5 rounded-full border border-success/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  {eq.status === "in-use" ? "SCANNING" : "STANDBY"}
                </span>
              </div>

              <div>
                <h4 className="font-display font-extrabold text-xs text-foreground line-clamp-1">
                  {eq.name}
                </h4>
                <p className="text-[11px] text-muted-foreground">{eq.room}</p>
              </div>

              {/* Utilization progress bar */}
              <div className="space-y-1 pt-1 border-t border-border/40">
                <div className="flex justify-between text-[10px] font-extrabold uppercase text-muted-foreground">
                  <span>Duty Utilization</span>
                  <span className="text-foreground">{eq.utilization}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-blue-600 rounded-full"
                    style={{ width: `${eq.utilization}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Scheduled Imaging & Radiology Scan Queue */}
      <div className="space-y-3.5 pt-4 border-t border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileImage className="h-4.5 w-4.5 text-primary" />
            <h3 className="font-display font-extrabold text-sm text-foreground uppercase tracking-wider">
              Radiology Orders & PACS Diagnostic Ledger
            </h3>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {orders.length} active scan requisitions
          </span>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon={FileImage}
            title="No radiology orders"
            description="No scheduled CT, MRI, or X-ray scan orders pending."
          />
        ) : (
          orders.map((rad, index) => {
            const isStat = rad.priority === "stat";

            return (
              <motion.div
                key={rad.order_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
                className={`rounded-2xl border p-5 transition-all duration-200 bg-card shadow-clinical-sm ${
                  isStat
                    ? "border-destructive/50 ring-1 ring-destructive/20"
                    : "border-border/80 hover:border-primary/40"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left info */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Modality Badge */}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${getModalityBadgeStyle(
                          rad.modality,
                        )}`}
                      >
                        {rad.modality.toUpperCase()}
                      </span>

                      {/* Priority Tag */}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          isStat
                            ? "bg-destructive/15 text-destructive border-destructive/30 animate-pulse"
                            : "bg-muted text-muted-foreground border-border/80"
                        }`}
                      >
                        {isStat && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
                        {rad.priority.toUpperCase()}
                      </span>

                      <span className="font-mono text-[11px] font-bold text-muted-foreground">
                        #{rad.order_id}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-display font-extrabold text-base text-foreground tracking-tight">
                        {rad.body_part}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Indication:{" "}
                        <span className="text-foreground font-semibold italic">
                          {rad.clinical_indication}
                        </span>
                      </p>
                    </div>

                    {/* Patient & Unit context */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1 text-foreground font-bold">
                        <User className="h-3.5 w-3.5 text-primary" />
                        {rad.patient_name}
                      </span>
                      {rad.equipment_name && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Zap className="h-3.5 w-3.5 text-amber-500" />
                          {rad.equipment_name} ({rad.equipment_room})
                        </span>
                      )}
                    </div>

                    {/* Radiologist Report findings if completed */}
                    {rad.report_text && (
                      <div className="rounded-xl bg-background/80 border border-border/70 p-3 text-xs space-y-1 mt-2">
                        <div className="flex items-center justify-between text-[10px] font-extrabold text-success uppercase tracking-wider">
                          <span>Verified Radiologist Impression</span>
                          <span>{rad.reported_by}</span>
                        </div>
                        <p className="text-foreground font-medium">{rad.report_text}</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {rad.status === "scheduled" && (
                      <Button
                        size="sm"
                        onClick={() => onUpdateStatus(rad.order_id, "in_progress")}
                        className="h-8 rounded-xl bg-primary text-primary-foreground text-xs font-bold gap-1.5 shadow-xs hover:bg-primary/90"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Begin Scan</span>
                      </Button>
                    )}

                    {rad.status === "in_progress" && (
                      <Button
                        size="sm"
                        onClick={() => onUpdateStatus(rad.order_id, "completed")}
                        className="h-8 rounded-xl bg-success text-success-foreground text-xs font-bold gap-1.5 shadow-xs hover:bg-success/90"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Finalize PACS Scan</span>
                      </Button>
                    )}

                    {rad.status === "completed" && (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-success bg-success/15 px-3 py-1 rounded-xl border border-success/30">
                        <CheckCircle className="h-4 w-4" />
                        Scan Archive Verified
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
