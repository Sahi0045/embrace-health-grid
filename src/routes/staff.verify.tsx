import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { QrPlaceholder } from "@/components/QrPlaceholder";
import { currentPatient } from "@/lib/mock-data";
import { useLivePatients } from "@/hooks/use-fabric";
import { ScanLine, CheckCircle2, ShieldCheck, AlertTriangle, X, FileText, Pill, Activity, FlaskConical, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { vitalSigns, medications, labTests } from "@/lib/inpatient-data";

export const Route = createFileRoute("/staff/verify")({
  head: () => ({ meta: [{ title: "Staff · Verify Patient — DID Hospital" }] }),
  component: VerifyPatient,
});

function VerifyPatient() {
  const { patients: patientsList } = useLivePatients();
  const patient = patientsList?.[0] || currentPatient;
  const [verified, setVerified] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);

  const handleScan = () => {
    setVerified(true);
    toast.success("Patient identity verified", {
      description: `${patient.name} · MRN ${patient.mrn}`,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Verification"
        title="Verify patient identity"
        description="Scan the patient's QR code to cryptographically verify their hospital DID."
      />

      <div className="grid gap-6 p-8 lg:grid-cols-[1fr_1.2fr]">
        {/* Scanner panel */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-clinical">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ScanLine className="h-4 w-4 text-primary" /> Scanner
          </div>

          <div className="mt-4 flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40">
            {verified ? (
              <div className="text-center">
                <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
                <div className="mt-2 text-sm font-medium text-foreground">Identity match</div>
              </div>
            ) : (
              <QrPlaceholder value="staff-scanner-frame" size={240} />
            )}
          </div>

          <button
            onClick={handleScan}
            disabled={verified}
            className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90 disabled:opacity-60"
          >
            {verified ? "Verified" : "Simulate scan"}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            In production, this uses the device camera + DID resolver.
          </p>
        </div>

        {/* Patient info panel */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-clinical">
          {!verified ? (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center text-muted-foreground">
              <ScanLine className="h-12 w-12 opacity-40" />
              <div className="mt-3 text-sm">Waiting for scan…</div>
              <div className="text-xs">Patient details will appear here once verified.</div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Patient</div>
                  <div className="mt-1 text-xl font-semibold text-foreground">{patient.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {patient.age} · {patient.gender} · MRN {patient.mrn}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <Field label="DID" value={<span className="font-mono text-xs">{patient.did}</span>} />
                <Field label="Phone" value={patient.phone} />
                <Field label="Blood group" value={patient.bloodGroup} />
                <Field
                  label="Allergies"
                  value={
                    patient.allergies && patient.allergies.length ? (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {patient.allergies.join(", ")}
                      </span>
                    ) : "None"
                  }
                />
              </dl>

              <div className="mt-6 flex gap-2 border-t border-border pt-5">
                <button className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Request record access
                </button>
                <button
                  onClick={() => setChartOpen(true)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Open chart
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Patient Chart Modal ── */}
      {chartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={() => setChartOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-clinical-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <div>
                <div className="font-semibold text-foreground">{patient.name} — Clinical Chart</div>
                <div className="text-xs text-muted-foreground">MRN {patient.mrn} · {patient.age}y · {patient.gender} · {patient.bloodGroup}</div>
              </div>
              <button
                onClick={() => setChartOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Allergy alert */}
              {patient.allergies && patient.allergies.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-destructive">Allergy Alert</div>
                    <div className="text-sm text-foreground">{patient.allergies.join(", ")}</div>
                  </div>
                </div>
              )}

              {/* Latest vitals */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Latest Vitals</CardTitle>
                    <span className="text-xs text-muted-foreground ml-auto">{vitalSigns[0].timestamp}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {[
                      { label: "Temp",   value: `${vitalSigns[0].temperature}°C` },
                      { label: "BP",     value: `${vitalSigns[0].bloodPressure.systolic}/${vitalSigns[0].bloodPressure.diastolic}` },
                      { label: "HR",     value: `${vitalSigns[0].heartRate} bpm` },
                      { label: "RR",     value: `${vitalSigns[0].respiratoryRate}/min` },
                      { label: "SpO₂",   value: `${vitalSigns[0].oxygenSaturation}%` },
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
                  {medications.filter(m => m.status === "active").map((med) => (
                    <div key={med.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                      <div>
                        <span className="font-medium">{med.name}</span>
                        <span className="text-muted-foreground ml-2">{med.dosage} · {med.frequency}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">Active</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent lab tests */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Recent Lab Tests</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {labTests.slice(0, 3).map((test) => (
                    <div key={test.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                      <div>
                        <span className="font-medium">{test.testName}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{test.orderedDate}</span>
                      </div>
                      <Badge variant={test.status === "completed" ? "default" : "secondary"} className="text-xs">
                        {test.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Footer actions */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Link
                  to="/staff/patients"
                  className="flex-1 rounded-md border border-border bg-card px-4 py-2 text-center text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  onClick={() => setChartOpen(false)}
                >
                  View full patient list
                </Link>
                <button
                  onClick={() => setChartOpen(false)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}
