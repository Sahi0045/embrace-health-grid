import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import {
  useLivePatients,
  useAdminStats as useStats,
  useAdminBeds as useBeds,
  useAdminCredentials as useCredentials,
  useAdminFraudAlerts as useFraudAlerts,
  useAdminAudit as useAudit,
} from "@/hooks/use-admin";
import {
  ShieldCheck,
  AlertTriangle,
  Activity,
  Users,
  HeartPulse,
  TrendingUp,
  Bed,
  Ambulance,
  ShieldAlert,
  BarChart3,
} from "lucide-react";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { motion } from "framer-motion";

export const Route = createFileRoute("/admin/command")({
  head: () => ({ meta: [{ title: "Command Center — Admin Console" }] }),
  component: AdminCommandCenterGuarded,
});

// ScoreRing was removed with the Hospital Health Score panel it drew.

function AdminCommandCenter() {
  const { patients = [] } = useLivePatients();
  const { data: credentialsData } = useCredentials();
  const { data: bedsData } = useBeds();
  const { data: fraudData } = useFraudAlerts();
  const { data: auditData } = useAudit();

  // `x.length || N` reads as a default but is a fabrication: an EMPTY result is
  // falsy, so a hospital with no data reported 4 active patients, 12 active
  // credentials and 40% bed occupancy (8/20). Every one of those is zero.
  const activePatientsCount = patients.length;
  const activeCredentials = (credentialsData?.credentials || []).filter(
    (c: any) => c.status === "active" || c.status === "issued" || !c.status,
  ).length;

  // Beds occupancy
  const beds = bedsData?.beds || [];
  const occupiedBeds = beds.filter((b: any) => b.status === "occupied").length;
  const totalBeds = beds.length;
  // Guard the divide rather than inventing a denominator; 0/0 is "no data", not 0%.
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : null;

  // Security & fraud alerts
  // When there were no real alerts this used to render invented ones with named
  // actors and precise timestamps — "Unauthorised Patient DID Access Attempt ·
  // Node 4 (Mumbai) · 2 minutes ago". An admin would open an investigation into
  // an incident that never happened.
  const rawAlerts = fraudData?.alerts || [];
  const fraudAlerts = rawAlerts.slice(0, 3);

  // Same again: the fallback named a real-sounding clinician, "Dr. Sameer Khan",
  // as having triggered a break-glass override that never occurred.
  //
  // The outcome filter also matched "FAIL", which is not a value audit_events
  // ever holds — the enum is success | failure | unauthorized — so every failed
  // and unauthorized event was silently dropped from the security panel.
  const rawAudit = auditData?.events || [];
  const recentSecurityAlerts = rawAudit
    .filter(
      (a: any) =>
        a.action?.toLowerCase().includes("auth") ||
        a.outcome === "failure" ||
        a.outcome === "unauthorized",
    )
    .slice(0, 3);

  return (
    <RouteGuard requiredRole="admin">
      <PageHeader
        eyebrow="Admin Console"
        title="Command Center"
        description="Executive overview of hospital health, security, and operations"
      />

      <div className="p-6 space-y-6">
        {/* Top KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* "Hospital Health Score 96/100 — Excellent, all systems operational"
              was a module constant, `const hospitalHealthScore = 96`. It was the
              first and largest number on the executive console and nothing
              computed it. Replaced with a figure that is actually measured. */}
          <StatCard
            label="Beds Occupied"
            value={totalBeds > 0 ? `${occupiedBeds} / ${totalBeds}` : "No data"}
            icon={HeartPulse}
            tone={occupancyPct != null && occupancyPct >= 90 ? "destructive" : "default"}
            delta={occupancyPct != null ? `${occupancyPct}% occupancy` : "No beds recorded"}
          />
          <StatCard
            label="Active Patients"
            value={activePatientsCount.toLocaleString()}
            icon={Users}
            tone="default"
            delta="Across all wards"
          />
          <StatCard
            label="Credential Activity"
            value={activeCredentials.toLocaleString()}
            icon={ShieldCheck}
            tone="default"
            delta="Active credentials"
          />
          <StatCard
            label="Security Alerts"
            value={recentSecurityAlerts.length}
            icon={AlertTriangle}
            tone={recentSecurityAlerts.length > 2 ? "destructive" : "warning"}
            delta="Last 24 hours"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* The Hospital Health Score ring and its three sub-metrics —
              "96% Compliance", "84ms API Latency", "7/7 DID Nodes" — were all
              literals in JSX. None of compliance, API latency or DID node health
              is measured anywhere in this codebase. The panel is removed rather
              than reworded: an executive overview that invents its headline
              metric is worse than one metric short. */}

          {/* Infrastructure health */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
            <div className="text-sm font-semibold text-foreground mb-4">Infrastructure Health</div>
            <div className="space-y-3">
              {[
                // "Equipment Operational 92%" and "Ambulance Availability 80%"
                // were hardcoded numbers rendered as filled progress bars. Only
                // bed occupancy is derived from anything real, so only it stays.
                { label: "Bed Occupancy", value: occupancyPct, color: "bg-primary" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{item.label}</span>
                    <span className="font-medium text-foreground">
                      {item.value == null ? "No data" : `${item.value}%`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.value ?? 0}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full rounded-full ${item.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* The "Staff On Duty" table listed five departments with fixed
              headcounts (Emergency 12, ICU 8, Surgery 6, Cardiology 7, General
              Ward 18). They were literals — no attendance or roster query backs
              this page — so the console reported the same staffing regardless of
              who was actually on shift. Removed until it can be sourced from
              `attendance`. */}
        </div>

        {/* Security & fraud alerts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Fraud Alerts
            </div>
            <div className="space-y-2">
              {fraudAlerts.map((a: any) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5"
                >
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground">{a.action}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.actor} · {a.at}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Activity className="h-4 w-4 text-primary" />
              Security Alerts
            </div>
            <div className="space-y-2">
              {recentSecurityAlerts.map((a: any) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2.5"
                >
                  <AlertTriangle className="h-4 w-4 text-warning-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground">{a.action}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.actor} · {a.at}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}

/**
 * Admin gate. The role comes from Postgres via the server-verified session, and
 * RLS enforces the boundary independently — bypassing this renders empty data,
 * not another user's records.
 */
function AdminCommandCenterGuarded() {
  return (
    <RouteGuard requiredRole="admin">
      <AdminCommandCenter />
    </RouteGuard>
  );
}
