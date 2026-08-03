import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  getStaffSchedule,
  createStaffRequest,
  getAppointmentsByDoctor,
  updateAppointmentStatus,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { stagger, fadeUp } from "@/components/Motion";
import {
  Calendar,
  Clock,
  MapPin,
  Stethoscope,
  Plane,
  ChevronLeft,
  ChevronRight,
  Users,
  Video,
  Scissors,
  Heart,
  PlusCircle,
  Check,
  AlertCircle,
  Moon,
  Sun,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Bell,
  X,
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

type ShiftType =
  | "OPD"
  | "Ward rounds"
  | "Surgery"
  | "On-call"
  | "ICU"
  | "Emergency"
  | "Telemedicine"
  | "Off"
  | "Leave";

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

const shiftConfig: Record<
  ShiftType,
  {
    bg: string;
    text: string;
    border: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }
> = {
  OPD: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/30",
    icon: Stethoscope,
    accent: "bg-primary",
  },
  "Ward rounds": {
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/30",
    icon: Heart,
    accent: "bg-success",
  },
  Surgery: {
    bg: "bg-warning/15",
    text: "text-warning-foreground",
    border: "border-warning/30",
    icon: Scissors,
    accent: "bg-yellow-500",
  },
  "On-call": {
    bg: "bg-destructive/8",
    text: "text-destructive",
    border: "border-destructive/30",
    icon: AlertCircle,
    accent: "bg-destructive",
  },
  ICU: {
    bg: "bg-chart-2/10",
    text: "text-chart-2",
    border: "border-chart-2/30",
    icon: Heart,
    accent: "bg-chart-2",
  },
  Emergency: {
    bg: "bg-destructive/12",
    text: "text-destructive",
    border: "border-destructive/40",
    icon: AlertCircle,
    accent: "bg-destructive",
  },
  Telemedicine: {
    bg: "bg-chart-4/10",
    text: "text-chart-4",
    border: "border-chart-4/30",
    icon: Video,
    accent: "bg-chart-4",
  },
  Off: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
    icon: Moon,
    accent: "bg-muted-foreground",
  },
  Leave: {
    bg: "bg-chart-3/10",
    text: "text-chart-3",
    border: "border-chart-3/30",
    icon: Sun,
    accent: "bg-chart-3",
  },
};

function ShiftCard({ shift }: { shift: Shift }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = shiftConfig[shift.role];
  const Icon = cfg.icon;
  const isOff = shift.role === "Off" || shift.role === "Leave";
  const isNight = shift.role === "On-call";

  return (
    <motion.div
      variants={fadeUp}
      className={`rounded-xl border p-4 transition-all cursor-pointer ${cfg.bg} ${cfg.border} ${expanded ? "shadow-md" : ""}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/60 ${cfg.text}`}
          >
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
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {shift.start} – {shift.end}
                </span>
                {shift.patients !== undefined && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {shift.patients} patients
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-medium text-muted-foreground">{shift.date.slice(5)}</span>
          {!isOff && (
            <div className={`h-1.5 w-16 rounded-full overflow-hidden bg-background/60`}>
              <div
                className={`h-full ${cfg.accent} opacity-60`}
                style={{ width: isNight ? "100%" : "70%" }}
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && shift.notes && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={`mt-3 rounded-lg border ${cfg.border} bg-background/60 px-3 py-2.5`}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Notes
              </div>
              <div className="text-xs text-foreground">{shift.notes}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Appointment Request Card ──────────────────────────────────────────────
const APPT_STATUS_STYLES: Record<
  string,
  { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: {
    bg: "bg-warning/10 border-warning/30",
    text: "text-yellow-700 dark:text-yellow-400",
    icon: Clock,
  },
  confirmed: { bg: "bg-success/10 border-success/30", text: "text-success", icon: CheckCircle2 },
  rejected: {
    bg: "bg-destructive/10 border-destructive/30",
    text: "text-destructive",
    icon: XCircle,
  },
  rescheduled: { bg: "bg-primary/10 border-primary/30", text: "text-primary", icon: RefreshCw },
  cancelled: { bg: "bg-muted border-border", text: "text-muted-foreground", icon: X },
};

interface ApptRequest {
  apptId: string;
  patientName: string;
  patientDid: string;
  specialty: string;
  slot: string;
  mode: string;
  status: string;
  reason?: string;
  bookedAt: string;
  rejectionReason?: string;
  suggestedSlot?: string;
}

function AppointmentRequestCard({
  appt,
  onAction,
}: {
  appt: ApptRequest;
  onAction: (
    apptId: string,
    status: "confirmed" | "rejected" | "rescheduled",
    opts?: { rejectionReason?: string; suggestedSlot?: string },
  ) => Promise<void>;
}) {
  const [processing, setProcessing] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showSuggestInput, setShowSuggestInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [suggestSlot, setSuggestSlot] = useState("");

  const cfg = APPT_STATUS_STYLES[appt.status] ?? APPT_STATUS_STYLES.pending;
  const StatusIcon = cfg.icon;
  const isPending = appt.status === "pending";

  const handle = async (status: "confirmed" | "rejected" | "rescheduled", opts?: any) => {
    setProcessing(true);
    try {
      await onAction(appt.apptId, status, opts);
    } finally {
      setProcessing(false);
      setShowRejectInput(false);
      setShowSuggestInput(false);
      setRejectReason("");
      setSuggestSlot("");
    }
  };

  return (
    <motion.div variants={fadeUp} className={`rounded-xl border p-4 transition-all ${cfg.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{appt.patientName}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.text}`}
            >
              <StatusIcon className="h-3 w-3" />
              {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {appt.specialty} · {appt.mode === "tele" ? "Telehealth" : "In-Person"}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-foreground font-medium">
            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>{appt.slot}</span>
          </div>
          {appt.reason && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-medium">Reason:</span> {appt.reason}
            </div>
          )}
          {appt.rejectionReason && appt.status === "rejected" && (
            <div className="mt-1 text-[11px] text-destructive">
              <span className="font-medium">Rejection note:</span> {appt.rejectionReason}
            </div>
          )}
          {appt.suggestedSlot && appt.status === "rescheduled" && (
            <div className="mt-1 text-[11px] text-primary font-medium">
              Suggested: {appt.suggestedSlot}
            </div>
          )}
          <div className="mt-1 text-[10px] text-muted-foreground">
            Requested{" "}
            {new Date(appt.bookedAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* Action buttons — only for pending requests */}
      {isPending && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
          {!showRejectInput && !showSuggestInput && (
            <div className="flex gap-2">
              <button
                disabled={processing}
                onClick={() => handle("confirmed")}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-success/10 border border-success/30 py-2 text-xs font-bold text-success hover:bg-success/20 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Accept
              </button>
              <button
                disabled={processing}
                onClick={() => setShowSuggestInput(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 border border-primary/30 py-2 text-xs font-bold text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Suggest Time
              </button>
              <button
                disabled={processing}
                onClick={() => setShowRejectInput(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/30 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" /> Decline
              </button>
            </div>
          )}

          {showRejectInput && (
            <div className="space-y-2">
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for declining (optional)..."
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs outline-none focus:border-destructive"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRejectInput(false)}
                  className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  disabled={processing}
                  onClick={() => handle("rejected", { rejectionReason: rejectReason })}
                  className="flex-1 rounded-lg bg-destructive py-1.5 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {processing ? "Declining…" : "Confirm Decline"}
                </button>
              </div>
            </div>
          )}

          {showSuggestInput && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                Suggest a new date and time
              </label>
              <input
                value={suggestSlot}
                onChange={(e) => setSuggestSlot(e.target.value)}
                placeholder="e.g. 2026-08-05 · 02:00 PM"
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSuggestInput(false)}
                  className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  disabled={processing || !suggestSlot.trim()}
                  onClick={() => handle("rescheduled", { suggestedSlot: suggestSlot.trim() })}
                  className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {processing ? "Sending…" : "Send Suggestion"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function getWeekRange(offset: number) {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: mon, end: sun };
}

function formatDateRange(s: Date, e: Date) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const sStr = s.toLocaleDateString("en-US", opts);
  const eStr = e.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${sStr} – ${eStr}`;
}

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function SchedulePage() {
  const [view, setView] = useState<"week" | "day" | "month">("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekShifts, setWeekShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUser = getCurrentUser();
  const staffEmail = currentUser?.email || "";

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
      toast.success("Leave request submitted successfully", {
        description: "You will be notified once approved.",
      });
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
      toast.success("Add shift request submitted", {
        description: "Request sent to clinical coordinator.",
      });
      setIsShiftOpen(false);
      setShiftDate("");
      setShiftUnit("OPD Block A");
    } catch (err: any) {
      toast.error("Failed to submit shift request", { description: err.message });
    } finally {
      setIsSubmittingShift(false);
    }
  };

  useEffect(() => {
    if (!staffEmail) {
      setLoading(false);
      return;
    }
    getStaffSchedule(staffEmail)
      .then((res) => {
        setWeekShifts(res.schedule || []);
      })
      .catch((err) => console.error("Error loading schedule:", err))
      .finally(() => setLoading(false));
  }, [staffEmail]);

  const [doctorAppointments, setDoctorAppointments] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const loadDoctorAppointments = useCallback(() => {
    const doctorDid = currentUser?.did || "";
    if (!doctorDid) return;
    getAppointmentsByDoctor(doctorDid)
      .then((res) => {
        const all = (res.appointments ?? []) as any[];
        setDoctorAppointments(all);
        setPendingRequests(all.filter((a: any) => a.status === "pending"));
      })
      .catch(() => {});
  }, [currentUser?.did]);

  useEffect(() => {
    loadDoctorAppointments();
  }, [loadDoctorAppointments]);

  // Subscribe to real-time appointment updates via WebSocket custom event
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const msg = JSON.parse((e as CustomEvent).detail);
        if (msg.event === "appointment:updated" || msg.event === "appointment:booked") {
          loadDoctorAppointments();
        }
      } catch {}
    };
    window.addEventListener("ws:message", handler as EventListener);
    return () => window.removeEventListener("ws:message", handler as EventListener);
  }, [loadDoctorAppointments]);

  const handleAppointmentAction = async (
    apptId: string,
    status: "confirmed" | "rejected" | "rescheduled" | "cancelled",
    opts?: { rejectionReason?: string; suggestedSlot?: string },
  ) => {
    try {
      await updateAppointmentStatus(apptId, status, opts?.rejectionReason, opts?.suggestedSlot);
      const label =
        status === "confirmed"
          ? "Accepted"
          : status === "rejected"
            ? "Declined"
            : "New time suggested";
      toast.success(`Appointment ${label}`, {
        description:
          status === "confirmed"
            ? "Patient has been notified."
            : opts?.suggestedSlot
              ? `Suggested: ${opts.suggestedSlot}`
              : "Patient has been notified.",
      });
      loadDoctorAppointments();
    } catch (err: any) {
      toast.error("Action failed", { description: err.message });
    }
  };

  const weekRange = useMemo(() => getWeekRange(weekOffset), [weekOffset]);
  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    const d = new Date(weekRange.start);
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [weekRange]);

  const todayStr = toDateStr(new Date());

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of doctorAppointments) {
      const d = a.date ?? a.slot?.split(" · ")[0] ?? a.bookedAt?.split("T")[0] ?? "";
      if (!d) continue;
      const existing = map.get(d) || [];
      existing.push(a);
      map.set(d, existing);
    }
    return map;
  }, [doctorAppointments]);

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const scheduledShifts = weekShifts.filter(
    (s) => s.role !== "Off" && s.role !== "Leave" && s.start !== "—",
  );
  const totalMinutes = scheduledShifts.reduce((acc, s) => {
    const [sh, sm] = s.start.split(":").map(Number);
    const [eh, em] = s.end.split(":").map(Number);
    let d = eh * 60 + em - (sh * 60 + sm);
    if (d < 0) d += 24 * 60;
    return acc + d;
  }, 0);
  const totalHours = Math.round(totalMinutes / 60);

  const onCallCount = weekShifts.filter((s) => s.role === "On-call").length;
  const offCount = weekShifts.filter((s) => s.role === "Off" || s.role === "Leave").length;

  const navLabel =
    view === "month"
      ? new Date(weekRange.start.getFullYear(), weekRange.start.getMonth(), 1).toLocaleDateString(
          "en-US",
          { month: "long", year: "numeric" },
        )
      : formatDateRange(weekRange.start, weekRange.end);

  const handlePrev = () => setWeekOffset((o) => o - (view === "month" ? 4 : 1));
  const handleNext = () => setWeekOffset((o) => o + (view === "month" ? 4 : 1));
  const handleToday = () => setWeekOffset(0);

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="My Schedule"
        title={navLabel}
        description={`${currentUser?.name || "Doctor"} · ${currentUser?.department || "Department"} · Shift plan and appointments`}
        actions={
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["day", "week", "month"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${view === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                >
                  {v}
                </button>
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
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid gap-4 sm:grid-cols-4"
        >
          <StatCard
            label="Scheduled Hours"
            value={`${totalHours}h`}
            delta={`across ${scheduledShifts.length} shift${scheduledShifts.length !== 1 ? "s" : ""}`}
            icon={Clock}
          />
          <StatCard
            label="Appointments"
            value={doctorAppointments.length}
            delta={`${pendingRequests.length} pending review`}
            icon={Stethoscope}
            tone={pendingRequests.length > 0 ? "warning" : undefined}
          />
          <StatCard
            label="On-Call Shifts"
            value={onCallCount}
            delta={onCallCount > 0 ? "this week" : "none"}
            icon={AlertCircle}
            tone="warning"
          />
          <StatCard
            label="Days Off / Leave"
            value={offCount}
            delta={offCount > 0 ? "this week" : "none"}
            icon={Moon}
            tone="success"
          />
        </motion.div>

        {/* ─── Appointment Requests Panel ─── */}
        <div className="rounded-xl border border-border bg-card shadow-clinical overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell
                className={`h-5 w-5 ${pendingRequests.length > 0 ? "text-warning-foreground" : "text-primary"}`}
              />
              <h2 className="text-sm font-bold text-foreground">Appointment Requests</h2>
              {pendingRequests.length > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold text-yellow-700 dark:text-yellow-400">
                  {pendingRequests.length} pending
                </span>
              )}
            </div>
            <button
              onClick={loadDoctorAppointments}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          <div className="p-5">
            {doctorAppointments.length === 0 ? (
              <div className="py-8 text-center">
                <Stethoscope className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No appointment requests yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Patients will appear here once they book with you.
                </p>
              </div>
            ) : (
              <>
                {/* Pending first, then all others */}
                {pendingRequests.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Awaiting Your Response
                    </p>
                    <motion.div
                      variants={stagger}
                      initial="hidden"
                      animate="show"
                      className="space-y-3"
                    >
                      {pendingRequests.map((appt: any) => (
                        <AppointmentRequestCard
                          key={appt.apptId}
                          appt={appt}
                          onAction={handleAppointmentAction}
                        />
                      ))}
                    </motion.div>
                  </div>
                )}

                {doctorAppointments.filter((a: any) => a.status !== "pending").length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Reviewed
                    </p>
                    <motion.div
                      variants={stagger}
                      initial="hidden"
                      animate="show"
                      className="space-y-2"
                    >
                      {doctorAppointments
                        .filter((a: any) => a.status !== "pending")
                        .slice(0, 8)
                        .map((appt: any) => (
                          <AppointmentRequestCard
                            key={appt.apptId}
                            appt={appt}
                            onAction={handleAppointmentAction}
                          />
                        ))}
                    </motion.div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleToday}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="text-sm font-semibold text-foreground">{navLabel}</div>
        </div>

        {/* ────── MONTH VIEW ────── */}
        {view === "month" &&
          (() => {
            const monthStart = new Date(
              weekRange.start.getFullYear(),
              weekRange.start.getMonth(),
              1,
            );
            const monthEnd = new Date(
              weekRange.start.getFullYear(),
              weekRange.start.getMonth() + 1,
              0,
            );
            const startDay = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
            const cells: (Date | null)[] = [];
            for (let i = 0; i < startDay; i++) cells.push(null);
            for (let d = 1; d <= monthEnd.getDate(); d++) {
              cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d));
            }
            while (cells.length % 7 !== 0) cells.push(null);

            return (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="grid grid-cols-7 border-b border-border bg-muted/40">
                  {days.map((d) => (
                    <div
                      key={d}
                      className="px-2 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {cells.map((cell, i) => {
                    if (!cell) {
                      return (
                        <div
                          key={`empty-${i}`}
                          className="min-h-[80px] border-b border-r border-border bg-muted/10"
                        />
                      );
                    }
                    const ds = toDateStr(cell);
                    const isT = ds === todayStr;
                    const dayShifts = weekShifts.filter((s) => s.date === ds);
                    const dayAppts = appointmentsByDate.get(ds) || [];
                    const totalEvents = dayShifts.length + dayAppts.length;

                    return (
                      <div
                        key={ds}
                        className={`min-h-[80px] border-b border-r border-border p-1.5 transition-colors cursor-pointer hover:bg-muted/30 ${
                          isT ? "bg-primary/5" : ""
                        }`}
                        onClick={() => {
                          setView("day");
                          setWeekOffset(
                            Math.round((cell.getTime() - new Date().getTime()) / (7 * 86400000)),
                          );
                        }}
                      >
                        <div
                          className={`text-xs font-semibold mb-1 ${isT ? "text-primary" : "text-foreground"}`}
                        >
                          {cell.getDate()}
                        </div>
                        <div className="flex flex-wrap gap-0.5">
                          {dayShifts.slice(0, 3).map((s) => {
                            const cfg = shiftConfig[s.role];
                            return (
                              <div
                                key={s.id}
                                className={`h-1.5 w-3 rounded-full ${cfg.accent} opacity-70`}
                                title={s.role}
                              />
                            );
                          })}
                          {dayAppts.slice(0, 3).map((a: any, j: number) => (
                            <div
                              key={j}
                              className={`h-1.5 w-3 rounded-full ${a.mode === "tele" ? "bg-chart-4" : "bg-primary"} opacity-70`}
                              title={a.patientName}
                            />
                          ))}
                        </div>
                        {totalEvents > 0 && (
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            {totalEvents} event{totalEvents > 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        {/* ────── WEEK VIEW ────── */}
        {view === "week" && (
          <>
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((wd) => {
                const ds = toDateStr(wd);
                const dayName = wd.toLocaleDateString("en-US", { weekday: "short" });
                const dayShifts = weekShifts.filter((s) => s.day === dayName || s.date === ds);
                const dayAppts = appointmentsByDate.get(ds) || [];
                const isT = ds === todayStr;
                return (
                  <div
                    key={ds}
                    className={`rounded-xl border p-3 text-center transition-colors ${
                      isT
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-card"
                    }`}
                  >
                    <div
                      className={`text-xs font-medium uppercase tracking-wide ${isT ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {dayName}
                    </div>
                    <div
                      className={`text-lg font-bold mt-0.5 ${isT ? "text-primary" : "text-foreground"}`}
                    >
                      {wd.getDate()}
                    </div>
                    <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                      {dayShifts.map((s) => {
                        const cfg = shiftConfig[s.role];
                        return (
                          <div
                            key={s.id}
                            className={`h-1.5 w-4 rounded-full ${cfg.accent} opacity-70`}
                            title={s.role}
                          />
                        );
                      })}
                      {dayAppts.map((_: any, j: number) => (
                        <div
                          key={`a-${j}`}
                          className="h-1.5 w-4 rounded-full bg-primary opacity-50"
                          title="Appointment"
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <div className="mb-3 text-sm font-semibold text-foreground">
                This Week&apos;s Shifts
              </div>
              <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
                {weekShifts.map((s) => (
                  <ShiftCard key={s.id} shift={s} />
                ))}
                {weekShifts.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No shifts scheduled this week
                  </div>
                )}
              </motion.div>
            </div>
          </>
        )}

        {/* ────── DAY VIEW ────── */}
        {view === "day" &&
          (() => {
            const dayShifts = weekShifts.filter((s) => {
              const dateMatch = weekDates.some((wd) => toDateStr(wd) === s.date);
              return dateMatch && s.role !== "Off" && s.role !== "Leave";
            });
            const dayAppts = weekDates.flatMap((wd) => appointmentsByDate.get(toDateStr(wd)) || []);
            const hours = Array.from({ length: 14 }, (_, i) => i + 7);
            const now = new Date();
            const nowH = now.getHours();
            const nowM = now.getMinutes();

            return (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="relative">
                  {hours.map((h) => (
                    <div key={h} className="flex border-b border-border min-h-[56px]">
                      <div className="w-16 shrink-0 py-2 px-3 text-xs text-muted-foreground font-medium border-r border-border bg-muted/20">
                        {h.toString().padStart(2, "0")}:00
                      </div>
                      <div className="flex-1 px-2 py-1 flex flex-wrap gap-1.5">
                        {dayShifts
                          .filter((s) => {
                            const [sh] = s.start.split(":").map(Number);
                            return sh === h;
                          })
                          .map((s) => {
                            const cfg = shiftConfig[s.role];
                            const Icon = cfg.icon;
                            return (
                              <div
                                key={s.id}
                                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.text} ${cfg.border} border`}
                              >
                                <Icon className="h-3 w-3" />
                                {s.role} · {s.unit} · {s.start}–{s.end}
                              </div>
                            );
                          })}
                        {dayAppts
                          .filter((a: any) => {
                            const slot = a.slot || a.time || "";
                            const match = slot.match(/(\d{1,2})/);
                            if (!match) return h === 10;
                            let parsed = parseInt(match[1]);
                            if (slot.toLowerCase().includes("pm") && parsed < 12) parsed += 12;
                            return parsed === h;
                          })
                          .map((a: any, j: number) => (
                            <div
                              key={`appt-${j}`}
                              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                            >
                              <Stethoscope className="h-3 w-3" />
                              {a.patientName || "Patient"} · {a.specialty || "Consultation"}
                              {a.mode === "tele" && <Video className="h-3 w-3" />}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}

                  {/* Current time indicator */}
                  {nowH >= 7 && nowH <= 20 && weekOffset === 0 && (
                    <div
                      className="absolute left-0 right-0 flex items-center z-10 pointer-events-none"
                      style={{ top: `${(nowH - 7) * 56 + (nowM / 60) * 56}px` }}
                    >
                      <div className="h-2.5 w-2.5 rounded-full bg-destructive -ml-1 shadow-sm" />
                      <div className="flex-1 h-[2px] bg-destructive/70" />
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

        {/* Upcoming appointments */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            Upcoming Appointments
          </div>
          <div className="space-y-2">
            {doctorAppointments.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No upcoming appointments
              </div>
            ) : (
              doctorAppointments.slice(0, 8).map((a: any, i: number) => (
                <div
                  key={a.apptId ?? i}
                  className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5"
                >
                  <div
                    className={`h-2 w-2 rounded-full ${a.mode === "tele" ? "bg-chart-4" : "bg-primary"}`}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                      {a.patientName ?? "Patient"} — {a.specialty ?? a.mode ?? "Consultation"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {a.status || "confirmed"} · {a.mode === "tele" ? "Telehealth" : "In-person"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.date ?? a.slot?.split(" · ")[0] ?? "—"}
                  </div>
                </div>
              ))
            )}
          </div>
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
                <Label htmlFor="leaveType" className="text-right text-xs">
                  Type
                </Label>
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
                <Label htmlFor="fromDate" className="text-right text-xs">
                  From
                </Label>
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
                <Label htmlFor="toDate" className="text-right text-xs">
                  To
                </Label>
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
                <Label htmlFor="reason" className="text-right text-xs">
                  Reason
                </Label>
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
                <Label htmlFor="shiftDate" className="text-right text-xs">
                  Date
                </Label>
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
                <Label htmlFor="shiftType" className="text-right text-xs font-semibold">
                  Shift Type
                </Label>
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
                <Label htmlFor="unit" className="text-right text-xs">
                  Unit / Ward
                </Label>
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
    </RouteGuard>
  );
}
