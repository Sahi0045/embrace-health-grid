import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { ConsentCard, type ConsentRecord } from "@/components/consent/ConsentCard";
import { ConsentHistory } from "@/components/consent/ConsentHistory";
import { ConsentToggle } from "@/components/consent/ConsentToggle";

import { useConsents } from "@/hooks/use-api";
import { revokeConsent, grantConsent, getConsentRequests, denyConsentRequest, getPreferences, updatePreferences } from "@/lib/api";
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

export const Route = createFileRoute("/patient/consent")({
  head: () => ({ meta: [{ title: "Patient · Consent — Embrace Health Grid" }] }),
  component: Consent,
});

// Global consent preferences managed dynamically via preferences API

interface ConsentRequest {
  id: string;
  doctorName: string;
  doctorDid: string;
  resource: string;
  reason: string;
  requestedAt: string;
  expiresAt: string;
}

type Tab = "active" | "requests" | "history" | "preferences";

function Consent() {
  const [tab, setTab] = useState<Tab>("active");
  const { data: consentsData, refetch } = useConsents();

  // Resolve the logged-in patient's DID
  const patientDid =
    typeof window !== "undefined"
      ? (localStorage.getItem("userDID") ?? "did:hosp:patient:current")
      : "did:hosp:patient:current";

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
  const [reqLoading, setReqLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const data = await getConsentRequests(patientDid);
      const raw = (data.requests ?? []) as any[];
      setRequests(
        raw.map((r: any) => ({
          id: r.id ?? r.requestId ?? String(Math.random()),
          doctorName: r.doctorName ?? r.requester ?? "Dr. Specialist",
          doctorDid: r.doctorDid ?? r.requesterDid ?? "did:hosp:staff:unknown",
          resource: r.resource ?? "Medical Records",
          reason: r.reason ?? "Patient care",
          requestedAt: r.requestedAt ?? r.timestamp ?? new Date().toISOString(),
          expiresAt: r.expiresAt ?? r.expiry ?? "",
        })),
      );
    } catch {
      // Solana Devnet offline or endpoint not yet available — show empty gracefully
      setRequests([]);
    } finally {
      setReqLoading(false);
    }
  }, [patientDid]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Real-time WebSocket subscription for new consent:request events
  useEffect(() => {
    // WebSocket integration handled by the realtime store.
  }, [fetchRequests]);

  // ─── Active / granted consents from Solana ──────────────────────────────────
  const liveList = (consentsData?.consents ?? []).map((c: any) => ({
    id: c.id ?? c.txId ?? String(Math.random()),
    requester: c.requester ?? c.doctorName ?? c.doctorDid ?? "Doctor Specialist",
    requesterRole: c.requesterRole ?? "Medical Specialist",
    reason: c.reason ?? "Patient Care and Record Access",
    grantedAt: c.grantedAt ?? c.timestamp ?? new Date(Date.now() - 26 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    expiresAt: c.expiresAt ?? new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: (c.status === "granted" || c.status === "active"
      ? "active"
      : c.status === "requested" || c.status === "pending"
        ? "pending"
        : c.status) as ConsentRecord["status"],
  }));

  const list = liveList;

  const handleRevoke = async (id: string) => {
    try {
      const c = list.find((x: any) => x.id === id);
      await revokeConsent(id);
      toast.success(`Access revoked from ${c?.requester}`);
      refetch();
    } catch (err: any) {
      toast.error(`Failed to revoke consent: ${err.message}`);
    }
  };

  const handleApproveActive = async (id: string) => {
    try {
      const c = list.find((x: any) => x.id === id);
      await grantConsent(
        patientDid,
        c?.requester ?? "did:hosp:0xd103… 99aa",
        c?.reason ?? "General care",
      );
      toast.success(`Consent approved for ${c?.requester}`);
      refetch();
    } catch (err: any) {
      toast.error(`Failed to approve consent: ${err.message}`);
    }
  };

  // ─── Approve / deny request handlers ────────────────────────────────────────
  const handleApproveRequest = async (req: ConsentRequest) => {
    try {
      await grantConsent(patientDid, req.doctorDid, req.resource, req.expiresAt || undefined);
      toast.success(`Access granted to ${req.doctorName}`);
      fetchRequests();
      refetch();
    } catch (err: any) {
      toast.error(`Failed to grant consent: ${err.message}`);
    }
  };

  const handleDenyRequest = async (requestId: string) => {
    try {
      await denyConsentRequest(requestId);
      toast.success("Request denied");
      fetchRequests();
    } catch (err: any) {
      toast.error(`Failed to deny request: ${err.message}`);
    }
  };

  const active = list.filter((c: any) => c.status === "active");
  const pendingInActive = list.filter((c: any) => c.status === "pending");
  const historyList = list.filter((c: any) => c.status === "revoked" || c.status === "expired");


  const tabs = [
    {
      key: "active" as Tab,
      label: `Active (${active.length + pendingInActive.length})`,
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
            {/* Pending requests from useConsents (pending status) */}
            {pendingInActive.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-warning-foreground">
                    Pending Requests ({pendingInActive.length})
                  </span>
                </div>
                <StaggerList className="grid gap-3 sm:grid-cols-2">
                  {pendingInActive.map((c: any) => (
                    <StaggerItem key={c.id}>
                      <ConsentCard
                        consent={c}
                        onApprove={handleApproveActive}
                        onRevoke={handleRevoke}
                      />
                    </StaggerItem>
                  ))}
                </StaggerList>
              </div>
            )}

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
                  No active consents
                </div>
              ) : (
                <StaggerList className="grid gap-3 sm:grid-cols-2">
                  {active.map((c: any) => (
                    <StaggerItem key={c.id}>
                      <ConsentCard consent={c} onRevoke={handleRevoke} />
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
            <div className="text-xs text-muted-foreground">
              Pending data-access requests from healthcare providers — approve or deny each request.
              Decisions are recorded on the Solana audit ledger.
            </div>

            {reqLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Loading requests from registry…
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
                            <div className="font-mono text-[10px] text-muted-foreground truncate">
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
                        {req.expiresAt && (
                          <div className="rounded-lg bg-muted/50 px-3 py-2">
                            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                              <Clock className="h-3 w-3" /> Expiry
                            </div>
                            <div className="text-foreground">
                              {new Date(req.expiresAt).toLocaleString("en-IN")}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleApproveRequest(req)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success/15 px-4 py-2 text-xs font-semibold text-success hover:bg-success/25 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
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
              Complete consent activity — all events are immutably recorded on the audit ledger
            </div>
            <ConsentHistory consents={list} />
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
