import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { FileSignature, Fingerprint, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/sign")({
  head: () => ({ meta: [{ title: "Staff · Sign Prescription — DID Hospital" }] }),
  component: SignPage,
});

function SignPage() {
  const [signed, setSigned] = useState(false);
  const [drug, setDrug] = useState("Atorvastatin 20 mg");
  const [dose, setDose] = useState("1 tablet once daily at bedtime, 30 days");

  const sign = () => {
    setSigned(true);
    toast.success("Prescription signed with DID + biometric", {
      description: "Hash anchored to audit ledger · PR-9821",
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Digital signature"
        title="Create & sign prescription"
        description="Signed prescriptions are anchored to the audit ledger and verifiable by any pharmacy."
      />

      <div className="grid gap-6 p-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-6 shadow-clinical">
          <div className="grid gap-4">
            <Field label="Patient">
              <input
                defaultValue="Anika Sharma · MRN-204871"
                disabled
                className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Medication">
              <input
                value={drug}
                onChange={(e) => setDrug(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
            <Field label="Dosage & duration">
              <textarea
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
            <Field label="Notes">
              <textarea
                rows={2}
                placeholder="Optional…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-clinical">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileSignature className="h-4 w-4 text-primary" /> Signature
          </div>

          <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-xs">
            <Row k="Signer" v="Dr. Ravi Menon" />
            <Row k="DID" v={<span className="font-mono">did:hosp:0xd103…99aa</span>} />
            <Row k="Method" v="DID + Fingerprint" />
            <Row k="Algorithm" v="Ed25519" />
          </div>

          {!signed ? (
            <button
              onClick={sign}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90"
            >
              <Fingerprint className="h-4 w-4" /> Sign with biometric
            </button>
          ) : (
            <div className="mt-5 rounded-lg border border-success/30 bg-success/10 p-4 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
              <div className="mt-2 text-sm font-medium text-foreground">Signed & anchored</div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                0x9f3a…c821 · block #1,284,991
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}
