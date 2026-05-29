import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { fraudAlerts } from "@/lib/mock-data";
import { AlertTriangle, Ban, Eye } from "lucide-react";

export const Route = createFileRoute("/admin/fraud")({
  head: () => ({ meta: [{ title: "Admin · Fraud Detection — DID Hospital" }] }),
  component: Fraud,
});

function Fraud() {
  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Fraud detection"
        description="Real-time anomaly detection on access patterns, MFA failures, and shift violations."
      />

      <div className="space-y-4 p-8">
        {fraudAlerts.map((a) => {
          const tone =
            a.severity === "high"
              ? "border-destructive/40 bg-destructive/5"
              : a.severity === "medium"
              ? "border-warning/40 bg-warning/5"
              : "border-border bg-card";
          const sevColor =
            a.severity === "high"
              ? "bg-destructive/15 text-destructive"
              : a.severity === "medium"
              ? "bg-warning/20 text-warning-foreground"
              : "bg-muted text-muted-foreground";

          return (
            <div key={a.id} className={`flex items-start gap-4 rounded-xl border p-5 shadow-clinical ${tone}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${sevColor}`}>
                    {a.severity}
                  </span>
                  <span className="text-xs text-muted-foreground">{a.at}</span>
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">{a.message}</div>
                <div className="mt-1 text-xs text-muted-foreground">{a.actor}</div>
              </div>
              <div className="flex gap-2">
                <button className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  <Eye className="h-3.5 w-3.5" /> Investigate
                </button>
                <button className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90">
                  <Ban className="h-3.5 w-3.5" /> Block
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
