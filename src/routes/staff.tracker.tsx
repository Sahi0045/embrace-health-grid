import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { MapPin, ShieldAlert, Phone, Clock, MessageSquare, AlertTriangle, Users, Award, Radio, Search, Filter, RefreshCw, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/tracker")({
  head: () => ({ meta: [{ title: "Doctor Locator — Staff Portal" }] }),
  component: DoctorLocatorPage,
});

interface DoctorLocation {
  id: string;
  name: string;
  specialty: string;
  didCard: string;
  status: "Available" | "Busy" | "In Surgery" | "In Consultation" | "Emergency Response" | "Off Duty";
  location: "OPD Room 3" | "ICU Block B" | "Emergency Ward" | "Operation Theatre 2" | "Consultation Room 5" | "Cafeteria" | "Conference Room 1" | "Off Duty";
  lastSignal: string;
}

const initialDoctors: DoctorLocation[] = [
  { id: "d1", name: "Dr. Ravi Menon", specialty: "Cardiology", didCard: "did:smart:0x88f1", status: "Available", location: "ICU Block B", lastSignal: "12:15:02 AM" },
  { id: "d2", name: "Dr. Sameer Khan", specialty: "General Medicine", didCard: "did:smart:0x99a2", status: "In Consultation", location: "OPD Room 3", lastSignal: "12:14:48 AM" },
  { id: "d3", name: "Dr. Aanya Verma", specialty: "Radiology", didCard: "did:smart:0x221b", status: "Busy", location: "Consultation Room 5", lastSignal: "12:13:59 AM" },
  { id: "d4", name: "Dr. Priya Nair", specialty: "Emergency Medicine", didCard: "did:smart:0x77c4", status: "Emergency Response", location: "Emergency Ward", lastSignal: "12:16:10 AM" },
  { id: "d5", name: "Dr. Kiran Bose", specialty: "Pediatrics", didCard: "did:smart:0xdd45", status: "In Surgery", location: "Operation Theatre 2", lastSignal: "12:11:34 AM" },
  { id: "d6", name: "Dr. Sameer Patel", specialty: "Anesthesiology", didCard: "did:smart:0xaa18", status: "Off Duty", location: "Off Duty", lastSignal: "11:58:20 PM" }
];

const mockLogs = [
  { id: "l1", time: "12:16:10 AM", event: "Dr. Priya Nair entered Emergency Ward (Smart ID Card Signal: High)" },
  { id: "l2", time: "12:15:02 AM", event: "Dr. Ravi Menon entered ICU Block B (Signal Strength: Stable)" },
  { id: "l3", time: "12:14:48 AM", event: "Dr. Sameer Khan entered OPD Room 3" },
  { id: "l4", time: "12:11:34 AM", event: "Dr. Kiran Bose entered Operation Theatre 2" }
];

function DoctorLocatorPage() {
  const [doctors, setDoctors] = useState<DoctorLocation[]>(initialDoctors);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [logs, setLogs] = useState(mockLogs);

  // Simulate active movement periodically
  useEffect(() => {
    const timer = setInterval(() => {
      setDoctors((prevDocs) => {
        // Pick one doctor to move
        const movingDocIdx = Math.floor(Math.random() * prevDocs.length);
        const doc = prevDocs[movingDocIdx];
        
        if (doc.status === "Off Duty") return prevDocs;

        const rooms: DoctorLocation["location"][] = [
          "OPD Room 3", "ICU Block B", "Emergency Ward", "Operation Theatre 2", 
          "Consultation Room 5", "Cafeteria", "Conference Room 1"
        ];
        const newRoom = rooms[Math.floor(Math.random() * rooms.length)];
        
        // Skip if same room
        if (newRoom === doc.location) return prevDocs;

        const statuses: DoctorLocation["status"][] = ["Available", "Busy", "In Consultation", "Emergency Response"];
        const newStatus = newRoom === "Operation Theatre 2" ? "In Surgery" : statuses[Math.floor(Math.random() * statuses.length)];
        const timeStr = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });

        // Add to log ticker
        setLogs((prevLogs) => [
          { id: `l_${Date.now()}`, time: timeStr, event: `${doc.name} moved to ${newRoom} (Smart ID Card: Beacon updated)` },
          ...prevLogs.slice(0, 10)
        ]);

        toast.info(`Beacon Update: ${doc.name}`, {
          description: `Location changed to ${newRoom}`,
        });

        return prevDocs.map((d, idx) => {
          if (idx === movingDocIdx) {
            return {
              ...d,
              location: newRoom,
              status: newStatus,
              lastSignal: timeStr
            };
          }
          return d;
        });
      });
    }, 12000); // update every 12 seconds

    return () => clearInterval(timer);
  }, []);

  const handleLocateAndNotify = (doc: DoctorLocation) => {
    toast.success(`Pager notification dispatched`, {
      description: `Locate request forwarded to ${doc.name}'s Smart ID Card at ${doc.location}.`,
    });
  };

  const getStatusColor = (status: DoctorLocation["status"]) => {
    switch (status) {
      case "Available": return "bg-success/10 text-success border-success/20";
      case "Busy": return "bg-warning/15 text-warning-foreground border-warning/20";
      case "In Surgery": return "bg-destructive/15 text-destructive border-destructive/20";
      case "In Consultation": return "bg-primary/10 text-primary border-primary/20";
      case "Emergency Response": return "bg-destructive/20 text-destructive border-destructive/40 animate-pulse";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const selectedDoc = doctors.find((d) => d.id === selectedDocId) || null;

  const specialties = ["All", "Cardiology", "General Medicine", "Radiology", "Emergency Medicine", "Pediatrics", "Anesthesiology"];

  const filteredDoctors = doctors.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          doc.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialty = specialtyFilter === "All" || doc.specialty === specialtyFilter;
    const matchesStatus = statusFilter === "All" || 
                          (statusFilter === "On-Duty" && doc.status !== "Off Duty") ||
                          (statusFilter === "Off-Duty" && doc.status === "Off Duty");
    
    return matchesSearch && matchesSpecialty && matchesStatus;
  });

  return (
    <RouteGuard requiredRole="staff">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        
        <PageHeader
          eyebrow="Staff Portal"
          title="Smart ID Doctor locator Ledger"
          description="Cryptographic staff tracking, real-time availability logs, and direct pager notification tools."
        />

        {/* Status Counters row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Active Doctors On-Duty", value: doctors.filter(d => d.status !== "Off Duty").length, color: "text-primary bg-primary/10" },
            { label: "Available for Triage", value: doctors.filter(d => d.status === "Available").length, color: "text-success bg-success/10" },
            { label: "In Active Surgery / OT", value: doctors.filter(d => d.status === "In Surgery").length, color: "text-destructive bg-destructive/10" },
            { label: "Emergency Responders", value: doctors.filter(d => d.status === "Emergency Response").length, color: "text-destructive bg-destructive/15 animate-pulse" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-4 text-center ${s.color}`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs font-medium mt-0.5 opacity-80">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          
          {/* Main Table View */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Search & Filter Controls */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-clinical flex flex-col gap-3 md:flex-row md:items-center justify-between">
              
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 flex-1 max-w-md">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search doctor, specialty, room..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <Filter className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Specialty</span>
                </div>
                <select
                  value={specialtyFilter}
                  onChange={(e) => setSpecialtyFilter(e.target.value)}
                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground outline-none"
                >
                  {specialties.map(spec => <option key={spec} value={spec}>{spec}</option>)}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="On-Duty">On Duty Only</option>
                  <option value="Off-Duty">Off Duty Only</option>
                </select>

                <button
                  onClick={() => { setDoctors(initialDoctors); setSearchQuery(""); setSpecialtyFilter("All"); setStatusFilter("All"); toast.success("Ledger refreshed"); }}
                  className="rounded-lg border border-border bg-card p-1.5 hover:bg-muted text-muted-foreground"
                  title="Reset Filters"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

            </div>

            {/* Doctor Location Table */}
            <div className="rounded-xl border border-border bg-card shadow-clinical overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Doctor</th>
                    <th className="px-4 py-3">Specialty</th>
                    <th className="px-4 py-3">Smart ID DID</th>
                    <th className="px-4 py-3">Current Location</th>
                    <th className="px-4 py-3">Availability Status</th>
                    <th className="px-4 py-3">Last Ping</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDoctors.map((doc) => {
                    const isSelected = selectedDocId === doc.id;
                    return (
                      <tr 
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={`hover:bg-muted/30 cursor-pointer transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-foreground">{doc.name}</div>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">{doc.specialty}</td>
                        <td className="px-4 py-3.5 font-mono text-[10px] text-muted-foreground">{doc.didCard}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-primary" />
                            <span className="font-semibold text-foreground">{doc.location}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${getStatusColor(doc.status)}`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-muted-foreground">{doc.lastSignal}</td>
                        <td className="px-4 py-3.5 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleLocateAndNotify(doc)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/25 transition-colors"
                            title="Direct Call Pager"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              toast.error(`Trauma Code Blue Triggered`, {
                                description: `Direct alert transmitted to ${doc.name}'s wristband at ${doc.location}.`
                              });
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                            title="Emergency Code Dispatch"
                          >
                            <ShieldAlert className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredDoctors.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-2 opacity-35" />
                        No doctors match the search parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Movement Ticker Logs */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Clock className="h-4.5 w-4.5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Smart ID beacon Signal Stream</h3>
              </div>
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-3 text-xs items-start rounded-lg bg-muted/40 p-2.5 border border-border">
                    <span className="font-mono font-semibold text-primary">{log.time}</span>
                    <p className="text-foreground/80">{log.event}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Details side panel */}
          <div className="space-y-6">
            
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Radio className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Smart card telemetry</h3>
              </div>

              {selectedDoc ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Clinician</span>
                    <div className="text-sm font-bold text-foreground mt-0.5">{selectedDoc.name}</div>
                    <div className="text-xs text-muted-foreground">{selectedDoc.specialty}</div>
                  </div>

                  <div className="space-y-2 border-t border-border pt-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cryptographic DID:</span>
                      <span className="font-mono text-foreground">{selectedDoc.didCard}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location beacon:</span>
                      <span className="font-semibold text-foreground">{selectedDoc.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ping quality:</span>
                      <span className="font-semibold text-success flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-success animate-pulse" /> 98% (Excellent)
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3 space-y-2">
                    <button
                      onClick={() => handleLocateAndNotify(selectedDoc)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      <Send className="h-3.5 w-3.5" /> Direct Call Pager
                    </button>
                    <button
                      onClick={() => {
                        toast.error(`Emergency consult requested`, { description: `Dispatched to ${selectedDoc.name} at ${selectedDoc.location}` });
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive py-2 text-xs font-bold hover:bg-destructive/10"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" /> Dispatch Emergency
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground text-xs">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Select a doctor from the ledger table to view Smart ID telemetry logs.
                </div>
              )}
            </div>

            {/* Quick Actions Panel */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-3">
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Crisis Triage Dispatches</span>
              <button
                onClick={() => {
                  toast.error("Code Blue Alert Broadcasted", { description: "Paging Cardiology and ER teams immediately." });
                }}
                className="w-full flex items-center justify-between rounded-lg border border-destructive bg-destructive/10 p-3 hover:bg-destructive/15 transition-all text-xs font-bold text-destructive"
              >
                <span>Code Blue (ICU Suite)</span>
                <ShieldAlert className="h-4 w-4" />
              </button>
              
              <button
                onClick={() => {
                  toast.error("Code Red (Trauma ER Alert) Broadcasted", { description: "Paging Surgery and Anesthesia on-duty staff." });
                }}
                className="w-full flex items-center justify-between rounded-lg border border-warning bg-warning/10 p-3 hover:bg-warning/15 transition-all text-xs font-bold text-warning-foreground"
              >
                <span>Code Red (ER Trauma)</span>
                <AlertTriangle className="h-4 w-4" />
              </button>
            </div>

          </div>

        </div>

      </div>
    </RouteGuard>
  );
}
