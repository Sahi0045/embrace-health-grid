import { Pill, Calendar, Shield, User, FileText, CheckCircle2 } from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";

interface PrescriptionsTabProps {
  prescriptions: any[];
}

export function PrescriptionsTab({ prescriptions }: PrescriptionsTabProps) {
  if (!prescriptions || prescriptions.length === 0) {
    return (
      <EmptyState
        icon={Pill}
        title="No Prescriptions Found"
        description="No active or past medications prescribed for this patient."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Prescription Records ({prescriptions.length})
      </div>

      <div className="space-y-3">
        {prescriptions.map((rx) => {
          const drugs = Array.isArray(rx.drugs) ? rx.drugs : [];

          return (
            <GlowCard key={rx.rx_id} className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                    <Pill className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                      Prescription #{rx.rx_id.slice(-6).toUpperCase()}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span>{rx.created_at ? new Date(rx.created_at).toLocaleDateString() : "N/A"}</span>
                      <span>•</span>
                      <span>By: <strong className="text-foreground">{rx.doctor_did || "Physician"}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {rx.signed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/30 px-2.5 py-0.5 text-[10px] font-extrabold text-success uppercase">
                      <Shield className="h-3 w-3" />
                      Signed VC
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      rx.status === "dispensed"
                        ? "bg-success/10 text-success border-success/30"
                        : rx.status === "active"
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted/40 text-muted-foreground border-border/80"
                    }`}
                  >
                    {rx.status || "Active"}
                  </span>
                </div>
              </div>

              {/* Drugs List */}
              {drugs.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Prescribed Medications
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {drugs.map((drug: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-border/60 bg-background/80 flex justify-between items-center text-xs"
                      >
                        <div>
                          <div className="font-extrabold text-foreground">{drug.name || drug.drug_name || "Medication"}</div>
                          <div className="text-[11px] text-muted-foreground">{drug.dosage || "As directed"} • {drug.frequency || "Daily"}</div>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                          {drug.duration || "7 Days"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rx.diagnosis && (
                <div className="text-xs space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Associated Diagnosis
                  </span>
                  <p className="font-medium text-foreground bg-background/60 p-2.5 rounded-lg border border-border/40">
                    {rx.diagnosis}
                  </p>
                </div>
              )}
            </GlowCard>
          );
        })}
      </div>
    </div>
  );
}
