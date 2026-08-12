import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { useState, useEffect, useCallback } from "react";
import {
  Stethoscope,
  Search,
  RefreshCw,
  Calendar,
  Clock,
  User,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getProfiles } from "@/lib/clinical.server";
import { getStaffSchedule } from "@/lib/operations.server";
import { useTableRefresh } from "@/hooks/use-realtime";

export const Route = createFileRoute("/admin/doctors")({
  head: () => ({ meta: [{ title: "Admin · Doctor Availability — Embrace Health Grid" }] }),
  component: AdminDoctorsPageGuarded,
});

interface DoctorProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  primary_did: string;
  created_at: string;
  department?: string;
  specialty?: string;
}

interface Shift {
  shift_id: string;
  staff_id: string;
  shift_date: string;
  role: string;
  starts_at: string;
  ends_at: string;
  unit: string;
  patient_count?: number;
  notes?: string;
  confirmed: boolean;
}

// Map raw DB rows to local Shift shape
function toShift(s: any): Shift {
  return {
    shift_id: s.shift_id,
    staff_id: s.staff_id,
    shift_date: s.shift_date,
    role: s.role,
    starts_at: s.starts_at ?? s.start ?? "",
    ends_at: s.ends_at ?? s.end ?? "",
    unit: s.unit ?? "",
    patient_count: s.patient_count ?? s.patients,
    notes: s.notes,
    confirmed: s.confirmed ?? false,
  };
}

const AVAILABILITY_STATUS = {
  available: { label: "Available", color: "text-success", bg: "bg-success/10", icon: CheckCircle2 },
  busy: { label: "Busy", color: "text-warning", bg: "bg-warning/10", icon: Clock },
  off: { label: "Off Duty", color: "text-muted-foreground", bg: "bg-muted", icon: XCircle },
  oncall: { label: "On Call", color: "text-destructive", bg: "bg-destructive/10", icon: AlertCircle },
};

function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [schedules, setSchedules] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [availabilityFilter, setAvailabilityFilter] = useState("All");
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, scheduleRes] = await Promise.all([
        getProfiles(),
        getStaffSchedule().catch(() => ({ schedule: [] })),
      ]);

      // Filter only doctors and staff with medical roles
      const medicalStaff = (profilesRes.profiles || []).filter(
        (p: any) => p.role === "doctor" || p.role === "staff"
      );
      setDoctors(medicalStaff);
      setSchedules((scheduleRes.schedule ?? []).map(toShift));
    } catch (err: any) {
      toast.error("Could not load doctor data", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time updates
  useTableRefresh("profiles", load);
  useTableRefresh("staff_schedule", load);

  // Get unique departments
  const departments = ["All", ...Array.from(new Set(doctors.map((d) => d.department).filter(Boolean)))];

  // Get current availability status for a doctor
  const getDoctorAvailability = (doctorId: string) => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentHour = now.getHours();

    // Find today's shifts for this doctor
    const todayShifts = schedules.filter(
      (s) => s.staff_id === doctorId && s.shift_date === today
    );

    if (todayShifts.length === 0) return "off";

    // Check if currently in a shift
    for (const shift of todayShifts) {
      const startHour = parseInt(shift.starts_at?.split(":")[0] || "0");
      const endHour = parseInt(shift.ends_at?.split(":")[0] || "24");

      if (currentHour >= startHour && currentHour < endHour) {
        if (shift.role === "On-call") return "oncall";
        if (shift.patient_count && shift.patient_count > 5) return "busy";
        return "available";
      }
    }

    return "off";
  };

  // Get upcoming shifts for a doctor
  const getDoctorUpcomingShifts = (doctorId: string) => {
    const today = new Date().toISOString().split("T")[0];
    return schedules
      .filter((s) => s.staff_id === doctorId && s.shift_date >= today)
      .sort((a, b) => a.shift_date.localeCompare(b.shift_date))
      .slice(0, 5);
  };

  // Filter doctors
  const filteredDoctors = doctors.filter((doc) => {
    const q = searchQ.toLowerCase();
    const matchQ =
      !q ||
      doc.full_name?.toLowerCase().includes(q) ||
      doc.email?.toLowerCase().includes(q) ||
      doc.department?.toLowerCase().includes(q) ||
      doc.specialty?.toLowerCase().includes(q) ||
      doc.primary_did?.toLowerCase().includes(q);

    const matchDept =
      departmentFilter === "All" || doc.department === departmentFilter;

    const availability = getDoctorAvailability(doc.id);
    const matchAvail =
      availabilityFilter === "All" || availability === availabilityFilter.toLowerCase();

    return matchQ && matchDept && matchAvail;
  });

  // Stats
  const totalDoctors = doctors.filter((d) => d.role === "doctor").length;
  const availableNow = doctors.filter((d) => getDoctorAvailability(d.id) === "available").length;
  const onCallNow = doctors.filter((d) => getDoctorAvailability(d.id) === "oncall").length;
  const busyNow = doctors.filter((d) => getDoctorAvailability(d.id) === "busy").length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between border-b border-border pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
            Admin Console
          </div>
          <h1 className="text-2xl font-bold text-foreground">Doctor Availability</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View doctor schedules, availability status, and upcoming shifts across the hospital.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 text-center">
        {[
          { label: "Total Doctors", value: totalDoctors, cls: "text-primary" },
          { label: "Available Now", value: availableNow, cls: "text-success" },
          { label: "On Call", value: onCallNow, cls: "text-destructive" },
          { label: "Busy", value: busyNow, cls: "text-warning" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-3 shadow-clinical"
          >
            <div className={`text-2xl font-black ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search doctors by name, department, specialty, DID..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold outline-none"
        >
          {departments.map((d) => (
            <option key={d} value={d}>
              Department: {d}
            </option>
          ))}
        </select>
        <select
          value={availabilityFilter}
          onChange={(e) => setAvailabilityFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold outline-none"
        >
          {["All", "Available", "Busy", "Off", "Oncall"].map((s) => (
            <option key={s} value={s}>
              Status: {s}
            </option>
          ))}
        </select>
      </div>

      {/* Doctor List */}
      {loading ? (
        <div className="flex justify-center py-12 text-sm text-muted-foreground gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading doctors...
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Stethoscope className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <div className="text-sm font-semibold text-foreground">No doctors found</div>
          <div className="text-xs text-muted-foreground mt-1">
            {searchQ || departmentFilter !== "All" || availabilityFilter !== "All"
              ? "No results match your filters."
              : "No doctors have been registered yet."}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredDoctors.map((doctor) => {
            const availability = getDoctorAvailability(doctor.id);
            const statusConfig = AVAILABILITY_STATUS[availability as keyof typeof AVAILABILITY_STATUS];
            const StatusIcon = statusConfig.icon;
            const upcomingShifts = getDoctorUpcomingShifts(doctor.id);
            const isExpanded = selectedDoctor === doctor.id;

            return (
              <div
                key={doctor.id}
                className="rounded-xl border border-border bg-card shadow-clinical overflow-hidden"
              >
                {/* Doctor Card Header */}
                <button
                  className="w-full text-left p-4"
                  onClick={() => setSelectedDoctor(isExpanded ? null : doctor.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Stethoscope className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                          {doctor.full_name}
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusConfig.color} ${statusConfig.bg}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </span>
                          {doctor.role === "doctor" && (
                            <span className="rounded-full bg-chart-2/15 text-chart-2 px-2 py-0.5 text-[10px] font-medium">
                              Doctor
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {doctor.department || "General"} · {doctor.specialty || "General Practice"}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {doctor.email}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                    {/* Doctor Details */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        Contact & Identification
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-muted/50 px-3 py-2">
                          <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">
                            DID
                          </div>
                          <div className="font-mono text-[10px] text-foreground truncate">
                            {doctor.primary_did || "—"}
                          </div>
                        </div>
                        <div className="rounded-lg bg-muted/50 px-3 py-2">
                          <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">
                            Role
                          </div>
                          <div className="font-medium text-foreground capitalize">
                            {doctor.role}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Upcoming Shifts */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Upcoming Shifts
                      </div>
                      {upcomingShifts.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-2">
                          No upcoming shifts scheduled
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {upcomingShifts.map((shift) => (
                            <div
                              key={shift.shift_id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                                <div>
                                  <div className="font-semibold text-foreground">
                                    {new Date(shift.shift_date).toLocaleDateString("en-IN", {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {shift.starts_at} – {shift.ends_at}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-foreground">{shift.role}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {shift.unit}
                                </div>
                              </div>
                              {shift.confirmed && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Current Status Details */}
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                        Current Status
                      </div>
                      <div className={`text-sm font-semibold ${statusConfig.color} flex items-center gap-2`}>
                        <StatusIcon className="h-4 w-4" />
                        {statusConfig.label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {availability === "available" && "Currently available for consultations"}
                        {availability === "busy" && "In consultation with patients"}
                        {availability === "off" && "Not scheduled for today"}
                        {availability === "oncall" && "On emergency call duty"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminDoctorsPageGuarded() {
  return (
    <RouteGuard requiredRole="admin">
      <AdminDoctorsPage />
    </RouteGuard>
  );
}
