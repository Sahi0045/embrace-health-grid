import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { mockAuditEvents } from "@/lib/mock-audit";
import { infraStats } from "@/lib/mock-infrastructure";
import { mockCredentials } from "@/lib/mock-credentials";
import { systemStats } from "@/lib/mock-data";
import {
  ShieldCheck, AlertTriangle, Activity, Users, HeartPulse,
  TrendingUp, Bed, Ambulance, ShieldAlert, BarChart3
} from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/admin/command")({
  head: () => ({ meta: [{ title: "Command Center — Admin Console" }] }),
  component: AdminCommandCenter,
});

const hospitalHealthScore = 94;
const fraudAlerts = mockAuditEvents.filter(e => e.severity === "critical").slice(0, 3);
const recentSecurityAlerts = mockAuditEvents.filter(e => e.category === "auth" && e.result !== "success").slice(0, 3);

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? "#22c55e" : score >= 75 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex h-36 w-36 items-center justify-center mx-auto">
      <svg className="-rotate-90" width="136" height="136">
        <circle cx="68" cy="68" r={r} stroke="currentColor" strokeWidth="10" fill="none" className="text-muted" />
        <circle
          cx="68" cy="68" r={r}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-bold text-foreground">{score}</div>
        <div className="text-xs text-muted-foreground">/ 100</div>
      </div>
    </div>
  );
}

function AdminCommandCenter() {
  const activeCredentials = mockCredentials.filter(c => c.status === "active").length;
  const occupancyPct = Math.round((infraStats.occupiedBeds / infraStats.totalBeds) * 100);

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
          <StatCard label="Hospital Health Score" value={`${hospitalHealthScore}/100`} icon={HeartPulse} tone="success" delta="Excellent — all systems operational" />
          <StatCard label="Active Patients" value={systemStats.activeUsers.toLocaleString()} icon={Users} tone="default" delta="Across all wards" />
          <StatCard label="Credential Activity" value={activeCredentials.toLocaleString()} icon={ShieldCheck} tone="default" delta="Active credentials" />
          <StatCard label="Security Alerts" value={recentSecurityAlerts.length} icon={AlertTriangle} tone={recentSecurityAlerts.length > 2 ? "destructive" : "warning"} delta="Last 24 hours" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Hospital health score */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-clinical text-center">
            <div className="text-sm font-semibold text-foreground mb-4">Hospital Health Score</div>
            <ScoreRing score={hospitalHealthScore} />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div><div className="font-semibold text-success">96%</div><div className="text-muted-foreground">Compliance</div></div>
              <div><div className="font-semibold text-primary">84ms</div><div className="text-muted-foreground">API Latency</div></div>
              <div><div className="font-semibold text-chart-2">7/7</div><div className="text-muted-foreground">DID Nodes</div></div>
            </div>
          </div>

          {/* Infrastructure health */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
            <div className="text-sm font-semibold text-foreground mb-4">Infrastructure Health</div>
            <div className="space-y-3">
              {[
                { label: "Bed Occupancy", value: occupancyPct, color: "bg-primary" },
                { label: "Equipment Operational", value: Math.round(infraStats.operationalEquipment / infraStats.totalEquipment * 100), color: "bg-success" },
                { label: "Ambulance Availability", value: Math.round(infraStats.availableAmbulances / infraStats.totalAmbulances * 100), color: "bg-chart-2" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{item.label}</span>
                    <span className="font-medium text-foreground">{item.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.value}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full rounded-full ${item.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Staff status */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
            <div className="text-sm font-semibold text-foreground mb-4">Staff On Duty</div>
            <div className="space-y-3">
              {[
                { dept: "Emergency", count: 12, icon: "🚨" },
                { dept: "ICU", count: 8, icon: "🏥" },
                { dept: "Surgery", count: 6, icon: "⚕️" },
                { dept: "Cardiology", count: 7, icon: "❤️" },
                { dept: "General Ward", count: 18, icon: "🩺" },
              ].map((s) => (
                <div key={s.dept} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span>{s.icon}</span>
                    <span className="text-sm text-foreground">{s.dept}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{s.count} staff</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Security & fraud alerts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Fraud Alerts
            </div>
            <div className="space-y-2">
              {fraudAlerts.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground">{a.action}</div>
                    <div className="text-[11px] text-muted-foreground">{a.actor} · {a.at}</div>
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
              {recentSecurityAlerts.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2.5">
                  <AlertTriangle className="h-4 w-4 text-warning-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground">{a.action}</div>
                    <div className="text-[11px] text-muted-foreground">{a.actor} · {a.at}</div>
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
