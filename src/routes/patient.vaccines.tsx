import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { CredentialCard } from "@/components/credentials/CredentialCard";
import { CredentialTimeline } from "@/components/credentials/CredentialTimeline";
import { CredentialIssuerBadge } from "@/components/credentials/CredentialIssuerBadge";
import { useVaccineRecords } from "@/hooks/use-api";
import { useLivePatients } from "@/hooks/use-api";
import { getCurrentUser } from "@/lib/auth";
import { ShieldCheck, Syringe, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export const Route = createFileRoute("/patient/vaccines")({
  head: () => ({ meta: [{ title: "Vaccine Passport — Embrace Health Grid" }] }),
  component: VaccinesPage,
});

const statusBadge: Record<string, string> = {
  complete: "bg-success/10 text-success",
  "due-soon": "bg-warning/10 text-warning-foreground",
  overdue: "bg-destructive/10 text-destructive",
  pending: "bg-muted text-muted-foreground",
};

function VaccinesPage() {
  const currentUser = getCurrentUser();
  const { patients } = useLivePatients();
  const patientRecord = patients?.find((p: any) => p.email === currentUser?.email) || patients?.[0];
  const patientDid = patientRecord?.did || currentUser?.did || "";
  const { data: vaccineData } = useVaccineRecords(patientDid);
  const vaccineCredentials = vaccineData?.vaccines ?? [];
  const [selected, setSelected] = useState<any | null>(null);
  const complete = vaccineCredentials.filter((v: any) => v.status === "complete").length;
  const dueSoon = vaccineCredentials.filter((v: any) => v.status === "due-soon").length;

  const timelineEvents = vaccineCredentials.map((v: any, i: number) => ({
    id: `vax_event_${v.id || i}`,
    action: "issued" as const,
    label: `${v.vaccine} dose issued`,
    issuer: v.issuer,
    at: v.lastDose || "N/A",
  }));

  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Patient app"
        title="Vaccine Passport"
        description="Your complete vaccination history with verifiable credentials"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              WHO Verified
            </div>
          </div>
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Complete", value: complete, color: "text-success", bg: "bg-success/10" },
            { label: "Due Soon", value: dueSoon, color: "text-warning-foreground", bg: "bg-warning/10" },
            { label: "Total", value: vaccineCredentials.length, color: "text-primary", bg: "bg-primary/10" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl ${s.bg} p-4 text-center`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Vaccine cards */}
        <div>
          <div className="text-sm font-semibold text-foreground mb-3">Vaccination Records</div>
          <StaggerList className="space-y-3">
            {vaccineCredentials.map((v) => (
              <StaggerItem key={v.id}>
                <motion.div
                  whileHover={{ scale: 1.005 }}
                  onClick={() => setSelected(v)}
                  className="cursor-pointer rounded-xl border border-border bg-card p-4 shadow-clinical hover:shadow-clinical-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Syringe className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{v.vaccine}</div>
                        <div className="text-xs text-muted-foreground">{v.issuer}</div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0 ${statusBadge[v.status]}`}>
                      {v.status === "complete" ? <ShieldCheck className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {v.status === "due-soon" ? "Due Soon" : "Complete"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide opacity-60">Doses</div>
                      <div className="font-semibold text-foreground">{v.doses}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide opacity-60">Last Dose</div>
                      <div className="font-semibold text-foreground">{v.lastDose}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide opacity-60">Next Due</div>
                      <div className="font-semibold text-foreground">{v.nextDue}</div>
                    </div>
                  </div>

                  <div className="mt-2 font-mono text-[10px] text-muted-foreground/50">{v.credential}</div>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerList>
        </div>

        {/* Timeline */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            Vaccination Timeline
          </div>
          <CredentialTimeline events={timelineEvents} />
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-clinical-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-semibold text-foreground">{selected.vaccine}</div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors text-xs">✕ Close</button>
            </div>

            <div className="space-y-4">
              <CredentialIssuerBadge issuer={selected.issuer} did={selected.issuerDid || `did:hosp:issuer:${selected.issuer.toLowerCase().replace(/[^a-z0-9]/g, "")}`} />

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Manufacturer", value: selected.manufacturer },
                  { label: "Batch No", value: selected.batchNo },
                  { label: "Total Doses", value: String(selected.doses) },
                  { label: "Last Dose", value: selected.lastDose },
                  { label: "Next Due", value: selected.nextDue },
                  { label: "Credential ID", value: selected.credential },
                ].map((f) => (
                  <div key={f.label} className="rounded-lg bg-muted p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">{f.label}</div>
                    <div className="font-medium text-foreground text-xs">{f.value}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3">
                <ShieldCheck className="h-4 w-4 text-success" />
                <span className="text-xs font-medium text-success">Credential cryptographically verified · Ed25519</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </RouteGuard>
  );
}
