import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { useLivePatients } from "@/hooks/use-api";
import { Search, X, Activity, Pill, FlaskConical, AlertTriangle, Loader2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { vitalSigns, medications, labTests } from "@/lib/inpatient-data";
import type { Patient } from "@/lib/mock-data";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api";

export const Route = createFileRoute("/staff/patients")({
  head: () => ({ meta: [{ title: "Staff · Patients — DID Hospital" }] }),
  component: Patients,
});

function Patients() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);

  // New record form states
  const [recordTitle, setRecordTitle] = useState("");
  const [recordType, setRecordType] = useState("lab-report");
  const [recordSummary, setRecordSummary] = useState("");
  const [addingRecord, setAddingRecord] = useState(false);

  const handleAddRecord = async (patientDid: string) => {
    if (!recordTitle || !recordSummary) {
      toast.error("Please enter both a title and summary details.");
      return;
    }
    setAddingRecord(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/medical-records/${encodeURIComponent(patientDid)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          title: recordTitle,
          type: recordType,
          content: recordSummary,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to add record");
      }

      toast.success("Medical record added successfully!");
      setRecordTitle("");
      setRecordSummary("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add medical record");
    } finally {
      setAddingRecord(false);
    }
  };
  const { patients: patientsList } = useLivePatients();
  const patients = patientsList ?? [];

  const filtered = patients.filter((p: any) =>
    [p.name, p.mrn, p.did, p.phone || ""].some((f) => f.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Patients"
        title="My active patients"
        description="Search by name, MRN, DID, or phone."
      />
      <div className="p-8">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-clinical">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patients…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-clinical">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">MRN</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">DID</th>
                <th className="px-4 py-3 font-medium">Blood</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Allergies</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p: any) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.age} · {p.gender}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.mrn}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                    {p.did}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                      {p.bloodGroup}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                    {p.allergies.length ? (
                      <span className="text-destructive">{p.allergies.join(", ")}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(p)}
                      className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      Open chart
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No patients match "{q}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Patient Chart Modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-clinical-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <div>
                <div className="font-semibold text-foreground">
                  {selected.name} — Clinical Chart
                </div>
                <div className="text-xs text-muted-foreground">
                  MRN {selected.mrn} · {selected.age}y · {selected.gender} · {selected.bloodGroup}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Allergy alert */}
              {selected.allergies.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-destructive">Allergy Alert</div>
                    <div className="text-sm">{selected.allergies.join(", ")}</div>
                  </div>
                </div>
              )}

              {/* Latest vitals — uses Anika's data for demo */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Latest Vitals</CardTitle>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {vitalSigns[0].timestamp}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {[
                      { label: "Temp", value: `${vitalSigns[0].temperature}°C` },
                      {
                        label: "BP",
                        value: `${vitalSigns[0].bloodPressure.systolic}/${vitalSigns[0].bloodPressure.diastolic}`,
                      },
                      { label: "HR", value: `${vitalSigns[0].heartRate} bpm` },
                      { label: "RR", value: `${vitalSigns[0].respiratoryRate}/min` },
                      { label: "SpO₂", value: `${vitalSigns[0].oxygenSaturation}%` },
                    ].map((v) => (
                      <div key={v.label} className="rounded-lg bg-muted p-2 text-center">
                        <div className="text-xs text-muted-foreground">{v.label}</div>
                        <div className="font-semibold text-sm mt-0.5">{v.value}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Active medications */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Active Medications</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {medications
                    .filter((m) => m.status === "active")
                    .map((med) => (
                      <div
                        key={med.id}
                        className="flex items-center justify-between rounded-lg border p-2 text-sm"
                      >
                        <div>
                          <span className="font-medium">{med.name}</span>
                          <span className="text-muted-foreground ml-2">
                            {med.dosage} · {med.frequency}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Active
                        </Badge>
                      </div>
                    ))}
                </CardContent>
              </Card>

              {/* Lab tests */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Recent Lab Tests</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {labTests.slice(0, 3).map((test) => (
                    <div
                      key={test.id}
                      className="flex items-center justify-between rounded-lg border p-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{test.testName}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {test.orderedDate}
                        </span>
                      </div>
                      <Badge
                        variant={test.status === "completed" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {test.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {/* Add New Medical Record Form */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">Add New Medical Record / Report</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                        Report Title
                      </label>
                      <input
                        type="text"
                        value={recordTitle}
                        onChange={(e) => setRecordTitle(e.target.value)}
                        placeholder="e.g. Brain MRI Scan, Lipid Profile"
                        className="w-full rounded-md border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                        Record Category
                      </label>
                      <select
                        value={recordType}
                        onChange={(e) => setRecordType(e.target.value)}
                        className="w-full rounded-md border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                      >
                        <option value="lab-report">Lab Report</option>
                        <option value="imaging">Imaging (ECG, X-Ray, MRI)</option>
                        <option value="discharge-summary">Discharge Summary</option>
                        <option value="referral">Referral Letter</option>
                        <option value="procedure-report">Procedure Report</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                      Clinical Summary / Diagnostic Findings
                    </label>
                    <textarea
                      value={recordSummary}
                      onChange={(e) => setRecordSummary(e.target.value)}
                      placeholder="Enter detailed diagnostic notes, impressions, and recommendations..."
                      rows={3}
                      className="w-full rounded-md border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary resize-none"
                    />
                  </div>
                  <button
                    onClick={() => handleAddRecord(selected.did)}
                    disabled={addingRecord}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {addingRecord ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" /> Save & Add Record
                      </>
                    )}
                  </button>
                </CardContent>
              </Card>

              <div className="flex justify-end pt-2 border-t border-border">
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  );
}
