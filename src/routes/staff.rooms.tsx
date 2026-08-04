import { createFileRoute } from "@tanstack/react-router";
import { useTableRefresh } from "@/hooks/use-realtime";
import { useState, useEffect, useCallback } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import {
  getRooms,
  roomCheckInMulti,
  getRoomCheckinStatus,
  getRoomCheckinHistory,
  getDailyRoomEvents,
  publishMerkleRoot,
  getMerkleRootHistory,
  getVerifiedDoctors,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/auth-context";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  Building2,
  MapPin,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  RefreshCw,
  LogIn,
  LogOut,
  History,
  X,
  Zap,
  Copy,
  ExternalLink,
  Hash,
  Link2,
  ChevronDown,
  ChevronUp,
  TreePine,
  AlertTriangle,
  CalendarDays,
  Wallet,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/rooms")({
  head: () => ({ meta: [{ title: "Room Check-In — Staff Portal" }] }),
  component: StaffRooms,
});

// ─── constants ────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  OPD: "bg-primary/10 text-primary border-primary/20",
  Ward: "bg-blue-500/10 text-blue-600 border-blue-200",
  OT: "bg-purple-500/10 text-purple-600 border-purple-200",
  ER: "bg-destructive/10 text-destructive border-destructive/20",
  ICU: "bg-warning/10 text-warning-foreground border-warning/20",
  Diag: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
  Lab: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
};

function StaffRooms() {
  const { user: currentUser } = useCurrentUser();
  const { publicKey, connected, signMessage } = useWallet();
  const isDoctor = (currentUser?.role || "").toLowerCase() === "doctor";

  // ── doctor identity ──────────────────────────────────────────────────────
  const [doctorDid, setDoctorDid] = useState("");
  const [doctorName, setDoctorName] = useState("Dr. Staff");
  const [didVerified, setDidVerified] = useState(false);

  // ── room data ────────────────────────────────────────────────────────────
  const [rooms, setRooms] = useState<any[]>([]);
  const [checkedIn, setCheckedIn] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingHist, setLoadingHist] = useState(false);

  // ── merkle / daily events ────────────────────────────────────────────────
  const [dailyEvents, setDailyEvents] = useState<any[]>([]);
  const [dailyRoot, setDailyRoot] = useState<string | null>(null);
  const [dailyDate, setDailyDate] = useState("");
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [publishedRoots, setPublishedRoots] = useState<any[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── multi-select ─────────────────────────────────────────────────────────
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<"checkin" | "checkout" | null>(null);
  const [typeFilter, setTypeFilter] = useState("All");

  // ── modals ───────────────────────────────────────────────────────────────
  const [showHistory, setShowHistory] = useState(false);
  const [showPublished, setShowPublished] = useState(false);
  const [copiedText, setCopiedText] = useState("");

  // ── resolve doctor identity ──────────────────────────────────────────────
  useEffect(() => {
    const email = currentUser?.email ?? "";
    const name = currentUser?.name ?? "Dr. Staff";
    const did = currentUser?.did ?? "";
    setDoctorName(name);
    if (did) {
      setDoctorDid(did);
      getVerifiedDoctors()
        .then((r) => {
          const match = (r.doctors ?? []).find(
            (d: any) => d.did === did || d.email?.toLowerCase() === email.toLowerCase(),
          );
          setDidVerified(!!match);
          if (match?.did) setDoctorDid(match.did);
        })
        .catch(() => setDidVerified(false));
    } else {
      setDoctorDid(`did:hosp:0x${email.split("@")[0].substring(0, 8)}`);
      setDidVerified(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── loaders ──────────────────────────────────────────────────────────────
  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const r = await getRooms();
      setRooms(r.rooms ?? []);
    } catch {
      toast.error("Could not load rooms");
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    if (!doctorDid) return;
    try {
      const r = await getRoomCheckinStatus(doctorDid);
      setCheckedIn(r.checkedInRooms ?? []);
    } catch {
      /* silent */
    }
  }, [doctorDid]);

  const loadHistory = useCallback(async () => {
    if (!doctorDid) return;
    setLoadingHist(true);
    try {
      const r = await getRoomCheckinHistory(doctorDid);
      setHistory(r.logs ?? []);
    } catch {
      /* silent */
    } finally {
      setLoadingHist(false);
    }
  }, [doctorDid]);

  const loadDaily = useCallback(async () => {
    if (!doctorDid) return;
    setLoadingDaily(true);
    try {
      const r = await getDailyRoomEvents(doctorDid);
      setDailyEvents(r.events ?? []);
      setDailyRoot(r.merkleRoot ?? null);
      setDailyDate(r.date ?? "");
    } catch {
      /* silent */
    } finally {
      setLoadingDaily(false);
    }
  }, [doctorDid]);

  const loadPublished = useCallback(async () => {
    if (!doctorDid) return;
    try {
      const r = await getMerkleRootHistory(doctorDid);
      setPublishedRoots(r.roots ?? []);
    } catch {
      /* silent */
    }
  }, [doctorDid]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);
  useEffect(() => {
    if (!doctorDid) return;
    loadStatus();
    loadHistory();
    loadDaily();
    loadPublished();
  }, [doctorDid, loadStatus, loadHistory, loadDaily, loadPublished]);

  // ── Real-time refresh via Supabase Realtime ───────────────────────────────
  // Replaces a WebSocket to Express. room_checkins covers check-in and location
  // changes; merkle_roots covers publications.
  const refreshRoomState = useCallback(() => {
    loadStatus();
    loadHistory();
    loadDaily();
  }, [loadStatus, loadHistory, loadDaily]);

  useTableRefresh("room_checkins", refreshRoomState);
  useTableRefresh("merkle_roots", loadPublished);

  // ── helpers ───────────────────────────────────────────────────────────────
  const toggleRoom = (id: string) =>
    setSelectedRooms((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const checkedInIds = new Set(checkedIn.map((c: any) => c.roomId));
  const types = ["All", ...Array.from(new Set(rooms.map((r) => r.type)))];
  const visible = typeFilter === "All" ? rooms : rooms.filter((r) => r.type === typeFilter);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(""), 2000);
    } catch {
      /* silent */
    }
  };

  const doAction = async (action: "checkin" | "checkout") => {
    if (selectedRooms.size === 0) {
      toast.error("Select at least one room");
      return;
    }
    setActing(action);
    try {
      const r = await roomCheckInMulti(Array.from(selectedRooms), action);
      toast.success(
        action === "checkin"
          ? `Checked in to ${r.results.length} room(s)`
          : `Checked out of ${r.results.length} room(s)`,
        { description: r.results.map((x: any) => x.roomName).join(", ") },
      );
      setSelectedRooms(new Set());
      await Promise.all([loadStatus(), loadHistory(), loadDaily()]);
    } catch (err: any) {
      toast.error("Action failed", { description: err.message });
    } finally {
      setActing(null);
    }
  };

  const doPublish = async () => {
    setPublishing(true);
    setShowConfirm(false);
    try {
      let txSignature: string | undefined;
      let walletAddress: string | undefined;

      // If doctor has a connected + verified wallet with signMessage support, sign the root
      if (connected && publicKey && signMessage && dailyRoot) {
        try {
          walletAddress = publicKey.toBase58();
          const message = `Embrace Health Grid — Publish Merkle Root\nDoctor: ${doctorDid}\nDate: ${dailyDate || new Date().toISOString().split("T")[0]}\nRoot: ${dailyRoot}`;
          toast.info("Please approve the signing request in your Phantom wallet…");
          const msgBytes = new TextEncoder().encode(message);
          const sigBytes = await signMessage(msgBytes);
          txSignature = Buffer.from(sigBytes).toString("base64");
          toast.success("Signature approved — publishing on-chain…");
        } catch (sigErr: any) {
          if (sigErr.message?.includes("User rejected") || sigErr.message?.includes("cancelled")) {
            toast.error("Signature cancelled. You must approve the request to publish on-chain.");
            setPublishing(false);
            return;
          }
          // Wallet signing failed non-fatally — proceed with simulated tx
          console.warn("Wallet sign failed, falling back to simulated tx:", sigErr);
          txSignature = undefined;
          walletAddress = undefined;
        }
      }

      const r = await publishMerkleRoot(doctorDid, txSignature, walletAddress);
      toast.success(
        r.onChain ? "Merkle Root published on-chain!" : "Merkle Root recorded (simulated)",
        { description: `Root: ${r.merkleRoot.slice(0, 16)}… · Tx: ${r.txHash.slice(0, 16)}…` },
      );
      await Promise.all([loadDaily(), loadPublished()]);
    } catch (err: any) {
      toast.error("Publish failed", { description: err.message });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <RouteGuard requiredRole="staff">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between border-b border-border pb-4">
          <PageHeader
            eyebrow="Clinician Portal"
            title="Room Check-In & Merkle Tracking"
            description="Check in/out of multiple rooms. Daily events are aggregated into a Merkle Tree and published on-chain at end of day."
          />
          <div className="flex gap-2 flex-wrap shrink-0">
            <button
              onClick={() => {
                setShowHistory(true);
                loadHistory();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              <History className="h-3.5 w-3.5 text-primary" /> History
            </button>
            <button
              onClick={() => {
                setShowPublished(true);
                loadPublished();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              <Link2 className="h-3.5 w-3.5 text-primary" /> Published Roots
            </button>
            <button
              onClick={() => {
                loadStatus();
                loadDaily();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* Doctor identity card */}
        <div
          className={`rounded-xl border-2 p-4 flex items-center gap-4 ${didVerified ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}`}
        >
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${didVerified ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground"}`}
          >
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-foreground text-base">{doctorName}</div>
            <div className="font-mono text-xs text-muted-foreground truncate">
              {doctorDid || "DID not assigned"}
            </div>
            <div
              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${didVerified ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground"}`}
            >
              {didVerified ? (
                <>
                  <CheckCircle2 className="h-3 w-3" /> Admin-Issued DID Verified
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" /> DID Pending
                </>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 space-y-0.5">
            <div className="text-2xl font-black text-foreground">{checkedIn.length}</div>
            <div className="text-xs text-muted-foreground">
              Active Room{checkedIn.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Currently checked-in */}
        {checkedIn.length > 0 && (
          <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-2">
            <div className="text-xs font-bold text-success uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-4 w-4" /> Currently In
            </div>
            <div className="flex flex-wrap gap-2">
              {checkedIn.map((c: any) => (
                <span
                  key={c.roomId}
                  className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success"
                >
                  <MapPin className="h-3 w-3" /> {c.roomName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Selection action bar */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-foreground shrink-0">
            {selectedRooms.size === 0
              ? "Select rooms below"
              : `${selectedRooms.size} room${selectedRooms.size > 1 ? "s" : ""} selected`}
          </span>
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
            {acting === "checkout" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            Check Out
          </button>
          <button
            onClick={() => doAction("checkin")}
            disabled={acting !== null || selectedRooms.size === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {acting === "checkin" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogIn className="h-3.5 w-3.5" />
            )}
            Check In
          </button>
        </div>

        {/* Type filter + select-all */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-muted"}`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={() => setSelectedRooms(new Set(visible.map((r) => r.id)))}
            className="ml-auto rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            Select All
          </button>
        </div>

        {/* Room grid */}
        {loadingRooms ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-24 animate-pulse rounded-xl border border-border bg-muted"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((room) => {
              const isSel = selectedRooms.has(room.id);
              const isActive = checkedInIds.has(room.id);
              const tCls = TYPE_COLORS[room.type] ?? "bg-muted text-muted-foreground border-border";
              return (
                <motion.button
                  key={room.id}
                  onClick={() => toggleRoom(room.id)}
                  whileTap={{ scale: 0.97 }}
                  className={`rounded-xl border-2 p-4 text-left transition-all space-y-2 ${isSel ? "border-primary bg-primary/5 shadow-md" : isActive ? "border-success/40 bg-success/5" : "border-border bg-card hover:border-primary/40"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-foreground truncate">{room.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Floor: {room.floor}
                      </div>
                    </div>
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${isSel ? "bg-primary border-primary" : "border-border bg-background"}`}
                    >
                      {isSel && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${tCls}`}
                    >
                      {room.type}
                    </span>
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

        {/* ── Daily Room Events (Merkle Tree) ─────────────────────────────── */}
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <TreePine className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Daily Room Events (Merkle Tree)
                </h3>
                <p className="text-xs text-muted-foreground">
                  {dailyDate ? `${dailyDate} · ` : ""}
                  {dailyEvents.length} event{dailyEvents.length !== 1 ? "s" : ""} today
                </p>
              </div>
            </div>
            {/* Publish button — doctors only */}
            <div className="flex items-center gap-2 flex-wrap">
              {loadingDaily && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {isDoctor ? (
                <>
                  {/* Wallet connection required */}
                  {!connected && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-warning-foreground font-medium">
                        Connect wallet to publish
                      </span>
                      <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !rounded-lg !h-8 !text-xs !font-semibold !px-3" />
                    </div>
                  )}
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={publishing || dailyEvents.length === 0 || !connected}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
                    title={
                      !connected ? "Connect your Phantom wallet to publish on-chain" : undefined
                    }
                  >
                    {publishing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5" />
                    )}
                    {connected ? "Sign & Publish to Blockchain" : "Publish to Blockchain"}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning-foreground font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Only doctors can publish Merkle Roots
                </div>
              )}
            </div>
          </div>

          {/* Wallet status for doctors */}
          {isDoctor && connected && publicKey && (
            <div className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/5 px-3 py-2 text-xs">
              <Wallet className="h-3.5 w-3.5 text-success shrink-0" />
              <span className="text-success font-semibold">Wallet connected:</span>
              <span className="font-mono text-foreground">
                {publicKey.toBase58().slice(0, 8)}…{publicKey.toBase58().slice(-6)}
              </span>
            </div>
          )}

          {/* Pre-computed Merkle root preview */}
          {dailyRoot && (
            <div className="rounded-xl border border-primary/20 bg-card p-3 space-y-1.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Today's Merkle Root (unpublished)
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-primary break-all flex-1">{dailyRoot}</span>
                <button
                  onClick={() => copyToClipboard(dailyRoot)}
                  className="shrink-0 rounded p-1 hover:bg-muted"
                >
                  <Copy
                    className={`h-3.5 w-3.5 ${copiedText === dailyRoot ? "text-success" : "text-muted-foreground"}`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Events list */}
          {dailyEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-primary/20 py-8 text-center text-xs text-muted-foreground">
              No room events today. Check into rooms above to generate Merkle Tree leaves.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {dailyEvents.map((ev: any, idx: number) => (
                <div
                  key={ev.logId ?? idx}
                  className="flex items-center gap-3 rounded-lg bg-card border border-border px-3 py-2 text-[11px]"
                >
                  <span className="text-muted-foreground font-mono text-[10px] shrink-0 w-5 text-right">
                    {idx + 1}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-bold text-[9px] shrink-0 ${ev.action === "checkin" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
                  >
                    {ev.action === "checkin" ? "IN" : "OUT"}
                  </span>
                  <span className="flex-1 font-medium text-foreground truncate">{ev.roomName}</span>
                  <span className="text-muted-foreground font-mono shrink-0 text-[10px]">
                    {new Date(ev.timestamp).toLocaleTimeString("en-IN")}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground hidden sm:block">
                    {ev.hash?.slice(0, 14)}…
                  </span>
                </div>
              ))}
            </div>
          )}

          {dailyEvents.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning-foreground" />
              {isDoctor
                ? 'Events are aggregated until you click "Sign & Publish". Your Phantom wallet will be asked to sign the root. Only the Merkle Root is published on-chain — not the raw events.'
                : "Events accumulate throughout the day. The assigned doctor will publish the Merkle Root at end of day."}
            </div>
          )}
        </div>

        {/* Recent events strip */}
        {history.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" /> Recent Check-In Events
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {history.slice(0, 6).map((log: any) => (
                <div
                  key={log.logId}
                  className="flex items-center gap-3 text-[11px] bg-muted/40 rounded-lg px-3 py-2"
                >
                  <span
                    className={`rounded-full px-2 py-0.5 font-bold text-[9px] ${log.action === "checkin" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
                  >
                    {log.action === "checkin" ? "IN" : "OUT"}
                  </span>
                  <span className="flex-1 font-medium text-foreground truncate">
                    {log.roomName}
                  </span>
                  <span className="text-muted-foreground font-mono shrink-0 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Publish Confirm Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-clinical-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-3 mb-5">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <TreePine className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-foreground">Publish Daily Merkle Root?</h3>
                <p className="text-xs text-muted-foreground px-4">
                  This will build a Merkle Tree from today's{" "}
                  <strong>{dailyEvents.length} room events</strong> and publish only the root hash
                  on-chain. Your Phantom wallet will be asked to sign the Merkle Root.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-1.5 mb-5">
                {[
                  ["Date", dailyDate || new Date().toISOString().split("T")[0]],
                  ["Events", String(dailyEvents.length)],
                  ["Merkle Root", dailyRoot ? `${dailyRoot.slice(0, 24)}…` : "Will be generated"],
                  [
                    "Network",
                    connected && publicKey
                      ? "Solana Devnet (signed by wallet)"
                      : "Solana Devnet (simulated)",
                  ],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-semibold font-mono text-foreground">{v}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={doPublish}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Confirm Publish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Published Roots History Modal ────────────────────────────────── */}
      <AnimatePresence>
        {showPublished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
            onClick={() => setShowPublished(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-clinical-md max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-primary" /> Published Merkle Roots
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {doctorName} · {publishedRoots.length} publication
                    {publishedRoots.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={() => setShowPublished(false)}
                  className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 space-y-3">
                {publishedRoots.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    No roots published yet. Use "Publish to Blockchain" to create your first
                    on-chain record.
                  </div>
                ) : (
                  publishedRoots.map((root: any) => (
                    <div
                      key={root.rootId}
                      className="rounded-xl border border-border bg-muted/30 p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 border border-success/30 px-2 py-0.5 text-[10px] font-bold text-success">
                          <CheckCircle2 className="h-3 w-3" /> Published
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(root.publishedAt).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                            Merkle Root
                          </div>
                          <div className="flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-1.5">
                            <span className="font-mono text-primary break-all flex-1 text-[11px]">
                              {root.merkleRoot}
                            </span>
                            <button
                              onClick={() => copyToClipboard(root.merkleRoot)}
                              className="shrink-0 p-0.5 rounded hover:bg-muted"
                            >
                              <Copy
                                className={`h-3.5 w-3.5 ${copiedText === root.merkleRoot ? "text-success" : "text-muted-foreground"}`}
                              />
                            </button>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                            Transaction Hash
                          </div>
                          <div className="flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-1.5">
                            <span className="font-mono text-foreground break-all flex-1 text-[11px]">
                              {root.txHash}
                            </span>
                            <button
                              onClick={() => copyToClipboard(root.txHash)}
                              className="shrink-0 p-0.5 rounded hover:bg-muted"
                            >
                              <Copy
                                className={`h-3.5 w-3.5 ${copiedText === root.txHash ? "text-success" : "text-muted-foreground"}`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 text-[10px] text-muted-foreground border-t border-border pt-2">
                        <span>
                          <CalendarDays className="inline h-3 w-3 mr-0.5" />
                          {root.date}
                        </span>
                        <span>
                          <Hash className="inline h-3 w-3 mr-0.5" />
                          {root.eventCount} events
                        </span>
                        <span>
                          <ExternalLink className="inline h-3 w-3 mr-0.5" />
                          {root.network}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="pt-4 border-t border-border flex justify-end">
                <button
                  onClick={() => setShowPublished(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Check-In History Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
            onClick={() => setShowHistory(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-clinical-md max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" /> Room Check-In Audit Trail
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {doctorName} · {doctorDid}
                  </p>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 space-y-2">
                {loadingHist ? (
                  <div className="py-10 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    No check-in history yet.
                  </div>
                ) : (
                  history.map((log: any) => (
                    <div
                      key={log.logId}
                      className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${log.action === "checkin" ? "bg-success/15 text-success" : "bg-amber-500/15 text-amber-600"}`}
                          >
                            {log.action === "checkin" ? "✅ IN" : "🔴 OUT"}
                          </span>
                          <span className="font-semibold text-foreground text-xs">
                            {log.roomName}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 font-mono text-[9px] text-primary overflow-x-auto">
                        <Hash className="h-3 w-3 shrink-0" />
                        {log.hash}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="pt-4 border-t border-border flex justify-end">
                <button
                  onClick={() => setShowHistory(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}
