import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { motion } from "framer-motion";
import {
  History,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Package,
  FileText,
  Calendar,
  Shield,
  RefreshCw,
  Filter,
} from "lucide-react";
import { getConsents } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/patient/access-history")({
  head: () => ({ meta: [{ title: "Patient · Access History — Embrace Health Grid" }] }),
  component: AccessHistory,
});

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

type StatusFilter = "all" | "active" | "expired" | "revoked" | "rejected" | "requested";

function AccessHistory() {
  const { user: currentUser } = useCurrentUser();
  const patientDid = currentUser?.primaryDid ?? "";

  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchAccessHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConsents();
      const raw = (data.consents ?? []) as any[];

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

      // Sort by most recent first (by requested_at)
      mapped.sort(
        (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
      );

      setConsents(mapped);
    } catch (err: any) {
      console.error("Error fetching access history:", err);
      toast.error("Failed to load access history", { description: err.message });
      setConsents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccessHistory();
  }, [fetchAccessHistory]);

  // Filter consents
  const filteredConsents = consents.filter((c) => {
    // Status filter
    if (statusFilter !== "all" && c.status !== statusFilter) return false;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        c.doctorName.toLowerCase().includes(term) ||
        c.doctorSpecialty.toLowerCase().includes(term) ||
        c.resource.toLowerCase().includes(term) ||
        c.reason.toLowerCase().includes(term)
      );
    }

    return true;
  });

  // Statistics
  const stats = {
    total: consents.length,
    active: consents.filter((c) => c.status === "active").length,
    expired: consents.filter((c) => c.status === "expired").length,
    revoked: consents.filter((c) => c.status === "revoked").length,
    rejected: consents.filter((c) => c.status === "rejected").length,
  };

  const statusConfig: Record<
    ConsentRecord["status"],
    { label: string; color: string; icon: typeof CheckCircle2 }
  > = {
    requested: {
      label: "Pending",
      color: "bg-warning/10 text-warning-foreground border-warning/20",
      icon: AlertCircle,
    },
    active: {
      label: "Active",
      color: "bg-success/10 text-success border-success/20",
      icon: CheckCircle2,
    },
    expired: {
      label: "Expired",
      color: "bg-muted text-muted-foreground border-border",
      icon: Clock,
    },
    revoked: {
      label: "Revoked",
      color: "bg-destructive/10 text-destructive border-destructive/20",
      icon: XCircle,
    },
    rejected: {
      label: "Rejected",
      color: "bg-destructive/10 text-destructive border-destructive/20",
      icon: XCircle,
    },
  };

  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Patient app"
        title="Access History"
        description="Complete record of all doctors who have accessed or been granted access to your medical information"
        actions={
          <button
            onClick={fetchAccessHistory}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-clinical hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-border bg-card p-4 shadow-clinical-sm">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total Records</div>
          </div>
          <div className="rounded-xl border border-success/30 bg-success/5 p-4 shadow-clinical-sm">
            <div className="text-2xl font-bold text-success">{stats.active}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Active Now</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-clinical-sm">
            <div className="text-2xl font-bold text-muted-foreground">{stats.expired}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Expired</div>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 shadow-clinical-sm">
            <div className="text-2xl font-bold text-destructive">{stats.revoked}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Revoked</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-clinical-sm">
            <div className="text-2xl font-bold text-muted-foreground">{stats.rejected}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Rejected</div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by doctor name, specialty, or resource..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
                <option value="rejected">Rejected</option>
                <option value="requested">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Access records */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Loading access history...
          </div>
        ) : filteredConsents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-16 text-center"
          >
            <History className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <div className="text-sm font-semibold text-foreground">
              {consents.length === 0
                ? "No access history"
                : "No records match your filters"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {consents.length === 0
                ? "When doctors request or are granted access to your data, it will appear here"
                : "Try adjusting your search or filter criteria"}
            </div>
          </motion.div>
        ) : (
          <StaggerList className="space-y-3">
            {filteredConsents.map((record) => {
              const config = statusConfig[record.status];
              const Icon = config.icon;

              return (
                <StaggerItem key={record.id}>
                  <motion.div
                    layout
                    className="rounded-xl border border-border bg-card p-5 shadow-clinical-sm hover:shadow-clinical transition-shadow"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground">
                            {record.doctorName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {record.doctorSpecialty}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">
                            {record.doctorDid}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`flex h-6 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[10px] font-semibold ${config.color}`}
                      >
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </span>
                    </div>

                    {/* Details grid */}
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
                      {/* Resource */}
                      <div className="rounded-lg bg-muted/50 px-3 py-2">
                        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          <Package className="h-3 w-3" /> Access Type
                        </div>
                        <div className="font-medium text-foreground">{record.resource}</div>
                      </div>

                      {/* Reason */}
                      <div className="rounded-lg bg-muted/50 px-3 py-2">
                        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          <FileText className="h-3 w-3" /> Reason
                        </div>
                        <div className="text-foreground">{record.reason}</div>
                      </div>

                      {/* Request date */}
                      <div className="rounded-lg bg-muted/50 px-3 py-2">
                        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          <Calendar className="h-3 w-3" /> Request Date
                        </div>
                        <div className="text-foreground">
                          {new Date(record.requestedAt).toLocaleString("en-IN", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>

                      {/* Approval/Rejection date */}
                      {record.status === "rejected" ? (
                        <div className="rounded-lg bg-destructive/5 px-3 py-2">
                          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            <XCircle className="h-3 w-3" /> Rejection Date
                          </div>
                          <div className="text-foreground">
                            {record.rejectedAt
                              ? new Date(record.rejectedAt).toLocaleString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </div>
                        </div>
                      ) : record.status !== "requested" ? (
                        <div className="rounded-lg bg-success/5 px-3 py-2">
                          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            <CheckCircle2 className="h-3 w-3" /> Approval Date
                          </div>
                          <div className="text-foreground">
                            {record.approvedAt
                              ? new Date(record.approvedAt).toLocaleString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-warning/5 px-3 py-2">
                          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            <AlertCircle className="h-3 w-3" /> Status
                          </div>
                          <div className="text-foreground font-medium">Awaiting Approval</div>
                        </div>
                      )}

                      {/* Access window (for approved consents) */}
                      {record.status !== "requested" && record.status !== "rejected" && (
                        <>
                          <div className="rounded-lg bg-muted/50 px-3 py-2">
                            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                              <Clock className="h-3 w-3" /> Access Start
                            </div>
                            <div className="text-foreground">
                              {record.accessStartedAt
                                ? new Date(record.accessStartedAt).toLocaleString("en-IN", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </div>
                          </div>

                          <div className="rounded-lg bg-muted/50 px-3 py-2">
                            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                              <Clock className="h-3 w-3" /> Access Expiry
                            </div>
                            <div className="text-foreground">
                              {record.expiresAt ? (
                                <>
                                  {new Date(record.expiresAt).toLocaleString("en-IN", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                  {record.status === "active" && (
                                    <div className="text-[10px] text-success mt-0.5 font-medium">
                                      {(() => {
                                        const remaining =
                                          new Date(record.expiresAt).getTime() - Date.now();
                                        if (remaining <= 0) return "Expired";
                                        const minutes = Math.floor(remaining / 60000);
                                        if (minutes < 60) return `${minutes}m remaining`;
                                        const hours = Math.floor(minutes / 60);
                                        return `${hours}h ${minutes % 60}m remaining`;
                                      })()}
                                    </div>
                                  )}
                                </>
                              ) : (
                                "No expiry set"
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Current status detail */}
                      <div
                        className={`rounded-lg px-3 py-2 sm:col-span-2 ${
                          record.status === "active"
                            ? "bg-success/5 border border-success/20"
                            : record.status === "expired"
                              ? "bg-muted border border-border"
                              : record.status === "revoked"
                                ? "bg-destructive/5 border border-destructive/20"
                                : "bg-muted border border-border"
                        }`}
                      >
                        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          <Shield className="h-3 w-3" /> Current Status
                        </div>
                        <div className="text-foreground text-xs">
                          {record.status === "active" && (
                            <span className="text-success font-medium">
                              Doctor currently has active access to your {record.resource}
                            </span>
                          )}
                          {record.status === "expired" && (
                            <span>
                              Access expired on{" "}
                              {record.expiresAt &&
                                new Date(record.expiresAt).toLocaleString("en-IN")}
                            </span>
                          )}
                          {record.status === "revoked" && (
                            <span className="text-destructive">
                              You revoked access on{" "}
                              {record.revokedAt &&
                                new Date(record.revokedAt).toLocaleString("en-IN")}
                            </span>
                          )}
                          {record.status === "rejected" && (
                            <span className="text-destructive">
                              You rejected this request on{" "}
                              {record.rejectedAt &&
                                new Date(record.rejectedAt).toLocaleString("en-IN")}
                            </span>
                          )}
                          {record.status === "requested" && (
                            <span className="text-warning-foreground font-medium">
                              Request is pending your approval
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerList>
        )}
      </div>
    </RouteGuard>
  );
}
