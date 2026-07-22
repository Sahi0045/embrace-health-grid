import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { getNamespace, createVisitorRequest, logAuditEvent } from "@/lib/api";
import { useLivePatients } from "@/hooks/use-api";
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
  LogIn,
} from "lucide-react";

export const Route = createFileRoute("/staff/visitors")({
  head: () => ({ meta: [{ title: "Staff · Visitors — Embrace Health Grid" }] }),
  component: StaffVisitors,
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
  checkedInAt?: string;
}

type Tab = "active" | "new";

function StaffVisitors() {
  const [tab, setTab] = useState<Tab>("active");
  const { patients: patientsList } = useLivePatients();

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Form states
  const [selectedPatientDid, setSelectedPatientDid] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [relation, setRelation] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAllVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const allDids = (patientsList || []).map((p) => p.did).filter(Boolean);
      if (allDids.length === 0) {
        const data = await getNamespace("visitors");
        const list = (data || []).map((entry: any) => entry.value) as Visitor[];
        setVisitors(list);
      } else {
        const { getVisitors } = await import("@/lib/api");
        const results = await Promise.all(allDids.map((did) => getVisitors(did).catch(() => ({ visitors: [] }))));
        const list = results.flatMap((r) => (r.visitors ?? []) as Visitor[]);
        setVisitors(list);
      }
    } catch (err: any) {
      toast.error("Failed to load visitor directory", {
        description: err.message || "Error reading visitors.",
      });
    } finally {
      setLoading(false);
    }
  }, [patientsList]);

  useEffect(() => {
    fetchAllVisitors();
  }, [fetchAllVisitors]);

  // Set default patient if available
  useEffect(() => {
    if (patientsList && patientsList.length > 0 && !selectedPatientDid) {
      setSelectedPatientDid(patientsList[0].did);
    }
  }, [patientsList, selectedPatientDid]);

  const handleRegisterRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !selectedPatientDid ||
      !visitorName.trim() ||
      !relation.trim() ||
      !visitDate ||
      !purpose.trim()
    ) {
      toast.error("Please fill in all registration fields.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createVisitorRequest({
        patientDid: selectedPatientDid,
        visitorName: visitorName.trim(),
        relation: relation.trim(),
        visitDate,
        purpose: purpose.trim(),
      });

      if (res && res.request) {
        toast.success("Visitor request registered", {
          description: `${visitorName} registered under pending patient approval.`,
        });

        // Reset fields
        setVisitorName("");
        setRelation("");
        setVisitDate("");
        setPurpose("");
        setTab("active");
        fetchAllVisitors();
      }
    } catch (err: any) {
      toast.error("Failed to register request", {
        description: err.message || "Error writing to Ledger.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVisitorCheckin = async (visitor: Visitor) => {
    try {
      // Record checkin audit log on ledger
      await logAuditEvent(
        "staff",
        visitor.id,
        `VISITOR_CHECKIN: ${visitor.visitorName} entered ward room for patient ${visitor.patientDid}`,
        "success",
        "info",
      );

      // Local state update update locally for visual feedback
      setVisitors((prev) =>
        prev.map((v) =>
          v.id === visitor.id ? { ...v, checkedInAt: new Date().toISOString() } : v,
        ),
      );

      toast.success("Visitor Checked-In Successfully", {
        description: `${visitor.visitorName} check-in registered and audited.`,
      });
    } catch (err: any) {
      toast.error("Check-in registration failed", {
        description: err.message || "Failed to record transaction.",
      });
    }
  };

  const filteredVisitors = visitors.filter((v) => {
    const matchSearch =
      v.visitorName.toLowerCase().includes(search.toLowerCase()) ||
      v.relation.toLowerCase().includes(search.toLowerCase()) ||
      v.purpose.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <RouteGuard requiredRole="staff">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            eyebrow="Staff Command"
            title="Visitor Registration & Logs"
            description="Register visitor requests and verify approved patient entry passes."
          />
          <button
            onClick={fetchAllVisitors}
            disabled={loading}
            className="self-start sm:self-center inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Sync Directory
          </button>
        </div>

        {/* Tab Selection */}
        <div className="mt-6 flex border-b border-border">
          <button
            onClick={() => setTab("active")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
              tab === "active"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Visitor Directory ({filteredVisitors.length})
          </button>
          <button
            onClick={() => setTab("new")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
              tab === "new"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            New Visitor Request
          </button>
        </div>

        <div className="mt-6">
          <AnimatePresence mode="wait">
            {tab === "active" && (
              <motion.div
                key="active"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Search Bar */}
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search visitors by name, relationship, purpose..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </div>

                {loading && visitors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 bg-card rounded-2xl border border-border">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">Reading blockchain logs...</p>
                  </div>
                ) : filteredVisitors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-2xl border border-border p-6">
                    <div className="rounded-full bg-primary/10 p-3 text-primary">
                      <Users2 className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-foreground">
                      No Visitors Found
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                      No visitor records found matching your search. Create a new request to get
                      started.
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
                              Patient (DID)
                            </th>
                            <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Purpose
                            </th>
                            <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredVisitors.map((v) => {
                            const pName =
                              patientsList?.find((p) => p.did === v.patientDid)?.name ||
                              "Unknown Patient";
                            return (
                              <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-medium text-foreground">{v.visitorName}</div>
                                  <div className="text-xs text-muted-foreground capitalize">
                                    {v.relation}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-foreground font-medium">{pName}</div>
                                  <div className="text-[10px] font-mono text-muted-foreground max-w-[150px] truncate">
                                    {v.patientDid}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(v.visitDate).toLocaleDateString()}
                                  </div>
                                  <div className="text-xs text-foreground font-medium">
                                    {v.purpose}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  {v.status === "approved" ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                                      <ShieldCheck className="h-3 w-3" /> Approved
                                    </span>
                                  ) : v.status === "denied" ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                                      <XCircle className="h-3 w-3" /> Denied
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                                      <Clock className="h-3 w-3" /> Pending Patient
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  {v.status === "approved" ? (
                                    v.checkedInAt ? (
                                      <span className="text-xs text-muted-foreground font-medium">
                                        Checked In ·{" "}
                                        {new Date(v.checkedInAt).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => handleVisitorCheckin(v)}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                                      >
                                        <LogIn className="h-3.5 w-3.5" /> Check In
                                      </button>
                                    )
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      No Actions
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
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
                    <h3 className="text-base font-semibold text-foreground font-clinical font-medium">
                      New Visitor Pass Request
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Register request for hospital reception desk.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleRegisterRequest} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Select Patient
                    </label>
                    <select
                      value={selectedPatientDid}
                      onChange={(e) => setSelectedPatientDid(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
                      required
                    >
                      {patientsList?.map((p) => (
                        <option key={p.did} value={p.did}>
                          {p.name} ({p.mrn})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Visitor Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Robert Smith"
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
                        placeholder="e.g. Friend, Guardian"
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
                        className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Purpose of Visit
                    </label>
                    <textarea
                      placeholder="e.g. Consult with clinician, supply personal care products"
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
                      onClick={() => setTab("active")}
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
                      Register Pass
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
