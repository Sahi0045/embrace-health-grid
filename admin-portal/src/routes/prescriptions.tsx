import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Pill, Search, RefreshCw, ChevronDown, ChevronUp,
  CalendarDays, Hash, User, Shield, Activity,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/prescriptions")({
  head: () => ({ meta: [{ title: "Admin · Prescriptions — Embrace Health Grid" }] }),
  component: AdminPrescriptionsPage,
});

const API = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL)
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : "http://localhost:3001/api";

async function apiFetch<T>(path: string): Promise<T> {
  const token = sessionStorage.getItem("authToken") || localStorage.getItem("authToken");
  const clientKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_CLIENT_KEY) || "apollo-consortium-client-secret-2026";
  const r = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-client-key": clientKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({ error: r.statusText })); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

// ─── STATUS badge config ──────────────────────────────────────────────────────
const STATUS_CLS: Record<string, string> = {
  active:    "bg-primary/10 text-primary",
  dispensed: "bg-success/15 text-success",
  expired:   "bg-muted text-muted-foreground",
};

function AdminPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [searchQ,       setSearchQ]       = useState("");
  const [doctorFilter,  setDoctorFilter]  = useState("All");
  const [statusFilter,  setStatusFilter]  = useState("All");
  const [expandedId,    setExpandedId]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ prescriptions: any[] }>("/prescriptions");
      const sorted = (res.prescriptions ?? []).sort((a: any, b: any) =>
        (b.signedAt || "").localeCompare(a.signedAt || ""),
      );
      setPrescriptions(sorted);
    } catch (err: any) {
      toast.error("Could not load prescriptions", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time WebSocket
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
          try { if (JSON.parse(e.data).event === "prescription:signed") load(); } catch { /* ignore */ }
        };
        ws.onclose = () => { retry = setTimeout(connect, 5000); };
      } catch { /* no WS */ }
    };
    connect();
    return () => { ws?.close(); clearTimeout(retry); };
  }, [load]);

  // Unique doctor names for filter
  const doctors = ["All", ...Array.from(new Set(prescriptions.map((rx) => rx.doctorName || rx.signedBy).filter(Boolean)))];

  const filtered = prescriptions.filter((rx) => {
    const q = searchQ.toLowerCase();
    const matchQ = !q
      || rx.patientName?.toLowerCase().includes(q)
      || rx.patientDid?.toLowerCase().includes(q)
      || rx.doctorName?.toLowerCase().includes(q)
      || rx.diagnosis?.toLowerCase().includes(q)
      || rx.rxId?.toLowerCase().includes(q);
    const matchD = doctorFilter === "All" || rx.doctorName === doctorFilter || rx.signedBy === doctorFilter;
    const matchS = statusFilter === "All" || rx.status === statusFilter;
    return matchQ && matchD && matchS;
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between border-b border-border pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Admin Console</div>
          <h1 className="text-2xl font-bold text-foreground">Prescriptions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Read-only audit view of all prescriptions across all doctors. {prescriptions.length} total.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted shrink-0 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Total Prescriptions", value: prescriptions.length,                          cls: "text-primary"      },
          { label: "Active",              value: prescriptions.filter((r) => r.status === "active").length,    cls: "text-success"     },
          { label: "Doctors",             value: doctors.length - 1,                             cls: "text-foreground"  },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 shadow-clinical">
            <div className={`text-2xl font-black ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search patient, doctor, diagnosis, Rx ID…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </div>
        <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold outline-none">
          {doctors.map((d) => <option key={d} value={d}>Doctor: {d}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold outline-none">
          {["All", "active", "dispensed", "expired"].map((s) => (
            <option key={s} value={s}>Status: {s === "All" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12 text-sm text-muted-foreground gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading prescriptions…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Pill className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <div className="text-sm font-semibold text-foreground">No prescriptions found</div>
          <div className="text-xs text-muted-foreground mt-1">
            {searchQ || doctorFilter !== "All" || statusFilter !== "All"
              ? "No results match your filters." : "No prescriptions have been issued yet."}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rx) => {
            const isExp = expandedId === rx.rxId;
            const sCls  = STATUS_CLS[rx.status] ?? STATUS_CLS.active;
            return (
              <div key={rx.rxId} className="rounded-xl border border-border bg-card shadow-clinical overflow-hidden">
                {/* Summary row */}
                <button className="w-full text-left p-4" onClick={() => setExpandedId(isExp ? null : rx.rxId)}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-2/10">
                        <Pill className="h-5 w-5 text-chart-2" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                          {rx.patientName || rx.patientDid}
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sCls}`}>{rx.status ?? "active"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Dx: {rx.diagnosis || "—"}
                          {rx.chiefComplaint ? ` · ${rx.chiefComplaint}` : ""}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />{rx.doctorName || rx.signedBy || "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {rx.signedAt ? new Date(rx.signedAt).toLocaleString("en-IN") : "—"}
                          </span>
                          <span className="font-mono">{rx.rxId}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{(rx.drugs ?? []).length} drug{(rx.drugs ?? []).length !== 1 ? "s" : ""}</span>
                      {isExp ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </button>

                {/* Expanded detail — read-only */}
                {isExp && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    {/* Read-only banner */}
                    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                      <Shield className="h-3.5 w-3.5 shrink-0" />
                      Read-only audit view — Admin cannot modify prescriptions.
                    </div>

                    {/* Doctor + patient info */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        ["Doctor",         rx.doctorName || rx.signedBy || "—"],
                        ["Doctor DID",     rx.doctorDid  || "—"],
                        ["Patient DID",    rx.patientDid || "—"],
                        ["Appointment ID", rx.apptId     || "—"],
                        ["Follow-up",      rx.followUpDate ? new Date(rx.followUpDate).toLocaleDateString("en-IN") : "—"],
                        ["Status",         rx.status     || "active"],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-muted/50 px-3 py-2">
                          <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">{k}</div>
                          <div className="font-medium text-foreground truncate">{v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Symptoms if present */}
                    {(rx.chiefComplaint || rx.symptoms) && (
                      <div className="grid gap-2 sm:grid-cols-2 text-xs">
                        {rx.chiefComplaint && (
                          <div className="rounded-lg bg-card border border-border px-3 py-2">
                            <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Chief Complaint</div>
                            <div>{rx.chiefComplaint}</div>
                          </div>
                        )}
                        {rx.symptoms && (
                          <div className="rounded-lg bg-card border border-border px-3 py-2">
                            <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Symptoms</div>
                            <div>{rx.symptoms}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Medicines */}
                    {(rx.drugs ?? []).length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">Medicines</div>
                        {(rx.drugs ?? []).map((d: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
                            <Pill className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-foreground">{d.name}</span>
                              {d.dosage    && <span className="text-muted-foreground"> · {d.dosage}</span>}
                              {d.frequency && <span className="text-muted-foreground"> · {d.frequency}</span>}
                              {d.duration  && <span className="text-muted-foreground"> · {d.duration}</span>}
                              {d.usage     && <span className="text-primary"> ({d.usage})</span>}
                              {d.instructions && <div className="italic text-muted-foreground mt-0.5">{d.instructions}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {rx.notes && (
                      <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs">
                        <span className="font-semibold text-foreground">Notes: </span>
                        <span className="text-muted-foreground">{rx.notes}</span>
                      </div>
                    )}

                    {/* Cryptographic hash */}
                    <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1.5 font-mono text-[9px] text-primary overflow-x-auto">
                      <Hash className="h-3 w-3 shrink-0" />{rx.hash}
                    </div>

                    {/* Blockchain meta */}
                    {rx.blockchainMeta && (
                      <div className="flex items-center gap-1.5 rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-[10px] text-success font-semibold">
                        <Activity className="h-3.5 w-3.5 shrink-0" />
                        Blockchain-ready · {rx.blockchainMeta.network ?? "solana-devnet"}
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
