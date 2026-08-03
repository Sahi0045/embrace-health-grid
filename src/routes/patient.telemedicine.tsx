import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import {
  Video,
  Calendar,
  Clock,
  User,
  FileText,
  ShieldCheck,
  Pill,
  ChevronRight,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Volume2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useAppointments, useLivePatients } from "@/hooks/use-api";
import { useCurrentUser } from "@/lib/auth-context";
import { getPrescriptions } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/patient/telemedicine")({
  head: () => ({ meta: [{ title: "Telemedicine — Embrace Health Grid" }] }),
  component: TelemedicinePage,
});

function TelemedicinePage() {
  const [tab, setTab] = useState<"upcoming" | "history" | "prescriptions">("upcoming");
  const [activeCall, setActiveCall] = useState<any | null>(null);

  const { data: appointmentsData, loading: loadingAppts } = useAppointments();
  const { patients } = useLivePatients();
  const { user: currentUser } = useCurrentUser();
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
    .filter(
      (a: any) => a.patientDid === patientDid && (a.mode === "tele" || a.mode === "telemedicine"),
    )
    .map((a: any) => ({
      id: a.apptId || a.id || String(Math.random()),
      doctor: a.doctorName || "Doctor",
      specialty: a.specialty || "Specialist",
      date: a.date || a.slot?.split(" · ")[0] || new Date().toISOString().split("T")[0],
      time: a.slot?.split(" · ")[1] || "10:30 AM",
      duration: "20 min",
      mode: "video" as const,
      status: a.status || "scheduled",
    }));

  const upcoming = myTeleAppointments.filter(
    (a: any) => a.status === "scheduled" || a.status === "confirmed" || a.status === "pending",
  );

  const previous = myTeleAppointments.filter(
    (a: any) => a.status === "completed" || a.status === "cancelled",
  );

  const prescriptions = apiPrescriptions.map((rx, idx) => ({
    id: rx.rxId || `rx_${idx}`,
    rx: rx.rxId,
    medication:
      rx.drugs?.map((d: any) => (typeof d === "string" ? d : d.name)).join(", ") || "Medications",
    issuer: rx.signedBy || "Embrace Health Doctor",
    date: rx.signedAt?.split("T")[0] || new Date().toISOString().split("T")[0],
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
        {(["upcoming", "history", "prescriptions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 capitalize transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "history"
              ? "Session History"
              : t === "prescriptions"
                ? "Prescriptions"
                : "Upcoming"}
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
                    <div className="text-sm font-medium text-muted-foreground">
                      No upcoming consultations
                    </div>
                  </div>
                )}
                {upcoming.map((c: any) => (
                  <StaggerItem key={c.id}>
                    <motion.div
                      whileHover={{ scale: 1.002 }}
                      className="rounded-xl border border-border bg-card p-5 shadow-clinical"
                    >
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
                        <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success capitalize">
                          {c.status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {c.date}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {c.time}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {c.duration}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          toast.success("Connecting to secure video call...", {
                            description: `Session with ${c.doctor}`,
                          });
                          setActiveCall(c);
                        }}
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
                {previous.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Video className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <div className="text-sm font-medium text-muted-foreground">
                      No session history found
                    </div>
                  </div>
                )}
                {previous.map((s: any) => (
                  <StaggerItem key={s.id}>
                    <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{s.doctor}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.specialty} · {s.date} · {s.time} · {s.duration}
                          </div>
                        </div>
                        {s.signed !== false && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success shrink-0">
                            <ShieldCheck className="h-3 w-3" />
                            Signed
                          </span>
                        )}
                      </div>
                      <div className="mt-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                        {s.summary || "Consultation completed successfully."}
                      </div>
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
                    <div className="text-sm font-medium text-muted-foreground">
                      No prescriptions found
                    </div>
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
                            <div className="text-sm font-semibold text-foreground">
                              {p.medication}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {p.issuer} · {p.date}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${p.valid ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                        >
                          {p.valid ? "Active" : "Expired"}
                        </span>
                      </div>
                      <div className="mt-2 font-mono text-[10px] text-muted-foreground/50">
                        {p.rx}
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {activeCall && (
          <TelemedicineCallModal call={activeCall} onClose={() => setActiveCall(null)} />
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}

function TelemedicineCallModal({ call, onClose }: { call: any; onClose: () => void }) {
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md text-white"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="relative flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 text-white shadow-2xl"
      >
        {/* Main Video Screen */}
        <div className="relative flex-1 flex items-center justify-center bg-slate-950">
          {videoOff ? (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-800 text-slate-400 text-2xl font-bold">
              {call.doctor
                ? call.doctor
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                : "DOC"}
            </div>
          ) : (
            // Simulated Doctor Video Feed
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              {/* Doctor Avatar / Pulsing Indicator */}
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-primary/20 border border-primary/40 animate-pulse">
                <span className="text-3xl font-bold text-primary">
                  {call.doctor
                    ? call.doctor
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                    : "DOC"}
                </span>
                {/* Audio wave effect */}
                <div className="absolute -inset-4 rounded-full border border-primary/20 animate-ping opacity-40" />
              </div>
              <h3 className="mt-6 text-xl font-bold">{call.doctor}</h3>
              <p className="text-sm text-slate-400 mt-1">{call.specialty} · Live Session</p>
            </div>
          )}

          {/* Time Counter */}
          <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold tabular-nums text-white">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            {formatTime(seconds)}
          </div>

          {/* Patient Self-View Window (Webcam preview) */}
          <div className="absolute top-4 right-4 h-32 w-48 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg flex items-center justify-center text-center">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-slate-400 font-semibold">You (Patient)</span>
            </div>
            {/* Audio Indicator */}
            <div className="absolute bottom-2 left-2 flex gap-0.5">
              <div
                className="h-2 w-0.5 bg-emerald-500 animate-bounce"
                style={{ animationDelay: "0.1s" }}
              />
              <div
                className="h-3 w-0.5 bg-emerald-500 animate-bounce"
                style={{ animationDelay: "0.3s" }}
              />
              <div
                className="h-1.5 w-0.5 bg-emerald-500 animate-bounce"
                style={{ animationDelay: "0.5s" }}
              />
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex h-20 items-center justify-center gap-4 bg-slate-950/80 px-6 border-t border-slate-800/60 backdrop-blur-sm">
          <button
            onClick={() => {
              setMuted(!muted);
              toast(muted ? "Microphone unmuted" : "Microphone muted");
            }}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${muted ? "bg-red-500 text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          <button
            onClick={() => {
              setVideoOff(!videoOff);
              toast(videoOff ? "Camera turned on" : "Camera turned off");
            }}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${videoOff ? "bg-red-500 text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
          >
            {videoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>

          <button
            onClick={() => {
              toast.info("Volume adjusted");
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all text-white"
          >
            <Volume2 className="h-5 w-5" />
          </button>

          <button
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-red-900/25"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
