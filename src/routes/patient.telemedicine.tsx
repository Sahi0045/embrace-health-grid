import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Video, Calendar, Clock, ShieldCheck, Pill } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useAppointments, useLivePatients } from "@/hooks/use-api";
import { getCurrentUser } from "@/lib/auth";
import { getPrescriptions } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/patient/telemedicine")({
  head: () => ({ meta: [{ title: "Telemedicine — Embrace Health Grid" }] }),
  component: TelemedicinePage,
});

function TelemedicinePage() {
  const [tab, setTab] = useState<"upcoming" | "history" | "prescriptions">("upcoming");
  const { data: appointmentsData, loading: loadingAppts } = useAppointments();
  const { patients } = useLivePatients();
  const currentUser = getCurrentUser();
  const patient = patients?.find((p: any) => p.email === currentUser?.email);
  const patientDid = patient?.did || "";

  const [apiPrescriptions, setApiPrescriptions] = useState<any[]>([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);

  useEffect(() => {
    if (!patientDid) return;
    setLoadingPrescriptions(true);
    getPrescriptions(patientDid)
      .then((res) => {
        setApiPrescriptions(res.prescriptions || []);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load telemedicine prescriptions", { description: err.message });
      })
      .finally(() => {
        setLoadingPrescriptions(false);
      });
  }, [patientDid]);

  const rawAppointments = appointmentsData?.appointments ?? [];

  const myTeleAppointments = rawAppointments
    .filter((a: any) => a.patientDid === patientDid && (a.mode === "tele" || a.mode === "telemedicine"))
    .map((a: any) => ({
      id: a.apptId || a.id || String(Math.random()),
      doctor: a.doctorName || "Doctor",
      specialty: a.specialty || "Specialist",
      date: a.date || a.slot?.split(" · ")[0] || "2026-06-08",
      time: a.slot?.split(" · ")[1] || "10:30 AM",
      duration: "20 min",
      mode: "video" as const,
      status: a.status || "scheduled",
    }));

  const upcoming = myTeleAppointments.filter((a: any) => a.status === "scheduled" || a.status === "confirmed" || a.status === "pending");

  const previous = myTeleAppointments.filter((a: any) => a.status === "completed" || a.status === "cancelled");

  const prescriptions = apiPrescriptions.map((rx, idx) => ({
    id: rx.rxId || `rx_${idx}`,
    rx: rx.rxId,
    medication: rx.drugs?.map((d: any) => typeof d === "string" ? d : d.name).join(", ") || "Medications",
    issuer: rx.signedBy || "Embrace Health Doctor",
    date: rx.signedAt?.split("T")[0] || "2026-06-08",
    valid: rx.status === "active",
  }));

  const isLoading = loadingAppts || loadingPrescriptions;

  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Patient app"
        title="Telemedicine"
        description="Virtual consultations, session history, and prescription credentials"
      />

      <div className="flex gap-1 border-b border-border px-8 bg-card">
        {(["upcoming", "history", "prescriptions"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 capitalize transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "history" ? "Session History" : t === "prescriptions" ? "Prescriptions" : "Upcoming"}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
            Loading telemedicine data…
          </div>
        ) : (
          <>
            {tab === "upcoming" && (
              <StaggerList className="space-y-4">
                {upcoming.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Video className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <div className="text-sm font-medium text-muted-foreground">No upcoming consultations</div>
                  </div>
                )}
                {upcoming.map((c) => (
                  <StaggerItem key={c.id}>
                    <motion.div whileHover={{ scale: 1.002 }} className="rounded-xl border border-border bg-card p-5 shadow-clinical">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                            <Video className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">{c.doctor}</div>
                            <div className="text-xs text-muted-foreground">{c.specialty}</div>
                          </div>
                        </div>
                        <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success capitalize">{c.status}</span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{c.date}</div>
                        <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{c.time}</div>
                        <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{c.duration}</div>
                      </div>

                      <a
                        href={`https://meet.jit.si/EmbraceHealthTelemed-${c.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors text-center"
                      >
                        <Video className="h-4 w-4" />
                        Join Video Call
                      </a>
                    </motion.div>
                  </StaggerItem>
                ))}
              </StaggerList>
            )}

            {tab === "history" && (
              <StaggerList className="space-y-4">
                {previous.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Video className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <div className="text-sm font-medium text-muted-foreground">No session history found</div>
                  </div>
                )}
                {previous.map((s: any) => (
                  <StaggerItem key={s.id}>
                    <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{s.doctor}</div>
                          <div className="text-xs text-muted-foreground">{s.specialty} · {s.date} · {s.time} · {s.duration}</div>
                        </div>
                        {s.signed !== false && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success shrink-0">
                            <ShieldCheck className="h-3 w-3" />
                            Signed
                          </span>
                        )}
                      </div>
                      <div className="mt-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">{s.summary || "Consultation completed successfully."}</div>
                      {s.prescription && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                          <Pill className="h-3 w-3" />
                          {s.prescription}
                        </div>
                      )}
                    </div>
                  </StaggerItem>
                ))}
              </StaggerList>
            )}

            {tab === "prescriptions" && (
              <StaggerList className="space-y-3">
                {prescriptions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Pill className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <div className="text-sm font-medium text-muted-foreground">No prescriptions found</div>
                  </div>
                )}
                {prescriptions.map((p) => (
                  <StaggerItem key={p.id}>
                    <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chart-2/10">
                            <Pill className="h-4 w-4 text-chart-2" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">{p.medication}</div>
                            <div className="text-xs text-muted-foreground">{p.issuer} · {p.date}</div>
                          </div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${p.valid ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                          {p.valid ? "Active" : "Expired"}
                        </span>
                      </div>
                      <div className="mt-2 font-mono text-[10px] text-muted-foreground/50">{p.rx}</div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </>
        )}
      </div>
    </RouteGuard>
  );
}
