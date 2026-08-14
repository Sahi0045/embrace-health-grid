import { Calendar, Clock, User, Stethoscope, CheckCircle2, MapPin } from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";

interface AppointmentsTabProps {
  appointments: any[];
}

export function AppointmentsTab({ appointments }: AppointmentsTabProps) {
  if (!appointments || appointments.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No Appointments Scheduled"
        description="No upcoming or past consultation appointments found for this patient."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Consultation & Follow-up Appointments ({appointments.length})
      </div>

      <div className="space-y-3">
        {appointments.map((apt) => {
          const isScheduled = apt.status === "scheduled";
          const isCompleted = apt.status === "completed";

          return (
            <GlowCard key={apt.appointment_id || apt.id} className="p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                    <Calendar className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                      {apt.department || apt.title || "Clinical Consultation"}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span className="font-bold text-foreground">
                        {apt.appointment_date
                          ? new Date(apt.appointment_date).toLocaleDateString()
                          : "N/A"}
                      </span>
                      {apt.appointment_time && <span>at {apt.appointment_time}</span>}
                    </div>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                    isCompleted
                      ? "bg-success/15 text-success border-success/30"
                      : isScheduled
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted/40 text-muted-foreground border-border/80"
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {apt.status || "Scheduled"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-background/60 p-3 rounded-xl border border-border/60">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">
                    Physician
                  </span>
                  <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    {apt.doctor_name || apt.doctor_did || "Dr. Assigned"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">
                    Clinic / Room
                  </span>
                  <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {apt.location || "OPD Clinic"}
                  </span>
                </div>
              </div>

              {apt.reason && (
                <p className="text-xs font-medium text-muted-foreground bg-background/40 p-2.5 rounded-lg border border-border/40">
                  Reason for Visit: {apt.reason}
                </p>
              )}
            </GlowCard>
          );
        })}
      </div>
    </div>
  );
}
