import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { CheckCircle2, Download } from "lucide-react";

export const Route = createFileRoute("/admin/compliance")({
  head: () => ({ meta: [{ title: "Admin · Compliance — DID Hospital" }] }),
  component: Compliance,
});

const frameworks = [
  { name: "HIPAA", score: 98, items: ["Encryption at rest", "Access controls", "Audit logging", "Breach notification"] },
  { name: "GDPR", score: 95, items: ["Consent management", "Right to erasure", "Data portability", "DPO contact"] },
  { name: "DPDP", score: 97, items: ["Purpose limitation", "Consent receipts", "Grievance officer", "Localization"] },
];

function Compliance() {
  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Regulatory readiness"
        description="Live compliance scoring against HIPAA, GDPR, and India's DPDP Act."
        actions={
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90">
            <Download className="h-4 w-4" /> Download report
          </button>
        }
      />

      <div className="grid gap-6 p-8 lg:grid-cols-3">
        {frameworks.map((f) => (
          <div key={f.name} className="rounded-xl border border-border bg-card p-6 shadow-clinical">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">{f.name}</h3>
              <span className="text-2xl font-semibold text-success">{f.score}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success" style={{ width: `${f.score}%` }} />
            </div>
            <ul className="mt-5 space-y-2 text-sm">
              {f.items.map((i) => (
                <li key={i} className="flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {i}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
