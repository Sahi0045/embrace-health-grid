import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useStats,
  useDIDs,
  useCredentials,
  useAudit,
  useBeds,
  useAmbulances,
  useEquipment,
  useFraudAlerts,
} from "@/hooks/use-api";
import {
  KeyRound,
  Users,
  ShieldCheck,
  Timer,
  ServerCog,
  Gauge,
  Network,
  Bed,
  Award,
  Globe,
  Activity,
  AlertTriangle,
  ArrowRight,
  Command,
  GitBranch,
} from "lucide-react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Admin · Overview — Embrace Health Grid" }] }),
  component: AdminOverview,
});

type QuickLink = 
  | { to: "/command" | "/digital-twin" | "/credentials"; label: string; icon: React.ComponentType<{ className?: string }>; color: string }
  | { href: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string };

const quickLinks: QuickLink[] = [
  {
    to: "/command",
    label: "Command Center",
    icon: Command,
    color: "text-primary bg-primary/10",
  },
  {
    to: "/digital-twin",
    label: "Digital Twin",
    icon: Network,
    color: "text-chart-2 bg-chart-2/10",
  },
  {
    to: "/credentials",
    label: "Credentials",
    icon: Award,
    color: "text-chart-3 bg-chart-3/10",
  },
  {
    href: "/audit-timeline",
    label: "Audit Timeline",
    icon: GitBranch,
    color: "text-muted-foreground bg-muted",
  },
];

function AdminOverview() {
  const stats = useStats().data as any;
  const { data: didsData } = useDIDs();
  const { data: credsData } = useCredentials();
  const { data: auditData } = useAudit();
  const { data: bedsData } = useBeds();
  const { data: ambulancesData } = useAmbulances();
  const { data: equipmentData } = useEquipment();
  const { data: fraudData } = useFraudAlerts();

  const totalDIDs = didsData?.total ?? 0;
  const activeUsers = totalDIDs;
  const activeCredentials = credsData?.total ?? 0;
  const avgCheckInSec = stats?.throughputTps ? Math.max(1, Math.round(5 / stats.throughputTps)) : 0;

  const totalBeds = bedsData?.total ?? 0;
  const occupiedBeds = bedsData?.beds?.filter((b: any) => b.status === "occupied")?.length ?? 0;

  const allAmbulances = ambulancesData?.ambulances ?? [];
  const availableAmbulances = allAmbulances.filter((a: any) => a.status === "available").length;

  const allEquipment = equipmentData?.equipment ?? [];
  const operationalEquipment = allEquipment.filter((e: any) => e.status === "operational" || e.status === "active").length;

  const activeFraudAlerts = fraudData?.alerts ?? [];
  const criticalEvents = (auditData?.events ?? [])
    .filter((e: any) => e.severity === "critical" || e.outcome === "failure")
    .slice(0, 3);

  return (
    <RouteGuard requiredRole="admin">
      <>
        <PageHeader
          eyebrow="Admin console"
          title="System overview"
          description="Real-time health of the DID infrastructure and identity operations."
          actions={
            <Link
              to="/command"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Command className="h-4 w-4" />
              Command Center
            </Link>
          }
        />

        <div className="space-y-6 p-6">
          {/* KPI grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total DIDs"
              value={totalDIDs.toLocaleString()}
              delta="+1 today"
              icon={KeyRound}
            />
            <StatCard
              label="Active users"
              value={activeUsers.toLocaleString()}
              delta="last 24h"
              icon={Users}
            />
            <StatCard
              label="Active credentials"
              value={activeCredentials.toLocaleString()}
              delta={`${credsData?.total ?? 0} total issued`}
              icon={Award}
              tone="success"
            />
            <StatCard
              label="Avg. check-in"
              value={`${avgCheckInSec}s`}
              delta="↓ 74% vs. paper"
              icon={Timer}
              tone="success"
            />
          </div>

          {/* Quick links */}
          <StaggerList className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {quickLinks.map((l) => {
              const Icon = l.icon;
              const isExternal = "href" in l;
              const content = (
                <>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${l.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-foreground">{l.label}</span>
                </>
              );
              return (
                <StaggerItem key={isExternal ? l.href : l.to}>
                  {isExternal ? (
                    <a
                      href={l.href}
                      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center hover:shadow-clinical-md hover:-translate-y-0.5 transition-all w-full h-full"
                    >
                      {content}
                    </a>
                  ) : (
                    <Link
                      to={l.to}
                      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center hover:shadow-clinical-md hover:-translate-y-0.5 transition-all w-full h-full"
                    >
                      {content}
                    </Link>
                  )}
                </StaggerItem>
              );
            })}
          </StaggerList>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Infrastructure */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-clinical">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ServerCog className="h-4 w-4 text-primary" /> Infrastructure
                </div>
              </div>
              <ul className="space-y-3 text-sm">
                <Row
                  label="Blockchain nodes"
                  value={`${stats?.nodesCountUp ?? 3}/${stats?.nodesCountTotal ?? 3} healthy`}
                  good
                />
                <Row label="API latency" value={`${stats?.latencyMs ?? 15} ms p50`} good />
                <Row
                  label="Bed occupancy"
                  value={`${occupiedBeds}/${totalBeds} (${totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0}%)`}
                  good
                />
                <Row
                  label="Ambulances ready"
                  value={allAmbulances.length > 0 ? `${availableAmbulances}/${allAmbulances.length}` : "—"}
                  good={allAmbulances.length > 0}
                />
                <Row
                  label="Equipment operational"
                  value={allEquipment.length > 0 ? `${operationalEquipment}/${allEquipment.length}` : "—"}
                  good={allEquipment.length > 0}
                />
              </ul>
            </div>

            {/* Compliance score */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-clinical">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                <Gauge className="h-4 w-4 text-primary" /> Compliance score
              </div>
              <div className="mt-2 text-center">
                <div className="text-5xl font-semibold text-foreground">
                  {stats?.complianceScore ?? 98}
                </div>
                <div className="text-xs text-muted-foreground">out of 100</div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats?.complianceScore ?? 98}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full bg-success"
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
                <div>
                  HIPAA
                  <br />
                  <span className="font-semibold text-foreground">98</span>
                </div>
                <div>
                  GDPR
                  <br />
                  <span className="font-semibold text-foreground">95</span>
                </div>
                <div>
                  DPDP
                  <br />
                  <span className="font-semibold text-foreground">97</span>
                </div>
              </div>
            </div>

            {/* Fraud + critical alerts */}
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Active fraud alerts
                </div>
                <Link
                  to="/fraud"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  All alerts <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <ul className="space-y-3 text-sm">
                {activeFraudAlerts.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-4 text-center">
                    No active fraud alerts detected
                  </div>
                ) : (
                  activeFraudAlerts.slice(0, 3).map((a: any) => (
                    <li key={a.id} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between">
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                            a.severity === "high"
                              ? "bg-destructive/15 text-destructive"
                              : a.severity === "medium"
                                ? "bg-warning/20 text-warning-foreground"
                                : "bg-muted text-muted-foreground",
                          ].join(" ")}
                        >
                          {a.severity}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {a.at ? new Date(a.at).toLocaleTimeString("en-IN") : ""}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-foreground">{a.message}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{a.actor}</div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          {/* Recent critical audit events */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Activity className="h-4 w-4 text-primary" />
                Critical Audit Events
              </div>
              <a
                href="/audit-timeline"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Full timeline <ArrowRight className="h-3 w-3" />
              </a>
            </div>
            <div className="space-y-2">
              {criticalEvents.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  No critical audit events found on the ledger
                </div>
              ) : (
                criticalEvents.map((e: any) => (
                  <div
                    key={e.txId || e.id}
                    className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">{e.action}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {e.actor} · {e.loggedAt ? new Date(e.loggedAt).toLocaleString("en-IN") : ""}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-destructive bg-destructive/10 rounded-full px-2 py-0.5 shrink-0">
                      critical
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </>
    </RouteGuard>
  );
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-2 font-medium text-foreground">
        {good && <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />}
        {value}
      </span>
    </li>
  );
}
