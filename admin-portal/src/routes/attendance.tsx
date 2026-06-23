import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, UserCheck, Clock, UserX, UserCog,
  Search, ArrowRightLeft, LogIn, LogOut, CalendarClock
} from "lucide-react";
import {
  todayStaffAttendance, visitorLog, patientMovements, attendanceStats
} from "@/lib/attendance-data";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [{ title: "Attendance Monitor — Admin Console" }],
  }),
  component: AttendanceMonitor,
});

function AttendanceMonitor() {
  const [search, setSearch] = useState("");

  const filteredStaff = todayStaffAttendance.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.department.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  const filteredVisitors = visitorLog.filter(v =>
    v.visitorName.toLowerCase().includes(search.toLowerCase()) ||
    v.visitingPatient.toLowerCase().includes(search.toLowerCase()) ||
    v.ward.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (status: string) => {
    switch (status) {
      case "present":      return "bg-success/10 text-success";
      case "late":         return "bg-warning/10 text-warning-foreground";
      case "absent":       return "bg-destructive/10 text-destructive";
      case "on-leave":
      case "half-day":     return "bg-muted text-muted-foreground";
      default:             return "bg-muted text-muted-foreground";
    }
  };

  const visitorStatusColor = (status: string) => {
    switch (status) {
      case "inside":       return "bg-success/10 text-success";
      case "checked-out":  return "bg-muted text-muted-foreground";
      case "denied":       return "bg-destructive/10 text-destructive";
      default:             return "bg-muted text-muted-foreground";
    }
  };

  const movementIcon: Record<string, React.ComponentType<{ className?: string }>> = {
    admission:     LogIn,
    discharge:     LogOut,
    transfer:      ArrowRightLeft,
    "procedure-out": LogOut,
    "procedure-in":  LogIn,
    leave:         LogOut,
    return:        LogIn,
  };

  return (
    <RouteGuard requiredRole="admin">
      <>
        <PageHeader
          eyebrow="Admin console"
          title="Attendance Monitor"
          description="Real-time staff attendance, patient movements, and visitor log"
        />

        <div className="space-y-6 p-6 sm:p-8">
          {/* Stats row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Staff Present"     value={`${attendanceStats.present}/${attendanceStats.totalStaff}`} delta={`${attendanceStats.late} late today`}    icon={UserCheck}  tone="success" />
            <StatCard label="Staff Absent"      value={attendanceStats.absent}          delta={`${attendanceStats.onLeave} on leave`}                               icon={UserX} />
            <StatCard label="Visitors Inside"   value={`${attendanceStats.visitorsInside}/${attendanceStats.visitorsToday}`} delta="Today's total"                  icon={Users} />
            <StatCard label="Patient Movements" value={attendanceStats.patientMovementsToday} delta={`${attendanceStats.patientsAdmitted} admitted today`}          icon={ArrowRightLeft} />
          </div>

          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, department, ward, or patient..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Main Tabs */}
          <Tabs defaultValue="staff">
            <TabsList>
              <TabsTrigger value="staff">Staff Attendance</TabsTrigger>
              <TabsTrigger value="patients">Patient Movements</TabsTrigger>
              <TabsTrigger value="visitors">Visitor Log</TabsTrigger>
            </TabsList>

            {/* ── Staff Attendance ── */}
            <TabsContent value="staff" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Today — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</CardTitle>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="text-success font-medium">{attendanceStats.present} Present</span>
                      <span className="text-warning-foreground font-medium">{attendanceStats.late} Late</span>
                      <span className="text-destructive font-medium">{attendanceStats.absent} Absent</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="pb-2 text-left font-medium">Name</th>
                          <th className="pb-2 text-left font-medium hidden sm:table-cell">Department</th>
                          <th className="pb-2 text-left font-medium hidden md:table-cell">Shift</th>
                          <th className="pb-2 text-center font-medium">Check-in</th>
                          <th className="pb-2 text-center font-medium">Check-out</th>
                          <th className="pb-2 text-center font-medium hidden lg:table-cell">Hours</th>
                          <th className="pb-2 text-right font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStaff.map((s) => (
                          <tr key={s.employeeId} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2.5">
                              <div className="font-medium">{s.name}</div>
                              <div className="text-xs text-muted-foreground">{s.role}</div>
                            </td>
                            <td className="py-2.5 hidden sm:table-cell text-muted-foreground">{s.department}</td>
                            <td className="py-2.5 hidden md:table-cell text-muted-foreground font-mono text-xs">{s.shift}</td>
                            <td className="py-2.5 text-center font-mono text-xs">
                              {s.checkIn ? (
                                <span className="inline-flex items-center gap-1 text-success">
                                  <LogIn className="h-3 w-3" />{s.checkIn}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-2.5 text-center font-mono text-xs">
                              {s.checkOut ? (
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <LogOut className="h-3 w-3" />{s.checkOut}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-2.5 text-center hidden lg:table-cell text-muted-foreground text-xs">
                              {s.workHours}
                            </td>
                            <td className="py-2.5 text-right">
                              <Badge className={`capitalize text-xs ${statusColor(s.status)}`}>
                                {s.status.replace("-", " ")}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Patient Movements ── */}
            <TabsContent value="patients" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Patient In/Out Movements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {patientMovements.map((pm) => {
                      const Icon = movementIcon[pm.event] ?? ArrowRightLeft;
                      const isIn = ["admission", "procedure-in", "return"].includes(pm.event);
                      return (
                        <div key={pm.id} className="flex items-start gap-3 rounded-lg border p-3">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isIn ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-medium">{pm.patientName}</span>
                                <span className="text-xs text-muted-foreground ml-2">({pm.mrn})</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                <CalendarClock className="h-3 w-3" />
                                {pm.date} {pm.time}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground capitalize">
                              {pm.event.replace(/-/g, " ")} · {pm.ward} {pm.room && `· Room ${pm.room}`}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Handled by: {pm.handledBy}
                            </div>
                            {pm.notes && <div className="text-xs text-muted-foreground italic mt-0.5">{pm.notes}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Visitor Log ── */}
            <TabsContent value="visitors" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Visitor Log — Today</CardTitle>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="text-success font-medium">{attendanceStats.visitorsInside} Inside</span>
                      <span className="font-medium">{attendanceStats.visitorsToday} Total</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="pb-2 text-left font-medium">Visitor</th>
                          <th className="pb-2 text-left font-medium hidden sm:table-cell">Visiting</th>
                          <th className="pb-2 text-left font-medium hidden md:table-cell">Ward</th>
                          <th className="pb-2 text-center font-medium">In</th>
                          <th className="pb-2 text-center font-medium">Out</th>
                          <th className="pb-2 text-right font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVisitors.map((v) => (
                          <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2.5">
                              <div className="font-medium">{v.visitorName}</div>
                              <div className="text-xs text-muted-foreground">{v.relationship} · {v.visitorPhone}</div>
                            </td>
                            <td className="py-2.5 hidden sm:table-cell">
                              <div>{v.visitingPatient}</div>
                              <div className="text-xs text-muted-foreground">{v.patientMRN}</div>
                            </td>
                            <td className="py-2.5 hidden md:table-cell text-muted-foreground">{v.ward}</td>
                            <td className="py-2.5 text-center font-mono text-xs">
                              <span className="inline-flex items-center gap-1 text-success">
                                <LogIn className="h-3 w-3" />{v.checkIn}
                              </span>
                            </td>
                            <td className="py-2.5 text-center font-mono text-xs">
                              {v.checkOut ? (
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <LogOut className="h-3 w-3" />{v.checkOut}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-2.5 text-right">
                              <Badge className={`text-xs ${visitorStatusColor(v.status)}`}>
                                {v.status.replace("-", " ")}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </>
    </RouteGuard>
  );
}
