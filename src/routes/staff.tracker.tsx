import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { getLiveStaff, storeEvents, type LiveStaff } from "@/lib/realtime-store";
import { submitHyperledgerTransaction } from "@/lib/hyperledger";
import { MapPin, ShieldAlert, Phone, Clock, Radio, Search, Filter, Send, Activity, Users, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/tracker")({
  head: () => ({ meta: [{ title: "Doctor Locator — Staff Portal" }] }),
  component: DoctorLocatorPage,
});

function DoctorLocatorPage() {
  const [staff, setStaff] = useState<LiveStaff[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [logs, setLogs] = useState<{ id: string; time: string; event: string }[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());

  const refresh = useCallback(() => {
    const data = getLiveStaff();
    setStaff(data);
    setLastUpdate(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    refresh();

    const locHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { memberId: string; location: string; status: string };
      refresh();
      setLogs((prev) => [
        { id: `log_${Date.now()}`, time: new Date().toLocaleTimeString(), event: `Staff beacon moved → ${detail.location} [${detail.status}]` },
        ...prev.slice(0, 14),
      ]);
    };

    storeEvents.addEventListener("staff:location:update", locHandler);
    const poll = setInterval(refresh, 5000);
    return () => {
      storeEvents.removeEventListener("staff:location:update", locHandler);
      clearInterval(poll);
    };
  }, [refresh]);

  const handlePage = async (member: LiveStaff) => {
    toast.success("Pager dispatched", { description: `${member.name} at ${member.currentLocation}` });
    await submitHyperledgerTransaction("tracker-chaincode", "dispatchPagerNotify", [
      member.did, member.name, member.currentLocation,
    ], { silent: true });
    setLogs((prev) => [
      { id: `page_${Date.now()}`, time: new Date().toLocaleTimeString(), event: `PAGER → ${member.name} at ${member.currentLocation}` },
      ...prev.slice(0, 14),
    ]);
  };

  const statusColor = (s: string) => ({
    "Available": "bg-success/10 text-success border-success/20",
    "Busy": "bg-warning/15 text-warning-foreground border-warning/20",
    "In Surgery": "bg-destructive/15 text-destructive border-destructive/20",
    "In Consultation": "bg-primary/10 text-primary border-primary/20",
    "Emergency Response": "bg-destructive/20 text-destructive border-destructive/40 animate-pulse",
    "Off Duty": "bg-muted text-muted-foreground border-border",
  }[s] ?? "bg-muted text-muted-foreground border-border");

  const roles = ["All", "Doctor", "Nurse", "Surgeon", "Anesthesiologist", "Radiologist", "Technician", "Pharmacist"];
  const statuses = ["All", "Available", "Busy", "In Surgery", "In Consultation", "Emergency Response", "Off Duty"];

  const filtered = staff.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.currentLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.specialty ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = roleFilter === "All" || s.role === roleFilter;
    const matchStatus = statusFilter === "All" || s.currentLocation === "Off Duty" ? statusFilter === "All" || statusFilter === "Off Duty" : true;
    return matchSearch && matchRole;
  });

  const selected = staff.find((s) => s.id === selectedId) ?? null;

  const onlineCount = staff.filter((s) => s.onDuty).length;
  const availableCount = staff.filter((s) => s.currentLocation !== "Off Duty" && s.onDuty).length;
  const emergencyCount = staff.filter((s) => s.currentLocation === "Emergency Ward").length;

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
              <div className={`text-xl font-black ${emergencyCount > 0 ? "text-destructive animate-pulse" : "text-muted-foreground"}`}>{emergencyCount}</div>
              <div className="text-muted-foreground">In Emergency</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-clinical flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, location, specialty…"
              className="bg-transparent text-xs text-foreground outline-none w-full placeholder:text-muted-foreground" />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-foreground outline-none shadow-clinical">
            {roles.map((r) => <option key={r}>{r}</option>)}
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
                  {filtered.slice(0, 40).map((s) => (
                    <tr key={s.id}
                      onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                      className={`cursor-pointer transition-colors ${selectedId === s.id ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{s.name}</div>
                        <div className="text-[9px] text-muted-foreground font-mono">{s.employeeId}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{s.role}</div>
                        <div className="text-[9px]">{s.department}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-primary text-[9px] max-w-[120px] truncate">{s.did}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{s.currentLocation}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusColor(s.currentLocation === "Off Duty" ? "Off Duty" : s.onDuty ? "Available" : "Off Duty")}`}>
                          {s.currentLocation === "Off Duty" ? "Off Duty" : s.onDuty ? "On Duty" : "Off Duty"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Radio className="h-3 w-3 text-success" />
                          <span className="text-success font-bold">{s.beaconStrength}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-[9px]">{s.lastSignal}</td>
                      <td className="px-4 py-3 text-right">
                        {s.onDuty && (
                          <button onClick={(e) => { e.stopPropagation(); handlePage(s); }}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-2 py-1 text-[9px] font-bold hover:bg-primary/20">
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
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-3 text-xs">
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
                      <div className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Active Credentials</div>
                      <div className="flex flex-wrap gap-1">
                        {selected.activeCredentials.map((vc) => (
                          <span key={vc.id} className="rounded-full bg-success/10 text-success border border-success/20 px-1.5 py-0.5 text-[8px] font-bold">
                            {vc.type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Beacon Log */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-clinical space-y-2">
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary" /> Live Beacon Log
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {logs.length === 0 && <div className="text-[10px] text-muted-foreground">Waiting for beacon events…</div>}
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-2 text-[9px]">
                    <span className="text-muted-foreground font-mono flex-shrink-0">{log.time}</span>
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
