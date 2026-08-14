import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bed,
  User,
  Heart,
  Activity,
  Shield,
  Clock,
  CheckCircle2,
  Wrench,
  Ban,
  ExternalLink,
  Copy,
  Check,
  MapPin,
  Calendar,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export interface BedTelemetryInspectorProps {
  bed: any | null;
  room?: any | null;
  ward?: any | null;
  building?: any | null;
  onClose: () => void;
  onUpdateStatus: (newStatus: string) => void;
}

const STATUS_ACTIONS = [
  { id: "available", label: "Available", color: "text-success bg-success/10 border-success/30", icon: CheckCircle2 },
  { id: "occupied", label: "Occupied", color: "text-primary bg-primary/10 border-primary/30", icon: User },
  { id: "reserved", label: "Reserved", color: "text-warning-foreground bg-warning/10 border-warning/30", icon: Clock },
  { id: "cleaning", label: "Cleaning", color: "text-blue-600 bg-blue-500/10 border-blue-200", icon: Activity },
  { id: "maintenance", label: "Maintenance", color: "text-amber-600 bg-amber-500/10 border-amber-200", icon: Wrench },
  { id: "blocked", label: "Blocked", color: "text-destructive bg-destructive/10 border-destructive/30", icon: Ban },
  { id: "emergency_reserved", label: "Emergency", color: "text-rose-600 bg-rose-500/10 border-rose-200", icon: Shield },
];

export function BedTelemetryInspector({
  bed,
  room,
  ward,
  building,
  onClose,
  onUpdateStatus,
}: BedTelemetryInspectorProps) {
  const navigate = useNavigate();
  const [copiedDid, setCopiedDid] = useState(false);

  if (!bed) return null;

  const isOccupied = bed.status === "occupied";
  const patientDid = bed.patient_did;

  const handleCopyDid = () => {
    if (!patientDid) return;
    navigator.clipboard.writeText(patientDid);
    setCopiedDid(true);
    toast.success("Patient DID copied to clipboard");
    setTimeout(() => setCopiedDid(false), 2000);
  };

  const handleOpenProfile = () => {
    if (patientDid) {
      navigate({
        to: "/admin/patient-profile",
        search: { did: patientDid } as any,
      });
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop overlay with smooth blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-foreground/40 backdrop-blur-md"
        />

        {/* Centered Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="relative w-full max-w-2xl rounded-3xl border border-border/80 bg-card p-6 sm:p-7 shadow-clinical-xl z-10 space-y-5 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-border/60">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-xs">
                <Bed className="h-6 w-6" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-extrabold text-xl text-foreground tracking-tight">
                    Station {bed.bed_number}
                  </h2>
                  <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-mono font-extrabold text-primary uppercase">
                    {bed.bed_type || "Standard Bed"}
                  </span>
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  {room?.room_name || `Room ${room?.room_number || ""}`} • {ward?.ward_name || "General Wing"}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-xl p-2 hover:bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Spatial Location Path (Clean Non-Truncating Breadcrumb) */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[10px] uppercase font-extrabold tracking-wider">Spatial Location:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold text-foreground">
              <span className="bg-background px-2.5 py-1 rounded-xl border border-border/60 shadow-2xs">
                {building?.building_name || "Main Tower"}
              </span>
              <span className="text-muted-foreground">›</span>
              <span className="bg-background px-2.5 py-1 rounded-xl border border-border/60 shadow-2xs">
                {ward?.ward_name || "Clinical Wing"}
              </span>
              <span className="text-muted-foreground">›</span>
              <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-xl border border-primary/20 shadow-2xs">
                {room?.room_name || `Room ${room?.room_number || ""}`}
              </span>
            </div>
          </div>

          {/* Occupied Patient Profile Card */}
          {isOccupied ? (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4 shadow-clinical-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-600 text-primary-foreground font-display font-extrabold text-xl shadow-sm">
                    {(bed.patient_name || "P")[0]}
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                      {bed.patient_name || "Assigned Patient"}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center rounded-md bg-background px-2 py-0.5 text-[10px] font-mono font-extrabold text-primary border border-border/60">
                        {bed.patient_mrn || "MRN-RECORD"}
                      </span>
                      {bed.patient_condition && (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            bed.patient_condition === "Critical"
                              ? "bg-destructive/20 text-destructive border border-destructive/30"
                              : bed.patient_condition === "Recovery"
                              ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-300"
                              : "bg-success/20 text-success border border-success/30"
                          }`}
                        >
                          {bed.patient_condition}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={handleOpenProfile}
                  className="bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold rounded-xl shadow-clinical-md shadow-primary/25 text-xs h-9"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  View Patient EHR
                </Button>
              </div>

              {/* DID Copy Box */}
              {patientDid && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-extrabold text-muted-foreground block">
                    Decentralized ID (DID)
                  </span>
                  <div className="font-mono text-[11px] font-bold text-foreground bg-background p-2.5 rounded-xl border border-border/60 flex items-center justify-between gap-2">
                    <span className="break-all">{patientDid}</span>
                    <button
                      type="button"
                      onClick={handleCopyDid}
                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                      title="Copy DID"
                    >
                      {copiedDid ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Live Telemetry Vitals Grid */}
              {bed.vitals && (
                <div className="space-y-2 pt-2 border-t border-primary/20">
                  <div className="flex items-center justify-between text-[10px] font-extrabold uppercase text-primary">
                    <span className="flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" /> Live Telemetry Feed
                    </span>
                    <span className="text-emerald-500 flex items-center gap-1 font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Continuous Monitoring
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-background border border-border/60 shadow-2xs">
                      <div className="text-base font-mono font-black text-rose-500 flex items-center justify-center gap-1">
                        <Heart className="h-3.5 w-3.5 animate-pulse" /> {bed.vitals.hr}
                      </div>
                      <div className="text-[9px] font-extrabold text-muted-foreground uppercase mt-0.5">Heart Rate</div>
                    </div>

                    <div className="p-3 rounded-xl bg-background border border-border/60 shadow-2xs">
                      <div className="text-base font-mono font-black text-foreground">{bed.vitals.bp}</div>
                      <div className="text-[9px] font-extrabold text-muted-foreground uppercase mt-0.5">Blood Pressure</div>
                    </div>

                    <div className="p-3 rounded-xl bg-background border border-border/60 shadow-2xs">
                      <div className="text-base font-mono font-black text-teal-600">{bed.vitals.spo2}%</div>
                      <div className="text-[9px] font-extrabold text-muted-foreground uppercase mt-0.5">Oxygen Sat</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-2xl border border-success/30 bg-success/5 space-y-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/20 text-success mx-auto">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="font-display font-extrabold text-base text-foreground">
                Station Ready for Inpatient Admission
              </div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                This bed is sterilized, clinically inspected, and available for immediate allocation.
              </p>
            </div>
          )}

          {/* Station Status Modifier Section */}
          <div className="space-y-3">
            <div className="border-l-2 border-primary/30 pl-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Update Operational Status
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STATUS_ACTIONS.map((opt) => {
                const Icon = opt.icon;
                const isCurrent = bed.status === opt.id;

                return (
                  <Button
                    key={opt.id}
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateStatus(opt.id)}
                    className={`h-10 justify-start gap-2 rounded-xl text-xs font-extrabold transition-all ${
                      isCurrent
                        ? `${opt.color} ring-2 ring-primary/30 font-black shadow-xs`
                        : "border-border/80 hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{opt.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-xl h-10 text-xs font-bold px-6"
            >
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
