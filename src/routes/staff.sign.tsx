import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { stagger, fadeUp } from "@/components/Motion";
import {
  FileSignature,
  Fingerprint,
  CheckCircle2,
  Search,
  Pill,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Eye,
  Download,
  Shield,
  AlertTriangle,
  Stethoscope,
  RefreshCw,
  Wifi,
  WifiOff,
  KeyRound,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  fabricSignPrescription,
  fabricLogAuditEvent,
  isFabricOnline,
  fabricRequestConsent,
} from "@/lib/fabric-api";

export const Route = createFileRoute("/staff/sign")({
  head: () => ({ meta: [{ title: "Staff · Sign & Prescribe — DID Hospital" }] }),
  component: SignPage,
});

interface Drug {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface RecentPrescription {
  id: string;
  patient: string;
  mrn: string;
  drugs: string[];
  signedAt: string;
  hash: string;
  status: "active" | "dispensed" | "expired";
}

const drugSuggestions = [
  "Atorvastatin 20mg",
  "Metformin 500mg",
  "Amlodipine 5mg",
  "Losartan 50mg",
  "Aspirin 75mg",
  "Pantoprazole 40mg",
  "Atenolol 50mg",
  "Ramipril 5mg",
  "Metoprolol 25mg",
  "Rosuvastatin 10mg",
  "Furosemide 40mg",
  "Spironolactone 25mg",
];

const freqOptions = [
  "Once daily",
  "Twice daily",
  "Thrice daily",
  "Every 8 hours",
  "Every 6 hours",
  "As needed (PRN)",
  "At bedtime",
  "Before meals",
  "After meals",
];
const durationOptions = [
  "5 days",
  "7 days",
  "10 days",
  "14 days",
  "1 month",
  "3 months",
  "6 months",
  "Ongoing",
  "Until review",
];

const recentPrescriptions: RecentPrescription[] = [
  {
    id: "PR-9821",
    patient: "Anika Sharma",
    mrn: "MRN-204871",
    drugs: ["Atorvastatin 20mg", "Aspirin 75mg"],
    signedAt: "2026-06-08 10:12",
    hash: "0x9f3a…c821",
    status: "active",
  },
  {
    id: "PR-9820",
    patient: "Rohan Iyer",
    mrn: "MRN-201440",
    drugs: ["Metformin 500mg", "Pantoprazole 40mg", "Atenolol 50mg"],
    signedAt: "2026-06-08 09:30",
    hash: "0x7b2e…a419",
    status: "dispensed",
  },
  {
    id: "PR-9818",
    patient: "Meera Pillai",
    mrn: "MRN-200788",
    drugs: ["Losartan 50mg"],
    signedAt: "2026-06-07 16:45",
    hash: "0x4a1c…f830",
    status: "active",
  },
  {
    id: "PR-9815",
    patient: "Karthik Rao",
    mrn: "MRN-199320",
    drugs: ["Furosemide 40mg", "Spironolactone 25mg", "Ramipril 5mg"],
    signedAt: "2026-06-07 11:00",
    hash: "0x2d0f…b994",
    status: "dispensed",
  },
];

const statusConfig = {
  active: { bg: "bg-primary/10", text: "text-primary" },
  dispensed: { bg: "bg-success/15", text: "text-success" },
  expired: { bg: "bg-muted", text: "text-muted-foreground" },
};

function DrugRow({
  drug,
  onRemove,
  onUpdate,
}: {
  drug: Drug;
  onRemove: () => void;
  onUpdate: (d: Partial<Drug>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(drug.name);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Pill className="h-4 w-4 text-primary shrink-0" />
          <div className="relative flex-1">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                onUpdate({ name: e.target.value });
                setSuggestions(
                  drugSuggestions
                    .filter(
                      (d) =>
                        d.toLowerCase().includes(e.target.value.toLowerCase()) &&
                        e.target.value.length > 1,
                    )
                    .slice(0, 5),
                );
              }}
              onFocus={() => setSuggestions(drugSuggestions.slice(0, 5))}
              onBlur={() => setTimeout(() => setSuggestions([]), 200)}
              placeholder="Search medication…"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onMouseDown={() => {
                      setSearch(s);
                      onUpdate({ name: s });
                      setSuggestions([]);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setOpen(!open)}
            className="rounded border border-border bg-background p-1.5 hover:bg-muted"
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={onRemove}
            className="rounded border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            {
              label: "Dose",
              key: "dose" as keyof Drug,
              placeholder: "e.g. 1 tablet, 500mg",
              value: drug.dose,
            },
            {
              label: "Frequency",
              key: "frequency" as keyof Drug,
              isSelect: true,
              options: freqOptions,
              value: drug.frequency,
            },
            {
              label: "Duration",
              key: "duration" as keyof Drug,
              isSelect: true,
              options: durationOptions,
              value: drug.duration,
            },
          ].map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {f.label}
              </label>
              {f.isSelect ? (
                <select
                  value={f.value}
                  onChange={(e) => onUpdate({ [f.key]: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select…</option>
                  {f.options!.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={f.value}
                  onChange={(e) => onUpdate({ [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>
          ))}
          <div className="sm:col-span-3">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Special Instructions
            </label>
            <input
              value={drug.instructions}
              onChange={(e) => onUpdate({ instructions: e.target.value })}
              placeholder="e.g. Take with food, avoid grapefruit…"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SignPage() {
  const [drugs, setDrugs] = useState<Drug[]>([
    {
      id: "d1",
      name: "Atorvastatin 20mg",
      dose: "1 tablet",
      frequency: "Once daily",
      duration: "3 months",
      instructions: "Take at bedtime",
    },
  ]);
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signedBlock, setSignedBlock] = useState<{
    rxId: string;
    blockNumber: number;
    txId: string;
    hash: string;
  } | null>(null);
  const [fabricOnline, setFabricOnline] = useState<boolean | null>(null);
  const [patient] = useState({
    name: "Anika Sharma",
    mrn: "MRN-204871",
    dob: "1982-03-14",
    ward: "Cardiology Ward 4A",
    did: "did:hosp:0x1a2b…9c00",
  });
  const [diagnosis, setDiagnosis] = useState(
    "Dyslipidaemia with cardiovascular risk — statin therapy initiated",
  );
  const [notes, setNotes] = useState("");
  const [showRecent, setShowRecent] = useState(true);

  // ─── Consent request state ──────────────────────────────────────────────────
  const [consentResource, setConsentResource] = useState("Medical Records");
  const [consentReason, setConsentReason] = useState("");
  const [sendingConsent, setSendingConsent] = useState(false);

  const doctorDid =
    typeof window !== "undefined"
      ? (localStorage.getItem("userDID") ?? "did:hosp:staff:current")
      : "did:hosp:staff:current";
  const doctorName =
    typeof window !== "undefined"
      ? (localStorage.getItem("userName") ?? "Dr. Ravi Menon")
      : "Dr. Ravi Menon";

  const handleRequestConsent = async () => {
    if (!consentReason.trim()) {
      toast.error("Please provide a reason for access");
      return;
    }
    setSendingConsent(true);
    try {
      await fabricRequestConsent({
        doctorDid,
        doctorName,
        patientDid: patient.did,
        resource: consentResource,
        reason: consentReason,
      });
      toast.success("Consent request sent to patient");
      setConsentReason("");
    } catch (err: any) {
      toast.error("Failed to send consent request", { description: err.message });
    } finally {
      setSendingConsent(false);
    }
  };

  const addDrug = () => {
    const id = `d${Date.now()}`;
    setDrugs((prev) => [
      ...prev,
      { id, name: "", dose: "", frequency: "Once daily", duration: "7 days", instructions: "" },
    ]);
  };

  const removeDrug = (id: string) => setDrugs((prev) => prev.filter((d) => d.id !== id));
  const updateDrug = (id: string, updates: Partial<Drug>) =>
    setDrugs((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));

  const handleSign = async () => {
    if (drugs.length === 0 || !drugs[0].name) {
      toast.error("Add at least one medication before signing");
      return;
    }
    setSigning(true);

    try {
      const online = await isFabricOnline();
      setFabricOnline(online);

      if (online) {
        // Real Fabric commit
        const result = await fabricSignPrescription({
          patientDid: patient.did,
          doctorDid: "did:hosp:0xd103…99aa",
          drugs: drugs.map((d) => ({
            name: d.name,
            dose: d.dose,
            frequency: d.frequency,
            duration: d.duration,
            instructions: d.instructions,
          })),
          diagnosis,
          notes,
          signedBy: "Dr. Ravi Menon",
        });
        const res = result as { rxId: string; blockNumber: number; txId: string };
        setSignedBlock({
          rxId: res.rxId,
          blockNumber: res.blockNumber,
          txId: res.txId,
          hash: `sha256:${res.txId.slice(0, 16)}…`,
        });
        await fabricLogAuditEvent(
          "Dr. Ravi Menon",
          `Prescription ${res.rxId}`,
          "signed",
          "success",
          "info",
        ).catch(() => {});
        toast.success(`Prescription ${res.rxId} signed & committed`, {
          description: `Block #${res.blockNumber} · Ed25519 · Fabric Ledger`,
        });
      } else {
        // Fallback: simulate local signing
        await new Promise((r) => setTimeout(r, 1800));
        const rxId = `PR-${Date.now().toString(36).toUpperCase()}`;
        setSignedBlock({
          rxId,
          blockNumber: 1285044 + Math.floor(Math.random() * 100),
          txId: `tx_${Date.now().toString(16)}`,
          hash: `sha256:${Math.random().toString(36).slice(2)}`,
        });
        toast.success(`${rxId} signed (local simulation)`, {
          description: `Ed25519 signature · localStorage ledger`,
        });
      }
      setSigned(true);
    } catch (err) {
      toast.error("Signing failed", { description: String(err) });
    } finally {
      setSigning(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Digital Signature"
        title="Create & Sign Prescription"
        description="Prescriptions are cryptographically signed with your DID and anchored to the immutable audit ledger."
      />

      <div className="p-6 sm:p-8 space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Left: Prescription builder */}
          <div className="space-y-5">
            {/* Patient info */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <User className="h-4 w-4 text-primary" /> Patient
              </div>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                {[
                  { k: "Name", v: patient.name },
                  { k: "MRN", v: patient.mrn },
                  { k: "DOB", v: patient.dob },
                  { k: "Ward", v: patient.ward },
                ].map((r) => (
                  <div key={r.k} className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {r.k}
                    </div>
                    <div className="mt-0.5 font-medium text-foreground">{r.v}</div>
                  </div>
                ))}
                <div className="sm:col-span-2 rounded-lg bg-muted/50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Patient DID
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-primary">{patient.did}</div>
                </div>
              </div>
            </motion.div>

            {/* Diagnosis */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                <Stethoscope className="inline h-4 w-4 text-primary mr-1.5" />
                Diagnosis / Indication
              </label>
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </motion.div>

            {/* Medications */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Pill className="h-4 w-4 text-primary" />
                  Medications ({drugs.length})
                </div>
                <button
                  onClick={addDrug}
                  className="flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Drug
                </button>
              </div>
              <div className="space-y-3">
                {drugs.map((d) => (
                  <DrugRow
                    key={d.id}
                    drug={d}
                    onRemove={() => removeDrug(d.id)}
                    onUpdate={(u) => updateDrug(d.id, u)}
                  />
                ))}
                {drugs.length === 0 && (
                  <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
                    <Pill className="h-8 w-8 mb-2 opacity-30" />
                    <div className="text-sm">No medications added</div>
                    <div className="text-xs">Click "Add Drug" to start</div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Notes */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                Additional Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Follow-up instructions, referrals, dietary advice…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </motion.div>

            {/* Request Data Access */}
            {patient.did && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-xl border border-primary/20 bg-primary/5 p-5"
              >
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Request Data Access
                </div>
                <div className="mb-4 text-xs text-muted-foreground">
                  Ask the patient to grant access before accessing their records. The request is
                  sent to the patient's consent portal on-chain.
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Resource
                    </label>
                    <select
                      value={consentResource}
                      onChange={(e) => setConsentResource(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      {[
                        "Medical Records",
                        "Prescription History",
                        "Lab Results",
                        "Imaging Reports",
                        "Emergency Records",
                      ].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Reason
                    </label>
                    <textarea
                      value={consentReason}
                      onChange={(e) => setConsentReason(e.target.value)}
                      rows={2}
                      placeholder="Explain why you need access to this data…"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>

                  <button
                    onClick={handleRequestConsent}
                    disabled={sendingConsent || !consentReason.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {sendingConsent ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Sending request…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Request Access
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right: Signature panel */}
          <div className="space-y-5">
            {/* Signer identity */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Shield className="h-4 w-4 text-primary" /> Signer Identity
              </div>
              <div className="space-y-2.5 text-xs">
                {[
                  { k: "Physician", v: "Dr. Ravi Menon" },
                  { k: "Registration", v: "MCI-2024-09882" },
                  { k: "Specialisation", v: "Interventional Cardiology" },
                  {
                    k: "DID",
                    v: <span className="font-mono text-primary">did:hosp:0xd103…99aa</span>,
                  },
                  { k: "Method", v: "DID + Biometric" },
                  { k: "Algorithm", v: "Ed25519" },
                ].map((r) => (
                  <div
                    key={r.k}
                    className="flex justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="text-muted-foreground">{r.k}</span>
                    <span className="font-medium text-foreground text-right">{r.v}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Prescription preview */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-border bg-gradient-to-br from-card to-muted/20 p-5"
            >
              <div className="mb-3 text-sm font-semibold text-foreground">Prescription Preview</div>
              <div className="space-y-2">
                {drugs
                  .filter((d) => d.name)
                  .map((d, i) => (
                    <div key={d.id} className="text-xs text-foreground">
                      <span className="font-semibold text-primary">Rx{i + 1}.</span> {d.name}
                      {d.dose && <> · {d.dose}</>}
                      {d.frequency && <> · {d.frequency}</>}
                      {d.duration && <> · {d.duration}</>}
                      {d.instructions && (
                        <div className="text-muted-foreground ml-4">↳ {d.instructions}</div>
                      )}
                    </div>
                  ))}
                {drugs.length === 0 && (
                  <div className="text-xs text-muted-foreground italic">
                    No medications added yet…
                  </div>
                )}
              </div>
              {diagnosis && (
                <div className="mt-3 border-t border-border/50 pt-3 text-xs">
                  <span className="text-muted-foreground">Dx: </span>
                  <span className="text-foreground">{diagnosis}</span>
                </div>
              )}
            </motion.div>

            {/* Sign button / result */}
            <AnimatePresence mode="wait">
              {!signed ? (
                <motion.button
                  key="sign-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleSign}
                  disabled={signing}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-70 transition-all"
                >
                  {signing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Applying biometric…
                    </>
                  ) : (
                    <>
                      <Fingerprint className="h-4 w-4" />
                      Sign with DID + Biometric
                    </>
                  )}
                </motion.button>
              ) : (
                <motion.div
                  key="signed"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl border border-success/30 bg-success/8 p-5 text-center"
                >
                  <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                  <div className="mt-2 text-sm font-semibold text-foreground">
                    Signed & Anchored
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {signedBlock?.rxId} · Block #{signedBlock?.blockNumber?.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Ed25519 · {new Date().toLocaleString("en-IN")}
                  </div>
                  <div className="mt-1.5 flex items-center justify-center gap-1.5">
                    {fabricOnline ? (
                      <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                        <Wifi className="h-2.5 w-2.5" />
                        Fabric Ledger
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        <WifiOff className="h-2.5 w-2.5" />
                        Local Ledger
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground/60 truncate">
                    {signedBlock?.txId}
                  </div>
                  <div className="mt-4 flex gap-2 justify-center">
                    <button className="flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
                      <Eye className="h-3 w-3" /> View
                    </button>
                    <button className="flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
                      <Download className="h-3 w-3" /> Download PDF
                    </button>
                    <button
                      onClick={() => setSigned(false)}
                      className="flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
                    >
                      <Plus className="h-3 w-3" /> New Rx
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Warning */}
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning-foreground mt-0.5" />
              Verify patient identity before signing. Prescriptions are legally binding and
              immutably recorded.
            </div>
          </div>
        </div>

        {/* Recent prescriptions */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Recent Prescriptions
            </div>
            <button
              onClick={() => setShowRecent(!showRecent)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showRecent ? "Hide" : "Show"}
            </button>
          </div>
          <AnimatePresence>
            {showRecent && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3">
                  {recentPrescriptions.map((rx) => {
                    const st = statusConfig[rx.status];
                    return (
                      <div
                        key={rx.id}
                        className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground">
                              {rx.patient}
                            </span>
                            <span className="text-xs text-muted-foreground">{rx.mrn}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.bg} ${st.text}`}
                            >
                              {rx.status}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground truncate">
                            {rx.drugs.join(", ")}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{rx.id}</span>
                            <span>·</span>
                            <span>{rx.signedAt}</span>
                            <span>·</span>
                            <span className="font-mono">{rx.hash}</span>
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button className="rounded border border-border bg-background p-1.5 hover:bg-muted">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button className="rounded border border-border bg-background p-1.5 hover:bg-muted">
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
