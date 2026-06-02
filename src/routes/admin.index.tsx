import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { systemStats, fraudAlerts } from "@/lib/mock-data";
import { KeyRound, Users, ShieldCheck, Timer, ServerCog, Gauge } from "lucide-react";
import { RouteGuard } from "@/components/RouteGuard";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin · Overview — DID Hospital" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const s = systemStats;
  return (
    <RouteGuard requiredRole="admin">
    <>
      <PageHeader
        eyebrow="Admin console"
        title="System overview"
        description="Real-time health of the DID infrastructure and identity operations."
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total DIDs" value={s.totalDIDs.toLocaleString()} delta="+128 today" icon={KeyRound} />
          <StatCard label="Active users" value={s.activeUsers.toLocaleString()} delta="last 24h" icon={Users} />
          <StatCard label="Consents granted" value={s.consentsToday} delta="today" icon={ShieldCheck} tone="success" />
          <StatCard label="Avg. check-in" value={`${s.avgCheckInSec}s`} delta="↓ 74% vs. paper" icon={Timer} tone="success" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6 shadow-clinical">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ServerCog className="h-4 w-4 text-primary" /> Infrastructure
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              <Row label="Blockchain nodes" value={`${s.blockchainNodes.up}/${s.blockchainNodes.total} healthy`} good />
              <Row label="API latency" value={`${s.apiLatencyMs} ms p50`} good />
              <Row label="Queue depth" value="0 backlog" good />
              <Row label="Last backup" value="2h ago" good />
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-clinical">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Gauge className="h-4 w-4 text-primary" /> Compliance score
            </div>
            <div className="mt-6 text-center">
              <div className="text-5xl font-semibold text-foreground">{s.complianceScore}</div>
              <div className="text-xs text-muted-foreground">out of 100</div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success" style={{ width: `${s.complianceScore}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
              <div>HIPAA<br /><span className="font-semibold text-foreground">98</span></div>
              <div>GDPR<br /><span className="font-semibold text-foreground">95</span></div>
              <div>DPDP<br /><span className="font-semibold text-foreground">97</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <div className="text-sm font-semibold text-foreground">Active fraud alerts</div>
            <ul className="mt-4 space-y-3 text-sm">
              {fraudAlerts.map((a) => (
                <li key={a.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                        a.severity === "high" ? "bg-destructive/15 text-destructive"
                        : a.severity === "medium" ? "bg-warning/20 text-warning-foreground"
                        : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {a.severity}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{a.at}</span>
                  </div>
                  <div className="mt-2 text-xs text-foreground">{a.message}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{a.actor}</div>
                </li>
              ))}
            </ul>
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
