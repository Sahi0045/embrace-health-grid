import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock, CheckCircle2, LogIn, LogOut, Calendar, TrendingUp,
  AlertCircle, Timer
} from "lucide-react";
import { myAttendanceHistory } from "@/lib/attendance-data";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/attendance")({
  head: () => ({
    meta: [{ title: "Attendance — Staff Portal" }],
  }),
  component: StaffAttendance,
});

function StaffAttendance() {
  const [clockedIn, setClockedIn] = useState(true);  // Dr. Menon already clocked in
  const [checkInTime] = useState("07:52");
  const now = new Date();

  const handleClockIn = () => {
    setClockedIn(true);
    toast.success("Clocked in", { description: `${now.toLocaleTimeString()} — Have a great shift!` });
  };

  const handleClockOut = () => {
    setClockedIn(false);
    toast("Clocked out", { description: `${now.toLocaleTimeString()} — See you next shift.` });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "present":  return "bg-success/10 text-success";
      case "late":     return "bg-warning/10 text-warning-foreground";
      case "absent":   return "bg-destructive/10 text-destructive";
      case "on-leave": return "bg-muted text-muted-foreground";
      default:         return "bg-muted text-muted-foreground";
    }
  };

  const present  = myAttendanceHistory.filter(d => d.status === "present").length;
  const absent   = myAttendanceHistory.filter(d => d.status === "absent").length;
  const onLeave  = myAttendanceHistory.filter(d => d.status === "on-leave").length;

  return (
    <RouteGuard requiredRole="staff">
      <>
        <PageHeader
          eyebrow="Staff portal"
          title="My Attendance"
          description="Clock in / out and track your attendance history"
        />

        <div className="space-y-6 p-6 sm:p-8">
          {/* Clock-in card */}
          <Card className={`border-2 ${clockedIn ? "border-success/40 bg-success/5" : "border-border"}`}>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-2xl font-bold">
                    {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </div>
                  {clockedIn && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      Clocked in at {checkInTime} — Shift: 08:00–16:00 · Cardiology OPD
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  {!clockedIn ? (
                    <Button size="lg" onClick={handleClockIn}>
                      <LogIn className="mr-2 h-5 w-5" />Clock In
                    </Button>
                  ) : (
                    <Button size="lg" variant="destructive" onClick={handleClockOut}>
                      <LogOut className="mr-2 h-5 w-5" />Clock Out
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Present days" value={`${present}/7`} delta="This week" icon={CheckCircle2} tone="success" />
            <StatCard label="Absent"        value={absent}        delta="This week" icon={AlertCircle} />
            <StatCard label="On leave"      value={onLeave}       delta="This week" icon={Calendar} />
            <StatCard label="Total hours"   value="42h 46m"       delta="This month" icon={Timer} tone="success" />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="history">
            <TabsList>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="leave">Leave Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Last 7 Days</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {myAttendanceHistory.map((day, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <div className="text-center w-10">
                            <div className="text-xs text-muted-foreground">{day.day}</div>
                            <div className="font-medium">{day.date.slice(8)}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium">Shift: {day.shift}</div>
                            <div className="text-xs text-muted-foreground">
                              {day.checkIn ? `In: ${day.checkIn}` : "–"}
                              {day.checkOut ? `  ·  Out: ${day.checkOut}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {day.hours && day.hours !== "–" && (
                            <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" /> {day.hours}
                            </div>
                          )}
                          <Badge className={`capitalize ${statusColor(day.status)}`}>
                            {day.status.replace("-", " ")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leave" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Leave Requests</CardTitle>
                    <Button size="sm">Apply Leave</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { id: "LV-001", type: "Casual Leave",   from: "2026-05-27", to: "2026-05-27", days: 1, reason: "Personal work",         status: "approved" },
                      { id: "LV-002", type: "Medical Leave",  from: "2026-06-10", to: "2026-06-11", days: 2, reason: "Medical consultation",   status: "pending" },
                    ].map((leave) => (
                      <div key={leave.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-sm">{leave.type}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {new Date(leave.from).toLocaleDateString()} – {new Date(leave.to).toLocaleDateString()} · {leave.days} day{leave.days > 1 ? "s" : ""}
                            </div>
                            <div className="text-xs text-muted-foreground">{leave.reason}</div>
                          </div>
                          <Badge variant={leave.status === "approved" ? "default" : "secondary"} className="capitalize">
                            {leave.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
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
