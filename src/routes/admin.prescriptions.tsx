import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { useState, useEffect, useCallback } from "react";
import {
  Pill,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Hash,
  User,
  Shield,
  Activity,
  FileText,
  FlaskConical,
  CheckCircle2,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/prescriptions")({
  head: () => ({ meta: [{ title: "Admin · Prescriptions — Embrace Health Grid" }] }),
  component: AdminPrescriptionsPageGuarded,
});

const API =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : "http://localhost:3001/api";

async function apiFetch<T>(path: string): Promise<T> {
  const token = sessionStorage.getItem("authToken") || localStorage.getItem("authToken");
  const clientKey =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_CLIENT_KEY) ||
    "apollo-consortium-client-secret-2026";
  const r = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-client-key": clientKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(e.error ?? r.statusText);
  }
  return r.json();
}

const STATUS_CLS: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  dispensed: "bg-success/15 text-success",
  expired: "bg-muted text-muted-foreground",
};

function AdminPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch prescriptions and all medical records in parallel
      const [rxRes, recRes] = await Promise.all([
        apiFetch<{ prescriptions: any[] }>("/prescriptions"),
        apiFetch<{ records: any[] }>("/medical-records").catch(() => ({ records: [] })),
      ]);
      const sorted = (rxRes.prescriptions ?? []).sort((a: any, b: any) =>
        (b.signedAt || "").localeCompare(a.signedAt || ""),
      );
      setPrescriptions(sorted);
      setAllRecords(recRes.records ?? []);
    } catch (err: any) {
      toast.error("Could not load prescriptions", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time WebSocket — refresh on prescription:signed OR record:created
  useEffect(() => {
    const wsUrl = (
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
      "http://localhost:3001"
    ).replace(/^http/, "ws");
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.event === "prescription:signed" || msg.event === "record:created") load();
          } catch {
            /* ignore */
          }
        };
        ws.onclose = () => {
          retry = setTimeout(connect, 5000);
        };
      } catch {
        /* no WS */
      }
    };
    connect();
    return () => {
      ws?.close();
      clearTimeout(retry);
    };
  }, [load]);

  // Unique doctor names for filter
  const doctors = [
    "All",
    ...Array.from(new Set(prescriptions.map((rx) => rx.doctorName || rx.signedBy).filter(Boolean))),
  ];

  // Join each prescription with its linked medical report by rxId
  const consultations = prescriptions
    .filter((rx) => {
      const q = searchQ.toLowerCase();
      const matchQ =
        !q ||
        rx.patientName?.toLowerCase().includes(q) ||
        rx.patientDid?.toLowerCase().includes(q) ||
        rx.doctorName?.toLowerCase().includes(q) ||
        rx.diagnosis?.toLowerCase().includes(q) ||
        rx.rxId?.toLowerCase().includes(q) ||
        rx.apptId?.toLowerCase().includes(q);
      const matchD =
        doctorFilter === "All" || rx.doctorName === doctorFilter || rx.signedBy === doctorFilter;
      const matchS = statusFilter === "All" || rx.status === statusFilter;
      return matchQ && matchD && matchS;
    })
    .map((rx) => ({
      ...rx,
      linkedReport: allRecords.find((r) => r.rxId === rx.rxId) ?? null,
    }));

  const withReports = prescriptions.filter((rx) =>
    allRecords.some((r) => r.rxId === rx.rxId),
  ).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between border-b border-border pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
            Admin Console
          </div>
          <h1 className="text-2xl font-bold text-foreground">Prescriptions & Medical Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Read-only audit view of all prescriptions and linked medical reports across all doctors.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 text-center">
        {[
          { label: "Total Prescriptions", value: prescriptions.length, cls: "text-primary" },
          {
            label: "Active",
            value: prescriptions.filter((r) => r.status === "active").length,
            cls: "text-success",
          },
          { label: "With Reports", value: withReports, cls: "text-chart-2" },
          { label: "Doctors", value: doctors.length - 1, cls: "text-foreground" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-3 shadow-clinical"
          >
            <div className={`text-2xl font-black ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Read-only banner */}
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-primary">
        <Shield className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          Read-only audit view — Admin can view but cannot create, edit, or delete prescriptions or
          medical reports.
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search patient, doctor, diagnosis, Rx ID, appointment…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold outline-none"
        >
          {doctors.map((d) => (
            <option key={d} value={d}>
              Doctor: {d}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold outline-none"
        >
          {["All", "active", "dispensed", "expired"].map((s) => (
            <option key={s} value={s}>
              Status: {s === "All" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12 text-sm text-muted-foreground gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : consultations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Pill className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <div className="text-sm font-semibold text-foreground">No prescriptions found</div>
          <div className="text-xs text-muted-foreground mt-1">
            {searchQ || doctorFilter !== "All" || statusFilter !== "All"
              ? "No results match your filters."
              : "No prescriptions have been issued yet."}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {consultations.map((cx) => {
            const isExp = expandedId === cx.rxId;
            const sCls = STATUS_CLS[cx.status] ?? STATUS_CLS.active;
            return (
              <div
                key={cx.rxId}
                className="rounded-xl border border-border bg-card shadow-clinical overflow-hidden"
              >
                {/* ── Summary row ── */}
                <button
                  className="w-full text-left p-4"
                  onClick={() => setExpandedId(isExp ? null : cx.rxId)}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-2/10">
                        <Pill className="h-5 w-5 text-chart-2" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                          {cx.patientName || cx.patientDid}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sCls}`}
                          >
                            {cx.status ?? "active"}
                          </span>
                          {cx.linkedReport && (
                            <span className="rounded-full bg-chart-2/15 text-chart-2 px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
                              <FileText className="h-2.5 w-2.5" /> Report
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Dx: {cx.diagnosis || "—"}
                          {cx.chiefComplaint ? ` · ${cx.chiefComplaint}` : ""}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {cx.doctorName || cx.signedBy || "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {cx.signedAt ? new Date(cx.signedAt).toLocaleString("en-IN") : "—"}
                          </span>
                          <span className="font-mono">{cx.rxId}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {(cx.drugs ?? []).length} drug{(cx.drugs ?? []).length !== 1 ? "s" : ""}
                      </span>
                      {isExp ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>

                {/* ── Expanded: prescription + linked report ── */}
                {isExp && (
                  <div className="border-t border-border px-4 pb-5 pt-3 space-y-4">
                    {/* ── Prescription section ── */}
                    <div className="space-y-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Pill className="h-3.5 w-3.5" /> Prescription Details
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                        {[
                          ["Doctor", cx.doctorName || cx.signedBy || "—"],
                          ["Doctor DID", cx.doctorDid || "—"],
                          ["Patient DID", cx.patientDid || "—"],
                          ["Appointment ID", cx.apptId || "—"],
                          [
                            "Issued At",
                            cx.signedAt ? new Date(cx.signedAt).toLocaleString("en-IN") : "—",
                          ],
                          [
                            "Follow-up",
                            cx.followUpDate
                              ? new Date(cx.followUpDate).toLocaleDateString("en-IN")
                              : "—",
                          ],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-lg bg-muted/50 px-3 py-2">
                            <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">
                              {k}
                            </div>
                            <div className="font-medium text-foreground truncate">{v}</div>
                          </div>
                        ))}
                      </div>

                      {(cx.chiefComplaint || cx.symptoms) && (
                        <div className="grid gap-2 sm:grid-cols-2 text-xs">
                          {cx.chiefComplaint && (
                            <div className="rounded-lg bg-card border border-border px-3 py-2">
                              <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5 flex items-center gap-1">
                                <Stethoscope className="h-3 w-3" /> Chief Complaint
                              </div>
                              <div>{cx.chiefComplaint}</div>
                            </div>
                          )}
                          {cx.symptoms && (
                            <div className="rounded-lg bg-card border border-border px-3 py-2">
                              <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">
                                Symptoms
                              </div>
                              <div>{cx.symptoms}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {(cx.drugs ?? []).length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold uppercase text-muted-foreground">
                            Medicines
                          </div>
                          {(cx.drugs ?? []).map((d: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                            >
                              <Pill className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-foreground">{d.name}</span>
                                {d.dosage && (
                                  <span className="text-muted-foreground"> · {d.dosage}</span>
                                )}
                                {d.frequency && (
                                  <span className="text-muted-foreground"> · {d.frequency}</span>
                                )}
                                {d.duration && (
                                  <span className="text-muted-foreground"> · {d.duration}</span>
                                )}
                                {d.usage && <span className="text-primary"> ({d.usage})</span>}
                                {d.instructions && (
                                  <div className="italic text-muted-foreground mt-0.5">
                                    {d.instructions}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {cx.notes && (
                        <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs">
                          <span className="font-semibold text-foreground">Additional Notes: </span>
                          <span className="text-muted-foreground">{cx.notes}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 rounded-lg bg-success/5 border border-success/20 px-3 py-2 text-xs">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        <span className="font-semibold text-success">Digitally Signed</span>
                        <span className="text-muted-foreground">· DID + Ed25519</span>
                      </div>

                      <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1.5 font-mono text-[9px] text-primary overflow-x-auto">
                        <Hash className="h-3 w-3 shrink-0" />
                        {cx.hash}
                      </div>

                      {cx.blockchainMeta && (
                        <div className="flex items-center gap-1.5 rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-[10px] text-success font-semibold">
                          <Activity className="h-3.5 w-3.5 shrink-0" />
                          Blockchain-ready · {cx.blockchainMeta.network ?? "solana-devnet"}
                        </div>
                      )}
                    </div>

                    {/* ── Linked Medical Report section ── */}
                    {cx.linkedReport ? (
                      <div className="rounded-xl border border-chart-2/30 bg-chart-2/5 p-4 space-y-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-chart-2 flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" /> Linked Medical Report
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {cx.linkedReport.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {cx.linkedReport.recordId} ·{" "}
                            {new Date(cx.linkedReport.createdAt).toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 text-xs">
                          {cx.linkedReport.consultationSummary && (
                            <div className="sm:col-span-2 rounded-lg bg-card border border-border px-3 py-2">
                              <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">
                                Consultation Summary
                              </div>
                              <div className="text-foreground">
                                {cx.linkedReport.consultationSummary}
                              </div>
                            </div>
                          )}
                          {cx.linkedReport.clinicalNotes && (
                            <div className="rounded-lg bg-card border border-border px-3 py-2">
                              <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">
                                Clinical Notes
                              </div>
                              <div className="text-foreground">{cx.linkedReport.clinicalNotes}</div>
                            </div>
                          )}
                          {cx.linkedReport.testResults && (
                            <div className="rounded-lg bg-card border border-border px-3 py-2">
                              <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5 flex items-center gap-1">
                                <FlaskConical className="h-3 w-3" /> Test Results
                              </div>
                              <div className="text-foreground">{cx.linkedReport.testResults}</div>
                            </div>
                          )}
                          {cx.linkedReport.recommendedFollowUp && (
                            <div className="rounded-lg bg-card border border-border px-3 py-2">
                              <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">
                                Recommended Follow-up
                              </div>
                              <div className="text-foreground">
                                {cx.linkedReport.recommendedFollowUp}
                              </div>
                            </div>
                          )}
                          {!cx.linkedReport.consultationSummary && cx.linkedReport.content && (
                            <div className="sm:col-span-2 rounded-lg bg-card border border-border px-3 py-2">
                              <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">
                                Report Content
                              </div>
                              <div className="text-foreground">{cx.linkedReport.content}</div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                          <div>
                            <div className="text-[9px] text-muted-foreground uppercase font-semibold">
                              Treating Doctor
                            </div>
                            <div className="font-medium text-foreground">
                              {cx.linkedReport.doctorName || cx.doctorName || "—"}
                            </div>
                            {cx.linkedReport.doctorDid && (
                              <div className="font-mono text-[10px] text-primary">
                                {cx.linkedReport.doctorDid}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        No medical report linked to this prescription yet.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Admin gate. The role comes from Postgres via the server-verified session, and
 * RLS enforces the boundary independently — bypassing this renders empty data,
 * not another user's records.
 */
function AdminPrescriptionsPageGuarded() {
  return (
    <RouteGuard requiredRole="admin">
      <AdminPrescriptionsPage />
    </RouteGuard>
  );
}
