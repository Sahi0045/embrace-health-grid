import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Video, Calendar, Clock, User, FileText, ShieldCheck, Pill, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { getAppointments, getPrescriptions } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/patient/telemedicine")({
  head: () => ({ meta: [{ title: "Telemedicine — DID Hospital" }] }),
  component: TelemedicinePage,
});

function TelemedicinePage() {
  const [tab, setTab] = useState<"upcoming" | "history" | "prescriptions">("upcoming");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const patientDid = typeof window !== "undefined" ? localStorage.getItem("userDID") || "" : "";

  useEffect(() => {
    if (!patientDid) {
      setLoading(false);
      return;
    }
    Promise.all([getAppointments(), getPrescriptions(patientDid)])
      .then(([apptRes, rxRes]) => {
        setAppointments(apptRes.appointments || []);
        setPrescriptions(rxRes.prescriptions || []);
      })
      .catch((err) => console.error("Error loading telemedicine data:", err))
      .finally(() => setLoading(false));
  }, [patientDid]);

  const patientTeleAppts = appointments.filter(
    (a) => a.patientDid === patientDid && a.mode === "telemedicine"
  );
  
  const upcoming = patientTeleAppts.filter(
    (a) => a.status === "scheduled" || a.status === "confirmed" || !a.status
  ).map((a, i) => ({
    id: a.apptId || `up_${i}`,
    doctor: a.doctorName,
    specialty: a.specialty,
    date: a.slot.split(" ")[0] || "2026-06-09",
    time: a.slot.split(" ").slice(1).join(" ") || "4:15 PM",
    duration: "30 min",
    mode: "video",
    link: "#",
    status: "scheduled",
  }));

  const previous = patientTeleAppts.filter(
    (a) => a.status === "completed" || a.status === "done"
  ).map((a, i) => ({
    id: a.apptId || `prev_${i}`,
    doctor: a.doctorName,
    specialty: a.specialty,
    date: a.slot.split(" ")[0] || "2026-05-22",
    time: a.slot.split(" ").slice(1).join(" ") || "10:30 AM",
    duration: "30 min",
    summary: a.summary || "Routine telemedicine review.",
    prescription: a.rxId || null,
    signed: true,
  }));

  const prescriptionCredentials = prescriptions.map((p, i) => ({
    id: p.rxId || `pc_${i}`,
    rx: p.rxId,
    medication: p.drugs?.map((d: any) => `${d.name} ${d.dosage}`).join(", ") || "Medication prescribed",
    issuer: p.signedBy || "Doctor Specialist",
    date: p.date || "N/A",
    valid: true,
  }));

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
                <motion.div whileHover={{ scale: 1.005 }} className="rounded-xl border border-border bg-card p-5 shadow-clinical">
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
                    <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success">Scheduled</span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{c.date}</div>
                    <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{c.time}</div>
                    <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{c.duration}</div>
                  </div>

                  <button
                    onClick={() => toast.success("Connecting to secure video call...", { description: `Session with ${c.doctor}` })}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Video className="h-4 w-4" />
                    Join Video Call
                  </button>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerList>
        )}

        {tab === "history" && (
          <StaggerList className="space-y-4">
            {previous.map((s) => (
              <StaggerItem key={s.id}>
                <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{s.doctor}</div>
                      <div className="text-xs text-muted-foreground">{s.specialty} · {s.date} · {s.time} · {s.duration}</div>
                    </div>
                    {s.signed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success shrink-0">
                        <ShieldCheck className="h-3 w-3" />
                        Signed
                      </span>
                    )}
                  </div>
                  <div className="mt-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">{s.summary}</div>
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
            {prescriptionCredentials.map((p) => (
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
      </div>
    </RouteGuard>
  );
}
