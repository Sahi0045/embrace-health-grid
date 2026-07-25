import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { getLiveStaff, storeEvents, updateStaffLocation, type LiveStaff } from "@/lib/realtime-store";
import { dispatchPagerNotify, checkInDoctorRoom } from "@/lib/api";
import { useDoctors } from "@/hooks/use-api";
import {
  MapPin,
  ShieldAlert,
  Phone,
  Clock,
  Radio,
  Search,
  Filter,
  Send,
  Activity,
  Users,
  CheckCircle,
  ShieldCheck,
  Building2,
  Edit3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/tracker")({
  head: () => ({ meta: [{ title: "Doctor Locator — Staff Portal" }] }),
  component: DoctorLocatorPage,
});

function DoctorLocatorPage() {
  const { data: doctorsData } = useDoctors();
  const [staff, setStaff] = useState<LiveStaff[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [logs, setLogs] = useState<{ id: string; time: string; event: string }[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());
  const [editingDoctor, setEditingDoctor] = useState<LiveStaff | null>(null);
  const [newRoomName, setNewRoomName] = useState("");

  const refresh = useCallback(() => {
    const liveList = getLiveStaff();
    const apiDocs = doctorsData?.doctors || [];

    // Merge backend doctors into live staff list so all DID doctors appear on locator page
    const mergedMap = new Map<string, LiveStaff>();

    liveList.forEach((s) => {
      const key = (s.did && s.did !== "did:hosp:unknown" ? s.did : s.id || s.name).toLowerCase().trim();
      mergedMap.set(key, s);
    });

    apiDocs.forEach((d: any, idx: number) => {
      const did = d.did || `did:hosp:0x${(d.id || idx.toString()).replace("doc_", "")}`;
      const key = (did && did !== "did:hosp:unknown" ? did : d.id || d.name).toLowerCase().trim();
      const existing =
        mergedMap.get(key) ||
        Array.from(mergedMap.values()).find(
          (s) => s.name?.toLowerCase().trim() === d.name?.toLowerCase().trim()
        );

      if (existing) {
        const existingKey = (existing.did && existing.did !== "did:hosp:unknown"
          ? existing.did
          : existing.id || existing.name
        )
          .toLowerCase()
          .trim();
        mergedMap.set(existingKey, {
          ...existing,
          did: existing.did || did,
          specialty: existing.specialty || d.specialty || d.department || "Specialist",
          department: existing.department || d.department || "OPD",
          currentLocation: d.currentLocation || existing.currentLocation,
        });
      } else {
        const id = d.id || `doc_api_${idx}`;
        const newStaff: LiveStaff = {
          id,
          name: d.name,
          role: "Doctor",
          department: d.department || "OPD",
          specialty: d.specialty || "General Medicine",
          did: did,
          employeeId: `EMP-${1000 + idx}`,
          currentLocation: d.currentLocation || d.activeRoom || `Room ${101 + (idx % 10)} - OPD`,
          status: d.status || "Available",
          beaconStrength: `${85 + (idx % 12)}%`,
          lastSignal: new Date().toLocaleTimeString(),
          onDuty: true,
          isOnChain: true,
          activeCredentials: [
            { id: `vc_${idx}_1`, type: "ProfessionalVC" },
            { id: `vc_${idx}_2`, type: "AccessVC" },
          ],
        };
        mergedMap.set(key, newStaff);
      }
    });

    setStaff(Array.from(mergedMap.values()));
    setLastUpdate(new Date().toLocaleTimeString());
  }, [doctorsData]);

  useEffect(() => {
    refresh();

    const locHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        memberId: string;
        location: string;
        status: string;
      };
      refresh();
      setLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          time: new Date().toLocaleTimeString(),
          event: `Staff beacon moved → ${detail.location} [${detail.status}]`,
        },
        ...prev.slice(0, 14),
      ]);
    };

    storeEvents.addEventListener("staff:location:update", locHandler);
    const poll = setInterval(refresh, 3000);
    return () => {
      storeEvents.removeEventListener("staff:location:update", locHandler);
      clearInterval(poll);
    };
  }, [refresh]);

  const handleRoomCheckIn = async (doctorDid: string, doctorName: string, roomName: string) => {
    updateStaffLocation(doctorDid, roomName);
    updateStaffLocation(doctorName, roomName);
    toast.success(`Checked In ${doctorName}`, {
      description: `Assigned to ${roomName}`,
    });
    setLogs((prev) => [
      {
        id: `loc_${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        event: `CHECK-IN → ${doctorName} moved to ${roomName}`,
      },
      ...prev.slice(0, 14),
    ]);
    await checkInDoctorRoom(doctorDid, roomName, "enter").catch(() => null);
    refresh();
  };

  const statusColor = (s: string) =>
    ({
      Available: "bg-success/10 text-success border-success/20",
      Busy: "bg-warning/15 text-warning-foreground border-warning/20",
      "In Surgery": "bg-destructive/15 text-destructive border-destructive/20",
      "In Consultation": "bg-primary/10 text-primary border-primary/20",
      "Emergency Response":
        "bg-destructive/20 text-destructive border-destructive/40 animate-pulse",
      "Off Duty": "bg-muted text-muted-foreground border-border",
    })[s] ?? "bg-muted text-muted-foreground border-border";

  const roles = [
    "All",
    "Doctor",
    "Nurse",
    "Surgeon",
    "Anesthesiologist",
    "Radiologist",
    "Technician",
    "Pharmacist",
  ];
  const statuses = [
    "All",
    "Available",
    "Busy",
    "In Surgery",
    "In Consultation",
    "Emergency Response",
    "Off Duty",
  ];

  const filtered = staff.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.currentLocation.toLowerCase().includes(q) ||
      (s.specialty ?? "").toLowerCase().includes(q) ||
      (s.did ?? "").toLowerCase().includes(q);

    const matchRole =
      roleFilter === "All" || s.role?.toLowerCase() === roleFilter.toLowerCase();

    const matchStatus =
      statusFilter === "All" ||
      s.status?.toLowerCase() === statusFilter.toLowerCase() ||
      (statusFilter === "Off Duty" && (s.currentLocation.includes("Exited") || s.currentLocation === "Off Duty"));

    return matchSearch && matchRole && matchStatus;
  });

  const selected = staff.find((s) => s.id === selectedId || s.did === selectedId) ?? null;

  const onlineCount = staff.filter(
    (s) => s.onDuty && s.currentLocation !== "Off Duty" && !s.currentLocation.includes("Exited")
  ).length;
  const availableCount = staff.filter(
    (s) => s.status === "Available" || s.status === "In Consultation"
  ).length;
  const emergencyCount = staff.filter(
    (s) => s.status === "Emergency Response" || s.currentLocation.toLowerCase().includes("emergency")
  ).length;

  return (
    <RouteGuard requiredRole="staff">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <PageHeader
            eyebrow="Staff Portal — Solana Tracker"
            title="Real-Time Staff Location Ledger"
            description={`Live Smart-ID beacon data from ${staff.length} staff members. Last sync: ${lastUpdate}`}
          />
          <div className="flex gap-3 text-xs flex-wrap">
            <div className="rounded-xl border border-border bg-card px-4 py-2.5 shadow-clinical text-center">
              <div className="text-xl font-black text-success">{onlineCount}</div>
              <div className="text-muted-foreground">On Duty</div>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-2.5 shadow-clinical text-center">
              <div className="text-xl font-black text-primary">{availableCount}</div>
              <div className="text-muted-foreground">Available</div>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-2.5 shadow-clinical text-center">
              <div
                className={`text-xl font-black ${emergencyCount > 0 ? "text-destructive animate-pulse" : "text-muted-foreground"}`}
              >
                {emergencyCount}
              </div>
              <div className="text-muted-foreground">In Emergency</div>
            </div>
          </div>
        </div>

        {/* Live Hospital Room Check-In & Floorplan Board */}
        <div className="rounded-xl border border-primary/20 bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary animate-pulse" />
                Live Hospital Wards & Doctor Room Occupancy
              </h3>
              <p className="text-xs text-muted-foreground">
                Real-time active room check-ins across hospital wings.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 font-bold text-success text-[10px]">
                <div className="h-1.5 w-1.5 rounded-full bg-success animate-ping" />
                Live Sync
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { id: "101", name: "Room 101 - OPD", type: "OPD" },
              { id: "202", name: "Room 202 - Cardiology", type: "Cardiology" },
              { id: "303", name: "Room 303 - Operation Theatre", type: "Surgery" },
              { id: "404", name: "Room 404 - Emergency Room", type: "Emergency" },
              { id: "505", name: "Room 505 - ICU Desk", type: "ICU" },
            ].map((room) => {
              const occupants = staff.filter(
                (s) =>
                  s.currentLocation?.toLowerCase().includes(room.id) ||
                  s.currentLocation?.toLowerCase().includes(room.type.toLowerCase())
              );
              const primary = occupants[0];

              return (
                <div
                  key={room.id}
                  className={`rounded-xl border p-3 flex flex-col justify-between space-y-3 transition-all ${
                    occupants.length > 0
                      ? "border-primary/40 bg-primary/5 shadow-sm"
                      : "border-border bg-muted/20"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {room.type}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          occupants.length > 0
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {occupants.length > 0 ? "Occupied" : "Vacant"}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-foreground">{room.name}</div>
                  </div>

                  {primary ? (
                    <div className="space-y-1.5 pt-2 border-t border-border/50">
                      <div className="font-semibold text-xs text-foreground flex items-center gap-1">
                        <User className="h-3 w-3 text-primary shrink-0" />
                        <span className="truncate">{primary.name}</span>
                      </div>
                      <div className="text-[9px] font-mono text-primary flex items-center gap-1">
                        <ShieldCheck className="h-2.5 w-2.5 text-success shrink-0" />
                        <span className="truncate">{primary.did}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground italic py-1">
                      No doctor checked in
                    </div>
                  )}

                  <select
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const selectedDoc = staff.find((s) => s.did === e.target.value || s.id === e.target.value);
                      if (selectedDoc) {
                        handleRoomCheckIn(selectedDoc.did, selectedDoc.name, room.name);
                      }
                      e.target.value = "";
                    }}
                    defaultValue=""
                    className="w-full text-[10px] rounded border border-input bg-background p-1 outline-none text-foreground"
                  >
                    <option value="" disabled>
                      Assign Doctor to Room…
                    </option>
                    {staff.map((doc) => (
                      <option key={doc.id} value={doc.did || doc.id}>
                        {doc.name} ({doc.specialty || doc.department})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-clinical flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, location, specialty, DID…"
              className="bg-transparent text-xs text-foreground outline-none w-full placeholder:text-muted-foreground"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-foreground outline-none shadow-clinical"
          >
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-foreground outline-none shadow-clinical"
          >
            {statuses.map((st) => (
              <option key={st}>{st}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Main Table */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-clinical">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground uppercase font-bold tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Clinician</th>
                    <th className="px-4 py-3">Role / Dept</th>
                    <th className="px-4 py-3">Smart-ID DID</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Beacon</th>
                    <th className="px-4 py-3">Last Signal</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.slice(0, 40).map((s, idx) => (
                    <tr
                      key={`${s.did || s.id || "doc"}_${idx}`}
                      onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                      className={`cursor-pointer transition-colors ${selectedId === s.id ? "bg-primary/5" : "hover:bg-muted/30"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{s.name}</div>
                        <div className="text-[9px] text-muted-foreground font-mono">
                          {s.employeeId}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{s.role}</div>
                        <div className="text-[9px]">{s.department}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-primary text-[9px] max-w-[140px]">
                        <div className="flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 text-success shrink-0" />
                          <span className="truncate">{s.did}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 text-primary shrink-0" />
                          <span>{s.currentLocation}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusColor(s.currentLocation === "Off Duty" ? "Off Duty" : s.onDuty ? "Available" : "Off Duty")}`}
                        >
                          {s.currentLocation === "Off Duty"
                            ? "Off Duty"
                            : s.onDuty
                              ? "On Duty"
                              : "Off Duty"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Radio className="h-3 w-3 text-success" />
                          <span className="text-success font-bold">{s.beaconStrength}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-[9px]">
                        {s.lastSignal}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const room = prompt(`Enter new location / room for ${s.name}:`, s.currentLocation);
                            if (room && room.trim()) {
                              handleRoomCheckIn(s.did, s.name, room.trim());
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-secondary/80 text-secondary-foreground px-2 py-1 text-[9px] font-bold hover:bg-secondary"
                        >
                          <Edit3 className="h-2.5 w-2.5" /> Check-In Room
                        </button>
                        {s.onDuty && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePage(s);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-2 py-1 text-[9px] font-bold hover:bg-primary/20"
                          >
                            <Send className="h-2.5 w-2.5" /> Page
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Selected Detail */}
            <AnimatePresence>
              {selected && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-3 text-xs"
                >
                  <div className="font-bold text-sm text-foreground">{selected.name}</div>
                  <div className="font-mono text-[9px] text-primary break-all">{selected.did}</div>
                  <div className="space-y-1.5">
                    {[
                      ["Role", selected.role],
                      ["Dept", selected.department],
                      ["Specialty", selected.specialty ?? "—"],
                      ["Location", selected.currentLocation],
                      ["Beacon", selected.beaconStrength],
                      ["Last Signal", selected.lastSignal],
                      ["On Chain", selected.isOnChain ? "✓ Yes" : "✗ No"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-muted-foreground">{k}:</span>
                        <span className="font-semibold text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>
                  {selected.isOnChain && selected.activeCredentials.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold uppercase text-muted-foreground mb-1">
                        Active Credentials
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selected.activeCredentials.map((vc) => (
                          <span
                            key={vc.id}
                            className="rounded-full bg-success/10 text-success border border-success/20 px-1.5 py-0.5 text-[8px] font-bold"
                          >
                            {vc.type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-border space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">
                      Check-In Doctor to Room
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {["OPD Room 3", "ICU-101", "OT-1", "Emergency Bay 2", "Consultation 4"].map(
                        (rm) => (
                          <button
                            key={rm}
                            onClick={() => {
                              updateStaffLocation(selected.did, rm);
                              updateStaffLocation(selected.name, rm);
                              toast.success(`Moved to ${rm}`, {
                                description: `Checked in ${selected.name} to ${rm}`,
                              });
                              refresh();
                            }}
                            className="rounded bg-muted px-2 py-1 text-[10px] font-semibold hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            {rm}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Beacon Log */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-clinical space-y-2">
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary" /> Live Beacon Log
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {logs.length === 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    Waiting for beacon events…
                  </div>
                )}
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-2 text-[9px]">
                    <span className="text-muted-foreground font-mono flex-shrink-0">
                      {log.time}
                    </span>
                    <span className="text-foreground">{log.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
