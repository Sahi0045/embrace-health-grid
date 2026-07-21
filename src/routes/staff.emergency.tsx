import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import {
  EmergencyAccessCard,
  type EmergencyAccessEvent,
} from "@/components/emergency/EmergencyAccessCard";
import {
  BreakGlassRequestCard,
  type BreakGlassRequest,
} from "@/components/emergency/BreakGlassRequestCard";
import { useAmbulances } from "@/hooks/use-api";
import { AlertTriangle, Ambulance, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export const Route = createFileRoute("/staff/emergency")({
  head: () => ({ meta: [{ title: "Emergency — Staff Portal" }] }),
  component: StaffEmergencyPage,
});

const traumaQueue = [
  {
    id: "t1",
    name: "Unknown Male ~40y",
    condition: "Polytrauma — RTA",
    severity: "critical",
    arrived: "10:22",
    bedNo: "ER-01",
    doctor: "Dr. Priya Nair",
  },
  {
    id: "t2",
    name: "Sunita Verma",
    mrn: "MRN-208441",
    condition: "Acute MI",
    severity: "critical",
    arrived: "10:35",
    bedNo: "ER-02",
    doctor: "Dr. Ravi Menon",
  },
  {
    id: "t3",
    name: "Arjun Mehta",
    mrn: "MRN-209001",
    condition: "Acute Appendicitis",
    severity: "urgent",
    arrived: "09:48",
    bedNo: "ER-05",
    doctor: "Dr. Kiran Bose",
  },
  {
    id: "t4",
    name: "Kavya Reddy",
    mrn: "MRN-206114",
    condition: "Fractured Femur — Fall",
    severity: "urgent",
    arrived: "09:15",
    bedNo: "ER-07",
    doctor: "Dr. Priya Nair",
  },
  {
    id: "t5",
    name: "Elderly Male ~72y",
    condition: "Respiratory Distress",
    severity: "warning",
    arrived: "08:30",
    bedNo: "ER-11",
    doctor: "Dr. Sameer Khan",
  },
];

const breakGlassRequests: EmergencyAccessEvent[] = [
  {
    id: "bg1",
    actor: "Dr. Priya Nair",
    actorRole: "ER Physician",
    reason: "Unconscious polytrauma patient, no consent, need allergy + blood group",
    at: new Date(Date.now() - 4 * 60 * 60 * 1000).toLocaleString().replace(/\//g, "-"),
    autoAudited: true,
  },
  {
    id: "bg2",
    actor: "Dr. Ravi Menon",
    actorRole: "Cardiologist",
    reason: "STEMI patient, urgent medication history needed",
    at: new Date(Date.now() - 3 * 60 * 60 * 1000).toLocaleString().replace(/\//g, "-"),
    autoAudited: true,
  },
];

const pendingBreakGlass: BreakGlassRequest[] = [
  {
    id: "pbg1",
    requestedBy: "Dr. Sameer Khan",
    requestorRole: "General Physician",
    patientName: "Unknown Male ~40y",
    patientMRN: "MRN-UNKNOWN",
    reason: "Unconscious trauma patient — need full medical history and allergies",
    urgency: "critical",
    requestedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toLocaleString().replace(/\//g, "-"),
    status: "pending",
    autoApproved: false,
  },
  {
    id: "pbg2",
    requestedBy: "Nurse Priya K.",
    requestorRole: "ICU Nursing",
    patientName: "Sunita Verma",
    patientMRN: "MRN-208441",
    reason: "Cardiac arrest — need medication contraindications immediately",
    urgency: "critical",
    requestedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toLocaleString().replace(/\//g, "-"),
    status: "approved",
    autoApproved: true,
    approvedBy: "System (Auto — Critical)",
  },
];

const severityConfig = {
  critical: { badge: "bg-destructive/15 text-destructive", dot: "bg-destructive" },
  urgent: { badge: "bg-warning/10 text-warning-foreground", dot: "bg-warning" },
  warning: { badge: "bg-chart-2/10 text-chart-2", dot: "bg-chart-2" },
};

function StaffEmergencyPage() {
  const [bgRequests, setBgRequests] = useState(pendingBreakGlass);
  const { data: ambulancesData } = useAmbulances();
  const allAmbulances = ambulancesData?.ambulances ?? [];
  const incomingAmbulances = allAmbulances
    .filter((a: any) => a.status === "en-route" || a.status === "at-scene")
    .slice(0, 3);

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Staff Portal"
        title="Emergency Department"
        description="Trauma queue, incoming ambulances, and emergency override requests"
      />

      <div className="p-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: "Trauma Cases",
              value: traumaQueue.length,
              color: "text-destructive bg-destructive/10",
            },
            {
              label: "Critical",
              value: traumaQueue.filter((t) => t.severity === "critical").length,
              color: "text-destructive bg-destructive/10",
            },
            {
              label: "Incoming Ambulances",
              value: incomingAmbulances.length,
              color: "text-warning-foreground bg-warning/10",
            },
            {
              label: "Break-Glass Today",
              value: breakGlassRequests.length,
              color: "text-primary bg-primary/10",
            },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-4 text-center ${s.color}`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs font-medium mt-0.5 opacity-80">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Ambulance arrivals */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Ambulance className="h-4 w-4 text-destructive" />
            Incoming Ambulances
          </div>
          {incomingAmbulances.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No incoming ambulances
            </div>
          ) : (
            <div className="space-y-2">
              {incomingAmbulances.map((a: any) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 rounded-lg bg-warning/5 border border-warning/20 px-3 py-2.5"
                >
                  <div className="h-2 w-2 rounded-full bg-warning animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{a.vehicleNo}</div>
                    <div className="text-xs text-muted-foreground">{a.location}</div>
                  </div>
                  <span className="text-[10px] font-semibold text-warning-foreground bg-warning/15 rounded-full px-2 py-0.5">
                    {a.status.replace("-", " ")}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Trauma Queue */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Trauma Queue ({traumaQueue.length})
          </div>
          <div className="space-y-2">
            {traumaQueue.map((p) => {
              const cfg = severityConfig[p.severity as keyof typeof severityConfig];
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-3"
                >
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.condition}</div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <span
                      className={`block rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badge}`}
                    >
                      {p.severity}
                    </span>
                    <div className="text-[10px] text-muted-foreground">
                      {p.bedNo} · {p.arrived}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Break-glass requests */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Emergency Override Requests ({bgRequests.length})
          </div>
          <div className="space-y-3">
            {bgRequests.map((r) => (
              <BreakGlassRequestCard
                key={r.id}
                request={r}
                onApprove={(id) =>
                  setBgRequests((prev) =>
                    prev.map((x) => (x.id === id ? { ...x, status: "approved" as const } : x)),
                  )
                }
                onDeny={(id) =>
                  setBgRequests((prev) =>
                    prev.map((x) => (x.id === id ? { ...x, status: "denied" as const } : x)),
                  )
                }
              />
            ))}
          </div>
        </div>

        {/* Historical break-glass log */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
            Audit Log — Break-Glass History
          </div>
          <div className="space-y-3">
            {breakGlassRequests.map((e) => (
              <EmergencyAccessCard key={e.id} event={e} />
            ))}
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
