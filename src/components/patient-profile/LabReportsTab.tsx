import { FlaskConical, Calendar, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";

interface LabReportsTabProps {
  labResults: any[];
}

export function LabReportsTab({ labResults }: LabReportsTabProps) {
  if (!labResults || labResults.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No Lab Reports"
        description="No diagnostic laboratory tests or pathology results recorded."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Laboratory & Pathology Reports ({labResults.length})
      </div>

      <div className="space-y-3">
        {labResults.map((lab) => {
          const isAbnormal = lab.flag === "abnormal" || lab.status === "abnormal";

          return (
            <GlowCard key={lab.lab_id || lab.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-xs ${
                    isAbnormal ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
                  }`}>
                    <FlaskConical className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                      {lab.test_name || lab.title || "Laboratory Panel"}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase">
                        {lab.category || "General Lab"}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {lab.created_at ? new Date(lab.created_at).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                    isAbnormal
                      ? "bg-destructive/15 text-destructive border-destructive/30"
                      : "bg-success/15 text-success border-success/30"
                  }`}
                >
                  {isAbnormal ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                  {isAbnormal ? "Abnormal" : "Normal / Verified"}
                </span>
              </div>

              {lab.results && (
                <div className="bg-background/60 p-3.5 rounded-xl border border-border/60 text-xs font-mono space-y-1">
                  <div className="text-[10px] font-sans font-extrabold uppercase tracking-wider text-muted-foreground">
                    Findings & Result Values
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs text-foreground">
                    {typeof lab.results === "string" ? lab.results : JSON.stringify(lab.results, null, 2)}
                  </pre>
                </div>
              )}

              {lab.notes && (
                <p className="text-xs font-medium text-muted-foreground italic">
                  Pathologist Note: {lab.notes}
                </p>
              )}
            </GlowCard>
          );
        })}
      </div>
    </div>
  );
}
