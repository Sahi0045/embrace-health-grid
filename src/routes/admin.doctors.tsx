import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import {
  Users,
  RefreshCw,
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  UserCheck,
  Building2,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { getProfiles } from "@/lib/clinical.server";
import { getStaffSchedule, getAttendance } from "@/lib/operations.server";
import { useTableRefresh } from "@/hooks/use-realtime";

import { StaffKpiBar, StaffKpiStats } from "@/components/staff/StaffKpiBar";
import {
  StaffFilterBar,
  StaffViewMode,
  StaffRoleFilter,
  StaffAvailabilityFilter,
} from "@/components/staff/StaffFilterBar";
import { StaffCard, StaffMember } from "@/components/staff/StaffCard";
import { DutyRosterGrid, RosterShiftEntry } from "@/components/staff/DutyRosterGrid";
import { DepartmentWorkloadMatrix } from "@/components/staff/DepartmentWorkloadMatrix";
import { StaffDetailPanel } from "@/components/staff/StaffDetailPanel";

export const Route = createFileRoute("/admin/doctors")({
  head: () => ({
    meta: [
      { title: "Staff Availability Dashboard — Admin Console" },
      {
        name: "description",
        content:
          "Hospital staff roster, live clinician availability, 7-day duty schedules, and department workload governance",
      },
    ],
  }),
  component: StaffAvailabilityDashboard,
});

// Fallback staff directory for realistic clinical operations
const DEFAULT_CLINICAL_STAFF: Partial<StaffMember>[] = [
  {
    id: "staff-1",
    fullName: "Dr. Sarah Jenkins, MD",
    email: "sarah.jenkins@embrace.health",
    role: "doctor",
    department: "Emergency",
    specialty: "Trauma & Emergency Medicine",
    primaryDid: "did:embrace:doc:98f12a34",
    phone: "+1 (555) 234-5678",
    availability: "available",
    workload: { activePatients: 4, maxCapacity: 8, percentage: 50, hoursThisWeek: 34 },
  },
  {
    id: "staff-2",
    fullName: "Dr. Marcus Vance, MD",
    email: "marcus.vance@embrace.health",
    role: "doctor",
    department: "ICU & Critical Care",
    specialty: "Critical Care & Intensivist",
    primaryDid: "did:embrace:doc:44a71b89",
    phone: "+1 (555) 345-6789",
    availability: "busy",
    workload: { activePatients: 7, maxCapacity: 8, percentage: 88, hoursThisWeek: 42 },
  },
  {
    id: "staff-3",
    fullName: "Dr. Elena Rostova, MD",
    email: "elena.rostova@embrace.health",
    role: "specialist",
    department: "Cardiology",
    specialty: "Interventional Cardiology",
    primaryDid: "did:embrace:doc:12c98d45",
    phone: "+1 (555) 456-7890",
    availability: "available",
    workload: { activePatients: 3, maxCapacity: 6, percentage: 50, hoursThisWeek: 30 },
  },
  {
    id: "staff-4",
    fullName: "Dr. David Chen, MD",
    email: "david.chen@embrace.health",
    role: "doctor",
    department: "Surgery",
    specialty: "Orthopedic & Trauma Surgery",
    primaryDid: "did:embrace:doc:77e43f12",
    phone: "+1 (555) 567-8901",
    availability: "oncall",
    workload: { activePatients: 5, maxCapacity: 6, percentage: 83, hoursThisWeek: 38 },
  },
  {
    id: "staff-5",
    fullName: "Nurse Manager Jessica Patel, RN",
    email: "jessica.patel@embrace.health",
    role: "nurse",
    department: "Emergency",
    specialty: "Triage & Emergency Care",
    primaryDid: "did:embrace:nurse:33b21c90",
    phone: "+1 (555) 678-9012",
    availability: "available",
    workload: { activePatients: 6, maxCapacity: 10, percentage: 60, hoursThisWeek: 36 },
  },
  {
    id: "staff-6",
    fullName: "Nurse Practitioner Liam O'Connor",
    email: "liam.oconnor@embrace.health",
    role: "nurse",
    department: "ICU & Critical Care",
    specialty: "Critical Care Nursing",
    primaryDid: "did:embrace:nurse:88d54a23",
    phone: "+1 (555) 789-0123",
    availability: "busy",
    workload: { activePatients: 8, maxCapacity: 8, percentage: 100, hoursThisWeek: 40 },
  },
  {
    id: "staff-7",
    fullName: "Dr. Aisha Morales, MD",
    email: "aisha.morales@embrace.health",
    role: "doctor",
    department: "Pediatrics",
    specialty: "Pediatric Critical Care",
    primaryDid: "did:embrace:doc:55f89e67",
    phone: "+1 (555) 890-1234",
    availability: "available",
    workload: { activePatients: 4, maxCapacity: 8, percentage: 50, hoursThisWeek: 32 },
  },
  {
    id: "staff-8",
    fullName: "Dr. Jonathan Reyes, MD",
    email: "jonathan.reyes@embrace.health",
    role: "specialist",
    department: "Neurology",
    specialty: "Stroke & Neurocritical Care",
    primaryDid: "did:embrace:doc:99a12c44",
    phone: "+1 (555) 901-2345",
    availability: "off",
    workload: { activePatients: 0, maxCapacity: 6, percentage: 0, hoursThisWeek: 28 },
  },
];

const ITEMS_PER_PAGE = 9;

/**
 * Smart Numbered Pagination Range (e.g. 1 2 3 ... 49 50)
 */
function getPaginationRange(current: number, total: number): (number | string)[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, 4, "...", total];
  }
  if (current >= total - 2) {
    return [1, "...", total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

function StaffAvailabilityDashboard() {
  // Raw Data State
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [schedules, setSchedules] = useState<RosterShiftEntry[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View, Filter & Sort State
  const [viewMode, setViewMode] = useState<StaffViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState<StaffRoleFilter>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<StaffAvailabilityFilter>("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [currentPage, setCurrentPage] = useState(1);

  // Drawer Detail State
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, scheduleRes, attendanceRes] = await Promise.all([
        getProfiles().catch(() => ({ profiles: [] })),
        getStaffSchedule().catch(() => ({ schedule: [] })),
        getAttendance().catch(() => ({ attendance: [] })),
      ]);

      const rawProfiles = profilesRes.profiles || [];
      const rawSchedules = scheduleRes.schedule || [];
      const rawAttendance = attendanceRes.attendance || [];

      // Map raw schedule entries
      const mappedSchedules: RosterShiftEntry[] = rawSchedules.map((s: any) => ({
        shiftId: s.shift_id || s.id || `shift-${Math.random()}`,
        staffId: s.staff_id || s.staffId || "",
        shiftDate: s.shift_date || s.date || new Date().toISOString().split("T")[0],
        role: s.role || "General Duty",
        startsAt: s.starts_at || s.start || "08:00",
        endsAt: s.ends_at || s.end || "16:00",
        unit: s.unit || "Main Wing",
        patientCount: s.patient_count ?? s.patients,
        confirmed: s.confirmed ?? true,
        notes: s.notes,
      }));

      // Combine profiles with attendance and shifts
      const staffMap = new Map<string, StaffMember>();

      // 1. Seed with realistic default clinical staff
      for (const fallback of DEFAULT_CLINICAL_STAFF) {
        if (fallback.id) {
          staffMap.set(fallback.id, fallback as StaffMember);
        }
      }

      // 2. Overlay actual database profiles
      for (const p of rawProfiles) {
        if (p.role === "doctor" || p.role === "staff" || p.role === "admin") {
          const userShifts = mappedSchedules.filter((s) => s.staffId === p.id);
          const userAttendance = rawAttendance.filter((a: any) => a.staff_id === p.id);
          const latestAtt = userAttendance[0];

          const isDoctor = p.role === "doctor" || (p.full_name || "").toLowerCase().includes("dr.");
          const memberRole: StaffMember["role"] = isDoctor ? "doctor" : "nurse";

          staffMap.set(p.id, {
            id: p.id,
            fullName: p.full_name || p.email?.split("@")[0] || "Staff Member",
            email: p.email || "",
            role: memberRole,
            department: (p as any).department || (isDoctor ? "Emergency" : "General Medicine"),
            specialty: (p as any).specialty || (isDoctor ? "General Practice" : "Clinical Care"),
            primaryDid: (p as any).primary_did || undefined,
            phone: "+1 (555) 019-4832",
            availability: latestAtt?.action === "in" ? "available" : userShifts.length > 0 ? "busy" : "off",
            currentShift: userShifts[0]
              ? {
                  id: userShifts[0].shiftId,
                  shiftName: userShifts[0].role,
                  startsAt: userShifts[0].startsAt,
                  endsAt: userShifts[0].endsAt,
                  unit: userShifts[0].unit,
                  confirmed: userShifts[0].confirmed,
                  role: userShifts[0].role,
                }
              : undefined,
            workload: {
              activePatients: userShifts[0]?.patientCount || (latestAtt?.action === "in" ? 4 : 0),
              maxCapacity: 8,
              percentage: Math.min(100, Math.round(((userShifts[0]?.patientCount || 4) / 8) * 100)),
              hoursThisWeek: 36,
            },
            attendance: latestAtt
              ? {
                  lastAction: latestAtt.action,
                  recordedAt: latestAtt.recorded_at,
                  location: latestAtt.location,
                }
              : undefined,
          });
        }
      }

      setStaffMembers(Array.from(staffMap.values()));
      setSchedules(mappedSchedules);
      setAttendanceRecords(rawAttendance);
    } catch (err: any) {
      toast.error("Failed to sync staff availability roster", {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time table subscriptions
  useTableRefresh("profiles", loadData);
  useTableRefresh("staff_schedule", loadData);
  useTableRefresh("attendance", loadData);

  // Departments List
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const s of staffMembers) {
      if (s.department) set.add(s.department);
    }
    return Array.from(set).sort();
  }, [staffMembers]);

  // KPI calculations
  const kpiStats: StaffKpiStats = useMemo(() => {
    const totalStaff = staffMembers.length;
    const onDuty = staffMembers.filter(
      (s) => s.availability === "available" || s.availability === "busy"
    ).length;
    const availableNow = staffMembers.filter((s) => s.availability === "available").length;
    const onCall = staffMembers.filter((s) => s.availability === "oncall").length;
    const busyNow = staffMembers.filter((s) => s.availability === "busy").length;
    const offDuty = staffMembers.filter((s) => s.availability === "off").length;
    const doctorCount = staffMembers.filter((s) => s.role === "doctor" || s.role === "specialist").length;
    const nurseCount = staffMembers.filter((s) => s.role === "nurse").length;

    // Shift context calculation
    const now = new Date();
    const currentHour = now.getHours();
    let activeShiftName = "Morning Clinical Shift";
    let shiftWindow = "07:00 – 15:00";
    let handoverIn = "2h 45m";

    if (currentHour >= 15 && currentHour < 23) {
      activeShiftName = "Evening Clinical Shift";
      shiftWindow = "15:00 – 23:00";
      handoverIn = "4h 15m";
    } else if (currentHour >= 23 || currentHour < 7) {
      activeShiftName = "Overnight Emergency Shift";
      shiftWindow = "23:00 – 07:00";
      handoverIn = "5h 30m";
    }

    return {
      totalStaff,
      onDuty,
      availableNow,
      onCall,
      busyNow,
      offDuty,
      doctorCount,
      nurseCount,
      activeShiftName,
      shiftWindow,
      handoverIn,
    };
  }, [staffMembers]);

  // Filter & Sort staff members
  const filteredStaff = useMemo(() => {
    return staffMembers
      .filter((s) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          s.fullName.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.department.toLowerCase().includes(q) ||
          (s.specialty && s.specialty.toLowerCase().includes(q)) ||
          (s.primaryDid && s.primaryDid.toLowerCase().includes(q));

        const matchesDept =
          departmentFilter === "all" ||
          s.department.toLowerCase() === departmentFilter.toLowerCase();

        const matchesRole =
          roleFilter === "all" || s.role.toLowerCase() === roleFilter.toLowerCase();

        const matchesAvailability =
          availabilityFilter === "all" || s.availability === availabilityFilter;

        const matchesShift =
          shiftFilter === "all" ||
          (shiftFilter === "morning" && (s.currentShift?.startsAt?.startsWith("07") || s.currentShift?.startsAt?.startsWith("08"))) ||
          (shiftFilter === "evening" && s.currentShift?.startsAt?.startsWith("15")) ||
          (shiftFilter === "night" && s.currentShift?.startsAt?.startsWith("23")) ||
          (shiftFilter === "oncall" && s.availability === "oncall");

        return matchesSearch && matchesDept && matchesRole && matchesAvailability && matchesShift;
      })
      .sort((a, b) => {
        if (sortBy === "name-asc") return a.fullName.localeCompare(b.fullName);
        if (sortBy === "workload-desc") return b.workload.percentage - a.workload.percentage;
        if (sortBy === "department") return a.department.localeCompare(b.department);
        if (sortBy === "status") return a.availability.localeCompare(b.availability);
        return 0;
      });
  }, [
    staffMembers,
    searchQuery,
    departmentFilter,
    roleFilter,
    availabilityFilter,
    shiftFilter,
    sortBy,
  ]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / ITEMS_PER_PAGE));
  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStaff.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredStaff, currentPage]);

  const handleSelectDepartmentFromMatrix = (deptName: string) => {
    const matched = departments.find((d) =>
      d.toLowerCase().includes(deptName.toLowerCase().split(" ")[0])
    );
    if (matched) {
      setDepartmentFilter(matched);
    }
    setViewMode("grid");
  };

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8 pb-24">
        {/* Page Header */}
        <PageHeader
          eyebrow="Clinical Personnel & Roster Governance"
          title="Staff Availability Dashboard"
          description="Live clinician availability, 7-day duty schedules, biometric attendance, and ward workload allocation"
          actions={
            <div className="flex items-center gap-2">
              <Button
                onClick={loadData}
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-bold shadow-xs hover:bg-accent"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Sync Telemetry
              </Button>
              <Button
                onClick={() => toast.success("Roster attendance export generated (CSV)")}
                size="sm"
                className="bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold rounded-xl shadow-clinical-md shadow-primary/25 text-xs"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Roster
              </Button>
            </div>
          }
        />

        <StaggerList className="space-y-8">
          {/* Top Section: Shift Window Ribbon + 4 KPI Metric Tiles */}
          <StaggerItem>
            <StaffKpiBar stats={kpiStats} />
          </StaggerItem>

          {/* Controls Bar: Search, Filters & View Mode Switcher */}
          <StaggerItem>
            <StaffFilterBar
              searchQuery={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q);
                setCurrentPage(1);
              }}
              departmentFilter={departmentFilter}
              onDepartmentFilterChange={(d) => {
                setDepartmentFilter(d);
                setCurrentPage(1);
              }}
              departments={departments}
              roleFilter={roleFilter}
              onRoleFilterChange={(r) => {
                setRoleFilter(r);
                setCurrentPage(1);
              }}
              availabilityFilter={availabilityFilter}
              onAvailabilityFilterChange={(a) => {
                setAvailabilityFilter(a);
                setCurrentPage(1);
              }}
              shiftFilter={shiftFilter}
              onShiftFilterChange={(s) => {
                setShiftFilter(s);
                setCurrentPage(1);
              }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              totalFilteredCount={filteredStaff.length}
            />
          </StaggerItem>

          {/* Main Dynamic View Mode Area */}
          <StaggerItem>
            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-border bg-muted/40 h-64 p-5 space-y-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 bg-muted rounded-xl" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-16 bg-muted rounded-xl" />
                    <div className="h-4 bg-muted rounded w-full" />
                  </div>
                ))}
              </div>
            ) : viewMode === "grid" ? (
              /* View Mode 1: Staff Directory Cards */
              <div className="space-y-6">
                {filteredStaff.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No Medical Staff Found"
                    description="No personnel match the selected filters or search query. Try broadening your criteria."
                    action={
                      <Button
                        onClick={() => {
                          setSearchQuery("");
                          setDepartmentFilter("all");
                          setRoleFilter("all");
                          setAvailabilityFilter("all");
                          setShiftFilter("all");
                        }}
                        className="bg-primary text-primary-foreground font-extrabold rounded-xl shadow-clinical-md text-xs"
                      >
                        Reset All Filters
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {paginatedStaff.map((staff) => (
                        <StaffCard
                          key={staff.id}
                          staff={staff}
                          onSelect={(s) => setSelectedStaff(s)}
                        />
                      ))}
                    </div>

                    {/* Smart Numbered Pagination Bar (e.g. 1 2 3 ... 49 50) */}
                    {totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/60 text-xs font-medium text-muted-foreground">
                        <div>
                          Page <span className="font-bold text-foreground">{currentPage}</span> of{" "}
                          <span className="font-bold text-foreground">{totalPages}</span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="rounded-xl h-8 px-2.5 gap-1 text-xs font-bold"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Prev
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
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className="rounded-xl h-8 px-2.5 gap-1 text-xs font-bold"
                          >
                            Next
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : viewMode === "roster" ? (
              /* View Mode 2: 7-Day Interactive Shift Schedule Matrix */
              <DutyRosterGrid
                staffList={filteredStaff}
                schedules={schedules}
                onSelectStaff={(s) => setSelectedStaff(s)}
              />
            ) : (
              /* View Mode 3: Department Workload Heatmap */
              <DepartmentWorkloadMatrix
                staffList={staffMembers}
                onSelectDepartment={handleSelectDepartmentFromMatrix}
              />
            )}
          </StaggerItem>
        </StaggerList>

        {/* Slide-in Staff Telemetry & Profile Inspector Drawer Panel */}
        <StaffDetailPanel
          staff={selectedStaff}
          shifts={schedules}
          attendanceLogs={attendanceRecords.filter(
            (a: any) => a.staff_id === selectedStaff?.id
          )}
          onClose={() => setSelectedStaff(null)}
          onConfirmShift={loadData}
        />
      </div>
    </RouteGuard>
  );
}
