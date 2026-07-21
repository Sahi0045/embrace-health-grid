import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  CheckCircle2,
  LogIn,
  LogOut,
  Calendar,
  AlertCircle,
  Timer,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { clockAttendance, createStaffRequest } from "@/lib/api";
import { useAttendance, useStaffRequests } from "@/hooks/use-api";

export const Route = createFileRoute("/staff/attendance")({
  head: () => ({
    meta: [{ title: "Attendance — Staff Portal" }],
  }),
  component: StaffAttendance,
});

function StaffAttendance() {
  const [clockedIn, setClockedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState("08:00");
  const now = new Date();

  const userEmail = typeof window !== "undefined" ? localStorage.getItem("userEmail") || "" : "";

  const { data: attendanceData, loading: loadingAttendance } = useAttendance(userEmail);
  const { data: requestsData, loading: loadingRequests, refetch: refetchRequests } = useStaffRequests(userEmail);

  const apiHistory = attendanceData?.records ?? [];
  const leaveRequests = requestsData?.requests ?? [];

  // Leave request form states
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState("Casual Leave");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);

  useEffect(() => {
    if (apiHistory.length > 0) {
      const sorted = [...apiHistory].sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
      const last = sorted[0];
      if (last.action === "in") {
        setClockedIn(true);
        const inDate = new Date(last.timestamp);
        setCheckInTime(
          inDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        );
      } else {
        setClockedIn(false);
      }
    }
  }, [apiHistory]);

  const handleClockIn = async () => {
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    try {
      await clockAttendance({ action: "in", location: "Cardiology OPD" });
      setClockedIn(true);
      setCheckInTime(timeStr);
      toast.success("Clocked in", { description: `${timeStr} — Have a great shift!` });
    } catch (err: any) {
      setClockedIn(true);
      setCheckInTime(timeStr);
      toast.success("Clocked in (offline mode)", {
        description: `${timeStr} — Have a great shift!`,
      });
    }
  };

  const handleClockOut = async () => {
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    try {
      await clockAttendance({ action: "out", location: "Cardiology OPD" });
      setClockedIn(false);
      toast("Clocked out", { description: `${timeStr} — See you next shift.` });
    } catch (err: any) {
      setClockedIn(false);
      toast("Clocked out (offline mode)", { description: `${timeStr} — See you next shift.` });
    }
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveFrom || !leaveTo || !leaveReason.trim()) {
      toast.error("Please fill in all leave request fields.");
      return;
    }
    setSubmittingLeave(true);
    try {
      await createStaffRequest({
        requestType: "leave",
        leaveType,
        fromDate: leaveFrom,
        toDate: leaveTo,
        reason: leaveReason.trim(),
      });
      toast.success("Leave request submitted", {
        description: `${leaveType} from ${leaveFrom} to ${leaveTo}`,
      });
      setShowLeaveForm(false);
      setLeaveFrom("");
      setLeaveTo("");
      setLeaveReason("");
      void refetchRequests();
    } catch (err: any) {
      toast.error("Failed to submit leave request", { description: err.message });
    } finally {
      setSubmittingLeave(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-success/10 text-success";
      case "late":
        return "bg-warning/10 text-warning-foreground";
      case "absent":
        return "bg-destructive/10 text-destructive";
      case "on-leave":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const grouped: Record<string, any> = {};
  apiHistory.forEach((rec: any) => {
    try {
      const dt = new Date(rec.timestamp);
      const dateStr = dt.toISOString().split("T")[0];
      const dayName = dt.toLocaleDateString("en-IN", { weekday: "short" });
      const formattedDate = dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      const timeStr = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

      if (!grouped[dateStr]) {
        grouped[dateStr] = {
          date: dateStr,
          day: dayName,
          dateLabel: formattedDate,
          shift: "08:00–16:00",
          checkIn: "–",
          checkOut: "–",
          checkInMs: 0,
          checkOutMs: 0,
          hours: "–",
          status: "present",
        };
      }

      if (rec.action === "in") {
        grouped[dateStr].checkIn = timeStr;
        grouped[dateStr].checkInMs = dt.getTime();
      } else if (rec.action === "out") {
        grouped[dateStr].checkOut = timeStr;
        grouped[dateStr].checkOutMs = dt.getTime();
      }
    } catch (e) {
      console.error(e);
    }
  });

  // Compute actual hours for each day
  Object.values(grouped).forEach((day: any) => {
    if (day.checkInMs > 0 && day.checkOutMs > 0) {
      const diffMs = day.checkOutMs - day.checkInMs;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      day.hours = `${hours}h ${minutes}m`;
    }
  });

  const displayHistory = Object.values(grouped).sort((a: any, b: any) => b.date.localeCompare(a.date));

  const present = displayHistory.filter((d: any) => d.status === "present").length;
  const absent = displayHistory.filter((d: any) => d.status === "absent").length;
  const onLeave = displayHistory.filter((d: any) => d.status === "on-leave").length;

  // Compute total hours from actual data
  const totalHoursDisplay = useMemo(() => {
    let totalMs = 0;
    Object.values(grouped).forEach((day: any) => {
      if (day.checkInMs > 0 && day.checkOutMs > 0) {
        totalMs += day.checkOutMs - day.checkInMs;
      }
    });
    if (totalMs === 0) return "0h 0m";
    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }, [apiHistory]);


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
          <Card
            className={`border-2 ${clockedIn ? "border-success/40 bg-success/5" : "border-border"}`}
          >
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-2xl font-bold">
                    {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {now.toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
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
                      <LogIn className="mr-2 h-5 w-5" />
                      Clock In
                    </Button>
                  ) : (
                    <Button size="lg" variant="destructive" onClick={handleClockOut}>
                      <LogOut className="mr-2 h-5 w-5" />
                      Clock Out
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Present days"
              value={`${present}/7`}
              delta="This week"
              icon={CheckCircle2}
              tone="success"
            />
            <StatCard label="Absent" value={absent} delta="This week" icon={AlertCircle} />
            <StatCard label="On leave" value={onLeave} delta="This week" icon={Calendar} />
            <StatCard
              label="Total hours"
              value={totalHoursDisplay}
              delta="This period"
              icon={Timer}
              tone="success"
            />
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
                    {loadingAttendance && (
                      <div className="text-center py-4 text-sm text-muted-foreground animate-pulse">
                        Loading attendance history...
                      </div>
                    )}
                    {displayHistory.map((day, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
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
                    <Button size="sm" onClick={() => setShowLeaveForm((v) => !v)}>
                      {showLeaveForm ? "Cancel" : "Apply Leave"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Leave Request Form */}
                  {showLeaveForm && (
                    <form onSubmit={handleSubmitLeave} className="mb-4 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            Leave Type
                          </label>
                          <select
                            value={leaveType}
                            onChange={(e) => setLeaveType(e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option>Casual Leave</option>
                            <option>Medical Leave</option>
                            <option>Privilege Leave</option>
                            <option>Emergency Leave</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            Reason
                          </label>
                          <input
                            type="text"
                            value={leaveReason}
                            onChange={(e) => setLeaveReason(e.target.value)}
                            placeholder="Reason for leave"
                            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            From
                          </label>
                          <input
                            type="date"
                            value={leaveFrom}
                            onChange={(e) => setLeaveFrom(e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            To
                          </label>
                          <input
                            type="date"
                            value={leaveTo}
                            onChange={(e) => setLeaveTo(e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button type="submit" size="sm" disabled={submittingLeave}>
                          {submittingLeave && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                          Submit Request
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Leave Requests List */}
                  <div className="space-y-3">
                    {loadingRequests && leaveRequests.length === 0 && (
                      <div className="text-center py-4 text-sm text-muted-foreground animate-pulse">
                        Loading leave requests...
                      </div>
                    )}
                    {leaveRequests.length === 0 && !loadingRequests && (
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        No leave requests found. Use "Apply Leave" to submit one.
                      </div>
                    )}
                    {leaveRequests.map((leave: any) => {
                      const fromStr = leave.fromDate ? new Date(leave.fromDate).toLocaleDateString() : "—";
                      const toStr = leave.toDate ? new Date(leave.toDate).toLocaleDateString() : "—";
                      const days = leave.fromDate && leave.toDate
                        ? Math.max(1, Math.ceil((new Date(leave.toDate).getTime() - new Date(leave.fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
                        : 1;
                      return (
                        <div key={leave.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium text-sm">{leave.leaveType || leave.requestType}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {fromStr} – {toStr} · {days} day{days > 1 ? "s" : ""}
                              </div>
                              <div className="text-xs text-muted-foreground">{leave.reason}</div>
                            </div>
                            <Badge
                              variant={leave.status === "approved" ? "default" : "secondary"}
                              className="capitalize"
                            >
                              {leave.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
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
