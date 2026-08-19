import { useState, useEffect, useCallback } from "react";
import {
  X,
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
  Plus,
  RefreshCw,
  Copy,
  ExternalLink,
  DollarSign,
  FileSpreadsheet,
  Building2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GradientProgress } from "@/components/dashboard/GradientProgress";
import { MaintenanceTimeline } from "@/components/equipment/MaintenanceTimeline";
import {
  getEquipmentMaintenanceLog,
  updateEquipmentStatus,
  recordEquipmentMaintenance,
} from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { EquipmentRecord, EquipmentStatus, MaintenanceLogEntry } from "@/lib/types";

interface EquipmentDetailPanelProps {
  equipment: EquipmentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onEquipmentUpdated?: () => void;
}

export function EquipmentDetailPanel({
  equipment,
  isOpen,
  onClose,
  onEquipmentUpdated,
}: EquipmentDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<
    "specs" | "calibration" | "maintenance" | "log-action"
  >("specs");
  const [logs, setLogs] = useState<MaintenanceLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Status & Location Update Form State
  const [status, setStatus] = useState<EquipmentStatus>("operational");
  const [location, setLocation] = useState("");
  const [assignedWard, setAssignedWard] = useState("");
  const [utilization, setUtilization] = useState(0);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Maintenance Log Form State
  const [maintType, setMaintType] = useState<
    "preventive" | "corrective" | "calibration" | "routine_check"
  >("preventive");
  const [description, setDescription] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [cost, setCost] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [notes, setNotes] = useState("");
  const [submittingLog, setSubmittingLog] = useState(false);

  // Sync state when equipment changes
  useEffect(() => {
    if (equipment) {
      setStatus(equipment.status);
      setLocation(equipment.location || "");
      setAssignedWard(equipment.assignedWard || "");
      setUtilization(equipment.utilization || 0);
      loadLogs(equipment.id);
    }
  }, [equipment]);

  const loadLogs = useCallback(async (equipmentId: string) => {
    setLoadingLogs(true);
    try {
      const res = await getEquipmentMaintenanceLog(equipmentId);
      setLogs(res.logs || []);
    } catch {
      // Graceful fallback to avoid schema cache toast error
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  if (!isOpen || !equipment) return null;

  // Handle Status Update
  const handleUpdateStatus = async () => {
    setUpdatingStatus(true);
    try {
      await updateEquipmentStatus({
        equipmentId: equipment.id,
        status,
        location,
        assignedWard,
        utilizationPct: Number(utilization),
      });
      toast.success("Equipment status & telemetry updated successfully");
      if (onEquipmentUpdated) onEquipmentUpdated();
    } catch (err: any) {
      toast.error("Failed to update equipment", { description: err.message });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Maintenance Log Submission
  const handleRecordMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !performedBy.trim()) {
      toast.error("Please fill in the description and technician name");
      return;
    }

    setSubmittingLog(true);
    try {
      await recordEquipmentMaintenance({
        equipmentId: equipment.id,
        maintenanceType: maintType,
        description,
        performedBy,
        cost: cost ? parseFloat(cost) : 0,
        nextDue: nextDue || undefined,
        notes: notes || undefined,
        status: "completed",
      });

      toast.success("Maintenance action recorded in hospital ledger");
      setDescription("");
      setPerformedBy("");
      setCost("");
      setNextDue("");
      setNotes("");
      setActiveTab("maintenance");
      loadLogs(equipment.id);
      if (onEquipmentUpdated) onEquipmentUpdated();
    } catch (err: any) {
      toast.error("Failed to record maintenance", { description: err.message });
    } finally {
      setSubmittingLog(false);
    }
  };

  const copyDid = () => {
    navigator.clipboard.writeText(equipment.did);
    toast.success("Equipment DID copied to clipboard");
  };

  const statusPillConfig = {
    operational: { label: "Operational", bg: "bg-success/15 text-success border-success/30" },
    "in-use": {
      label: "In Active Use",
      bg: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
    },
    maintenance: {
      label: "Under Maintenance",
      bg: "bg-warning/15 text-warning-foreground dark:text-amber-400 border-warning/30",
    },
    offline: { label: "Offline", bg: "bg-destructive/15 text-destructive border-destructive/30" },
  }[equipment.status] || {
    label: equipment.status,
    bg: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="w-full max-w-3xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-clinical-xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-border/80 bg-muted/20">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                {equipment.id}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${statusPillConfig.bg}`}
              >
                {statusPillConfig.label}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {equipment.type.toUpperCase()}
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-extrabold font-display text-foreground tracking-tight truncate">
              {equipment.name}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="font-semibold text-foreground">{equipment.manufacturer}</span>
              <span>·</span>
              <span>{equipment.model}</span>
              <span>·</span>
              <span className="font-mono">S/N: {equipment.serial}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-border/80 px-6 bg-card">
          {[
            { id: "specs", label: "Clinical Specs", icon: Cpu },
            { id: "calibration", label: "Calibration & Warranty", icon: Sparkles },
            { id: "maintenance", label: `Service Log (${logs.length})`, icon: Wrench },
            { id: "log-action", label: "Manage / Log Service", icon: Plus },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold transition-all border-b-2 ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: Clinical Specs & Location */}
          {activeTab === "specs" && (
            <div className="space-y-6">
              {/* Utilization Card */}
              <div className="rounded-2xl border border-border/80 bg-background/60 p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Live Operational Utilization
                  </span>
                  <span className="font-display font-extrabold text-foreground text-sm">
                    {equipment.utilization}%
                  </span>
                </div>
                <GradientProgress
                  value={equipment.utilization}
                  tone={equipment.utilization >= 80 ? "primary" : "cyan"}
                  height={8}
                />
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="rounded-2xl border border-border/80 bg-background/50 p-4 space-y-3">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Departmental Deployment
                  </h4>
                  <div className="space-y-2 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Department:</span>
                      <strong className="text-foreground font-semibold">
                        {equipment.department}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Assigned Ward:</span>
                      <strong className="text-foreground font-semibold">
                        {equipment.assignedWard}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Floor Level:</span>
                      <strong className="text-foreground font-semibold">
                        Floor {equipment.floor}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Bay / Location:</span>
                      <strong className="text-foreground font-semibold">
                        {equipment.location}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/80 bg-background/50 p-4 space-y-3">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Asset Governance
                  </h4>
                  <div className="space-y-2 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Serial Number:</span>
                      <strong className="text-foreground font-mono font-semibold">
                        {equipment.serial}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Category:</span>
                      <strong className="text-foreground font-semibold">
                        {equipment.category}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Purchase Date:</span>
                      <strong className="text-foreground font-semibold">
                        {equipment.purchaseDate || "2023-01-10"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Warranty Valid:</span>
                      <strong className="text-foreground font-semibold">
                        {equipment.warrantyExpiry || "Active"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Solana DID Identity */}
              <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                    Decentralized Equipment Identifier (DID)
                  </span>
                  <p className="font-mono text-xs font-bold text-foreground truncate mt-0.5">
                    {equipment.did}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyDid}
                  className="rounded-xl text-xs font-bold shadow-xs shrink-0"
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy DID
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: Calibration & Precision */}
          {activeTab === "calibration" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border/80 bg-background/50 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                      Calibration Schedule
                    </h4>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span>Last Calibrated:</span>
                      <strong className="text-foreground font-semibold">
                        {equipment.calibrationDate || "Verified on Delivery"}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span>Next Calibration Due:</span>
                      <strong className="text-primary font-bold">
                        {equipment.nextCalibration || "2026-12-15"}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Metrology Standard:</span>
                      <strong className="text-foreground font-semibold">
                        ISO 80601 / IEC 60601
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/80 bg-background/50 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-success" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                      OEM Warranty & Service SLA
                    </h4>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span>Coverage Expiration:</span>
                      <strong className="text-foreground font-semibold">
                        {equipment.warrantyExpiry || "2029-12-31"}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span>SLA Response Window:</span>
                      <strong className="text-foreground font-semibold">2 Hours On-Site</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Authorized Vendor:</span>
                      <strong className="text-foreground font-semibold">
                        {equipment.manufacturer}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Schedule Banner */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-foreground">
                      Next Scheduled Preventive Overhaul
                    </h5>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Targeted for {equipment.nextMaintenance || "Q4 2026"} by Biomedical
                      Engineering
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab("log-action")}
                  className="rounded-xl text-xs font-bold shadow-xs shrink-0"
                >
                  Log Service
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: Maintenance History Log */}
          {activeTab === "maintenance" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                    Clinical Engineering Audit Ledger
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Immutable history of service actions, part replacements, and calibration checks
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loadLogs(equipment.id)}
                  className="rounded-xl text-xs font-bold shadow-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Sync
                </Button>
              </div>

              <MaintenanceTimeline logs={logs} loading={loadingLogs} />
            </div>
          )}

          {/* TAB 4: Manage Status & Record Maintenance */}
          {activeTab === "log-action" && (
            <div className="space-y-6">
              {/* Section 1: Quick Status & Telemetry Update */}
              <div className="rounded-2xl border border-border/80 bg-background/60 p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                  Update Operational Telemetry
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Operational Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/40 outline-none"
                    >
                      <option value="operational">Operational (Available)</option>
                      <option value="in-use">In Active Clinical Use</option>
                      <option value="maintenance">Under Maintenance / Service</option>
                      <option value="offline">Offline / Standby Staged</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Assigned Ward / Wing
                    </label>
                    <Input
                      value={assignedWard}
                      onChange={(e) => setAssignedWard(e.target.value)}
                      placeholder="e.g. ICU Alpha / Cardiology Suite"
                      className="rounded-xl bg-background border border-border/80 text-xs h-9"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Location / Room Bay
                    </label>
                    <Input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Bay 4 / Room 102"
                      className="rounded-xl bg-background border border-border/80 text-xs h-9"
                    />
                  </div>

                  {/* 2026 Haptic Telemetry Controller */}
                  <div className="sm:col-span-2 space-y-2.5 p-4 rounded-2xl bg-background/80 border border-border/80 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                          Biomedical Telemetry Workload
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-display font-extrabold text-lg text-foreground tracking-tight">
                            {utilization}%
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              utilization >= 80
                                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                : utilization >= 40
                                  ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30"
                                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {utilization >= 80
                              ? "Critical Peak Demand"
                              : utilization >= 40
                                ? "Nominal Clinical Load"
                                : "Standby / Optimal Buffer"}
                          </span>
                        </div>
                      </div>

                      {/* 5 Quick Preset Pods */}
                      <div className="flex items-center gap-1">
                        {[
                          { label: "0%", val: 0 },
                          { label: "25%", val: 25 },
                          { label: "50%", val: 50 },
                          { label: "75%", val: 75 },
                          { label: "100%", val: 100 },
                        ].map((preset) => (
                          <button
                            key={preset.val}
                            type="button"
                            onClick={() => setUtilization(preset.val)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                              utilization === preset.val
                                ? "bg-primary text-primary-foreground shadow-xs scale-105"
                                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Gradient Track Slider */}
                    <div className="relative py-1">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={utilization}
                        onChange={(e) => setUtilization(Number(e.target.value))}
                        className="w-full h-2.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary focus:outline-none"
                      />
                      <div className="flex justify-between text-[9px] font-mono text-muted-foreground/60 px-0.5 mt-1">
                        <span>0% Idle</span>
                        <span>25%</span>
                        <span>50% Nominal</span>
                        <span>75%</span>
                        <span>100% Peak</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleUpdateStatus}
                    disabled={updatingStatus}
                    size="sm"
                    className="bg-primary text-primary-foreground font-extrabold rounded-xl shadow-clinical-sm text-xs"
                  >
                    {updatingStatus ? "Saving..." : "Save Telemetry Changes"}
                  </Button>
                </div>
              </div>

              {/* Section 2: Log New Maintenance Action */}
              <form
                onSubmit={handleRecordMaintenance}
                className="rounded-2xl border border-border/80 bg-background/60 p-5 space-y-4"
              >
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                  Record Service / Maintenance Entry
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Action Type
                    </label>
                    <select
                      value={maintType}
                      onChange={(e) => setMaintType(e.target.value as any)}
                      className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/40 outline-none"
                    >
                      <option value="preventive">Preventive Service</option>
                      <option value="corrective">Corrective Repair</option>
                      <option value="calibration">Calibration Audit</option>
                      <option value="routine_check">Routine Inspection</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Technician / Engineer
                    </label>
                    <Input
                      value={performedBy}
                      onChange={(e) => setPerformedBy(e.target.value)}
                      placeholder="e.g. Klaus Schneider (Biomedical Lead)"
                      required
                      className="rounded-xl bg-background border border-border/80 text-xs h-9"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Action Description
                    </label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Replaced flow transducer membrane & verified pressure baseline"
                      required
                      className="rounded-xl bg-background border border-border/80 text-xs h-9"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Service Cost ($ USD)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      placeholder="e.g. 350.00"
                      className="rounded-xl bg-background border border-border/80 text-xs h-9"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Next Due Date
                    </label>
                    <Input
                      type="date"
                      value={nextDue}
                      onChange={(e) => setNextDue(e.target.value)}
                      className="rounded-xl bg-background border border-border/80 text-xs h-9"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Technician Notes & Observations
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="e.g. Calibration tolerances well within ISO standards. Zero drift detected."
                      className="w-full bg-background border border-border/80 rounded-xl p-3 text-xs text-foreground focus:ring-2 focus:ring-primary/40 outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={submittingLog}
                    size="sm"
                    className="bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold rounded-xl shadow-clinical-md shadow-primary/25 text-xs h-9 px-4"
                  >
                    {submittingLog ? "Submitting Log..." : "Commit Service Entry to Ledger"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 px-6 border-t border-border/80 bg-muted/10">
          <span className="text-[11px] text-muted-foreground">
            Embrace Health Grid · Asset Governance & Biomedical Ledger
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs font-bold shadow-xs hover:bg-accent"
          >
            Close Panel
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
