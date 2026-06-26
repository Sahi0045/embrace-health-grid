import { createFileRoute } from "@tanstack/react-router";
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
import { useFraudAlerts } from "@/hooks/use-api";
import { raiseFraudAlert, logAuditEvent } from "@/lib/api";

export const Route = createFileRoute("/fraud")({
  head: () => ({ meta: [{ title: "Admin · Fraud Detection — DID Hospital" }] }),
  component: FraudPage,
});

type Severity = "critical" | "high" | "medium" | "low";
type Status = "open" | "investigating" | "resolved" | "dismissed";

interface FraudAlert {
  id: string;
  severity: Severity;
  status: Status;
  type: string;
  message: string;
  actor: string;
  actorRole: string;
  location: string;
  ip: string;
  at: string;
  riskScore: number;
  details: string;
  affectedResource: string;
}

const fraudAlerts: FraudAlert[] = [
  {
    id: "fa001",
    severity: "critical",
    status: "open",
    type: "Break-Glass Abuse",
    message: "Emergency override used outside declared emergency window",
    actor: "Dr. Sanjay Mehta",
    actorRole: "General Physician",
    location: "OPD Block 2",
    ip: "10.14.2.88",
    at: "2026-06-08 02:14",
    riskScore: 97,
    affectedResource: "Patient MRN-201884 · ICU records",
    details:
      "Break-glass access invoked at 02:14 with no active emergency declaration. Access lasted 22 minutes. 14 records downloaded.",
  },
  {
    id: "fa002",
    severity: "critical",
    status: "investigating",
    type: "Credential Replay Attack",
    message: "Identical credential presentation from two geographically distant endpoints",
    actor: "did:hosp:0x9af2…cc01",
    actorRole: "Staff DID",
    location: "Ward 4A + External IP",
    ip: "10.2.0.11 / 185.44.x.x",
    at: "2026-06-08 00:51",
    riskScore: 94,
    affectedResource: "Staff portal session",
    details:
      "Same credential JWT presented simultaneously from hospital intranet and external IP address 4,200 km away. Possible credential theft.",
  },
  {
    id: "fa003",
    severity: "high",
    status: "open",
    type: "Anomalous Access Volume",
    message: "Staff account accessed 340 patient records in 90 minutes — 28× average",
    actor: "Nurse Priya Kapoor",
    actorRole: "ICU Nurse",
    location: "ICU Block B",
    ip: "10.1.0.44",
    at: "2026-06-07 22:30",
    riskScore: 88,
    affectedResource: "340 patient records",
    details:
      "Baseline for this role is 12 records/hour. Pattern suggests automated scraping or unauthorized data export.",
  },
  {
    id: "fa004",
    severity: "high",
    status: "open",
    type: "MFA Bypass Attempt",
    message: "8 consecutive MFA failures followed by successful login from new device",
    actor: "Admin Kewal Das",
    actorRole: "Department Admin",
    location: "Admin Block",
    ip: "10.5.1.22",
    at: "2026-06-07 19:05",
    riskScore: 82,
    affectedResource: "Admin portal",
    details:
      "MFA codes exhausted via brute-force. Login succeeded using backup code. Device fingerprint not previously registered.",
  },
  {
    id: "fa005",
    severity: "high",
    status: "investigating",
    type: "Consent Forgery",
    message: "Consent credential issued without patient biometric confirmation",
    actor: "Dr. Alok Sharma",
    actorRole: "Surgeon",
    location: "OR Suite 3",
    ip: "10.3.0.99",
    at: "2026-06-07 14:22",
    riskScore: 79,
    affectedResource: "Consent VC-SURG-0042",
    details:
      "Verifiable credential for surgery consent shows issuer signature but missing patient DID proof. Possible forged consent.",
  },
  {
    id: "fa006",
    severity: "medium",
    status: "resolved",
    type: "Off-Hours Access",
    message: "Billing records accessed by finance staff at 03:00 AM",
    actor: "Reena Bhatia",
    actorRole: "Finance Staff",
    location: "Admin Block",
    ip: "10.5.0.14",
    at: "2026-06-07 03:00",
    riskScore: 55,
    affectedResource: "Billing module — 12 records",
    details:
      "Access outside defined working hours policy (08:00–20:00). Staff confirmed remote work session. Case closed.",
  },
  {
    id: "fa007",
    severity: "medium",
    status: "dismissed",
    type: "Unusual DID Delegation",
    message: "Patient delegated full access to unregistered external DID",
    actor: "Patient Sunil Jain",
    actorRole: "Patient",
    location: "Patient portal",
    ip: "Mobile App",
    at: "2026-06-06 16:45",
    riskScore: 48,
    affectedResource: "did:external:0xff21…0001",
    details:
      "Patient authorized an external DID with no hospital registration. Verified with patient — authorized family member. Dismissed.",
  },
  {
    id: "fa008",
    severity: "low",
    status: "resolved",
    type: "Duplicate QR Scan",
    message: "Patient QR code scanned 5× within 2 minutes from different devices",
    actor: "Triage System",
    actorRole: "System",
    location: "Emergency Reception",
    ip: "System",
    at: "2026-06-06 08:12",
    riskScore: 22,
    affectedResource: "Patient QR: MRN-209944",
    details:
      "QR presented at multiple triage stations during busy shift. No malicious intent. Multiple staff scanned simultaneously.",
  },
];

const riskMetrics = [
  {
    label: "Risk Score",
    value: "76/100",
    delta: "+8 from yesterday",
    icon: Brain,
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  {
    label: "Open Alerts",
    value: "4",
    delta: "2 critical",
    icon: AlertTriangle,
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  {
    label: "Under Review",
    value: "2",
    delta: "Assigned to SOC",
    icon: Activity,
    color: "text-warning-foreground",
    bg: "bg-warning/10",
  },
  {
    label: "Resolved Today",
    value: "3",
    delta: "Avg. 4.2h TTR",
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/10",
  },
];

const sevConfig: Record<Severity, { ring: string; bg: string; text: string; label: string }> = {
  critical: {
    ring: "border-destructive/50",
    bg: "bg-destructive/8",
    text: "text-destructive",
    label: "CRITICAL",
  },
  high: {
    ring: "border-orange-500/40",
    bg: "bg-orange-500/6",
    text: "text-orange-500",
    label: "HIGH",
  },
  medium: {
    ring: "border-warning/40",
    bg: "bg-warning/6",
    text: "text-warning-foreground",
    label: "MEDIUM",
  },
  low: { ring: "border-border", bg: "bg-card", text: "text-muted-foreground", label: "LOW" },
};

const statusConfig: Record<Status, { bg: string; text: string }> = {
  open: { bg: "bg-destructive/15", text: "text-destructive" },
  investigating: { bg: "bg-warning/20", text: "text-warning-foreground" },
  resolved: { bg: "bg-success/15", text: "text-success" },
  dismissed: { bg: "bg-muted", text: "text-muted-foreground" },
};

function RiskBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-destructive"
      : score >= 60
        ? "bg-orange-500"
        : score >= 40
          ? "bg-yellow-500"
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
        className={`text-xs font-semibold tabular-nums ${score >= 80 ? "text-destructive" : score >= 60 ? "text-orange-500" : "text-muted-foreground"}`}
      >
        {score}
      </span>
    </div>
  );
}

function AlertCard({ alert }: { alert: FraudAlert }) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<Status>(alert.status);
  const sev = sevConfig[alert.severity];
  const st = statusConfig[status];

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
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {alert.location}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {alert.at}
              </span>
              <span className="flex items-center gap-1">
                <Wifi className="h-3 w-3" />
                {alert.ip}
              </span>
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
                  onClick={() => setStatus("investigating")}
                  className="inline-flex items-center gap-1 rounded-md border border-warning/50 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning-foreground hover:bg-warning/20 transition-colors"
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Investigate</span>
                </button>
                <button
                  onClick={() => setStatus("dismissed")}
                  className="inline-flex items-center gap-1 rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Block</span>
                </button>
              </>
            )}
            {status === "investigating" && (
              <button
                onClick={() => setStatus("resolved")}
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
              <p className="text-sm text-foreground">{alert.details}</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Affected Resource:</span>
                  <br />
                  <span className="font-medium text-foreground">{alert.affectedResource}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Actor Role:</span>
                  <br />
                  <span className="font-medium text-foreground">{alert.actorRole}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  <Fingerprint className="h-3.5 w-3.5" /> Trace DID
                </button>
                <button className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  <Lock className="h-3.5 w-3.5" /> Lock Account
                </button>
                <button className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
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

  const { data: alertData, online, loading: alertLoading, refetch } = useFraudAlerts();

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
    severity: (a.severity as Severity) ?? "medium",
    status: (a.status as Status) ?? "open",
    type: a.type ?? "Unknown",
    message: a.message ?? "",
    actor: a.actor ?? "System",
    actorRole: "Security Monitor",
    location: "Secure System",
    ip: "—",
    at: a.detectedAt ? new Date(a.detectedAt).toLocaleString("en-IN") : "—",
    riskScore: a.riskScore ?? 50,
    details: "Alert received from secure registry compliance scanner.",
    affectedResource: "System Registry",
  }));

  // Merge deduplicated
  const seen = new Set<string>();
  const allAlerts = [...backendAlerts, ...fraudAlerts].filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

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

  return (
    <>
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
            <button
              onClick={() =>
                raiseFraudAlert(
                  "Admin Console",
                  "Manual Test",
                  "Simulated fraud event from console",
                  "low",
                  30,
                ).catch(() => {})
              }
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Zap className="h-4 w-4" /> Simulate Alert
            </button>
            <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
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

        {/* AI Risk Banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-start gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/15">
            <Brain className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-foreground">ML Risk Engine Alert</div>
              <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                <Zap className="h-2.5 w-2.5" /> HIGH RISK DAY
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Anomaly score is 76/100 — significantly above the 30-day baseline of 41. Two
              credential replay patterns and one break-glass violation detected in the past 4 hours.
              Recommend activating enhanced monitoring.
            </div>
          </div>
          <button className="shrink-0 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90">
            Activate Enhanced Mode
          </button>
        </motion.div>

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
          Showing {filtered.length} of {fraudAlerts.length} alerts
        </div>

        {/* Alerts */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
          {filtered.map((a) => (
            <AlertCard key={a.id} alert={a} />
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
    </>
  );
}
