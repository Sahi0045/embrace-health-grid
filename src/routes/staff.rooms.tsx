import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import {
  getDummyRooms,
  getMyRoomStatus,
  getRoomCheckInHistory,
  roomCheckIn,
  getDailyRoomEvents,
  getMerkleRootHistory,
  publishMerkleRoot,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import {
  Building2, MapPin, LogIn, LogOut, Clock, ShieldCheck,
  History, CheckCircle2, XCircle, RefreshCw, Wifi, Activity,
  Stethoscope, AlertCircle, Zap, Copy, ExternalLink, Link2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/rooms")({
  head: () => ({ meta: [{ title: "Staff · Room Check-In — Embrace Health Grid" }] }),
  component: RoomCheckInPage,
});

// ─── Status config ─────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; icon: React.ComponentType<any>; bg: string; text: string; dot: string }> = {
  available:        { label: "Available",      icon: CheckCircle2, bg: "bg-success/10",     text: "text-success",      dot: "bg-success" },
  "in-room":        { label: "In Room",         icon: Building2,    bg: "bg-primary/10",     text: "text-primary",      dot: "bg-primary" },
  "in-surgery":     { label: "In Surgery",      icon: AlertCircle,  bg: "bg-yellow-500/10",  text: "text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
  emergency:        { label: "Emergency",       icon: AlertCircle,  bg: "bg-destructive/10", text: "text-destructive",  dot: "bg-destructive" },
  "in-telemedicine":{ label: "Telemedicine",    icon: Stethoscope,  bg: "bg-chart-4/10",     text: "text-chart-4",      dot: "bg-chart-4" },
  "checked-out":    { label: "Checked Out",     icon: XCircle,      bg: "bg-muted",          text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

function StatusCard({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.available;
  const Icon = cfg.icon;
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot} ${status === "emergency" ? "animate-ping" : ""}`} />
      <Icon className="h-4 w-4" />
      {cfg.label}
    </div>
  );
}

// ─── Room type → icon label ─────────────────────────────────────────────────
function roomTypeIcon(type: string) {
  const map: Record<string, string> = {
    Consultation: "🩺", OT: "⚕️", Emergency: "🚨", Critical: "💊",
    Telemedicine: "💻", Imaging: "🔬", Ward: "🛏️",
  };
  return map[type] ?? "🏥";
}

function RoomCheckInPage() {
  const currentUser = getCurrentUser();
  const myDid   = currentUser?.did  || "";
  const myName  = currentUser?.name || "Doctor";

  // Data
  const [rooms, setRooms] = useState<any[]>([]);
  const [myStatus, setMyStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [dailyEvents, setDailyEvents] = useState<any[]>([]);
  const [publishedRoots, setPublishedRoots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastSync, setLastSync] = useState("");
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  // Selected room for check-in
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = useCallback(async () => {
    if (!myDid) { setLoading(false); return; }
    try {
      const [roomsRes, statusRes, histRes, eventsRes, rootsRes] = await Promise.all([
        getDummyRooms(),
        getMyRoomStatus(myDid),
        getRoomCheckInHistory(myDid),
        getDailyRoomEvents(myDid),
        getMerkleRootHistory(myDid),
      ]);
      setRooms(roomsRes.rooms || []);
      setMyStatus(statusRes);
      setHistory(histRes.history || []);
      setDailyEvents(eventsRes.events || []);
      setPublishedRoots(rootsRes.publishedRoots || []);
      setLastSync(new Date().toLocaleTimeString());
    } catch {
      // silently fail — will retry on poll
    } finally {
      setLoading(false);
    }
  }, [myDid]);

  useEffect(() => {
    loadAll();
    pollRef.current = setInterval(loadAll, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadAll]);

  // Real-time WS
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const raw = (e as CustomEvent).detail;
        const msg = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (
          (msg.event === "room:checkin" || msg.event === "staff:location") &&
          (msg.data?.doctorDid === myDid || msg.data?.id === myDid)
        ) {
          loadAll();
        }
      } catch {}
    };
    window.addEventListener("ws:message", handler as EventListener);
    return () => window.removeEventListener("ws:message", handler as EventListener);
  }, [myDid, loadAll]);

  const currentStatus = myStatus?.status || "available";
  const isCheckedIn   = currentStatus !== "available" && currentStatus !== "checked-out";
  const currentRoom   = myStatus?.currentRoom || null;
  const checkedInAt   = myStatus?.checkedInAt  ? new Date(myStatus.checkedInAt).toLocaleTimeString()  : null;
  const checkedOutAt  = myStatus?.checkedOutAt ? new Date(myStatus.checkedOutAt).toLocaleTimeString() : null;

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) || null;

  const handleCheckIn = async () => {
    if (!selectedRoom || acting) return;
    setActing(true);
    try {
      await roomCheckIn({
        doctorDid: myDid,
        doctorName: myName,
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        action: "checkin",
      });
      toast.success(`Checked in to ${selectedRoom.name}`, {
        description: "Your room status has been updated and is visible on the Doctor Locator.",
      });
      setSelectedRoomId(null);
      await loadAll();
    } catch (err: any) {
      toast.error("Check-in failed", { description: err.message });
    } finally {
      setActing(false);
    }
  };

  const handleCheckOut = async () => {
    if (acting) return;
    setActing(true);
    try {
      await roomCheckIn({
        doctorDid: myDid,
        doctorName: myName,
        roomId: "",
        roomName: "",
        action: "checkout",
      });
      toast.success("Checked out successfully", {
        description: "Your status is now Available on the Doctor Locator.",
      });
      await loadAll();
    } catch (err: any) {
      toast.error("Check-out failed", { description: err.message });
    } finally {
      setActing(false);
    }
  };

  const handlePublishMerkleRoot = async () => {
    if (publishing || dailyEvents.length === 0) return;
    setPublishing(true);
    try {
      const result = await publishMerkleRoot(myDid);
      toast.success("Merkle Root Published", {
        description: `Successfully published ${result.eventCount} room events to blockchain with transaction hash ${result.transactionHash.slice(0, 12)}...`,
      });
      setShowPublishConfirm(false);
      await loadAll();
    } catch (err: any) {
      toast.error("Publication failed", { description: err.message });
    } finally {
      setPublishing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Group rooms by wing for the grid
  const wings = Array.from(new Set(rooms.map((r) => r.wing)));

  return (
    <RouteGuard requiredRole="staff">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between border-b border-border pb-4">
          <PageHeader
            eyebrow="Staff Portal"
            title="Room Check-In / Check-Out"
            description="Simulate hardware room check-in. Your status updates instantly on the Doctor Locator page."
          />
          <button onClick={loadAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition-colors self-start">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh · {lastSync}
          </button>
        </div>

        {/* ── My Current Status Card ── */}
        <div className={`rounded-2xl border-2 p-6 shadow-clinical space-y-4 transition-all ${
          isCheckedIn ? "border-primary/40 bg-primary/5" : "border-border bg-card"
        }`}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" />
                <span className="text-xs font-bold text-success">DID-Verified Doctor</span>
              </div>
              <h2 className="text-xl font-black text-foreground">{myName}</h2>
              <p className="font-mono text-xs text-muted-foreground">{myDid || "DID not assigned"}</p>
            </div>
            {loading
              ? <div className="h-8 w-32 rounded-full bg-muted animate-pulse" />
              : <StatusCard status={currentStatus} />}
          </div>

          {isCheckedIn && currentRoom && (
            <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="text-sm font-bold text-foreground">{currentRoom}</div>
                {checkedInAt && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Clock className="h-3 w-3" /> Checked in at {checkedInAt}
                  </div>
                )}
              </div>
            </div>
          )}

          {!isCheckedIn && checkedOutAt && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Last checked out at {checkedOutAt}
            </div>
          )}

          {/* Action buttons */}
          {!loading && (
            <div className="flex gap-3 pt-2 border-t border-border flex-wrap">
              {isCheckedIn ? (
                <button onClick={handleCheckOut} disabled={acting}
                  className="inline-flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-5 py-2.5 text-sm font-bold text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-all">
                  <LogOut className="h-4 w-4" />
                  {acting ? "Checking Out…" : "Check Out"}
                </button>
              ) : null}
              {!isCheckedIn && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5 py-2">
                  <MapPin className="h-3.5 w-3.5" /> Select a room below and click Check In
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Room Selection Grid ── */}
        {!isCheckedIn && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> Select a Room to Check In
              </h3>
              <span className="text-xs text-muted-foreground">{rooms.length} rooms available</span>
            </div>

            {wings.map((wing) => (
              <div key={wing} className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{wing} Wing</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {rooms.filter((r) => r.wing === wing).map((room) => {
                    const isSelected = selectedRoomId === room.id;
                    return (
                      <button key={room.id} onClick={() => setSelectedRoomId(isSelected ? null : room.id)}
                        className={`rounded-xl border p-4 text-left transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                            : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                        }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">{roomTypeIcon(room.type)}</span>
                              <span className="text-xs font-bold text-foreground">{room.name}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{room.type} · Cap: {room.capacity}</div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Check-In confirm button */}
            <AnimatePresence>
              {selectedRoom && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className="sticky bottom-4 z-10">
                  <div className="rounded-2xl border border-primary/30 bg-card shadow-clinical-md p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{roomTypeIcon(selectedRoom.type)}</span>
                        <span className="text-sm font-bold text-foreground">{selectedRoom.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{selectedRoom.wing} Wing · {selectedRoom.type}</div>
                    </div>
                    <button onClick={handleCheckIn} disabled={acting}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-clinical">
                      <LogIn className="h-4 w-4" />
                      {acting ? "Checking In…" : `Check In to ${selectedRoom.name}`}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Event History ── */}
        <div className="rounded-xl border border-border bg-card shadow-clinical overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <History className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">My Check-In History</h3>
            <span className="ml-auto text-xs text-muted-foreground">{history.length} events</span>
          </div>

          {history.length === 0 ? (
            <div className="py-12 text-center">
              <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No events recorded yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Check in to a room above to start.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {history.map((ev, i) => {
                const isIn = ev.action === "checkin";
                return (
                  <div key={ev.logId || i} className="flex items-center gap-4 px-5 py-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isIn ? "bg-primary/10" : "bg-muted"}`}>
                      {isIn
                        ? <LogIn className="h-3.5 w-3.5 text-primary" />
                        : <LogOut className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold ${isIn ? "text-primary" : "text-muted-foreground"}`}>
                          {isIn ? "Checked In" : "Checked Out"}
                        </span>
                        {ev.roomName && (
                          <span className="text-xs text-foreground font-medium">→ {ev.roomName}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <Clock className="h-3 w-3 shrink-0" />
                        {new Date(ev.timestamp).toLocaleString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                        <span className="text-muted-foreground/60">·</span>
                        <span className="font-mono text-[9px]">{ev.txId?.slice(0, 12)}…</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {ev.status && (
                        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                          STATUS_CFG[ev.status]?.bg || "bg-muted"
                        } ${STATUS_CFG[ev.status]?.text || "text-muted-foreground"}`}>
                          {STATUS_CFG[ev.status]?.label || ev.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Merkle Root & Blockchain Publishing ── */}
        {dailyEvents.length > 0 && (
          <div className="rounded-xl border border-chart-2/30 bg-chart-2/5 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-chart-2/10">
                  <Zap className="h-4 w-4 text-chart-2" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Daily Room Events (Merkle Tree)</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {dailyEvents.length} event{dailyEvents.length !== 1 ? "s" : ""} — Ready to publish to blockchain
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPublishConfirm(true)}
                disabled={publishing || dailyEvents.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-chart-2 px-4 py-2 text-xs font-bold text-white hover:bg-chart-2/90 disabled:opacity-50 transition-all"
              >
                <Link2 className="h-3.5 w-3.5" />
                {publishing ? "Publishing…" : "Publish to Blockchain"}
              </button>
            </div>

            {/* Daily Events List */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Events</div>
              <div className="space-y-1">
                {dailyEvents.map((event, idx) => (
                  <div key={event.logId || idx} className="flex items-center gap-3 rounded-lg bg-white/50 dark:bg-black/20 px-3 py-2">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      event.action === "checkin" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {event.action === "checkin" ? "✓" : "✕"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground">
                        {event.action === "checkin" ? "Checked In" : "Checked Out"} {event.roomName && `→ ${event.roomName}`}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </div>
                    </div>
                    <div className="shrink-0 text-[10px] font-mono text-muted-foreground">
                      {event.txId?.slice(0, 8)}…
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Publish confirmation modal */}
            <AnimatePresence>
              {showPublishConfirm && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                  onClick={() => !publishing && setShowPublishConfirm(false)}
                >
                  <div
                    className="rounded-2xl border border-border bg-card p-6 shadow-2xl max-w-sm w-full space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-2/10">
                        <Zap className="h-5 w-5 text-chart-2" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground">Publish to Blockchain?</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Create a Merkle Tree from {dailyEvents.length} room event{dailyEvents.length !== 1 ? "s" : ""} and publish the root hash to Solana devnet.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground">Summary</div>
                      <div className="text-xs space-y-1 font-mono text-foreground">
                        <div>Events: {dailyEvents.length}</div>
                        <div>Doctor: {myDid?.slice(-6) || "unknown"}</div>
                        <div>Date: {new Date().toLocaleDateString("en-IN")}</div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowPublishConfirm(false)}
                        disabled={publishing}
                        className="flex-1 rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePublishMerkleRoot}
                        disabled={publishing}
                        className="flex-1 rounded-lg bg-chart-2 text-white px-4 py-2 text-sm font-bold hover:bg-chart-2/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        {publishing ? "Publishing…" : "Publish"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Published Merkle Roots History ── */}
        {publishedRoots.length > 0 && (
          <div className="rounded-xl border border-success/30 bg-success/5 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <h3 className="text-sm font-bold text-foreground">Published Merkle Roots</h3>
              <span className="ml-auto text-xs text-muted-foreground">{publishedRoots.length} published</span>
            </div>

            <div className="space-y-2">
              {publishedRoots.map((root, idx) => (
                <div key={root.publishId || idx} className="rounded-lg border border-success/20 bg-white/50 dark:bg-black/20 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-foreground">{root.date}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{root.eventCount} events aggregated</div>
                    </div>
                    <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-success/10 text-success">
                      {root.status}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 group">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-muted-foreground font-mono break-all">{root.merkleRoot}</div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(root.merkleRoot)}
                        className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                        title="Copy Merkle Root"
                      >
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>

                    <div className="text-[10px] text-muted-foreground">
                      Tx: <span className="font-mono">{root.transactionHash?.slice(0, 12)}…</span>
                    </div>

                    <div className="text-[10px] text-muted-foreground">
                      Published: {new Date(root.publishedAt).toLocaleString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Info banner ── */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <Wifi className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Simulated Hardware Mode</p>
            <p>
              Since physical NFC/RFID hardware is not connected, this page simulates room
              check-in events. Each event is persisted in the backend, linked to your DID
              (<span className="font-mono text-primary">{myDid || "pending"}</span>),
              and reflected immediately on the Doctor Locator page for all staff.
            </p>
          </div>
        </div>

      </div>
    </RouteGuard>
  );
}
