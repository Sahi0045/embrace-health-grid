import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import {
  FileSignature, Fingerprint, CheckCircle2, Search, Pill,
  Clock, User, ChevronDown, ChevronRight, Plus, Trash2,
  Eye, Shield, AlertTriangle, Stethoscope, RefreshCw,
  Wifi, CalendarDays, ClipboardList, X, ChevronLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  signPrescription, logAuditEvent, getMyPatients, getMyPrescriptions,
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
            { label: "Dosage",     key: "dosage",     type: "input",  placeholder: "e.g. 500 mg, 1 tablet" },
            { label: "Frequency",  key: "frequency",  type: "select", options: FREQ_OPTIONS  },
            { label: "Duration",   key: "duration",   type: "select", options: DURATION_OPTIONS },
            { label: "Usage",      key: "usage",      type: "select", options: USAGE_OPTIONS },
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
  const doctorEmail  = currentUser?.email ?? (typeof window !== "undefined" ? localStorage.getItem("userEmail") ?? "" : "");

  // ── data ──────────────────────────────────────────────────────────────────
  const [patients,       setPatients]       = useState<any[]>([]);
  const [myPrescriptions,setMyPrescriptions]= useState<any[]>([]);
  const [loadingPts,     setLoadingPts]     = useState(true);

  const loadData = useCallback(async () => {
    setLoadingPts(true);
    try {
      const [pRes, rxRes] = await Promise.allSettled([getMyPatients(), getMyPrescriptions()]);
      if (pRes.status  === "fulfilled") setPatients(pRes.value.patients       ?? []);
      if (rxRes.status === "fulfilled") setMyPrescriptions(rxRes.value.prescriptions ?? []);
    } catch { /* silent */ }
    finally { setLoadingPts(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── patient / appointment selection ──────────────────────────────────────
  const [searchQ,         setSearchQ]         = useState("");
  const [statusFilter,    setStatusFilter]     = useState("All");
  const [selectedPatient, setSelectedPatient]  = useState<any | null>(null);
  const [selectedApptId,  setSelectedApptId]   = useState<string>("");

  const filteredPts = useMemo(() => {
    return patients.filter((p) => {
      const q = searchQ.toLowerCase();
      const matchQ = !q || p.patientName?.toLowerCase().includes(q) || p.patientDid?.toLowerCase().includes(q);
      const matchS = statusFilter === "All" || (p.appointments ?? []).some((a: any) => a.status === statusFilter.toLowerCase());
      return matchQ && matchS;
    });
  }, [patients, searchQ, statusFilter]);

  const selectedAppt = useMemo(() =>
    (selectedPatient?.appointments ?? []).find((a: any) => a.apptId === selectedApptId) ?? selectedPatient?.latestAppt ?? null,
    [selectedPatient, selectedApptId]);

  // ── prescription form ─────────────────────────────────────────────────────
  const [drugs,          setDrugs]          = useState<Drug[]>([{ id: "d1", name: "", dosage: "", frequency: "Once daily", duration: "7 days", usage: "After food", instructions: "" }]);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [symptoms,       setSymptoms]       = useState("");
  const [diagnosis,      setDiagnosis]      = useState("");
  const [notes,          setNotes]          = useState("");
  const [followUpDate,   setFollowUpDate]   = useState("");

  // ── signing state ─────────────────────────────────────────────────────────
  const [signing,    setSigning]    = useState(false);
  const [signed,     setSigned]     = useState(false);
  const [signedBlock, setSignedBlock] = useState<any>(null);

  const resetForm = () => {
    setDrugs([{ id: "d1", name: "", dosage: "", frequency: "Once daily", duration: "7 days", usage: "After food", instructions: "" }]);
    setChiefComplaint(""); setSymptoms(""); setDiagnosis(""); setNotes(""); setFollowUpDate("");
    setSigned(false); setSignedBlock(null);
  };

  const addDrug    = () => setDrugs((p) => [...p, { id: `d${Date.now()}`, name: "", dosage: "", frequency: "Once daily", duration: "7 days", usage: "After food", instructions: "" }]);
  const removeDrug = (id: string) => setDrugs((p) => p.filter((d) => d.id !== id));
  const updateDrug = (id: string, u: Partial<Drug>) => setDrugs((p) => p.map((d) => d.id === id ? { ...d, ...u } : d));

  const handleSign = async () => {
    if (!selectedPatient) { toast.error("Select a patient first"); return; }
    if (drugs.length === 0 || !drugs[0].name) { toast.error("Add at least one medication"); return; }
    if (!diagnosis.trim()) { toast.error("Diagnosis is required"); return; }
    setSigning(true);
    try {
      const res = await signPrescription({
        patientDid:    selectedPatient.patientDid,
        patientName:   selectedPatient.patientName,
        apptId:        selectedApptId || selectedAppt?.apptId || "",
        drugs:         drugs.map((d) => ({ name: d.name, dosage: d.dosage, frequency: d.frequency, duration: d.duration, usage: d.usage, instructions: d.instructions })),
        diagnosis,
        chiefComplaint,
        symptoms,
        notes,
        followUpDate:  followUpDate || undefined,
        signedBy:      doctorName,
      }) as any;
      setSignedBlock(res);
      await logAuditEvent(doctorName, `Prescription ${res.rxId}`, "signed", "success", "info").catch(() => {});
      toast.success(`Prescription ${res.rxId} signed`, { description: `Ed25519 · Anchored · ${new Date().toLocaleTimeString("en-IN")}` });
      setSigned(true);
      loadData(); // refresh my prescriptions list
    } catch (err: any) {
      toast.error("Signing failed", { description: err.message });
    } finally { setSigning(false); }
  };

  // ── recent Rx for selected patient ────────────────────────────────────────
  const patientPrescriptions = useMemo(() =>
    myPrescriptions.filter((rx) => !selectedPatient || rx.patientDid === selectedPatient.patientDid)
      .sort((a, b) => (b.signedAt || "").localeCompare(a.signedAt || ""))
      .slice(0, 15),
    [myPrescriptions, selectedPatient]);

  return (
    <RouteGuard requiredRole="staff">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between border-b border-border pb-4">
          <PageHeader eyebrow="Digital Signature" title="Sign & Prescribe"
            description="Issue prescriptions only for patients who booked appointments with you. Each prescription is cryptographically signed with your DID." />
          <button onClick={loadData} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted shrink-0">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* ── Patient list panel ──────────────────────────────────────── */}
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

            {/* Patient cards */}
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
              {loadingPts ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filteredPts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
                  No patients found. Patients appear here after they book an appointment with you.
                </div>
              ) : filteredPts.map((pt) => {
                const isSelected = selectedPatient?.patientDid === pt.patientDid;
                const appt       = pt.latestAppt;
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
                    <div className="text-[10px] text-muted-foreground">{pt.appointments?.length ?? 1} appointment{(pt.appointments?.length ?? 1) !== 1 ? "s" : ""}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right panel: form or empty state ────────────────────────── */}
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
              {/* Patient + appointment info banner */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-bold text-foreground">{selectedPatient.patientName}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{selectedPatient.patientDid}</div>
                  </div>
                  <button onClick={() => { setSelectedPatient(null); resetForm(); }} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Appointment picker */}
                {(selectedPatient.appointments?.length ?? 0) > 1 && (
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Appointment</label>
                    <select value={selectedApptId} onChange={(e) => setSelectedApptId(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring">
                      {selectedPatient.appointments.map((a: any) => (
                        <option key={a.apptId} value={a.apptId}>
                          {a.date ?? a.slot} · {a.status} {a.reason ? `· ${a.reason}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedAppt && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ["Appointment ID", selectedAppt.apptId ?? "—"],
                      ["Date / Slot",    selectedAppt.date ?? selectedAppt.slot ?? "—"],
                      ["Status",         selectedAppt.status ?? "—"],
                      ["Reason",         selectedAppt.reason || "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-card border border-border px-3 py-1.5">
                        <div className="text-[9px] font-semibold uppercase text-muted-foreground">{k}</div>
                        <div className="font-medium text-foreground truncate">{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prescription form */}
              <AnimatePresence mode="wait">
                {!signed ? (
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

                    {/* Chief Complaint + Symptoms */}
                    <div className="rounded-xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">
                          <Stethoscope className="inline h-3.5 w-3.5 text-primary mr-1" />Chief Complaint
                        </label>
                        <textarea value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)}
                          rows={2} placeholder="Patient's primary complaint…"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">Symptoms</label>
                        <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)}
                          rows={2} placeholder="Observed symptoms (comma-separated)…"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                      </div>
                    </div>

                    {/* Diagnosis */}
                    <div className="rounded-xl border border-border bg-card p-4">
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Diagnosis / Clinical Indication <span className="text-destructive">*</span>
                      </label>
                      <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
                        rows={2} placeholder="Clinical diagnosis…"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                    </div>

                    {/* Medicines */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Pill className="h-4 w-4 text-primary" /> Medicines ({drugs.length})
                        </div>
                        <button onClick={addDrug} className="flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
                          <Plus className="h-3.5 w-3.5" /> Add Medicine
                        </button>
                      </div>
                      {drugs.map((d) => (
                        <DrugRow key={d.id} drug={d} onRemove={() => removeDrug(d.id)} onUpdate={(u) => updateDrug(d.id, u)} />
                      ))}
                    </div>

                    {/* Notes + follow-up */}
                    <div className="rounded-xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">Additional Notes</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                          rows={2} placeholder="Dietary advice, referrals, precautions…"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">Follow-up Date <span className="text-muted-foreground font-normal">(optional)</span></label>
                        <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                    </div>

                    {/* Signer identity + preview + sign button */}
                    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                      {/* Preview */}
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

                      {/* Signer card + button */}
                      <div className="space-y-3">
                        <div className="rounded-xl border border-border bg-card p-4">
                          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
                            <Shield className="h-4 w-4 text-primary" /> Signer Identity
                          </div>
                          <div className="space-y-2 text-xs">
                            {[
                              ["Physician", doctorName],
                              ["DID", doctorDid || "—"],
                              ["Method", "DID + Ed25519"],
                            ].map(([k, v]) => (
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
                    <div className="text-base font-bold text-foreground">Prescription Signed & Issued</div>
                    <div className="font-mono text-xs text-muted-foreground">{signedBlock?.rxId}</div>
                    <div className="text-xs text-muted-foreground">
                      Ed25519 · {new Date().toLocaleString("en-IN")}
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-[11px] font-semibold text-success">
                      <Wifi className="h-3 w-3" /> Anchored to Ledger
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground/70 truncate">{signedBlock?.txId}</div>
                    <div className="flex gap-2 justify-center pt-2">
                      <button onClick={resetForm}
                        className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted">
                        <Plus className="h-3.5 w-3.5" /> New Prescription
                      </button>
                    </div>
                    <p className="text-[11px] text-success font-medium">Prescription is now visible in the patient's portal.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── My Prescriptions history ─────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {selectedPatient ? `Prescriptions for ${selectedPatient.patientName}` : "All My Prescriptions"}
              <span className="text-xs font-normal text-muted-foreground">({patientPrescriptions.length})</span>
            </div>
          </div>
          <div className="space-y-2">
            {patientPrescriptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">No prescriptions issued yet.</div>
            ) : patientPrescriptions.map((rx) => {
              const st = STATUS_CLS[rx.status] ?? STATUS_CLS.active;
              return (
                <div key={rx.rxId} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{rx.patientName ?? rx.patientDid}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st}`}>{rx.status}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground truncate">
                      {rx.diagnosis}{rx.chiefComplaint ? ` · ${rx.chiefComplaint}` : ""}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground truncate">
                      {(rx.drugs ?? []).map((d: any) => d.name).join(", ")}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{rx.rxId}</span>
                      <span>·</span>
                      <span>{rx.signedAt ? new Date(rx.signedAt).toLocaleString("en-IN") : "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button className="rounded border border-border bg-background p-1.5 hover:bg-muted" title="View">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
