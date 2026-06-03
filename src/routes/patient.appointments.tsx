import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { appointments } from "@/lib/mock-data";
import {
  CalendarDays, Video, MapPin, Plus, ChevronRight, Check, X, Search,
  AlertTriangle, Phone, Mail, MessageSquare, Pill, ClipboardList,
  FlaskConical, User, ShieldAlert, HeartPulse, Clock, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { RouteGuard } from "@/components/RouteGuard";
import { submitHyperledgerTransaction } from "@/lib/hyperledger";

export const Route = createFileRoute("/patient/appointments")({
  head: () => ({ meta: [{ title: "Patient · Appointments — DID Hospital" }] }),
  component: AppointmentsPage,
});

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  did: string;
  hospital: string;
  status: "Available" | "Busy" | "Off Duty";
  rating: number;
  availableDays: {
    day: string;
    date: string;
    slots: string[];
  }[];
}

const mockDoctors: Doctor[] = [
  {
    id: "doc1",
    name: "Dr. Ravi Menon",
    specialty: "Cardiology",
    did: "did:hosp:0xd103…99aa",
    hospital: "Apollo Hospitals · OPD-3",
    status: "Available",
    rating: 4.9,
    availableDays: [
      { day: "Thu", date: "2026-06-04", slots: ["10:30 AM", "11:00 AM", "02:00 PM"] },
      { day: "Fri", date: "2026-06-05", slots: ["09:00 AM", "10:00 AM", "03:30 PM"] }
    ]
  },
  {
    id: "doc2",
    name: "Dr. Sameer Khan",
    specialty: "General Medicine",
    did: "did:hosp:0x34bd…12ef",
    hospital: "Apollo Hospitals · OPD-2",
    status: "Busy",
    rating: 4.8,
    availableDays: [
      { day: "Thu", date: "2026-06-04", slots: ["09:30 AM", "11:30 AM", "03:00 PM"] },
      { day: "Fri", date: "2026-06-05", slots: ["08:30 AM", "01:00 PM", "04:30 PM"] }
    ]
  },
  {
    id: "doc3",
    name: "Dr. Aanya Verma",
    specialty: "Radiology",
    did: "did:hosp:0x55ef…7711",
    hospital: "Apollo Hospitals · Diagnostics Block",
    status: "Available",
    rating: 4.9,
    availableDays: [
      { day: "Fri", date: "2026-06-05", slots: ["10:00 AM", "11:30 AM", "02:30 PM", "04:15 PM"] },
      { day: "Sat", date: "2026-06-06", slots: ["09:00 AM", "11:00 AM"] }
    ]
  },
  {
    id: "doc4",
    name: "Dr. Priya Nair",
    specialty: "Emergency Medicine",
    did: "did:hosp:0x88ea…029a",
    hospital: "Apollo Hospitals · Trauma ER",
    status: "Available",
    rating: 5.0,
    availableDays: [
      { day: "Thu", date: "2026-06-04", slots: ["08:00 AM", "12:00 PM", "04:00 PM", "08:00 PM"] }
    ]
  },
  {
    id: "doc5",
    name: "Dr. Kiran Bose",
    specialty: "Pediatrics",
    did: "did:hosp:0x77aa…bb21",
    hospital: "Apollo Hospitals · Pediatrics Wing",
    status: "Off Duty",
    rating: 4.7,
    availableDays: [
      { day: "Mon", date: "2026-06-08", slots: ["09:00 AM", "10:30 AM", "02:00 PM"] }
    ]
  }
];

const medicalHistory = [
  { id: "h1", date: "2026-05-18", condition: "Type 2 Diabetes Checkup", doctor: "Dr. Sameer Khan", status: "Controlled" },
  { id: "h2", date: "2026-04-12", condition: "Routine Cardiac Echo", doctor: "Dr. Ravi Menon", status: "Healthy Ejection Fraction" }
];

const currentMedications = [
  { id: "m1", name: "Metoprolol 50mg", frequency: "Once daily (Morning)", purpose: "Hypertension" },
  { id: "m2", name: "Metformin 1000mg", frequency: "Twice daily (With meals)", purpose: "Type 2 Diabetes" }
];

const recentLabReports = [
  { id: "l1", date: "2026-05-20", test: "HbA1c Glycated Hemoglobin", result: "6.4%", status: "Optimal" },
  { id: "l2", date: "2026-04-12", test: "Lipid Profile Panel", result: "LDL 92 mg/dL", status: "Desirable" }
];

function AppointmentsPage() {
  const [list, setList] = useState(appointments);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  
  // Booking flow state
  const [selectedDoc, setSelectedDoc] = useState<Doctor | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [consultMode, setConsultMode] = useState<"in-person" | "tele">("in-person");
  
  // Simulated Notification modal state
  const [notificationPreview, setNotificationPreview] = useState<{
    show: boolean;
    channels: { sms: boolean; email: boolean; whatsapp: boolean };
    message: string;
  }>({
    show: false,
    channels: { sms: true, email: true, whatsapp: true },
    message: "",
  });

  // Telehealth video call simulator state
  const [activeCall, setActiveCall] = useState<{
    id: string;
    doctorName: string;
    active: boolean;
  } | null>(null);

  // Emergency modal state
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  const upcoming = list.filter((a) => a.status === "upcoming");
  const past = list.filter((a) => a.status !== "upcoming");

  const specialties = ["All", "Cardiology", "General Medicine", "Radiology", "Emergency Medicine", "Pediatrics"];

  const filteredDoctors = mockDoctors.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          doc.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialty = selectedSpecialty === "All" || doc.specialty === selectedSpecialty;
    return matchesSearch && matchesSpecialty;
  });

  const triggerMockNotifications = (doctorName: string, date: string, time: string, mode: string) => {
    const formattedDate = new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    const msg = `Appointment Confirmed! Date: ${formattedDate} at ${time}. Doctor: ${doctorName} (${mode === "tele" ? "Telehealth" : "In-Person"}). Check-in details: did:hosp:0x4a91…b7d2`;
    setNotificationPreview({
      show: true,
      channels: { sms: true, email: true, whatsapp: true },
      message: msg,
    });
  };

  const confirmBooking = () => {
    if (!selectedDoc || !selectedDay || !selectedSlot) return;
    
    const id = `ap${Date.now()}`;
    const newAppointment = {
      id,
      doctor: selectedDoc.name,
      specialty: selectedDoc.specialty,
      hospital: consultMode === "tele" ? "Telehealth Link" : selectedDoc.hospital,
      date: selectedDay,
      time: `${new Date(selectedDay).toLocaleDateString("en-IN", { weekday: "short" })} · ${selectedSlot}`,
      status: "upcoming" as const,
      mode: consultMode,
    };

    setList((prev) => [newAppointment, ...prev]);
    toast.success("Appointment booked", { description: `${selectedDay} at ${selectedSlot}` });
    triggerMockNotifications(selectedDoc.name, selectedDay, selectedSlot, consultMode);
    
    // Invoke Hyperledger simulation chaincode
    submitHyperledgerTransaction("appointments-chaincode", "createAppointment", [
      selectedDoc.name,
      selectedDay,
      selectedSlot,
      consultMode
    ]);

    // reset state
    setSelectedDoc(null);
    setSelectedDay(null);
    setSelectedSlot(null);
  };

  const triggerEmergencyBooking = () => {
    const erDoc = mockDoctors.find(d => d.specialty === "Emergency Medicine") || mockDoctors[0];
    const id = `ap_er_${Date.now()}`;
    const emergencyAppointment = {
      id,
      doctor: erDoc.name,
      specialty: "ER / Triage Urgent Consult",
      hospital: "Apollo Hospitals · Emergency Ward Trauma ER",
      date: new Date().toISOString().split("T")[0],
      time: "Immediate Triage Priority",
      status: "upcoming" as const,
      mode: "in-person" as const,
    };

    setList((prev) => [emergencyAppointment, ...prev]);
    toast.error("Emergency consult requested", { description: "Report to ER Desk immediately." });
    
    // Invoke Hyperledger simulation chaincode
    submitHyperledgerTransaction("appointments-chaincode", "requestEmergencyTriage", [
      erDoc.name,
      "Trauma Room"
    ]);

    triggerMockNotifications(erDoc.name, new Date().toISOString().split("T")[0], "IMMEDIATE", "in-person");
    setShowEmergencyModal(false);
  };

  const cancel = (id: string) => {
    setList((prev) => prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)));
    toast("Appointment cancelled");

    // Invoke Hyperledger simulation chaincode
    submitHyperledgerTransaction("appointments-chaincode", "cancelAppointment", [id]);
  };

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-4">
          <PageHeader
            eyebrow="Patient app"
            title="Consultation & Visits"
            description="Manage appointments, check doctor availability, and launch telehealth consultation"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmergencyModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 shadow-clinical active:scale-95 transition-all"
            >
              <ShieldAlert className="h-4 w-4" />
              Emergency Request
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Column 1 & 2: Main Booking & Appointment Cards */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Quick Specialization Filters */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-clinical space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Find Doctor Availability</span>
                <span className="text-xs text-muted-foreground">{filteredDoctors.length} doctors found</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search doctor or specialty..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {specialties.map((spec) => (
                  <button
                    key={spec}
                    onClick={() => setSelectedSpecialty(spec)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${selectedSpecialty === spec ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-muted"}`}
                  >
                    {spec}
                  </button>
                ))}
              </div>
            </div>

            {/* Doctor Listing Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredDoctors.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-border bg-card p-4 shadow-clinical flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-primary uppercase tracking-wide">{doc.specialty}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${doc.status === "Available" ? "bg-success/15 text-success" : doc.status === "Busy" ? "bg-warning/15 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${doc.status === "Available" ? "bg-success" : doc.status === "Busy" ? "bg-warning" : "bg-muted-foreground"}`} />
                        {doc.status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-foreground mt-1">{doc.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{doc.did}</p>
                    <p className="text-xs text-muted-foreground mt-1">{doc.hospital}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs font-semibold text-yellow-500">★ {doc.rating} Rating</span>
                    <button
                      onClick={() => {
                        setSelectedDoc(doc);
                        setSelectedDay(doc.availableDays[0]?.date || null);
                        setSelectedSlot(null);
                      }}
                      className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/25 transition-colors"
                    >
                      Book Consultation
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Appointments List */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Active Booked Consultations ({upcoming.length})
              </h2>

              {upcoming.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No upcoming visits"
                  description="Use the filters above to browse available doctors and book your next appointment."
                />
              ) : (
                <StaggerList className="grid gap-4 sm:grid-cols-2">
                  {upcoming.map((a) => (
                    <StaggerItem key={a.id}>
                      <div className="rounded-xl border border-border bg-card p-4 shadow-clinical hover:border-primary/40 transition-all">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold text-foreground">{a.doctor}</div>
                            <div className="text-xs text-muted-foreground">{a.specialty}</div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            {a.mode === "tele" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                            {a.mode === "tele" ? "Telemedicine" : "In-Person"}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-sm text-foreground">
                          <Clock className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{a.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{a.hospital}</p>
                        
                        <div className="mt-4 flex gap-2 border-t border-border pt-3">
                          <button
                            onClick={() => cancel(a.id)}
                            className="flex-1 rounded-lg border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-muted"
                          >
                            Cancel Visit
                          </button>
                          {a.mode === "tele" ? (
                            <button
                              onClick={() => setActiveCall({ id: a.id, doctorName: a.doctor, active: true })}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-success text-success-foreground py-2 text-xs font-bold hover:bg-success/90"
                            >
                              <Video className="h-3.5 w-3.5" /> Launch Telehealth
                            </button>
                          ) : (
                            <Link
                              to="/patient/qr"
                              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                            >
                              Check-in QR
                            </Link>
                          )}
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerList>
              )}
            </div>

            {/* Past Visits */}
            {past.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Previous Consultation History</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {past.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                      <div>
                        <div className="font-medium text-foreground">{a.doctor}</div>
                        <div className="text-xs text-muted-foreground">{a.time} · {a.specialty}</div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${a.status === "cancelled" ? "text-destructive" : "text-success"}`}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Column 3: Patient Health Profile Dashboard */}
          <div className="space-y-6">
            
            {/* Quick Profile Summary Card */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <User className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Patient Health Records Overview</h3>
              </div>
              
              {/* Medical History */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Conditions & Medical History</span>
                <div className="space-y-1.5">
                  {medicalHistory.map((item) => (
                    <div key={item.id} className="rounded-lg bg-muted/60 p-2 text-xs border border-border">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-foreground">{item.condition}</span>
                        <span className="text-[10px] text-muted-foreground">{item.date}</span>
                      </div>
                      <div className="text-muted-foreground mt-0.5">Primary physician: {item.doctor}</div>
                      <div className="mt-1 font-medium text-primary text-[10px]">Result: {item.status}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Current Medications */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block flex items-center gap-1">
                  <Pill className="h-3 w-3 text-primary" /> Current Medications
                </span>
                <div className="space-y-1.5">
                  {currentMedications.map((med) => (
                    <div key={med.id} className="flex justify-between items-center rounded-lg bg-primary/5 p-2 text-xs border border-primary/20">
                      <div>
                        <div className="font-semibold text-foreground">{med.name}</div>
                        <div className="text-[10px] text-muted-foreground">{med.frequency}</div>
                      </div>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">{med.purpose}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Lab Reports */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block flex items-center gap-1">
                  <FlaskConical className="h-3 w-3 text-primary" /> Recent Lab Reports
                </span>
                <div className="space-y-1.5">
                  {recentLabReports.map((lab) => (
                    <div key={lab.id} className="rounded-lg bg-muted/60 p-2 text-xs border border-border flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-foreground">{lab.test}</div>
                        <div className="text-[9px] text-muted-foreground">{lab.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground">{lab.result}</div>
                        <span className="text-[9px] text-success font-semibold">{lab.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/patient/records"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <ClipboardList className="h-3.5 w-3.5 text-primary" />
                  View Complete Medical File
                </Link>
              </div>

            </div>

            {/* Notification Reminders simulator */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Multi-Channel Reminder settings</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Automated reminders trigger on bookings, reschedules, and health events.
              </p>
              
              <div className="space-y-3">
                {[
                  { id: "whatsapp", label: "WhatsApp Alerts", icon: MessageSquare, desc: "Send rich media templates" },
                  { id: "sms", label: "SMS Notifications", icon: Phone, desc: "Immediate offline alerts" },
                  { id: "email", label: "Email Summaries", icon: Mail, desc: "Detailed PDF invoices + links" }
                ].map((item) => (
                  <div key={item.id} className="flex items-start justify-between">
                    <div className="flex gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground">{item.label}</div>
                        <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                      </div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationPreview.channels[item.id as keyof typeof notificationPreview.channels]}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setNotificationPreview(prev => ({
                            ...prev,
                            channels: { ...prev.channels, [item.id]: val }
                          }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Booking Calendar Modal */}
      <AnimatePresence>
        {selectedDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 backdrop-blur-sm p-4"
            onClick={() => setSelectedDoc(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-clinical-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">Schedule Consultation</h3>
                  <p className="text-xs text-muted-foreground">{selectedDoc.name} · {selectedDoc.specialty}</p>
                </div>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                
                {/* Consultation Mode Selection */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Consultation Type</label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConsultMode("in-person")}
                      className={`flex flex-col items-center gap-1 rounded-xl p-3 border text-center transition-all ${consultMode === "in-person" ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted text-muted-foreground"}`}
                    >
                      <MapPin className="h-5 w-5" />
                      <span className="text-xs font-semibold">OPD In-Person</span>
                      <span className="text-[10px] opacity-75">{selectedDoc.hospital}</span>
                    </button>
                    <button
                      onClick={() => setConsultMode("tele")}
                      className={`flex flex-col items-center gap-1 rounded-xl p-3 border text-center transition-all ${consultMode === "tele" ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted text-muted-foreground"}`}
                    >
                      <Video className="h-5 w-5" />
                      <span className="text-xs font-semibold">Telehealth Video</span>
                      <span className="text-[10px] opacity-75">Join secure browser link</span>
                    </button>
                  </div>
                </div>

                {/* Day Selection */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Select Date</label>
                  <div className="mt-1.5 flex gap-2">
                    {selectedDoc.availableDays.map((d) => (
                      <button
                        key={d.date}
                        onClick={() => { setSelectedDay(d.date); setSelectedSlot(null); }}
                        className={`flex-1 flex flex-col items-center p-2 rounded-lg border text-center transition-all ${selectedDay === d.date ? "border-primary bg-primary/5 text-primary font-bold" : "border-border hover:bg-muted text-muted-foreground"}`}
                      >
                        <span className="text-[10px] uppercase font-bold">{d.day}</span>
                        <span className="text-sm">{new Date(d.date).getDate()}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slot Selection */}
                {selectedDay && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Available Slots</label>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      {selectedDoc.availableDays.find(d => d.date === selectedDay)?.slots.map((s) => (
                        <button
                          key={s}
                          onClick={() => setSelectedSlot(s)}
                          className={`p-2 rounded-lg border text-xs font-medium text-center transition-all ${selectedSlot === s ? "bg-primary text-primary-foreground border-primary shadow-clinical" : "border-border hover:bg-muted text-foreground"}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              <div className="mt-6 flex gap-2 border-t border-border pt-4">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBooking}
                  disabled={!selectedDay || !selectedSlot}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  Confirm Appointment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency Request Modal */}
      <AnimatePresence>
        {showEmergencyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-destructive-foreground/45 backdrop-blur-sm p-4"
            onClick={() => setShowEmergencyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border-2 border-destructive bg-card p-6 shadow-clinical-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive animate-pulse">
                  <ShieldAlert className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Request Emergency Consult?</h3>
                <p className="text-xs text-muted-foreground px-4">
                  This issues an immediate trauma-level triage request and assigns the next available ER physician. Use only for clinical emergencies.
                </p>
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setShowEmergencyModal(false)}
                  className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={triggerEmergencyBooking}
                  className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground hover:bg-destructive/95"
                >
                  Confirm Emergency Triage
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Telehealth Call Simulator Modal */}
      <AnimatePresence>
        {activeCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-between p-6"
          >
            <div className="flex items-center justify-between text-white">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="text-sm font-bold">Secure Telehealth Session</span>
                </div>
                <div className="text-xs text-muted-foreground">DID Verification: OK</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{activeCall.doctorName}</div>
                <div className="text-xs text-muted-foreground">Consulting Room 2</div>
              </div>
            </div>

            {/* Video Viewport Mockup */}
            <div className="flex-1 my-6 rounded-2xl bg-muted/10 border border-white/10 overflow-hidden relative flex items-center justify-center">
              
              {/* Main Doctor Screen */}
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                <div className="h-28 w-28 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-primary">
                  <User className="h-14 w-14" />
                </div>
                <div className="text-white text-sm font-medium animate-pulse">Connecting with {activeCall.doctorName}…</div>
              </div>

              {/* Patient Miniature View */}
              <div className="absolute bottom-4 right-4 h-32 w-24 rounded-lg bg-zinc-900 border border-white/20 flex items-center justify-center text-white/50 text-[10px]">
                You (Anika)
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => toast("Microphone muted")}
                className="h-12 w-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
              >
                <Phone className="h-5 w-5" />
              </button>
              <button
                onClick={() => setActiveCall(null)}
                className="h-14 w-14 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Multi-Channel Reminder Notification Preview */}
      <AnimatePresence>
        {notificationPreview.show && (
          <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full space-y-2">
            
            {notificationPreview.channels.whatsapp && (
              <motion.div
                initial={{ transform: "translateY(50px)", opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-success/30 bg-success/10 p-3 shadow-clinical-md flex gap-2.5 items-start"
              >
                <div className="h-7 w-7 rounded-full bg-success/20 text-success flex items-center justify-center shrink-0">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-foreground">WhatsApp Reminder Sent</span>
                    <button onClick={() => setNotificationPreview(p => ({ ...p, show: false }))} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-[11px] text-foreground/80 mt-1">{notificationPreview.message}</p>
                </div>
              </motion.div>
            )}

          </div>
        )}
      </AnimatePresence>

    </RouteGuard>
  );
}
