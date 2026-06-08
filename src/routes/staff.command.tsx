import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { mockBeds, mockAmbulances } from "@/lib/mock-infrastructure";
import { useLivePatients } from "@/hooks/use-fabric";
import {
  AlertTriangle, Activity, Bed, Ambulance, FileSignature,
  ShieldAlert, Stethoscope, HeartPulse, Clock, TrendingUp, Users
} from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/staff/command")({
  head: () => ({ meta: [{ title: "Command Center — Staff Portal" }] }),
  component: StaffCommandCenter,
});

const icuBeds = mockBeds.filter(b => b.type === "icu").slice(0, 8);
const pendingSignatures = [
  { id: "ps1", type: "Prescription", patient: "Anika Sharma", requestedBy: "Nurse Priya K.", urgency: "high", time: "08:42" },
  { id: "ps2", type: "Discharge Order", patient: "Rohan Iyer", requestedBy: "Ward Resident", urgency: "medium", time: "09:15" },
  { id: "ps3", type: "Lab Order", patient: "Karthik Rao", requestedBy: "Nurse Ananya V.", urgency: "low", time: "10:03" },
  { id: "ps4", type: "Consent Form", patient: "Meera Pillai", requestedBy: "Dr. Aanya Verma", urgency: "high", time: "10:28" },
];

const todayProcedures = [
  { id: "pr1", patient: "Anika Sharma", procedure: "Cardiac Catheterization", room: "Cath Lab 2", time: "11:00", status: "upcoming" },
  { id: "pr2", patient: "Rohan Iyer", procedure: "Hip Replacement (Left)", room: "OR-4", time: "13:30", status: "upcoming" },
  { id: "pr3", patient: "Deepak Joshi", procedure: "Appendectomy", room: "OR-2", time: "09:00", status: "in-progress" },
];

const emergencyAlerts = [
  { id: "ea1", msg: "Code Blue — ICU Bed B-07 — Anika Sharma", severity: "critical", time: "2 min ago" },
  { id: "ea2", msg: "Ambulance MH-01-AM-1003 arriving in 8 min (trauma case)", severity: "warning", time: "5 min ago" },
  { id: "ea3", msg: "Blood bank: O- critically low (<2 units)", severity: "warning", time: "12 min ago" },
];

function UrgencyDot({ urgency }: { urgency: string }) {
  const cls = urgency === "high" ? "bg-destructive" : urgency === "medium" ? "bg-warning" : "bg-muted-foreground";
  return <div className={`h-2 w-2 rounded-full shrink-0 ${cls}`} />;
}

function StaffCommandCenter() {
  const { patients: livePatients = [] } = useLivePatients();
  const criticalPatients = livePatients.filter(p => {
    return (p.conditions || []).some((c: string) => c.includes("Cardiac") || c.includes("COPD") || c.includes("Kidney")) || p.status === "inpatient";
  });

  const occupiedICU = icuBeds.filter(b => b.status === "occupied").length;
  const availableAmbulances = mockAmbulances.filter(a => a.status === "available").length;

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Staff Portal"
        title="Command Center"
        description="Real-time overview of critical patients, alerts, and pending actions"
      />

      <div className="p-6 space-y-6">
        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Critical Patients" value={criticalPatients.length} icon={HeartPulse} tone="destructive" delta="Requires immediate attention" />
          <StatCard label="ICU Occupied" value={`${occupiedICU}/${icuBeds.length}`} icon={Bed} tone="warning" delta="ICU capacity" />
          <StatCard label="Pending Signatures" value={pendingSignatures.length} icon={FileSignature} tone="default" delta="Awaiting your sign-off" />
          <StatCard label="Available Ambulances" value={availableAmbulances} icon={Ambulance} tone="success" delta="Ready for dispatch" />
        </div>

        {/* Alerts */}
        <StaggerList className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Live Alerts</div>
          {emergencyAlerts.map((a) => (
            <StaggerItem key={a.id}>
              <motion.div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${a.severity === "critical" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}`}
              >
                {a.severity === "critical" ? <ShieldAlert className="h-4 w-4 text-destructive shrink-0" /> : <AlertTriangle className="h-4 w-4 text-warning-foreground shrink-0" />}
                <span className="flex-1 text-sm text-foreground">{a.msg}</span>
                <span className="text-xs text-muted-foreground shrink-0">{a.time}</span>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerList>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pending signatures */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileSignature className="h-4 w-4 text-primary" />
              Pending Signatures ({pendingSignatures.length})
            </div>
            <div className="space-y-2">
              {pendingSignatures.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
                  <UrgencyDot urgency={s.urgency} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{s.type} — {s.patient}</div>
                    <div className="text-xs text-muted-foreground">{s.requestedBy}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">{s.time}</div>
                    <button className="mt-0.5 text-[10px] font-semibold text-primary hover:underline">Sign now</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's procedures */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Activity className="h-4 w-4 text-primary" />
              Today's Procedures
            </div>
            <div className="space-y-2">
              {todayProcedures.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${p.status === "in-progress" ? "bg-success" : "bg-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{p.procedure}</div>
                    <div className="text-xs text-muted-foreground">{p.patient} · {p.room}</div>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground shrink-0">{p.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ICU snapshot */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bed className="h-4 w-4 text-primary" />
            ICU Bed Occupancy Snapshot
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {icuBeds.map((b) => (
              <div
                key={b.id}
                title={b.patientName ?? b.status}
                className={`flex h-14 flex-col items-center justify-center rounded-xl text-center text-[10px] font-semibold transition-colors ${b.status === "occupied" ? "bg-primary/10 text-primary" : b.status === "available" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
              >
                <Bed className="h-4 w-4 mb-0.5" />
                {b.bedNo}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-primary" /> Occupied</span>
            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-success" /> Available</span>
            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-muted-foreground" /> Maintenance</span>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
