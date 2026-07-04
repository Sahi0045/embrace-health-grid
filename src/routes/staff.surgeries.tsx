import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Activity, Clock, User, Wrench, Calendar, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { getSurgeries } from "@/lib/api";

export const Route = createFileRoute("/staff/surgeries")({
  head: () => ({ meta: [{ title: "Surgeries — Staff Portal" }] }),
  component: SurgeriesPage,
});

// Dynamic surgeries loaded from API

const statusConfig = {
  scheduled: { label: "Scheduled", badge: "bg-primary/10 text-primary", dot: "bg-primary" },
  "in-progress": { label: "In Progress", badge: "bg-success/10 text-success", dot: "bg-success" },
  completed: { label: "Completed", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  cancelled: { label: "Cancelled", badge: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
};

function SurgeriesPage() {
  const [surgeries, setSurgeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSurgeries()
      .then((res) => {
        setSurgeries(res.surgeries || []);
      })
      .catch((err) => console.error("Error loading surgeries:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Staff Portal"
        title="Surgeries"
        description="Upcoming procedures, OR allocation, and staff/equipment assignments"
      />

      <div className="p-6 space-y-4">
        {loading && (
          <div className="text-sm text-muted-foreground py-8 text-center animate-pulse">
            Loading surgeries from secure clinic database...
          </div>
        )}
        {!loading && (
          <StaggerList className="space-y-4">
            {surgeries.map((s) => {
            const cfg = statusConfig[s.status as keyof typeof statusConfig];
            return (
              <StaggerItem key={s.id}>
                <motion.div whileHover={{ scale: 1.002 }} className="rounded-xl border border-border bg-card p-5 shadow-clinical">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-foreground">{s.procedure}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${cfg.badge}`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">{s.patient} · {s.mrn}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{s.room}</div>
                    <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{s.date}</div>
                    <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{s.time}</div>
                    <div className="flex items-center gap-1.5"><Activity className="h-3 w-3" />{s.estDuration}</div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3 text-xs">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Surgical Team</div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5"><User className="h-3 w-3 text-primary" /><span className="font-medium text-foreground">{s.surgeon}</span><span className="text-muted-foreground">(Surgeon)</span></div>
                        <div className="flex items-center gap-1.5"><User className="h-3 w-3 text-chart-2" /><span className="font-medium text-foreground">{s.anesthesiologist}</span></div>
                        {s.nurses.map((n: string) => (
                          <div key={n} className="flex items-center gap-1.5"><User className="h-3 w-3 text-muted-foreground" /><span className="text-foreground">{n}</span></div>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Equipment</div>
                      <div className="flex flex-wrap gap-1.5">
                        {s.equipment.map((e: string) => (
                          <span key={e} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-foreground">
                            <Wrench className="h-2.5 w-2.5" />{e}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerList>
        )}
      </div>
    </RouteGuard>
  );
}
