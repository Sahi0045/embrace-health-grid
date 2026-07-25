import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import {
  getDIDVerifiedDoctors,
  getRoomStatusAll,
  roomCheckIn,
  getDummyRooms,
  dispatchPagerNotify,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import {
  MapPin, Search, Activity, Users, ShieldCheck,
  Building2, User, Send, LogIn, LogOut, Clock,
  Wifi, RefreshCw, ChevronRight, Stethoscope,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/tracker")({
  head: () => ({ meta: [{ title: "Doctor Locator — Staff Portal" }] }),
  component: DoctorLocatorPage,
});

// ─── Status helpers ────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; dot: string; badge: string }> = {
  available:       { label: "Available",       dot: "bg-success",     badge: "bg-success/10 text-success border-success/20" },
  "in-room":       { label: "In Room",          dot: "bg-primary",     badge: "bg-primary/10 text-primary border-primary/20" },
  "in-surgery":    { label: "In Surgery",       dot: "bg-yellow-500",  badge: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-400/30" },
  emergency:       { label: "Emergency",        dot: "bg-destructive", badge: "bg-destructive/10 text-destructive border-destructive/30 animate-pulse" },
  "in-telemedicine":{ label: "Telemedicine",   dot: "bg-chart-4",     badge: "bg-chart-4/10 text-chart-4 border-chart-4/20" },
  "checked-out":   { label: "Checked Out",      dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground border-border" },
};

function statusCfg(s: string) {
  return STATUS_CFG[s] ?? STATUS_CFG["available"];
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusCfg(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function DoctorLocatorPage() {
  const currentUser = getCurrentUser();
  const myDid = currentUser?.did || "";

  // Data state
  const [doctors, setDoctors] = useState<any[]>([]);
  const [roomStatuses, setRoomStatuses] = useState<Record<string, any>>({}); // keyed by doctorDid
  const [rooms, setRooms] = useState<any[]>([]);
  const [logs, setLogs] = useState<{ id: string; time: string; event: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString());

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedDid, setSelectedDid] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null); // doctorDid being acted on
  const [selectedRoom, setSelectedRoom] = useState<Record<string, string>>({}); // doctorDid -> roomId

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    try {
      const [docsRes, statusRes, roomsRes] = await Promise.all([
        getDIDVerifiedDoctors(),
        getRoomStatusAll(),
        getDummyRooms(),
      ]);

      setDoctors(docsRes.doctors || []);
      setRooms(roomsRes.rooms || []);

      // Build status map keyed by doctorDid
      const map: Record<string, any> = {};
      for (const s of statusRes.statuses || []) {
        if (s.doctorDid) map[s.doctorDid] = s;
      }
      setRoomStatuses(map);
      setLastSync(new Date().toLocaleTimeString());
    } catch {
      // silently retry on next poll
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    pollRef.current = setInterval(loadData, 6000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadData]);

  // Real-time WS subscription
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const raw = (e as CustomEvent).detail;
        const msg = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (msg.event === "room:checkin" || msg.event === "staff:location") {
          loadData();
          const d = msg.data;
          setLogs((prev) => [
            {
              id: `log_${Date.now()}`,
              time: new Date().toLocaleTimeString(),
              event: msg.event === "room:checkin"
                ? `${d.action === "checkin" ? "CHECK-IN" : "CHECK-OUT"} → ${d.doctorName} — ${d.room || "—"}`
                : `LOC UPDATE → ${d.name || d.id} — ${d.location || "—"}`,
            },
            ...prev.slice(0, 19),
          ]);
        }
      } catch {}
    };
    window.addEventListener("ws:message", handler as EventListener);
    return () => window.removeEventListener("ws:message", handler as EventListener);
  }, [loadData]);

  // Merge doctor list with their persisted room status
  const enrichedDoctors = doctors.map((doc) => {
    const rs = roomStatuses[doc.did];
    const status = rs?.status || "available";
    const currentRoom = rs?.currentRoom || null;
    const lastAction = rs?.lastAction || null;
    return { ...doc, roomStatus: status, currentRoom, lastAction, roomStatusRecord: rs };
  });

  const statuses = ["All", "available", "in-room", "in-surgery", "emergency", "in-telemedicine", "checked-out"];

  const filtered = enrichedDoctors.filter((d) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q
      || d.name?.toLowerCase().includes(q)
      || d.specialty?.toLowerCase().includes(q)
      || d.did?.toLowerCase().includes(q)
      || d.currentRoom?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || d.roomStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const selected = enrichedDoctors.find((d) => d.did === selectedDid) ?? null;

  // Counts
  const inRoomCount = enrichedDoctors.filter((d) => d.roomStatus === "in-room" || d.roomStatus === "in-surgery" || d.roomStatus === "emergency").length;
  const availableCount = enrichedDoctors.filter((d) => d.roomStatus === "available").length;
  const emergencyCount = enrichedDoctors.filter((d) => d.roomStatus === "emergency").length;

  // Room occupancy map
  const roomOccupancy: Record<string, any[]> = {};
  for (const d of enrichedDoctors) {
    if (d.roomStatus !== "available" && d.roomStatus !== "checked-out" && d.currentRoom) {
      if (!roomOccupancy[d.currentRoom]) roomOccupancy[d.currentRoom] = [];
      roomOccupancy[d.currentRoom].push(d);
    }
  }

  const handleCheckIn = async (doc: any, rm: any) => {
    setCheckingIn(doc.did);
    try {
      await roomCheckIn({
        doctorDid: doc.did,
        doctorName: doc.name,
        roomId: rm.id,
        roomName: rm.name,
        action: "checkin",
      });
      toast.success(`${doc.name} checked in`, { description: rm.name });
      setLogs((prev) => [
        { id: `l${Date.now()}`, time: new Date().toLocaleTimeString(), event: `CHECK-IN → ${doc.name} → ${rm.name}` },
        ...prev.slice(0, 19),
      ]);
      await loadData();
    } catch (err: any) {
      toast.error("Check-in failed", { description: err.message });
    } finally {
      setCheckingIn(null);
    }
  };

  const handleCheckOut = async (doc: any) => {
    setCheckingIn(doc.did);
    try {
      await roomCheckIn({
        doctorDid: doc.did,
        doctorName: doc.name,
        roomId: "",
        roomName: "",
        action: "checkout",
      });
      toast.success(`${doc.name} checked out`);
      setLogs((prev) => [
        { id: `l${Date.now()}`, time: new Date().toLocaleTimeString(), event: `CHECK-OUT → ${doc.name}` },
        ...prev.slice(0, 19),
      ]);
      await loadData();
    } catch (err: any) {
      toast.error("Check-out failed", { description: err.message });
    } finally {
      setCheckingIn(null);
    }
  };

  const handlePage = async (doc: any) => {
    try {
      await dispatchPagerNotify(doc.did, doc.name, doc.currentRoom || "Hospital");
      toast.success(`Pager sent to ${doc.name}`);
    } catch {
      toast.info(`Pager dispatched to ${doc.name}`);
    }
  };

  return (
    <RouteGuard requiredRole="staff">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <PageHeader
            eyebrow="Staff Portal — Doctor Locator"
            title="Real-Time Room Occupancy"
            description={`${enrichedDoctors.length} DID-verified doctors · Last sync ${lastSync}`}
          />
          <div className="flex gap-3 flex-wrap">
            {[
              { label: "In Room", value: inRoomCount, color: "text-primary" },
              { label: "Available", value: availableCount, color: "text-success" },
              { label: "Emergency", value: emergencyCount, color: emergencyCount > 0 ? "text-destructive animate-pulse" : "text-muted-foreground" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-card px-4 py-2.5 shadow-clinical text-center min-w-[70px]">
                <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
                <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              </div>
            ))}
            <button onClick={loadData}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-medium hover:bg-muted flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <Link to="/staff/checkin"
              className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5">
              <LogIn className="h-3.5 w-3.5" /> My Room Check-In
            </Link>
          </div>
        </div>

        {/* Room Occupancy Board */}
        <div className="rounded-xl border border-primary/20 bg-card p-5 shadow-clinical space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Live Room Occupancy Board</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-ping" /> Live
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {rooms.slice(0, 10).map((room) => {
              const occupants = roomOccupancy[room.name] || [];
              const primary = occupants[0];
              return (
                <div key={room.id}
                  className={`rounded-xl border p-3 space-y-2 transition-all ${occupants.length > 0 ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{room.type}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${occupants.length > 0 ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {occupants.length > 0 ? `${occupants.length} In` : "Vacant"}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-foreground leading-tight">{room.name}</div>
                  {primary ? (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                      <User className="h-3 w-3 text-primary shrink-0" />
                      <span className="text-[10px] font-semibold text-foreground truncate">{primary.name}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground italic">No doctor</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-clinical flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, specialty, room, DID…"
              className="bg-transparent text-xs text-foreground outline-none w-full placeholder:text-muted-foreground" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-foreground outline-none shadow-clinical">
            {statuses.map((s) => (
              <option key={s} value={s}>{s === "All" ? "All Statuses" : statusCfg(s).label}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Doctor table */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 rounded-xl border border-border bg-card animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center rounded-xl border border-border bg-card">
                <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No DID-verified doctors found.</p>
                <p className="text-xs text-muted-foreground mt-1">Only doctors with an active Admin-issued DID appear here.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-clinical">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Doctor</th>
                      <th className="px-4 py-3">Specialty</th>
                      <th className="px-4 py-3">DID</th>
                      <th className="px-4 py-3">Current Room</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((doc) => {
                      const isBusy = checkingIn === doc.did;
                      const isInRoom = doc.roomStatus !== "available" && doc.roomStatus !== "checked-out";
                      const isMe = doc.did === myDid;
                      return (
                        <tr key={doc.did}
                          onClick={() => setSelectedDid(selectedDid === doc.did ? null : doc.did)}
                          className={`cursor-pointer transition-colors ${selectedDid === doc.did ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              {doc.name}
                              {isMe && <span className="text-[9px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5 font-bold">You</span>}
                            </div>
                            <div className="text-[9px] text-muted-foreground">{doc.hospital || "Embrace Health Grid"}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{doc.specialty}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 font-mono text-[9px] text-primary">
                              <ShieldCheck className="h-3 w-3 text-success shrink-0" />
                              <span className="truncate max-w-[110px]">{doc.did}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {doc.currentRoom
                              ? <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary shrink-0" />{doc.currentRoom}</span>
                              : <span className="text-muted-foreground italic text-[10px]">Not checked in</span>}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={doc.roomStatus} />
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {isInRoom ? (
                                <button disabled={isBusy} onClick={() => handleCheckOut(doc)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-muted border border-border px-2 py-1 text-[9px] font-bold hover:bg-muted/80 disabled:opacity-50 transition-colors">
                                  <LogOut className="h-2.5 w-2.5" />
                                  {isBusy ? "…" : "Check Out"}
                                </button>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <select value={selectedRoom[doc.did] || ""}
                                    onChange={(e) => setSelectedRoom((p) => ({ ...p, [doc.did]: e.target.value }))}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded border border-border bg-background px-1 py-1 text-[9px] outline-none text-foreground max-w-[120px]">
                                    <option value="" disabled>Select room…</option>
                                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                  </select>
                                  <button disabled={isBusy || !selectedRoom[doc.did]}
                                    onClick={() => {
                                      const rm = rooms.find((r) => r.id === selectedRoom[doc.did]);
                                      if (rm) handleCheckIn(doc, rm);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/30 px-2 py-1 text-[9px] font-bold text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors">
                                    <LogIn className="h-2.5 w-2.5" />
                                    {isBusy ? "…" : "Check In"}
                                  </button>
                                </div>
                              )}
                              <button onClick={() => handlePage(doc)}
                                className="inline-flex items-center gap-1 rounded-lg bg-secondary/80 px-2 py-1 text-[9px] font-bold hover:bg-secondary transition-colors">
                                <Send className="h-2.5 w-2.5" /> Page
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Selected doctor detail */}
            <AnimatePresence>
              {selected && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-3 text-xs">
                  <div className="font-bold text-sm text-foreground">{selected.name}</div>
                  <div className="font-mono text-[9px] text-primary break-all">{selected.did}</div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-success" />
                    <span className="text-[10px] text-success font-semibold">Admin-Issued DID · Verified</span>
                  </div>
                  <StatusBadge status={selected.roomStatus} />
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    {[
                      ["Specialty", selected.specialty],
                      ["Department", selected.department],
                      ["Current Room", selected.currentRoom || "—"],
                      ["Hospital", selected.hospital || "Embrace Health Grid"],
                      ["Last Action", selected.lastAction || "—"],
                      ["Updated", selected.roomStatusRecord?.updatedAt
                        ? new Date(selected.roomStatusRecord.updatedAt).toLocaleTimeString()
                        : "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">{k}:</span>
                        <span className="font-semibold text-foreground text-right truncate">{v}</span>
                      </div>
                    ))}
                  </div>
                  {/* Quick check-in from detail panel */}
                  {selected.roomStatus === "available" || selected.roomStatus === "checked-out" ? (
                    <div className="pt-2 border-t border-border space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quick Check-In</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rooms.slice(0, 6).map((rm) => (
                          <button key={rm.id} onClick={() => handleCheckIn(selected, rm)}
                            disabled={checkingIn === selected.did}
                            className="rounded-md bg-muted px-2 py-1 text-[10px] font-semibold hover:bg-primary/10 hover:text-primary disabled:opacity-50 transition-colors">
                            {rm.name.split(" ").slice(0, 3).join(" ")}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => handleCheckOut(selected)} disabled={checkingIn === selected.did}
                      className="w-full mt-2 rounded-lg border border-border py-2 text-xs font-bold hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-1.5">
                      <LogOut className="h-3.5 w-3.5" /> Check Out
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live beacon log */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-clinical space-y-2">
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary" /> Live Event Log
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {logs.length === 0
                  ? <div className="text-[10px] text-muted-foreground">Waiting for events…</div>
                  : logs.map((log) => (
                    <div key={log.id} className="flex gap-2 text-[9px]">
                      <span className="text-muted-foreground font-mono shrink-0">{log.time}</span>
                      <span className="text-foreground">{log.event}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Link to own check-in */}
            <Link to="/staff/checkin"
              className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 hover:bg-primary/10 transition-colors group">
              <div>
                <div className="text-xs font-bold text-foreground">Your Room Check-In</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Manage your own room status</div>
              </div>
              <ChevronRight className="h-4 w-4 text-primary group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
