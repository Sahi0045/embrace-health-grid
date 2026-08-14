import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  X,
  Ambulance,
  MapPin,
  User,
  ShieldCheck,
  Radio,
  Clock,
  Fuel,
  BatteryCharging,
  Stethoscope,
  Activity,
  CheckCircle2,
  Navigation,
  AlertTriangle,
  RotateCcw,
  Wrench,
  Copy,
  Check,
  CheckCircle,
  FileText,
  HeartPulse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradientProgress } from "@/components/dashboard/GradientProgress";
import { ActivityItem } from "@/components/dashboard/ActivityItem";
import { toast } from "sonner";
import type { AmbulanceRecord, AmbulanceStatus } from "@/lib/types";

interface AmbulanceDetailPanelProps {
  ambulance: AmbulanceRecord | null;
  onClose: () => void;
  onUpdateStatus: (
    ambulanceId: string,
    newStatus: AmbulanceStatus,
    location?: string,
  ) => Promise<void>;
}

type TabKey = "mission" | "telemetry" | "equipment" | "logs";

export function AmbulanceDetailPanel({
  ambulance,
  onClose,
  onUpdateStatus,
}: AmbulanceDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("mission");
  const [copiedDid, setCopiedDid] = useState(false);
  const [updating, setUpdating] = useState(false);

  if (!ambulance) return null;

  const handleCopyDid = () => {
    if (ambulance.did) {
      navigator.clipboard.writeText(ambulance.did);
      setCopiedDid(true);
      toast.success("Ambulance DID copied to clipboard");
      setTimeout(() => setCopiedDid(false), 2000);
    }
  };

  const handleStatusChange = async (newStatus: AmbulanceStatus) => {
    setUpdating(true);
    try {
      await onUpdateStatus(ambulance.id, newStatus);
      toast.success(`Vehicle status updated to "${newStatus}"`);
    } catch (err: any) {
      toast.error("Failed to update status", { description: err.message });
    } finally {
      setUpdating(false);
    }
  };

  const statusBadgeConfig: Record<string, { label: string; cls: string; dot: string }> = {
    available: {
      label: "Available / Standby",
      cls: "border-success/30 bg-success/10 text-success",
      dot: "bg-success",
    },
    "en-route": {
      label: "En Route Dispatched",
      cls: "border-warning/30 bg-warning/15 text-warning-foreground",
      dot: "bg-warning",
    },
    "at-scene": {
      label: "At Scene Responding",
      cls: "border-destructive/30 bg-destructive/15 text-destructive",
      dot: "bg-destructive",
    },
    returning: {
      label: "Returning to Base",
      cls: "border-primary/30 bg-primary/10 text-primary",
      dot: "bg-primary",
    },
    maintenance: {
      label: "Under Maintenance",
      cls: "border-border/80 bg-muted/40 text-muted-foreground",
      dot: "bg-muted-foreground",
    },
  };

  const currentBadge = statusBadgeConfig[ambulance.status] || statusBadgeConfig.available;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-foreground/40 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="relative w-full max-w-2xl rounded-3xl border border-border/80 bg-card shadow-clinical-xl z-10 flex flex-col max-h-[88vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-border/60 bg-card shrink-0 space-y-3.5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-xs border border-primary/20">
                  <Ambulance className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold font-display text-foreground tracking-tight">
                      {ambulance.vehicleNo || ambulance.registration || ambulance.id}
                    </h2>
                    <Badge
                      variant="outline"
                      className="rounded-full border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase"
                    >
                      {ambulance.type.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>Emergency Response Unit</span>
                    <span className="text-border">•</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      ID: {ambulance.id}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${currentBadge.cls}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${currentBadge.dot}`} />
                  {currentBadge.label}
                </Badge>
                <button
                  onClick={onClose}
                  className="rounded-xl p-1.5 hover:bg-muted text-muted-foreground transition-colors ml-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tab Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none no-scrollbar pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("mission")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all shrink-0 ${
                  activeTab === "mission"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border/80 bg-background text-muted-foreground hover:border-border"
                }`}
              >
                <Navigation className="h-3.5 w-3.5" />
                Mission & Dispatch
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("telemetry")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all shrink-0 ${
                  activeTab === "telemetry"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border/80 bg-background text-muted-foreground hover:border-border"
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                Vehicle Telemetry
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("equipment")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all shrink-0 ${
                  activeTab === "equipment"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border/80 bg-background text-muted-foreground hover:border-border"
                }`}
              >
                <Stethoscope className="h-3.5 w-3.5" />
                Equipment
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("logs")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all shrink-0 ${
                  activeTab === "logs"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border/80 bg-background text-muted-foreground hover:border-border"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Trip History
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(88vh-200px)]">
            {activeTab === "mission" && (
              <div className="space-y-6">
                {/* Location & Driver Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2 shadow-xs">
                    <div className="flex items-center gap-2 text-primary font-extrabold text-xs uppercase tracking-wider">
                      <MapPin className="h-4 w-4" />
                      <span>Current GPS Location</span>
                    </div>
                    <div className="text-sm font-extrabold text-foreground">
                      {ambulance.location || "Hospital Base Station (Bay 1)"}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Coordinates synchronized with central emergency telemetry.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2 shadow-xs">
                    <div className="flex items-center gap-2 text-primary font-extrabold text-xs uppercase tracking-wider">
                      <User className="h-4 w-4" />
                      <span>Assigned Medical Crew</span>
                    </div>
                    <div className="text-sm font-extrabold text-foreground">
                      {ambulance.driver || "Driver Unassigned"}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Paramedic Team:{" "}
                      <span className="font-semibold text-foreground">
                        {ambulance.paramedic || "Emergency Paramedic Staff"}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Quick Dispatch Status Controls */}
                <div className="space-y-3 rounded-2xl border border-border/80 bg-background/60 p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-primary" />
                      <span>Dispatch Status Transition</span>
                    </h3>
                    <span className="text-[10px] font-mono font-bold text-muted-foreground">
                      Live State: {ambulance.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                    <Button
                      variant={ambulance.status === "available" ? "default" : "outline"}
                      size="sm"
                      disabled={updating}
                      onClick={() => handleStatusChange("available")}
                      className={`rounded-xl text-xs font-extrabold gap-1.5 h-9 ${
                        ambulance.status === "available"
                          ? "bg-success text-success-foreground shadow-xs"
                          : "hover:bg-success/10 hover:text-success hover:border-success/30"
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Available Base
                    </Button>

                    <Button
                      variant={ambulance.status === "en-route" ? "default" : "outline"}
                      size="sm"
                      disabled={updating}
                      onClick={() => handleStatusChange("en-route")}
                      className={`rounded-xl text-xs font-extrabold gap-1.5 h-9 ${
                        ambulance.status === "en-route"
                          ? "bg-warning text-warning-foreground shadow-xs"
                          : "hover:bg-warning/10 hover:text-warning-foreground hover:border-warning/30"
                      }`}
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      En-Route
                    </Button>

                    <Button
                      variant={ambulance.status === "at-scene" ? "default" : "outline"}
                      size="sm"
                      disabled={updating}
                      onClick={() => handleStatusChange("at-scene")}
                      className={`rounded-xl text-xs font-extrabold gap-1.5 h-9 ${
                        ambulance.status === "at-scene"
                          ? "bg-destructive text-destructive-foreground shadow-xs"
                          : "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                      }`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      At Scene
                    </Button>

                    <Button
                      variant={ambulance.status === "returning" ? "default" : "outline"}
                      size="sm"
                      disabled={updating}
                      onClick={() => handleStatusChange("returning")}
                      className={`rounded-xl text-xs font-extrabold gap-1.5 h-9 ${
                        ambulance.status === "returning"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                      }`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Returning
                    </Button>

                    <Button
                      variant={ambulance.status === "maintenance" ? "default" : "outline"}
                      size="sm"
                      disabled={updating}
                      onClick={() => handleStatusChange("maintenance")}
                      className={`rounded-xl text-xs font-extrabold gap-1.5 h-9 col-span-2 sm:col-span-1 ${
                        ambulance.status === "maintenance"
                          ? "bg-muted text-foreground shadow-xs"
                          : "hover:bg-muted"
                      }`}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      Maintenance
                    </Button>
                  </div>
                </div>

                {/* Patient / Mission Assignment Info */}
                <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-primary" />
                    <span>Emergency Patient Transport Protocol</span>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {ambulance.status === "at-scene" || ambulance.status === "en-route"
                      ? "Active emergency transport mission in progress. Paramedic vitals stream connected."
                      : "No active patient transport assigned. Vehicle standing by at primary hospital emergency bay."}
                  </p>
                </div>
              </div>
            )}

            {activeTab === "telemetry" && (
              <div className="space-y-5">
                {/* Real Asset Registration & Location Telemetry */}
                <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    <span>Live GPS & Asset Telemetry</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl border border-border/60 bg-background/80 space-y-1">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        Registration Plate
                      </div>
                      <div className="font-bold text-foreground">
                        {ambulance.registration || ambulance.vehicleNo || ambulance.id}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-border/60 bg-background/80 space-y-1">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        Vehicle Classification
                      </div>
                      <div className="font-bold text-primary uppercase">
                        {ambulance.type || "Standard ALS"}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-border/60 bg-background/80 space-y-1">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        Current Bay Location
                      </div>
                      <div className="font-bold text-foreground">
                        {ambulance.location || "Hospital Emergency Station"}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-border/60 bg-background/80 space-y-1">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        Last Telemetry Heartbeat
                      </div>
                      <div className="font-mono text-muted-foreground">
                        {ambulance.updatedAt
                          ? new Date(ambulance.updatedAt).toLocaleString()
                          : "Realtime Active"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decentralized Identity & Security Anchor */}
                <div className="space-y-3 rounded-2xl border border-border/80 bg-background/60 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-foreground">
                      <ShieldCheck className="h-4 w-4 text-success" />
                      <span>Decentralized Asset Identity (DID)</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-success/30 bg-success/10 text-success text-[10px] font-bold"
                    >
                      Verified Smart Asset
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border/60 bg-card font-mono text-xs">
                    <span className="truncate text-foreground font-semibold">
                      {ambulance.did || `did:hosp:ambulance:${ambulance.id}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyDid}
                      className="h-7 w-7 p-0 shrink-0 hover:bg-muted"
                    >
                      {copiedDid ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "equipment" && (
              <div className="space-y-4">
                <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Vehicle Type Standards & Required Medical Kits
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      name: "Emergency Life Support System",
                      type: "Standard Protocol for " + ambulance.type.toUpperCase(),
                    },
                    { name: "Patient Monitoring & Trauma Kit", type: "Certified Asset Standard" },
                    { name: "Oxygen Delivery & Airway Support", type: "Medical Grade Oxygen" },
                    { name: "Emergency Stretcher Transport", type: "Hydraulic Rapid Load" },
                  ].map((eq, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-xs flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">{eq.name}</div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                          {eq.type}
                        </div>
                      </div>
                      <CheckCircle className="h-4 w-4 text-success shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "logs" && (
              <div className="space-y-4">
                <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Audit Activity & Record Telemetry
                </div>

                <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 divide-y divide-border/50">
                  <ActivityItem
                    icon={CheckCircle2}
                    severity="success"
                    title={`Current Status: ${ambulance.status.toUpperCase()}`}
                    subtitle={`Stationed at: ${ambulance.location || "Base Station"}`}
                    time={
                      ambulance.updatedAt
                        ? new Date(ambulance.updatedAt).toLocaleTimeString()
                        : "Live"
                    }
                    isLast={true}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 px-6 border-t border-border/60 bg-card shrink-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span>Realtime Telemetry Stream Active</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl text-xs font-bold shadow-xs px-4"
            >
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
