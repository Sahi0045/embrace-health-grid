import { createFileRoute } from "@tanstack/react-router";
import { useTableRefresh } from "@/hooks/use-realtime";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { EmptyState } from "@/components/EmptyState";
import { updateAppointmentStatus } from "@/lib/api";
import { getDoctorAppointmentRequests, getDoctorAppointments } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth-context";
import {
  CalendarDays,
  Clock,
  User,
  Check,
  X,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MapPin,
  Video,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarClock,
  Stethoscope,
  Info,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/appointments")({
  head: () => ({ meta: [{ title: "Staff · Appointment Requests — Embrace Health Grid" }] }),
  component: StaffAppointmentsPage,
});

// ─── types ────────────────────────────────────────────────────────────────────
interface Appointment {
  apptId: string;
  patientDid: string;
  patientName: string;
  doctorDid: string;
  doctorName: string;
  slot: string;
  date: string;
  mode: "in-person" | "tele";
  specialty: string;
  reason: string;
  status:
    | "pending"
    | "confirmed"
    | "rejected"
    | "cancelled"
    | "suggested"
    | "rescheduled"
    | "completed";
  notes?: string;
  suggestedSlot?: string;
  bookedAt: string;
  updatedAt?: string;
  reviewedBy?: string;
}

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  pending: { label: "Pending", cls: "bg-warning/15 text-warning-foreground", icon: Clock },
  confirmed: { label: "Confirmed", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive", icon: XCircle },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground", icon: X },
  suggested: { label: "Rescheduled", cls: "bg-primary/15 text-primary", icon: CalendarClock },
};

// ─── action modal ─────────────────────────────────────────────────────────────
function ActionModal({
  appt,
  onClose,
  onDone,
}: {
  appt: Appointment;
  onClose: () => void;
  onDone: () => void;
}) {
  const [action, setAction] = useState<"accept" | "reject" | "suggest">("accept");
  const [notes, setNotes] = useState("");
  const [suggestedSlot, setSuggestedSlot] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (action === "suggest" && !suggestedSlot.trim()) {
      toast.error("Please enter a suggested time slot.");
      return;
    }
    setBusy(true);
    try {
      // Verbs, not enum labels — the server maps these to appt_status. Sending
      // "accepted" failed: the enum has "confirmed".
      const statusMap = { accept: "accept", reject: "reject", suggest: "suggest" } as const;
      await updateAppointmentStatus(
        appt.apptId,
        statusMap[action],
        notes,
        suggestedSlot || undefined,
      );

      const msgs = {
        accept: `Appointment with ${appt.patientName} confirmed.`,
        reject: `Appointment with ${appt.patientName} rejected.`,
        suggest: `New time suggested to ${appt.patientName}.`,
      };
      toast.success(msgs[action]);
      onDone();
    } catch (err: any) {
      toast.error("Action failed", { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95 }}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-clinical-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Respond to Request</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {appt.patientName} · {appt.slot}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Patient details */}
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs mb-4 space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Patient</span>
            <span className="font-semibold text-foreground">{appt.patientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date & Slot</span>
            <span className="font-semibold text-foreground">{appt.slot}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mode</span>
            <span className="font-semibold text-foreground capitalize">{appt.mode}</span>
          </div>
          {appt.reason && (
            <div className="pt-1 border-t border-border">
              <span className="text-muted-foreground">Reason: </span>
              <span className="text-foreground">{appt.reason}</span>
            </div>
          )}
        </div>

        {/* Action tabs */}
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {(["accept", "reject", "suggest"] as const).map((a) => {
            const meta = {
              accept: {
                label: "Accept",
                cls: "border-success text-success bg-success/5",
                activeCls: "bg-success text-white border-success",
              },
              reject: {
                label: "Reject",
                cls: "border-destructive text-destructive bg-destructive/5",
                activeCls: "bg-destructive text-white border-destructive",
              },
              suggest: {
                label: "Reschedule",
                cls: "border-primary text-primary bg-primary/5",
                activeCls: "bg-primary text-white border-primary",
              },
            }[a];
            return (
              <button
                key={a}
                onClick={() => setAction(a)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${action === a ? meta.activeCls : meta.cls}`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Suggest slot input */}
        {action === "suggest" && (
          <div className="mb-3">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">
              Suggested Time Slot
            </label>
            <input
              type="text"
              value={suggestedSlot}
              onChange={(e) => setSuggestedSlot(e.target.value)}
              placeholder="e.g. Mon · 11:00 AM or 2026-08-10 · 02:30 PM"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {/* Notes */}
        <div className="mb-4">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">
            Note to patient <span className="text-[10px] font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={
              action === "accept"
                ? "Any preparation instructions…"
                : action === "reject"
                  ? "Reason for rejection…"
                  : "Explain the rescheduled slot…"
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60 ${
              action === "accept"
                ? "bg-success hover:bg-success/90"
                : action === "reject"
                  ? "bg-destructive hover:bg-destructive/90"
                  : "bg-primary hover:bg-primary/90"
            }`}
          >
            {busy ? (
              <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
            ) : action === "accept" ? (
              "Confirm Appointment"
            ) : action === "reject" ? (
              "Reject Request"
            ) : (
              "Send New Time"
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── appointment card ─────────────────────────────────────────────────────────
function AppointmentCard({
  appt,
  onAction,
}: {
  appt: Appointment;
  onAction: (a: Appointment) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[appt.status] ?? STATUS_META.pending;
  const Icon = meta.icon;
  const isPending = appt.status === "pending";

  return (
    <div
      className={`rounded-xl border bg-card shadow-clinical transition-all ${isPending ? "border-warning/40" : "border-border"}`}
    >
      <div className="p-4 space-y-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-foreground truncate">{appt.patientName}</div>
              <div className="text-[10px] font-mono text-muted-foreground truncate">
                {appt.patientDid}
              </div>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${meta.cls}`}
          >
            <Icon className="h-3 w-3" /> {meta.label}
          </span>
        </div>

        {/* Slot & mode */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-foreground">
            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-semibold">{appt.slot}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            {appt.mode === "tele" ? (
              <Video className="h-3.5 w-3.5" />
            ) : (
              <MapPin className="h-3.5 w-3.5" />
            )}
            <span className="capitalize">{appt.mode}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Stethoscope className="h-3.5 w-3.5" />
            <span>{appt.specialty}</span>
          </div>
        </div>

        {/* Reason */}
        {appt.reason && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <span className="font-semibold text-foreground">Reason: </span>
            {appt.reason}
          </p>
        )}

        {/* Suggested slot */}
        {appt.status === "suggested" && appt.suggestedSlot && (
          <p className="text-xs text-primary bg-primary/10 rounded-lg px-3 py-2">
            <span className="font-semibold">Suggested: </span>
            {appt.suggestedSlot}
          </p>
        )}

        {/* Doctor notes */}
        {appt.notes && (
          <p className="text-xs text-muted-foreground italic bg-muted/30 rounded-lg px-3 py-2">
            "{appt.notes}"
          </p>
        )}

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 border-t border-border space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booked at</span>
                  <span className="text-foreground">
                    {new Date(appt.bookedAt).toLocaleString("en-IN")}
                  </span>
                </div>
                {appt.updatedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last updated</span>
                    <span className="text-foreground">
                      {new Date(appt.updatedAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
                {appt.reviewedBy && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reviewed by</span>
                    <span className="text-foreground">{appt.reviewedBy}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Appointment ID</span>
                  <span className="font-mono text-foreground">{appt.apptId}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <button
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {expanded ? "Less" : "Details"}
          </button>
          <div className="flex-1" />
          {isPending && (
            <>
              <button
                onClick={() => onAction(appt)}
                className="flex items-center gap-1.5 rounded-lg bg-success/10 border border-success/30 px-3 py-1.5 text-xs font-bold text-success hover:bg-success/20 transition-colors"
              >
                <Check className="h-3.5 w-3.5" /> Accept
              </button>
              <button
                onClick={() => onAction(appt)}
                className="flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Reject
              </button>
            </>
          )}
          {appt.status === "confirmed" && (
            <span className="flex items-center gap-1 text-xs text-success font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Confirmed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
function StaffAppointmentsPage() {
  const { user: currentUser } = useCurrentUser();

  const [requests, setRequests] = useState<Appointment[]>([]);
  const [allAppts, setAllAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
  const [actionTarget, setActionTarget] = useState<Appointment | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // ── fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, allRes] = await Promise.all([
        getDoctorAppointmentRequests(),
        getDoctorAppointments(),
      ]);
      setRequests((reqRes.requests ?? []) as Appointment[]);
      setAllAppts((allRes.appointments ?? []) as Appointment[]);
      setLastRefresh(new Date());
    } catch (err: any) {
      toast.error("Failed to load appointments", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Real-time refresh via Supabase Realtime ────────────────────────────────
  // Replaces a WebSocket to the Express server plus a 15s polling fallback.
  // Realtime filters events per subscriber through RLS, so only changes to
  // appointments this user is a party to arrive at all.
  useTableRefresh("appointments", load);

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleActionDone = () => {
    setActionTarget(null);
    load();
  };

  // ── derived data ───────────────────────────────────────────────────────────
  const pendingCount = requests.length;
  const confirmedCount = allAppts.filter((a) => a.status === "confirmed").length;
  const rejectedCount = allAppts.filter((a) => a.status === "rejected").length;

  const displayList =
    activeTab === "pending"
      ? requests
      : [...allAppts].sort((a, b) => (b.bookedAt ?? "").localeCompare(a.bookedAt ?? ""));

  return (
    <RouteGuard requiredRole="staff">
      <div className="p-6 sm:p-8 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <PageHeader
            eyebrow="Doctor Portal"
            title="Appointment Requests"
            description="Review, accept or reject appointment requests from patients. Changes sync instantly to the patient portal."
          />
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-all shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Pending",
              value: pendingCount,
              cls: "text-warning-foreground bg-warning/10 border-warning/30",
            },
            {
              label: "Confirmed",
              value: confirmedCount,
              cls: "text-success bg-success/10 border-success/30",
            },
            {
              label: "Rejected",
              value: rejectedCount,
              cls: "text-destructive bg-destructive/10 border-destructive/30",
            },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 text-center ${s.cls}`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs font-semibold mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
          <span>
            When you <strong>Accept</strong>, the patient's portal instantly shows{" "}
            <strong>Confirmed</strong>. When you <strong>Reject</strong>, it shows{" "}
            <strong>Rejected</strong>. All changes sync via WebSocket in real time.
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {(["pending", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "pending"
                ? `Pending Requests (${pendingCount})`
                : `All Appointments (${allAppts.length})`}
            </button>
          ))}
        </div>

        {/* Last refreshed */}
        <p className="text-[10px] text-muted-foreground text-right -mt-4">
          Last refreshed: {lastRefresh.toLocaleTimeString("en-IN")}
        </p>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-32 animate-pulse rounded-xl border border-border bg-muted"
              />
            ))}
          </div>
        ) : displayList.length === 0 ? (
          <EmptyState
            icon={activeTab === "pending" ? AlertCircle : CalendarDays}
            title={activeTab === "pending" ? "No pending requests" : "No appointments yet"}
            description={
              activeTab === "pending"
                ? "You have no pending appointment requests at the moment. New requests from patients will appear here."
                : "No appointment history found for your account."
            }
          />
        ) : (
          <div className="space-y-3">
            {displayList.map((appt) => (
              <AppointmentCard key={appt.apptId} appt={appt} onAction={setActionTarget} />
            ))}
          </div>
        )}
      </div>

      {/* Action modal */}
      <AnimatePresence>
        {actionTarget && (
          <ActionModal
            appt={actionTarget}
            onClose={() => setActionTarget(null)}
            onDone={handleActionDone}
          />
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}
