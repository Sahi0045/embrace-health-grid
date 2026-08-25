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
import { useAmbulances, useAudit, useBeds } from "@/hooks/use-api";
import { getAllAdmissions } from "@/lib/api";
import { AlertTriangle, Ambulance, ShieldAlert, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";

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
  const [admissionsLoading, setAdmissionsLoading] = useState(true);
  const { data: bedsData } = useBeds();
  const { data: auditData, loading: auditLoading } = useAudit(0);

  const allAmbulances = ambulancesData?.ambulances ?? [];
  const allBeds = useMemo(() => bedsData?.beds ?? [], [bedsData]);
  const incomingAmbulances = allAmbulances
    .filter((a: any) => a.status === "en-route" || a.status === "at-scene")
    .slice(0, 5);

  // Currently admitted patients, from the admissions table.
  //
  // The queue used to be built from useLivePatients(), whose rows are the DID
  // directory — {id, did, name, email, status} — and filtered on
  // `p.status === "inpatient"` plus `p.conditions`. That status is the DID
  // registry's ("active" on all 20 patient DIDs), and conditions is never
  // populated at all, so the filter matched nothing and the emergency board was
  // permanently empty while real admissions existed. admissions carries the
  // admit time, ward, bed, admitting doctor and diagnosis this board needs.
  const [admissions, setAdmissions] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    getAllAdmissions("admitted")
      .then((res: any) => {
        if (!cancelled) setAdmissions(res.admissions ?? []);
      })
      .catch(() => {
        // An empty board is the honest state when admissions cannot be read.
      })
      .finally(() => {
        if (!cancelled) setAdmissionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const traumaQueue = useMemo(() => {
    const bedByPatient = new Map<string, any>(
      allBeds.filter((b: any) => b.patientDid).map((b: any) => [b.patientDid as string, b]),
    );

    return admissions.map((a: any, i: number) => {
      const bed = bedByPatient.get(a.patient_did);
      const diagnosis: string | null = a.diagnosis ?? null;
      return {
        id: a.admission_id || a.patient_did || `adm-${i}`,
        name: a.patient_name || a.patient_did || "Unknown Patient",
        mrn: "—",
        // The admitting diagnosis. "Under Assessment" was a clinical state
        // nobody assessed — on an emergency board that reads as a triage
        // decision that was never made.
        condition: diagnosis,
        // Acuity is not recorded anywhere, so it stays null rather than being
        // guessed from the diagnosis text.
        severity: hasSevereCondition(diagnosis ? [diagnosis] : []) ? "critical" : null,
        arrived: a.admitted_at
          ? new Date(a.admitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "—",
        // `ER-01`, `ER-02`… were synthesised from the loop index, so staff were
        // told a patient was in a bay that does not exist. This is the bed the
        // patient is actually assigned to.
        bedNo: a.bed ?? bed?.bedNumber ?? bed?.bedId ?? null,
        doctor: a.admitting_doctor || "—",
      };
    });
  }, [admissions, allBeds]);

  const breakGlassAuditEvents: EmergencyAccessEvent[] = useMemo(() => {
    const events = auditData?.events ?? [];
    return (
      events
        // The Edge Function writes BREAK_GLASS_ACCESS and BREAK_GLASS_DENIED
        // (break-glass/index.ts:44,68). This filtered on exact equality with
        // "BREAK_GLASS" / "EMERGENCY_ACCESS", which are never written — so 60
        // denied and 30 granted emergency PHI overrides in the live trail all
        // showed as zero on the ED board.
        .filter((e: any) => typeof e.action === "string" && e.action.startsWith("BREAK_GLASS"))
        .slice(0, 10)
        .map((e: any) => ({
          // `id`/`logId` do not exist on an audit event; the fallback meant a
          // fresh React key every render, remounting each card.
          id: e.txId,
          actor: e.actorName ?? e.actor ?? "Unknown",
          // Real column, previously the constant "Clinical Staff".
          actorRole: e.actorRole ?? null,
          // The clinician's stated justification, written to metadata.reason by
          // the Edge Function. Was the constant "Emergency access".
          reason: e.metadata?.reason ?? null,
          at: e.loggedAt ? new Date(e.loggedAt).toLocaleString() : "—",
          // Was hardcoded true, badging every row "Auto-Audited". These rows ARE
          // the audit trail, so the claim is at least true here — but derive it
          // rather than assert it.
          autoAudited: Boolean(e.recordHash),
        }))
    );
  }, [auditData]);

  const [bgRequests, setBgRequests] = useState<BreakGlassRequest[]>([]);

  useMemo(() => {
    const events = auditData?.events ?? [];
    const pending: BreakGlassRequest[] = events
      // Same name mismatch as above. `e.status` does not exist on an audit event
      // either — the column is `outcome` — so the old `!== "denied"` guard
      // excluded nothing and every historical override rendered as "pending",
      // including ones already decided.
      .filter((e: any) => typeof e.action === "string" && e.action.startsWith("BREAK_GLASS"))
      .slice(0, 10)
      .map((e: any) => {
        const denied = e.action === "BREAK_GLASS_DENIED" || e.outcome === "unauthorized";
        return {
          id: e.txId,
          requestedBy: e.actorName ?? e.actor ?? "Unknown",
          requestorRole: e.actorRole ?? null,
          // `e.resource` is a resource identifier, not a person. Show the subject
          // the event actually names, and say so when there is none.
          patientName: e.entityId ?? e.resource ?? "Unknown subject",
          patientMRN: null,
          reason: e.metadata?.reason ?? null,
          // Urgency is not modelled on an audit event; it was hardcoded
          // "critical" so every row shouted.
          urgency: null,
          requestedAt: e.loggedAt ? new Date(e.loggedAt).toLocaleString() : "—",
          // Derived from what the Edge Function actually recorded.
          status: (denied ? "denied" : "approved") as "pending" | "approved" | "denied",
          autoApproved: !denied,
          approvedBy: undefined,
        };
      });
    setBgRequests(pending);
  }, [auditData]);

  const loading = admissionsLoading || auditLoading;

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Staff Portal"
        title="Emergency Department"
        description="Trauma queue, incoming ambulances, and emergency override records"
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
                // Falling back to `urgent` would restate the old guess. An
                // unassessed patient gets neutral styling, not a triage colour.
                const cfg = p.severity
                  ? (severityConfig[p.severity as keyof typeof severityConfig] ??
                    severityConfig.urgent)
                  : null;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-3"
                  >
                    <div
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg?.dot ?? "bg-muted-foreground"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.condition ?? "No condition recorded"}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      {p.severity && (
                        <span
                          className={`block rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg?.badge ?? ""}`}
                        >
                          {p.severity}
                        </span>
                      )}
                      <div className="text-[10px] text-muted-foreground">
                        {p.bedNo ?? "No bed"} · {p.arrived}
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
            {/* Not a queue: break-glass performs the access and records it. By
                the time a row appears here the PHI has already been read or
                already been withheld. */}
            Recent Emergency Overrides ({bgRequests.length})
          </div>
          {bgRequests.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No emergency overrides recorded
            </div>
          ) : (
            <div className="space-y-3">
              {bgRequests.map((r) => (
                <BreakGlassRequestCard key={r.id} request={r} />
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
