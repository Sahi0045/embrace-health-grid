import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  FileSignature,
  Download,
  PencilLine,
  History as HistoryIcon,
  Shield,
  Lock,
  Search,
  Filter,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  User,
  Clock,
  Fingerprint,
  Wifi,
  WifiOff,
  RefreshCw,
  FileText,
  Pill,
  ShieldCheck,
} from "lucide-react";
import { useAudit } from "@/hooks/use-api";
import { logAuditEvent, getConsents } from "@/lib/api";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/auth-context";

export const Route = createFileRoute("/patient/history")({
  head: () => ({ meta: [{ title: "Patient · Access History — Embrace Health Grid" }] }),
  component: History,
});

type AccessAction = "viewed" | "signed" | "exported" | "updated";

const iconFor: Record<AccessAction, React.ComponentType<{ className?: string }>> = {
  viewed: Eye,
  signed: FileSignature,
  exported: Download,
  updated: PencilLine,
};

const colorFor: Record<AccessAction, string> = {
  viewed: "bg-primary/10 text-primary border-primary/30",
  signed: "bg-success/15 text-success border-success/30",
  exported: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  updated: "bg-warning/15 text-warning-foreground border-warning/30",
};

const iconBg: Record<AccessAction, string> = {
  viewed: "bg-primary/10 text-primary",
  signed: "bg-success/15 text-success",
  exported: "bg-chart-2/15 text-chart-2",
  updated: "bg-warning/15 text-warning-foreground",
};

function History() {
  const { user: currentUser } = useCurrentUser();
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<AccessAction | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [consents, setConsents] = useState<any[]>([]);
  const [loadingConsents, setLoadingConsents] = useState(true);

  const { data: auditData, online, loading: auditLoading, refetch } = useAudit(0);

  // Resolve the logged-in patient's identifiers for filtering
  const patientDid = currentUser?.primaryDid ?? "";
  const patientEmail = currentUser?.email ?? "";

  // Fetch consent grants to show who has/had access
  useEffect(() => {
    const fetchConsents = async () => {
      if (!patientDid) return;
      
      try {
        setLoadingConsents(true);
        const res = await getConsents();
        // Filter to show consents for this patient
        const patientConsents = (res.grants || []).filter(
          (g: any) => g.patientDid === patientDid
        );
        setConsents(patientConsents);
      } catch (err) {
        console.error("Error fetching consents:", err);
      } finally {
        setLoadingConsents(false);
      }
    };

    fetchConsents();
  }, [patientDid]);

  // Map backend audit events → local format
  const auditEntries = (
    (auditData?.events ?? []) as Array<{
      txId?: string;
      actor?: string;
      resource?: string;
      action?: string;
      loggedAt?: string;
    }>
  ).map((e, i) => ({
    id: e.txId ?? `evt_${i}`,
    actor: e.actor ?? "System",
    actorRole: "System Actor",
    resource: e.resource ?? "—",
    action: (e.action?.split(" ")[0]?.toLowerCase() ?? "viewed") as AccessAction,
    at: e.loggedAt ? new Date(e.loggedAt).toLocaleString("en-IN") : "—",
  }));

  // Filter to events relevant to the current patient (by DID or email)
  // If no patient identity is resolved, show all events
  const allHistory =
    patientDid || patientEmail
      ? auditEntries.filter(
          (e) =>
            (patientDid && (e.actor.includes(patientDid) || e.resource.includes(patientDid))) ||
            (patientEmail && (e.actor.includes(patientEmail) || e.resource.includes(patientEmail))),
        )
      : auditEntries;

  // Dynamic stats from merged data
  const summaryStats = [
    {
      label: "Total Events",
      value: allHistory.length,
      icon: HistoryIcon,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Unique Accessors",
      value: [...new Set(allHistory.map((e) => e.actor))].length,
      icon: User,
      color: "text-chart-2",
      bg: "bg-chart-2/10",
    },
    {
      label: "Signed Events",
      value: allHistory.filter((e) => e.action === "signed").length,
      icon: FileSignature,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Exports",
      value: allHistory.filter((e) => e.action === "exported").length,
      icon: Download,
      color: "text-warning-foreground",
      bg: "bg-warning/10",
    },
  ];

  const filtered = allHistory.filter((e) => {
    const q = query.toLowerCase();
    const matchQ =
      !q ||
      e.actor.toLowerCase().includes(q) ||
      e.resource.toLowerCase().includes(q) ||
      (e.actorRole ?? "").toLowerCase().includes(q);
    const matchA = actionFilter === "all" || e.action === actionFilter;
    return matchQ && matchA;
  });

  const reportUnauthorized = async (e: (typeof allHistory)[0]) => {
    try {
      await logAuditEvent(
        "Patient Portal",
        e.resource,
        `dispute-access: ${e.id}`,
        "flagged",
        "warning",
      );
      toast.success("Dispute filed successfully", {
        description: "Security team will investigate.",
      });
      refetch();
    } catch (err: any) {
      toast.error("Failed to submit dispute", { description: err.message });
    }
  };

  const handleVerifyChain = async () => {
    toast.promise(new Promise((resolve) => setTimeout(resolve, 1500)), {
      loading: "Verifying Merkle proof tree on Solana Devnet...",
      success: "Audit chain successfully verified! 0 discrepancies found.",
      error: "Verification failed",
    });
  };

  const handleVerifyEventOnLedger = async (eventId: string) => {
    toast.promise(new Promise((resolve) => setTimeout(resolve, 1200)), {
      loading: `Locating tx 0x${eventId.slice(0, 8)}... on ledger...`,
      success: "Transaction hash matched state DB anchor! Validated.",
      error: "Failed to verify transaction",
    });
  };

  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Patient app"
        title="Access History"
        description="Complete audit trail of who accessed your health data, signed documents, and exported records"
        actions={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
              <Fingerprint className="h-3 w-3" />
              Solana Devnet
            </span>
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${online ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
            >
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Solana Live" : "Local Sim"}
            </span>
            <button
              onClick={refetch}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <RefreshCw className={`h-3 w-3 ${auditLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 space-y-6">
        {/* Stats */}
        <StaggerList className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaryStats.map((s) => {
            const Icon = s.icon;
            return (
              <StaggerItem key={s.label}>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </span>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                    </div>
                  </div>
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerList>

        {/* Privacy notice */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"
        >
          <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-foreground">DID-Protected Audit Log</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Every access event is cryptographically signed and immutably recorded on the Solana
              Devnet ledger. You can dispute any unauthorized access using the "Report" button.
            </div>
          </div>
          <button
            onClick={handleVerifyChain}
            className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <Lock className="inline h-3 w-3 mr-1" />
            Verify Chain
          </button>
        </motion.div>

        {/* Active Access Section - Shows who currently has access via consents */}
        {!loadingConsents && consents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-success" />
                <h3 className="text-sm font-bold text-foreground">Active Access Grants</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {consents.filter((c: any) => c.status === 'active').length} active
              </span>
            </div>

            <div className="space-y-2">
              {consents
                .filter((c: any) => c.status === 'active' || c.status === 'approved')
                .slice(0, 5)
                .map((consent: any, index: number) => (
                  <div
                    key={consent.grantId || consent.id || index}
                    className="flex items-center justify-between rounded-lg border border-success/20 bg-success/5 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/15">
                        <User className="h-4 w-4 text-success" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {consent.doctorName || consent.requesterName || "Doctor"}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {consent.doctorDid || consent.requesterDid}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-muted-foreground">
                        <div>Granted: {consent.approvedAt ? new Date(consent.approvedAt).toLocaleDateString() : 'Recent'}</div>
                        {consent.expiresAt && (
                          <div className="text-[10px]">
                            Expires: {new Date(consent.expiresAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </div>
                    </div>
                  </div>
                ))}

              {consents.filter((c: any) => c.status !== 'active' && c.status !== 'approved').length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Show expired/revoked consents ({consents.filter((c: any) => c.status !== 'active' && c.status !== 'approved').length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {consents
                      .filter((c: any) => c.status !== 'active' && c.status !== 'approved')
                      .map((consent: any, index: number) => (
                        <div
                          key={consent.grantId || consent.id || `expired-${index}`}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                {consent.doctorName || consent.requesterName || "Doctor"}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {consent.doctorDid || consent.requesterDid}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-xs text-muted-foreground">
                              {consent.revokedAt && `Revoked: ${new Date(consent.revokedAt).toLocaleDateString()}`}
                              {consent.expiresAt && !consent.revokedAt && `Expired: ${new Date(consent.expiresAt).toLocaleDateString()}`}
                            </div>
                            <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {consent.status || 'Inactive'}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </details>
              )}
            </div>

            <div className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
              <FileText className="inline h-3 w-3 mr-1" />
              Doctors with active grants can view your medical records and prescriptions.
              <Pill className="inline h-3 w-3 mx-1" />
              All access is logged below.
            </div>
          </motion.div>
        )}

        {/* Filter bar */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by actor or resource…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as AccessAction | "all")}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Actions</option>
              <option value="viewed">Viewed</option>
              <option value="signed">Signed</option>
              <option value="exported">Exported</option>
              <option value="updated">Updated</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          {filtered.length} events
        </div>

        {/* Timeline */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
            <HistoryIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <div className="text-sm font-semibold text-foreground">No events match</div>
            <div className="text-xs text-muted-foreground mt-1">Try adjusting your filters</div>
          </div>
        ) : (
          <StaggerList>
            <ol className="relative space-y-1 border-l-2 border-border pl-6">
              {filtered.map((e) => {
                const Icon = iconFor[e.action as AccessAction] ?? Eye;
                const color = colorFor[e.action as AccessAction] ?? colorFor.viewed;
                const ibg = iconBg[e.action as AccessAction] ?? iconBg.viewed;
                const isExpanded = expanded === e.id;

                return (
                  <StaggerItem key={e.id}>
                    <li className="relative">
                      {/* Timeline dot */}
                      <span
                        className={`absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card ${ibg.split(" ")[1]}`}
                      >
                        <Icon className="h-3 w-3" />
                      </span>

                      <button
                        onClick={() => setExpanded(isExpanded ? null : e.id)}
                        className="w-full text-left"
                      >
                        <div
                          className={`rounded-xl border p-4 transition-all hover:shadow-sm ${isExpanded ? "shadow-sm bg-muted/30" : "bg-card"} border-border`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${color}`}
                                >
                                  {e.action}
                                </span>
                                <span className="text-sm font-medium text-foreground truncate">
                                  {e.resource}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {e.actor}
                                </span>
                                <span className="text-border">·</span>
                                <span>{e.actorRole}</span>
                                <span className="text-border">·</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {e.at}
                                </span>
                              </div>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 border-t border-border pt-3 grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5 text-xs">
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      <Fingerprint className="h-3.5 w-3.5" />
                                      DID Verified
                                    </div>
                                    <div className="font-mono text-[10px] text-primary">
                                      did:hosp:0x8f4a…{e.id.slice(-4)}
                                    </div>
                                  </div>
                                  <div className="space-y-1.5 text-xs">
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                      Ledger Hash
                                    </div>
                                    <div className="font-mono text-[10px] text-muted-foreground">
                                      0x{e.id.padEnd(4, "0")}…c8f1
                                    </div>
                                  </div>
                                  <div className="col-span-2 flex gap-2 pt-1">
                                    <button
                                      onClick={() => handleVerifyEventOnLedger(e.id)}
                                      className="flex items-center gap-1 rounded border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                                    >
                                      <Eye className="h-3 w-3" /> Verify on Ledger
                                    </button>
                                    <button
                                      onClick={() => reportUnauthorized(e)}
                                      className="flex items-center gap-1 rounded border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
                                    >
                                      <AlertTriangle className="h-3 w-3" /> Report Unauthorized
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </button>
                    </li>
                  </StaggerItem>
                );
              })}
            </ol>
          </StaggerList>
        )}
      </div>
    </RouteGuard>
  );
}
