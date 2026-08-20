import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useVerifiedDoctors, useAppointmentsByPatient } from "@/hooks/use-api";
import {
  bookAppointment,
  getMedicalRecords,
  getPrescriptions,
  getLabs,
  updateAppointmentStatus,
  getBookedSlots,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/auth-context";
import {
  CalendarDays,
  Video,
  MapPin,
  Plus,
  Check,
  X,
  Search,
  AlertTriangle,
  Phone,
  Mail,
  MessageSquare,
  Pill,
  ClipboardList,
  FlaskConical,
  User,
  ShieldAlert,
  Clock,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { RouteGuard } from "@/components/RouteGuard";

export const Route = createFileRoute("/patient/appointments")({
  head: () => ({ meta: [{ title: "Patient · Appointments — Embrace Health Grid" }] }),
  component: AppointmentsPage,
});

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD for a date offset by `days` from today */
function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/** Returns the next N available dates starting from tomorrow */
function getAvailableDates(count = 14): string[] {
  return Array.from({ length: count }, (_, i) => offsetDate(i + 1));
}

const TIME_SLOTS = [
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
  "03:30 PM",
  "04:00 PM",
  "04:30 PM",
];

const SPECIALTIES = [
  "All",
  "Cardiology",
  "General Medicine",
  "Radiology",
  "Emergency Medicine",
  "Pediatrics",
  "Orthopedics",
];

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  pending: { label: "Awaiting Doctor", cls: "bg-warning/15 text-warning-foreground", icon: Clock },
  confirmed: { label: "Confirmed", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive", icon: XCircle },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground", icon: X },
  suggested: { label: "New Time Offered", cls: "bg-primary/15 text-primary", icon: Info },
};

function AppointmentsPage() {
  const { user: currentUser } = useCurrentUser();
  const patientDid = currentUser?.did ?? "";

  // ── server data ──────────────────────────────────────────────────────────
  const { data: doctorsData, loading: doctorsLoading } = useVerifiedDoctors();
  const { data: apptData, refetch: refetchAppts } = useAppointmentsByPatient(patientDid);

  // ── side-panel health data ───────────────────────────────────────────────
  const [medicalHistory, setMedicalHistory] = useState<any[]>([]);
  const [currentMedications, setCurrentMedications] = useState<any[]>([]);
  const [recentLabReports, setRecentLabReports] = useState<any[]>([]);

  useEffect(() => {
    if (!patientDid) return;
    getMedicalRecords(patientDid)
      .then((r) =>
        setMedicalHistory(
          (r.records || []).map((rec: any) => ({
            id: rec.recordId,
            date: rec.createdAt?.split("T")[0] ?? "—",
            condition: rec.title,
            doctor: rec.doctorName ?? "—",
            status: rec.status ?? "Controlled",
          })),
        ),
      )
      .catch(() => {});
    getPrescriptions(patientDid)
      .then((r) =>
        setCurrentMedications(
          (r.prescriptions || []).flatMap((rx: any, ri: number) =>
            (rx.drugs || []).map((d: any, di: number) => ({
              id: `${ri}-${di}`,
              name: d.name || d,
              frequency: d.frequency || rx.notes || "As directed",
              purpose: rx.diagnosis || "Treatment",
            })),
          ),
        ),
      )
      .catch(() => {});
    getLabs(patientDid)
      .then((r) =>
        setRecentLabReports(
          (r.labs || []).map((l: any) => ({
            id: l.labId,
            test: l.testName || l.tests?.join(", ") || "Lab Test",
            date: l.completedAt?.split("T")[0] ?? "—",
            result: l.results?.[0]
              ? `${l.results[0].parameter}: ${l.results[0].value} ${l.results[0].unit}`
              : "Pending",
            status: l.status ?? "Pending",
          })),
        ),
      )
      .catch(() => {});
  }, [patientDid]);

  // ── doctor list from API ─────────────────────────────────────────────────
  const allDoctors = useMemo(
    () =>
      (doctorsData?.doctors ?? []).map((d: any) => ({
        id: d.did,
        did: d.did,
        name: d.name,
        specialty: d.specialty ?? "General Medicine",
        hospital: d.hospital ?? "Embrace Health Grid · OPD Block",
        status: (d.status ?? "Available") as "Available" | "Busy" | "Off Duty",
        rating: d.rating ?? 4.5,
      })),
    [doctorsData],
  );

  // ── appointment list ──────────────────────────────────────────────────────
  const appointments = useMemo(
    () =>
      (apptData?.appointments ?? []).map((a: any) => ({
        id: a.apptId ?? a.appt_id ?? a.id,
        doctor: a.doctorName ?? a.doctor_name ?? "Doctor",
        specialty: a.specialty ?? "General Medicine",
        hospital: a.mode === "tele" ? "Telehealth Link" : "Embrace Health Grid",
        date: a.date ?? a.slot?.split(" · ")[0] ?? "—",
        slot: a.slot ?? "—",
        status: a.status ?? "pending",
        mode: (a.mode ?? "in-person") as "in-person" | "tele",
        reason: a.reason ?? "",
        suggestedSlot: a.suggestedSlot ?? a.suggested_slot ?? null,
        notes: a.notes ?? "",
        bookedAt: a.bookedAt ?? a.booked_at ?? null,
      })),
    [apptData],
  );

  const upcoming = appointments.filter(
    (a) =>
      !["cancelled", "rejected"].includes(a.status) && new Date(a.date) >= new Date().setHours(0, 0, 0, 0)
  );
  const pending = appointments.filter((a) => a.status === "pending");
  const confirmed = appointments.filter((a) => a.status === "confirmed");
  const past = appointments.filter(
    (a) =>
      ["cancelled", "rejected", "completed"].includes(a.status) || new Date(a.date) < new Date().setHours(0, 0, 0, 0)
  );
  const active = appointments.filter((a) => !["cancelled", "rejected", "completed"].includes(a.status));

  // ── search / filter ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [appointmentTab, setAppointmentTab] = useState<"upcoming" | "past">("upcoming");

  const filteredDoctors = useMemo(
    () =>
      allDoctors.filter((d) => {
        const q = searchQuery.toLowerCase();
        return (
          (d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q)) &&
          (selectedSpecialty === "All" || d.specialty === selectedSpecialty)
        );
      }),
    [allDoctors, searchQuery, selectedSpecialty],
  );

  // ── booking modal state ───────────────────────────────────────────────────
  const [selectedDoc, setSelectedDoc] = useState<(typeof allDoctors)[0] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [consultMode, setConsultMode] = useState<"in-person" | "tele">("in-person");
  const [reason, setReason] = useState("");
  const [grantConsent, setGrantConsent] = useState(true);
  const [booking, setBooking] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // calendar pages (show 7 dates at a time)
  const [datePageStart, setDatePageStart] = useState(0);
  const availableDates = getAvailableDates(28);
  const visibleDates = availableDates.slice(datePageStart, datePageStart + 7);

  // ── emergency modal ───────────────────────────────────────────────────────
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  // ── notification preview ──────────────────────────────────────────────────
  const [notifChannels, setNotifChannels] = useState({ sms: true, email: true, whatsapp: true });
  const [notifMsg, setNotifMsg] = useState("");
  const [showNotif, setShowNotif] = useState(false);

  // ── actions ───────────────────────────────────────────────────────────────
  const openBooking = (doc: (typeof allDoctors)[0]) => {
    setSelectedDoc(doc);
    setSelectedDate(availableDates[0]);
    setSelectedSlot("");
    setReason("");
    setDatePageStart(0);
    // Fetch booked slots for this doctor
    setLoadingSlots(true);
    getBookedSlots(doc.did)
      .then((res) => setBookedSlots(res.bookedSlots))
      .catch(() => setBookedSlots([]))
      .finally(() => setLoadingSlots(false));
  };

  const confirmBooking = async () => {
    if (!selectedDoc || !selectedDate || !selectedSlot) return;
    setBooking(true);
    // Format: "2026-08-20 · Wed · 10:00 AM" - date first, then day name, then time
    const slotStr = `${selectedDate} · ${new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "short" })} · ${selectedSlot}`;
    try {
      await bookAppointment({
        patientDid: currentUser?.did ?? "did:hosp:unknown",
        patientName: currentUser?.name ?? "Patient",
        doctorDid: selectedDoc.did,
        doctorName: selectedDoc.name,
        slot: slotStr,
        mode: consultMode,
        specialty: selectedDoc.specialty,
        reason,
        consentGranted: grantConsent,
      });
      toast.success("Appointment request sent", {
        description: `${selectedDate} at ${selectedSlot} — awaiting doctor confirmation.`,
      });
      setNotifMsg(
        `Appointment request sent to ${selectedDoc.name} for ${selectedDate} at ${selectedSlot}.`,
      );
      setShowNotif(true);
      refetchAppts();
    } catch (err: any) {
      toast.error("Booking failed", { description: err.message });
    } finally {
      setBooking(false);
      setSelectedDoc(null);
    }
  };

  const cancelAppt = async (id: string) => {
    try {
      await updateAppointmentStatus(id, "cancelled");
      toast.success("Appointment cancelled");
      refetchAppts();
    } catch (err: any) {
      toast.error("Could not cancel", { description: err.message });
    }
  };

  const triggerEmergency = async () => {
    const erDoc = allDoctors.find((d) => d.specialty === "Emergency Medicine") ?? allDoctors[0];
    if (!erDoc) {
      toast.error("No emergency doctor available");
      return;
    }
    try {
      const todayDate = new Date().toISOString().split("T")[0];
      const todayDay = new Date().toLocaleDateString("en-IN", { weekday: "short" });
      await bookAppointment({
        patientDid: currentUser?.did ?? "did:hosp:unknown",
        patientName: currentUser?.name ?? "Patient",
        doctorDid: erDoc.did,
        doctorName: erDoc.name,
        slot: `${todayDate} · ${todayDay} · Immediate Triage`,
        mode: "in-person",
        specialty: "Emergency Medicine",
        reason: "Emergency triage",
      });
      toast.error("Emergency consult requested — report to ER desk immediately.");
      refetchAppts();
    } catch (err: any) {
      toast.error("Emergency request failed", { description: err.message });
    }
    setShowEmergencyModal(false);
  };

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-4">
          <PageHeader
            eyebrow="Patient app"
            title="Consultation & Visits"
            description="Book appointments with DID-verified doctors. Requests are sent for doctor approval."
          />
          <button
            onClick={() => setShowEmergencyModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 shadow-clinical active:scale-95 transition-all"
          >
            <ShieldAlert className="h-4 w-4" /> Emergency Request
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Main column ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search & Filter */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-clinical space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Book an Appointment</span>
                <span className="text-xs text-muted-foreground">
                  {doctorsLoading ? "Loading…" : `${filteredDoctors.length} verified doctors`}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Search doctor or specialty…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {SPECIALTIES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSpecialty(s)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                      selectedSpecialty === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-muted"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Doctor Grid */}
            {doctorsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-40 animate-pulse rounded-xl border border-border bg-muted"
                  />
                ))}
              </div>
            ) : filteredDoctors.length === 0 ? (
              <EmptyState
                icon={User}
                title="No verified doctors found"
                description="Only doctors with an active DID issued by admin appear here. Ask the administrator to issue a DID."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredDoctors.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-xl border border-border bg-card p-4 shadow-clinical flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary uppercase tracking-wide">
                          {doc.specialty}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            doc.status === "Available"
                              ? "bg-success/15 text-success"
                              : "bg-warning/15 text-warning-foreground"
                          }`}
                        >
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${doc.status === "Available" ? "bg-success" : "bg-warning"}`}
                          />
                          {doc.status}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-foreground mt-1">{doc.name}</h3>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
                        {doc.did}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{doc.hospital}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs font-semibold text-yellow-500">
                        ★ {doc.rating} · DID Verified
                      </span>
                      <button
                        onClick={() => openBooking(doc)}
                        className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/25 transition-colors"
                      >
                        Book
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* My Appointments Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  My Appointments
                </h2>
                <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
                  <button
                    onClick={() => setAppointmentTab("upcoming")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                      appointmentTab === "upcoming"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Upcoming ({upcoming.length})
                  </button>
                  <button
                    onClick={() => setAppointmentTab("past")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                      appointmentTab === "past"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    History ({past.length})
                  </button>
                </div>
              </div>

              {/* Appointment Stats */}
              {appointmentTab === "upcoming" && upcoming.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Pending Approval</div>
                    <div className="text-lg font-bold text-warning-foreground">{pending.length}</div>
                  </div>
                  <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Confirmed</div>
                    <div className="text-lg font-bold text-success">{confirmed.length}</div>
                  </div>
                </div>
              )}

              {/* Upcoming Appointments */}
              {appointmentTab === "upcoming" && (
                <>
                  {upcoming.length === 0 ? (
                    <EmptyState
                      icon={CalendarDays}
                      title="No upcoming appointments"
                      description="Book a consultation above to schedule your first appointment."
                    />
                  ) : (
                    <StaggerList className="grid gap-4 sm:grid-cols-2">
                      {upcoming.map((a) => {
                        const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.pending;
                        const Icon = cfg.icon;
                        return (
                          <StaggerItem key={a.id}>
                            <div className="rounded-xl border border-border bg-card p-4 shadow-clinical space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="font-semibold text-foreground">{a.doctor}</div>
                                  <div className="text-xs text-muted-foreground">{a.specialty}</div>
                                </div>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.cls}`}
                                >
                                  <Icon className="h-3 w-3" /> {cfg.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-primary shrink-0" />
                                <span className="font-semibold">{a.slot}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {a.mode === "tele" ? (
                                  <>
                                    <Video className="h-3.5 w-3.5" />
                                    <span>Telehealth</span>
                                  </>
                                ) : (
                                  <>
                                    <MapPin className="h-3.5 w-3.5" />
                                    <span>In-Person</span>
                                  </>
                                )}
                              </div>
                              {a.reason && (
                                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                                  <strong>Reason:</strong> {a.reason}
                                </p>
                              )}
                              {a.status === "pending" && (
                                <p className="text-xs text-warning-foreground bg-warning/10 rounded-lg px-3 py-2 flex items-center gap-2">
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                  Waiting for the doctor to accept this request.
                                </p>
                              )}
                              {a.status === "confirmed" && (
                                <p className="text-xs text-success bg-success/10 rounded-lg px-3 py-2 flex items-center gap-2">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                  Confirmed! See you on {a.date}.
                                </p>
                              )}
                              {a.status === "suggested" && a.suggestedSlot && (
                                <p className="text-xs text-primary bg-primary/10 rounded-lg px-3 py-2">
                                  <strong>New Time Suggested:</strong> {a.suggestedSlot}
                                </p>
                              )}
                              {a.notes && (
                                <p className="text-xs text-muted-foreground italic bg-muted/30 rounded-lg px-3 py-2">
                                  <strong>Note from doctor:</strong> "{a.notes}"
                                </p>
                              )}
                              <div className="flex gap-2 pt-1 border-t border-border">
                                {["pending", "confirmed"].includes(a.status) && (
                                  <button
                                    onClick={() => cancelAppt(a.id)}
                                    className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                                  >
                                    Cancel
                                  </button>
                                )}
                                {a.status === "confirmed" && a.mode === "tele" && (
                                  <button className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-success text-success-foreground py-2 text-xs font-bold hover:bg-success/90">
                                    <Video className="h-3.5 w-3.5" /> Launch Telehealth
                                  </button>
                                )}
                                {a.status === "confirmed" && a.mode === "in-person" && (
                                  <Link
                                    to="/patient/qr"
                                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                                  >
                                    Check-in QR
                                  </Link>
                                )}
                              </div>
                            </div>
                          </StaggerItem>
                        );
                      })}
                    </StaggerList>
                  )}
                </>
              )}

              {/* Past Appointments */}
              {appointmentTab === "past" && (
                <>
                  {past.length === 0 ? (
                    <EmptyState
                      icon={CalendarDays}
                      title="No appointment history"
                      description="Your past and cancelled appointments will appear here."
                    />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {past.map((a) => {
                        const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.cancelled;
                        const Icon = cfg.icon;
                        return (
                          <div
                            key={a.id}
                            className="rounded-xl border border-border bg-card p-4 space-y-2"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-medium text-foreground">{a.doctor}</div>
                                <div className="text-xs text-muted-foreground">{a.specialty}</div>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.cls}`}
                              >
                                <Icon className="h-3 w-3" /> {cfg.label}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {a.slot}
                            </div>
                            {a.mode === "tele" ? (
                              <div className="text-xs text-muted-foreground">
                                <Video className="h-3 w-3 inline mr-1" />
                                Telehealth
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 inline mr-1" />
                                In-Person
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Sidebar ──────────────────────────────────────────────────── */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <User className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Health Overview</h3>
              </div>

              {/* Medical History */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                  Conditions
                </span>
                {medicalHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No records found.</p>
                ) : (
                  medicalHistory.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg bg-muted/60 p-2 text-xs border border-border"
                    >
                      <div className="flex justify-between">
                        <span className="font-semibold text-foreground">{item.condition}</span>
                        <span className="text-muted-foreground">{item.date}</span>
                      </div>
                      <div className="text-muted-foreground">Dr. {item.doctor}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Medications */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block flex items-center gap-1">
                  <Pill className="h-3 w-3 text-primary" /> Medications
                </span>
                {currentMedications.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No active medications.</p>
                ) : (
                  currentMedications.slice(0, 3).map((m) => (
                    <div
                      key={m.id}
                      className="flex justify-between items-center rounded-lg bg-primary/5 p-2 text-xs border border-primary/20"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{m.name}</div>
                        <div className="text-[10px] text-muted-foreground">{m.frequency}</div>
                      </div>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                        {m.purpose}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Lab Reports */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block flex items-center gap-1">
                  <FlaskConical className="h-3 w-3 text-primary" /> Labs
                </span>
                {recentLabReports.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No recent labs.</p>
                ) : (
                  recentLabReports.slice(0, 3).map((l) => (
                    <div
                      key={l.id}
                      className="rounded-lg bg-muted/60 p-2 text-xs border border-border flex justify-between"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{l.test}</div>
                        <div className="text-[9px] text-muted-foreground">{l.date}</div>
                      </div>
                      <span className="text-[9px] text-success font-semibold">{l.status}</span>
                    </div>
                  ))
                )}
              </div>

              <Link
                to="/patient/records"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <ClipboardList className="h-3.5 w-3.5 text-primary" /> Full Medical File
              </Link>
            </div>

            {/* Notification settings */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Reminder Channels</h3>
              </div>
              {(["whatsapp", "sms", "email"] as const).map((ch) => {
                const meta = {
                  whatsapp: { label: "WhatsApp", icon: MessageSquare },
                  sms: { label: "SMS", icon: Phone },
                  email: { label: "Email", icon: Mail },
                }[ch];
                return (
                  <div key={ch} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <meta.icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{meta.label}</span>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={notifChannels[ch]}
                        onChange={(e) =>
                          setNotifChannels((p) => ({ ...p, [ch]: e.target.checked }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Booking Modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 backdrop-blur-sm p-4"
            onClick={() => setSelectedDoc(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-clinical-md overflow-y-auto max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">Schedule Consultation</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedDoc.name} · {selectedDoc.specialty}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Consultation mode */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">
                    Consultation Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["in-person", "tele"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setConsultMode(m)}
                        className={`flex flex-col items-center gap-1 rounded-xl p-3 border text-center transition-all ${consultMode === m ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted text-muted-foreground"}`}
                      >
                        {m === "in-person" ? (
                          <MapPin className="h-5 w-5" />
                        ) : (
                          <Video className="h-5 w-5" />
                        )}
                        <span className="text-xs font-semibold">
                          {m === "in-person" ? "In-Person" : "Telehealth"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date picker — min tomorrow */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">
                    Select Date{" "}
                    <span className="text-[10px] font-normal">(earliest: tomorrow)</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDatePageStart((p) => Math.max(0, p - 7))}
                      disabled={datePageStart === 0}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex flex-1 gap-1 overflow-hidden">
                      {visibleDates.map((d) => {
                        const dt = new Date(d);
                        const day = dt.toLocaleDateString("en-IN", { weekday: "short" });
                        const num = dt.getDate();
                        return (
                          <button
                            key={d}
                            onClick={() => {
                              setSelectedDate(d);
                              setSelectedSlot("");
                            }}
                            className={`flex-1 flex flex-col items-center rounded-lg py-2 text-center border transition-all ${selectedDate === d ? "border-primary bg-primary/5 text-primary font-bold" : "border-border hover:bg-muted text-muted-foreground"}`}
                          >
                            <span className="text-[9px] uppercase font-bold">{day}</span>
                            <span className="text-sm">{num}</span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() =>
                        setDatePageStart((p) => Math.min(availableDates.length - 7, p + 7))
                      }
                      disabled={datePageStart >= availableDates.length - 7}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Time slots */}
                {selectedDate && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">
                      Available Time Slots
                      {loadingSlots && (
                        <span className="ml-2 text-[10px] font-normal text-primary">
                          Checking availability...
                        </span>
                      )}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {TIME_SLOTS.map((timeSlot) => {
                        // Check if this slot is already booked for the selected date
                        // Booked slot format: "2026-08-20 · Wed · 10:00 AM"
                        const dayName = new Date(selectedDate).toLocaleDateString("en-IN", {
                          weekday: "short",
                        });
                        const fullSlotStr = `${selectedDate} · ${dayName} · ${timeSlot}`;
                        const isBooked = bookedSlots.includes(fullSlotStr);

                        return (
                          <button
                            key={timeSlot}
                            onClick={() => !isBooked && setSelectedSlot(timeSlot)}
                            disabled={isBooked}
                            className={`p-2 rounded-lg border text-xs font-medium transition-all relative ${
                              isBooked
                                ? "bg-muted text-muted-foreground border-muted cursor-not-allowed opacity-50"
                                : selectedSlot === timeSlot
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border hover:bg-muted text-foreground"
                            }`}
                            title={isBooked ? "This slot is already booked" : ""}
                          >
                            {timeSlot}
                            {isBooked && (
                              <span className="absolute top-0.5 right-0.5 text-[8px] font-bold text-destructive">
                                ✕
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {bookedSlots.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                        <Info className="h-3 w-3 text-primary" />
                        Slots marked with ✕ are already booked and unavailable.
                      </p>
                    )}
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">
                    Reason for Visit <span className="text-[10px] font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Describe your symptoms or reason for the visit…"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>

                {/* Consent toggle */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-foreground">
                      Grant On-Chain Prescription Access
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Allows {selectedDoc.name} to view your prescription history for this visit.
                      Expires in 24 h.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center shrink-0">
                    <input
                      type="checkbox"
                      checked={grantConsent}
                      onChange={(e) => setGrantConsent(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border after:rounded-full after:h-4 after:w-4 after:transition-all" />
                  </label>
                </div>

                {/* Info banner */}
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                  Your request will be sent to the doctor as <strong>Pending</strong>. It becomes{" "}
                  <strong>Confirmed</strong> only after the doctor accepts.
                </div>
              </div>

              <div className="mt-5 flex gap-2 border-t border-border pt-4">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBooking}
                  disabled={!selectedDate || !selectedSlot || booking}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  {booking ? "Sending…" : "Send Appointment Request"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Emergency Modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showEmergencyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-destructive/20 backdrop-blur-sm p-4"
            onClick={() => setShowEmergencyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border-2 border-destructive bg-card p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive animate-pulse">
                  <ShieldAlert className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Request Emergency Consult?</h3>
                <p className="text-xs text-muted-foreground px-4">
                  This issues an immediate trauma-level triage request. Use only for clinical
                  emergencies.
                </p>
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setShowEmergencyModal(false)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={triggerEmergency}
                  className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground hover:bg-destructive/95"
                >
                  Confirm Emergency Triage
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Notification preview toast ────────────────────────────────────── */}
      <AnimatePresence>
        {showNotif && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-success/30 bg-success/10 p-3 shadow-lg flex gap-2.5 items-start"
          >
            <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="text-xs font-bold text-foreground">Request Sent</span>
                <button onClick={() => setShowNotif(false)} className="text-muted-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
              <p className="text-[11px] text-foreground/80 mt-1">{notifMsg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}
