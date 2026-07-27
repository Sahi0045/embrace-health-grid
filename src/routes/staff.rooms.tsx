import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import {
  getRooms,
  roomCheckInMulti,
  getRoomCheckinStatus,
  getRoomCheckinHistory,
  getVerifiedDoctors,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import {
  Building2, MapPin, CheckCircle2, Clock, Loader2,
  ShieldCheck, RefreshCw, LogIn, LogOut, History,
  ChevronDown, ChevronUp, Users, Hash, Zap, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/rooms")({
  head: () => ({ meta: [{ title: "Room Check-In — Staff Portal" }] }),
  component: StaffRooms,
});

// ─── type helpers ─────────────────────────────────────────────────────────────
interface Room { id: string; name: string; type: string; floor: string; capacity: number; }
interface CheckedInRoom { roomId: string; roomName: string; roomType: string; updatedAt: string; hash: string; }
interface HistoryLog { logId: string; action: "checkin" | "checkout"; roomId: string; roomName: string; timestamp: string; hash: string; txId: string; }

const TYPE_COLORS: Record<string, string> = {
  OPD:  "bg-primary/10 text-primary border-primary/20",
  Ward: "bg-blue-500/10 text-blue-600 border-blue-200",
  OT:   "bg-purple-500/10 text-purple-600 border-purple-200",
  ER:   "bg-destructive/10 text-destructive border-destructive/20",
  ICU:  "bg-warning/10 text-warning-foreground border-warning/20",
  Diag: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
  Lab:  "bg-emerald-500/10 text-emerald-600 border-emerald-200",
};

function StaffRooms() {
  const currentUser = getCurrentUser();

  // ── doctor identity ─────────────────────────────────────────────────────
  const [doctorDid,  setDoctorDid]  = useState<string>("");
  const [doctorName, setDoctorName] = useState<string>("Dr. Staff");
  const [didVerified, setDidVerified] = useState<boolean>(false);

  // ── room data ───────────────────────────────────────────────────────────
  const [rooms,        setRooms]        = useState<Room[]>([]);
  const [checkedIn,    setCheckedIn]    = useState<CheckedInRoom[]>([]);
  const [history,      setHistory]      = useState<HistoryLog[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingHist,  setLoadingHist]  = useState(false);

  // ── multi-select state ──────────────────────────────────────────────────
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());

  // ── action state ────────────────────────────────────────────────────────
  const [acting, setActing] = useState<"checkin" | "checkout" | null>(null);

  // ── history modal ───────────────────────────────────────────────────────
  const [showHistory, setShowHistory] = useState(false);

  // ── filter ──────────────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState("All");

  // ── resolve the logged-in doctor's DID & verify against admin registry ──
  useEffect(() => {
    const email = currentUser?.email ?? (typeof window !== "undefined" ? localStorage.getItem("userEmail") ?? "" : "");
    const name  = currentUser?.name  ?? (typeof window !== "undefined" ? localStorage.getItem("userName")  ?? "Dr. Staff" : "Dr. Staff");
    const did   = currentUser?.did   ?? (typeof window !== "undefined" ? localStorage.getItem("userDID")   ?? "" : "");

    setDoctorName(name);

    if (did) {
      setDoctorDid(did);
      // check if DID is in the verified registry
      getVerifiedDoctors()
        .then((res) => {
          const match = (res.doctors ?? []).find(
            (d: any) => d.did === did || d.email?.toLowerCase() === email.toLowerCase(),
          );
          setDidVerified(!!match);
          if (match && match.did) setDoctorDid(match.did);
        })
        .catch(() => setDidVerified(false));
    } else {
      // fallback: derive from email
      const derived = `did:hosp:0x${email.split("@")[0].substring(0, 8)}`;
      setDoctorDid(derived);
      setDidVerified(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── fetch rooms master list ─────────────────────────────────────────────
  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const res = await getRooms();
      setRooms(res.rooms ?? []);
    } catch {
      toast.error("Could not load room list");
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  // ── fetch current check-in status ───────────────────────────────────────
  const loadStatus = useCallback(async () => {
    if (!doctorDid) return;
    try {
      const res = await getRoomCheckinStatus(doctorDid);
      setCheckedIn(res.checkedInRooms ?? []);
    } catch { /* silent */ }
  }, [doctorDid]);

  // ── fetch history ────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!doctorDid) return;
    setLoadingHist(true);
    try {
      const res = await getRoomCheckinHistory(doctorDid);
      setHistory(res.logs ?? []);
    } catch { /* silent */ }
    finally { setLoadingHist(false); }
  }, [doctorDid]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (doctorDid) { loadStatus(); loadHistory(); }
  }, [doctorDid, loadStatus, loadHistory]);

  // ── WebSocket real-time refresh ─────────────────────────────────────────
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
            if (msg.event === "room:checkin" || msg.event === "staff:location") {
              loadStatus();
              loadHistory();
            }
          } catch { /* ignore parse errors */ }
        };
        ws.onclose = () => { retry = setTimeout(connect, 5000); };
      } catch { /* no WS available */ }
    };
    connect();
    const poll = setInterval(() => { loadStatus(); }, 10_000);
    return () => { ws?.close(); clearTimeout(retry); clearInterval(poll); };
  }, [loadStatus, loadHistory]);

  // ── multi-select helpers ─────────────────────────────────────────────────
  const toggleRoom = (id: string) =>
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const checkedInIds = new Set(checkedIn.map((c) => c.roomId));

  // ── actions ───────────────────────────────────────────────────────────────
  const doAction = async (action: "checkin" | "checkout") => {
    if (selectedRooms.size === 0) {
      toast.error("Select at least one room first");
      return;
    }
    setActing(action);
    try {
      const res = await roomCheckInMulti(Array.from(selectedRooms), action);
      toast.success(
        action === "checkin"
          ? `Checked in to ${res.results.length} room(s)`
          : `Checked out of ${res.results.length} room(s)`,
        { description: res.results.map((r: any) => r.roomName).join(", ") },
      );
      setSelectedRooms(new Set());
      await loadStatus();
      await loadHistory();
    } catch (err: any) {
      toast.error("Action failed", { description: err.message });
    } finally {
      setActing(null);
    }
  };

  // ── filter ────────────────────────────────────────────────────────────────
  const types = ["All", ...Array.from(new Set(rooms.map((r) => r.type)))];
  const visibleRooms = typeFilter === "All" ? rooms : rooms.filter((r) => r.type === typeFilter);

  // ── derived stats ─────────────────────────────────────────────────────────
  const activeRoomNames = checkedIn.map((c) => c.roomName);

  return (
    <RouteGuard requiredRole="staff">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between border-b border-border pb-4">
          <PageHeader
            eyebrow="Clinician Portal"
            title="Room Check-In & Tracking"
            description="Select one or multiple rooms to check in or check out. Events are stored in the backend and update the Doctor Locator in real time."
          />
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => { setShowHistory(true); loadHistory(); }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <History className="h-3.5 w-3.5 text-primary" /> History
            </button>
            <button
              onClick={() => { loadStatus(); loadHistory(); }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* ── Doctor identity card ────────────────────────────────────────── */}
        <div className={`rounded-xl border-2 p-4 flex items-center gap-4 ${didVerified ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}`}>
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${didVerified ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground"}`}>
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-foreground text-base">{doctorName}</div>
            <div className="font-mono text-xs text-muted-foreground truncate">{doctorDid || "DID not assigned"}</div>
            <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${didVerified ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground"}`}>
              {didVerified ? <><CheckCircle2 className="h-3 w-3" /> Admin-Issued DID Verified</> : <><Clock className="h-3 w-3" /> DID Pending Admin Issuance</>}
            </div>
          </div>
          {/* Active rooms summary */}
          <div className="text-right shrink-0">
            <div className="text-2xl font-black text-foreground">{checkedIn.length}</div>
            <div className="text-xs text-muted-foreground">Active Room{checkedIn.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        {/* ── Currently checked-in rooms ──────────────────────────────────── */}
        {checkedIn.length > 0 && (
          <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-2">
            <div className="text-xs font-bold text-success uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-4 w-4" /> Currently In
            </div>
            <div className="flex flex-wrap gap-2">
              {checkedIn.map((c) => (
                <span key={c.roomId} className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                  <MapPin className="h-3 w-3" /> {c.roomName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Selection action bar ────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
          <div className="text-sm font-semibold text-foreground shrink-0">
            {selectedRooms.size === 0 ? "Select rooms below" : `${selectedRooms.size} room${selectedRooms.size > 1 ? "s" : ""} selected`}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setSelectedRooms(new Set())}
            disabled={selectedRooms.size === 0}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            Clear
          </button>
          <button
            onClick={() => doAction("checkout")}
            disabled={acting !== null || selectedRooms.size === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-all"
          >
            {acting === "checkout" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
            Check Out
          </button>
          <button
            onClick={() => doAction("checkin")}
            disabled={acting !== null || selectedRooms.size === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {acting === "checkin" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
            Check In
          </button>
        </div>

        {/* ── Type filter chips ───────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5">
          {types.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-muted"}`}>
              {t}
            </button>
          ))}
          <button
            onClick={() => {
              const allIds = new Set(visibleRooms.map((r) => r.id));
              setSelectedRooms(allIds);
            }}
            className="ml-auto rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            Select All
          </button>
        </div>

        {/* ── Room grid ──────────────────────────────────────────────────── */}
        {loadingRooms ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map((n) => (
              <div key={n} className="h-28 animate-pulse rounded-xl border border-border bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleRooms.map((room) => {
              const isSelected    = selectedRooms.has(room.id);
              const isActive      = checkedInIds.has(room.id);
              const typeCls       = TYPE_COLORS[room.type] ?? "bg-muted text-muted-foreground border-border";

              return (
                <motion.button
                  key={room.id}
                  onClick={() => toggleRoom(room.id)}
                  whileTap={{ scale: 0.97 }}
                  className={`rounded-xl border-2 p-4 text-left transition-all space-y-2 ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md"
                      : isActive
                        ? "border-success/40 bg-success/5"
                        : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-foreground truncate">{room.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Floor: {room.floor} · Cap: {room.capacity}</div>
                    </div>
                    {/* checkbox indicator */}
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${isSelected ? "bg-primary border-primary" : "border-border bg-background"}`}>
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${typeCls}`}>{room.type}</span>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/30 px-2 py-0.5 text-[10px] font-bold text-success animate-pulse">
                        <Building2 className="h-3 w-3" /> Checked In
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* ── Quick recent events strip ───────────────────────────────────── */}
        {history.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" /> Recent Events
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {history.slice(0, 8).map((log) => (
                <div key={log.logId} className="flex items-center gap-3 text-[11px] bg-muted/40 rounded-lg px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 font-bold text-[9px] ${log.action === "checkin" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                    {log.action === "checkin" ? "IN" : "OUT"}
                  </span>
                  <span className="flex-1 font-medium text-foreground truncate">{log.roomName}</span>
                  <span className="text-muted-foreground font-mono shrink-0">{new Date(log.timestamp).toLocaleTimeString("en-IN")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── History Modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
            onClick={() => setShowHistory(false)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-clinical-md max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}>

              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" /> Room Check-In Audit Trail
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">{doctorName} · {doctorDid}</p>
                </div>
                <button onClick={() => setShowHistory(false)} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 space-y-2">
                {loadingHist ? (
                  <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : history.length === 0 ? (
                  <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    No check-in history yet. Use the room grid above to get started.
                  </div>
                ) : history.map((log) => (
                  <div key={log.logId} className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${log.action === "checkin" ? "bg-success/15 text-success" : "bg-amber-500/15 text-amber-600"}`}>
                          {log.action === "checkin" ? "✅ CHECK IN" : "🔴 CHECK OUT"}
                        </span>
                        <span className="font-semibold text-foreground text-xs">{log.roomName}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{new Date(log.timestamp).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                      <div><span className="font-semibold">Log ID:</span> {log.logId}</div>
                      <div><span className="font-semibold">Tx ID:</span> <span className="font-mono">{log.txId?.slice(0, 12)}…</span></div>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 font-mono text-[9px] text-primary overflow-x-auto">
                      <Hash className="h-3 w-3 shrink-0" />{log.hash}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <button onClick={() => setShowHistory(false)} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}
