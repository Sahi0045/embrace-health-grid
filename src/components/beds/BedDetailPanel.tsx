import { motion, AnimatePresence } from "framer-motion";
import { X, Bed, User, Shield, Clock, CheckCircle2, Wrench, Ban, Activity, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BedDetailPanelProps {
  bed: any | null;
  room?: any | null;
  ward?: any | null;
  building?: any | null;
  onClose: () => void;
  onUpdateStatus: (newStatus: string) => void;
}

const STATUS_OPTIONS = [
  { id: "available", label: "Available", color: "text-success bg-success/10 border-success/30", icon: CheckCircle2 },
  { id: "occupied", label: "Occupied", color: "text-primary bg-primary/10 border-primary/30", icon: User },
  { id: "reserved", label: "Reserved", color: "text-warning-foreground bg-warning/10 border-warning/30", icon: Clock },
  { id: "cleaning", label: "Cleaning", color: "text-blue-600 bg-blue-500/10 border-blue-200", icon: Activity },
  { id: "maintenance", label: "Maintenance", color: "text-amber-600 bg-amber-500/10 border-amber-200", icon: Wrench },
  { id: "blocked", label: "Blocked", color: "text-destructive bg-destructive/10 border-destructive/30", icon: Ban },
  { id: "emergency_reserved", label: "Emergency", color: "text-red-600 bg-red-500/10 border-red-200", icon: Shield },
];

export function BedDetailPanel({
  bed,
  room,
  ward,
  building,
  onClose,
  onUpdateStatus,
}: BedDetailPanelProps) {
  if (!bed) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-foreground/40 backdrop-blur-md transition-opacity"
        />

        {/* Panel Container */}
        <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="w-screen max-w-md bg-card border-l border-border shadow-clinical-xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between"
          >
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm">
                    <Bed className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display font-extrabold text-lg text-foreground tracking-tight">
                      Bed {bed.bed_number || bed.bed_id}
                    </h2>
                    <p className="text-xs font-medium text-muted-foreground">
                      {bed.bed_type || "Standard"} Bed
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="rounded-xl p-1.5 hover:bg-muted text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Location Hierarchy */}
              <div className="space-y-2 p-4 rounded-2xl bg-muted/40 border border-border/60">
                <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Location Path
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold text-foreground">
                  {building && <span>{building.building_name}</span>}
                  {ward && (
                    <>
                      <span className="text-muted-foreground">›</span>
                      <span>{ward.ward_name}</span>
                    </>
                  )}
                  {room && (
                    <>
                      <span className="text-muted-foreground">›</span>
                      <span className="text-primary">{room.room_name}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Current Status */}
              <div className="space-y-3">
                <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Current Status
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border/80 bg-background">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        bed.status === "available"
                          ? "bg-success"
                          : bed.status === "occupied"
                          ? "bg-primary"
                          : "bg-warning"
                      }`}
                    />
                    <span className="font-display font-extrabold text-base text-foreground capitalize">
                      {bed.status || "available"}
                    </span>
                  </div>
                  {bed.updated_at && (
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(bed.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Patient Info (If Occupied) */}
              {bed.status === "occupied" && (
                <div className="space-y-3">
                  <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Assigned Patient
                  </div>
                  <div className="p-4 rounded-2xl border border-primary/30 bg-primary/5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <User className="h-4 w-4 text-primary" />
                      <span>Patient DID:</span>
                    </div>
                    <p className="font-mono text-xs font-bold text-primary break-all bg-background/80 p-2.5 rounded-xl border border-border/60">
                      {bed.patient_did || "No DID associated"}
                    </p>
                  </div>
                </div>
              )}

              {/* Quick Status Update */}
              <div className="space-y-3">
                <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Update Status
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = bed.status === opt.id;
                    return (
                      <Button
                        key={opt.id}
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateStatus(opt.id)}
                        className={`h-10 justify-start gap-2 rounded-xl text-xs font-extrabold transition-all ${
                          isSelected
                            ? `${opt.color} ring-2 ring-primary/30`
                            : "border-border/80 hover:bg-accent"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{opt.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Audit Activity */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Bed History
                  </div>
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="p-3 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                  Status changes recorded to audit trail
                </div>
              </div>
            </div>

            {/* Footer close button */}
            <div className="pt-4 border-t border-border/60">
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full rounded-xl h-10 text-xs font-bold"
              >
                Close Panel
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
