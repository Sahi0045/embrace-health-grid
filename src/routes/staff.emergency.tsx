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
import { useAmbulances, useLivePatients, useAudit, useBeds } from "@/hooks/use-api";
import { AlertTriangle, Ambulance, ShieldAlert, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/staff/emergency")({
  head: () => ({ meta: [{ title: "Emergency — Staff Portal" }] }),
  component: StaffEmergencyPage,
});

const severityConfig = {
  critical: { badge: "bg-destructive/15 text-destructive", dot: "bg-destructive" },
  urgent: { badge: "bg-warning/10 text-warning-foreground", dot: "bg-warning" },
  warning: { badge: "bg-chart-2/10 text-chart-2", dot: "bg-chart-2" },
};

function hasSevereCondition(conditions?: string[]): boolean {
  return (conditions || []).some(
    (c) => c.includes("Cardiac") || c.includes("Trauma") || c.includes("Respiratory"),
  );
}

function StaffEmergencyPage() {
  const { data: ambulancesData } = useAmbulances();
  const { patients: livePatients = [], loading: patientsLoading } = useLivePatients();
  const { data: bedsData } = useBeds();
  const { data: auditData, loading: auditLoading } = useAudit(0);

  const allAmbulances = ambulancesData?.ambulances ?? [];
  const allBeds = bedsData?.beds ?? [];
  const incomingAmbulances = allAmbulances
    .filter((a: any) => a.status === "en-route" || a.status === "at-scene")
    .slice(0, 5);

  const traumaQueue = useMemo(() => {
    const emergencyBeds = allBeds.filter(
      (b: any) =>
        b.ward?.toLowerCase().includes("er") || b.ward?.toLowerCase().includes("emergency"),
    );
    const emergencyPatients = livePatients.filter((p) => {
      const isInpatient = p.status === "inpatient";
      const hasSevereCond = (p.conditions || []).some(
        (c: string) =>
          c.includes("Cardiac") ||
          c.includes("Trauma") ||
          c.includes("COPD") ||
          c.includes("Fracture") ||
          c.includes("Respiratory"),
      );
      return isInpatient || hasSevereCond;
    });

    return emergencyPatients.map((p, i) => {
      const bed = emergencyBeds[i];
      return {
        id: p.did || `er-${i}`,
        name: p.name || "Unknown Patient",
        mrn: p.mrn || "—",
        condition: (p.conditions || []).join(", ") || "Under Assessment",
        severity: hasSevereCondition(p.conditions) ? "critical" : "urgent",
        arrived: p.admitDate
          ? new Date(p.admitDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "—",
        bedNo: bed?.bedId || `ER-${String(i + 1).padStart(2, "0")}`,
        doctor: p.primaryDoctor || "—",
      };
    });
  }, [livePatients, allBeds]);

  const breakGlassAuditEvents: EmergencyAccessEvent[] = useMemo(() => {
    const events = auditData?.events ?? [];
    return events
      .filter((e: any) => e.action === "BREAK_GLASS" || e.action === "EMERGENCY_ACCESS")
      .slice(0, 10)
      .map((e: any) => ({
        id: e.id ?? e.logId ?? String(Math.random()),
        actor: e.actor ?? e.email ?? "Unknown",
        actorRole: e.role ?? "Clinical Staff",
        reason: e.reason ?? e.details ?? "Emergency access",
        at: e.loggedAt ? new Date(e.loggedAt).toLocaleString() : "—",
        autoAudited: true,
      }));
  }, [auditData]);

  const [bgRequests, setBgRequests] = useState<BreakGlassRequest[]>([]);

  useMemo(() => {
    const events = auditData?.events ?? [];
    const pending: BreakGlassRequest[] = events
      .filter(
        (e: any) =>
          (e.action === "BREAK_GLASS_REQUEST" || e.action === "BREAK_GLASS") &&
          e.status !== "denied",
      )
      .slice(0, 10)
      .map((e: any) => ({
        id: e.id ?? e.logId ?? String(Math.random()),
        requestedBy: e.actor ?? e.email ?? "Unknown",
        requestorRole: e.role ?? "Clinical Staff",
        patientName: e.resource ?? "Unknown Patient",
        patientMRN: e.mrn ?? "—",
        reason: e.reason ?? e.details ?? "Emergency override requested",
        urgency: "critical" as const,
        requestedAt: e.loggedAt ? new Date(e.loggedAt).toLocaleString() : "—",
        status: (e.status ?? "pending") as "pending" | "approved" | "denied",
        autoApproved: e.status === "approved",
        approvedBy: e.approvedBy,
      }));
    setBgRequests(pending);
  }, [auditData]);

  const loading = patientsLoading || auditLoading;

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Staff Portal"
        title="Emergency Department"
        description="Trauma queue, incoming ambulances, and emergency override requests"
      />

      <div className="p-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading emergency data…
          </div>
        )}

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
              value: breakGlassAuditEvents.length,
              color: "text-primary bg-primary/10",
            },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-4 text-center ${s.color}`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs font-medium mt-0.5 opacity-80">{s.label}</div>
            </div>
          ))}
        </div>

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

        <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Trauma Queue ({traumaQueue.length})
          </div>
          {traumaQueue.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No active trauma cases
            </div>
          ) : (
            <div className="space-y-2">
              {traumaQueue.map((p) => {
                const cfg =
                  severityConfig[p.severity as keyof typeof severityConfig] ??
                  severityConfig.urgent;
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
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Emergency Override Requests ({bgRequests.length})
          </div>
          {bgRequests.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No pending override requests
            </div>
          ) : (
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
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
            Audit Log — Break-Glass History
          </div>
          {breakGlassAuditEvents.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No break-glass events recorded
            </div>
          ) : (
            <div className="space-y-3">
              {breakGlassAuditEvents.map((e) => (
                <EmergencyAccessCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
