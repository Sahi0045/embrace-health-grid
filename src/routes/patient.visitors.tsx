import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { getVisitors, createVisitorRequest, approveVisitorRequest } from "@/lib/api";
import { toast } from "sonner";
import {
  Users2,
  UserPlus2,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  ShieldCheck,
  RefreshCw,
  Search,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/patient/visitors")({
  head: () => ({ meta: [{ title: "Patient · Visitors — Embrace Health Grid" }] }),
  component: PatientVisitors,
});

interface Visitor {
  id: string;
  patientDid: string;
  visitorName: string;
  relation: string;
  visitDate: string;
  purpose: string;
  status: "pending" | "approved" | "denied";
  requestedAt: string;
  requestedBy: string;
}

type Tab = "requests" | "history" | "new";

function PatientVisitors() {
  const [tab, setTab] = useState<Tab>("requests");
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [visitorName, setVisitorName] = useState("");
  const [relation, setRelation] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const patientDid =
    typeof window !== "undefined"
      ? (localStorage.getItem("userDID") ?? "did:hosp:patient:current")
      : "did:hosp:patient:current";

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVisitors(patientDid);
      setVisitors((data.visitors || []) as Visitor[]);
    } catch (err: any) {
      toast.error("Failed to load visitors list", {
        description: err.message || "Error connecting to the blockchain server.",
      });
    } finally {
      setLoading(false);
    }
  }, [patientDid]);

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

  const handleAction = async (id: string, approve: boolean) => {
    try {
      const res = await approveVisitorRequest(id, approve);
      if (res && res.visitor) {
        toast.success(approve ? "Visitor approved" : "Visitor request denied", {
          description: `Access policy updated on-chain for ${res.visitor.visitorName}.`,
        });
        fetchVisitors();
      }
    } catch (err: any) {
      toast.error("Action failed", {
        description: err.message || "Failed to finalize decision on the ledger.",
      });
    }
  };

  const handlePreApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim() || !relation.trim() || !visitDate || !purpose.trim()) {
      toast.error("Please fill in all visitor fields.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create a request first
      const reqRes = await createVisitorRequest({
        patientDid,
        visitorName: visitorName.trim(),
        relation: relation.trim(),
        visitDate,
        purpose: purpose.trim(),
      });

      if (reqRes && reqRes.request) {
        // 2. Pre-approve it automatically since the patient created it themselves
        await approveVisitorRequest(reqRes.request.id, true);
        toast.success("Visitor pre-approved successfully", {
          description: `${visitorName} added to the authorized access logs.`,
        });

        // Reset form
        setVisitorName("");
        setRelation("");
        setVisitDate("");
        setPurpose("");
        setTab("requests");
        fetchVisitors();
      }
    } catch (err: any) {
      toast.error("Failed to pre-approve visitor", {
        description: err.message || "Error executing transaction on ledger.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const pendingRequests = visitors.filter((v) => v.status === "pending");
  const historyList = visitors.filter((v) => v.status !== "pending");

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            eyebrow="Patient Portal"
            title="Visitor Approvals"
            description="Manage and pre-authorize visitor access passes for your ward room."
          />
          <button
            onClick={fetchVisitors}
            disabled={loading}
            className="self-start sm:self-center inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh Ledger
          </button>
        </div>

        {/* Tab Selection */}
        <div className="mt-6 flex border-b border-border">
          <button
            onClick={() => setTab("requests")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
              tab === "requests"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Pending Requests ({pendingRequests.length})
          </button>
          <button
            onClick={() => setTab("history")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
              tab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            History & Logs ({historyList.length})
          </button>
          <button
            onClick={() => setTab("new")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
              tab === "new"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Pre-Authorize Visitor
          </button>
        </div>

        <div className="mt-6">
          <AnimatePresence mode="wait">
            {tab === "requests" && (
              <motion.div
                key="requests"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
              >
                {loading && visitors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 bg-card rounded-2xl border border-border">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">Querying Solana records...</p>
                  </div>
                ) : pendingRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-2xl border border-border p-6">
                    <div className="rounded-full bg-primary/10 p-3 text-primary">
                      <Users2 className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-foreground">
                      No Pending Requests
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                      There are no visitor requests awaiting your decision. You can pre-approve
                      family members to save reception time.
                    </p>
                  </div>
                ) : (
                  <StaggerList className="grid gap-4 sm:grid-cols-2">
                    {pendingRequests.map((req) => (
                      <StaggerItem key={req.id}>
                        <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="font-semibold text-foreground">{req.visitorName}</h4>
                              <p className="text-xs text-muted-foreground capitalize">
                                {req.relation} · {req.purpose}
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                              <Clock className="h-3 w-3" /> Pending
                            </span>
                          </div>

                          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            <span>Scheduled: {new Date(req.visitDate).toLocaleDateString()}</span>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleAction(req.id, false)}
                              className="inline-flex justify-center items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors"
                            >
                              <XCircle className="h-4 w-4" /> Deny Access
                            </button>
                            <button
                              onClick={() => handleAction(req.id, true)}
                              className="inline-flex justify-center items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/95 transition-colors"
                            >
                              <CheckCircle className="h-4 w-4" /> Approve
                            </button>
                          </div>
                        </div>
                      </StaggerItem>
                    ))}
                  </StaggerList>
                )}
              </motion.div>
            )}

            {tab === "history" && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
              >
                {historyList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-2xl border border-border p-6">
                    <div className="rounded-full bg-muted p-3 text-muted-foreground">
                      <FileText className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-foreground">
                      No Visitor History
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                      Visitor approvals and historical logs will show up here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Visitor
                            </th>
                            <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Relationship
                            </th>
                            <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Visit Date
                            </th>
                            <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {historyList.map((log) => (
                            <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-medium text-foreground">{log.visitorName}</div>
                                <div className="text-[10px] font-mono text-muted-foreground max-w-[150px] truncate">
                                  {log.id}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-muted-foreground capitalize">
                                {log.relation}
                              </td>
                              <td className="px-6 py-4 text-muted-foreground">
                                {new Date(log.visitDate).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4">
                                {log.status === "approved" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                                    <ShieldCheck className="h-3 w-3" /> Approved
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                                    <AlertCircle className="h-3 w-3" /> Denied
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {tab === "new" && (
              <motion.div
                key="new"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-6 shadow-clinical"
              >
                <div className="flex items-center gap-3 border-b border-border pb-4 mb-6">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <UserPlus2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground font-clinical">
                      Pre-Authorize Visitor
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Authorize safe admittance in advance on-chain.
                    </p>
                  </div>
                </div>

                <form onSubmit={handlePreApprove} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Visitor Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mary Doe"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Relationship
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Spouse, Sibling"
                        value={relation}
                        onChange={(e) => setRelation(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Visit Date
                      </label>
                      <input
                        type="date"
                        value={visitDate}
                        onChange={(e) => setVisitDate(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Purpose of Visit
                    </label>
                    <textarea
                      placeholder="e.g. Delivery of personal goods, bedside companion"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setTab("requests")}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/95 transition-colors disabled:opacity-50"
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Authorize Pass
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </RouteGuard>
  );
}
