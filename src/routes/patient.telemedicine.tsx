import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Video, Calendar, Clock, User, FileText, ShieldCheck, Pill, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export const Route = createFileRoute("/patient/telemedicine")({
  head: () => ({ meta: [{ title: "Telemedicine — DID Hospital" }] }),
  component: TelemedicinePage,
});

const upcoming = [
  {
    id: "tc1",
    doctor: "Dr. Aanya Verma",
    specialty: "Radiology Follow-up",
    date: "2026-06-09",
    time: "4:15 PM",
    duration: "30 min",
    mode: "video",
    link: "#",
    status: "scheduled",
  },
  {
    id: "tc2",
    doctor: "Dr. Sameer Khan",
    specialty: "General Check-up",
    date: "2026-06-18",
    time: "10:00 AM",
    duration: "20 min",
    mode: "video",
    link: "#",
    status: "scheduled",
  },
];

const previous = [
  {
    id: "tp1",
    doctor: "Dr. Ravi Menon",
    specialty: "Cardiology",
    date: "2026-05-22",
    time: "10:30 AM",
    duration: "45 min",
    summary: "ECG review and medication adjustment — increased Metoprolol to 50mg OD",
    prescription: "RX-2026-05-9821",
    signed: true,
  },
  {
    id: "tp2",
    doctor: "Dr. Aanya Verma",
    specialty: "Radiology",
    date: "2026-04-08",
    time: "2:00 PM",
    duration: "20 min",
    summary: "Chest X-ray review — no active lesions, follow-up in 2 months",
    prescription: null,
    signed: true,
  },
  {
    id: "tp3",
    doctor: "Dr. Sameer Khan",
    specialty: "General Medicine",
    date: "2026-03-15",
    time: "9:00 AM",
    duration: "15 min",
    summary: "Annual wellness check — all vitals normal, continue current medications",
    prescription: "RX-2026-03-8814",
    signed: true,
  },
];

const prescriptionCredentials = [
  { id: "pc1", rx: "RX-2026-05-9821", medication: "Metoprolol 50mg OD", issuer: "Dr. Ravi Menon", date: "2026-05-22", valid: true },
  { id: "pc2", rx: "RX-2026-03-8814", medication: "Multivitamin once daily", issuer: "Dr. Sameer Khan", date: "2026-03-15", valid: false },
];

function TelemedicinePage() {
  const [tab, setTab] = useState<"upcoming" | "history" | "prescriptions">("upcoming");

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

                  <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
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
