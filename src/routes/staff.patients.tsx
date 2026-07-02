import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { useLivePatients, useNFCCards } from "@/hooks/use-api";
import { Search, X, Activity, Pill, FlaskConical, AlertTriangle, Fingerprint, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { vitalSigns, medications, labTests } from "@/lib/inpatient-data";
import type { Patient } from "@/lib/mock-data";
import { getCurrentUser } from "@/lib/auth";
import { issueNFCCard, revokeNFCCard } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/patients")({
  head: () => ({ meta: [{ title: "Staff · Patients — DID Hospital" }] }),
  component: Patients,
});

function Patients() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [cardToRevoke, setCardToRevoke] = useState<string | null>(null);
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
