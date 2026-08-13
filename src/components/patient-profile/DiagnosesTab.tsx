import { Activity, Stethoscope, Calendar, AlertCircle } from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";

interface DiagnosesTabProps {
  prescriptions: any[];
  medicalRecords: any[];
}

export function DiagnosesTab({ prescriptions, medicalRecords }: DiagnosesTabProps) {
  const diagnosesList = [
    ...(prescriptions || [])
      .filter((p) => p.diagnosis)
      .map((p) => ({
        id: p.rx_id,
        title: p.diagnosis,
        doctor: p.doctor_did || "Attending Physician",
        date: p.created_at,
        source: "Prescription",
        notes: p.notes,
      })),
    ...(medicalRecords || [])
      .filter((r) => r.record_type === "diagnosis" || r.record_type === "Diagnosis")
      .map((r) => ({
        id: r.record_id,
        title: r.title,
        doctor: r.author_name || "Staff Doctor",
        date: r.created_at,
        source: "Medical Record",
        notes: r.content,
      })),
  ];

  if (diagnosesList.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No Recorded Diagnoses"
        description="No active or past formal clinical diagnoses recorded for this patient."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Clinical Diagnoses ({diagnosesList.length})
      </div>

      <div className="space-y-3">
        {diagnosesList.map((item) => (
          <GlowCard key={item.id} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive shadow-xs">
                  <Activity className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center rounded-full border border-destructive/30 bg-destructive/15 px-2 py-0.5 text-[10px] font-extrabold text-destructive uppercase">
                      {item.source}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {item.date ? new Date(item.date).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {item.notes && (
              <p className="text-xs font-medium text-muted-foreground bg-background/60 p-3 rounded-xl border border-border/60">
                {item.notes}
              </p>
            )}

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40 font-medium">
              <span className="flex items-center gap-1">
                <Stethoscope className="h-3.5 w-3.5 text-primary" />
                Diagnosed by: <strong className="text-foreground">{item.doctor}</strong>
              </span>
            </div>
          </GlowCard>
        ))}
      </div>
    </div>
  );
}
