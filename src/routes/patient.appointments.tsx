import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { appointments, availableSlots } from "@/lib/mock-data";
import { CalendarDays, Video, MapPin, Plus, ChevronRight, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { RouteGuard } from "@/components/RouteGuard";

export const Route = createFileRoute("/patient/appointments")({
  head: () => ({ meta: [{ title: "Patient · Appointments — DID Hospital" }] }),
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const [list, setList] = useState(appointments);
  const [booking, setBooking] = useState(false);
  const [picked, setPicked] = useState<{ date: string; time: string } | null>(null);

  const upcoming = list.filter((a) => a.status === "upcoming");
  const past = list.filter((a) => a.status !== "upcoming");

  const confirm = () => {
    if (!picked) return;
    const id = `ap${Date.now()}`;
    setList((prev) => [
      {
        id,
        doctor: "Dr. Sameer Khan",
        specialty: "General physician",
        hospital: "Apollo Hospitals · OPD-2",
        date: picked.date,
        time: `${picked.date.slice(5)} · ${picked.time}`,
        status: "upcoming",
        mode: "in-person",
      },
      ...prev,
    ]);
    setBooking(false);
    setPicked(null);
    toast.success("Appointment booked", { description: `${picked.date} at ${picked.time}` });
  };

  const cancel = (id: string) => {
    setList((prev) => prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)));
    toast("Appointment cancelled");
  };

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <PageHeader
            eyebrow="Patient app"
            title="Appointments"
            description={`${upcoming.length} upcoming visit${upcoming.length !== 1 ? "s" : ""}`}
          />
          <button
            onClick={() => setBooking(true)}
            className="mb-6 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90 active:scale-95 transition-transform"
          >
            <Plus className="h-4 w-4" /> Book
          </button>
        </div>

        {upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming visits"
            description="Tap Book to schedule a consultation with one of your verified doctors."
          />
        ) : (
          <StaggerList className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((a) => (
              <StaggerItem key={a.id}>
                <div className="rounded-2xl border border-border bg-card p-4 shadow-clinical">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-foreground">{a.doctor}</div>
                      <div className="text-sm text-muted-foreground">{a.specialty}</div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {a.mode === "tele" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                      {a.mode === "tele" ? "Telehealth" : "In-person"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span className="font-medium">{a.time}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{a.hospital}</div>
                  <div className="mt-3 flex gap-2 border-t border-border pt-3">
                    <button
                      onClick={() => cancel(a.id)}
                      className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <Link
                      to="/patient/qr"
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Check-in QR <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        )}

        {past.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Past</div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {past.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                  <div>
                    <div className="font-medium text-foreground">{a.doctor}</div>
                    <div className="text-sm text-muted-foreground">{a.time} · {a.specialty}</div>
                  </div>
                  <span className={`text-xs font-medium uppercase tracking-wider ${a.status === "cancelled" ? "text-destructive" : "text-success"}`}>
                    {a.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <AnimatePresence>
        {booking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBooking(false)}
            className="fixed inset-0 z-50 flex items-end bg-foreground/30 backdrop-blur-sm sm:items-center sm:justify-center"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-t-3xl border-t border-border bg-card p-5 shadow-clinical-md sm:max-w-md sm:rounded-2xl sm:border"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />
              <div className="font-semibold text-foreground">Pick a slot</div>
              <div className="text-sm text-muted-foreground">Dr. Sameer Khan · General physician</div>
              <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto">
                {availableSlots.map((s) => (
                  <div key={s.id}>
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {s.day} · {s.date}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {s.times.map((t) => {
                        const active = picked?.date === s.date && picked.time === t;
                        return (
                          <button
                            key={t}
                            onClick={() => setPicked({ date: s.date, time: t })}
                            className={[
                              "rounded-lg px-3 py-1.5 text-sm font-medium transition-all active:scale-95",
                              active
                                ? "bg-primary text-primary-foreground shadow-clinical"
                                : "border border-border bg-card text-foreground hover:bg-muted",
                            ].join(" ")}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2 border-t border-border pt-3">
                <button
                  onClick={() => setBooking(false)}
                  className="flex-1 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <X className="mr-1 inline h-4 w-4" /> Close
                </button>
                <button
                  onClick={confirm}
                  disabled={!picked}
                  className="flex-1 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Check className="mr-1 inline h-4 w-4" /> Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}
