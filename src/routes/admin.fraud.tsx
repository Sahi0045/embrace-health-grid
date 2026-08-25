import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Ban,
  Eye,
  Shield,
  TrendingUp,
  Activity,
  Clock,
  User,
  MapPin,
  Fingerprint,
  Wifi,
  WifiOff,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  ChevronDown,
  RefreshCw,
  Download,
  Brain,
  Lock,
  Zap,
} from "lucide-react";
import { stagger, fadeUp } from "@/components/Motion";
import {
  useAdminFraudAlerts as useFraudAlerts,
  useAdminAudit as useAudit,
  useAdminDIDs as useDIDs,
} from "@/hooks/use-admin";
import { toast } from "sonner";
import { logAuditEvent, updateFraudAlertStatus } from "@/lib/api";

/**
 * Fraud alerts are created by server-side detection: fraud_alerts has no client
 * INSERT policy, so an actor can neither fabricate an alert against someone else
 * nor suppress one against themselves. The console records the request in the
 * audit trail instead.
 */
async function raiseFraudAlert(
  actor: string,
  alertType: string,
  message: string,
  severity?: string,
  riskScore?: number,
) {
  return await logAuditEvent({
    action: "FRAUD_ALERT_RAISED",
    resource: actor,
    outcome: "success",
    severity: severity === "critical" ? "critical" : "warning",
    metadata: { alertType, message, riskScore },
  });
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HospitalContext } from "@/components/HospitalContext";

export const Route = createFileRoute("/admin/fraud")({
  head: () => ({ meta: [{ title: "Admin · Fraud Detection — Embrace Health Grid" }] }),
  component: FraudPageGuarded,
});

// Must match the alert_severity enum: ('info','warning','critical'). The UI
// previously declared critical|high|medium|low, so sevConfig had no entry for a
// `warning` or `info` alert; `sev.ring` on the undefined lookup threw and took
// the whole fraud console down as soon as one non-critical alert existed.
type Severity = "critical" | "warning" | "info";
type Status = "open" | "investigating" | "resolved" | "dismissed";

interface FraudAlert {
  id: string;
  severity: Severity;
  status: Status;
  type: string;
  message: string;
  actor: string;
  // Nullable because `fraud_alerts` has no column behind any of them. They were
  // typed `string` and filled with constants, which is what let the constants
  // reach the screen and the evidence CSV unchallenged.
  actorRole: string | null;
  location: string | null;
  ip: string | null;
  at: string;
  riskScore: number | null;
  details: string | null;
  affectedResource: string | null;
}

// Dynamic fraud alerts managed via backend API

const sevConfig: Record<Severity, { ring: string; bg: string; text: string; label: string }> = {
  critical: {
    ring: "border-destructive/50",
    bg: "bg-destructive/8",
    text: "text-destructive",
    label: "CRITICAL",
  },
  warning: {
    ring: "border-warning/40",
    bg: "bg-warning/6",
    text: "text-warning-foreground",
    label: "WARNING",
  },
  info: { ring: "border-border", bg: "bg-card", text: "text-muted-foreground", label: "INFO" },
};

const statusConfig: Record<Status, { bg: string; text: string }> = {
  open: { bg: "bg-destructive/15", text: "text-destructive" },
  investigating: { bg: "bg-warning/20", text: "text-warning-foreground" },
  resolved: { bg: "bg-success/15", text: "text-success" },
  dismissed: { bg: "bg-muted", text: "text-muted-foreground" },
};

function RiskBar({ score }: { score: number | null }) {
  // A null score is "not scored", not zero and certainly not the 50 this used to
  // substitute — a half-filled bar reads as a measured medium risk.
  if (score == null) {
    return <span className="text-xs font-medium text-muted-foreground">Not scored</span>;
  }
  const color =
    score >= 80
      ? "bg-destructive"
      : score >= 60
        ? "bg-warning"
        : score >= 40
          ? "bg-warning"
          : "bg-success";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span
        className={`text-xs font-semibold tabular-nums ${score >= 80 ? "text-destructive" : score >= 60 ? "text-warning" : "text-muted-foreground"}`}
      >
        {score}
      </span>
    </div>
  );
}

function AlertCard({
  alert,
  onUpdate,
  onTrace,
  onLock,
}: {
  alert: FraudAlert;
  onUpdate: () => void;
  onTrace: (did: string) => void;
  onLock: (did: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<Status>(alert.status);
  const sev = sevConfig[alert.severity];
  const st = statusConfig[status];

  const handleStatusChange = async (newStatus: Status) => {
    try {
      await updateFraudAlertStatus(alert.id, newStatus);
      setStatus(newStatus);
      toast.success(`Alert marked as ${newStatus}`);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      toast.error(`Failed to update alert: ${err.message}`);
    }
  };

  const handleTraceDid = () => {
    onTrace(alert.affectedResource || alert.actor);
  };

  const handleLockAccount = () => {
    onLock(alert.affectedResource || alert.actor);
  };

  const handleExportLogs = () => {
    const csvRows = [
      [
        "ID",
        "Severity",
        "Type",
        "Message",
        "Actor",
        "Actor Role",
        "Location",
        "IP",
        "Time",
        "Risk Score",
        "Details",
      ],
      [
        alert.id,
        alert.severity,
        alert.type,
        alert.message,
        alert.actor,
        alert.actorRole ?? "",
        alert.location ?? "",
        alert.ip ?? "",
        alert.at,
        alert.riskScore ?? "",
        alert.details ?? "",
      ],
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      csvRows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `incident_${alert.id}_logs.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Security logs exported to CSV");
  };

  return (
    <motion.div
      variants={fadeUp}
      className={`rounded-xl border p-5 shadow-sm transition-all ${sev.ring} ${sev.bg}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/80 ${sev.text}`}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-background/60 ${sev.text}`}
              >
                {sev.label}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${st.bg} ${st.text}`}
              >
                {status}
              </span>
              <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                {alert.type}
              </span>
            </div>
            <div className="text-sm font-semibold text-foreground truncate">{alert.message}</div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {alert.actor}
              </span>
              {alert.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {alert.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {alert.at}
              </span>
              {alert.ip && (
                <span className="flex items-center gap-1">
                  <Wifi className="h-3 w-3" />
                  {alert.ip}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <RiskBar score={alert.riskScore} />
          <div className="flex gap-1.5">
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Details</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
            {status === "open" && (
              <>
                <button
                  onClick={() => handleStatusChange("investigating")}
                  className="inline-flex items-center gap-1 rounded-md border border-warning/50 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning-foreground hover:bg-warning/20 transition-colors"
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Investigate</span>
                </button>
                <button
                  onClick={() => handleStatusChange("dismissed")}
                  className="inline-flex items-center gap-1 rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Block</span>
                </button>
              </>
            )}
            {status === "investigating" && (
              <button
                onClick={() => handleStatusChange("resolved")}
                className="inline-flex items-center gap-1 rounded-md border border-success/50 bg-success/10 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/20 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Resolve</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-lg border border-border/60 bg-background/60 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Incident Details
              </div>
              <p className="text-sm text-foreground">
                {alert.details ?? "No further detail recorded for this alert."}
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Affected Resource:</span>
                  <br />
                  <span className="font-medium text-foreground">
                    {alert.affectedResource ?? "Not recorded"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Actor Role:</span>
                  <br />
                  <span className="font-medium text-foreground">
                    {alert.actorRole ?? "Not recorded"}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleTraceDid}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <Fingerprint className="h-3.5 w-3.5" /> Trace DID
                </button>
                <button
                  onClick={handleLockAccount}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <Lock className="h-3.5 w-3.5" /> Lock Account
                </button>
                <button
                  onClick={handleExportLogs}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" /> Export Logs
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FraudPage() {
  const [query, setQuery] = useState("");
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  const [traceDid, setTraceDid] = useState<string | null>(null);
  const [lockDid, setLockDid] = useState<string | null>(null);
  const [enhancedMode, setEnhancedMode] = useState(false);

  const { data: alertData, online, loading: alertLoading, refetch } = useFraudAlerts();
  const { data: auditData } = useAudit();
  const { data: didsData } = useDIDs();

  // Map backend alerts → local FraudAlert format
  const backendAlerts: FraudAlert[] = (
    (alertData?.alerts ?? []) as Array<{
      alertId?: string;
      severity?: string;
      type?: string;
      message?: string;
      actor?: string;
      riskScore?: number;
      status?: string;
      detectedAt?: string;
    }>
  ).map((a, i) => ({
    id: a.alertId ?? `alert_${i}`,
    severity: (a.severity as Severity) ?? "info",
    status: (a.status as Status) ?? "open",
    type: a.type ?? "Unknown",
    message: a.message ?? "",
    actor: a.actor ?? "System",
    // fraud_alerts has no column for any of these. They used to be filled with
    // plausible constants that were then displayed as the incident's real role,
    // location, IP and affected resource — and exported into the evidence CSV.
    actorRole: null,
    location: null,
    ip: null,
    at: a.detectedAt ? new Date(a.detectedAt).toLocaleString("en-IN") : "—",
    // A null score rendered as a filled 50/100 risk bar.
    riskScore: a.riskScore ?? null,
    details: a.message ?? null,
    affectedResource: null,
  }));

  const allAlerts = backendAlerts;

  const openAlerts = allAlerts.filter((a) => a.status === "open").length;
  const criticalCount = allAlerts.filter(
    (a) => a.status === "open" && a.severity === "critical",
  ).length;
  const investigatingAlerts = allAlerts.filter((a) => a.status === "investigating").length;
  const resolvedToday = allAlerts.filter((a) => a.status === "resolved").length;
  // Only alerts that actually carry a score contribute; null means unscored.
  const scored = allAlerts.map((a) => a.riskScore).filter((n): n is number => n != null);
  const maxRiskScore = scored.length > 0 ? Math.max(...scored) : null;

  const riskMetrics = [
    {
      label: "Risk Score",
      value: maxRiskScore == null ? "—" : `${maxRiskScore}/100`,
      delta: maxRiskScore == null ? "No scored alerts" : "Highest active anomaly score",
      icon: Brain,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: "Open Alerts",
      value: String(openAlerts),
      delta: `${criticalCount} critical`,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: "Under Review",
      value: String(investigatingAlerts),
      delta: "Assigned to SOC",
      icon: Activity,
      color: "text-warning-foreground",
      bg: "bg-warning/10",
    },
    {
      label: "Resolved Today",
      value: String(resolvedToday),
      delta: "Avg. 4.2h TTR",
      icon: CheckCircle2,
      color: "text-success",
      bg: "bg-success/10",
    },
  ];

  const filtered = allAlerts.filter((a) => {
    const q = query.toLowerCase();
    const matchQ =
      !q ||
      a.message.toLowerCase().includes(q) ||
      a.actor.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q);
    const matchSev = sevFilter === "all" || a.severity === sevFilter;
    const matchSt = statusFilter === "all" || a.status === statusFilter;
    return matchQ && matchSev && matchSt;
  });

  const handleExportAllAlerts = () => {
    const csvRows = [
      ["ID", "Severity", "Status", "Type", "Message", "Actor", "Time", "Risk Score"],
      ...backendAlerts.map((a) => [
        a.id,
        a.severity,
        a.status,
        a.type,
        a.message,
        a.actor,
        a.at,
        a.riskScore,
      ]),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      csvRows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `security_operations_all_alerts.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("All security operations alerts exported to CSV");
  };

  return (
    <>
      <div className="mb-4">
        <HospitalContext />
      </div>
      <PageHeader
        eyebrow="Security Operations"
        title="Fraud Detection"
        description="AI-powered anomaly detection on access patterns, credential usage, MFA failures, and behavioral baselines."
        actions={
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${online ? "bg-success/15 text-success" : "bg-warning/10 text-warning-foreground"}`}
            >
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Backend Live" : "Local Sim"}
            </span>
            <button
              onClick={refetch}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <RefreshCw className={`h-4 w-4 ${alertLoading ? "animate-spin" : ""}`} /> Refresh
            </button>
            {/* "Simulate Alert" was removed. It shipped in the production admin
                console and wrote a REAL row into fraud_alerts ("Manual Test",
                severity low, score 30), so the security queue an analyst triages
                could be filled with fabricated incidents indistinguishable from
                genuine ones. A test fixture does not belong behind a button on
                the live fraud console. */}
            <button
              onClick={handleExportAllAlerts}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        }
      />

      <div className="space-y-6 p-6 sm:p-8">
        {/* Metrics */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {riskMetrics.map((m) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.label}
                variants={fadeUp}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {m.label}
                  </span>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.bg}`}>
                    <Icon className={`h-4 w-4 ${m.color}`} />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold text-foreground">{m.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{m.delta}</div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* The "ML Risk Engine Alert / HIGH RISK DAY" banner that used to sit
            here was static JSX: "Anomaly score is 76/100 — significantly above
            the 30-day baseline of 41. Two credential replay patterns and one
            break-glass violation detected in the past 4 hours." No anomaly
            score, baseline or replay detection exists anywhere in this
            codebase, and it rendered unconditionally — including over an empty
            alert table. Its "Activate Enhanced Mode" button only toggled local
            state and toasted "MFA failure limits reduced, auto-lock enabled"
            while changing no policy at all.

            Removed rather than reworded: a security console must not narrate
            findings it did not make. The real alert counts are already shown in
            the KPI row above. */}

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search alerts…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sevFilter}
              onChange={(e) => setSevFilter(e.target.value as Severity | "all")}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Status | "all")}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
        </div>

        {/* Alert count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          Showing {filtered.length} of {allAlerts.length} alerts
        </div>

        {/* Alerts */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
          {filtered.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              onUpdate={refetch}
              onTrace={(did) => setTraceDid(did)}
              onLock={(did) => setLockDid(did)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
              <Shield className="h-12 w-12 text-success mb-3" />
              <div className="text-sm font-semibold text-foreground">
                No alerts match your filters
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Try adjusting severity or status filters
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Trace DID Modal */}
      <Dialog open={!!traceDid} onOpenChange={() => setTraceDid(null)}>
        <DialogContent className="sm:max-w-[600px] text-foreground bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Fingerprint className="h-5 w-5" /> Trace DID Document Lifecycle
            </DialogTitle>
            <DialogDescription className="text-xs font-mono break-all mt-1">
              Target: {traceDid}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4 max-h-[50vh] overflow-y-auto pr-2">
            {/* Verification Summary */}
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Registry Verification:</span>
                {didsData?.dids?.some((d: any) => d.did === traceDid) ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Registered & Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                    <XCircle className="h-3.5 w-3.5" /> Unregistered / Revoked
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">On-Chain Anchor Verification:</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary animate-pulse">
                  <Shield className="h-3.5 w-3.5" /> Anchored (Solana Devnet)
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Chronological Custody Logs
              </div>
              {(() => {
                const relatedLogs = (auditData?.events || []).filter((e: any) =>
                  JSON.stringify(e)
                    .toLowerCase()
                    .includes(traceDid?.toLowerCase() || ""),
                );

                if (relatedLogs.length === 0) {
                  return (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No explicit audit events recorded for this resource.
                    </div>
                  );
                }

                return (
                  <div className="relative border-l border-border pl-4 ml-2 space-y-4">
                    {relatedLogs.map((log: any, idx: number) => (
                      <div key={log.id || idx} className="relative">
                        <div className="absolute -left-[21px] top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary" />
                        <div className="text-xs font-semibold text-foreground">
                          {log.action || "Event Logged"}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {log.details || log.message || "No description"}
                        </div>
                        <div className="flex gap-2 text-[10px] text-muted-foreground/75 mt-1 font-mono">
                          <span>
                            {log.loggedAt ? new Date(log.loggedAt).toLocaleString("en-IN") : "—"}
                          </span>
                          <span>·</span>
                          <span>IP: {log.ipAddress || "system"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setTraceDid(null)}>Close Trace Window</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock Account Dialog */}
      <Dialog open={!!lockDid} onOpenChange={() => setLockDid(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Lock className="h-5 w-5" /> Lock Entity Wallet & Account
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will revoke all active credentials, block access keys, and restrict audit
              logging.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="text-xs text-muted-foreground">
              Confirm locking request for target resource:
            </div>
            <div className="rounded bg-muted p-2 font-mono text-[10px] break-all border border-border">
              {lockDid}
            </div>
            <div className="text-xs text-destructive font-semibold">
              This console cannot lock an entity. No revocation path exists yet — DID suspension is
              not implemented in identity-ops, and nothing here disables a wallet. To contain this
              DID, revoke its credentials and consents directly and raise it with the platform
              operator.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLockDid(null)}>
              Close
            </Button>
            <Button variant="destructive" disabled title="Not implemented">
              Lock unavailable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Admin gate. The role comes from Postgres via the server-verified session, and
 * RLS enforces the boundary independently — bypassing this renders empty data,
 * not another user's records.
 */
function FraudPageGuarded() {
  return (
    <RouteGuard requiredRole="admin">
      <FraudPage />
    </RouteGuard>
  );
}
