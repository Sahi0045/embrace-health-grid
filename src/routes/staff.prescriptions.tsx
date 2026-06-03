import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Pill, Search, Plus, FileSignature, User, Calendar, Clock, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export const Route = createFileRoute("/staff/prescriptions")({
  head: () => ({ meta: [{ title: "Prescriptions — Staff Portal" }] }),
  component: PrescriptionsPage,
});

type Frequency = "Once daily" | "Twice daily" | "Three times daily" | "Four times daily" | "As needed" | "Every 8 hours" | "Every 12 hours";
type Duration = "3 days" | "5 days" | "7 days" | "10 days" | "14 days" | "30 days" | "Ongoing";

const medicationDb = [
  { name: "Metoprolol", strengths: ["25mg", "50mg", "100mg"], route: "Oral" },
  { name: "Amlodipine", strengths: ["2.5mg", "5mg", "10mg"], route: "Oral" },
  { name: "Atorvastatin", strengths: ["10mg", "20mg", "40mg", "80mg"], route: "Oral" },
  { name: "Pantoprazole", strengths: ["20mg", "40mg"], route: "Oral" },
  { name: "Metformin", strengths: ["500mg", "850mg", "1000mg"], route: "Oral" },
  { name: "Furosemide", strengths: ["20mg", "40mg", "80mg"], route: "Oral" },
  { name: "Aspirin", strengths: ["75mg", "150mg", "325mg"], route: "Oral" },
  { name: "Clopidogrel", strengths: ["75mg"], route: "Oral" },
  { name: "Amoxicillin", strengths: ["250mg", "500mg", "875mg"], route: "Oral" },
  { name: "Azithromycin", strengths: ["250mg", "500mg"], route: "Oral" },
];

const recentPrescriptions = [
  { id: "rx1", patient: "Anika Sharma", mrn: "MRN-204871", meds: ["Metoprolol 50mg OD", "Aspirin 75mg OD"], signed: true, date: "2026-06-01", rxNo: "RX-2026-06-001" },
  { id: "rx2", patient: "Rohan Iyer", mrn: "MRN-204902", meds: ["Atorvastatin 40mg HS", "Amlodipine 5mg OD"], signed: true, date: "2026-06-01", rxNo: "RX-2026-06-002" },
  { id: "rx3", patient: "Meera Pillai", mrn: "MRN-205110", meds: ["Azithromycin 500mg OD × 3d"], signed: false, date: "2026-06-02", rxNo: "RX-2026-06-003" },
];

interface RxLine {
  medication: string;
  strength: string;
  frequency: Frequency;
  duration: Duration;
  instructions: string;
}

function PrescriptionsPage() {
  const [view, setView] = useState<"list" | "builder">("list");
  const [medSearch, setMedSearch] = useState("");
  const [lines, setLines] = useState<RxLine[]>([]);
  const [patient, setPatient] = useState("");
  const [selectedMed, setSelectedMed] = useState<typeof medicationDb[0] | null>(null);
  const [strength, setStrength] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("Once daily");
  const [duration, setDuration] = useState<Duration>("7 days");
  const [instructions, setInstructions] = useState("");

  const filteredMeds = medicationDb.filter(m => m.name.toLowerCase().includes(medSearch.toLowerCase()));

  const addLine = () => {
    if (!selectedMed || !strength) return;
    setLines([...lines, { medication: selectedMed.name, strength, frequency, duration, instructions }]);
    setSelectedMed(null);
    setStrength("");
    setMedSearch("");
    setInstructions("");
  };

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Staff Portal"
        title="Prescriptions"
        description="Build, sign, and issue digital prescriptions"
        actions={
          <button
            onClick={() => setView(view === "list" ? "builder" : "list")}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {view === "list" ? "New Prescription" : "View All"}
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {view === "list" ? (
          <StaggerList className="space-y-4">
            {recentPrescriptions.map((rx) => (
              <StaggerItem key={rx.id}>
                <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-2/10">
                        <Pill className="h-5 w-5 text-chart-2" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{rx.patient}</div>
                        <div className="text-xs text-muted-foreground">{rx.mrn} · {rx.date}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${rx.signed ? "bg-success/10 text-success" : "bg-warning/10 text-warning-foreground"}`}>
                        {rx.signed ? "Signed" : "Unsigned"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    {rx.meds.map((m) => (
                      <div key={m} className="flex items-center gap-2 text-xs">
                        <Pill className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-foreground">{m}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 font-mono text-[10px] text-muted-foreground/50">{rx.rxNo}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-2">
            {/* Builder */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="text-sm font-semibold text-foreground">Prescription Builder</div>

              {/* Patient */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Patient Name / MRN</label>
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Search patient..."
                  value={patient}
                  onChange={(e) => setPatient(e.target.value)}
                />
              </div>

              {/* Medication search */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Medication</label>
                <div className="mt-1 relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    className="w-full rounded-lg border border-border bg-muted pl-8 pr-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Search medication..."
                    value={medSearch}
                    onChange={(e) => setMedSearch(e.target.value)}
                  />
                </div>
                {medSearch && !selectedMed && (
                  <div className="mt-1 rounded-lg border border-border bg-card shadow-clinical-md">
                    {filteredMeds.slice(0, 5).map((m) => (
                      <button
                        key={m.name}
                        onClick={() => { setSelectedMed(m); setMedSearch(m.name); setStrength(m.strengths[0]); }}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        <span className="font-medium text-foreground">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.route}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Strength */}
              {selectedMed && (
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Strength</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {selectedMed.strengths.map((s) => (
                      <button
                        key={s}
                        onClick={() => setStrength(s)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${strength === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Frequency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Frequency</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as Frequency)}
                  >
                    {["Once daily","Twice daily","Three times daily","Four times daily","As needed","Every 8 hours","Every 12 hours"].map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Duration</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value as Duration)}
                  >
                    {["3 days","5 days","7 days","10 days","14 days","30 days","Ongoing"].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Special Instructions</label>
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none"
                  placeholder="Take after meals, avoid alcohol..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>

              <button
                onClick={addLine}
                disabled={!selectedMed || !strength}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Plus className="inline h-4 w-4 mr-1.5" />
                Add Medication
              </button>
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
              <div className="text-sm font-semibold text-foreground mb-4">Prescription Preview</div>

              <div className="rounded-xl border border-border p-4 space-y-4">
                <div className="flex justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">DID Hospital</div>
                    <div className="text-xs text-muted-foreground">Apollo Campus, Mumbai</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">Date: {new Date().toLocaleDateString("en-IN")}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">RX-PREVIEW</div>
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Patient</div>
                  <div className="text-sm font-semibold text-foreground">{patient || "—"}</div>
                </div>

                <div className="border-t border-border pt-3 space-y-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Medications</div>
                  {lines.length === 0 && <div className="text-xs text-muted-foreground italic">No medications added yet</div>}
                  {lines.map((l, i) => (
                    <div key={i} className="flex items-start justify-between rounded-lg bg-muted px-3 py-2 text-xs">
                      <div>
                        <div className="font-semibold text-foreground">{l.medication} {l.strength}</div>
                        <div className="text-muted-foreground">{l.frequency} × {l.duration}</div>
                        {l.instructions && <div className="text-muted-foreground italic">{l.instructions}</div>}
                      </div>
                      <button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive text-lg leading-none ml-2">×</button>
                    </div>
                  ))}
                </div>

                {lines.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <div className="text-[10px] text-muted-foreground">Dr. Ravi Menon, MD — Cardiologist</div>
                    <div className="font-mono text-[10px] text-muted-foreground">did:hosp:0xd103…99aa</div>
                  </div>
                )}
              </div>

              {lines.length > 0 && (
                <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                  <FileSignature className="h-4 w-4" />
                  Sign & Issue Prescription
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </RouteGuard>
  );
}
