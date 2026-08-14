import { Stethoscope, Calendar, MapPin, User, Clock, CheckCircle2 } from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";

interface ProceduresTabProps {
  procedures: any[];
  surgeries: any[];
}

export function ProceduresTab({ procedures, surgeries }: ProceduresTabProps) {
  const allItems = [
    ...(surgeries || []).map((s) => ({
      id: s.surgery_id,
      title: s.procedure_name,
      type: "Surgery",
      location: s.operating_room || "OR Suite",
      doctor: s.surgeon || "Chief Surgeon",
      date: s.scheduled_for,
      status: s.status,
      notes: `Anesthesiologist: ${s.anesthesiologist || "N/A"} • Duration: ${s.est_duration_min || 60} mins`,
    })),
    ...(procedures || []).map((p) => ({
      id: p.procedure_id,
      title: p.name,
      type: "Procedure",
      location: p.location || "Procedure Room",
      doctor: p.performed_by || "Attending Physician",
      date: p.scheduled_for || p.completed_at || p.created_at,
      status: p.status,
      notes: p.notes,
    })),
  ];

  if (allItems.length === 0) {
    return (
      <EmptyState
        icon={Stethoscope}
        title="No Procedures or Surgeries"
        description="No surgical interventions or clinical procedures recorded."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Procedures & Surgical History ({allItems.length})
      </div>

      <div className="space-y-3">
        {allItems.map((item) => (
          <GlowCard key={item.id} className="p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                  <Stethoscope className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase">
                      {item.type}
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Calendar className="h-3 w-3" />
                      {item.date ? new Date(item.date).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/15 px-2.5 py-0.5 text-[10px] font-extrabold text-success uppercase">
                <CheckCircle2 className="h-3 w-3" />
                {item.status || "Completed"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-background/60 p-3 rounded-xl border border-border/60">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">
                  Location / OR
                </span>
                <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {item.location}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">
                  Surgeon / Clinician
                </span>
                <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                  {item.doctor}
                </span>
              </div>
            </div>

            {item.notes && (
              <p className="text-xs font-medium text-muted-foreground bg-background/40 p-2.5 rounded-lg border border-border/40">
                {item.notes}
              </p>
            )}
          </GlowCard>
        ))}
      </div>
    </div>
  );
}
