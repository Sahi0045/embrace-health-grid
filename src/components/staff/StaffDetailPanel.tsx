import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  X,
  User,
  Clock,
  MapPin,
  Calendar,
  ShieldCheck,
  Award,
  Activity,
  CheckCircle2,
  Copy,
  Check,
  Mail,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradientProgress } from "@/components/dashboard/GradientProgress";
import { toast } from "sonner";
import { StaffMember } from "./StaffCard";
import { RosterShiftEntry } from "./DutyRosterGrid";

interface AttendanceRecord {
  id: string;
  action: "in" | "out";
  location?: string;
  recordedAt: string;
}

interface StaffDetailPanelProps {
  staff: StaffMember | null;
  shifts: RosterShiftEntry[];
  attendanceLogs: AttendanceRecord[];
  onClose: () => void;
  onConfirmShift?: (shiftId: string) => void;
}

export function StaffDetailPanel({
  staff,
  shifts,
  attendanceLogs,
  onClose,
  onConfirmShift,
}: StaffDetailPanelProps) {
  const [copiedDid, setCopiedDid] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "assignment" | "schedule" | "attendance" | "credentials"
  >("assignment");

  if (!staff) return null;

  const handleCopyDid = () => {
    if (staff.primaryDid) {
      navigator.clipboard.writeText(staff.primaryDid);
      setCopiedDid(true);
      toast.success("DID copied to clipboard");
      setTimeout(() => setCopiedDid(false), 2000);
    }
  };

  const getInitials = (name: string) => {
    return (
      name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "MD"
    );
  };

  const staffShifts = shifts.filter((s) => s.staffId === staff.id);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        {/* Backdrop overlay with smooth blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-foreground/40 backdrop-blur-md"
        />

        {/* Centered Modal Container with Fixed Header, Scrollable Body, Fixed Footer */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="relative w-full max-w-2xl rounded-3xl border border-border/80 bg-card shadow-clinical-xl z-10 flex flex-col max-h-[88vh] overflow-hidden"
        >
          {/* Fixed Top Header (Does not scroll) */}
          <div className="p-6 pb-3 border-b border-border/60 bg-card shrink-0 space-y-3.5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-primary/15 text-primary font-display font-extrabold text-base shadow-xs border border-primary/20">
                  {getInitials(staff.fullName)}
                </div>
                <div>
                  <h2 className="font-display font-extrabold text-xl text-foreground tracking-tight">
                    {staff.fullName}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className="rounded-md bg-primary/10 border-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase"
                    >
                      {staff.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-semibold">
                      {staff.department} {staff.specialty ? `• ${staff.specialty}` : ""}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="rounded-xl p-2 hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* DID & Verification Strip */}
            {staff.primaryDid && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-1.5 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-mono text-[11px] text-muted-foreground truncate">
                    {staff.primaryDid}
                  </span>
                </div>
                <Button
                  onClick={handleCopyDid}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-xs font-bold gap-1 shrink-0"
                >
                  {copiedDid ? (
                    <>
                      <Check className="h-3 w-3 text-success" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {(
                [
                  { id: "assignment", label: "Live Assignment" },
                  { id: "schedule", label: `Weekly Schedule (${staffShifts.length})` },
                  { id: "attendance", label: "Attendance Log" },
                  { id: "credentials", label: "Verifiable DID" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold tracking-tight transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Middle Scrollable Body (Only this section scrolls) */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* Tab 1: Live Assignment */}
            {activeTab === "assignment" && (
              <div className="space-y-4">
                {/* Current Shift Status */}
                <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
                      <h3 className="font-display font-extrabold text-sm text-foreground">
                        Active Duty Status
                      </h3>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-success/30 bg-success/15 px-2.5 py-0.5 text-[10px] font-extrabold text-success uppercase">
                      {staff.availability}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-card border border-border/60 p-3 space-y-1">
                      <div className="text-[10px] font-extrabold uppercase text-muted-foreground">
                        Current Shift
                      </div>
                      <div className="font-bold text-foreground">
                        {staff.currentShift
                          ? `${staff.currentShift.startsAt} – ${staff.currentShift.endsAt}`
                          : "No Active Shift"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {staff.currentShift?.role || "General Duty"}
                      </div>
                    </div>

                    <div className="rounded-xl bg-card border border-border/60 p-3 space-y-1">
                      <div className="text-[10px] font-extrabold uppercase text-muted-foreground">
                        Assigned Station
                      </div>
                      <div className="font-bold text-foreground">
                        {staff.currentShift?.unit || staff.attendance?.location || "Unassigned"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{staff.department}</div>
                    </div>
                  </div>
                </div>

                {/* Workload Capacity Breakdown */}
                <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-clinical-xs">
                  <h3 className="font-display font-extrabold text-sm text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Workload & Inpatient Allocation
                  </h3>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-muted-foreground">
                        Active Inpatients Assigned
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {staff.workload.activePatients} of {staff.workload.maxCapacity} (
                        {staff.workload.percentage}%)
                      </span>
                    </div>
                    <GradientProgress
                      value={staff.workload.percentage}
                      tone={staff.workload.percentage > 85 ? "destructive" : "primary"}
                      height={8}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center">
                    <div className="p-2 rounded-xl bg-muted/30">
                      <div className="text-base font-extrabold font-display text-foreground">
                        {staff.workload.hoursThisWeek}h
                      </div>
                      <div className="text-[9px] font-extrabold text-muted-foreground uppercase">
                        Week Hours
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/30">
                      <div className="text-base font-extrabold font-display text-success">
                        98.5%
                      </div>
                      <div className="text-[9px] font-extrabold text-muted-foreground uppercase">
                        Punctuality
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/30">
                      <div className="text-base font-extrabold font-display text-primary">
                        4.9 ★
                      </div>
                      <div className="text-[9px] font-extrabold text-muted-foreground uppercase">
                        Care Rating
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2.5 shadow-clinical-xs">
                  <h3 className="font-display font-extrabold text-sm text-foreground">
                    Contact & Dispatch
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-foreground font-medium truncate">{staff.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                      <span className="text-foreground font-medium">
                        {staff.phone || "+1 (555) 019-4832"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Weekly Schedule */}
            {activeTab === "schedule" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-extrabold text-sm text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Assigned Shifts This Week
                  </h3>
                </div>

                {staffShifts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
                    No upcoming shifts assigned to this clinician.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {staffShifts.map((shift) => (
                      <div
                        key={shift.shiftId}
                        className="rounded-2xl border border-border/80 bg-card p-3.5 flex items-center justify-between gap-3 shadow-clinical-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Clock className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <div className="font-extrabold text-xs text-foreground">
                              {new Date(shift.shiftDate).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground">
                              {shift.startsAt} – {shift.endsAt} • {shift.role}
                            </div>
                            {shift.unit && (
                              <div className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold mt-0.5">
                                Unit: {shift.unit}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {shift.confirmed ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/15 px-2.5 py-0.5 text-[10px] font-extrabold text-success">
                              <CheckCircle2 className="h-3 w-3" /> Confirmed
                            </span>
                          ) : (
                            <Button
                              onClick={() => {
                                if (onConfirmShift) onConfirmShift(shift.shiftId);
                                toast.success("Shift confirmed for staff member");
                              }}
                              variant="outline"
                              size="sm"
                              className="rounded-xl text-[11px] font-bold h-7"
                            >
                              Confirm Shift
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Attendance Log */}
            {activeTab === "attendance" && (
              <div className="space-y-3">
                <h3 className="font-display font-extrabold text-sm text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Biometric & NFC Check-In Log
                </h3>

                {attendanceLogs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
                    No attendance events recorded for today.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attendanceLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-2xl border border-border/80 bg-card p-3 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              log.action === "in" ? "bg-success" : "bg-muted-foreground"
                            }`}
                          />
                          <div>
                            <div className="font-bold text-foreground">
                              {log.action === "in" ? "Clocked IN" : "Clocked OUT"}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {log.location || "Hospital Main Gate / NFC Terminal"}
                            </div>
                          </div>
                        </div>

                        <div className="text-right font-mono text-[11px] text-muted-foreground">
                          {new Date(log.recordedAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Credentials */}
            {activeTab === "credentials" && (
              <div className="space-y-3">
                <h3 className="font-display font-extrabold text-sm text-foreground flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  Decentralized Health Identity Credentials
                </h3>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-primary">
                        Verified Medical Practitioner License
                      </span>
                      <Badge className="bg-success/20 text-success border-success/30 text-[10px]">
                        Active & Anchored
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Issued by Ministry of Health Consortium • Anchor Slot #189,420
                    </p>
                    <div className="font-mono text-[10px] text-foreground bg-background/60 p-2 rounded-lg truncate">
                      Anchor Root: 0x8f2a994c502b4e87d3a0e19488a091cf76b
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-foreground">
                        Hospital Staff Operational DID
                      </span>
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                        Tier 1 Staff
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Embrace Health Grid Enterprise Role Assertion
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Permanently Fixed Floating Footer at Bottom (Never scrolls away) */}
          <div className="p-4 px-6 border-t border-border/60 bg-card/95 backdrop-blur-md shrink-0 flex items-center justify-between gap-3 rounded-b-3xl z-20 shadow-clinical-sm">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-xl text-xs font-bold h-10 px-5 shadow-xs hover:bg-accent"
            >
              Close
            </Button>

            <Button
              onClick={() => toast.success(`Communication link opened for ${staff.fullName}`)}
              className="bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold rounded-xl shadow-clinical-md shadow-primary/25 text-xs h-10 px-5"
            >
              <Mail className="h-4 w-4 mr-2" />
              Dispatch Alert
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
