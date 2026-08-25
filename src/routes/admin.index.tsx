import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { DonutChart } from "@/components/dashboard/MiniChart";
import { ActivityItem } from "@/components/dashboard/ActivityItem";
import { GradientProgress } from "@/components/dashboard/GradientProgress";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Users,
  FileCheck,
  Activity,
  CheckCircle2,
  RefreshCw,
  UserCheck,
  Lock,
  ShieldAlert,
  Bed,
  Stethoscope,
  Pill,
  GraduationCap,
  Ambulance,
  Wrench,
  GitBranch,
  ChevronRight,
  Building2,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  useAdminBeds,
  useAdminAmbulances,
  useAdminEquipment,
  useAdminFraudAlerts,
  useAdminAudit,
  useAdminStats,
  useLivePatients,
  useLiveStaff,
  useAdminCredentials,
  useAdminDIDs,
} from "@/hooks/use-admin";
import { useAdminAttendance } from "@/hooks/use-api";
import { useTableRefresh } from "@/hooks/use-realtime";
import { HospitalContext } from "@/components/HospitalContext";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Master Dashboard — Embrace Health Grid" },
      {
        name: "description",
        content: "Hospital Consortium Enterprise Governance & Operations Master Console",
      },
    ],
  }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const { user: currentUser } = useCurrentUser();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const bedsQuery = useAdminBeds();
  const ambulancesQuery = useAdminAmbulances();
  const equipmentQuery = useAdminEquipment();
  const fraudAlertsQuery = useAdminFraudAlerts();
  const auditQuery = useAdminAudit();
  const statsQuery = useAdminStats();
  const patientsQuery = useLivePatients();
  const staffQuery = useLiveStaff();
  const credentialsQuery = useAdminCredentials();
  const didsQuery = useAdminDIDs();
  const attendanceQuery = useAdminAttendance();

  useTableRefresh("attendance", attendanceQuery.refetch);
  // Admission changes update the staff/patient counts on the dashboard.
  useTableRefresh("admissions", () => {
    patientsQuery.refetch();
    staffQuery.refetch();
  });
  useTableRefresh("beds", bedsQuery.refetch);
  useTableRefresh("appointments", () => {
    bedsQuery.refetch();
    auditQuery.refetch();
  });

  const handleSyncAll = useCallback(() => {
    setIsRefreshing(true);
    bedsQuery.refetch();
    ambulancesQuery.refetch();
    equipmentQuery.refetch();
    fraudAlertsQuery.refetch();
    auditQuery.refetch();
    statsQuery.refetch();
    patientsQuery.refetch();
    staffQuery.refetch();
    credentialsQuery.refetch();
    didsQuery.refetch();
    attendanceQuery.refetch();
    setTimeout(() => setIsRefreshing(false), 600);
    toast.info("Refreshed master dashboard state across all consortium nodes.");
  }, [
    bedsQuery,
    ambulancesQuery,
    equipmentQuery,
    fraudAlertsQuery,
    auditQuery,
    statsQuery,
    patientsQuery,
    staffQuery,
    credentialsQuery,
    didsQuery,
    attendanceQuery,
  ]);

  const allBeds = bedsQuery.data?.beds || [];
  const totalBeds = allBeds.length || 0;
  const occupiedBeds = allBeds.filter((b: any) => b.status === "occupied" || b.occupied).length;
  const maintenanceBeds = allBeds.filter((b: any) => b.status === "maintenance").length;
  const reservedBeds = allBeds.filter((b: any) => b.status === "reserved").length;
  // The `|| total - occupied - maintenance - reserved` fallback fired whenever
  // zero beds were free — exactly when the number matters most — and the
  // subtraction ignored the `cleaning`, `blocked` and `emergency_reserved`
  // states. A full ward with 6 occupied and 4 cleaning reported "4 Free".
  const availableBeds = allBeds.filter((b: any) => b.status === "available").length;

  const bedPieData = [
    { name: "Available", value: availableBeds, color: "var(--color-success, #22c55e)" },
    { name: "Occupied", value: occupiedBeds, color: "var(--color-warning, #f59e0b)" },
    { name: "Maintenance", value: maintenanceBeds, color: "var(--color-destructive, #ef4444)" },
    { name: "Reserved", value: reservedBeds, color: "var(--color-primary, #3b82f6)" },
  ];

  const wardStats = (() => {
    const map = new Map<string, { total: number; occupied: number }>();
    allBeds.forEach((b: any) => {
      // Beds with no ward were bucketed into "General Ward", which silently
      // inflated that ward's totals with unassigned beds and made its occupancy
      // percentage wrong. Label them for what they are instead.
      const wardName = b.ward || "Unassigned";
      const entry = map.get(wardName) || { total: 0, occupied: 0 };
      entry.total += 1;
      if (b.status === "occupied" || b.occupied) entry.occupied += 1;
      map.set(wardName, entry);
    });
    return Array.from(map.entries()).map(([ward, stat]) => ({
      ward,
      total: stat.total,
      occupied: stat.occupied,
      percentage: Math.round((stat.occupied / stat.total) * 100),
    }));
  })();

  const livePatientsCount = patientsQuery.patients?.length || 0;
  const liveStaffCount = staffQuery.staff?.length || 0;

  const attendanceSummary = attendanceQuery.data?.summary || {
    totalEligibleStaff: liveStaffCount,
    checkedInCount: 0,
    checkedOutCount: 0,
    absentToday: 0,
  };
  const checkedInCount = attendanceSummary.checkedInCount || 0;
  const checkedOutCount = attendanceSummary.checkedOutCount || 0;
  const absentCount = attendanceSummary.absentToday || 0;
  const eligibleStaffTotal = attendanceSummary.totalEligibleStaff || liveStaffCount || 1;
  const attendanceRate = Math.round((checkedInCount / eligibleStaffTotal) * 100);

  const ambulances = ambulancesQuery.data?.ambulances || [];
  const availableAmbulances = ambulances.filter((a: any) => a.status === "available").length;

  const equipment = equipmentQuery.data?.equipment || [];
  // "operational" is not a member of the asset_status enum
  // ('available','in-use','maintenance','retired'), so this matched nothing and
  // "Assets Operational" read 0/N on a fully working hospital.
  const operationalEquipment = equipment.filter(
    (e: any) => e.status === "available" || e.status === "in-use",
  ).length;

  const fraudAlerts = fraudAlertsQuery.data?.alerts || [];
  const auditEvents = auditQuery.data?.events || [];
  const anchoredEvents = auditEvents.filter(
    (e: any) => (e.anchorStatus ?? e.anchor_status) === "anchored",
  ).length;
  const registeredDIDs = didsQuery.data?.dids || [];
  const issuedCredentials = credentialsQuery.data?.credentials || [];

  return (
    <RouteGuard requiredRole="admin">
      <div className="min-h-screen pb-16 ambient-page-bg">
        {/* Header Container */}
        <div className="relative z-10 space-y-2">
          <div className="px-8 pt-4 pb-0">
            <HospitalContext />
          </div>
          <PageHeader
            eyebrow="Enterprise Governance & Operations"
            title="Admin Master Control Center"
            description={`Logged in as System Administrator (${currentUser?.email || "admin@example.com"}) — Real-time Multi-tenant Node Verification`}
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncAll}
                disabled={isRefreshing}
                className="gap-2 text-xs font-semibold shadow-sm hover:bg-accent glow-on-hover"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} /> Sync
                Consortium State
              </Button>
            }
          />
        </div>

        <div className="p-6 md:p-8 max-w-7xl mx-auto relative z-10">
          <StaggerList className="space-y-6">
            {/* Bento Row 1: 12-Column Hero Operational Metrics */}
            <StaggerItem>
              <div className="grid gap-5 grid-cols-1 lg:grid-cols-12">
                {/* Hero Bed Capacity (7/12 Cols) - Scaled Height ~370px */}
                <div className="lg:col-span-7 flex flex-col">
                  <GlowCard
                    accent="warning"
                    className="h-full p-7 md:p-8 flex flex-col justify-between space-y-6 min-h-[370px]"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-warning animate-pulse" />
                        <span className="text-xs md:text-sm font-extrabold uppercase tracking-wider text-muted-foreground/90">
                          Hospital Bed Capacity & Ward Allocation
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className="bg-success/15 text-success border-success/30 font-extrabold text-xs px-2.5 py-0.5 whitespace-nowrap shrink-0"
                        >
                          {totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0}%
                          Occupied
                        </Badge>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/20 text-warning-foreground shadow-xs shrink-0">
                          <Bed className="h-5 w-5" />
                        </div>
                      </div>
                    </div>

                    {/* Main Content 2-Column Balanced Layout */}
                    <div className="grid gap-6 sm:grid-cols-12 items-center flex-1">
                      {/* Left: Scaled Up Donut Chart (195px) + Occupancy Pills (5/12 Cols) */}
                      <div className="sm:col-span-5 flex flex-col items-center justify-center space-y-3">
                        <DonutChart
                          data={bedPieData}
                          centerLabel={`${occupiedBeds}/${totalBeds}`}
                          centerSublabel="Beds Occupied"
                          height={195}
                          innerRadius={60}
                          outerRadius={84}
                        />
                        <div className="flex items-center gap-4 text-sm font-semibold pt-1">
                          <div className="flex items-center gap-1.5 text-foreground font-bold">
                            <span className="h-2.5 w-2.5 rounded-full bg-warning" />
                            <span>{occupiedBeds} Occupied</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground font-bold">
                            <span className="h-2.5 w-2.5 rounded-full bg-success" />
                            <span>{availableBeds} Free</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Scaled Up Ward Breakdown + Thicker Progress Bars (7/12 Cols) */}
                      <div className="sm:col-span-7 space-y-5">
                        <GradientProgress
                          value={totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0}
                          tone="warning"
                          showLabel
                          label="Consortium Bed Utilization"
                          height={12}
                        />

                        <div className="space-y-3.5 pt-3 border-t border-border/80">
                          {wardStats.length > 0 ? (
                            wardStats
                              .slice(0, 3)
                              .map((w, idx) => (
                                <GradientProgress
                                  key={w.ward}
                                  value={w.percentage}
                                  tone={idx === 0 ? "cyan" : idx === 1 ? "success" : "primary"}
                                  showLabel
                                  label={`${w.ward} (${w.occupied}/${w.total} Beds)`}
                                  height={9}
                                />
                              ))
                          ) : (
                            <div className="text-xs text-muted-foreground italic">
                              No ward breakdowns specified
                            </div>
                          )}
                        </div>

                        <div className="pt-2 flex justify-end">
                          <Link
                            to="/staff/rooms"
                            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline whitespace-nowrap shrink-0"
                          >
                            Manage Rooms & Wards <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </GlowCard>
                </div>

                {/* Right KPI Quad (5/12 Cols) */}
                <div className="lg:col-span-5 grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <KpiTile
                    label="Available Beds"
                    value={availableBeds}
                    icon={CheckCircle2}
                    tone="success"
                  />

                  <KpiTile
                    label="Staff Checked In"
                    value={checkedInCount}
                    trend={{ value: `${attendanceRate}% On Duty`, isPositive: true }}
                    icon={UserCheck}
                    tone="success"
                  />

                  <KpiTile
                    label="Ambulances Ready"
                    value={availableAmbulances}
                    trend={{ value: "Ready", isPositive: true }}
                    icon={Ambulance}
                    tone="success"
                  />

                  <KpiTile
                    label="Security Alerts"
                    value={fraudAlerts.length}
                    trend={{
                      value: fraudAlerts.length > 0 ? "Action" : "0 Flags",
                      isPositive: fraudAlerts.length === 0,
                    }}
                    icon={ShieldAlert}
                    tone={fraudAlerts.length > 0 ? "destructive" : "success"}
                  />
                </div>
              </div>
            </StaggerItem>

            {/* Bento Row 2: Workforce Attendance & Risk Security (Matched Height min-h-[250px]) */}
            <StaggerItem>
              <div className="grid gap-6 grid-cols-1 lg:grid-cols-12 items-stretch">
                {/* Staff Attendance (6/12 Cols) - min-h-[250px] */}
                <div className="lg:col-span-6 flex flex-col">
                  <GlowCard
                    accent="success"
                    className="h-full min-h-[250px] p-6 flex flex-col justify-between space-y-4"
                  >
                    <CardHeader className="p-0 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
                            <UserCheck className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-bold">
                              Staff Attendance & Shift Status
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Live workforce shift status across hospital units
                            </CardDescription>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-success/15 text-success border-success/30 text-[10px] font-bold uppercase shrink-0 whitespace-nowrap"
                        >
                          {attendanceRate}% On Duty
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 space-y-4 flex-1 flex flex-col justify-between">
                      {/* Flat Stat Grid */}
                      <div className="grid grid-cols-3 gap-4 pt-1 pb-3 border-b border-border/50 text-center">
                        <div>
                          <div className="text-2xl font-extrabold text-success font-display">
                            {checkedInCount}
                          </div>
                          <div className="text-xs text-muted-foreground font-medium">
                            Checked In
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-extrabold text-primary dark:text-primary font-display">
                            {checkedOutCount}
                          </div>
                          <div className="text-xs text-muted-foreground font-medium">
                            Checked Out
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-extrabold text-foreground font-display">
                            {absentCount}
                          </div>
                          <div className="text-xs text-muted-foreground font-medium">Unmarked</div>
                        </div>
                      </div>

                      {/* Attendance Progress & Footer */}
                      <div className="space-y-2">
                        <GradientProgress
                          value={attendanceRate}
                          tone="success"
                          showLabel
                          label="Today's Shift Completion Rate"
                          height={6}
                        />
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-muted-foreground font-medium text-[11px]">
                            {eligibleStaffTotal} Registered DID Staff Members
                          </span>
                          <Link
                            to="/staff/attendance"
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline shrink-0 whitespace-nowrap"
                          >
                            View Staff Attendance Roster <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </GlowCard>
                </div>

                {/* Risk Alerts / Security Monitor (6/12 Cols) - Matched Height min-h-[250px] & Zero Text-Wrap */}
                <div className="lg:col-span-6 flex flex-col">
                  <GlowCard
                    accent={fraudAlerts.length > 0 ? "destructive" : "success"}
                    className="h-full min-h-[250px] p-6 flex flex-col justify-between space-y-4"
                  >
                    <CardHeader className="p-0 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                              fraudAlerts.length > 0
                                ? "bg-destructive/15 text-destructive"
                                : "bg-success/15 text-success"
                            }`}
                          >
                            <ShieldCheck className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-bold">
                              Active Risk & Security Monitor
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Real-time identity & access log audit
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
                          <span className="flex items-center gap-1.5 text-xs text-success font-semibold shrink-0 whitespace-nowrap">
                            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />{" "}
                            Solana Synced
                          </span>
                          <Link
                            to="/admin/fraud"
                            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0 whitespace-nowrap"
                          >
                            View Log <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 flex flex-col justify-between">
                      {fraudAlerts.length === 0 ? (
                        <div className="space-y-4 flex-1 flex flex-col justify-between">
                          <div className="grid grid-cols-3 gap-4 py-3 text-center my-auto">
                            {/* Was "100% Cryptographic Integrity" and "12ms
                                Response Latency", both hardcoded. The first
                                asserts every audit hash verifies — a claim this
                                console never checked; the second measured
                                nothing at all. Replaced with two figures the
                                page already holds. */}
                            <div>
                              <div className="text-2xl font-extrabold text-foreground font-display">
                                {auditEvents.length}
                              </div>
                              <div className="text-xs text-muted-foreground font-medium">
                                Audit Events
                              </div>
                            </div>
                            <div>
                              <div className="text-2xl font-extrabold text-success font-display">
                                {anchoredEvents}
                              </div>
                              <div className="text-xs text-muted-foreground font-medium">
                                Anchored On-Chain
                              </div>
                            </div>
                            <div>
                              <div className="text-2xl font-extrabold text-foreground font-display">
                                0
                              </div>
                              <div className="text-xs text-muted-foreground font-medium">
                                Active Anomalies
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-3.5 w-3.5 text-success" />
                              <span className="font-medium text-[11px]">
                                Consortium Security Mesh #01 · 0 Unverified Accesses
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground/80">
                              0x7f8a...3b92
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 divide-y divide-border/60">
                          {fraudAlerts.slice(0, 4).map((alert: any, idx: number) => {
                            const isHigh = alert.severity === "high" || alert.riskScore >= 80;
                            return (
                              <ActivityItem
                                key={alert.id || alert.alertId || idx}
                                severity={isHigh ? "critical" : "warning"}
                                title={
                                  alert.message ||
                                  alert.action ||
                                  alert.type ||
                                  "System Anomaly Detected"
                                }
                                subtitle={`Actor: ${alert.actor || alert.affectedResource || "Unknown"}`}
                                time={
                                  alert.at || alert.detectedAt
                                    ? new Date(alert.at || alert.detectedAt).toLocaleTimeString(
                                        [],
                                        {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        },
                                      )
                                    : "Recent"
                                }
                                isLast={idx === Math.min(fraudAlerts.length, 4) - 1}
                              />
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </GlowCard>
                </div>
              </div>
            </StaggerItem>

            {/* Bento Row 3: Consortium Audit Trail & Assets (Matched Height min-h-[350px]) */}
            <StaggerItem>
              <div className="grid gap-6 grid-cols-1 lg:grid-cols-12 items-stretch">
                {/* Audit Trail (6/12 Cols) - min-h-[350px] */}
                <div className="lg:col-span-6 flex flex-col">
                  <GlowCard
                    accent="primary"
                    className="h-full min-h-[350px] p-6 flex flex-col justify-between space-y-4"
                  >
                    <CardHeader className="p-0 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <GitBranch className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-bold">
                              Consortium Audit Trail
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Immutable HIPAA log events across node clusters
                            </CardDescription>
                          </div>
                        </div>
                        <Link
                          to="/admin/audit"
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0 whitespace-nowrap"
                        >
                          Full Log <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 flex flex-col justify-between">
                      {auditEvents.length === 0 ? (
                        <div className="p-4 rounded-xl bg-muted/40 border border-border text-center text-xs text-muted-foreground italic my-auto">
                          No recent audit logs recorded. Cryptographic access events will populate
                          here.
                        </div>
                      ) : (
                        <div className="space-y-1 divide-y divide-border/60">
                          {auditEvents.slice(0, 4).map((evt: any, idx: number) => (
                            // `evt.result` does not exist — getAuditEvents returns
                            // `outcome`, whose values are success | failure |
                            // unauthorized. So the ternaries never matched and
                            // `{evt.result || "success"}` printed "success" for
                            // every row: an UNAUTHORIZED PHI access attempt was
                            // displayed with a green SUCCESS badge on the security
                            // dashboard, which is the exact inverse of its meaning.
                            <ActivityItem
                              key={evt.txId || evt.id || idx}
                              icon={Lock}
                              severity={
                                evt.outcome === "unauthorized" || evt.outcome === "failure"
                                  ? "critical"
                                  : "success"
                              }
                              title={evt.action || "Data Access Event"}
                              subtitle={`By ${evt.actorName || evt.actor || evt.actorRole || "System"} — ${evt.resource || "access"}`}
                              badge={
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-mono uppercase ${
                                    evt.outcome === "unauthorized" || evt.outcome === "failure"
                                      ? "bg-destructive/10 text-destructive border-destructive/30"
                                      : "bg-success/10 text-success border-success/30"
                                  }`}
                                >
                                  {evt.outcome ?? "unknown"}
                                </Badge>
                              }
                              isLast={idx === Math.min(auditEvents.length, 4) - 1}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </GlowCard>
                </div>

                {/* Fleet & Assets Status (6/12 Cols) - Matched Height min-h-[350px] & Zero Text-Wrap */}
                <div className="lg:col-span-6 flex flex-col">
                  <GlowCard
                    accent="primary"
                    className="h-full min-h-[350px] p-6 flex flex-col justify-between space-y-4"
                  >
                    <CardHeader className="p-0 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
                            <Ambulance className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-bold">
                              Emergency Ambulance & Assets
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Fleet dispatch & medical equipment readiness
                            </CardDescription>
                          </div>
                        </div>
                        <Link
                          to="/staff/emergency"
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0 whitespace-nowrap"
                        >
                          Dispatch Console <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 flex flex-col justify-between space-y-4">
                      {/* Flat Stat Summary Row */}
                      <div className="flex items-center gap-6 text-xs border-b border-border/50 pb-3 font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-success" />
                          <span className="text-foreground">
                            {availableAmbulances} / {ambulances.length} Ambulances Ready
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          <span>
                            {operationalEquipment} / {equipment.length} Assets Operational
                          </span>
                        </div>
                      </div>

                      {/* Fleet & Equipment List (Full height coverage) */}
                      <div className="space-y-1.5 flex-1">
                        {ambulances.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center py-4 italic">
                            No active ambulance units logged in dispatch network
                          </div>
                        ) : (
                          ambulances.slice(0, 2).map((amb: any, idx: number) => {
                            const vehicleCode = amb.vehicleNo || `AMB-0${idx + 1}`;
                            const typeCode = amb.type?.toUpperCase() || "ALS";
                            const isAvailable = amb.status === "available";

                            return (
                              <div
                                key={amb.id || vehicleCode}
                                className="flex items-center justify-between py-2 px-2.5 hover:bg-muted/40 rounded-lg transition-colors border-b border-border/40 text-xs"
                              >
                                <div className="flex items-center gap-3">
                                  <Ambulance
                                    className={`h-4 w-4 shrink-0 ${isAvailable ? "text-success" : "text-primary"}`}
                                  />
                                  <div>
                                    <div className="flex items-center gap-2 font-mono font-bold text-foreground">
                                      <span>{vehicleCode}</span>
                                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                        {typeCode}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                      {/* Dispatch reads this to decide where a
                                          unit is. "Station" as a stand-in for
                                          unknown sends someone to the wrong
                                          place, so show the gap. */}
                                      Driver: {amb.driver || "—"} · Loc: {amb.location || "Unknown"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0 whitespace-nowrap">
                                  <span
                                    className={`h-2 w-2 rounded-full ${isAvailable ? "bg-success" : "bg-primary"}`}
                                  />
                                  <span className={isAvailable ? "text-success" : "text-primary"}>
                                    {isAvailable ? "Available" : "In Use"}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}

                        {/* Equipment rows — real assets, not a painted one.
                            This was a hardcoded "EQ-101 · VENTILATOR · ICU Node
                            #02 · Calibrated · Operational": a life-support device
                            that does not exist, shown as ready, on the console an
                            administrator uses to judge readiness. The equipment
                            table is already loaded above for the counter. */}
                        {equipment.slice(0, 2).map((eq: any, idx: number) => {
                          const code = eq.asset_tag || eq.equipment_id || `EQ-${idx + 1}`;
                          const kind = String(eq.category || eq.type || "EQUIPMENT").toUpperCase();
                          const isOperational = eq.status === "available";
                          return (
                            <div
                              key={eq.equipment_id || code}
                              className="flex items-center justify-between py-2 px-2.5 hover:bg-muted/40 rounded-lg transition-colors text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <Wrench
                                  className={`h-4 w-4 shrink-0 ${isOperational ? "text-success" : "text-warning"}`}
                                />
                                <div>
                                  <div className="flex items-center gap-2 font-mono font-bold text-foreground">
                                    <span>{code}</span>
                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                      {kind}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {[eq.location, eq.status].filter(Boolean).join(" · ") || "—"}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0 whitespace-nowrap">
                                <span
                                  className={`h-2 w-2 rounded-full ${isOperational ? "bg-success" : "bg-warning"}`}
                                />
                                <span className={isOperational ? "text-success" : "text-warning"}>
                                  {isOperational ? "Operational" : (eq.status ?? "Unknown")}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Equipment Readiness Progress Bar Footer */}
                      <div className="pt-2 border-t border-border/50 space-y-1.5">
                        {/* Was hardcoded to 100%. An emergency-readiness figure
                            that always reads "fully ready" is worse than none. */}
                        <GradientProgress
                          value={
                            equipment.length
                              ? Math.round((operationalEquipment / equipment.length) * 100)
                              : 0
                          }
                          tone="cyan"
                          showLabel
                          label="Emergency Asset Readiness Rate"
                          height={6}
                        />
                      </div>
                    </CardContent>
                  </GlowCard>
                </div>
              </div>
            </StaggerItem>

            {/* Bento Row 4: Consortium Admin Navigation Modules (6 Bento Cards) */}
            <StaggerItem>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-extrabold text-foreground tracking-tight">
                    Consortium Admin Portal Modules
                  </h3>
                  <span className="text-xs text-muted-foreground font-medium">
                    Direct Shortcuts
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Link to="/did-explorer" className="group">
                    <GlowCard className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">
                          {registeredDIDs.length} DIDs Registered
                        </Badge>
                      </div>
                      <h4 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                        DID Explorer & Registry
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Inspect W3C Decentralized Identifiers, approve DID requests, and review NFC
                        bindings.
                      </p>
                    </GlowCard>
                  </Link>

                  <Link to="/audit-timeline" className="group">
                    <GlowCard className="p-5 space-y-3" accent="destructive">
                      <div className="flex items-center justify-between">
                        <div className="h-11 w-11 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Lock className="h-5 w-5" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">
                          HIPAA Immutable
                        </Badge>
                      </div>
                      <h4 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                        Security & Audit Trail
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Monitor live immutable PHI access logs and cryptographic transaction hashes.
                      </p>
                    </GlowCard>
                  </Link>

                  <Link to="/staff/command" className="group">
                    <GlowCard className="p-5 space-y-3" accent="success">
                      <div className="flex items-center justify-between">
                        <div className="h-11 w-11 rounded-xl bg-success/15 text-success flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">
                          Hospital Ops
                        </Badge>
                      </div>
                      <h4 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                        Hospital Command Center
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Real-time bed occupancy, emergency room allocation, and live doctor locator.
                      </p>
                    </GlowCard>
                  </Link>

                  <Link to="/admin/people" className="group">
                    <GlowCard className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-11 w-11 rounded-xl bg-chart-4/15 text-chart-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Users className="h-5 w-5" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">
                          {livePatientsCount + liveStaffCount} Accounts
                        </Badge>
                      </div>
                      <h4 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                        Patient & Staff Directory
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Browse patient health records, admissions, and clinician account details.
                      </p>
                    </GlowCard>
                  </Link>

                  <Link to="/staff/tracker" className="group">
                    <GlowCard className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Activity className="h-5 w-5" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">
                          Live Tracking
                        </Badge>
                      </div>
                      <h4 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                        Live Doctor Location Tracker
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        View room presence logs, Merkle root verification, and Solana Devnet state.
                      </p>
                    </GlowCard>
                  </Link>
                </div>
              </div>
            </StaggerItem>
          </StaggerList>
        </div>
      </div>
    </RouteGuard>
  );
}
