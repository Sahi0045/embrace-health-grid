import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { useState, useEffect } from "react";
import { getStaffSchedule, createStaffRequest } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { stagger, fadeUp } from "@/components/Motion";
import {
  Calendar, Clock, MapPin, Stethoscope, Plane, ChevronLeft, ChevronRight,
  Users, Video, Scissors, Heart, PlusCircle, Check, AlertCircle, Moon, Sun
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

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="My Schedule"
        title="Week of June 8 – 14, 2026"
        description={`Dr. ${currentUser?.name || "Ravi Menon"} · ${currentUser?.department || "Cardiology Department"} · Shift plan and upcoming events`}
        actions={
          <div className="flex gap-2">
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
          <StatCard label="Scheduled Hours" value={`${totalHours}h`} delta="across 6 shifts" icon={Clock} />
          <StatCard label="Patients This Week" value={weekShifts.reduce((s, sh) => s + (sh.patients ?? 0), 0)} delta="24 OPD + 20 inpatient" icon={Users} />
          <StatCard label="On-Call Shifts" value={1} delta="Friday night" icon={AlertCircle} tone="warning" />
          <StatCard label="Days Off / Leave" value={2} delta="Sat + Sun" icon={Moon} tone="success" />
        </motion.div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => toast.info("Navigating to previous week...", { description: "Viewing historical schedule." })}
            className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" /> Prev Week
          </button>
          <div className="text-sm font-semibold text-foreground">June 2026</div>
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
            const dateNum = 8 + i;
            const dayShifts = weekShifts.filter(s => s.day === day);
            const isToday = day === "Mon";
            return (
              <div key={day} className={`rounded-xl border p-3 text-center transition-colors ${isToday ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
                <div className={`text-xs font-medium uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</div>
                <div className={`text-lg font-bold mt-0.5 ${isToday ? "text-primary" : "text-foreground"}`}>{dateNum}</div>
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
          <div className="mb-3 text-sm font-semibold text-foreground">This Week's Shifts</div>
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
            {weekShifts.map(s => <ShiftCard key={s.id} shift={s} />)}
          </motion.div>
        </div>

        {/* Upcoming */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            Upcoming Events
          </div>
          <div className="space-y-2">
            {upcoming.map((e, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                <div className={`h-2 w-2 rounded-full ${e.type === "on-call" ? "bg-destructive" : e.type === "education" ? "bg-primary" : "bg-chart-2"}`} />
                <div className="flex-1 text-sm font-medium text-foreground">{e.label}</div>
                <div className="text-xs text-muted-foreground">{e.date}</div>
              </div>
            ))}
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
    </RouteGuard>
  );
}

