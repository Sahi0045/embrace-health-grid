import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import {
  bookAppointment,
  getDIDVerifiedDoctors,
  getAppointmentsByPatient,
  getMedicalRecords,
  getPrescriptions,
  getLabs,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import {
  CalendarDays, Video, MapPin, Search, AlertTriangle,
  Phone, Mail, MessageSquare, Pill, ClipboardList,
  FlaskConical, User, ShieldAlert, Clock, X, Check,
  CheckCircle2, XCircle, RefreshCw, ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/patient/appointments")({
  head: () => ({ meta: [{ title: "Patient · Appointments — Embrace Health Grid" }] }),
  component: AppointmentsPage,
});

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  did: string;
  hospital: string;
  status: string;
  rating: number;
  experience: string;
  didVerified: boolean;
  availableDays: { day: string; date: string; slots: string[] }[];
}

interface Appointment {
  apptId: string;
  doctorName: string;
  doctorDid: string;
  specialty: string;
  slot: string;
  mode: string;
  status: "pending" | "confirmed" | "rejected" | "rescheduled" | "cancelled";
  reason?: string;
  suggestedSlot?: string;
  rejectionReason?: string;
  bookedAt: string;
}

const STATUS_CONFIG = {
  pending:     { label: "Awaiting Doctor",  bg: "bg-warning/15",     text: "text-yellow-700 dark:text-yellow-400",  icon: Clock,          dot: "bg-yellow-500" },
  confirmed:   { label: "Confirmed",         bg: "bg-success/15",     text: "text-success",                          icon: CheckCircle2,   dot: "bg-success" },
  rejected:    { label: "Declined",          bg: "bg-destructive/10", text: "text-destructive",                      icon: XCircle,        dot: "bg-destructive" },
  rescheduled: { label: "Time Suggested",    bg: "bg-primary/10",     text: "text-primary",                          icon: RefreshCw,      dot: "bg-primary" },
  cancelled:   { label: "Cancelled",         bg: "bg-muted",          text: "text-muted-foreground",                 icon: X,              dot: "bg-muted-foreground" },
};

// Minimum date for booking: tomorrow
function getMinBookingDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function isDateAtLeastTomorrow(dateStr: string): boolean {
  const selected = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return selected >= tomorrow;
}

function StatusBadge({ status }: { status: Appointment["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function AppointmentsPage() {
  const currentUser = getCurrentUser();
  const patientDid = currentUser?.did || "";

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptLoading, setApptLoading] = useState(true);

  const [medicalHistory, setMedicalHistory] = useState<any[]>([]);
  const [currentMedications, setCurrentMedications] = useState<any[]>([]);
  const [recentLabReports, setRecentLabReports] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");

  // Booking modal state
  const [selectedDoc, setSelectedDoc] = useState<Doctor | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [consultMode, setConsultMode] = useState<"in-person" | "tele">("in-person");
  const [reason, setReason] = useState("");
  const [grantOnChainConsent, setGrantOnChainConsent] = useState(true);
  const [isBooking, setIsBooking] = useState(false);

  // Notification channels (UI only)
  const [notifChannels, setNotifChannels] = useState({ sms: true, email: true, whatsapp: true });
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  // Telehealth simulator
  const [activeCall, setActiveCall] = useState<{ doctorName: string } | null>(null);

  // Load DID-verified doctors
  const loadDoctors = useCallback(() => {
    setDoctorsLoading(true);
    getDIDVerifiedDoctors()
      .then((res) => setDoctors(res.doctors || []))
      .catch(() => setDoctors([]))
      .finally(() => setDoctorsLoading(false));
  }, []);

  // Load patient appointments
  const loadAppointments = useCallback(() => {
    if (!patientDid) { setApptLoading(false); return; }
    setApptLoading(true);
    getAppointmentsByPatient(patientDid)
      .then((res) => setAppointments((res.appointments || []) as Appointment[]))
      .catch(() => setAppointments([]))
      .finally(() => setApptLoading(false));
  }, [patientDid]);

  useEffect(() => { loadDoctors(); }, [loadDoctors]);
  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  // Subscribe to real-time appointment updates via WebSocket
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const msg = JSON.parse((e as CustomEvent).detail);
        if (msg.event === "appointment:updated" || msg.event === "appointment:booked") {
          loadAppointments();
        }
      } catch {}
    };
    window.addEventListener("ws:message", handler as EventListener);
    return () => window.removeEventListener("ws:message", handler as EventListener);
  }, [loadAppointments]);

  useEffect(() => {
    if (!patientDid) return;
    getMedicalRecords(patientDid)
      .then((res) => setMedicalHistory((res.records || []).map((r: any) => ({
        id: r.recordId, date: r.createdAt?.split("T")[0] || "—",
        condition: r.title, doctor: r.doctorName || "—", status: r.status || "Controlled",
      }))))
      .catch(() => {});
    getPrescriptions(patientDid)
      .then((res) => setCurrentMedications((res.prescriptions || []).flatMap((rx: any, ri: number) =>
        (rx.drugs || []).map((d: any, di: number) => ({
          id: `${ri}-${di}`, name: d.name || d,
          frequency: d.frequency || "As directed", purpose: rx.diagnosis || "Treatment",
        })))))
      .catch(() => {});
    getLabs(patientDid)
      .then((res) => setRecentLabReports((res.labs || []).map((l: any) => ({
        id: l.labId, date: l.completedAt?.split("T")[0] || l.orderedAt?.split("T")[0] || "—",
        test: l.tests?.join(", ") || "Lab Test",
        result: l.results?.[0] ? `${l.results[0].parameter}: ${l.results[0].value} ${l.results[0].unit}` : "Pending",
        status: l.status || "Pending",
      }))))
      .catch(() => {});
  }, [patientDid]);

  const specialties = ["All", ...Array.from(new Set(doctors.map((d) => d.specialty))).sort()];

  const filteredDoctors = doctors.filter((doc) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = doc.name.toLowerCase().includes(q) || doc.specialty.toLowerCase().includes(q);
    const matchesSpec = selectedSpecialty === "All" || doc.specialty === selectedSpecialty;
    return matchesSearch && matchesSpec;
  });

  const upcoming = appointments.filter((a) => a.status === "pending" || a.status === "confirmed" || a.status === "rescheduled");
  const past = appointments.filter((a) => a.status === "rejected" || a.status === "cancelled");

  const confirmBooking = async () => {
    if (!selectedDoc || !selectedDay || !selectedSlot || isBooking) return;

    // Enforce at-least-1-day rule
    if (!isDateAtLeastTomorrow(selectedDay)) {
      toast.error("Appointments must be booked at least 1 day in advance.");
      return;
    }

    const slot = `${selectedDay} · ${selectedSlot}`;
    setIsBooking(true);
    try {
      await bookAppointment({
        patientDid: patientDid || "did:hosp:unknown",
        patientName: currentUser?.name || "Patient",
        doctorDid: selectedDoc.did,
        doctorName: selectedDoc.name,
        slot,
        mode: consultMode,
        specialty: selectedDoc.specialty,
        consentGranted: grantOnChainConsent,
        reason: reason.trim(),
      });
      toast.success("Appointment request sent", {
        description: `Awaiting confirmation from ${selectedDoc.name}`,
      });
      loadAppointments();
    } catch (err: any) {
      toast.error("Booking failed", { description: err.message });
    } finally {
      setIsBooking(false);
      setSelectedDoc(null);
      setSelectedDay(null);
      setSelectedSlot(null);
      setReason("");
    }
  };

  const triggerEmergencyBooking = async () => {
    const erDoc = doctors[0];
    if (!erDoc) { toast.error("No doctors available"); setShowEmergencyModal(false); return; }
    try {
      await bookAppointment({
        patientDid: patientDid || "did:hosp:unknown",
        patientName: currentUser?.name || "Patient",
        doctorDid: erDoc.did,
        doctorName: erDoc.name,
        slot: `${getMinBookingDate()} · 09:00 AM`,
        mode: "in-person",
        specialty: "ER / Emergency",
        reason: "Emergency triage request",
      });
      toast.error("Emergency request sent", { description: "Report to ER Desk." });
      loadAppointments();
    } catch (err: any) {
      toast.error("Emergency booking failed", { description: err.message });
    }
    setShowEmergencyModal(false);
  };

  const cancelAppointment = async (apptId: string) => {
    const { updateAppointmentStatus } = await import("@/lib/api");
    try {
      await updateAppointmentStatus(apptId, "cancelled");
      toast.success("Appointment cancelled");
      loadAppointments();
    } catch {
      setAppointments((prev) => prev.map((a) => a.apptId === apptId ? { ...a, status: "cancelled" as const } : a));
      toast.success("Appointment cancelled");
    }
  };

  const acceptSuggestedSlot = async (appt: Appointment) => {
    if (!appt.suggestedSlot) return;
    const { updateAppointmentStatus } = await import("@/lib/api");
    try {
      await updateAppointmentStatus(appt.apptId, "confirmed");
      toast.success("New time accepted", { description: appt.suggestedSlot });
      loadAppointments();
    } catch (err: any) {
      toast.error("Failed to accept slot", { description: err.message });
    }
  };

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-4">
          <PageHeader
            eyebrow="Patient app"
            title="Book Appointment"
            description="Browse DID-verified doctors and request a consultation. Bookings require at least 1 day advance notice."
          />
          <button
            onClick={() => setShowEmergencyModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 shadow-clinical active:scale-95 transition-all"
          >
            <ShieldAlert className="h-4 w-4" /> Emergency Request
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content: doctor listing + appointment list */}
          <div className="lg:col-span-2 space-y-6">

            {/* Doctor search & filter */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-clinical space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  <span className="text-sm font-semibold text-foreground">DID-Verified Doctors</span>
                </div>
                <span className="text-xs text-muted-foreground">{filteredDoctors.length} available</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or specialty..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {specialties.map((spec) => (
                  <button key={spec} onClick={() => setSelectedSpecialty(spec)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${selectedSpecialty === spec ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                    {spec}
                  </button>
                ))}
              </div>
            </div>

            {/* Doctor cards */}
            {doctorsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-40 rounded-xl border border-border bg-card animate-pulse" />
                ))}
              </div>
            ) : filteredDoctors.length === 0 ? (
              <EmptyState icon={User} title="No verified doctors found"
                description="Only doctors with an active DID issued by the Admin appear here. Contact your administrator." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredDoctors.map((doc, i) => (
                  <div key={`${doc.did}_${i}`}
                    className="rounded-xl border border-border bg-card p-4 shadow-clinical flex flex-col justify-between space-y-4 hover:border-primary/40 transition-all">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary uppercase tracking-wide">{doc.specialty}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${doc.status === "Available" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${doc.status === "Available" ? "bg-success" : "bg-muted-foreground"}`} />
                          {doc.status}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-foreground mt-1">{doc.name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="h-3 w-3 text-success" />
                        <p className="text-[10px] text-success font-semibold">DID Verified</p>
                        <p className="text-[10px] text-muted-foreground font-mono ml-1">{doc.did}</p>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{doc.hospital}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs font-semibold text-yellow-500">★ {doc.rating} · {doc.experience}</span>
                      <button
                        onClick={() => { setSelectedDoc(doc); setSelectedDay(doc.availableDays[0]?.date || null); setSelectedSlot(null); setReason(""); }}
                        className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/25 transition-colors">
                        Book Consultation
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upcoming / Active Appointments */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                My Appointments ({upcoming.length})
              </h2>
              {apptLoading ? (
                <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />)}</div>
              ) : upcoming.length === 0 ? (
                <EmptyState icon={CalendarDays} title="No active appointments"
                  description="Book a consultation with a verified doctor above." />
              ) : (
                <StaggerList className="space-y-3">
                  {upcoming.map((a) => {
                    const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.pending;
                    const Icon = cfg.icon;
                    return (
                      <StaggerItem key={a.apptId}>
                        <div className={`rounded-xl border bg-card p-4 shadow-clinical transition-all ${a.status === "rescheduled" ? "border-primary/40" : a.status === "confirmed" ? "border-success/40" : "border-border"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-foreground">{a.doctorName}</span>
                                <StatusBadge status={a.status} />
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">{a.specialty}</div>
                              <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
                                <Clock className="h-4 w-4 text-primary shrink-0" />
                                <span className="font-semibold truncate">{a.slot}</span>
                              </div>
                              {a.reason && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  <span className="font-medium">Reason:</span> {a.reason}
                                </div>
                              )}
                              {a.status === "rescheduled" && a.suggestedSlot && (
                                <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                                  <p className="text-xs text-primary font-semibold">Doctor suggested: {a.suggestedSlot}</p>
                                  <button onClick={() => acceptSuggestedSlot(a)}
                                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-success hover:underline">
                                    <Check className="h-3 w-3" /> Accept new time
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {a.mode === "tele" ? (
                                <button onClick={() => setActiveCall({ doctorName: a.doctorName })}
                                  className="rounded-lg bg-success/10 px-3 py-1.5 text-xs font-bold text-success hover:bg-success/20 flex items-center gap-1">
                                  <Video className="h-3 w-3" /> Join
                                </button>
                              ) : (
                                <Link to="/patient/qr"
                                  className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> Check-in
                                </Link>
                              )}
                              <button onClick={() => cancelAppointment(a.apptId)}
                                className="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </StaggerItem>
                    );
                  })}
                </StaggerList>
              )}
            </div>

            {/* Past / declined appointments */}
            {past.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Past & Declined Appointments
                </div>
                <div className="space-y-2">
                  {past.map((a) => (
                    <div key={a.apptId} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                      <div>
                        <div className="font-medium text-foreground">{a.doctorName}</div>
                        <div className="text-xs text-muted-foreground">{a.slot} · {a.specialty}</div>
                        {a.rejectionReason && (
                          <div className="text-[10px] text-destructive mt-0.5">Reason: {a.rejectionReason}</div>
                        )}
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: health overview + notification settings */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <User className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Patient Health Overview</h3>
              </div>

              {/* Medical History */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Conditions & History</span>
                {medicalHistory.length === 0
                  ? <p className="text-xs text-muted-foreground">No records yet.</p>
                  : medicalHistory.map((item) => (
                    <div key={item.id} className="rounded-lg bg-muted/60 p-2 text-xs border border-border">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-foreground">{item.condition}</span>
                        <span className="text-[10px] text-muted-foreground">{item.date}</span>
                      </div>
                      <div className="text-muted-foreground mt-0.5">Physician: {item.doctor}</div>
                    </div>
                  ))}
              </div>

              {/* Current Medications */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                  <Pill className="h-3 w-3 text-primary" /> Current Medications
                </span>
                {currentMedications.length === 0
                  ? <p className="text-xs text-muted-foreground">None on record.</p>
                  : currentMedications.slice(0, 4).map((med) => (
                    <div key={med.id} className="flex justify-between items-center rounded-lg bg-primary/5 p-2 text-xs border border-primary/20">
                      <div>
                        <div className="font-semibold text-foreground">{med.name}</div>
                        <div className="text-[10px] text-muted-foreground">{med.frequency}</div>
                      </div>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">{med.purpose}</span>
                    </div>
                  ))}
              </div>

              {/* Recent Labs */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                  <FlaskConical className="h-3 w-3 text-primary" /> Recent Labs
                </span>
                {recentLabReports.length === 0
                  ? <p className="text-xs text-muted-foreground">No lab reports.</p>
                  : recentLabReports.slice(0, 3).map((lab) => (
                    <div key={lab.id} className="rounded-lg bg-muted/60 p-2 text-xs border border-border flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-foreground">{lab.test}</div>
                        <div className="text-[9px] text-muted-foreground">{lab.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground truncate max-w-[90px]">{lab.result}</div>
                        <span className="text-[9px] text-success font-semibold">{lab.status}</span>
                      </div>
                    </div>
                  ))}
              </div>

              <Link to="/patient/records"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-muted">
                <ClipboardList className="h-3.5 w-3.5 text-primary" /> View Full Medical File
              </Link>
            </div>

            {/* Notification settings */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Reminder Channels</h3>
              </div>
              {[
                { id: "whatsapp" as const, label: "WhatsApp", icon: MessageSquare, desc: "Rich media alerts" },
                { id: "sms" as const, label: "SMS", icon: Phone, desc: "Offline notifications" },
                { id: "email" as const, label: "Email", icon: Mail, desc: "Detailed summaries" },
              ].map((item) => (
                <div key={item.id} className="flex items-start justify-between">
                  <div className="flex gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={notifChannels[item.id]}
                      onChange={(e) => setNotifChannels((p) => ({ ...p, [item.id]: e.target.checked }))}
                      className="sr-only peer" />
                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Booking Modal ── */}
      <AnimatePresence>
        {selectedDoc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
            onClick={() => setSelectedDoc(null)}>
            <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-clinical-md max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">Schedule Consultation</h3>
                  <p className="text-xs text-muted-foreground">{selectedDoc.name} · {selectedDoc.specialty}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="h-3 w-3 text-success" />
                    <span className="text-[10px] text-success font-semibold">DID Verified Doctor</span>
                  </div>
                </div>
                <button onClick={() => setSelectedDoc(null)} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {/* 1-day notice banner */}
                <div className="rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 shrink-0" />
                  <p className="text-[11px] text-yellow-700 dark:text-yellow-400 font-medium">
                    Appointments must be booked at least <strong>1 day in advance</strong>. Same-day bookings are not available.
                  </p>
                </div>

                {/* Consultation mode */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Consultation Type</label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {(["in-person", "tele"] as const).map((mode) => (
                      <button key={mode} onClick={() => setConsultMode(mode)}
                        className={`flex flex-col items-center gap-1 rounded-xl p-3 border text-center transition-all ${consultMode === mode ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted text-muted-foreground"}`}>
                        {mode === "in-person" ? <MapPin className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                        <span className="text-xs font-semibold">{mode === "in-person" ? "OPD In-Person" : "Telehealth Video"}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date selection */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Select Date</label>
                  <div className="mt-1.5 flex gap-2 flex-wrap">
                    {selectedDoc.availableDays.map((d) => {
                      const isValid = isDateAtLeastTomorrow(d.date);
                      return (
                        <button key={d.date} disabled={!isValid}
                          onClick={() => { setSelectedDay(d.date); setSelectedSlot(null); }}
                          className={`flex-1 min-w-[72px] flex flex-col items-center p-2 rounded-lg border text-center transition-all ${!isValid ? "opacity-40 cursor-not-allowed border-border text-muted-foreground" : selectedDay === d.date ? "border-primary bg-primary/5 text-primary font-bold" : "border-border hover:bg-muted text-muted-foreground"}`}>
                          <span className="text-[10px] uppercase font-bold">{d.day}</span>
                          <span className="text-sm">{new Date(d.date + "T12:00:00").getDate()}</span>
                          <span className="text-[9px] text-muted-foreground">{d.date.slice(5)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Slot selection */}
                {selectedDay && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Available Time Slots</label>
                    <div className="mt-1.5 grid grid-cols-4 gap-2">
                      {selectedDoc.availableDays.find((d) => d.date === selectedDay)?.slots.map((s) => (
                        <button key={s} onClick={() => setSelectedSlot(s)}
                          className={`p-2 rounded-lg border text-xs font-medium text-center transition-all ${selectedSlot === s ? "bg-primary text-primary-foreground border-primary shadow-clinical" : "border-border hover:bg-muted text-foreground"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reason for visit */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Reason for Visit <span className="normal-case font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                    placeholder="Briefly describe your symptoms or reason for the visit..."
                    className="mt-1.5 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none" />
                </div>

                {/* On-chain consent toggle */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">On-Chain Prescription Access</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Authorises {selectedDoc.name} to access your prescriptions during the consultation.
                      </p>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input type="checkbox" checked={grantOnChainConsent}
                        onChange={(e) => setGrantOnChainConsent(e.target.checked)} className="sr-only peer" />
                      <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-2 border-t border-border pt-4">
                <button onClick={() => setSelectedDoc(null)}
                  className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold hover:bg-muted">
                  Cancel
                </button>
                <button onClick={confirmBooking} disabled={!selectedDay || !selectedSlot || isBooking}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all">
                  {isBooking ? "Sending Request…" : "Send Booking Request"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Emergency Modal ── */}
      <AnimatePresence>
        {showEmergencyModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-destructive-foreground/40 backdrop-blur-sm p-4"
            onClick={() => setShowEmergencyModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border-2 border-destructive bg-card p-6 shadow-clinical-md"
              onClick={(e) => e.stopPropagation()}>
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive animate-pulse">
                  <ShieldAlert className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Request Emergency Consult?</h3>
                <p className="text-xs text-muted-foreground px-4">
                  This sends an immediate triage request to the next available doctor for the earliest available slot.
                </p>
              </div>
              <div className="mt-6 flex gap-2">
                <button onClick={() => setShowEmergencyModal(false)}
                  className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold hover:bg-muted">
                  Cancel
                </button>
                <button onClick={triggerEmergencyBooking}
                  className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground hover:bg-destructive/90">
                  Confirm Emergency
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Telehealth Simulator ── */}
      <AnimatePresence>
        {activeCall && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-between p-6">
            <div className="flex items-center justify-between text-white">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="text-sm font-bold">Secure Telehealth Session</span>
                </div>
                <div className="text-xs text-muted-foreground">DID Verification: Active</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{activeCall.doctorName}</div>
                <div className="text-xs text-muted-foreground">Consulting Room</div>
              </div>
            </div>
            <div className="flex-1 my-6 rounded-2xl bg-muted/10 border border-white/10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="h-28 w-28 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-primary">
                  <User className="h-14 w-14" />
                </div>
                <div className="text-white text-sm font-medium animate-pulse">Connecting with {activeCall.doctorName}…</div>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <button onClick={() => setActiveCall(null)}
                className="h-14 w-14 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90">
                <X className="h-6 w-6" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}
