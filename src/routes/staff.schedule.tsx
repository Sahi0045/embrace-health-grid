import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { useState, useEffect } from "react";
import { getStaffSchedule, createStaffRequest, updateAppointmentStatus, getDoctors, createPrescription, createMedicalRecord } from "@/lib/api";
import { useAppointments } from "@/hooks/use-api";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { stagger, fadeUp } from "@/components/Motion";
import {
  Calendar, Clock, MapPin, Stethoscope, Plane, ChevronLeft, ChevronRight,
  Users, Video, Scissors, Heart, PlusCircle, Check, AlertCircle, Moon, Sun, X, ClipboardList, Pill, FileText
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export const Route = createFileRoute("/staff/schedule")({
  head: () => ({ meta: [{ title: "Staff · Schedule — Embrace Health Grid" }] }),
  component: SchedulePage,
});

type ShiftType = "OPD" | "Ward rounds" | "Surgery" | "On-call" | "ICU" | "Emergency" | "Telemedicine" | "Off" | "Leave";

interface Shift {
  id: string;
  day: string;
  date: string;
  role: ShiftType;
  start: string;
  end: string;
  unit: string;
  patients?: number;
  notes?: string;
  confirmed: boolean;
}

// Dynamic shifts loaded from staff schedule API

const upcoming = [
  { date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], label: "Grand Rounds — Cardiology", type: "meeting" },
  { date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], label: "CME: Heart Failure 2026", type: "education" },
  { date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], label: "On-Call (weekend)", type: "on-call" },
];

const shiftConfig: Record<ShiftType, { bg: string; text: string; border: string; icon: React.ComponentType<{className?: string}>; accent: string }> = {
  "OPD":         { bg: "bg-primary/10",      text: "text-primary",          border: "border-primary/30",       icon: Stethoscope, accent: "bg-primary" },
  "Ward rounds": { bg: "bg-success/10",      text: "text-success",          border: "border-success/30",       icon: Heart,       accent: "bg-success" },
  "Surgery":     { bg: "bg-warning/15",      text: "text-warning-foreground", border: "border-warning/30",     icon: Scissors,    accent: "bg-yellow-500" },
  "On-call":     { bg: "bg-destructive/8",   text: "text-destructive",       border: "border-destructive/30",  icon: AlertCircle, accent: "bg-destructive" },
  "ICU":         { bg: "bg-chart-2/10",      text: "text-chart-2",          border: "border-chart-2/30",       icon: Heart,       accent: "bg-chart-2" },
  "Emergency":   { bg: "bg-destructive/12",  text: "text-destructive",       border: "border-destructive/40",  icon: AlertCircle, accent: "bg-destructive" },
  "Telemedicine":{ bg: "bg-chart-4/10",      text: "text-chart-4",          border: "border-chart-4/30",       icon: Video,       accent: "bg-chart-4" },
  "Off":         { bg: "bg-muted",           text: "text-muted-foreground",  border: "border-border",           icon: Moon,        accent: "bg-muted-foreground" },
  "Leave":       { bg: "bg-chart-3/10",      text: "text-chart-3",          border: "border-chart-3/30",       icon: Sun,         accent: "bg-chart-3" },
};

function ShiftCard({ shift }: { shift: Shift }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = shiftConfig[shift.role];
  const Icon = cfg.icon;
  const isOff = shift.role === "Off" || shift.role === "Leave";
  const isNight = shift.role === "On-call";

  return (
    <motion.div variants={fadeUp} className={`rounded-xl border p-4 transition-all cursor-pointer ${cfg.bg} ${cfg.border} ${expanded ? "shadow-md" : ""}`} onClick={() => setExpanded(!expanded)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/60 ${cfg.text}`}>
            <Icon className="h-4 w-4" />
            {isNight && <Moon className="h-2.5 w-2.5 absolute translate-x-2 -translate-y-2" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${cfg.text}`}>{shift.role}</span>
              {shift.confirmed && <Check className="h-3.5 w-3.5 text-success" />}
            </div>
            <div className="text-xs text-foreground font-medium">{shift.unit}</div>
            {!isOff && (
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{shift.start} – {shift.end}</span>
                {shift.patients !== undefined && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{shift.patients} patients</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-medium text-muted-foreground">{shift.date.slice(5)}</span>
          {!isOff && (
            <div className={`h-1.5 w-16 rounded-full overflow-hidden bg-background/60`}>
              <div className={`h-full ${cfg.accent} opacity-60`} style={{ width: isNight ? "100%" : "70%" }} />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && shift.notes && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className={`mt-3 rounded-lg border ${cfg.border} bg-background/60 px-3 py-2.5`}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
              <div className="text-xs text-foreground">{shift.notes}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SchedulePage() {
  const [view, setView] = useState<"week" | "day">("week");
  const [weekShifts, setWeekShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUser = getCurrentUser();
  const staffEmail = currentUser?.email || "";

  const { data: apptsData, refetch: refetchAppts } = useAppointments();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [apptFilter, setApptFilter] = useState<"all" | "my">("all");

  const handleApptAction = async (apptId: string, status: "confirmed" | "declined") => {
    setActionLoadingId(apptId);
    try {
      await updateAppointmentStatus(apptId, status);
      toast.success(
        status === "confirmed" ? "Appointment confirmed!" : "Appointment declined",
        {
          description:
            status === "confirmed"
              ? "Consent access granted to patient's prescription ledger."
              : "Patient has been notified.",
        }
      );
      refetchAppts();
    } catch (err: any) {
      toast.error("Failed to update appointment", { description: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isShiftOpen, setIsShiftOpen] = useState(false);

  // Leave Form states
  const [leaveType, setLeaveType] = useState("Casual");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // Shift Form states
  const [shiftDate, setShiftDate] = useState("");
  const [reqShiftType, setReqShiftType] = useState("OPD");
  const [shiftUnit, setShiftUnit] = useState("OPD Block A");
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);

  // Prescription & Medical Record Form States
  const [activeRxAppt, setActiveRxAppt] = useState<any | null>(null);
  const [rxDiagnosis, setRxDiagnosis] = useState("OPD Consultation");
  const [rxMedName, setRxMedName] = useState("Metformin");
  const [rxDosage, setRxDosage] = useState("500mg");
  const [rxFrequency, setRxFrequency] = useState("Twice daily with meals");
  const [rxDuration, setRxDuration] = useState("14 days");
  const [rxNotes, setRxNotes] = useState("Take after food.");
  const [recordTitle, setRecordTitle] = useState("Clinical Summary Report");
  const [recordType, setRecordType] = useState("consultation-summary");
  const [clinicalSummary, setClinicalSummary] = useState("Patient evaluated via OPD consultation. Vitals stable. Prescribed daily medications.");
  const [isSubmittingRx, setIsSubmittingRx] = useState(false);

  const handleIssueRxAndRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRxAppt) return;
    const patientDid = activeRxAppt.patientDid || "did:hosp:unknown";
    setIsSubmittingRx(true);

    try {
      await createPrescription({
        patientDid,
        doctorDid: selectedDoctor.did,
        signedBy: selectedDoctor.name,
        diagnosis: rxDiagnosis,
        notes: rxNotes,
        drugs: [
          {
            name: `${rxMedName} ${rxDosage}`,
            dose: rxDosage,
            frequency: rxFrequency,
            duration: rxDuration,
            instructions: rxNotes,
          },
        ],
      });

      await createMedicalRecord(patientDid, {
        title: recordTitle,
        type: recordType,
        content: clinicalSummary,
        doctorDid: selectedDoctor.did,
        doctorName: selectedDoctor.name,
      });

      const apptId = activeRxAppt.apptId || activeRxAppt.id;
      if (apptId) {
        await updateAppointmentStatus(apptId, "completed");
      }

      toast.success("Prescription & Medical Record Issued!", {
        description: `Signed by ${selectedDoctor.name} and synced to Patient Portal.`,
      });

      setActiveRxAppt(null);
      refetchAppts();
    } catch (err: any) {
      toast.error("Failed to issue prescription & medical record", { description: err.message });
    } finally {
      setIsSubmittingRx(false);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveFrom || !leaveTo || !leaveReason) {
      toast.error("Please fill in all leave request fields.");
      return;
    }
    setIsSubmittingLeave(true);
    try {
      await createStaffRequest({
        requestType: "leave",
        leaveType,
        fromDate: leaveFrom,
        toDate: leaveTo,
        reason: leaveReason,
      });
      toast.success("Leave request submitted successfully", { description: "You will be notified once approved." });
      setIsLeaveOpen(false);
      setLeaveFrom("");
      setLeaveTo("");
      setLeaveReason("");
    } catch (err: any) {
      toast.error("Failed to submit leave request", { description: err.message });
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftDate || !shiftUnit) {
      toast.error("Please fill in all shift request fields.");
      return;
    }
    setIsSubmittingShift(true);
    try {
      await createStaffRequest({
        requestType: "shift",
        shiftDate,
        shiftType: reqShiftType,
        unit: shiftUnit,
      });
      toast.success("Add shift request submitted", { description: "Request sent to clinical coordinator." });
      setIsShiftOpen(false);
      setShiftDate("");
      setShiftUnit("OPD Block A");
    } catch (err: any) {
      toast.error("Failed to submit shift request", { description: err.message });
    } finally {
      setIsSubmittingShift(false);
    }
  };


  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [selectedDoctorDid, setSelectedDoctorDid] = useState<string>("");

  useEffect(() => {
    getDoctors()
      .then((res) => {
        const docs = res.doctors || [];
        setDoctorsList(docs);
        if (docs.length > 0) {
          const myDid = currentUser?.did;
          const matched = docs.find((d: any) => (myDid && d.did === myDid) || (currentUser?.email && d.email === currentUser.email));
          setSelectedDoctorDid(matched ? matched.did : docs[0].did);
        }
      })
      .catch((err) => console.warn("Failed to fetch doctors list:", err));
  }, []);

  const selectedDoctor = doctorsList.find((d: any) => d.did === selectedDoctorDid) || {
    did: currentUser?.did || "did:hosp:unknown",
    name: currentUser?.name || "Clinician",
    email: staffEmail,
    department: currentUser?.department || "OPD Department",
    specialty: "General Medicine",
  };

  useEffect(() => {
    const targetEmail = selectedDoctor.email || staffEmail;
    if (!targetEmail) {
      setLoading(false);
      return;
    }
    getStaffSchedule(targetEmail)
      .then((res) => {
        setWeekShifts(res.schedule || []);
      })
      .catch((err) => console.error("Error loading schedule:", err))
      .finally(() => setLoading(false));
  }, [selectedDoctor.email, staffEmail]);

  const today = new Date();
  const dayOfWeek = today.getDay();
  const initialDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(initialDayIndex);

  const distanceToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + distanceToMon);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const monthYearLabel = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const weekRangeLabel = `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const scheduledShifts = weekShifts.filter(s => s.role !== "Off" && s.role !== "Leave" && s.start !== "—");
  const totalMinutes = scheduledShifts.reduce((acc, s) => {
    const [sh, sm] = s.start.split(":").map(Number);
    const [eh, em] = s.end.split(":").map(Number);
    let d = (eh * 60 + em) - (sh * 60 + sm);
    if (d < 0) d += 24 * 60;
    return acc + d;
  }, 0);
  const totalHours = Math.round(totalMinutes / 60);

  const selectedDayName = days[selectedDayIdx];
  const selectedDayDateObj = new Date(monday);
  selectedDayDateObj.setDate(monday.getDate() + selectedDayIdx);
  const selectedDateStr = selectedDayDateObj.toISOString().split("T")[0];

  const activeShiftsToDisplay = view === "day"
    ? weekShifts.filter(s => s.day === selectedDayName || s.date === selectedDateStr)
    : weekShifts;

  const rawAppts = apptsData?.appointments || [];

  // Filter appointments specifically for the selected doctor
  const displayAppts = rawAppts.filter((a: any) => {
    if (!selectedDoctor) return true;
    const matchDid = selectedDoctor.did && a.doctorDid === selectedDoctor.did;
    const matchEmail = selectedDoctor.email && a.doctorEmail === selectedDoctor.email;
    const matchName = selectedDoctor.name && (
      (a.doctorName && a.doctorName.toLowerCase().includes(selectedDoctor.name.toLowerCase())) ||
      (a.doctor && a.doctor.toLowerCase().includes(selectedDoctor.name.toLowerCase()))
    );
    return matchDid || matchEmail || matchName;
  });

  const activeDoctorAppts = displayAppts.filter((a: any) => a.status === "pending" || a.status === "upcoming" || a.status === "confirmed");

  const selectedDayAppts = activeDoctorAppts.filter((a: any) => {
    if (view !== "day") return true;
    if (!a.slot && !a.date) return true;
    return (
      a.date === selectedDateStr ||
      a.slot?.includes(selectedDayName) ||
      a.slot?.includes(selectedDateStr)
    );
  });

  const historyAppts = displayAppts.filter((a: any) => a.status === "confirmed" || a.status === "declined" || a.status === "completed");

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Clinician Schedule"
        title={weekRangeLabel}
        description={`Schedule & Appointments for ${selectedDoctor.name} (${selectedDoctor.specialty || selectedDoctor.department || "OPD"})`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {doctorsList.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 shadow-sm">
                <Stethoscope className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">Doctor:</span>
                <select
                  value={selectedDoctorDid}
                  onChange={(e) => setSelectedDoctorDid(e.target.value)}
                  className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer"
                >
                  {doctorsList.map((doc: any) => (
                    <option key={doc.did} value={doc.did} className="bg-card text-foreground">
                      {doc.name} ({doc.specialty || doc.department || "OPD"})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["week", "day"] as const).map(v => (
                <button key={v} onClick={() => setView(v)} className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${view === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>{v}</button>
              ))}
            </div>
            <button
              onClick={() => setIsLeaveOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Plane className="h-4 w-4" /> Request Leave
            </button>
            <button
              onClick={() => setIsShiftOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <PlusCircle className="h-4 w-4" /> Add Shift
            </button>
          </div>
        }
      />


      <div className="space-y-6 p-6 sm:p-8">
        {/* Stats */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-4">
          <StatCard label="Scheduled Hours" value={`${totalHours}h`} delta="across this week" icon={Clock} />
          <StatCard label="Patients This Week" value={weekShifts.reduce((s, sh) => s + (sh.patients ?? 0), 0) + displayAppts.length} delta="OPD + Patient bookings" icon={Users} />
          <StatCard label="On-Call Shifts" value={weekShifts.filter(s => s.role === "On-call").length || 1} delta="Emergency coverage" icon={AlertCircle} tone="warning" />
          <StatCard label="Days Off / Leave" value={weekShifts.filter(s => s.role === "Off" || s.role === "Leave").length || 1} delta="Scheduled rest" icon={Moon} tone="success" />
        </motion.div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => toast.info("Navigating to previous week...", { description: "Viewing historical schedule." })}
            className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" /> Prev Week
          </button>
          <div className="text-sm font-semibold text-foreground">{monthYearLabel}</div>
          <button
            onClick={() => toast.info("Navigating to next week...", { description: "Schedule is currently tentative." })}
            className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            Next Week <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, i) => {
            const currentDayDate = new Date(monday);
            currentDayDate.setDate(monday.getDate() + i);
            const dateNum = currentDayDate.getDate();
            const dateStr = currentDayDate.toISOString().split("T")[0];
            const dayShifts = weekShifts.filter(s => s.day === day || s.date === dateStr);
            const isToday = currentDayDate.toDateString() === today.toDateString();
            const isSelected = i === selectedDayIdx;
            return (
              <div
                key={day}
                onClick={() => {
                  setSelectedDayIdx(i);
                }}
                className={`rounded-xl border p-3 text-center transition-all cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/15 shadow-clinical ring-2 ring-primary/60"
                    : isToday
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-card hover:bg-muted/60"
                }`}
              >
                <div className={`text-xs font-medium uppercase tracking-wide ${isSelected || isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>{day}</div>
                <div className={`text-lg font-bold mt-0.5 ${isSelected || isToday ? "text-primary" : "text-foreground"}`}>{dateNum}</div>
                <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                  {dayShifts.map(s => {
                    const cfg = shiftConfig[s.role];
                    return (
                      <div key={s.id} className={`h-1.5 w-4 rounded-full ${cfg.accent} opacity-70`} title={s.role} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Shift cards */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {view === "day"
                ? `Shifts for ${selectedDayName}, ${selectedDayDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : "This Week's Shifts"}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              Click any day box above to view daily details
            </span>
          </div>
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
            {activeShiftsToDisplay.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
                No shifts scheduled for {selectedDayName}, {selectedDayDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.
              </div>
            ) : (
              activeShiftsToDisplay.map(s => <ShiftCard key={s.id} shift={s} />)
            )}
          </motion.div>
        </div>

        {/* Incoming Patient Appointments */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Stethoscope className="h-4 w-4 text-primary" />
              Incoming Patient Appointments {view === "day" ? `for ${selectedDayName}, ${selectedDayDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""} ({selectedDayAppts.length})
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs">
                <button
                  onClick={() => setApptFilter("all")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${apptFilter === "all" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  All Requests ({rawAppts.length})
                </button>
                <button
                  onClick={() => setApptFilter("my")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${apptFilter === "my" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Assigned to Me
                </button>
              </div>
            </div>
          </div>

          {selectedDayAppts.length === 0 ? (
            <div className="rounded-lg bg-muted/40 p-4 text-center text-xs text-muted-foreground">
              {apptFilter === "my" ? "No incoming appointment bookings assigned specifically to your doctor DID." : `No patient appointment bookings found ${view === "day" ? `for ${selectedDayName}` : ""}.`}
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayAppts.map((a: any) => {
                const apptId = a.apptId || a.id;
                const isPending = a.status === "pending" || a.status === "upcoming";
                const isConfirmed = a.status === "confirmed";
                const isDeclined = a.status === "declined";

                return (
                  <div
                    key={apptId}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3.5"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {a.patientName || "Patient"}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isConfirmed
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : isDeclined
                              ? "bg-destructive/10 text-destructive border border-destructive/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse"
                          }`}
                        >
                          {isConfirmed ? "Confirmed" : isDeclined ? "Declined" : "Pending Confirmation"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                        <span><Clock className="inline h-3 w-3 mr-1" />{a.slot || "Thu · 10:30 AM"}</span>
                        <span>•</span>
                        <span>{a.specialty || "General Medicine"}</span>
                        <span>•</span>
                        <span className="capitalize">{a.mode || "in-person"}</span>
                      </div>
                      {a.doctorName && (
                        <div className="text-[11px] font-mono text-muted-foreground/80">
                          Doctor: {a.doctorName} ({a.doctorDid ? a.doctorDid.slice(0, 16) + "..." : "DID"})
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                      {isConfirmed && (
                        <button
                          onClick={() => {
                            setActiveRxAppt(a);
                            setRxDiagnosis(`${a.specialty || "General Medicine"} Consultation`);
                            setRecordTitle(`${a.specialty || "Clinical"} Consultation Summary`);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 dark:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors shadow-sm"
                        >
                          <Pill className="h-3.5 w-3.5" /> Issue Rx & Record
                        </button>
                      )}
                      <button
                        disabled={actionLoadingId === apptId || isConfirmed}
                        onClick={() => handleApptAction(apptId, "confirmed")}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isConfirmed
                            ? "bg-muted text-muted-foreground cursor-default"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {isConfirmed ? "Accepted" : "Accept"}
                      </button>
                      <button
                        disabled={actionLoadingId === apptId || isDeclined}
                        onClick={() => handleApptAction(apptId, "declined")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        {isDeclined ? "Declined" : "Decline"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Doctor Appointment History */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ClipboardList className="h-4 w-4 text-primary" />
              Doctor Appointment History ({historyAppts.length})
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Audit-verified consultation ledger
            </span>
          </div>

          {historyAppts.length === 0 ? (
            <div className="rounded-lg bg-muted/40 p-4 text-center text-xs text-muted-foreground">
              No historical appointment records found.
            </div>
          ) : (
            <div className="space-y-2">
              {historyAppts.map((a: any, i: number) => (
                <div
                  key={a.apptId || a.id || i}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <span>{a.patientName || "Patient"}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">({a.patientDid ? a.patientDid.slice(0, 18) + "..." : "did:hosp:patient"})</span>
                    </div>
                    <div className="text-muted-foreground">
                      {a.slot || a.time || "OPD Session"} · {a.specialty || "General Medicine"} ({a.mode === "tele" ? "Telehealth" : "In-Person"})
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        a.status === "confirmed" || a.status === "completed"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-destructive/15 text-destructive border border-destructive/20"
                      }`}
                    >
                      {a.status === "confirmed" ? "Accepted & Active" : a.status === "completed" ? "Completed" : "Declined"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {a.bookedAt ? new Date(a.bookedAt).toLocaleDateString() : "Processed"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Leave Request Dialog */}
      <Dialog open={isLeaveOpen} onOpenChange={setIsLeaveOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleLeaveSubmit}>
            <DialogHeader>
              <DialogTitle>Request Leave</DialogTitle>
              <DialogDescription>
                Submit a leave request. You will be notified once a clinical manager reviews it.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="leaveType" className="text-right text-xs">Type</Label>
                <div className="col-span-3">
                  <Select value={leaveType} onValueChange={setLeaveType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Casual">Casual Leave</SelectItem>
                      <SelectItem value="Medical">Medical Leave</SelectItem>
                      <SelectItem value="Annual">Annual Leave</SelectItem>
                      <SelectItem value="Maternity/Paternity">Maternity/Paternity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fromDate" className="text-right text-xs">From</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={leaveFrom}
                  onChange={(e) => setLeaveFrom(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="toDate" className="text-right text-xs">To</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={leaveTo}
                  onChange={(e) => setLeaveTo(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="reason" className="text-right text-xs">Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="State the reason for leave"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsLeaveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingLeave}>
                {isSubmittingLeave ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Shift Request Dialog */}
      <Dialog open={isShiftOpen} onOpenChange={setIsShiftOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleShiftSubmit}>
            <DialogHeader>
              <DialogTitle>Request Add Shift</DialogTitle>
              <DialogDescription>
                Volunteer or request to add an extra shift to your schedule.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shiftDate" className="text-right text-xs">Date</Label>
                <Input
                  id="shiftDate"
                  type="date"
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shiftType" className="text-right text-xs font-semibold">Shift Type</Label>
                <div className="col-span-3">
                  <Select value={reqShiftType} onValueChange={setReqShiftType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPD">OPD</SelectItem>
                      <SelectItem value="Ward rounds">Ward rounds</SelectItem>
                      <SelectItem value="Surgery">Surgery</SelectItem>
                      <SelectItem value="On-call">On-call</SelectItem>
                      <SelectItem value="ICU">ICU</SelectItem>
                      <SelectItem value="Emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="unit" className="text-right text-xs">Unit / Ward</Label>
                <Input
                  id="unit"
                  value={shiftUnit}
                  onChange={(e) => setShiftUnit(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g. OPD Block A, ICU Ward 3"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsShiftOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingShift}>
                {isSubmittingShift ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Issue Prescription & Medical Record Dialog */}
      <Dialog open={!!activeRxAppt} onOpenChange={() => setActiveRxAppt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-emerald-600" />
              Issue Prescription & Medical Record
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleIssueRxAndRecordSubmit} className="space-y-4 text-xs">
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <div className="font-semibold text-foreground text-sm">Patient: {activeRxAppt?.patientName || "Patient"}</div>
              <div className="font-mono text-[11px] text-muted-foreground">{activeRxAppt?.patientDid}</div>
              <div className="text-muted-foreground">Appt: {activeRxAppt?.slot} · {activeRxAppt?.specialty}</div>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-foreground uppercase tracking-wide text-[10px]">1. Digital Prescription Details</div>
              <div>
                <label className="block text-muted-foreground mb-1">Diagnosis</label>
                <input
                  type="text"
                  value={rxDiagnosis}
                  onChange={(e) => setRxDiagnosis(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground mb-1">Medication Name</label>
                  <input
                    type="text"
                    value={rxMedName}
                    onChange={(e) => setRxMedName(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Dosage</label>
                  <input
                    type="text"
                    value={rxDosage}
                    onChange={(e) => setRxDosage(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground mb-1">Frequency</label>
                  <input
                    type="text"
                    value={rxFrequency}
                    onChange={(e) => setRxFrequency(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Duration</label>
                  <input
                    type="text"
                    value={rxDuration}
                    onChange={(e) => setRxDuration(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Instructions / Notes</label>
                <input
                  type="text"
                  value={rxNotes}
                  onChange={(e) => setRxNotes(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="font-bold text-foreground uppercase tracking-wide text-[10px]">2. Clinical Medical Record Note</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground mb-1">Record Title</label>
                  <input
                    type="text"
                    value={recordTitle}
                    onChange={(e) => setRecordTitle(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Type</label>
                  <select
                    value={recordType}
                    onChange={(e) => setRecordType(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                  >
                    <option value="consultation-summary">Consultation Summary</option>
                    <option value="discharge-summary">Discharge Summary</option>
                    <option value="lab-report">Lab Report</option>
                    <option value="imaging">Imaging Note</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Clinical Summary Note</label>
                <textarea
                  rows={2}
                  value={clinicalSummary}
                  onChange={(e) => setClinicalSummary(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <button
                type="button"
                onClick={() => setActiveRxAppt(null)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingRx}
                className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSubmittingRx ? "Signing & Anchoring..." : "Sign & Issue On-Chain"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </RouteGuard>
  );
}

