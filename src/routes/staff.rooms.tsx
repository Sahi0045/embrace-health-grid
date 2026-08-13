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
import {
  Building2,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  TreePine,
  ShieldCheck,
  Search,
  CheckCircle2,
  Link2,
  Copy,
  X,
  CalendarDays,
  Hash,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RoomCard } from "@/components/rooms/RoomCard";
import { RoomStatusBar } from "@/components/rooms/RoomStatusBar";
import { RoomActivityTimeline } from "@/components/rooms/RoomActivityTimeline";
import { RoomVerificationPanel } from "@/components/rooms/RoomVerificationPanel";

export const Route = createFileRoute("/staff/rooms")({
  head: () => ({
    meta: [{ title: "Room Check-In — Staff Portal" }],
  }),
  component: StaffRoomsPage,
});

/**
 * Smart Pagination Range Helper (e.g. 1 2 3 ... 49 50)
 */
function getPaginationRange(current: number, total: number) {
  if (total <= 4) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 2) {
    return [1, 2, 3, "...", total];
  }
  if (current >= total - 1) {
    return [1, "...", total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

function StaffRoomsPage() {
  const { user: currentUser } = useCurrentUser();
  const { publicKey, connected, signMessage } = useWallet();
  const isDoctor = (currentUser?.role || "").toLowerCase() === "doctor";

  // Doctor identity & verification state
  const [doctorDid, setDoctorDid] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [didVerified, setDidVerified] = useState(false);

  // Room data & status
  const [rawRooms, setRawRooms] = useState<any[]>([]);
  const [checkedIn, setCheckedIn] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingHist, setLoadingHist] = useState(false);

  // Daily events & Merkle state
  const [dailyEvents, setDailyEvents] = useState<any[]>([]);
  const [dailyRoot, setDailyRoot] = useState<string | null>(null);
  const [dailyDate, setDailyDate] = useState("");
  const [publishedRoots, setPublishedRoots] = useState<any[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Published Roots Modal state
  const [showPublished, setShowPublished] = useState(false);
  const [copiedText, setCopiedText] = useState("");

  // Room selection, filter & search
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<"checkin" | "checkout" | null>(null);
  const [typeFilter, setTypeFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "name" | "available-first" | "checked-in-first" | "available-only"
  >("name");

  // Pagination state (max 12 cards per page)
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Reset pagination page on search, category filter, or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, sortBy]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(""), 2000);
    } catch {
      /* silent */
    }
  };

  // Normalize room object so property names are always consistent
  const normalizedRooms = rawRooms.map((r: any) => {
    const id = String(r.roomId || r.id || r.room_id || "").trim();
    const name = String(r.roomName || r.name || r.room_name || id || "Medical Room").trim();
    const category = String(r.category || r.type || r.room_type || "OPD").trim();
    const floor = r.floor ?? "Floor 1";
    return {
      id,
      roomId: id,
      name,
      roomName: name,
      category,
      type: category,
      floor,
    };
  });

  // Resolve clinician identity
  useEffect(() => {
    const email = currentUser?.email ?? "";
    const name = currentUser?.fullName ?? currentUser?.name ?? currentUser?.email ?? "Staff Member";
    const did = currentUser?.primaryDid ?? currentUser?.did ?? "";
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
  }, [currentUser]);

  // Data loaders
  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const r = await getRooms();
      setRawRooms(r.rooms ?? []);
    } catch {
      toast.error("Could not load room directory");
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
      /* silent fallback */
    }
  }, [doctorDid]);

  const loadHistory = useCallback(async () => {
    if (!doctorDid) return;
    setLoadingHist(true);
    try {
      const r = await getRoomCheckinHistory(doctorDid);
      setHistory(r.logs ?? []);
    } catch {
      /* silent fallback */
    } finally {
      setLoadingHist(false);
    }
  }, [doctorDid]);

  const loadDaily = useCallback(async () => {
    if (!doctorDid) return;
    try {
      const r = await getDailyRoomEvents(doctorDid);
      setDailyEvents(r.events ?? []);
      setDailyRoot(r.merkleRoot ?? null);
      setDailyDate(r.date ?? "");
    } catch {
      /* silent fallback */
    }
  }, [doctorDid]);

  const loadPublished = useCallback(async () => {
    if (!doctorDid) return;
    try {
      const r = await getMerkleRootHistory(doctorDid);
      setPublishedRoots(r.roots ?? []);
    } catch {
      /* silent fallback */
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

  // Realtime refreshes
  const refreshRoomState = useCallback(() => {
    loadStatus();
    loadHistory();
    loadDaily();
  }, [loadStatus, loadHistory, loadDaily]);

  useTableRefresh("room_checkins", refreshRoomState);
  useTableRefresh("merkle_roots", loadPublished);
  useTableRefresh("rooms", loadRooms);

  // Selection & filter calculations
  const toggleRoom = useCallback((id: string) => {
    const targetId = String(id).trim();
    if (!targetId) return;
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(targetId)) {
        next.delete(targetId);
      } else {
        next.add(targetId);
      }
      return next;
    });
  }, []);

  const checkedInIds = new Set(
    checkedIn.map((c: any) => String(c.roomId || c.room_id || c.currentRoom || "").trim()),
  );

  const roomTypes = [
    "All",
    ...Array.from(
      new Set(
        normalizedRooms
          .map((r) => r.category)
          .filter((cat): cat is string => Boolean(cat && cat.trim())),
      ),
    ),
  ];

  // Filtered & Sorted visible rooms
  const visibleRooms = normalizedRooms
    .filter((r) => {
      const isCheckedIn = checkedInIds.has(r.id);
      if (sortBy === "available-only" && isCheckedIn) return false;

      const matchesType = typeFilter === "All" || r.category === typeFilter;
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(r.floor).toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    })
    .sort((a, b) => {
      const aChecked = checkedInIds.has(a.id);
      const bChecked = checkedInIds.has(b.id);

      if (sortBy === "available-first") {
        if (aChecked !== bChecked) return aChecked ? 1 : -1;
      } else if (sortBy === "checked-in-first") {
        if (aChecked !== bChecked) return aChecked ? -1 : 1;
      }

      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });

  // Pagination calculation
  const totalPages = Math.ceil(visibleRooms.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRooms = visibleRooms.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const doAction = async (action: "checkin" | "checkout") => {
    if (selectedRooms.size === 0) {
      toast.error("Select at least one room");
      return;
    }
    setActing(action);
    try {
      const selectedList = normalizedRooms.filter((r) => selectedRooms.has(r.id));
      const r = await roomCheckInMulti(selectedList, action);
      toast.success(
        action === "checkin"
          ? `Checked into ${r.results.length} room(s)`
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

      if (connected && publicKey && signMessage && dailyRoot) {
        try {
          walletAddress = publicKey.toBase58();
          const message = `Embrace Health Grid — Publish Verification Record\nStaff: ${doctorDid}\nDate: ${
            dailyDate || new Date().toISOString().split("T")[0]
          }\nRoot: ${dailyRoot}`;
          toast.info("Approve the signing request in your Phantom wallet…");
          const msgBytes = new TextEncoder().encode(message);
          const sigBytes = await signMessage(msgBytes);
          txSignature = Buffer.from(sigBytes).toString("base64");
          toast.success("Signature approved — anchoring proof on Solana devnet…");
        } catch (sigErr: any) {
          if (sigErr.message?.includes("User rejected") || sigErr.message?.includes("cancelled")) {
            toast.error("Signature cancelled. Request must be approved to record on-chain.");
            setPublishing(false);
            return;
          }
          txSignature = undefined;
          walletAddress = undefined;
        }
      }

      const r = await publishMerkleRoot(doctorDid, txSignature, walletAddress);
      toast.success(
        r.onChain ? "Verification record anchored on-chain!" : "Verification record logged",
        { description: `Root: ${r.merkleRoot.slice(0, 16)}…` },
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
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-8 pb-24">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between border-b border-border pb-4">
          <PageHeader
            eyebrow="Clinician Portal"
            title="Room Check-In"
            description="Select active rooms to check in, check out, and review duty activity."
          />
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowPublished(true);
                loadPublished();
              }}
              className="gap-2 text-xs font-semibold shadow-xs hover:bg-accent shrink-0"
            >
              <Link2 className="h-3.5 w-3.5 text-primary" /> Published Roots (
              {publishedRoots.length})
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadRooms();
                loadStatus();
                loadHistory();
              }}
              className="gap-2 text-xs font-semibold shadow-xs hover:bg-accent shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh Status
            </Button>
          </div>
        </div>

        {/* SECTION 1: CLINICIAN STATUS STRIP */}
        <RoomStatusBar
          userName={doctorName}
          userRole={currentUser?.role ? currentUser.role.toUpperCase() : "STAFF"}
          isVerified={didVerified}
          activeRoomsCount={checkedIn.length}
          todayEventsCount={history.length}
          totalRoomsCount={normalizedRooms.length}
          activeRooms={checkedIn}
        />

        {/* SECTION 2: ROOM SELECTION GRID */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display font-extrabold text-lg text-foreground tracking-tight flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span>Select Rooms</span>
            </h2>

            {/* Interactive Sort & Availability Selector */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                {visibleRooms.length} room{visibleRooms.length !== 1 ? "s" : ""}
              </span>

              <div className="flex items-center gap-1.5 bg-card border border-border/80 rounded-xl px-3 py-1.5 shadow-clinical-xs transition-all hover:border-border">
                <ArrowUpDown className="h-3.5 w-3.5 text-primary shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-xs font-extrabold text-foreground focus:outline-none cursor-pointer pr-1"
                >
                  <option value="name">Sort: Name (A-Z)</option>
                  <option value="available-first">Sort: Available First</option>
                  <option value="checked-in-first">Sort: Checked-In First</option>
                  <option value="available-only">Filter: Only Available</option>
                </select>
              </div>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border/80 p-3 rounded-2xl shadow-clinical-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search room name, ID, or floor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl bg-background border border-border/80 pl-9.5 pr-4 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
              {roomTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-full px-3 py-1 text-xs font-bold border transition-all whitespace-nowrap ${
                    typeFilter === t
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "border-border/80 text-muted-foreground hover:border-border bg-background"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 4-Column Room Grid (Max 12 Cards Per Page, A-Z Sorted) */}
          {loadingRooms ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-28 animate-pulse rounded-2xl border border-border bg-muted/40"
                />
              ))}
            </div>
          ) : visibleRooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-2 bg-card/50">
              <Building2 className="h-9 w-9 text-muted-foreground/40 mx-auto" />
              <h4 className="font-bold text-sm text-foreground">No matching rooms</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Try clearing search filters or selecting a different category.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {paginatedRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    isSelected={selectedRooms.has(room.id)}
                    isCheckedIn={checkedInIds.has(room.id)}
                    onToggle={toggleRoom}
                  />
                ))}
              </div>

              {/* Smart Numbered Pagination Controls (e.g. 1 2 3 ... 49 50) */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/60 text-xs font-medium text-muted-foreground">
                  <div>
                    Showing <span className="font-bold text-foreground">{startIndex + 1}</span>–
                    <span className="font-bold text-foreground">
                      {Math.min(startIndex + ITEMS_PER_PAGE, visibleRooms.length)}
                    </span>{" "}
                    of <span className="font-bold text-foreground">{visibleRooms.length}</span>{" "}
                    rooms (Page {currentPage} of {totalPages})
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-2.5 text-xs font-bold gap-1 rounded-xl"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Prev
                    </Button>

                    {getPaginationRange(currentPage, totalPages).map((item, idx) =>
                      typeof item === "number" ? (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCurrentPage(item)}
                          className={`h-8 min-w-[32px] px-2 rounded-xl text-xs font-extrabold transition-all ${
                            currentPage === item
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "border border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {item}
                        </button>
                      ) : (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-1 text-xs font-bold text-muted-foreground/60 select-none"
                        >
                          …
                        </span>
                      ),
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-2.5 text-xs font-bold gap-1 rounded-xl"
                    >
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* SECTION 3: TODAY'S ACTIVITY & DAILY MERKLE EVENTS */}
        <section className="space-y-4 pt-4 border-t border-border/60">
          <RoomActivityTimeline
            events={history}
            dailyEvents={dailyEvents}
            dailyRoot={dailyRoot}
            dailyDate={dailyDate}
            loading={loadingHist}
          />
        </section>

        {/* SECTION 4: VERIFICATION PROOFS (Doctor Only) */}
        {isDoctor && (
          <section className="space-y-4 pt-4 border-t border-border/60">
            <RoomVerificationPanel
              isDoctor={isDoctor}
              dailyEvents={dailyEvents}
              dailyRoot={dailyRoot}
              dailyDate={dailyDate}
              publishedRoots={publishedRoots}
              connected={connected}
              publicKey={publicKey}
              onPublish={doPublish}
              publishing={publishing}
              onShowConfirm={() => setShowConfirm(true)}
            />
          </section>
        )}
      </div>

      {/* FLOATING STICKY ACTION FOOTER BAR */}
      <AnimatePresence>
        {selectedRooms.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4"
          >
            {/* Translucent Liquid Glass Container */}
            <div className="rounded-2xl border border-white/40 dark:border-white/10 bg-card/60 dark:bg-card/70 backdrop-blur-2xl p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Left Controls: Count + Clear + Select All */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-extrabold shadow-xs">
                    {selectedRooms.size}
                  </span>
                  <span className="text-xs font-extrabold text-foreground tracking-tight whitespace-nowrap">
                    Room{selectedRooms.size > 1 ? "s" : ""} selected
                  </span>
                </div>

                <div className="h-4 w-px bg-border/80" />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRooms(new Set())}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                  >
                    Clear
                  </button>

                  <span className="text-muted-foreground/40 text-xs">·</span>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedRooms((prev) =>
                        prev.size === visibleRooms.length
                          ? new Set()
                          : new Set(visibleRooms.map((r) => r.id)),
                      )
                    }
                    className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    {selectedRooms.size === visibleRooms.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
              </div>

              {/* Right Prominent Hero Actions: Check Out & Check In */}
              <div className="flex items-center gap-3 shrink-0 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => doAction("checkout")}
                  disabled={acting !== null}
                  className="border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25 text-xs font-extrabold gap-2 px-5 h-10 rounded-xl shadow-xs transition-all"
                >
                  {acting === "checkout" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Check Out ({selectedRooms.size})
                </Button>

                <Button
                  size="sm"
                  onClick={() => doAction("checkin")}
                  disabled={acting !== null}
                  className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/95 hover:to-blue-600/95 text-primary-foreground text-xs font-extrabold gap-2 px-6 h-10 rounded-xl shadow-clinical-md shadow-primary/25 transition-all"
                >
                  {acting === "checkin" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  Check In ({selectedRooms.size})
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-md p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-clinical-xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <TreePine className="h-6 w-6" />
                </div>
                <h3 className="font-display font-extrabold text-base text-foreground">
                  Publish Verification Record
                </h3>
                <p className="text-xs text-muted-foreground px-2 leading-relaxed">
                  This action generates a Merkle Root proof from today's{" "}
                  <strong>{dailyEvents.length} room check-in event(s)</strong> and anchors it on
                  Solana devnet.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Date:</span>
                  <span className="font-bold text-foreground font-mono">
                    {dailyDate || new Date().toISOString().split("T")[0]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Total Events:</span>
                  <span className="font-bold text-foreground">{dailyEvents.length}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded-xl text-xs font-bold h-10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={doPublish}
                  className="flex-1 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold h-10 shadow-clinical-sm"
                >
                  Confirm & Anchor
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Published Merkle Roots Modal Overlay */}
      <AnimatePresence>
        {showPublished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-md p-4"
            onClick={() => setShowPublished(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-2xl max-h-[85vh] rounded-2xl border border-border bg-card p-6 shadow-clinical-xl flex flex-col space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Link2 className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-foreground">
                      Published Merkle Roots
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {doctorName} · {publishedRoots.length} publication
                      {publishedRoots.length !== 1 ? "s" : ""} on-chain
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPublished(false)}
                  className="rounded-xl p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 space-y-3 pr-1">
                {publishedRoots.length === 0 ? (
                  <div className="py-14 text-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-2xl space-y-2">
                    <Link2 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                    <h4 className="font-bold text-sm text-foreground">No Published Roots Yet</h4>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Cryptographic Merkle Root proofs will appear here after being published to
                      Solana devnet.
                    </p>
                  </div>
                ) : (
                  publishedRoots.map((root: any) => (
                    <div
                      key={root.rootId || root.merkleRoot}
                      className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 border border-success/30 px-2.5 py-0.5 text-[10px] font-extrabold text-success">
                          <CheckCircle2 className="h-3 w-3" /> Published
                        </span>
                        <span className="text-muted-foreground text-[11px] font-medium">
                          {root.publishedAt
                            ? new Date(root.publishedAt).toLocaleString()
                            : "Recently"}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mb-1">
                            Merkle Root Hash
                          </div>
                          <div className="flex items-center gap-2 rounded-xl bg-background border border-border px-3.5 py-2">
                            <span className="font-mono text-primary font-bold break-all flex-1 text-[11px]">
                              {root.merkleRoot}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(root.merkleRoot)}
                              className="shrink-0 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy Merkle Root"
                            >
                              <Copy
                                className={`h-3.5 w-3.5 ${
                                  copiedText === root.merkleRoot
                                    ? "text-success"
                                    : "text-muted-foreground"
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mb-1">
                            Transaction Hash
                          </div>
                          <div className="flex items-center gap-2 rounded-xl bg-background border border-border px-3.5 py-2">
                            <span className="font-mono text-foreground font-semibold break-all flex-1 text-[11px]">
                              {root.txHash || "0x-devnet-signature"}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(root.txHash)}
                              className="shrink-0 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy Tx Hash"
                            >
                              <Copy
                                className={`h-3.5 w-3.5 ${
                                  copiedText === root.txHash
                                    ? "text-success"
                                    : "text-muted-foreground"
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground border-t border-border/40 pt-2 font-medium">
                        <span>
                          <CalendarDays className="inline h-3 w-3 mr-0.5" />
                          {root.date || "Today"}
                        </span>
                        <span>
                          <Hash className="inline h-3 w-3 mr-0.5" />
                          {root.eventCount ?? 0} events
                        </span>
                        <span>
                          <ExternalLink className="inline h-3 w-3 mr-0.5" />
                          {root.network || "Solana Devnet"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}
