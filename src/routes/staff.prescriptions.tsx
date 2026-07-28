import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import {
  Pill, Search, FileSignature, RefreshCw, Wifi, WifiOff,
  CalendarDays, Hash, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { getMyPrescriptions } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/prescriptions")({
  head: () => ({ meta: [{ title: "Prescriptions — Staff Portal" }] }),
  component: PrescriptionsPage,
});

function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [online,        setOnline]        = useState(false);
  const [searchQ,       setSearchQ]       = useState("");
  const [expandedId,    setExpandedId]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyPrescriptions();
      setPrescriptions(res.prescriptions ?? []);
      setOnline(true);
    } catch (err: any) {
      setOnline(false);
      toast.error("Could not load prescriptions", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time WebSocket: refresh when any prescription is signed
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

  const filtered = prescriptions.filter((rx) => {
    const q = searchQ.toLowerCase();
    return !q
      || rx.patientName?.toLowerCase().includes(q)
      || rx.patientDid?.toLowerCase().includes(q)
      || rx.diagnosis?.toLowerCase().includes(q)
      || rx.rxId?.toLowerCase().includes(q);
  });

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Staff Portal"
        title="My Prescriptions"
        description="Prescriptions you signed — isolated to your patients only. Updates in real time."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${online ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Live" : "Offline"}
            </span>
            <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <Link to="/staff/sign"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <FileSignature className="h-4 w-4" /> Sign New Prescription
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-5">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search patient, diagnosis, Rx ID…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-sm text-muted-foreground gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-16 text-center space-y-3">
            <Pill className="h-10 w-10 text-muted-foreground/30" />
            <div className="text-sm font-semibold text-foreground">No prescriptions found</div>
            <div className="text-xs text-muted-foreground">
              {searchQ ? "No results match your search." : "Prescriptions you sign appear here instantly."}
            </div>
            <Link to="/staff/sign"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <FileSignature className="h-4 w-4" /> Sign First Prescription
            </Link>
          </div>
        ) : (
          <StaggerList className="space-y-3">
            {filtered.map((rx) => {
              const isExp = expandedId === rx.rxId;
              return (
                <StaggerItem key={rx.rxId}>
                  <div className="rounded-xl border border-border bg-card shadow-clinical overflow-hidden">
                    {/* Summary row */}
                    <button className="w-full text-left p-4" onClick={() => setExpandedId(isExp ? null : rx.rxId)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-2/10">
                            <Pill className="h-5 w-5 text-chart-2" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                              {rx.patientName || rx.patientDid}
                              <span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold">Signed</span>
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-[340px]">
                              {rx.diagnosis}{rx.chiefComplaint ? ` · ${rx.chiefComplaint}` : ""}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {rx.signedAt ? new Date(rx.signedAt).toLocaleString("en-IN") : "—"}
                              </span>
                              <span className="font-mono">{rx.rxId}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {(rx.drugs ?? []).length} drug{(rx.drugs ?? []).length !== 1 ? "s" : ""}
                          </span>
                          {isExp ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExp && (
                      <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[
                            ["Patient DID", rx.patientDid ?? "—"],
                            ["Appointment",  rx.apptId    ?? "—"],
                            ["Follow-up",    rx.followUpDate ? new Date(rx.followUpDate).toLocaleDateString("en-IN") : "—"],
                            ["Status",       rx.status    ?? "active"],
                          ].map(([k, v]) => (
                            <div key={k} className="rounded-lg bg-muted/50 px-3 py-2">
                              <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">{k}</div>
                              <div className="font-medium text-foreground truncate">{v}</div>
                            </div>
                          ))}
                        </div>

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

                        <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1.5 font-mono text-[9px] text-primary overflow-x-auto">
                          <Hash className="h-3 w-3 shrink-0" />{rx.hash}
                        </div>
                      </div>
                    )}
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerList>
        )}
      </div>
    </RouteGuard>
  );
}
