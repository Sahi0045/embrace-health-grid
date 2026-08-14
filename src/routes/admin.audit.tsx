import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  getAuditTrail,
  verifyAuditRecord,
  processAuditAnchorQueue,
  getAuditStats,
} from "@/lib/api";
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
    meta: [{ title: "Admin · Audit Trail — Embrace Health Grid" }],
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

function AdminAuditPageGuarded() {
  return (
    <RouteGuard requiredRole="admin">
      <AdminAuditPage />
    </RouteGuard>
  );
}

function AdminAuditPage() {
  const [events, setEvents]         = useState<AuditEvent[]>([]);
  const [stats, setStats]           = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [searchQ, setSearchQ]       = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [outcomeFilter, setOutcomeFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [anchoring, setAnchoring]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, statsRes] = await Promise.all([
        getAuditTrail({ limit: 200 }),
        getAuditStats().catch(() => ({ total: 0, failures: 0, critical: 0, unauthorized: 0, anchored: 0, pendingAnchors: 0 })),
      ]);
      setEvents(eventsRes.events ?? []);
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
      const matchQ = !q ||
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
      const result = await verifyAuditRecord(event.tx_id);
      setVerifyResult(result);
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
      const res = await processAuditAnchorQueue(10);
      toast.success(`Processed ${res.processed} events`, {
        description: `${res.anchored} anchored, ${res.failed} failed`,
      });
      load();  // Refresh to show updated anchor statuses
    } catch (err: any) {
      toast.error("Anchoring failed", { description: err.message });
    } finally {
      setAnchoring(false);
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      PATIENT_ADMITTED:     "Patient Admitted",
      PATIENT_DISCHARGED:   "Patient Discharged",
      PATIENT_TRANSFERRED:  "Patient Transferred",
      PRESCRIPTION_UPDATED: "Prescription Updated",
      CERTIFICATION_CREATED: "Certification Created",
      CERTIFICATION_UPDATED: "Certification Updated",
      CERTIFICATION_DELETED: "Certification Deleted",
      BED_STATUS_CHANGED:   "Bed Status Changed",
      ROOM_STATUS_CHANGED:  "Room Status Changed",
    };
    return labels[action] ?? action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getSeverityConfig = (severity: string) => {
    const configs = {
      info:     { color: "text-primary",       bg: "bg-primary/10",    icon: Activity },
      warning:  { color: "text-warning",      bg: "bg-warning/10",    icon: AlertTriangle },
      critical: { color: "text-destructive",  bg: "bg-destructive/10", icon: XCircle },
    };
    return configs[severity as keyof typeof configs] ?? configs.info;
  };

  const getOutcomeConfig = (outcome: string) => {
    const configs = {
      success:      { color: "text-success",      bg: "bg-success/10",     icon: CheckCircle2 },
      failure:      { color: "text-destructive",  bg: "bg-destructive/10",  icon: XCircle },
      unauthorized: { color: "text-warning",      bg: "bg-warning/10",     icon: Shield },
    };
    return configs[outcome as keyof typeof configs] ?? configs.success;
  };

  const getAnchorConfig = (status: string | null) => {
    const configs = {
      pending:  { color: "text-warning", icon: Clock },
      anchored: { color: "text-success", icon: Anchor },
      failed:   { color: "text-destructive", icon: XCircle },
    };
    if (!status) return { color: "text-muted-foreground", icon: Hash };
    return configs[status as keyof typeof configs] ?? { color: "text-muted-foreground", icon: Hash };
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between border-b border-border pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
            Admin Console
          </div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Audit Trail & Blockchain Proofs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tamper-evident audit records with blockchain anchoring. All sensitive data stays in the database.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {stats?.pendingAnchors > 0 && (
            <button
              onClick={handleAnchorPending}
              disabled={anchoring}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <Anchor className={`h-3.5 w-3.5 ${anchoring ? "animate-spin" : ""}`} />
              Anchor Pending ({stats.pendingAnchors})
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            { label: "Total Events",     value: stats.total,         cls: "text-primary",     icon: Activity },
            { label: "Failures",         value: stats.failures,      cls: "text-destructive",  icon: XCircle },
            { label: "Critical",         value: stats.critical,      cls: "text-destructive",  icon: AlertTriangle },
            { label: "Unauthorized",     value: stats.unauthorized,  cls: "text-warning",      icon: Shield },
            { label: "Anchored",         value: stats.anchored,      cls: "text-success",      icon: Anchor },
            { label: "Pending Anchors",  value: stats.pendingAnchors, cls: "text-warning",     icon: Clock },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl border border-border bg-card p-3 shadow-clinical text-center">
                <div className={`text-2xl font-black ${s.cls} flex justify-center`}>                 
                  {s.value}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                  <Icon className="h-3 w-3" />
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 flex-1 min-w-[250px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search by actor, action, entity ID, location..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold outline-none"
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
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold outline-none"
        >
          {["All", "success", "failure", "unauthorized"].map((o) => (
            <option key={o} value={o}>
              Outcome: {o === "All" ? "All" : o.charAt(0).toUpperCase() + o.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="flex justify-center py-12 text-sm text-muted-foreground gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading audit trail…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Shield className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <div className="text-sm font-semibold text-foreground">No audit events found</div>
          <div className="text-xs text-muted-foreground mt-1">
            {searchQ || moduleFilter !== "All" || outcomeFilter !== "All"
              ? "No events match your filters."
              : "No audit events yet."}
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
              <div key={event.tx_id} className="rounded-xl border border-border bg-card shadow-clinical overflow-hidden">
                {/* Summary */}
                <button
                  className="w-full text-left p-4"
                  onClick={() => setExpandedId(isExp ? null : event.tx_id)}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <SeverityIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                          {getActionLabel(event.action)}
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${outcomeConfig.color} ${outcomeConfig.bg}`}>
                            <OutcomeIcon className="h-3 w-3" />
                            {event.outcome}
                          </span>
                          {event.what_module && (
                            <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium">
                              {event.what_module}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {event.who_name ?? "Unknown actor"} • {event.who_role ?? "—"}
                          {event.where_location && ` • ${event.where_location}`}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(event.logged_at).toLocaleString("en-IN")}
                          </span>
                          <span className="font-mono">{event.tx_id.slice(0, 8)}</span>
                          {event.what_entity_id && (
                            <span>Entity: {event.what_entity_id}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasChanges && (
                        <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                          Changes
                        </span>
                      )}
                      {event.record_hash && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerify(event);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/20"
                        >
                          <Shield className="h-3 w-3" />
                          Verify
                        </button>
                      )}
                      <div className={`inline-flex items-center gap-1 ${anchorConfig.color}`}>
                        <AnchorIcon className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium">
                          {event.anchor_status || "not anchored"}
                        </span>
                      </div>
                      {isExp ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExp && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                    {/* Before/After Changes */}
                    {(event.prev_value || event.new_value) && (
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-primary">Changes</div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {event.prev_value && (
                            <div className="rounded-lg border border-border bg-muted/20 p-3">
                              <div className="text-[9px] font-bold uppercase text-muted-foreground mb-1">
                                Before
                              </div>
                              <pre className="text-[10px] text-foreground whitespace-pre-wrap">
                                {JSON.stringify(event.prev_value, null, 2)}
                              </pre>
                            </div>
                          )}
                          {event.new_value && (
                            <div className="rounded-lg border border-border bg-success/5 p-3">
                              <div className="text-[9px] font-bold uppercase text-success mb-1">
                                After
                              </div>
                              <pre className="text-[10px] text-foreground whitespace-pre-wrap">
                                {JSON.stringify(event.new_value, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                      {[
                        ["Transaction ID", event.tx_id],
                        ["Actor DID", event.actor_did ?? "—"],
                        ["Hospital ID", event.who_hospital_id ?? "—"],
                        ["Entity Type", event.what_entity_type ?? "—"],
                        ["Auth Status", event.auth_status ?? "—"],
                        ["Auth Policy", event.auth_policy ?? "—"],
                        ["Record Hash", event.record_hash ? `${event.record_hash.slice(0, 12)}...` : "—"],
                        ["Anchor ID", event.anchor_id ?? "—"],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-muted/50 px-3 py-2">
                          <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">{k}</div>
                          <div className="font-medium text-foreground font-mono text-[10px] truncate">{v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Legacy Metadata */}
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Legacy Metadata
                        </div>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
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

      {/* Verification Dialog */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Blockchain Verification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {verifyLoading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Verifying integrity...</span>
              </div>
            ) : verifyResult ? (
              <>
                {/* Overall Status */}
                <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                  verifyResult.verified
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}>
                  {verifyResult.verified ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <XCircle className="h-6 w-6" />
                  )}
                  <div>
                    <div className="font-semibold">
                      {verifyResult.verified ? "Verified ✓" : "Verification Failed ✗"}
                    </div>
                    {verifyResult.reason && (
                      <div className="text-xs mt-1">{verifyResult.reason}</div>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-card border border-border p-3">
                    <div className="text-[9px] font-bold uppercase text-muted-foreground mb-1">
                      Database Integrity
                    </div>
                    <div className={`font-semibold ${
                      verifyResult.dbIntegrity === "OK" ? "text-success" :
                      verifyResult.dbIntegrity === "FAIL" ? "text-destructive" :
                      "text-warning"
                    }`}>
                      {verifyResult.dbIntegrity}
                    </div>
                  </div>
                  <div className="rounded-lg bg-card border border-border p-3">
                    <div className="text-[9px] font-bold uppercase text-muted-foreground mb-1">
                      Blockchain Integrity
                    </div>
                    <div className={`font-semibold ${
                      verifyResult.chainIntegrity === "OK" ? "text-success" :
                      verifyResult.chainIntegrity === "FAIL" ? "text-destructive" :
                      "text-warning"
                    }`}>
                      {verifyResult.chainIntegrity}
                    </div>
                  </div>
                  <div className="rounded-lg bg-card border border-border p-3">
                    <div className="text-[9px] font-bold uppercase text-muted-foreground mb-1">
                      Anchor Status
                    </div>
                    <div className="font-semibold text-foreground">
                      {verifyResult.anchorStatus ?? "Not Anchored"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-card border border-border p-3">
                    <div className="text-[9px] font-bold uppercase text-muted-foreground mb-1">
                      Slot
                    </div>
                    <div className="font-semibold text-foreground">
                      {verifyResult.slot ?? "—"}
                    </div>
                  </div>
                </div>

                {/* Hash Comparison */}
                {verifyResult.storedHash && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Hash Verification
                    </div>
                    <div className="space-y-1">
                      <div className="rounded-lg bg-muted/50 p-2">
                        <div className="text-[9px] font-bold uppercase text-muted-foreground">Stored Hash (DB)</div>
                        <div className="font-mono text-[10px] text-foreground break-all">
                          {verifyResult.storedHash}
                        </div>
                      </div>
                      {verifyResult.chainHash && (
                        <div className="rounded-lg bg-muted/50 p-2">
                          <div className="text-[9px] font-bold uppercase text-muted-foreground">Chain Hash (Solana)</div>
                          <div className="font-mono text-[10px] text-foreground break-all">
                            {verifyResult.chainHash}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Solana Explorer Link */}
                {verifyResult.explorerUrl && (
                  <div className="pt-2 border-t border-border">
                    <a
                      href={verifyResult.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View on Solana Explorer
                    </a>
                  </div>
                )}
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}