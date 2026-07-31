import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import {
  FileSignature, Fingerprint, CheckCircle2, Search, Pill,
  Clock, User, ChevronDown, ChevronRight, Plus, Trash2,
  Eye, Shield, AlertTriangle, Stethoscope, RefreshCw,
  Wifi, CalendarDays, ClipboardList, X, Loader2,
  FileText, FlaskConical, ChevronUp, Link2, Hash, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  signPrescription, logAuditEvent, getMyPatients, getMyPrescriptions,
  createMedicalRecord, getMyMedicalRecords, getPatientOnChainHistory,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/staff/sign")({
  head: () => ({ meta: [{ title: "Staff · Sign & Prescribe — Embrace Health Grid" }] }),
  component: SignPage,
});

// ─── constants ────────────────────────────────────────────────────────────────
const DRUG_SUGGESTIONS = [
  "Atorvastatin 20mg","Metformin 500mg","Amlodipine 5mg","Losartan 50mg",
  "Aspirin 75mg","Pantoprazole 40mg","Atenolol 50mg","Ramipril 5mg",
  "Metoprolol 25mg","Rosuvastatin 10mg","Furosemide 40mg","Spironolactone 25mg",
  "Amoxicillin 500mg","Azithromycin 500mg","Cetirizine 10mg","Paracetamol 500mg",
  "Ibuprofen 400mg","Omeprazole 20mg","Ciprofloxacin 500mg","Doxycycline 100mg",
];
const FREQ_OPTIONS = [
  "Once daily","Twice daily","Thrice daily","Every 8 hours","Every 6 hours",
  "As needed (PRN)","At bedtime","Before meals","After meals","With meals",
];
const DURATION_OPTIONS = [
  "3 days","5 days","7 days","10 days","14 days","1 month","2 months",
  "3 months","6 months","Ongoing","Until review",
];
const USAGE_OPTIONS = [
  "Before food","After food","With food","Morning","Afternoon","Night",
  "Morning & Night","Morning, Afternoon & Night","Empty stomach",
];
const STATUS_CLS: Record<string, string> = {
  active:    "bg-primary/10 text-primary",
  dispensed: "bg-success/15 text-success",
  expired:   "bg-muted text-muted-foreground",
};

// ─── Drug row ─────────────────────────────────────────────────────────────────
interface Drug { id: string; name: string; dosage: string; frequency: string; duration: string; usage: string; instructions: string; }

function DrugRow({ drug, onRemove, onUpdate }: { drug: Drug; onRemove: () => void; onUpdate: (u: Partial<Drug>) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState(drug.name);
  const [sugg, setSugg] = useState<string[]>([]);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Pill className="h-4 w-4 text-primary shrink-0" />
        <div className="relative flex-1">
          <input value={q}
            onChange={(e) => { setQ(e.target.value); onUpdate({ name: e.target.value }); setSugg(DRUG_SUGGESTIONS.filter((d) => d.toLowerCase().includes(e.target.value.toLowerCase()) && e.target.value.length > 1).slice(0, 5)); }}
            onFocus={() => setSugg(DRUG_SUGGESTIONS.slice(0, 5))}
            onBlur={() => setTimeout(() => setSugg([]), 200)}
            placeholder="Search medication…"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          {sugg.length > 0 && (
            <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
              {sugg.map((s) => <button key={s} onMouseDown={() => { setQ(s); onUpdate({ name: s }); setSugg([]); }} className="w-full px-3 py-2 text-left text-sm hover:bg-muted">{s}</button>)}
            </div>
          )}
        </div>
        <button onClick={() => setOpen(!open)} className="rounded border border-border bg-background p-1.5 hover:bg-muted">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <button onClick={onRemove} className="rounded border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 pt-1">
          {[
            { label: "Dosage",    key: "dosage",    type: "input",  placeholder: "e.g. 500 mg, 1 tablet" },
            { label: "Frequency", key: "frequency", type: "select", options: FREQ_OPTIONS },
            { label: "Duration",  key: "duration",  type: "select", options: DURATION_OPTIONS },
            { label: "Usage",     key: "usage",     type: "select", options: USAGE_OPTIONS },
          ].map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</label>
              {f.type === "select" ? (
                <select value={(drug as any)[f.key]} onChange={(e) => onUpdate({ [f.key]: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Select…</option>
                  {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input value={(drug as any)[f.key]} onChange={(e) => onUpdate({ [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring" />
              )}
            </div>
          ))}
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Special Instructions</label>
            <input value={drug.instructions} onChange={(e) => onUpdate({ instructions: e.target.value })}
              placeholder="e.g. Take with plenty of water, avoid dairy…"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function SignPage() {
  const currentUser  = getCurrentUser();
  const doctorDid    = currentUser?.did  ?? (typeof window !== "undefined" ? localStorage.getItem("userDID")   ?? "" : "");
  const doctorName   = currentUser?.name ?? (typeof window !== "undefined" ? localStorage.getItem("userName")  ?? "Doctor" : "Doctor");

  // ── data ──────────────────────────────────────────────────────────────────
  const [patients,        setPatients]        = useState<any[]>([]);
  const [myPrescriptions, setMyPrescriptions] = useState<any[]>([]);
  const [myReports,       setMyReports]       = useState<any[]>([]);
  const [loadingPts,      setLoadingPts]      = useState(true);

  const loadData = useCallback(async () => {
    setLoadingPts(true);
    try {
      const [pRes, rxRes, recRes] = await Promise.allSettled([
        getMyPatients(), getMyPrescriptions(), getMyMedicalRecords(),
      ]);
      if (pRes.status   === "fulfilled") setPatients(pRes.value.patients ?? []);
      if (rxRes.status  === "fulfilled") setMyPrescriptions(rxRes.value.prescriptions ?? []);
      if (recRes.status === "fulfilled") setMyReports(recRes.value.records ?? []);
    } catch { /* silent */ }
    finally { setLoadingPts(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── patient / appointment selection ──────────────────────────────────────
  const [searchQ,         setSearchQ]        = useState("");
  const [statusFilter,    setStatusFilter]   = useState("All");
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [selectedApptId,  setSelectedApptId]  = useState<string>("");

  const filteredPts = useMemo(() => patients.filter((p) => {
    const q = searchQ.toLowerCase();
    const matchQ = !q || p.patientName?.toLowerCase().includes(q) || p.patientDid?.toLowerCase().includes(q);
    const matchS = statusFilter === "All" || (p.appointments ?? []).some((a: any) => a.status === statusFilter.toLowerCase());
    return matchQ && matchS;
  }), [patients, searchQ, statusFilter]);

  const selectedAppt = useMemo(() =>
    (selectedPatient?.appointments ?? []).find((a: any) => a.apptId === selectedApptId)
    ?? selectedPatient?.latestAppt ?? null,
    [selectedPatient, selectedApptId]);

  // ── prescription form ─────────────────────────────────────────────────────
  const [drugs,          setDrugs]          = useState<Drug[]>([{ id: "d1", name: "", dosage: "", frequency: "Once daily", duration: "7 days", usage: "After food", instructions: "" }]);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [symptoms,       setSymptoms]       = useState("");
  const [diagnosis,      setDiagnosis]      = useState("");
  const [notes,          setNotes]          = useState("");
  const [followUpDate,   setFollowUpDate]   = useState("");

  // ── medical report form (new) ─────────────────────────────────────────────
  const [consultationSummary, setConsultationSummary] = useState("");
  const [clinicalNotes,       setClinicalNotes]       = useState("");
  const [testResults,         setTestResults]         = useState("");
  const [recommendedFollowUp, setRecommendedFollowUp] = useState("");

  // ── signing state ─────────────────────────────────────────────────────────
  const [signing,     setSigning]     = useState(false);
  const [signed,      setSigned]      = useState(false);
  const [signedBlock, setSignedBlock] = useState<any>(null);

  // ── history expand ────────────────────────────────────────────────────────
  const [expandedRxId, setExpandedRxId] = useState<string | null>(null);

  // ── on-chain prescription history ────────────────────────────────────────
  const [onChainHistory,     setOnChainHistory]     = useState<any[]>([]);
  const [loadingOnChain,     setLoadingOnChain]     = useState(false);
  const [onChainLoaded,      setOnChainLoaded]      = useState(false);
  const [onChainError,       setOnChainError]       = useState<string | null>(null);
  const [onChainExpandedId,  setOnChainExpandedId]  = useState<string | null>(null);
  const [showOnChainPanel,   setShowOnChainPanel]   = useState(false);

  const resetForm = () => {
    setDrugs([{ id: "d1", name: "", dosage: "", frequency: "Once daily", duration: "7 days", usage: "After food", instructions: "" }]);
    setChiefComplaint(""); setSymptoms(""); setDiagnosis(""); setNotes(""); setFollowUpDate("");
    setConsultationSummary(""); setClinicalNotes(""); setTestResults(""); setRecommendedFollowUp("");
    setSigned(false); setSignedBlock(null);
    // clear on-chain panel
    setOnChainHistory([]); setOnChainLoaded(false); setOnChainError(null);
    setShowOnChainPanel(false); setOnChainExpandedId(null);
  };

  const addDrug    = () => setDrugs((p) => [...p, { id: `d${Date.now()}`, name: "", dosage: "", frequency: "Once daily", duration: "7 days", usage: "After food", instructions: "" }]);
  const removeDrug = (id: string) => setDrugs((p) => p.filter((d) => d.id !== id));
  const updateDrug = (id: string, u: Partial<Drug>) => setDrugs((p) => p.map((d) => d.id === id ? { ...d, ...u } : d));

  // ── fetch on-chain history for selected patient ───────────────────────────
  const handleFetchOnChainHistory = async () => {
    if (!selectedPatient?.patientDid) return;
    setLoadingOnChain(true);
    setOnChainError(null);
    setShowOnChainPanel(true);
    try {
      const res = await getPatientOnChainHistory(selectedPatient.patientDid);
      setOnChainHistory(res.prescriptions ?? []);
      setOnChainLoaded(true);
      if ((res.prescriptions ?? []).length === 0) {
        toast.info("No on-chain prescription history found for this patient.");
      } else {
        toast.success(`${res.prescriptions.length} on-chain prescription${res.prescriptions.length !== 1 ? "s" : ""} retrieved and verified.`);
      }
    } catch (err: any) {
      const msg = err.message || "Failed to fetch on-chain history";
      setOnChainError(msg);
      setOnChainLoaded(true);
      if (err.message?.includes("NO_CONFIRMED_APPOINTMENT") || err.message?.includes("confirmed appointment")) {
        toast.error("Access Denied", { description: "A confirmed appointment is required to view this patient's on-chain prescription history." });
      } else {
        toast.error("Failed to load on-chain history", { description: msg });
      }
    } finally {
      setLoadingOnChain(false);
    }
  };

  const handleSign = async () => {
    if (!selectedPatient)              { toast.error("Select a patient first"); return; }
    if (!drugs[0]?.name)               { toast.error("Add at least one medication"); return; }
    if (!diagnosis.trim())             { toast.error("Diagnosis is required"); return; }
    setSigning(true);
    try {
      // 1. Sign the prescription
      const res = await signPrescription({
        patientDid:    selectedPatient.patientDid,
        patientName:   selectedPatient.patientName,
        apptId:        selectedApptId || selectedAppt?.apptId || "",
        drugs:         drugs.map((d) => ({ name: d.name, dosage: d.dosage, frequency: d.frequency, duration: d.duration, usage: d.usage, instructions: d.instructions })),
        diagnosis, chiefComplaint, symptoms, notes,
        followUpDate:  followUpDate || undefined,
        signedBy:      doctorName,
      }) as any;

      const newRxId  = res.rxId  || res.rx?.rxId;
      const newApptId = selectedApptId || selectedAppt?.apptId || "";

      // 2. Auto-create the linked medical report
      const summary = consultationSummary ||
        `Consultation for ${selectedPatient.patientName}. Chief complaint: ${chiefComplaint || "—"}. Diagnosis: ${diagnosis}.`;
      await createMedicalRecord(selectedPatient.patientDid, {
        title:              `Consultation Report — ${diagnosis}`,
        type:               "prescription",
        content:            summary,
        doctorDid,
        doctorName,
        rxId:               newRxId,
        apptId:             newApptId,
        consultationSummary: summary,
        clinicalNotes:      clinicalNotes || `Symptoms: ${symptoms || "—"}. ${notes ? `Notes: ${notes}` : ""}`.trim(),
        testResults:        testResults || "",
        recommendedFollowUp: recommendedFollowUp || (followUpDate ? `Follow-up on ${new Date(followUpDate).toLocaleDateString("en-IN")}` : ""),
      }).catch(() => { /* report creation is best-effort */ });

      setSignedBlock(res);
      await logAuditEvent(doctorName, `Prescription ${newRxId}`, "signed", "success", "info").catch(() => {});
      toast.success(`Prescription ${newRxId} signed`, { description: `Medical report auto-created · ${new Date().toLocaleTimeString("en-IN")}` });
      setSigned(true);
      loadData();
    } catch (err: any) {
      toast.error("Signing failed", { description: err.message });
    } finally { setSigning(false); }
  };

  // ── does the selected patient have a confirmed appointment? ──────────────
  const hasConfirmedAppt = useMemo(() => {
    if (!selectedPatient) return false;
    return (selectedPatient.appointments ?? []).some(
      (a: any) => a.status === "confirmed" || a.status === "accepted",
    );
  }, [selectedPatient]);

  // ── join prescriptions with their linked reports ──────────────────────────
  const patientPrescriptions = useMemo(() =>
    myPrescriptions
      .filter((rx) => !selectedPatient || rx.patientDid === selectedPatient.patientDid)
      .sort((a, b) => (b.signedAt || "").localeCompare(a.signedAt || ""))
      .slice(0, 20)
      .map((rx) => ({
        ...rx,
        linkedReport: myReports.find((r) => r.rxId === rx.rxId) ?? null,
      })),
    [myPrescriptions, myReports, selectedPatient]);

  return (
    <RouteGuard requiredRole="staff">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between border-b border-border pb-4">
          <PageHeader eyebrow="Digital Signature" title="Sign & Prescribe"
            description="Issue prescriptions for your appointment patients. Each prescription is cryptographically signed with your DID and generates a linked medical report automatically." />
          <button onClick={loadData} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted shrink-0">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* ── Patient list ──────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> My Patients
                <span className="ml-auto text-xs font-normal text-muted-foreground">{patients.length} total</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search by name or DID…"
                  className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" />
              </div>
              <div className="flex gap-1 flex-wrap">
                {["All","confirmed","pending","rejected"].map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border transition-all ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-muted"}`}>
                    {s === "All" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
              {loadingPts ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filteredPts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
                  No patients found. Patients appear here after booking an appointment with you.
                </div>
              ) : filteredPts.map((pt) => {
                const isSelected = selectedPatient?.patientDid === pt.patientDid;
                const appt = pt.latestAppt;
                return (
                  <button key={pt.patientDid} onClick={() => { setSelectedPatient(pt); setSelectedApptId(appt?.apptId ?? ""); resetForm(); }}
                    className={`w-full text-left rounded-xl border p-3 transition-all space-y-1.5 ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/40"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">{pt.patientName}</span>
                      {appt && (
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold shrink-0 ${appt.status === "confirmed" ? "bg-success/15 text-success" : appt.status === "pending" ? "bg-warning/15 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                          {appt.status}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground truncate">{pt.patientDid}</div>
                    {appt && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <CalendarDays className="h-3 w-3 shrink-0" />
                        <span>{appt.date ?? appt.slot}</span>
                        {appt.reason && <span className="truncate">· {appt.reason}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right panel ───────────────────────────────────────────── */}
          {!selectedPatient ? (
            <div className="rounded-xl border border-dashed border-border bg-card flex items-center justify-center p-12 text-center">
              <div className="space-y-2 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto opacity-30" />
                <p className="text-sm font-medium">Select a patient to start prescribing</p>
                <p className="text-xs">Only your appointment patients are shown above.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Patient banner */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-bold text-foreground">{selectedPatient.patientName}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{selectedPatient.patientDid}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* On-chain history button — only for confirmed appointments */}
                    <button
                      onClick={handleFetchOnChainHistory}
                      disabled={loadingOnChain || !hasConfirmedAppt}
                      title={!hasConfirmedAppt ? "Requires a confirmed appointment" : "View patient's on-chain prescription history"}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-chart-2/40 bg-chart-2/10 px-3 py-1.5 text-xs font-semibold text-chart-2 hover:bg-chart-2/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                      {loadingOnChain
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</>
                        : <><Link2 className="h-3.5 w-3.5" /> On-Chain History</>}
                    </button>
                    <button onClick={() => { setSelectedPatient(null); resetForm(); }} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {(selectedPatient.appointments?.length ?? 0) > 1 && (
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Appointment</label>
                    <select value={selectedApptId} onChange={(e) => setSelectedApptId(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring">
                      {selectedPatient.appointments.map((a: any) => (
                        <option key={a.apptId} value={a.apptId}>{a.date ?? a.slot} · {a.status}{a.reason ? ` · ${a.reason}` : ""}</option>
                      ))}
                    </select>
                  </div>
                )}
                {selectedAppt && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[["Appointment ID", selectedAppt.apptId ?? "—"],["Date / Slot", selectedAppt.date ?? selectedAppt.slot ?? "—"],["Status", selectedAppt.status ?? "—"],["Reason", selectedAppt.reason || "—"]].map(([k,v]) => (
                      <div key={k} className="rounded-lg bg-card border border-border px-3 py-1.5">
                        <div className="text-[9px] font-semibold uppercase text-muted-foreground">{k}</div>
                        <div className="font-medium text-foreground truncate">{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <AnimatePresence mode="wait">
                {!signed ? (
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

                    {/* Chief Complaint + Symptoms */}
                    <div className="rounded-xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground"><Stethoscope className="inline h-3.5 w-3.5 text-primary mr-1" />Chief Complaint</label>
                        <textarea value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} rows={2} placeholder="Patient's primary complaint…"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">Symptoms</label>
                        <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} rows={2} placeholder="Observed symptoms (comma-separated)…"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                      </div>
                    </div>

                    {/* Diagnosis */}
                    <div className="rounded-xl border border-border bg-card p-4">
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">Diagnosis / Clinical Indication <span className="text-destructive">*</span></label>
                      <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} placeholder="Clinical diagnosis…"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                    </div>

                    {/* Medicines */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground flex items-center gap-2"><Pill className="h-4 w-4 text-primary" /> Medicines ({drugs.length})</div>
                        <button onClick={addDrug} className="flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
                          <Plus className="h-3.5 w-3.5" /> Add Medicine
                        </button>
                      </div>
                      {drugs.map((d) => <DrugRow key={d.id} drug={d} onRemove={() => removeDrug(d.id)} onUpdate={(u) => updateDrug(d.id, u)} />)}
                    </div>

                    {/* Notes + follow-up */}
                    <div className="rounded-xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">Additional Notes</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Dietary advice, referrals, precautions…"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">Follow-up Date <span className="text-muted-foreground font-normal">(optional)</span></label>
                        <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                    </div>

                    {/* Medical Report fields */}
                    <div className="rounded-xl border border-chart-2/30 bg-chart-2/5 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <FileText className="h-4 w-4 text-chart-2" /> Medical Report (auto-linked to prescription)
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-foreground">Consultation Summary</label>
                          <textarea value={consultationSummary} onChange={(e) => setConsultationSummary(e.target.value)} rows={2} placeholder="Summary of this consultation…"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-foreground">Clinical Notes</label>
                          <textarea value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} rows={2} placeholder="Examination findings, clinical observations…"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-foreground"><FlaskConical className="inline h-3.5 w-3.5 mr-1 text-chart-2" />Test Results</label>
                          <textarea value={testResults} onChange={(e) => setTestResults(e.target.value)} rows={2} placeholder="Lab results, imaging findings, vitals…"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-foreground">Recommended Follow-up</label>
                          <textarea value={recommendedFollowUp} onChange={(e) => setRecommendedFollowUp(e.target.value)} rows={2} placeholder="Follow-up plan, referrals, lifestyle advice…"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                        </div>
                      </div>
                    </div>

                    {/* Preview + sign */}
                    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                      <div className="rounded-xl border border-border bg-gradient-to-br from-card to-muted/20 p-4 space-y-2">
                        <div className="text-xs font-bold text-foreground uppercase tracking-wider">Prescription Preview</div>
                        {drugs.filter((d) => d.name).map((d, i) => (
                          <div key={d.id} className="text-xs text-foreground">
                            <span className="font-semibold text-primary">Rx{i+1}.</span> {d.name}
                            {d.dosage    && <> · {d.dosage}</>}
                            {d.frequency && <> · {d.frequency}</>}
                            {d.duration  && <> · {d.duration}</>}
                            {d.usage     && <> ({d.usage})</>}
                            {d.instructions && <div className="text-muted-foreground ml-4">↳ {d.instructions}</div>}
                          </div>
                        ))}
                        {diagnosis && <div className="border-t border-border/50 pt-2 text-xs"><span className="text-muted-foreground">Dx: </span>{diagnosis}</div>}
                        {followUpDate && <div className="text-xs text-primary">Follow-up: {new Date(followUpDate).toLocaleDateString("en-IN")}</div>}
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-xl border border-border bg-card p-4">
                          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground"><Shield className="h-4 w-4 text-primary" /> Signer Identity</div>
                          <div className="space-y-2 text-xs">
                            {[["Physician", doctorName],["DID", doctorDid || "—"],["Method","DID + Ed25519"]].map(([k,v]) => (
                              <div key={k} className="flex justify-between border-b border-border/50 pb-1.5 last:border-0">
                                <span className="text-muted-foreground">{k}</span>
                                <span className={`font-medium text-right truncate max-w-[140px] ${k === "DID" ? "font-mono text-primary" : "text-foreground"}`}>{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <button onClick={handleSign} disabled={signing}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-70 transition-all">
                          {signing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Signing…</> : <><Fingerprint className="h-4 w-4" /> Sign & Issue Prescription</>}
                        </button>
                        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-foreground mt-0.5" />
                          Verify patient identity before signing. Prescriptions are legally binding.
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border border-success/30 bg-success/5 p-6 text-center space-y-3">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
                    <div className="text-base font-bold text-foreground">Prescription Signed & Medical Report Created</div>
                    <div className="font-mono text-xs text-muted-foreground">{signedBlock?.rxId}</div>
                    <div className="text-xs text-muted-foreground">Ed25519 · {new Date().toLocaleString("en-IN")}</div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-[11px] font-semibold text-success">
                      <Wifi className="h-3 w-3" /> Anchored to Ledger · Report Linked
                    </div>
                    <div className="flex gap-2 justify-center pt-2">
                      <button onClick={resetForm} className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted">
                        <Plus className="h-3.5 w-3.5" /> New Prescription
                      </button>
                    </div>
                    <p className="text-[11px] text-success font-medium">Prescription and medical report are now visible in the patient's portal and staff portal.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── On-Chain Prescription History Panel ────────────────────── */}
        {showOnChainPanel && selectedPatient && (
          <div className="rounded-xl border-2 border-chart-2/30 bg-chart-2/5 p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-chart-2" />
                <div>
                  <div className="text-sm font-bold text-foreground">On-Chain Prescription History</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedPatient.patientName} · {onChainHistory.length} record{onChainHistory.length !== 1 ? "s" : ""} · Read-only
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleFetchOnChainHistory} disabled={loadingOnChain}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
                  <RefreshCw className={`h-3 w-3 ${loadingOnChain ? "animate-spin" : ""}`} /> Refresh
                </button>
                <button onClick={() => setShowOnChainPanel(false)}
                  className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Access gate notice */}
            {!hasConfirmedAppt && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                A confirmed appointment is required to access this patient's on-chain prescription history.
              </div>
            )}

            {/* Read-only notice */}
            {hasConfirmedAppt && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 shrink-0 text-warning-foreground" />
                Read-only — Historical records are retrieved from the blockchain ledger and cannot be modified.
              </div>
            )}

            {/* Loading */}
            {loadingOnChain && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Retrieving and verifying on-chain records…
              </div>
            )}

            {/* Error */}
            {!loadingOnChain && onChainError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {onChainError}
              </div>
            )}

            {/* Empty state */}
            {!loadingOnChain && !onChainError && onChainLoaded && onChainHistory.length === 0 && (
              <div className="rounded-xl border border-dashed border-chart-2/30 py-10 text-center space-y-2">
                <Link2 className="h-8 w-8 mx-auto text-muted-foreground/30" />
                <div className="text-sm font-semibold text-foreground">No on-chain prescription history found.</div>
                <div className="text-xs text-muted-foreground">This patient has no prior prescriptions stored in the ledger.</div>
              </div>
            )}

            {/* Prescription cards */}
            {!loadingOnChain && onChainHistory.length > 0 && (
              <div className="space-y-3">
                {onChainHistory.map((rx) => {
                  const isExp = onChainExpandedId === rx.rxId;
                  const sigStatus = rx.verification?.signatureStatus ?? "no_signature";
                  const sigCls = sigStatus === "verified"
                    ? "bg-success/15 text-success border-success/30"
                    : sigStatus === "hash_mismatch"
                    ? "bg-destructive/10 text-destructive border-destructive/20"
                    : "bg-muted text-muted-foreground border-border";
                  const sigLabel = sigStatus === "verified" ? "Verified" : sigStatus === "hash_mismatch" ? "Hash Mismatch" : "Unanchored";
                  const sigIcon = sigStatus === "verified"
                    ? <ShieldCheck className="h-3 w-3" />
                    : sigStatus === "hash_mismatch"
                    ? <AlertTriangle className="h-3 w-3" />
                    : <Shield className="h-3 w-3" />;

                  return (
                    <div key={rx.rxId} className="rounded-xl border border-border bg-card overflow-hidden">
                      {/* Summary row */}
                      <button className="w-full text-left p-4" onClick={() => setOnChainExpandedId(isExp ? null : rx.rxId)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-2/10">
                              <Pill className="h-5 w-5 text-chart-2" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                                {rx.diagnosis || "Consultation"}
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sigCls}`}>
                                  {sigIcon} {sigLabel}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground truncate max-w-[380px]">
                                {rx.chiefComplaint ? `CC: ${rx.chiefComplaint}` : ""}
                                {rx.symptoms ? ` · ${rx.symptoms}` : ""}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {rx.doctorName || rx.signedBy || "Doctor"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" />
                                  {rx.signedAt ? new Date(rx.signedAt).toLocaleString("en-IN") : "—"}
                                </span>
                                <span className="font-mono">{rx.rxId}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">{(rx.drugs ?? []).length} drug{(rx.drugs ?? []).length !== 1 ? "s" : ""}</span>
                            {isExp ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>
                      </button>

                      {/* Expanded full detail */}
                      {isExp && (
                        <div className="border-t border-border px-4 pb-5 pt-3 space-y-4">

                          {/* Identity grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                            {[
                              ["Doctor",      rx.doctorName || rx.signedBy || "—"],
                              ["Doctor DID",  rx.doctorDid  || "—"],
                              ["Patient DID", rx.patientDid || "—"],
                              ["Appointment", rx.apptId     || "—"],
                              ["Issued At",   rx.signedAt ? new Date(rx.signedAt).toLocaleString("en-IN") : "—"],
                              ["Follow-up",   rx.followUpDate ? new Date(rx.followUpDate).toLocaleDateString("en-IN") : "—"],
                            ].map(([k, v]) => (
                              <div key={k} className="rounded-lg bg-muted/50 px-3 py-2">
                                <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">{k}</div>
                                <div className="font-medium text-foreground truncate">{v}</div>
                              </div>
                            ))}
                          </div>

                          {/* Chief complaint + symptoms */}
                          {(rx.chiefComplaint || rx.symptoms) && (
                            <div className="grid gap-2 sm:grid-cols-2 text-xs">
                              {rx.chiefComplaint && (
                                <div className="rounded-lg bg-card border border-border px-3 py-2">
                                  <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5 flex items-center gap-1"><Stethoscope className="h-3 w-3" /> Chief Complaint</div>
                                  <div>{rx.chiefComplaint}</div>
                                </div>
                              )}
                              {rx.symptoms && (
                                <div className="rounded-lg bg-card border border-border px-3 py-2">
                                  <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Symptoms</div>
                                  <div>{rx.symptoms}</div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Medicines */}
                          {(rx.drugs ?? []).length > 0 && (
                            <div className="space-y-1.5">
                              <div className="text-[10px] font-bold uppercase text-muted-foreground">Medicines</div>
                              {(rx.drugs ?? []).map((d: any, i: number) => (
                                <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
                                  <Pill className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-semibold text-foreground">{d.name}</span>
                                    {d.dosage    && <span className="text-muted-foreground"> · {d.dosage}</span>}
                                    {d.frequency && <span className="text-muted-foreground"> · {d.frequency}</span>}
                                    {d.duration  && <span className="text-muted-foreground"> · {d.duration}</span>}
                                    {d.usage     && <span className="text-primary"> ({d.usage})</span>}
                                    {d.instructions && <div className="italic text-muted-foreground mt-0.5">{d.instructions}</div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Notes */}
                          {rx.notes && (
                            <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs">
                              <span className="font-semibold text-foreground">Additional Notes: </span>
                              <span className="text-muted-foreground">{rx.notes}</span>
                            </div>
                          )}

                          {/* Blockchain verification panel */}
                          <div className="rounded-xl border border-chart-2/25 bg-chart-2/5 p-3 space-y-2">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-chart-2 flex items-center gap-1.5">
                              <Link2 className="h-3.5 w-3.5" /> Blockchain Verification
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-lg bg-card border border-border px-3 py-2">
                                <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Signature Status</div>
                                <div className={`font-semibold ${sigStatus === "verified" ? "text-success" : sigStatus === "hash_mismatch" ? "text-destructive" : "text-muted-foreground"}`}>
                                  {sigStatus === "verified" ? "✓ Hash Verified" : sigStatus === "hash_mismatch" ? "⚠ Hash Mismatch" : "—"}
                                </div>
                              </div>
                              <div className="rounded-lg bg-card border border-border px-3 py-2">
                                <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Network</div>
                                <div className="font-medium text-foreground">
                                  {rx.verification?.anchorRecord?.network || rx.blockchainMeta?.network || "solana-devnet"}
                                </div>
                              </div>
                            </div>
                            {/* Hash */}
                            <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1.5 font-mono text-[9px] text-primary overflow-x-auto">
                              <Hash className="h-3 w-3 shrink-0" />
                              {rx.hash || "—"}
                            </div>
                            {/* Anchor record */}
                            {rx.verification?.anchorRecord && (
                              <div className="text-[10px] text-muted-foreground space-y-0.5">
                                <div><span className="font-semibold text-foreground">Anchor ID:</span> {rx.verification.anchorRecord.anchorId}</div>
                                <div><span className="font-semibold text-foreground">Anchored At:</span> {new Date(rx.verification.anchorRecord.anchoredAt).toLocaleString("en-IN")}</div>
                                <div className="font-mono text-[9px] truncate">
                                  <span className="font-semibold text-foreground not-italic">Sig: </span>
                                  {rx.verification.anchorRecord.signature}
                                </div>
                              </div>
                            )}
                            {/* Verified timestamp */}
                            <div className="text-[10px] text-muted-foreground">
                              Verified at: {rx.verification?.verifiedAt ? new Date(rx.verification.verifiedAt).toLocaleString("en-IN") : "—"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── My Prescriptions + linked reports ───────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {selectedPatient ? `Prescriptions for ${selectedPatient.patientName}` : "All My Prescriptions"}
              <span className="text-xs font-normal text-muted-foreground">({patientPrescriptions.length})</span>
            </div>
          </div>
          <div className="space-y-3">
            {patientPrescriptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">No prescriptions issued yet.</div>
            ) : patientPrescriptions.map((rx) => {
              const st    = STATUS_CLS[rx.status] ?? STATUS_CLS.active;
              const isExp = expandedRxId === rx.rxId;
              return (
                <div key={rx.rxId} className="rounded-xl border border-border overflow-hidden">
                  {/* Summary row */}
                  <button className="w-full text-left flex items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors"
                    onClick={() => setExpandedRxId(isExp ? null : rx.rxId)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{rx.patientName ?? rx.patientDid}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st}`}>{rx.status}</span>
                        {rx.linkedReport && (
                          <span className="rounded-full bg-chart-2/15 text-chart-2 px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
                            <FileText className="h-2.5 w-2.5" /> Report Linked
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">{rx.diagnosis}{rx.chiefComplaint ? ` · ${rx.chiefComplaint}` : ""}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">{(rx.drugs ?? []).map((d: any) => d.name).join(", ")}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono">{rx.rxId}</span><span>·</span>
                        <span>{rx.signedAt ? new Date(rx.signedAt).toLocaleString("en-IN") : "—"}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isExp ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded: full prescription + linked report */}
                  {isExp && (
                    <div className="px-4 pb-4 pt-3 space-y-4">
                      {/* Prescription detail */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-primary">Prescription</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[["Patient DID", rx.patientDid ?? "—"],["Appointment", rx.apptId ?? "—"],["Doctor DID", rx.doctorDid ?? doctorDid ?? "—"],["Follow-up", rx.followUpDate ? new Date(rx.followUpDate).toLocaleDateString("en-IN") : "—"]].map(([k,v]) => (
                            <div key={k} className="rounded-lg bg-muted/50 px-3 py-2">
                              <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">{k}</div>
                              <div className="font-medium text-foreground truncate">{v}</div>
                            </div>
                          ))}
                        </div>
                        {(rx.chiefComplaint || rx.symptoms) && (
                          <div className="grid gap-2 sm:grid-cols-2 text-xs">
                            {rx.chiefComplaint && <div className="rounded-lg bg-card border px-3 py-2"><div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Chief Complaint</div><div>{rx.chiefComplaint}</div></div>}
                            {rx.symptoms       && <div className="rounded-lg bg-card border px-3 py-2"><div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Symptoms</div><div>{rx.symptoms}</div></div>}
                          </div>
                        )}
                        <div className="space-y-1.5">
                          {(rx.drugs ?? []).map((d: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
                              <Pill className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold">{d.name}</span>
                                {d.dosage    && <span className="text-muted-foreground"> · {d.dosage}</span>}
                                {d.frequency && <span className="text-muted-foreground"> · {d.frequency}</span>}
                                {d.duration  && <span className="text-muted-foreground"> · {d.duration}</span>}
                                {d.usage     && <span className="text-primary"> ({d.usage})</span>}
                                {d.instructions && <div className="italic text-muted-foreground mt-0.5">{d.instructions}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                        {rx.notes && <div className="rounded-lg bg-muted/40 border px-3 py-2 text-xs"><span className="font-semibold">Notes: </span><span className="text-muted-foreground">{rx.notes}</span></div>}
                      </div>

                      {/* Linked medical report */}
                      {rx.linkedReport ? (
                        <div className="rounded-xl border border-chart-2/30 bg-chart-2/5 p-3 space-y-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-chart-2 flex items-center gap-1.5"><FileText className="h-3 w-3" /> Linked Medical Report</div>
                          <div className="text-xs font-semibold text-foreground">{rx.linkedReport.title}</div>
                          <div className="text-[10px] text-muted-foreground">{new Date(rx.linkedReport.createdAt).toLocaleString("en-IN")} · {rx.linkedReport.recordId}</div>
                          {rx.linkedReport.consultationSummary && <div className="text-xs text-foreground border-t border-border/50 pt-2"><span className="font-semibold">Summary: </span>{rx.linkedReport.consultationSummary}</div>}
                          {rx.linkedReport.clinicalNotes       && <div className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Clinical Notes: </span>{rx.linkedReport.clinicalNotes}</div>}
                          {rx.linkedReport.testResults         && <div className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Test Results: </span>{rx.linkedReport.testResults}</div>}
                          {rx.linkedReport.recommendedFollowUp && <div className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Recommended Follow-up: </span>{rx.linkedReport.recommendedFollowUp}</div>}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                          <Eye className="h-3.5 w-3.5 shrink-0" /> No medical report linked to this prescription.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
