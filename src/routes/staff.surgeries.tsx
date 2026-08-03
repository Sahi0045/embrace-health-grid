import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Activity, Clock, User, Wrench, Calendar, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { getSurgeries } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/surgeries")({
  head: () => ({ meta: [{ title: "Surgeries — Staff Portal" }] }),
  component: SurgeriesPage,
});

const statusConfig = {
  scheduled: { label: "Scheduled", badge: "bg-primary/10 text-primary", dot: "bg-primary" },
  "in-progress": { label: "In Progress", badge: "bg-success/10 text-success", dot: "bg-success" },
  completed: {
    label: "Completed",
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

function SurgeriesPage() {
  const [surgeriesList, setSurgeriesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSurgeries()
      .then((res) => {
        setSurgeriesList(res.surgeries ?? []);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load surgeries schedule", { description: err.message });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Staff Portal"
        title="Surgeries"
        description="Upcoming procedures, OR allocation, and staff/equipment assignments"
      />

      <div className="p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
            Loading surgeries schedule…
          </div>
        ) : (
          <StaggerList className="space-y-4">
            {surgeriesList.map((s) => {
              const cfg =
                statusConfig[s.status as keyof typeof statusConfig] || statusConfig.scheduled;
              return (
                <StaggerItem key={s.id}>
                  <motion.div
                    whileHover={{ scale: 1.002 }}
                    className="rounded-xl border border-border bg-card p-5 shadow-clinical"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-semibold text-foreground">
                            {s.procedure}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${cfg.badge}`}
                          >
                            <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-sm text-muted-foreground">
                          {s.patient} · {s.mrn}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" />
                        {s.room}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {s.date}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {s.time}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Activity className="h-3 w-3" />
                        {s.estDuration}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3 text-xs">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                          Surgical Team
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-primary" />
                            <span className="font-medium text-foreground">{s.surgeon}</span>
                            <span className="text-muted-foreground">(Surgeon)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-chart-2" />
                            <span className="font-medium text-foreground">
                              {s.anesthesiologist}
                            </span>
                          </div>
                          {(s.nurses || []).map((n: string) => (
                            <div key={n} className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-foreground">{n}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                          Equipment
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(s.equipment || []).map((e: string) => (
                            <span
                              key={e}
                              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-foreground"
                            >
                              <Wrench className="h-2.5 w-2.5" />
                              {e}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </StaggerItem>
              );
            })}
            {surgeriesList.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No surgeries scheduled
              </div>
            )}
          </StaggerList>
        )}
      </div>
    </RouteGuard>
  );
}
