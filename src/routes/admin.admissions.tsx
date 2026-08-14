import React, { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { RouteGuard } from "@/components/RouteGuard";
import {
  Bed,
  UserPlus,
  LogOut,
  ArrowRightLeft,
  RefreshCw,
  Search,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  MapPin,
  Calendar,
  Receipt,
  ChevronDown,
  ChevronUp,
  History,
  X,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllAdmissions,
  admitPatient,
  dischargePatient,
  transferPatient,
  getAdmissionEvents,
  getWardOccupancy,
} from "@/lib/api";
import { getBeds } from "@/lib/operations.server";
import { getPatientDirectory } from "@/lib/inpatient.server";
import { useTableRefresh } from "@/hooks/use-realtime";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/admissions")({
  head: () => ({
    meta: [{ title: "Admin · Admissions — Embrace Health Grid" }],
  }),
  component: AdminAdmissionsPageGuarded,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface Admission {
  admission_id: string;
  patient_did: string;
  patient_name: string | null;
  admitted_at: string;
  expected_discharge: string | null;
  discharged_at: string | null;
  status: "admitted" | "discharged" | "transferred";
  ward: string | null;
  room: string | null;
  bed: string | null;
  admitting_doctor: string | null;
  diagnosis: string | null;
}

interface BedRow {
  bed_id: string;
  ward: string;
  status: string;
  patient_did: string | null;
  bed_number?: string | null;
  room_id?: string | null;
}

interface WardOccupancy {
  ward: string;
  total_admitted: number;
  currently_admitted: number;
  discharged: number;
  transferred: number;
}

const STATUS_CONFIG = {
  admitted: { label: "Admitted", color: "text-primary", bg: "bg-primary/10", icon: Activity },
  discharged: {
    label: "Discharged",
    color: "text-success",
    bg: "bg-success/10",
    icon: CheckCircle2,
  },
  transferred: {
    label: "Transferred",
    color: "text-chart-2",
    bg: "bg-chart-2/10",
    icon: ArrowRightLeft,
  },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

function AdminAdmissionsPage() {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [beds, setBeds] = useState<BedRow[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [occupancy, setOccupancy] = useState<WardOccupancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("admitted");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Modal states
  const [admitOpen, setAdmitOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [activeAdmission, setActiveAdmission] = useState<Admission | null>(null);
  const [saving, setSaving] = useState(false);

  // Admit form
  const [admitForm, setAdmitForm] = useState({
    patientDid: "",
    bedId: "",
    ward: "",
    room: "",
    diagnosis: "",
    expectedDischarge: "",
    admissionFee: "",
  });

  // Discharge form
  const [dischargeForm, setDischargeForm] = useState({
    dischargeSummary: "",
    finalBillAmount: "",
  });

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    newBedId: "",
    newWard: "",
    newRoom: "",
    transferReason: "",
  });

  // ─── Data loading ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [admRes, bedsRes, patientsRes, occRes] = await Promise.all([
        getAllAdmissions().catch(() => ({ admissions: [] })),
        getBeds().catch(() => ({ beds: [] })),
        getPatientDirectory().catch(() => ({ patients: [] })),
        getWardOccupancy().catch(() => ({ occupancy: [] })),
      ]);
      setAdmissions((admRes.admissions as Admission[]) ?? []);
      setBeds((bedsRes.beds ?? []) as BedRow[]);
      setPatients(patientsRes.patients ?? []);
      setOccupancy((occRes.occupancy as WardOccupancy[]) ?? []);
    } catch (err: any) {
      toast.error("Could not load admissions data", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time: all four tables trigger a refresh when any changes
  useTableRefresh("admissions", load);
  useTableRefresh("beds", load);
  useTableRefresh("billing_accounts", load);
  useTableRefresh("admission_events", load);

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const availableBeds = beds.filter((b) => b.status === "available");
  const getPatientName = (did: string) => patients.find((p) => p.did === did)?.owner_name ?? did;

  const filtered = admissions.filter((a) => {
    const q = searchQ.toLowerCase();
    const matchQ =
      !q ||
      (a.patient_name ?? "").toLowerCase().includes(q) ||
      a.patient_did.toLowerCase().includes(q) ||
      (a.ward ?? "").toLowerCase().includes(q) ||
      (a.diagnosis ?? "").toLowerCase().includes(q) ||
      a.admission_id.toLowerCase().includes(q);
    const matchS = statusFilter === "all" || a.status === statusFilter;
    return matchQ && matchS;
  });

  const stats = {
    admitted: admissions.filter((a) => a.status === "admitted").length,
    discharged: admissions.filter((a) => a.status === "discharged").length,
    transferred: admissions.filter((a) => a.status === "transferred").length,
    available: availableBeds.length,
  };

  // ─── Admit ─────────────────────────────────────────────────────────────────
  const handleAdmit = async () => {
    if (!admitForm.patientDid || !admitForm.bedId || !admitForm.ward) {
      toast.error("Patient, bed and ward are required");
      return;
    }
    setSaving(true);
    try {
      const res = await admitPatient({
        patientDid: admitForm.patientDid,
        bedId: admitForm.bedId,
        ward: admitForm.ward,
        room: admitForm.room || undefined,
        diagnosis: admitForm.diagnosis || undefined,
        expectedDischarge: admitForm.expectedDischarge || undefined,
        admissionFee: admitForm.admissionFee ? parseFloat(admitForm.admissionFee) : undefined,
      });
      toast.success("Patient admitted", { description: `Admission ${res.admissionId} created` });
      setAdmitOpen(false);
      setAdmitForm({
        patientDid: "",
        bedId: "",
        ward: "",
        room: "",
        diagnosis: "",
        expectedDischarge: "",
        admissionFee: "",
      });
      load();
    } catch (err: any) {
      toast.error("Admission failed", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ─── Discharge ─────────────────────────────────────────────────────────────
  const handleDischarge = async () => {
    if (!activeAdmission) return;
    setSaving(true);
    try {
      await dischargePatient({
        admissionId: activeAdmission.admission_id,
        dischargeSummary: dischargeForm.dischargeSummary || undefined,
        finalBillAmount: dischargeForm.finalBillAmount
          ? parseFloat(dischargeForm.finalBillAmount)
          : undefined,
      });
      toast.success("Patient discharged", {
        description: `Bed ${activeAdmission.bed} is now marked for cleaning.`,
      });
      setDischargeOpen(false);
      setActiveAdmission(null);
      setDischargeForm({ dischargeSummary: "", finalBillAmount: "" });
      load();
    } catch (err: any) {
      toast.error("Discharge failed", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ─── Transfer ──────────────────────────────────────────────────────────────
  const handleTransfer = async () => {
    if (!activeAdmission) return;
    if (!transferForm.newBedId || !transferForm.newWard) {
      toast.error("Target bed and ward are required");
      return;
    }
    setSaving(true);
    try {
      await transferPatient({
        admissionId: activeAdmission.admission_id,
        newBedId: transferForm.newBedId,
        newWard: transferForm.newWard,
        newRoom: transferForm.newRoom || undefined,
        transferReason: transferForm.transferReason || undefined,
      });
      toast.success("Patient transferred", {
        description: `Moved to ${transferForm.newWard} / ${transferForm.newBedId}`,
      });
      setTransferOpen(false);
      setActiveAdmission(null);
      setTransferForm({ newBedId: "", newWard: "", newRoom: "", transferReason: "" });
      load();
    } catch (err: any) {
      toast.error("Transfer failed", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ─── Audit log ─────────────────────────────────────────────────────────────
  const openAudit = async (admission: Admission) => {
    setActiveAdmission(admission);
    setAuditLoading(true);
    setAuditOpen(true);
    try {
      const res = await getAdmissionEvents({ admissionId: admission.admission_id });
      setAuditLogs(res.events ?? []);
    } catch (err: any) {
      toast.error("Could not load audit trail", { description: err.message });
    } finally {
      setAuditLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between border-b border-border pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
            Admin Console
          </div>
          <h1 className="text-2xl font-bold text-foreground">Admissions Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Admit, discharge, and transfer patients. All changes propagate in real time to beds,
            billing, and all portals.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setAdmitOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Admit Patient
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Currently Admitted",
            value: stats.admitted,
            cls: "text-primary",
            icon: Activity,
          },
          { label: "Available Beds", value: stats.available, cls: "text-success", icon: Bed },
          {
            label: "Discharged",
            value: stats.discharged,
            cls: "text-muted-foreground",
            icon: CheckCircle2,
          },
          {
            label: "Transferred",
            value: stats.transferred,
            cls: "text-chart-2",
            icon: ArrowRightLeft,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-3 shadow-clinical"
          >
            <div className={`text-2xl font-black ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Ward Occupancy */}
      {occupancy.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Live Ward Occupancy
          </div>
          <div className="flex flex-wrap gap-2">
            {occupancy.map((w) => (
              <div
                key={w.ward}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs transition-all duration-150 hover:border-primary/40 hover:bg-muted/50 cursor-pointer"
              >
                <div className="font-semibold text-foreground">{w.ward}</div>
                <div className="text-muted-foreground mt-0.5">
                  {w.currently_admitted} admitted
                  {w.discharged > 0 && ` · ${w.discharged} discharged`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search patient, ward, diagnosis, admission ID..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="admitted">Admitted</option>
          <option value="discharged">Discharged</option>
          <option value="transferred">Transferred</option>
        </select>
      </div>

      {/* Admissions list */}
      {loading ? (
        <div className="flex justify-center py-12 text-sm text-muted-foreground gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading admissions…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Bed className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <div className="text-sm font-semibold text-foreground">No admissions found</div>
          <div className="text-xs text-muted-foreground mt-1">
            {searchQ || statusFilter !== "all"
              ? "No results match your filters."
              : "No admissions yet. Click 'Admit Patient' to create one."}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((adm) => {
            const cfg = STATUS_CONFIG[adm.status] ?? STATUS_CONFIG.admitted;
            const StatusIcon = cfg.icon;
            const isExp = expandedId === adm.admission_id;
            const isActive = adm.status === "admitted";

            return (
              <div
                key={adm.admission_id}
                className="rounded-xl border border-border bg-card shadow-clinical overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-clinical-md hover:border-primary/40"
              >
                {/* Row */}
                <button
                  className="w-full text-left p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExp ? null : adm.admission_id)}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                          {adm.patient_name ?? adm.patient_did}
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.color} ${cfg.bg}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {adm.diagnosis || "No diagnosis recorded"}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {[adm.ward, adm.room, adm.bed].filter(Boolean).join(" / ") || "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(adm.admitted_at).toLocaleDateString("en-IN")}
                          </span>
                          <span className="font-mono">{adm.admission_id}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveAdmission(adm);
                              setDischargeOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-success/30 bg-success/10 px-2 py-1 text-[11px] font-medium text-success hover:bg-success/20 cursor-pointer transition-colors"
                          >
                            <LogOut className="h-3 w-3" /> Discharge
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveAdmission(adm);
                              setTransferOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-chart-2/30 bg-chart-2/10 px-2 py-1 text-[11px] font-medium text-chart-2 hover:bg-chart-2/20 cursor-pointer transition-colors"
                          >
                            <ArrowRightLeft className="h-3 w-3" /> Transfer
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAudit(adm);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted cursor-pointer transition-colors"
                      >
                        <History className="h-3 w-3" /> Audit
                      </button>
                      <div className="shrink-0">
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ease-out ${isExp ? "rotate-180" : "rotate-0"}`}
                        />
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded details — GPU-accelerated CSS Grid transition (0fr -> 1fr) */}
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isExp
                      ? "grid-rows-[1fr] opacity-100 border-t border-border"
                      : "grid-rows-[0fr] opacity-0 border-t-0 pointer-events-none"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="p-4 space-y-3 bg-card/50">
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                        {[
                          ["Admission ID", adm.admission_id],
                          ["Patient DID", adm.patient_did],
                          ["Ward", adm.ward ?? "—"],
                          ["Room", adm.room ?? "—"],
                          ["Bed", adm.bed ?? "—"],
                          ["Admitted", new Date(adm.admitted_at).toLocaleString("en-IN")],
                          [
                            "Expected Discharge",
                            adm.expected_discharge
                              ? new Date(adm.expected_discharge).toLocaleDateString("en-IN")
                              : "—",
                          ],
                          [
                            "Discharged At",
                            adm.discharged_at
                              ? new Date(adm.discharged_at).toLocaleString("en-IN")
                              : "—",
                          ],
                          ["Admitting Doctor", adm.admitting_doctor ?? "—"],
                        ].map(([k, v]) => (
                          <div
                            key={k}
                            className="rounded-lg bg-muted/50 px-3 py-2 border border-border/40"
                          >
                            <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">
                              {k}
                            </div>
                            <div className="font-medium text-foreground truncate">{v}</div>
                          </div>
                        ))}
                      </div>
                      {adm.diagnosis && (
                        <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs">
                          <span className="font-semibold text-foreground">Diagnosis: </span>
                          <span className="text-muted-foreground">{adm.diagnosis}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Admit Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={admitOpen} onOpenChange={(o) => !o && setAdmitOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Admit Patient</DialogTitle>
            <DialogDescription>
              Select a patient and an available bed. All linked modules update instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Patient *</Label>
              <select
                value={admitForm.patientDid}
                onChange={(e) => setAdmitForm({ ...admitForm, patientDid: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none"
              >
                <option value="">Select patient…</option>
                {patients.map((p) => (
                  <option key={p.did} value={p.did}>
                    {p.owner_name} — {p.did}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Available Bed *</Label>
              <select
                value={admitForm.bedId}
                onChange={(e) => {
                  const bed = availableBeds.find((b) => b.bed_id === e.target.value);
                  setAdmitForm({
                    ...admitForm,
                    bedId: e.target.value,
                    ward: bed?.ward ?? admitForm.ward,
                  });
                }}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none"
              >
                <option value="">Select bed…</option>
                {availableBeds.map((b) => (
                  <option key={b.bed_id} value={b.bed_id}>
                    {b.bed_number ?? b.bed_id} — {b.ward}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ward *</Label>
                <Input
                  value={admitForm.ward}
                  onChange={(e) => setAdmitForm({ ...admitForm, ward: e.target.value })}
                  placeholder="e.g. ICU, Ward A"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Room</Label>
                <Input
                  value={admitForm.room}
                  onChange={(e) => setAdmitForm({ ...admitForm, room: e.target.value })}
                  placeholder="e.g. Room 205"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Diagnosis</Label>
              <Input
                value={admitForm.diagnosis}
                onChange={(e) => setAdmitForm({ ...admitForm, diagnosis: e.target.value })}
                placeholder="Primary diagnosis"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Expected Discharge</Label>
                <Input
                  type="date"
                  value={admitForm.expectedDischarge}
                  onChange={(e) =>
                    setAdmitForm({ ...admitForm, expectedDischarge: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Admission Fee (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={admitForm.admissionFee}
                  onChange={(e) => setAdmitForm({ ...admitForm, admissionFee: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdmitOpen(false)} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button onClick={handleAdmit} disabled={saving}>
              <UserPlus className="h-4 w-4 mr-1" />
              {saving ? "Admitting…" : "Confirm Admission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Discharge Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={dischargeOpen} onOpenChange={(o) => !o && setDischargeOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Discharge Patient</DialogTitle>
            <DialogDescription>
              {activeAdmission && (
                <>
                  Discharging{" "}
                  <strong>{activeAdmission.patient_name ?? activeAdmission.patient_did}</strong>{" "}
                  from bed <strong>{activeAdmission.bed}</strong>. The bed will be marked for
                  cleaning.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Discharge Summary</Label>
              <Textarea
                value={dischargeForm.dischargeSummary}
                onChange={(e) =>
                  setDischargeForm({ ...dischargeForm, dischargeSummary: e.target.value })
                }
                placeholder="Clinical notes, follow-up instructions…"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Additional Charges (₹)</Label>
              <Input
                type="number"
                min="0"
                value={dischargeForm.finalBillAmount}
                onChange={(e) =>
                  setDischargeForm({ ...dischargeForm, finalBillAmount: e.target.value })
                }
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDischargeOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleDischarge}
              disabled={saving}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              <LogOut className="h-4 w-4 mr-1" />
              {saving ? "Discharging…" : "Confirm Discharge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Transfer Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={transferOpen} onOpenChange={(o) => !o && setTransferOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Patient</DialogTitle>
            <DialogDescription>
              {activeAdmission && (
                <>
                  Moving{" "}
                  <strong>{activeAdmission.patient_name ?? activeAdmission.patient_did}</strong>{" "}
                  from{" "}
                  <strong>
                    {activeAdmission.ward} / {activeAdmission.bed}
                  </strong>
                  .
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Target Bed *</Label>
              <select
                value={transferForm.newBedId}
                onChange={(e) => {
                  const bed = availableBeds.find((b) => b.bed_id === e.target.value);
                  setTransferForm({
                    ...transferForm,
                    newBedId: e.target.value,
                    newWard: bed?.ward ?? transferForm.newWard,
                  });
                }}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none"
              >
                <option value="">Select available bed…</option>
                {availableBeds
                  .filter((b) => b.bed_id !== activeAdmission?.bed)
                  .map((b) => (
                    <option key={b.bed_id} value={b.bed_id}>
                      {b.bed_number ?? b.bed_id} — {b.ward}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>New Ward *</Label>
                <Input
                  value={transferForm.newWard}
                  onChange={(e) => setTransferForm({ ...transferForm, newWard: e.target.value })}
                  placeholder="e.g. ICU"
                />
              </div>
              <div className="space-y-1.5">
                <Label>New Room</Label>
                <Input
                  value={transferForm.newRoom}
                  onChange={(e) => setTransferForm({ ...transferForm, newRoom: e.target.value })}
                  placeholder="e.g. Room 301"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Transfer Reason</Label>
              <Textarea
                value={transferForm.transferReason}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, transferReason: e.target.value })
                }
                placeholder="Clinical reason for transfer…"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleTransfer} disabled={saving}>
              <ArrowRightLeft className="h-4 w-4 mr-1" />
              {saving ? "Transferring…" : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Audit Log Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Admission Audit Trail</DialogTitle>
            <DialogDescription>
              {activeAdmission &&
                `Complete event history for admission ${activeAdmission.admission_id}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {auditLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No events recorded yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.event_id}
                  className="rounded-lg border border-border bg-card p-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-foreground capitalize flex items-center gap-2">
                        {log.event_type.replace(/_/g, " ")}
                        {log.status_old && log.status_new && log.status_old !== log.status_new && (
                          <span className="text-muted-foreground font-normal">
                            <span className="line-through">{log.status_old}</span>
                            {" → "}
                            <span className="text-foreground font-medium">{log.status_new}</span>
                          </span>
                        )}
                      </div>
                      {(log.ward_old || log.ward_new) && log.ward_old !== log.ward_new && (
                        <div className="text-muted-foreground mt-0.5">
                          Ward: <span className="line-through">{log.ward_old}</span>
                          {" → "}
                          <span className="text-foreground">{log.ward_new}</span>
                        </div>
                      )}
                      {(log.bed_id_old || log.bed_id_new) && log.bed_id_old !== log.bed_id_new && (
                        <div className="text-muted-foreground">
                          Bed: <span className="line-through">{log.bed_id_old}</span>
                          {" → "}
                          <span className="text-foreground">{log.bed_id_new}</span>
                        </div>
                      )}
                      <div className="mt-1 text-muted-foreground">
                        By: {log.performed_by_name ?? "—"} ({log.performed_by_role ?? "—"})
                      </div>
                    </div>
                    <div className="text-right text-muted-foreground whitespace-nowrap">
                      {new Date(log.occurred_at).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminAdmissionsPageGuarded() {
  return (
    <RouteGuard requiredRole="admin">
      <AdminAdmissionsPage />
    </RouteGuard>
  );
}
