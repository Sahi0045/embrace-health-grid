import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { ConsentCard, type ConsentRecord } from "@/components/consent/ConsentCard";
import { ConsentHistory } from "@/components/consent/ConsentHistory";
import { ConsentToggle } from "@/components/consent/ConsentToggle";

import { useConsents } from "@/hooks/use-api";
import {
  revokeConsent,
  getConsents,
  approveConsentRequest,
  rejectConsentRequest,
  getPreferences,
  updatePreferences,
} from "@/lib/api";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  History,
  Settings2,
  Bell,
  Clock,
  User,
  Package,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth-context";

export const Route = createFileRoute("/patient/consent")({
  head: () => ({ meta: [{ title: "Patient · Consent — Embrace Health Grid" }] }),
  component: Consent,
});

// Global consent preferences managed dynamically via preferences API

interface ConsentRequest {
  id: string;
  doctorName: string;
  doctorDid: string;
  doctorSpecialty: string;
  resource: string;
  reason: string;
  requestedAt: string;
  expiresAt?: string;
}

interface ConsentRecord {
  id: string;
  doctorName: string;
  doctorDid: string;
  doctorSpecialty: string;
  resource: string;
  reason: string;
  status: "requested" | "active" | "expired" | "revoked" | "rejected";
  requestedAt: string;
  approvedAt?: string;
  accessStartedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  rejectedAt?: string;
}

type Tab = "active" | "requests" | "history" | "preferences";

function Consent() {
  const { user: currentUser } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("active");
  const { data: consentsData, refetch } = useConsents();

  // The DID comes from the session, which is read from Postgres per request.
  const patientDid = currentUser?.primaryDid ?? "";

  const [preferences, setPreferences] = useState<any>({
    emergencyAccess: true,
    insuranceVerification: true,
    researchSharing: false,
    crossHospital: false,
  });

  useEffect(() => {
    if (patientDid && tab === "preferences") {
      getPreferences(patientDid)
        .then((res) => setPreferences(res.preferences))
        .catch((err) => console.error("Error loading preferences:", err));
    }
  }, [patientDid, tab]);

  const handleTogglePreference = async (key: string, enabled: boolean) => {
    try {
      const updated = { ...preferences, [key]: enabled };
      setPreferences(updated);
      await updatePreferences(patientDid, updated);
      toast.success("Preferences updated successfully");
    } catch (err: any) {
      toast.error(`Failed to update preferences: ${err.message}`);
    }
  };

  // ─── Pending consent requests from staff ────────────────────────────────────
  const [requests, setRequests] = useState<ConsentRequest[]>([]);
  const [allConsents, setAllConsents] = useState<ConsentRecord[]>([]);
  const [reqLoading, setReqLoading] = useState(false);

  const fetchConsents = useCallback(async () => {
    setReqLoading(true);
    try {
      const data = await getConsents();
      const raw = (data.consents ?? []) as any[];
      
      // Map all consents to proper format
      const mapped: ConsentRecord[] = raw.map((c: any) => ({
        id: c.grantId ?? c.grant_id ?? String(Math.random()),
        doctorName: c.doctorName ?? c.doctor_name ?? "Dr. Specialist",
        doctorDid: c.doctorDid ?? c.doctor_did ?? "did:hosp:staff:unknown",
        doctorSpecialty: c.doctorSpecialty ?? c.doctor_specialty ?? "Medical Specialist",
        resource: c.resource ?? "Medical Records",
        reason: c.reason ?? "Patient care",
        status: c.status ?? "active",
        requestedAt: c.requestedAt ?? c.requested_at ?? new Date().toISOString(),
        approvedAt: c.approvedAt ?? c.approved_at,
        accessStartedAt: c.accessStartedAt ?? c.access_started_at,
        expiresAt: c.expiry ?? c.expires_at,
        revokedAt: c.revokedAt ?? c.revoked_at,
        rejectedAt: c.rejectedAt ?? c.rejected_at,
      }));

      setAllConsents(mapped);
      
      // Filter pending requests (status = 'requested')
      const pending = mapped
        .filter((c) => c.status === "requested")
        .map((c) => ({
          id: c.id,
          doctorName: c.doctorName,
          doctorDid: c.doctorDid,
          doctorSpecialty: c.doctorSpecialty,
          resource: c.resource,
          reason: c.reason,
          requestedAt: c.requestedAt,
          expiresAt: c.expiresAt,
        }));
      
      setRequests(pending);
    } catch (err) {
      console.error("Error fetching consents:", err);
      setRequests([]);
      setAllConsents([]);
    } finally {
      setReqLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  // Real-time WebSocket subscription for new consent:request events
  useEffect(() => {
    // WebSocket integration handled by the realtime store.
    // Refetch consents on any consent-related event
    const interval = setInterval(() => {
      fetchConsents();
    }, 30000); // Poll every 30 seconds for updates
    
    return () => clearInterval(interval);
  }, [fetchConsents]);

  // ─── Active / granted consents ──────────────────────────────────────────────
  const active = allConsents.filter((c) => c.status === "active");
  const pendingInActive = allConsents.filter((c) => c.status === "requested");
  const historyList = allConsents.filter(
    (c) => c.status === "revoked" || c.status === "expired" || c.status === "rejected"
  );

  const handleRevoke = async (id: string) => {
    try {
      const c = allConsents.find((x) => x.id === id);
      await revokeConsent(id);
      toast.success(`Access revoked from ${c?.doctorName ?? "doctor"}`);
      fetchConsents();
      refetch();
    } catch (err: any) {
      toast.error(`Failed to revoke consent: ${err.message}`);
    }
  };

  // ─── Approve / deny request handlers ────────────────────────────────────────
  const handleApproveRequest = async (req: ConsentRequest) => {
    try {
      await approveConsentRequest(req.id);
      toast.success(
        `Access granted to ${req.doctorName} for 1 hour`,
        { description: "Doctor will have access until expiry time" }
      );
      fetchConsents();
      refetch();
    } catch (err: any) {
      toast.error(`Failed to approve consent: ${err.message}`);
    }
  };

  const handleDenyRequest = async (requestId: string) => {
    try {
      await rejectConsentRequest(requestId);
      toast.success("Request denied");
      fetchConsents();
    } catch (err: any) {
      toast.error(`Failed to deny request: ${err.message}`);
    }
  };

  const tabs = [
    {
      key: "active" as Tab,
      label: `Active (${active.length})`,
      icon: ShieldCheck,
    },
    {
      key: "requests" as Tab,
      label: "Requests",
      icon: Bell,
      badge: requests.length,
    },
    { key: "history" as Tab, label: "History", icon: History },
    { key: "preferences" as Tab, label: "Preferences", icon: Settings2 },
  ];

  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Patient app"
        title="Consent Management"
        description="Control who can access your health records and manage permissions"
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-8 bg-card">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="ml-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-warning-foreground">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8">
        {/* ─── Active tab ──────────────────────────────────────────────────────── */}
        {tab === "active" && (
          <div className="space-y-5">
            {/* Active consents */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Active Consents ({active.length})
                </span>
              </div>
              {active.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  No active consents. When you approve a doctor's request, it will appear here with a
                  1-hour access window.
                </div>
              ) : (
                <StaggerList className="grid gap-3 sm:grid-cols-2">
                  {active.map((c) => (
                    <StaggerItem key={c.id}>
                      <motion.div
                        layout
                        className="rounded-xl border border-success/30 bg-success/5 p-4 shadow-sm"
                      >
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15">
                              <User className="h-5 w-5 text-success" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground">
                                {c.doctorName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {c.doctorSpecialty}
                              </div>
                            </div>
                          </div>
                          <span className="flex h-5 shrink-0 items-center rounded-full bg-success/15 px-2 text-[10px] font-semibold text-success">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                          </span>
                        </div>

                        {/* Details grid */}
                        <div className="mt-3 grid gap-2 text-xs">
                          <div className="rounded-lg bg-card border border-border px-3 py-2">
                            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              <Package className="h-3 w-3" /> Resource
                            </div>
                            <div className="font-medium text-foreground">{c.resource}</div>
                          </div>
                          <div className="rounded-lg bg-card border border-border px-3 py-2">
                            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              <FileText className="h-3 w-3" /> Reason
                            </div>
                            <div className="text-foreground">{c.reason}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-card border border-border px-3 py-2">
                              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                                <Clock className="h-3 w-3" /> Approved
                              </div>
                              <div className="text-foreground text-[11px]">
                                {c.approvedAt
                                  ? new Date(c.approvedAt).toLocaleString("en-IN", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </div>
                            </div>
                            <div className="rounded-lg bg-card border border-border px-3 py-2">
                              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                                <Clock className="h-3 w-3" /> Expires
                              </div>
                              <div className="text-foreground text-[11px]">
                                {c.expiresAt ? (
                                  <>
                                    {new Date(c.expiresAt).toLocaleString("en-IN", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                      {(() => {
                                        const remaining = new Date(c.expiresAt).getTime() - Date.now();
                                        if (remaining <= 0) return "Expired";
                                        const minutes = Math.floor(remaining / 60000);
                                        if (minutes < 60) return `${minutes}m remaining`;
                                        const hours = Math.floor(minutes / 60);
                                        return `${hours}h ${minutes % 60}m remaining`;
                                      })()}
                                    </div>
                                  </>
                                ) : (
                                  "No expiry"
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action button */}
                        <div className="mt-3">
                          <button
                            onClick={() => handleRevoke(c.id)}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Revoke Access
                          </button>
                        </div>
                      </motion.div>
                    </StaggerItem>
                  ))}
                </StaggerList>
              )}
            </div>
          </div>
        )}

        {/* ─── Requests tab ────────────────────────────────────────────────────── */}
        {tab === "requests" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-info/30 bg-info/5 p-3 text-xs text-foreground">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-info shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">1-Hour Access Window</div>
                  <div className="text-muted-foreground mt-0.5">
                    When you approve a request, the doctor will have access to your medical information for
                    <strong> exactly 1 hour</strong>. Access will automatically expire after that time.
                  </div>
                </div>
              </div>
            </div>

            {reqLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Loading requests…
              </div>
            ) : requests.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-16 text-center"
              >
                <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <div className="text-sm font-semibold text-foreground">No pending requests</div>
                <div className="text-xs text-muted-foreground mt-1">
                  When a doctor requests access to your data, it will appear here
                </div>
              </motion.div>
            ) : (
              <StaggerList className="space-y-3">
                {requests.map((req) => (
                  <StaggerItem key={req.id}>
                    <motion.div
                      layout
                      className="rounded-xl border border-border bg-card p-5 shadow-sm"
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground">
                              {req.doctorName}
                            </div>
                            <div className="text-xs text-muted-foreground">{req.doctorSpecialty}</div>
                            <div className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">
                              {req.doctorDid}
                            </div>
                          </div>
                        </div>
                        <span className="flex h-5 shrink-0 items-center rounded-full bg-warning/15 px-2 text-[10px] font-semibold text-warning-foreground">
                          Pending
                        </span>
                      </div>

                      {/* Details grid */}
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
                        <div className="rounded-lg bg-muted/50 px-3 py-2">
                          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            <Package className="h-3 w-3" /> Resource Requested
                          </div>
                          <div className="font-medium text-foreground">{req.resource}</div>
                        </div>
                        <div className="rounded-lg bg-muted/50 px-3 py-2">
                          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            <FileText className="h-3 w-3" /> Reason
                          </div>
                          <div className="text-foreground">{req.reason}</div>
                        </div>
                        <div className="rounded-lg bg-muted/50 px-3 py-2">
                          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            <Clock className="h-3 w-3" /> Requested
                          </div>
                          <div className="text-foreground">
                            {req.requestedAt
                              ? new Date(req.requestedAt).toLocaleString("en-IN")
                              : "—"}
                          </div>
                        </div>
                        <div className="rounded-lg bg-info/10 px-3 py-2">
                          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            <Clock className="h-3 w-3" /> Access Duration
                          </div>
                          <div className="text-foreground font-semibold">1 Hour</div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleApproveRequest(req)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success/15 px-4 py-2 text-xs font-semibold text-success hover:bg-success/25 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve (1 Hour Access)
                        </button>
                        <button
                          onClick={() => handleDenyRequest(req.id)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Deny
                        </button>
                      </div>
                    </motion.div>
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </div>
        )}

        {/* ─── History tab ─────────────────────────────────────────────────────── */}
        {tab === "history" && (
          <div>
            <div className="text-xs text-muted-foreground mb-4">
              Complete consent activity history — all past and expired access grants
            </div>
            {historyList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                No consent history
              </div>
            ) : (
              <div className="space-y-3">
                {historyList.map((c) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground">
                            {c.doctorName}
                          </div>
                          <div className="text-xs text-muted-foreground">{c.doctorSpecialty}</div>
                        </div>
                      </div>
                      <span
                        className={`flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-semibold ${
                          c.status === "expired"
                            ? "bg-muted text-muted-foreground"
                            : c.status === "revoked"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-warning/10 text-warning-foreground"
                        }`}
                      >
                        {c.status === "expired" && <Clock className="h-3 w-3 mr-1" />}
                        {c.status === "revoked" && <XCircle className="h-3 w-3 mr-1" />}
                        {c.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                        {c.status}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="mt-3 grid gap-2 text-xs">
                      <div className="rounded-lg bg-muted/30 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Resource
                        </div>
                        <div className="text-foreground">{c.resource}</div>
                      </div>
                      <div className="rounded-lg bg-muted/30 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Reason
                        </div>
                        <div className="text-foreground">{c.reason}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-muted/30 px-3 py-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Requested
                          </div>
                          <div className="text-foreground text-[11px]">
                            {c.requestedAt
                              ? new Date(c.requestedAt).toLocaleString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </div>
                        </div>
                        {c.status === "rejected" ? (
                          <div className="rounded-lg bg-muted/30 px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Rejected
                            </div>
                            <div className="text-foreground text-[11px]">
                              {c.rejectedAt
                                ? new Date(c.rejectedAt).toLocaleString("en-IN", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-muted/30 px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Approved
                            </div>
                            <div className="text-foreground text-[11px]">
                              {c.approvedAt
                                ? new Date(c.approvedAt).toLocaleString("en-IN", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </div>
                          </div>
                        )}
                      </div>
                      {c.status !== "rejected" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-muted/30 px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Access Started
                            </div>
                            <div className="text-foreground text-[11px]">
                              {c.accessStartedAt
                                ? new Date(c.accessStartedAt).toLocaleString("en-IN", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </div>
                          </div>
                          <div className="rounded-lg bg-muted/30 px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              {c.status === "revoked" ? "Revoked" : "Expired"}
                            </div>
                            <div className="text-foreground text-[11px]">
                              {c.status === "revoked" && c.revokedAt
                                ? new Date(c.revokedAt).toLocaleString("en-IN", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : c.expiresAt
                                  ? new Date(c.expiresAt).toLocaleString("en-IN", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Preferences tab ─────────────────────────────────────────────────── */}
        {tab === "preferences" && (
          <div className="space-y-3 max-w-xl">
            <div className="text-xs text-muted-foreground mb-4">
              Global consent preferences apply across all healthcare providers in your network
            </div>
            <ConsentToggle
              label="Emergency Access (Break-Glass)"
              description="Allow emergency override when you are incapacitated"
              defaultEnabled={preferences.emergencyAccess}
              onToggle={(enabled) => handleTogglePreference("emergencyAccess", enabled)}
            />
            <ConsentToggle
              label="Insurance Claim Verification"
              description="Allow your insurer to verify credentials for claims"
              defaultEnabled={preferences.insuranceVerification}
              onToggle={(enabled) => handleTogglePreference("insuranceVerification", enabled)}
            />
            <ConsentToggle
              label="Research Data Sharing"
              description="Anonymised data may be used for medical research"
              defaultEnabled={preferences.researchSharing}
              onToggle={(enabled) => handleTogglePreference("researchSharing", enabled)}
            />
            <ConsentToggle
              label="Cross-Hospital Record Access"
              description="Allow federated hospitals to resolve your DID"
              defaultEnabled={preferences.crossHospital}
              onToggle={(enabled) => handleTogglePreference("crossHospital", enabled)}
            />
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
