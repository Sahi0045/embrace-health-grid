import { Bed, Calendar, Clock, MapPin, User, LogOut, CheckCircle2 } from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";

interface VisitsTabProps {
  admissions: any[];
}

export function VisitsTab({ admissions }: VisitsTabProps) {
  if (!admissions || admissions.length === 0) {
    return (
      <EmptyState
        icon={Bed}
        title="No Admissions or Visits Record"
        description="This patient has no recorded inpatient admissions or ward visit history."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Inpatient & Ward Admissions ({admissions.length})
      </div>

      <div className="space-y-3">
        {admissions.map((admission) => {
          const isAdmitted = admission.status === "admitted";
          const isDischarged = admission.status === "discharged";

          return (
            <GlowCard key={admission.admission_id} className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                    <Bed className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                      Admission #{admission.admission_id.slice(-6).toUpperCase()}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <span className="font-bold text-foreground">
                        Ward: {admission.ward || "General"}
                      </span>
                      <span>•</span>
                      <span>
                        Room {admission.room || "101"}, Bed {admission.bed || "A"}
                      </span>
                    </div>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                    isAdmitted
                      ? "bg-success/10 text-success border-success/30"
                      : isDischarged
                        ? "bg-muted/40 text-muted-foreground border-border/80"
                        : "bg-warning/10 text-warning-foreground border-warning/30"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isAdmitted ? "bg-success animate-pulse" : "bg-muted-foreground/50"
                    }`}
                  />
                  {admission.status || "Admitted"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-background/60 p-3.5 rounded-xl border border-border/60 text-xs">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                    Admitted On
                  </span>
                  <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {admission.admitted_at
                      ? new Date(admission.admitted_at).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                    Discharged On
                  </span>
                  <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                    <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                    {admission.discharged_at
                      ? new Date(admission.discharged_at).toLocaleDateString()
                      : isAdmitted
                        ? "Currently Admitted"
                        : "N/A"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                    Attending Physician
                  </span>
                  <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    {admission.admitting_doctor || "Staff Physician"}
                  </span>
                </div>
              </div>

              {admission.diagnosis && (
                <div className="text-xs space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Initial Admission Diagnosis
                  </span>
                  <p className="font-medium text-foreground bg-background/80 p-2.5 rounded-lg border border-border/40">
                    {admission.diagnosis}
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
