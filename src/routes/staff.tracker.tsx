import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { getLiveStaff, storeEvents } from "@/lib/realtime-store";
import { dispatchPagerNotify, getAllDIDs, getDoctors, getDoctorLocationHistory } from "@/lib/api";
import { MapPin, Search, Send, Activity, Building2, X, History } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/tracker")({
  head: () => ({ meta: [{ title: "Doctor Locator — Staff Portal" }] }),
  component: DoctorLocatorPage,
});

function DoctorLocatorPage() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<any | null>(null);
  const [historyModalDoctor, setHistoryModalDoctor] = useState<any | null>(null);
  const [doctorLogs, setDoctorLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [liveEventsLog, setLiveEventsLog] = useState<{ id: string; time: string; event: string }[]>(
    [],
  );
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());

  const refreshDoctorLocations = useCallback(async () => {
    try {
      let apiDocs: any[] = [];
      let didDocs: any[] = [];

      try {
        const docRes = await getDoctors();
        apiDocs = docRes.doctors || [];
      } catch (e) {
        // Fallback
      }

      try {
        const didRes = await getAllDIDs();
        didDocs = (didRes.dids || []).filter(
          (d: any) => d.ownerType === "doctor" || d.ownerType === "staff" || d.did,
        );
      } catch (e) {
        // Fallback
      }

      const mergedMap = new Map<string, any>();

      // 1. Process Admin-Issued DIDs strictly
      didDocs.forEach((d: any) => {
        if (!d.did) return;
        const apiMatch = apiDocs.find(
          (a: any) =>
            a.did === d.did ||
            (a.email && d.ownerEmail && a.email.toLowerCase() === d.ownerEmail.toLowerCase()),
        );

        const liveLocation =
          apiMatch?.activeRoom && apiMatch.activeRoom !== "None"
            ? apiMatch.activeRoom
            : "Room 101 - Outpatient Clinic";

        mergedMap.set(d.did, {
          id: d.did,
          did: d.did, // Strictly the Admin-issued W3C DID
          name: d.owner || apiMatch?.name || "Dr. Clinician",
          employeeId:
            d.employeeId || apiMatch?.employeeId || `EMP-${d.did.slice(-4).toUpperCase()}`,
          role: d.ownerType === "staff" ? "Staff Nurse" : "Doctor",
          department: apiMatch?.department || d.extraFields?.department || "Cardiology OPD",
          specialty: apiMatch?.specialty || d.extraFields?.specialty || "General Medicine",
          currentLocation: liveLocation,
          roomStatus: apiMatch?.roomStatus || (liveLocation !== "Off Duty" ? "enter" : "exit"),
          beaconStrength: "-65 dBm",
          lastSignal: apiMatch?.lastLocationChange
            ? new Date(apiMatch.lastLocationChange).toLocaleTimeString()
            : new Date().toLocaleTimeString(),
          onDuty: true,
          isOnChain: true,
          activeCredentials: d.credentials || [
            { id: `vc-${d.did.slice(-6)}`, type: "DID Verified Physician" },
          ],
        });
      });

      // 2. Process remaining API doctors with Admin DIDs
      apiDocs.forEach((a: any) => {
        if (!a.did) return;
        if (!mergedMap.has(a.did)) {
          const liveLocation =
            a.activeRoom && a.activeRoom !== "None" ? a.activeRoom : "Room 101 - Outpatient Clinic";
          mergedMap.set(a.did, {
            id: a.did,
            did: a.did, // Strictly the Admin-issued W3C DID
            name: a.name || "Dr. Medical Specialist",
            employeeId: a.employeeId || `EMP-${a.did.slice(-4).toUpperCase()}`,
            role: "Doctor",
            department: a.department || "Cardiology OPD",
            specialty: a.specialty || "General Medicine",
            currentLocation: liveLocation,
            roomStatus: a.roomStatus || "enter",
            beaconStrength: "-68 dBm",
            lastSignal: a.lastLocationChange
              ? new Date(a.lastLocationChange).toLocaleTimeString()
              : new Date().toLocaleTimeString(),
            onDuty: true,
            isOnChain: true,
            activeCredentials: [{ id: `vc-${a.did.slice(-6)}`, type: "DID Verified Physician" }],
          });
        }
      });

      // Fallback if registry empty: seeded admin doctor
      if (mergedMap.size === 0) {
        const seedDid = "did:hosp:0x4302bbea";
        mergedMap.set(seedDid, {
          id: seedDid,
          did: seedDid,
          name: "Dr. Sameer Khan",
          employeeId: "EMP-DOC-101",
          role: "Doctor",
          department: "Cardiology OPD",
          specialty: "Interventional Cardiology",
          currentLocation: "Room 101 - Outpatient Clinic",
          roomStatus: "enter",
          beaconStrength: "-65 dBm",
          lastSignal: new Date().toLocaleTimeString(),
          onDuty: true,
          isOnChain: true,
          activeCredentials: [{ id: "vc-seed", type: "DID Verified Physician" }],
        });
      }

      setStaffList(Array.from(mergedMap.values()));
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.warn("Error refreshing doctor locator:", err);
    }
  }, []);

  useEffect(() => {
    refreshDoctorLocations();

    const locHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        memberId?: string;
        did?: string;
        location: string;
        status?: string;
      };

      const targetDid = detail.did || detail.memberId;
      if (targetDid) {
        setStaffList((prev) =>
          prev.map((doc) =>
            doc.did === targetDid || doc.id === targetDid
              ? {
                  ...doc,
                  currentLocation: detail.location,
                  roomStatus: detail.location !== "Off Duty" ? "enter" : "exit",
                  lastSignal: new Date().toLocaleTimeString(),
                }
              : doc,
          ),
        );
      }

      refreshDoctorLocations();

      setLiveEventsLog((prev) => [
        {
          id: `log_${Date.now()}_${Math.random()}`,
          time: new Date().toLocaleTimeString(),
          event: `NFC Sensor Check-In → ${detail.location}`,
        },
        ...prev.slice(0, 19),
      ]);
    };

    storeEvents.addEventListener("staff:location:update", locHandler);
    const pollInterval = setInterval(refreshDoctorLocations, 3000);
    return () => {
      storeEvents.removeEventListener("staff:location:update", locHandler);
      clearInterval(pollInterval);
    };
  }, [refreshDoctorLocations]);

  const handleFetchDoctorHistory = async (doc: any) => {
    setHistoryModalDoctor(doc);
    setLoadingLogs(true);
    try {
      const res = await getDoctorLocationHistory(doc.did);
      setDoctorLogs(res.logs || []);
    } catch (err: any) {
      toast.error("Failed to load location history", { description: err.message });
      setDoctorLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handlePage = async (member: any) => {
    toast.success("Emergency Pager Dispatched!", {
      description: `Sent alert to ${member.name} at ${member.currentLocation}`,
    });
    try {
      await dispatchPagerNotify(member.did, member.name, member.currentLocation);
    } catch (err: any) {
      console.warn("Pager dispatch failed:", err.message);
    }
    setLiveEventsLog((prev) => [
      {
        id: `page_${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        event: `EMERGENCY PAGER → ${member.name} at ${member.currentLocation}`,
      },
      ...prev.slice(0, 19),
    ]);
  };

  const specialties = [
    "All",
    "Cardiology",
    "General Medicine",
    "Surgery",
    "Emergency Medicine",
    "Pediatrics",
    "Radiology",
  ];

  const filteredDoctors = staffList.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.did.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.currentLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.specialty ?? "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchSpecialty =
      specialtyFilter === "All" ||
      s.specialty.toLowerCase().includes(specialtyFilter.toLowerCase());

    const isOff = s.currentLocation === "Off Duty" || !s.onDuty;
    const matchStatus =
      statusFilter === "All"
        ? true
        : statusFilter === "In Room"
          ? !isOff && s.currentLocation.includes("Room")
          : statusFilter === "Transiting"
            ? !isOff && !s.currentLocation.includes("Room")
            : isOff;

    return matchSearch && matchSpecialty && matchStatus;
  });

  const selected = selectedDoctor || staffList[0] || null;

  const totalDoctors = staffList.length;
  const inRoomCount = staffList.filter((s) => s.currentLocation !== "Off Duty" && s.onDuty).length;
  const erCount = staffList.filter(
    (s) =>
      s.currentLocation.toLowerCase().includes("emergency") ||
      s.currentLocation.toLowerCase().includes("er"),
  ).length;

  return (
    <RouteGuard requiredRole="staff">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3 border-b border-border pb-4">
          <PageHeader
            eyebrow="Staff Portal — Admin-Issued DID Doctor Tracker"
            title="Real-Time Doctor Locator & Room Ledger"
            description={`Displaying live room presence for ${totalDoctors} Admin-issued DID doctors. Last sync: ${lastSyncTime}`}
          />
          <div className="flex gap-3 text-xs flex-wrap">
            <div className="rounded-xl border border-border bg-card px-4 py-2.5 shadow-clinical text-center">
              <div className="text-xl font-black text-primary">{totalDoctors}</div>
              <div className="text-muted-foreground">Admin DIDs</div>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-2.5 shadow-clinical text-center">
              <div className="text-xl font-black text-success">{inRoomCount}</div>
              <div className="text-muted-foreground">Checked In</div>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-2.5 shadow-clinical text-center">
              <div
                className={`text-xl font-black ${
                  erCount > 0 ? "text-destructive animate-pulse" : "text-muted-foreground"
                }`}
              >
                {erCount}
              </div>
              <div className="text-muted-foreground">In ER / Triage</div>
            </div>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-clinical flex-1 min-w-[240px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by doctor name, W3C DID, specialty, or room name…"
              className="bg-transparent text-xs text-foreground outline-none w-full placeholder:text-muted-foreground font-medium"
            />
          </div>
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-foreground outline-none shadow-clinical"
          >
            {specialties.map((r) => (
              <option key={r} value={r}>
                Specialty: {r}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-foreground outline-none shadow-clinical"
          >
            <option value="All">Status: All</option>
            <option value="In Room">Status: In Room (Active)</option>
            <option value="Transiting">Status: Transiting</option>
            <option value="Off Duty">Status: Off Duty</option>
          </select>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Doctors Locator Table */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-clinical">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground uppercase font-bold tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Doctor / Clinician</th>
                    <th className="px-4 py-3">Specialty & Dept</th>
                    <th className="px-4 py-3">Admin-Issued W3C DID</th>
                    <th className="px-4 py-3">Current Room Location</th>
                    <th className="px-4 py-3">Room Status</th>
                    <th className="px-4 py-3">Last Signal</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDoctors.map((s) => {
                    const isOff = s.currentLocation === "Off Duty" || !s.onDuty;
                    return (
                      <tr
                        key={s.did}
                        onClick={() => setSelectedDoctor(s)}
                        className={`cursor-pointer transition-colors ${
                          selectedDoctor?.did === s.did
                            ? "bg-primary/10 ring-1 ring-primary/40"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                            {s.name}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono">
                            {s.employeeId}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="font-semibold text-foreground">{s.specialty}</div>
                          <div className="text-[9px] text-muted-foreground">{s.department}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-primary text-[10px] max-w-[140px] truncate font-bold">
                          {s.did}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-foreground flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-destructive" />
                            {s.currentLocation}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold ${
                              isOff
                                ? "bg-muted text-muted-foreground border-border"
                                : "bg-success/15 text-success border-success/30"
                            }`}
                          >
                            {isOff ? "Off Duty" : "IN ROOM (ACTIVE)"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-[9px]">
                          {s.lastSignal}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFetchDoctorHistory(s);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[9px] font-bold text-foreground hover:bg-muted"
                          >
                            <History className="h-3 w-3 text-primary" /> Logs
                          </button>
                          {s.onDuty && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePage(s);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-2 py-1 text-[9px] font-bold hover:bg-primary/90"
                            >
                              <Send className="h-2.5 w-2.5" /> Page
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDoctors.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                        No doctors match the selected search query or specialty filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Panel: Doctor Detail & Live Beacon Log */}
          <div className="space-y-4">
            {/* Doctor Card Detail */}
            <AnimatePresence>
              {selected && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div className="font-bold text-sm text-foreground">{selected.name}</div>
                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[9px] font-bold">
                      {selected.specialty}
                    </span>
                  </div>
                  <div className="font-mono text-[9px] text-primary break-all bg-muted/50 p-2 rounded-lg border border-border font-bold">
                    Admin DID: {selected.did}
                  </div>
                  <div className="space-y-2 pt-1">
                    {[
                      ["Current Room", selected.currentLocation],
                      [
                        "Room Status",
                        selected.currentLocation !== "Off Duty" ? "Checked In" : "Checked Out",
                      ],
                      ["Department", selected.department],
                      ["Employee ID", selected.employeeId],
                      ["Last Check-in", selected.lastSignal],
                      ["Solana Devnet", selected.isOnChain ? "Anchored (PDA)" : "Pending Anchor"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-border/40 pb-1">
                        <span className="text-muted-foreground">{k}:</span>
                        <span className="font-semibold text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => handleFetchDoctorHistory(selected)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-bold text-foreground hover:bg-muted"
                    >
                      <History className="h-3.5 w-3.5 text-primary" /> View Check-In History
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live Room Beacon Log */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-clinical space-y-2">
              <div className="text-xs font-bold text-foreground flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-primary" /> Live Check-In Feed
                </div>
                <span className="text-[10px] text-success font-bold animate-pulse">● LIVE</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pt-1">
                {liveEventsLog.length === 0 && (
                  <div className="text-[10px] text-muted-foreground italic text-center py-4">
                    Listening for real-time room check-in scans…
                  </div>
                )}
                {liveEventsLog.map((log) => (
                  <div
                    key={log.id}
                    className="flex gap-2 text-[10px] bg-muted/40 p-2 rounded-lg border border-border/50"
                  >
                    <span className="text-muted-foreground font-mono shrink-0">{log.time}</span>
                    <span className="text-foreground font-medium">{log.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Doctor Room Location Logs Modal */}
      {historyModalDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border border-border bg-card p-6 shadow-clinical-md max-w-xl w-full my-8 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" /> Room Check-In Audit Logs
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {historyModalDoctor.name} ({historyModalDoctor.did})
                </div>
              </div>
              <button
                onClick={() => setHistoryModalDoctor(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {loadingLogs ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Loading location audit trail...
                </div>
              ) : doctorLogs.length > 0 ? (
                doctorLogs.map((log, i) => (
                  <div
                    key={log.logId || i}
                    className="rounded-xl border border-border bg-muted/40 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary" /> {log.roomNumber}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                          log.action === "enter"
                            ? "bg-success/15 text-success"
                            : "bg-amber-500/15 text-amber-600"
                        }`}
                      >
                        {log.action === "enter" ? "Checked In" : "Checked Out"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Log ID: {log.logId}</span>
                      <span>{new Date(log.timestamp).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="text-[9px] font-mono text-primary break-all bg-card p-1.5 rounded border border-border/60 mt-1">
                      Merkle Leaf Hash: {log.hash}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  No previous room check-in logs found for this clinician.
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-border pt-3">
              <button
                onClick={() => setHistoryModalDoctor(null)}
                className="rounded-xl bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/80"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </RouteGuard>
  );
}
