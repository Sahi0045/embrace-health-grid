import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import {
  ShieldCheck,
  Bell,
  History,
  RefreshCw,
  User,
  Package,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Loader2,
  Shield,
  CalendarDays,
  Hash,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { getConsents, requestConsentAccess, getMyPatients, API_BASE_URL } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth-context";

export const Route = createFileRoute("/staff/consent")({
  head: () => ({ meta: [{ title: "Consent Management — Doctor Portal" }] }),
  component: StaffConsentPage,
});

type Tab = "active" | "request" | "history";

const RESOURCES = [
  "Prescription Ledger",
  "Medical Records",
  "Lab Results",
  "Imaging Records",
  "Surgical History",
  "Emergency Records",
  "Full Health Profile",
];

function StaffConsentPage() {
  const { user: currentUser } = useCurrentUser();
  const doctorDid = currentUser?.did ?? "";
  const doctorName = currentUser?.name ?? "Doctor";

  const [tab, setTab] = useState<Tab>("active");

  // ── data ──────────────────────────────────────────────────────────────────
  const [allConsents, setAllConsents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active: 0, pending: 0, expired: 0, rejected: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getConsents();
      const consents = res.consents ?? [];
      
      // Map consents to include all lifecycle fields
      const mapped = consents.map((c: any) => ({
        grantId: c.grantId ?? c.grant_id,
        patientDid: c.patientDid ?? c.patient_did,
        patientName: c.patientName ?? "Patient",
        doctorDid: c.doctorDid ?? c.doctor_did,
        resource: c.resource,
        status: c.status,
        requestedAt: c.requestedAt ?? c.requested_at,
        approvedAt: c.approvedAt ?? c.approved_at,
        accessStartedAt: c.accessStartedAt ?? c.access_started_at,
        expiresAt: c.expiry ?? c.expires_at,
        revokedAt: c.revokedAt ?? c.revoked_at,
        rejectedAt: c.rejectedAt ?? c.rejected_at,
        reason: c.reason,
      }));
      
      setAllConsents(mapped);
      
      // Calculate stats
      const active = mapped.filter((c: any) => c.status === "active").length;
      const pending = mapped.filter((c: any) => c.status === "requested").length;
      const expired = mapped.filter((c: any) => c.status === "expired").length;
      const rejected = mapped.filter((c: any) => c.status === "rejected").length;
      
      setStats({ active, pending, expired, rejected });
    } catch (err: any) {
      toast.error("Could not load consent data", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time WebSocket
  useEffect(() => {
    const wsUrl = (API_BASE_URL || "http://localhost:3001").replace(/^http/, "ws");
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let retryCount = 0;
    const connect = () => {
      if (retryCount > 3) return;
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (["consent:granted", "consent:revoked", "consent:request"].includes(msg.event))
              load();
          } catch {
            /* ignore */
          }
        };
        ws.onerror = () => {
          /* silent */
        };
        ws.onclose = () => {
          retryCount++;
          if (retryCount <= 3) {
            retry = setTimeout(connect, 10000);
          }
        };
      } catch {
        /* no WS */
      }
    };
    connect();
    return () => {
      retryCount = 99;
      if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        ws.close();
      }
      clearTimeout(retry);
    };
  }, [load]);

  // ── Request Access form ────────────────────────────────────────────────────
  const [myPatients, setMyPatients] = useState<any[]>([]);
  const [loadingPts, setLoadingPts] = useState(false);
  const [reqPatientDid, setReqPatientDid] = useState("");
  const [reqResource, setReqResource] = useState(RESOURCES[0]);
  const [reqReason, setReqReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadPatients = useCallback(async () => {
    setLoadingPts(true);
    try {
      const res = await getMyPatients();
      const patients = res.patients ?? [];
      // Deduplicate patients by DID (keep first occurrence)
      const uniquePatients = Array.from(
        new Map(patients.map((p: any) => [p.patientDid, p])).values()
      );
      setMyPatients(uniquePatients);
    } catch {
      /* silent */
    } finally {
      setLoadingPts(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "request") loadPatients();
  }, [tab, loadPatients]);

  const handleRequestConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqPatientDid) {
      toast.error("Select a patient");
      return;
    }
    if (!reqReason.trim()) {
      toast.error("Provide a reason for access");
      return;
    }
    setSubmitting(true);
    try {
      await requestConsentAccess({
        patientDid: reqPatientDid,
        resource: reqResource,
        reason: reqReason.trim(),
      });
      toast.success("Consent request sent to patient", {
        description: `Patient will receive your request. Access will be granted for 1 hour upon approval.`,
      });
      setReqPatientDid("");
      setReqReason("");
      load();
      setTab("history");
    } catch (err: any) {
      toast.error(err.message || "Failed to send consent request");
    } finally {
      setSubmitting(false);
    }
  };

  // ── expand for history cards ───────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── derived lists ──────────────────────────────────────────────────────────
  const activeGrants = allConsents.filter(
    (c) => c.status === "active" && (!c.expiresAt || new Date(c.expiresAt) > new Date()),
  );
  const pendingReqs = allConsents.filter((c) => c.status === "requested");
  const historyConsents = allConsents.filter(
    (c) => c.status === "expired" || c.status === "revoked" || c.status === "rejected"
  );

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "active", label: `Active Consents (${activeGrants.length})` },
    { key: "request", label: "Request Access", badge: pendingReqs.length },
    { key: "history", label: `History (${historyConsents.length})` },
  ];

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Doctor & Staff Portal"
        title="Consent Management"
        description="Request data access from patients, view active grants, and track all consent requests you have sent."
        actions={
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        }
      />

      {/* Stats */}
      <div className="px-6 pt-4 grid grid-cols-3 gap-3">
        {[
          { label: "Active Consents", value: stats.active, cls: "text-success" },
          { label: "Pending Requests", value: stats.pending, cls: "text-warning-foreground" },
          { label: "Expired/Revoked", value: stats.expired + stats.rejected, cls: "text-muted-foreground" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-3 text-center shadow-clinical"
          >
            <div className={`text-2xl font-black ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-6 mt-4 bg-card">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="ml-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-warning-foreground">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mx-auto w-full max-w-4xl px-6 py-6 space-y-4">
        {/* ── Active Consents tab ─────────────────────────────────────────── */}
        {tab === "active" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Patients who have granted you access to their health records. All grants are
              time-limited and can be revoked by the patient at any time.
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading consents…
              </div>
            ) : activeGrants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center space-y-3">
                <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <div className="text-sm font-semibold text-foreground">No active consents</div>
                <div className="text-xs text-muted-foreground">
                  Use the "Request Access" tab to request consent from a patient.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {activeGrants.map((g) => {
                  const expiresAt = g.expiresAt ? new Date(g.expiresAt) : null;
                  const remaining = expiresAt ? expiresAt.getTime() - Date.now() : null;
                  const minutesLeft = remaining ? Math.floor(remaining / 60000) : null;
                  const urgentExpiry = minutesLeft !== null && minutesLeft <= 15;
                  
                  return (
                    <div
                      key={g.grantId}
                      className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15">
                            <User className="h-5 w-5 text-success" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-foreground">
                              {g.patientName || g.patientDid}
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground truncate max-w-[260px]">
                              {g.patientDid}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="rounded-full bg-success/15 text-success px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-lg bg-card border border-border px-3 py-2">
                          <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5 flex items-center gap-1">
                            <Package className="h-3 w-3" /> Resource
                          </div>
                          <div className="font-medium text-foreground">
                            {g.resource || "Medical Records"}
                          </div>
                        </div>
                        <div className="rounded-lg bg-card border border-border px-3 py-2">
                          <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Approved At
                          </div>
                          <div className="font-medium text-foreground text-[11px]">
                            {g.approvedAt ? new Date(g.approvedAt).toLocaleString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }) : "—"}
                          </div>
                        </div>
                        <div
                          className={`rounded-lg border px-3 py-2 ${urgentExpiry ? "bg-warning/10 border-warning/30" : "bg-success/10 border-success/20"}`}
                        >
                          <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5 flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> Expires
                          </div>
                          <div
                            className={`font-medium text-[11px] ${urgentExpiry ? "text-warning-foreground" : "text-foreground"}`}
                          >
                            {expiresAt ? (
                              <>
                                {expiresAt.toLocaleString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {minutesLeft !== null && (
                                  <div className={`text-[10px] mt-0.5 font-semibold ${urgentExpiry ? "text-warning-foreground" : "text-success"}`}>
                                    {minutesLeft < 60 ? `${minutesLeft}m remaining` : `${Math.floor(minutesLeft / 60)}h ${minutesLeft % 60}m remaining`}
                                  </div>
                                )}
                              </>
                            ) : (
                              "No expiry"
                            )}
                          </div>
                        </div>
                      </div>
                      {urgentExpiry && (
                        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning-foreground">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          This consent expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}. You may
                          need to request renewal.
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground bg-muted rounded-lg px-2 py-1.5 overflow-x-auto">
                        <Hash className="h-3 w-3 shrink-0" />
                        {g.grantId || g.id || "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Request Access tab ──────────────────────────────────────────── */}
        {tab === "request" && (
          <div className="space-y-6">
            {/* Info banner - 1 hour access */}
            <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/5 px-4 py-3 text-xs">
              <Clock className="h-4 w-4 shrink-0 mt-0.5 text-info" />
              <div>
                <div className="font-semibold text-foreground">1-Hour Access Window</div>
                <div className="text-muted-foreground mt-0.5">
                  When a patient approves your request, you will receive access to their medical information for
                  <strong> exactly 1 hour</strong>. Access will automatically expire after that time. You can request access again if needed.
                </div>
              </div>
            </div>

            {/* Patient consent notice */}
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary">
              <Shield className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Patient-Controlled Access</div>
                <div className="text-muted-foreground mt-0.5">
                  Sending a request does not grant you access immediately. The patient must approve
                  it through their portal. All requests and decisions are recorded on the audit
                  ledger.
                </div>
              </div>
            </div>

            {/* Pending requests notice */}
            {pendingReqs.length > 0 && (
              <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs text-warning-foreground flex items-start gap-2">
                <Bell className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">
                    You have {pendingReqs.length} pending request
                    {pendingReqs.length !== 1 ? "s" : ""}.
                  </span>{" "}
                  Patients have been notified. View them in the History tab.
                </div>
              </div>
            )}

            {/* Request form */}
            <form
              onSubmit={handleRequestConsent}
              className="rounded-xl border border-border bg-card p-6 space-y-5"
            >
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> New Consent Request
              </div>

              {/* Patient selector */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Patient <span className="text-destructive">*</span>
                </label>
                {loadingPts ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your patients…
                  </div>
                ) : myPatients.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                    No patients found. Patients appear here after booking an appointment with you.
                  </div>
                ) : (
                  <select
                    value={reqPatientDid}
                    onChange={(e) => setReqPatientDid(e.target.value)}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select a patient…</option>
                    {myPatients.map((p) => (
                      <option key={p.patientDid} value={p.patientDid}>
                        {p.patientName} — {p.patientDid.slice(0, 24)}…
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Resource */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Resource Requested <span className="text-destructive">*</span>
                </label>
                <select
                  value={reqResource}
                  onChange={(e) => setReqResource(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {RESOURCES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Reason for Access <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="Describe why you need access to this patient's records…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {/* Access Duration Notice */}
              <div className="rounded-lg border border-info/30 bg-info/5 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1">
                  <Clock className="h-3.5 w-3.5 text-info" />
                  Access Duration
                </div>
                <div className="text-xs text-muted-foreground">
                  If approved, you will receive access for <strong className="text-foreground">exactly 1 hour</strong> from the moment of approval.
                  Access will automatically expire after that time.
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !reqPatientDid}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-60 transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending Request…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Send Consent Request (1 Hour Access)
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── History tab ─────────────────────────────────────────────────── */}
        {tab === "history" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              All consent requests you have sent, including pending, approved, denied, revoked and
              expired grants.
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
              </div>
            ) : requests.length === 0 && expiredGrants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center space-y-3">
                <History className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <div className="text-sm font-semibold text-foreground">No consent history yet</div>
                <div className="text-xs text-muted-foreground">
                  Your consent requests will appear here after you send them.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Pending requests */}
                {pendingReqs.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-warning-foreground mb-2 flex items-center gap-1.5">
                      <Bell className="h-3.5 w-3.5" /> Pending ({pendingReqs.length})
                    </div>
                    {pendingReqs.map((r) => (
                      <ConsentHistoryCard
                        key={r.id}
                        item={r}
                        kind="request"
                        expandedId={expandedId}
                        setExpandedId={setExpandedId}
                      />
                    ))}
                  </div>
                )}

                {/* Closed requests (approved/denied) */}
                {closedReqs.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Requests — Approved / Denied ({closedReqs.length})
                    </div>
                    {closedReqs.map((r) => (
                      <ConsentHistoryCard
                        key={r.id}
                        item={r}
                        kind="request"
                        expandedId={expandedId}
                        setExpandedId={setExpandedId}
                      />
                    ))}
                  </div>
                )}

                {/* Expired / revoked grants */}
                {expiredGrants.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Grants — Revoked / Expired ({expiredGrants.length})
                    </div>
                    {expiredGrants.map((g) => (
                      <ConsentHistoryCard
                        key={g.grantId || g.id}
                        item={g}
                        kind="grant"
                        expandedId={expandedId}
                        setExpandedId={setExpandedId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}

// ─── History card sub-component ───────────────────────────────────────────────
function ConsentHistoryCard({
  item,
  expandedId,
  setExpandedId,
}: {
  item: any;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  const id = item.grantId;
  const isExp = expandedId === id;

  const status = item.status || "unknown";
  const statusCfg: Record<string, { cls: string; label: string }> = {
    requested: { cls: "bg-warning/15 text-warning-foreground", label: "Pending" },
    active: { cls: "bg-success/15 text-success", label: "Active" },
    rejected: { cls: "bg-destructive/10 text-destructive", label: "Rejected" },
    revoked: { cls: "bg-muted text-muted-foreground", label: "Revoked" },
    expired: { cls: "bg-muted text-muted-foreground", label: "Expired" },
  };
  const { cls: sCls, label: sLabel } = statusCfg[status] ?? {
    cls: "bg-muted text-muted-foreground",
    label: status,
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button className="w-full text-left p-4" onClick={() => setExpandedId(isExp ? null : id)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                status === "active" ? "bg-success/10" : "bg-primary/10"
              }`}
            >
              {status === "active" ? (
                <ShieldCheck className="h-4 w-4 text-success" />
              ) : (
                <Bell className="h-4 w-4 text-primary" />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                {item.patientName || item.patientDid}
              </div>
              <div className="text-xs text-muted-foreground">
                {item.resource || "Medical Records"} ·{" "}
                {item.requestedAt
                  ? new Date(item.requestedAt).toLocaleDateString("en-IN")
                  : "—"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${sCls}`}>
              {sLabel}
            </span>
            {isExp ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>
      {isExp && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ["Patient DID", item.patientDid || "—"],
              ["Resource", item.resource || "Medical Records"],
              ["Status", sLabel],
              kind === "request"
                ? [
                    "Requested At",
                    item.requestedAt ? new Date(item.requestedAt).toLocaleString("en-IN") : "—",
                  ]
                : [
                    "Granted At",
                    item.grantedAt ? new Date(item.grantedAt).toLocaleString("en-IN") : "—",
                  ],
              ["Expiry", item.expiry ? new Date(item.expiry).toLocaleString("en-IN") : "—"],
              item.revokedAt
                ? ["Revoked At", new Date(item.revokedAt).toLocaleString("en-IN")]
                : ["Doctor DID", item.doctorDid || "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted/50 px-3 py-2">
                <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">
                  {k}
                </div>
                <div className="font-medium text-foreground truncate">{v}</div>
              </div>
            ))}
          </div>
          {item.reason && (
            <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs">
              <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5 flex items-center gap-1">
                <FileText className="h-3 w-3" /> Reason
              </div>
              <div className="text-foreground">{item.reason}</div>
            </div>
          )}
          <div className="flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground bg-muted rounded-lg px-2 py-1.5 overflow-x-auto">
            <Hash className="h-3 w-3 shrink-0" />
            {id}
          </div>
        </div>
      )}
    </div>
  );
}
