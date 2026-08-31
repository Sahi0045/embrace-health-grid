import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import {
  Activity,
  Search,
  RefreshCw,
  Shield,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  ExternalLink,
  Clock,
  User,
  Calendar,
  AlertTriangle,
  Hash,
  ChevronDown,
  ChevronUp,
  Anchor,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAuditTrail,
  verifyAuditRecord,
  processAuditAnchorQueue,
  getAuditStats,
} from "@/lib/audit.server";
import { useTableRefresh } from "@/hooks/use-realtime";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail & Blockchain Proofs — Admin Console" },
      {
        name: "description",
        content:
          "Tamper-evident audit records with cryptographic SHA-256 integrity and Solana blockchain anchoring",
      },
    ],
  }),
  component: AdminAuditPageGuarded,
});

interface AuditEvent {
  tx_id: string;
  actor_id: string | null;
  actor_did: string | null;
  resource: string | null;
  action: string;
  outcome: string;
  severity: string;
  metadata: Record<string, unknown>;
  logged_at: string;
  who_name: string | null;
  who_role: string | null;
  who_hospital_id: string | null;
  who_email: string | null;
  what_module: string | null;
  what_entity_id: string | null;
  what_entity_type: string | null;
  where_hospital: string | null;
  where_location: string | null;
  prev_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  auth_status: string | null;
  auth_policy: string | null;
  record_hash: string | null;
  anchor_id: string | null;
  anchor_status: string | null;
}

interface VerifyResult {
  txId: string;
  verified: boolean;
  dbIntegrity: "OK" | "FAIL" | "unknown" | "pending";
  chainIntegrity: "OK" | "FAIL" | "pending" | "not_queued";
  anchorStatus: string | null;
  signature: string | null;
  slot: number | null;
  storedHash: string | null;
  chainHash: string | null;
  explorerUrl: string | null;
  reason: string | null;
}

function formatJsonValue(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return val;
    }
  }
  return JSON.stringify(val, null, 2);
}

function AdminAuditPageGuarded() {
  return (
    <RouteGuard requiredRole="admin">
      <AdminAuditPage />
    </RouteGuard>
  );
}

function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [outcomeFilter, setOutcomeFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [anchoring, setAnchoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, statsRes] = await Promise.all([
        getAuditTrail({ data: { limit: 200 } }),
        getAuditStats().catch(() => ({
          total: 0,
          failures: 0,
          critical: 0,
          unauthorized: 0,
          anchored: 0,
          pendingAnchors: 0,
        })),
      ]);
      setEvents((eventsRes as any)?.events ?? []);
      setStats(statsRes);
    } catch (err: any) {
      toast.error("Could not load audit trail", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time updates from audit_events table
  useTableRefresh("audit_events", load);
  useTableRefresh("audit_anchor_queue", load);

  // Unique modules
  const modules = useMemo(() => {
    const mods = new Set(events.map((e) => e.what_module).filter((m): m is string => Boolean(m)));
    return ["All", ...Array.from(mods).sort()];
  }, [events]);

  // Filter events
  const filtered = useMemo(() => {
    return events.filter((event) => {
      const q = searchQ.toLowerCase();
      const matchQ =
        !q ||
        (event.who_name ?? "").toLowerCase().includes(q) ||
        (event.action ?? "").toLowerCase().includes(q) ||
        (event.what_entity_id ?? "").toLowerCase().includes(q) ||
        (event.where_location ?? "").toLowerCase().includes(q) ||
        event.tx_id.toLowerCase().includes(q);
      const matchMod = moduleFilter === "All" || event.what_module === moduleFilter;
      const matchOut = outcomeFilter === "All" || event.outcome === outcomeFilter;
      return matchQ && matchMod && matchOut;
    });
  }, [events, searchQ, moduleFilter, outcomeFilter]);

  // Verify audit record
  const handleVerify = async (event: AuditEvent) => {
    setVerifyLoading(true);
    setVerifyOpen(true);
    try {
      const result = await verifyAuditRecord({ data: { txId: event.tx_id } });
      setVerifyResult(result as any);
    } catch (err: any) {
      toast.error("Verification failed", { description: err.message });
      setVerifyOpen(false);
    } finally {
      setVerifyLoading(false);
    }
  };

  // Process anchor queue
  const handleAnchorPending = async () => {
    setAnchoring(true);
    try {
      const res = await processAuditAnchorQueue({ data: { limit: 10 } });
      toast.success(`Processed ${res.processed} events`, {
        description: `${res.anchored} anchored, ${res.failed} failed`,
      });
      load();
    } catch (err: any) {
      toast.error("Anchoring failed", { description: err.message });
    } finally {
      setAnchoring(false);
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      PATIENT_ADMITTED: "Patient Admitted",
      PATIENT_DISCHARGED: "Patient Discharged",
      PATIENT_TRANSFERRED: "Patient Transferred",
      PRESCRIPTION_UPDATED: "Prescription Updated",
      CERTIFICATION_CREATED: "Certification Created",
      CERTIFICATION_UPDATED: "Certification Updated",
      CERTIFICATION_DELETED: "Certification Deleted",
      BED_STATUS_CHANGED: "Bed Status Changed",
      ROOM_STATUS_CHANGED: "Room Status Changed",
      STOCK_IN: "Stock Inward Recorded",
      STOCK_OUT: "Stock Outward Dispatched",
      STOCK_ADJUSTMENT: "Stock Audit Adjustment",
    };
    return (
      labels[action] ??
      action
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    );
  };

  const getSeverityConfig = (severity: string) => {
    const configs = {
      info: { color: "text-primary", bg: "bg-primary/10", icon: Activity },
      warning: { color: "text-warning", bg: "bg-warning/10", icon: AlertTriangle },
      critical: { color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
    };
    return configs[severity as keyof typeof configs] ?? configs.info;
  };

  const getOutcomeConfig = (outcome: string) => {
    const configs = {
      success: { color: "text-success", bg: "bg-success/10", icon: CheckCircle2 },
      failure: { color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
      unauthorized: { color: "text-warning", bg: "bg-warning/10", icon: Shield },
    };
    return configs[outcome as keyof typeof configs] ?? configs.success;
  };

  const getAnchorConfig = (status: string | null) => {
    const configs = {
      pending: { color: "text-warning", icon: Clock },
      anchored: { color: "text-success", icon: Anchor },
      failed: { color: "text-destructive", icon: XCircle },
    };
    if (!status) return { color: "text-muted-foreground", icon: Hash };
    return (
      configs[status as keyof typeof configs] ?? { color: "text-muted-foreground", icon: Hash }
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8 pb-24">
      {/* Page Header */}
      <PageHeader
        eyebrow="Compliance & Governance Audit"
        title="Audit Trail & Blockchain Proofs"
        description="Tamper-evident audit records with cryptographic SHA-256 integrity and Solana blockchain anchoring"
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={load}
              disabled={loading}
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-bold shadow-xs hover:bg-accent"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {stats?.pendingAnchors > 0 && (
              <Button
                onClick={handleAnchorPending}
                disabled={anchoring}
                size="sm"
                className="bg-warning hover:bg-warning/90 text-warning-foreground font-extrabold rounded-xl shadow-clinical-md text-xs"
              >
                <Anchor className={`h-4 w-4 mr-2 ${anchoring ? "animate-spin" : ""}`} />
                Anchor Pending ({stats.pendingAnchors})
              </Button>
            )}
          </div>
        }
      />

      <StaggerList className="space-y-6">
        {/* KPI Bento Section */}
        {stats && (
          <StaggerItem>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Total Events", value: stats.total, cls: "text-primary", icon: Activity },
                {
                  label: "Failures",
                  value: stats.failures,
                  cls: "text-destructive",
                  icon: XCircle,
                },
                {
                  label: "Critical",
                  value: stats.critical,
                  cls: "text-destructive",
                  icon: AlertTriangle,
                },
                {
                  label: "Unauthorized",
                  value: stats.unauthorized,
                  cls: "text-warning",
                  icon: Shield,
                },
                { label: "Anchored", value: stats.anchored, cls: "text-success", icon: Anchor },
                {
                  label: "Pending Anchors",
                  value: stats.pendingAnchors,
                  cls: "text-warning",
                  icon: Clock,
                },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    className="rounded-2xl border border-border/80 bg-card p-4 shadow-clinical-xs transition-all hover:shadow-clinical-sm text-center flex flex-col justify-between"
                  >
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1.5 mb-1">
                      <Icon className="h-3.5 w-3.5" />
                      <span>{s.label}</span>
                    </div>
                    <div className={`text-3xl font-display font-extrabold ${s.cls}`}>{s.value}</div>
                  </div>
                );
              })}
            </div>
          </StaggerItem>
        )}

        {/* Filters */}
        <StaggerItem>
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card border border-border/80 p-3.5 rounded-2xl shadow-clinical-sm">
            <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-background px-3 py-1.5 flex-1 min-w-[250px]">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search actor, action, module, location, DID, tx..."
                className="w-full bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="bg-card border border-border/80 rounded-xl px-3 py-1.5 shadow-clinical-xs text-xs font-extrabold text-foreground h-9 focus:ring-2 focus:ring-primary/40"
              >
                {modules.map((m) => (
                  <option key={m} value={m}>
                    Module: {m}
                  </option>
                ))}
              </select>

              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}
                className="bg-card border border-border/80 rounded-xl px-3 py-1.5 shadow-clinical-xs text-xs font-extrabold text-foreground h-9 focus:ring-2 focus:ring-primary/40"
              >
                {["All", "success", "failure", "unauthorized"].map((o) => (
                  <option key={o} value={o}>
                    Outcome: {o === "All" ? "All" : o.charAt(0).toUpperCase() + o.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </StaggerItem>

        {/* Events List */}
        <StaggerItem>
          {loading ? (
            <div className="flex justify-center py-16 text-sm font-semibold text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" /> Loading audit trail…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-center shadow-clinical-xs">
              <Shield className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <div className="font-display font-extrabold text-base text-foreground">
                No audit events found
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {searchQ || moduleFilter !== "All" || outcomeFilter !== "All"
                  ? "No events match the selected filters."
                  : "No audit events recorded yet."}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((event) => {
                const severityConfig = getSeverityConfig(event.severity);
                const outcomeConfig = getOutcomeConfig(event.outcome);
                const anchorConfig = getAnchorConfig(event.anchor_status);
                const SeverityIcon = severityConfig.icon;
                const OutcomeIcon = outcomeConfig.icon;
                const AnchorIcon = anchorConfig.icon;
                const isExp = expandedId === event.tx_id;
                const hasChanges = event.prev_value || event.new_value;

                return (
                  <div
                    key={event.tx_id}
                    className="rounded-2xl border border-border/80 bg-card shadow-clinical-xs transition-all hover:shadow-clinical-sm overflow-hidden"
                  >
                    {/* Summary Row */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExp}
                      className="w-full text-left p-4.5 cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => setExpandedId(isExp ? null : event.tx_id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedId(isExp ? null : event.tx_id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3.5">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                            <SeverityIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-display font-extrabold text-sm text-foreground flex items-center gap-2 flex-wrap">
                              <span>{getActionLabel(event.action)}</span>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${outcomeConfig.color} ${outcomeConfig.bg}`}
                              >
                                <OutcomeIcon className="h-3 w-3" />
                                {event.outcome}
                              </span>
                              {event.what_module && (
                                <span className="rounded-full bg-muted/80 text-muted-foreground px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border border-border/60">
                                  {event.what_module}
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-muted-foreground mt-1">
                              {event.who_name ?? "System / Automated"} • {event.who_role ?? "—"}
                              {event.where_location && ` • ${event.where_location}`}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-[10px] font-medium text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(event.logged_at).toLocaleString("en-IN")}
                              </span>
                              <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                TX: {event.tx_id.slice(0, 8)}
                              </span>
                              {event.what_entity_id && <span>Entity: {event.what_entity_id}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {hasChanges && (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground bg-muted/80 border border-border/60 rounded-full px-2 py-0.5">
                              State Diff
                            </span>
                          )}
                          {event.record_hash ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVerify(event);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary hover:bg-primary/20 transition-colors shadow-xs"
                            >
                              <Shield className="h-3.5 w-3.5" />
                              Verify Proof
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                              Legacy Record
                            </span>
                          )}
                          <div
                            className={`inline-flex items-center gap-1 text-xs font-bold ${anchorConfig.color}`}
                          >
                            <AnchorIcon className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-extrabold uppercase tracking-wider">
                              {event.anchor_status || "unanchored"}
                            </span>
                          </div>
                          {isExp ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExp && (
                      <div className="border-t border-border/80 bg-muted/10 px-5 pb-5 pt-4 space-y-4">
                        {/* Before/After Changes */}
                        {(event.prev_value || event.new_value) && (
                          <div className="space-y-2">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                              State Mutation (Pre/Post Values)
                            </div>
                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                              {event.prev_value && (
                                <div className="rounded-xl border border-border/80 bg-card p-3 shadow-clinical-xs">
                                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5">
                                    Previous Value (Before)
                                  </div>
                                  <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded-lg">
                                    {formatJsonValue(event.prev_value)}
                                  </pre>
                                </div>
                              )}
                              {event.new_value && (
                                <div className="rounded-xl border border-success/30 bg-success/5 p-3 shadow-clinical-xs">
                                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-success mb-1.5">
                                    New Value (After)
                                  </div>
                                  <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap bg-background/80 p-2 rounded-lg border border-success/20">
                                    {formatJsonValue(event.new_value)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Metadata Details Grid */}
                        <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          {[
                            ["Transaction ID", event.tx_id],
                            ["Actor DID", event.actor_did ?? "—"],
                            ["Hospital ID", event.who_hospital_id ?? "—"],
                            ["Entity Type", event.what_entity_type ?? "—"],
                            ["Auth Status", event.auth_status ?? "—"],
                            ["Auth Policy", event.auth_policy ?? "—"],
                            [
                              "Record SHA-256 Hash",
                              event.record_hash ? `${event.record_hash.slice(0, 16)}...` : "—",
                            ],
                            ["Anchor ID", event.anchor_id ?? "—"],
                          ].map(([k, v]) => (
                            <div
                              key={k}
                              className="rounded-xl bg-card border border-border/80 px-3 py-2 shadow-clinical-xs"
                            >
                              <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground mb-0.5">
                                {k}
                              </div>
                              <div className="font-mono text-[10px] font-bold text-foreground truncate">
                                {v}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Additional Structured Metadata */}
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                              Execution Metadata
                            </div>
                            <div className="rounded-xl border border-border/80 bg-card p-3">
                              <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                                {JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </StaggerItem>
      </StaggerList>

      {/* Verification Dialog */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-clinical-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display font-extrabold text-lg text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Cryptographic Proof Verification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            {verifyLoading ? (
              <div className="flex items-center justify-center py-10 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm font-semibold text-muted-foreground">
                  Recomputing SHA-256 hash & verifying on-chain integrity...
                </span>
              </div>
            ) : verifyResult ? (
              <>
                {/* Overall Verification Status Banner */}
                <div
                  className={`flex items-center gap-3 p-4 rounded-xl border ${
                    verifyResult.verified
                      ? "bg-success/10 border-success/30 text-success"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  {verifyResult.verified ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0" />
                  ) : (
                    <XCircle className="h-6 w-6 shrink-0" />
                  )}
                  <div>
                    <div className="font-display font-extrabold text-sm">
                      {verifyResult.verified
                        ? "Cryptographic Verification Succeeded ✓"
                        : "Verification Failed ✗"}
                    </div>
                    <p className="text-xs mt-0.5 opacity-90">
                      {verifyResult.reason ||
                        "Database state matches the canonical SHA-256 digest."}
                    </p>
                  </div>
                </div>

                {/* Details Bento Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl bg-muted/30 border border-border/80 p-3 text-center">
                    <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1">
                      DB Integrity
                    </div>
                    <div
                      className={`font-display font-extrabold text-sm ${
                        verifyResult.dbIntegrity === "OK"
                          ? "text-success"
                          : verifyResult.dbIntegrity === "FAIL"
                            ? "text-destructive"
                            : "text-warning"
                      }`}
                    >
                      {verifyResult.dbIntegrity}
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/30 border border-border/80 p-3 text-center">
                    <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1">
                      Chain Integrity
                    </div>
                    <div
                      className={`font-display font-extrabold text-sm ${
                        verifyResult.chainIntegrity === "OK"
                          ? "text-success"
                          : verifyResult.chainIntegrity === "FAIL"
                            ? "text-destructive"
                            : "text-warning"
                      }`}
                    >
                      {verifyResult.chainIntegrity}
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/30 border border-border/80 p-3 text-center">
                    <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1">
                      Anchor Status
                    </div>
                    <div className="font-display font-extrabold text-sm text-foreground capitalize">
                      {verifyResult.anchorStatus ?? "Pending"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/30 border border-border/80 p-3 text-center">
                    <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1">
                      Solana Slot
                    </div>
                    <div className="font-mono text-xs font-extrabold text-foreground">
                      {verifyResult.slot ?? "—"}
                    </div>
                  </div>
                </div>

                {/* SHA-256 Hashes Display */}
                {verifyResult.storedHash && (
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                      SHA-256 Digest Verification
                    </div>
                    <div className="space-y-1.5">
                      <div className="rounded-xl bg-muted/40 p-2.5 border border-border/60">
                        <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Database Stored Hash (Postgres)
                        </div>
                        <div className="font-mono text-[10px] font-bold text-foreground break-all">
                          {verifyResult.storedHash}
                        </div>
                      </div>
                      {verifyResult.chainHash && (
                        <div className="rounded-xl bg-muted/40 p-2.5 border border-border/60">
                          <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground mb-0.5">
                            On-Chain Hash (Solana Program State)
                          </div>
                          <div className="font-mono text-[10px] font-bold text-foreground break-all">
                            {verifyResult.chainHash}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Solana Explorer Link */}
                {verifyResult.explorerUrl && (
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">
                      Verifiable on public ledger
                    </span>
                    <a
                      href={verifyResult.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View on Solana Devnet Explorer
                    </a>
                  </div>
                )}
              </>
            ) : null}
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setVerifyOpen(false)}
              className="w-full sm:w-auto rounded-xl h-10 text-xs font-bold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
