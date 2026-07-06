import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { useLivePatients, useNFCCards, useInpatientData } from "@/hooks/use-api";
import { Search, X, Activity, Pill, FlaskConical, AlertTriangle, Loader2, Plus, Fingerprint, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { issueNFCCard, revokeNFCCard, API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/patients")({
  head: () => ({ meta: [{ title: "Staff · Patients — DID Hospital" }] }),
  component: Patients,
});

function Patients() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [cardToRevoke, setCardToRevoke] = useState<string | null>(null);

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

  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const { data: nfcCardsData, refetch: refetchNFCCards } = useNFCCards();
  const nfcCards = nfcCardsData || [];

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

              {/* Latest vitals — from inpatient API */}
              <PatientChartCards patientDid={selected.did} />

              {/* NFC Security Management — Admin Only */}
              {isAdmin && selected && (
                (() => {
                  const patientCardEntry = nfcCards.find((c: any) => c.value?.patientDid === selected.did);
                  const patientCard = patientCardEntry?.value;
                  return (
                    <Card className="border-primary/20 shadow-clinical">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Fingerprint className="h-4 w-4 text-primary animate-pulse" />
                          <CardTitle className="text-sm">NFC Security & Identity Card</CardTitle>
                          {patientCard ? (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ml-auto ${patientCard.status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                              {patientCard.status.toUpperCase()}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground ml-auto">
                              UNREGISTERED
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {patientCard ? (
                          <div className="space-y-2 text-xs">
                            <div className="grid grid-cols-3 py-1 border-b border-border/40">
                              <span className="text-muted-foreground">Card ID</span>
                              <span className="col-span-2 font-mono font-medium text-foreground">{patientCard.cardId}</span>
                            </div>
                            <div className="grid grid-cols-3 py-1 border-b border-border/40">
                              <span className="text-muted-foreground">Issued At</span>
                              <span className="col-span-2 text-foreground">{new Date(patientCard.issuedAt).toLocaleString()}</span>
                            </div>
                            <div className="grid grid-cols-3 py-1 border-b border-border/40">
                              <span className="text-muted-foreground">Issued By</span>
                              <span className="col-span-2 text-foreground">{patientCard.issuedBy}</span>
                            </div>
                            {patientCard.status === "revoked" && patientCard.revokedAt && (
                              <div className="grid grid-cols-3 py-1 bg-destructive/5 px-1 rounded-sm border-b border-border/40">
                                <span className="text-destructive font-medium">Revoked At</span>
                                <span className="col-span-2 text-destructive font-medium">{new Date(patientCard.revokedAt).toLocaleString()}</span>
                              </div>
                            )}
                            {patientCard.status === "active" ? (
                              <button
                                onClick={() => setCardToRevoke(patientCard.cardId)}
                                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-white hover:bg-destructive/90 transition-colors shadow-clinical"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Revoke Identity Card
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await issueNFCCard({
                                      patientDid: selected.did,
                                      patientName: selected.name,
                                      mrn: selected.mrn,
                                    });
                                    toast.success("NFC Card Issued", { description: `New Card ${res.card.cardId} registered.` });
                                    void refetchNFCCards();
                                  } catch (err: any) {
                                    toast.error("Failed to issue card", { description: err.message });
                                  }
                                }}
                                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-clinical"
                              >
                                <Fingerprint className="h-3.5 w-3.5" />
                                Issue New Card
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4 space-y-3">
                            <p className="text-xs text-muted-foreground">This patient has no active NFC Identity Card registered.</p>
                            <button
                              onClick={async () => {
                                try {
                                  const res = await issueNFCCard({
                                    patientDid: selected.did,
                                    patientName: selected.name,
                                    mrn: selected.mrn,
                                  });
                                  toast.success("NFC Card Issued", { description: `New Card ${res.card.cardId} registered.` });
                                  void refetchNFCCards();
                                } catch (err: any) {
                                  toast.error("Failed to issue card", { description: err.message });
                                }
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-clinical"
                            >
                              <Fingerprint className="h-3.5 w-3.5" />
                              Issue NFC Identity Card
                            </button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()
              )}

              {/* Add New Medical Record Form */}
              <Card className="border-primary/20 bg-primary/5 shadow-clinical">
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

      {/* ── Professional Revocation Confirm Dialog ── */}
      <AnimatePresence>
        {cardToRevoke && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-clinical-md"
            >
              <div className="flex items-center gap-3 text-destructive">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Revoke Identity Card</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground animate-pulse-subtle">
                Are you sure you want to revoke this NFC card (<span className="font-mono font-medium text-foreground">{cardToRevoke}</span>)? This action is permanent and will prevent any future authentication using this card.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setCardToRevoke(null)}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const id = cardToRevoke;
                    setCardToRevoke(null);
                    try {
                      await revokeNFCCard(id);
                      toast.success("NFC Card Revoked", {
                        description: `Card ${id} was successfully deactivated.`,
                      });
                      void refetchNFCCards();
                    } catch (err: any) {
                      toast.error("Failed to revoke card", { description: err.message });
                    }
                  }}
                  className="rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-white hover:bg-destructive/90 transition-colors shadow-clinical cursor-pointer"
                >
                  Revoke Card
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}

function PatientChartCards({ patientDid }: { patientDid: string }) {
  const { data: inpatientData } = useInpatientData(patientDid);
  const vitalSigns = inpatientData?.vitalSigns ?? [];
  const medications = inpatientData?.medications ?? [];
  const checkups = inpatientData?.checkups ?? [];

  const latestVital = vitalSigns[0] as any;

  return (
    <>
      {/* Latest vitals */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Latest Vitals</CardTitle>
            {latestVital && (
              <span className="text-xs text-muted-foreground ml-auto">{latestVital.timestamp}</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {latestVital ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {[
                { label: "Temp", value: `${latestVital.temperature ?? "—"}°C` },
                { label: "BP", value: latestVital.bloodPressure ? `${latestVital.bloodPressure.systolic}/${latestVital.bloodPressure.diastolic}` : "—" },
                { label: "HR", value: `${latestVital.heartRate ?? "—"} bpm` },
                { label: "RR", value: `${latestVital.respiratoryRate ?? "—"}/min` },
                { label: "SpO₂", value: `${latestVital.oxygenSaturation ?? "—"}%` },
              ].map((v) => (
                <div key={v.label} className="rounded-lg bg-muted p-2 text-center">
                  <div className="text-xs text-muted-foreground">{v.label}</div>
                  <div className="font-semibold text-sm mt-0.5">{v.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4">No vitals recorded</div>
          )}
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
          {medications.length > 0 ? medications
            .filter((m: any) => m.status === "active")
            .map((med: any) => (
              <div key={med.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                <div>
                  <span className="font-medium">{med.name}</span>
                  <span className="text-muted-foreground ml-2">{med.dosage} · {med.frequency}</span>
                </div>
                <Badge variant="outline" className="text-xs">Active</Badge>
              </div>
            )) : (
            <div className="text-xs text-muted-foreground text-center py-4">No medications recorded</div>
          )}
        </CardContent>
      </Card>

      {/* Lab tests / checkups */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Recent Lab Tests</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {checkups.length > 0 ? checkups.slice(0, 3).map((test: any) => (
            <div key={test.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
              <div>
                <span className="font-medium">{test.testName || test.type || "Lab Test"}</span>
                <span className="text-muted-foreground ml-2 text-xs">{test.orderedDate || test.date}</span>
              </div>
              <Badge variant={test.status === "completed" ? "default" : "secondary"} className="text-xs">
                {test.status || "pending"}
              </Badge>
            </div>
          )) : (
            <div className="text-xs text-muted-foreground text-center py-4">No lab tests recorded</div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
