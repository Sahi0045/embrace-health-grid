import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { staffSchedule } from "@/lib/mock-data";
import { useSimulatedLoading } from "@/hooks/use-simulated-loading";
import { ListSkeleton } from "@/components/Skeleton";
import { Calendar, Clock, MapPin, Stethoscope, Plane } from "lucide-react";
import { motion } from "framer-motion";
import { stagger, fadeUp } from "@/components/Motion";

export const Route = createFileRoute("/staff/schedule")({
  head: () => ({ meta: [{ title: "Staff · Schedule — DID Hospital" }] }),
  component: SchedulePage,
});

const roleTone: Record<string, string> = {
  "On-call": "bg-destructive/10 text-destructive border-destructive/30",
  OPD: "bg-primary/10 text-primary border-primary/30",
  "Ward rounds": "bg-success/15 text-success border-success/30",
  Surgery: "bg-warning/20 text-warning-foreground border-warning/30",
  Off: "bg-muted text-muted-foreground border-border",
};

function SchedulePage() {
  const loading = useSimulatedLoading(500);
  const hours = staffSchedule
    .filter((s) => s.role !== "Off" && s.start !== "—")
    .reduce((acc, s) => {
      const [sh, sm] = s.start.split(":").map(Number);
      const [eh, em] = s.end.split(":").map(Number);
      let d = (eh * 60 + em) - (sh * 60 + sm);
      if (d < 0) d += 24 * 60;
      return acc + d;
    }, 0);
  const totalHours = Math.round(hours / 60);

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="My week"
        description="Week of June 1 — June 7, 2026 · Cardiology"
        actions={
          <button className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            <Plane className="h-4 w-4" /> Request time off
          </button>
        }
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Scheduled hours" value={`${totalHours}h`} delta="across 5 shifts" icon={Clock} />
          <StatCard label="On-call shifts" value={1} delta="Fri night" icon={Stethoscope} tone="warning" />
          <StatCard label="Days off" value={1} delta="Wednesday" icon={Calendar} tone="success" />
        </div>

        {loading ? (
          <ListSkeleton rows={6} />
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="overflow-hidden rounded-xl border border-border bg-card shadow-clinical">
            <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div>Day</div>
              <div>Time</div>
              <div>Unit</div>
              <div>Role</div>
            </div>
            {staffSchedule.map((s) => (
              <motion.div
                key={s.id}
                variants={fadeUp}
                className="grid grid-cols-[80px_1fr_1fr_1fr] items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 hover:bg-muted/30"
              >
                <div>
                  <div className="text-xs uppercase text-muted-foreground">{s.day}</div>
                  <div className="text-sm font-semibold text-foreground">{s.date.slice(8)}</div>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {s.start === "—" ? <span className="text-muted-foreground">—</span> : `${s.start} – ${s.end}`}
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {s.unit}
                </div>
                <div>
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleTone[s.role]}`}>
                    {s.role}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </>
  );
}
