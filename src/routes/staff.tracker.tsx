import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { getVerifiedDoctors, getAllRoomStatuses, getDoctorLocationHistory, dispatchPagerNotify } from "@/lib/api";
import {
  MapPin, Search, Send, Activity, Building2, X, History,
  RefreshCw, CheckCircle2, Clock, ShieldCheck, Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/tracker")({
  head: () => ({ meta: [{ title: "Doctor Locator — Staff Portal" }] }),
  component: DoctorLocatorPage,
});

// ─── status config ────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  "In Room":      { label: "In Room",      cls: "bg-success/15 text-success border-success/30",           dot: "bg-success"            },
  "Busy":         { label: "Busy",         cls: "bg-warning/15 text-warning-foreground border-warning/30", dot: "bg-warning"            },
  "Available":    { label: "Available",    cls: "bg-primary/10 text-primary border-primary/20",            dot: "bg-primary"            },
  "Checked Out":  { label: "Checked Out",  cls: "bg-muted text-muted-foreground border-border",            dot: "bg-muted-foreground"   },
};

function statusOf(doc: any): string {
  if (doc.activeRooms && doc.activeRooms.length > 1)  return "Busy";
  if (doc.activeRooms && doc.activeRooms.length === 1) return "In Room";
  if (doc.roomStatus === "enter" || doc.status === "In Room") return "In Room";
  return "Available";
}

function DoctorLocatorPage() {
  const [doctors,      setDoctors]      = useState<any[]>([]);
  const [roomStatuses, setRoomStatuses] = useState<Map<string, any>>(new Map());
  const [loading,      setLoading]      = useState(true);
  const [lastSync,     setLastSync]     = useState(new Date().toLocaleTimeString());

  const [searchQuery,     setSearchQuery]     = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("All");
  const [statusFilter,    setStatusFilter]    = useState("All");

  const [selectedDoctor,    setSelectedDoctor]    = useState<any | null>(null);
  const [historyDoctor,     setHistoryDoctor]     = useState<any | null>(null);
  const [doctorLogs,        setDoctorLogs]        = useState<any[]>([]);
  const [loadingLogs,       setLoadingLogs]       = useState(false);

  const [liveLog, setLiveLog] = useState<{ id: string; time: string; event: string }[]>([]);

  // ── fetch ─────────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const [docRes, statusRes] = await Promise.allSettled([
        getVerifiedDoctors(),
        getAllRoomStatuses(),
      ]);

      // Build room-status map keyed by doctorDid
      const statusMap = new Map<string, any>();
      if (statusRes.status === "fulfilled") {
        (statusRes.value.statuses ?? []).forEach((s: any) => {
          statusMap.set(s.doctorDid, s);
        });
      }
      setRoomStatuses(statusMap);

      if (docRes.status === "fulfilled") {
        const merged = (docRes.value.doctors ?? []).map((doc: any) => {
          const rs = statusMap.get(doc.did);
          return {
            ...doc,
            activeRooms:     rs?.activeRooms    ?? [],
            currentLocation: rs?.activeRooms?.[0]?.name ?? (doc.activeRoom !== "None" ? doc.activeRoom : null) ?? "Nursing Station",
            computedStatus:  rs ? (rs.activeRooms?.length > 1 ? "Busy" : rs.activeRooms?.length === 1 ? "In Room" : "Available") : statusOf(doc),
          };
        });
        setDoctors(merged);
      }
      setLastSync(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.warn("Locator refresh error:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── WebSocket real-time ────────────────────────────────────────────────────
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
            if (["room:checkin", "staff:location", "did:created"].includes(msg.event)) {
              refresh();

              // Update live feed
              const d = msg.data ?? {};
              let eventText = "";
              if (msg.event === "room:checkin") {
                const roomList = (d.rooms ?? []).map((r: any) => r.name).join(", ");
                eventText = `${d.doctorName ?? "Doctor"} ${d.action === "checkin" ? "checked in to" : "checked out of"} ${roomList}`;
              } else if (msg.event === "staff:location") {
                eventText = `${d.name ?? "Doctor"} → ${d.location ?? ""}`;
              } else {
                eventText = "DID registry updated";
              }
              if (eventText) {
                setLiveLog((prev) => [
                  { id: `ev_${Date.now()}`, time: new Date().toLocaleTimeString(), event: eventText },
                  ...prev.slice(0, 19),
                ]);
              }
            }
          } catch { /* ignore */ }
        };
        ws.onclose = () => { retry = setTimeout(connect, 5000); };
      } catch { /* no WS */ }
    };

    connect();
    const poll = setInterval(refresh, 8_000);
    return () => { ws?.close(); clearTimeout(retry); clearInterval(poll); };
  }, [refresh]);

  // ── doctor history ─────────────────────────────────────────────────────────
  const openHistory = async (doc: any) => {
    setHistoryDoctor(doc);
    setLoadingLogs(true);
    try {
      const res = await getDoctorLocationHistory(doc.did);
      setDoctorLogs(res.logs ?? []);
    } catch (err: any) {
      toast.error("Failed to load history", { description: err.message });
      setDoctorLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handlePage = async (doc: any) => {
    try {
      await dispatchPagerNotify(doc.did, doc.name, doc.currentLocation);
      toast.success("Emergency Pager Dispatched", { description: `Sent alert to ${doc.name}` });
    } catch { /* silent */ }
    setLiveLog((prev) => [
      { id: `page_${Date.now()}`, time: new Date().toLocaleTimeString(), event: `PAGER → ${doc.name} at ${doc.currentLocation}` },
      ...prev.slice(0, 19),
    ]);
  };

  // ── filter ─────────────────────────────────────────────────────────────────
  const specialties = ["All", ...Array.from(new Set(doctors.map((d) => d.specialty).filter(Boolean)))];

  const filtered = doctors.filter((d) => {
    const q = searchQuery.toLowerCase();
    const matchQ =
      d.name?.toLowerCase().includes(q) ||
      d.did?.toLowerCase().includes(q) ||
      d.specialty?.toLowerCase().includes(q) ||
      d.currentLocation?.toLowerCase().includes(q);
    const matchSpec = specialtyFilter === "All" || d.specialty === specialtyFilter;
    const matchStatus = statusFilter === "All" || d.computedStatus === statusFilter;
    return matchQ && matchSpec && matchStatus;
  });

  // ── stats ─────────────────────────────────────────────────────────────────
  const inRoomCount = doctors.filter((d) => d.computedStatus === "In Room").length;
  const busyCount   = doctors.filter((d) => d.computedStatus === "Busy").length;
  const erCount     = doctors.filter((d) =>
    d.currentLocation?.toLowerCase().includes("emergency") ||
    d.currentLocation?.toLowerCase().includes("er") ||
    d.activeRooms?.some((r: any) => r.type === "ER"),
  ).length;

  return (
    <RouteGuard requiredRole="staff">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3 border-b border-border pb-4">
          <PageHeader
            eyebrow="Staff Portal — Admin-Issued DID Doctor Tracker"
            title="Real-Time Doctor Locator"
            description={`${doctors.length} verified doctors · Last sync: ${lastSync}`}
          />
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <div className="flex gap-2 text-xs">
              {[
                { label: "Verified DIDs", value: doctors.length,  cls: "text-primary" },
                { label: "In Room",       value: inRoomCount,     cls: "text-success" },
                { label: "Busy",          value: busyCount,       cls: "text-warning-foreground" },
                { label: "In ER",         value: erCount,         cls: erCount > 0 ? "text-destructive animate-pulse" : "text-muted-foreground" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card px-3 py-2 text-center shadow-clinical">
                  <div className={`text-xl font-black ${s.cls}`}>{s.value}</div>
                  <div className="text-muted-foreground text-[10px]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 flex-1 min-w-[220px]">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, DID, specialty, room…"
              className="bg-transparent text-xs text-foreground outline-none w-full placeholder:text-muted-foreground" />
          </div>
          <select value={specialtyFilter} onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold outline-none">
            {specialties.map((s) => <option key={s} value={s}>Specialty: {s}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold outline-none">
            {["All", "In Room", "Busy", "Available", "Checked Out"].map((s) => (
              <option key={s} value={s}>Status: {s}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* ── Doctors table ───────────────────────────────────────────── */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-clinical">
              {loading ? (
                <div className="flex justify-center py-16 text-xs text-muted-foreground gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading verified doctors…
                </div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground uppercase font-bold tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Doctor</th>
                      <th className="px-4 py-3">Specialty</th>
                      <th className="px-4 py-3">Admin DID</th>
                      <th className="px-4 py-3">Current Room(s)</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last Update</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((doc) => {
                      const sm   = STATUS_META[doc.computedStatus] ?? STATUS_META["Available"];
                      const rooms = doc.activeRooms?.length > 0
                        ? doc.activeRooms.map((r: any) => r.name ?? r).join(", ")
                        : doc.currentLocation ?? "—";
                      return (
                        <tr key={doc.did}
                          onClick={() => setSelectedDoctor(doc)}
                          className={`cursor-pointer transition-colors ${selectedDoctor?.did === doc.did ? "bg-primary/8 ring-1 ring-primary/30" : "hover:bg-muted/40"}`}>
                          <td className="px-4 py-3">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />{doc.name}
                            </div>
                            <div className="text-[9px] text-muted-foreground">{doc.department}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{doc.specialty}</td>
                          <td className="px-4 py-3 font-mono text-primary text-[10px] font-bold max-w-[130px] truncate">{doc.did}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-foreground font-semibold">
                              <MapPin className="h-3.5 w-3.5 text-destructive shrink-0" />
                              <span className="truncate max-w-[160px]">{rooms}</span>
                            </div>
                            {doc.activeRooms?.length > 1 && (
                              <div className="text-[9px] text-warning-foreground font-semibold mt-0.5">
                                {doc.activeRooms.length} rooms simultaneously
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${sm.cls}`}>
                              <div className={`h-1.5 w-1.5 rounded-full ${sm.dot} ${doc.computedStatus === "In Room" ? "animate-pulse" : ""}`} />
                              {sm.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-mono text-[9px]">
                            {doc.lastLocationChange ? new Date(doc.lastLocationChange).toLocaleTimeString("en-IN") : "—"}
                          </td>
                          <td className="px-4 py-3 text-right space-x-1">
                            <button onClick={(e) => { e.stopPropagation(); openHistory(doc); }}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[9px] font-bold text-foreground hover:bg-muted">
                              <History className="h-3 w-3 text-primary" /> Logs
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handlePage(doc); }}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-2 py-1 text-[9px] font-bold hover:bg-primary/90">
                              <Send className="h-2.5 w-2.5" /> Page
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && !loading && (
                      <tr><td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                        No verified doctors match filters. Ensure Admin has issued a DID.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Right panel ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Doctor detail card */}
            <AnimatePresence>
              {selectedDoctor && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-xl border border-border bg-card p-4 shadow-clinical space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div className="font-bold text-sm text-foreground">{selectedDoctor.name}</div>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold border ${(STATUS_META[selectedDoctor.computedStatus] ?? STATUS_META["Available"]).cls}`}>
                      {selectedDoctor.computedStatus}
                    </span>
                  </div>
                  <div className="font-mono text-[9px] text-primary break-all bg-muted/50 p-2 rounded border border-border">
                    <ShieldCheck className="inline h-3 w-3 mr-1" />{selectedDoctor.did}
                  </div>
                  <div className="space-y-1.5">
                    {[
                      ["Specialty", selectedDoctor.specialty],
                      ["Department", selectedDoctor.department],
                      ["Active Rooms", selectedDoctor.activeRooms?.length > 0
                        ? selectedDoctor.activeRooms.map((r: any) => r.name ?? r).join(", ")
                        : "None"],
                      ["Room Count", String(selectedDoctor.activeRooms?.length ?? 0)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-border/40 pb-1">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-semibold text-foreground text-right max-w-[120px] truncate">{v}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => openHistory(selectedDoctor)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-bold hover:bg-muted">
                    <History className="h-3.5 w-3.5 text-primary" /> View Check-In History
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live events feed */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-clinical space-y-2">
              <div className="text-xs font-bold text-foreground flex items-center justify-between">
                <div className="flex items-center gap-1.5"><Activity className="h-4 w-4 text-primary" /> Live Check-In Feed</div>
                <span className="text-[10px] text-success font-bold animate-pulse">● LIVE</span>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {liveLog.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground italic text-center py-4">
                    Listening for real-time room check-in events…
                  </div>
                ) : liveLog.map((l) => (
                  <div key={l.id} className="flex gap-2 text-[10px] bg-muted/40 p-2 rounded-lg border border-border/50">
                    <span className="text-muted-foreground font-mono shrink-0">{l.time}</span>
                    <span className="text-foreground font-medium">{l.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── History Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {historyDoctor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4"
            onClick={() => setHistoryDoctor(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-clinical-md max-w-xl w-full max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div>
                  <div className="text-base font-bold text-foreground flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" /> Room Check-In Logs
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{historyDoctor.name} · {historyDoctor.did}</div>
                </div>
                <button onClick={() => setHistoryDoctor(null)} className="rounded-lg p-1 hover:bg-muted text-muted-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 space-y-2">
                {loadingLogs ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>
                ) : doctorLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    No check-in history found for this doctor.
                  </div>
                ) : doctorLogs.map((log, i) => (
                  <div key={log.logId ?? i} className="rounded-xl border border-border bg-muted/40 p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary" />{log.roomNumber ?? log.roomName}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${log.action === "enter" || log.action === "checkin" ? "bg-success/15 text-success" : "bg-amber-500/15 text-amber-600"}`}>
                        {log.action === "enter" || log.action === "checkin" ? "Checked In" : "Checked Out"}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{log.logId}</span>
                      <span>{new Date(log.timestamp).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="text-[9px] font-mono text-primary bg-card p-1.5 rounded border border-border/60 break-all">
                      {log.hash}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end border-t border-border pt-3 mt-3">
                <button onClick={() => setHistoryDoctor(null)} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}
