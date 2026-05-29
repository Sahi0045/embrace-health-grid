import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { QrPlaceholder } from "@/components/QrPlaceholder";
import { currentPatient } from "@/lib/mock-data";
import { ScanLine, CheckCircle2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/verify")({
  head: () => ({ meta: [{ title: "Staff · Verify Patient — DID Hospital" }] }),
  component: VerifyPatient,
});

function VerifyPatient() {
  const [verified, setVerified] = useState(false);

  const handleScan = () => {
    setVerified(true);
    toast.success("Patient identity verified", {
      description: `${currentPatient.name} · MRN ${currentPatient.mrn}`,
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
                  <div className="mt-1 text-xl font-semibold text-foreground">{currentPatient.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {currentPatient.age} · {currentPatient.gender} · MRN {currentPatient.mrn}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <Field label="DID" value={<span className="font-mono text-xs">{currentPatient.did}</span>} />
                <Field label="Phone" value={currentPatient.phone} />
                <Field label="Blood group" value={currentPatient.bloodGroup} />
                <Field
                  label="Allergies"
                  value={
                    currentPatient.allergies.length ? (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {currentPatient.allergies.join(", ")}
                      </span>
                    ) : (
                      "None"
                    )
                  }
                />
              </dl>

              <div className="mt-6 flex gap-2 border-t border-border pt-5">
                <button className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Request record access
                </button>
                <button className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                  Open chart
                </button>
              </div>
            </>
          )}
        </div>
      </div>
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
