import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  Users,
  FileCheck,
  Clock,
  Activity,
  AlertTriangle,
  Building2,
  FileText,
  Search,
  CheckCircle2,
  UserPlus,
  RefreshCw,
  Database,
  UserCheck,
  LogIn,
  LogOut,
  CalendarCheck,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth-context";
import {
  getDIDRequests,
  approveDIDRequest,
  rejectDIDRequest,
  getAllDIDs,
  createDID,
  getUsers,
  API_BASE_URL,
} from "@/lib/api";
import { toast } from "sonner";
import { useDIDs, useLivePatients, useLiveStaff, useAdminAttendance } from "@/hooks/use-api";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Portal — Embrace Health Grid" },
      { name: "description", content: "Hospital Consortium Governance & Administration Hub" },
    ],
  }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const { user: currentUser } = useCurrentUser();
  const { data: didsData, refetch: refetchDIDs } = useDIDs();
  const { patients } = useLivePatients();
  const { staff } = useLiveStaff();
  const { data: adminAttendance, refetch: refetchAdminAttendance } = useAdminAttendance();

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [didRequests, setDidRequests] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Quick Issue DID Form state
  const [issueName, setIssueName] = useState("");
  const [issueEmail, setIssueEmail] = useState("");
  const [issueType, setIssueType] = useState<"doctor" | "staff" | "patient">("doctor");
  const [issuingDID, setIssuingDID] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const [reqRes, usersRes] = await Promise.all([
        getDIDRequests().catch(() => ({ requests: [] })),
        getUsers().catch(() => ({ users: [] })),
      ]);
      if (reqRes && reqRes.requests) {
        setDidRequests(reqRes.requests || []);
      }
      if (usersRes && usersRes.users) {
        setAllUsers(usersRes.users || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (reqId: string, ownerName: string) => {
    setApprovingId(reqId);
    try {
      const res = await approveDIDRequest(reqId);
      if (res.success) {
        toast.success(`Official DID Issued!`, {
          description: `Issued ${res.did} to ${ownerName}.`,
        });
        fetchRequests();
        refetchDIDs();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to approve DID request");
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveUserDID = async (user: any) => {
    const key = user.email;
    setApprovingId(key);
    try {
      const pendingReq = didRequests.find(
        (r) => r.ownerEmail?.toLowerCase() === user.email?.toLowerCase() && r.status === "pending",
      );
      if (pendingReq) {
        const res = await approveDIDRequest(pendingReq.id);
        if (res.success) {
          toast.success(`Official DID Issued!`, {
            description: `Issued ${res.did} to ${user.name || user.email}.`,
          });
        }
      } else {
        const res = await createDID(
          user.name || user.email.split("@")[0],
          user.role || "doctor",
          undefined,
          user.email,
        );
        if (res && res.did) {
          toast.success(`Official DID Issued!`, {
            description: `Issued ${res.did} to ${user.name || user.email}.`,
          });
        }
      }
      fetchRequests();
      refetchDIDs();
    } catch (err: any) {
      toast.error(err.message || "Failed to issue DID");
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (reqId: string) => {
    try {
      const res = await rejectDIDRequest(reqId);
      if (res.success) {
        toast.info("DID Request rejected.");
        fetchRequests();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reject DID request");
    }
  };

  const handleDirectIssueDID = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueName || !issueEmail) {
      toast.error("Please provide both name and email.");
      return;
    }
    setIssuingDID(true);
    try {
      const res = await createDID(issueName, issueType, undefined, issueEmail);
      if (res && res.did) {
        toast.success(`DID Issued: ${res.did}`, {
          description: `Successfully bound to ${issueEmail}.`,
        });
        setIssueName("");
        setIssueEmail("");
        refetchDIDs();
        fetchRequests();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to issue DID");
    } finally {
      setIssuingDID(false);
    }
  };

  const registeredDIDs = didsData?.dids || [];
  const pendingRequests = didRequests.filter((r) => r.status === "pending");

  const clinicianRoster = (() => {
    const map = new Map<string, any>();
    (staff || []).forEach((s: any) => {
      const email = s.email || s.id;
      if (email) {
        map.set(email.toLowerCase(), {
          name: s.name || "Clinician",
          email: email,
          role: s.role || "doctor",
          department: s.department || "Cardiology",
          did: s.did,
        });
      }
    });
    (allUsers || []).forEach((u: any) => {
      if (u.role === "doctor" || u.role === "staff" || u.role === "admin") {
        const email = u.email;
        if (email) {
          const existing = map.get(email.toLowerCase());
          map.set(email.toLowerCase(), {
            name: u.name || existing?.name || email.split("@")[0],
            email: email,
            role: u.role || existing?.role || "doctor",
            department: u.department || existing?.department || "General Medicine",
            did: u.did || existing?.did,
          });
        }
      }
    });
    // Add default seeded doctor if missing
    if (!map.has("ravi.menon@apollohospitals.com")) {
      map.set("ravi.menon@apollohospitals.com", {
        name: "Dr. Ravi Menon",
        email: "ravi.menon@apollohospitals.com",
        role: "doctor",
        department: "Cardiology",
        did: null,
      });
    }
    return Array.from(map.values());
  })();

  return (
    <RouteGuard requiredRole="admin">
      <div className="min-h-screen pb-12">
        <PageHeader
          eyebrow="Consortium Governance"
          title="Admin Control Center"
          description={`Logged in as System Administrator (${currentUser?.email || "admin@example.com"})`}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchRequests();
                refetchDIDs();
                toast.info("Refreshed consortium state");
              }}
              className="gap-2 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Sync State
            </Button>
          }
        />

        <div className="p-6 space-y-8 max-w-7xl mx-auto">
          {/* Key Metrics Overview */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-border/80 bg-card shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Total DIDs Issued
                  </p>
                  <h3 className="text-2xl font-extrabold text-foreground mt-1">
                    {registeredDIDs.length}
                  </h3>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                    Pending DID Requests
                  </p>
                  <h3 className="text-2xl font-extrabold text-amber-500 mt-1">
                    {pendingRequests.length}
                  </h3>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Total Clinicians & Staff
                  </p>
                  <h3 className="text-2xl font-extrabold text-foreground mt-1">
                    {clinicianRoster.length}
                  </h3>
                </div>
                <div className="h-12 w-12 rounded-xl bg-chart-2/10 text-chart-2 flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Registered Patients
                  </p>
                  <h3 className="text-2xl font-extrabold text-foreground mt-1">
                    {patients?.length || 24}
                  </h3>
                </div>
                <div className="h-12 w-12 rounded-xl bg-success/10 text-success flex items-center justify-center">
                  <Activity className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Clinician & Staff DID Approval Roster */}
          <Card className="border-2 border-primary/40 bg-gradient-to-br from-card via-card to-primary/5 shadow-clinical">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg font-bold">
                    Clinician & Staff DID Approval & Issuance Roster
                  </CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold uppercase"
                >
                  Admin Authority
                </Badge>
              </div>
              <CardDescription>
                Review all registered doctors and staff members. Click &quot;Approve & Issue
                DID&quot; to issue an official W3C Decentralized Identifier for any clinician.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {clinicianRoster.map((clinician) => {
                  // Find active DID in registeredDIDs
                  const activeDidEntry = registeredDIDs.find(
                    (d: any) =>
                      (d.ownerEmail &&
                        d.ownerEmail.toLowerCase() === clinician.email.toLowerCase()) ||
                      (d.did && clinician.did && d.did === clinician.did),
                  );
                  const activeDid =
                    activeDidEntry?.did ||
                    (clinician.did && clinician.did.startsWith("did:hosp:") ? clinician.did : null);
                  const pendingReq = didRequests.find(
                    (r) =>
                      r.ownerEmail?.toLowerCase() === clinician.email.toLowerCase() &&
                      r.status === "pending",
                  );
                  const key = clinician.email;

                  return (
                    <div
                      key={key}
                      className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between space-y-3 shadow-sm"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-sm">
                            {clinician.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase font-bold"
                          >
                            {clinician.role}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{clinician.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Department:{" "}
                          <span className="font-semibold text-foreground">
                            {clinician.department}
                          </span>
                        </p>
                        <div className="mt-2 pt-2 border-t border-border">
                          {activeDid ? (
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-bold text-success uppercase flex items-center gap-1">
                                🟢 Official W3C DID Issued
                              </span>
                              <p className="font-mono text-[10px] text-primary break-all bg-muted/60 p-1.5 rounded border">
                                {activeDid}
                              </p>
                            </div>
                          ) : pendingReq ? (
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1">
                                🟡 Request Pending (Submitted{" "}
                                {new Date(pendingReq.requestedAt).toLocaleDateString()})
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-bold text-destructive uppercase flex items-center gap-1">
                                ⚠️ No Official DID Issued
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="pt-2">
                        {activeDid ? (
                          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-2 py-1 bg-success/10 rounded-lg text-success border border-success/20">
                            <span>Verified Clinician DID</span>
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleApproveUserDID(clinician)}
                            disabled={approvingId === key}
                            className="w-full bg-success text-success-foreground hover:bg-success/90 text-xs font-bold py-2 shadow-sm"
                          >
                            {approvingId === key ? "Issuing W3C DID..." : "Approve & Issue W3C DID"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Staff Attendance Governance & Real-Time Roster */}
          <Card className="border-2 border-emerald-500/40 bg-gradient-to-br from-card via-card to-emerald-500/5 shadow-clinical">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-emerald-500" />
                  <CardTitle className="text-lg font-bold">
                    Staff Attendance Real-Time Roster (DID Verified)
                  </CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold uppercase flex items-center gap-1"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live WS
                  Sync
                </Badge>
              </div>
              <CardDescription>
                Track real-time attendance for all staff members who have been issued an official
                W3C DID by Admin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Daily Attendance Summary Cards */}
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="p-3 rounded-xl bg-card border border-border flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      Eligible Staff
                    </span>
                    <p className="text-xl font-extrabold text-foreground">
                      {adminAttendance?.summary?.totalEligibleStaff || 0}
                    </p>
                  </div>
                  <UserCheck className="h-5 w-5 text-primary opacity-80" />
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase">
                      Checked In
                    </span>
                    <p className="text-xl font-extrabold text-emerald-600">
                      {adminAttendance?.summary?.checkedInCount || 0}
                    </p>
                  </div>
                  <LogIn className="h-5 w-5 text-emerald-600 opacity-80" />
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-blue-600 uppercase">
                      Checked Out
                    </span>
                    <p className="text-xl font-extrabold text-blue-600">
                      {adminAttendance?.summary?.checkedOutCount || 0}
                    </p>
                  </div>
                  <LogOut className="h-5 w-5 text-blue-600 opacity-80" />
                </div>
                <div className="p-3 rounded-xl bg-muted/60 border border-border flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      Absent / Unmarked
                    </span>
                    <p className="text-xl font-extrabold text-muted-foreground">
                      {adminAttendance?.summary?.absentToday || 0}
                    </p>
                  </div>
                  <Clock className="h-5 w-5 text-muted-foreground opacity-80" />
                </div>
              </div>

              {/* Roster Table / List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Today&apos;s Staff Attendance Status (
                  {adminAttendance?.summary?.date || new Date().toISOString().split("T")[0]})
                </h4>
                {!adminAttendance?.roster || adminAttendance.roster.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                    No staff members with active DIDs registered yet. Issue DIDs above to enable
                    staff attendance tracking.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {adminAttendance.roster.map((record: any) => {
                      const inTimeStr = record.checkInTime
                        ? new Date(record.checkInTime).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "–";
                      const outTimeStr = record.checkOutTime
                        ? new Date(record.checkOutTime).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "–";

                      return (
                        <div
                          key={record.did || record.staffEmail}
                          className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between space-y-3 shadow-sm"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-foreground text-sm">
                                {record.staffName}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] uppercase font-bold ${
                                  record.status === "checked-in"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                    : record.status === "checked-out"
                                      ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                                      : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {record.status === "checked-in"
                                  ? "🟢 Checked In"
                                  : record.status === "checked-out"
                                    ? "🔵 Checked Out"
                                    : "⚪ Absent"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">
                              {record.staffEmail}
                            </p>
                            <div className="flex items-center justify-between text-xs pt-1">
                              <span className="text-muted-foreground">
                                Staff ID:{" "}
                                <strong className="text-foreground font-mono">
                                  {record.staffId}
                                </strong>
                              </span>
                              <span className="text-muted-foreground">
                                Dept:{" "}
                                <strong className="text-foreground">{record.department}</strong>
                              </span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-border space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Check-In:</span>
                                <span className="font-semibold text-foreground">{inTimeStr}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Check-Out:</span>
                                <span className="font-semibold text-foreground">{outTimeStr}</span>
                              </div>
                            </div>
                          </div>
                          <div className="pt-1 border-t border-border">
                            <span className="font-mono text-[9px] text-muted-foreground truncate block">
                              DID: {record.did}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Navigation Hub */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-foreground">Admin Portal Modules</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                to="/did-explorer"
                className="group p-5 rounded-2xl border border-border bg-card shadow-sm hover:border-primary hover:shadow-clinical transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase">
                    Consortium DID
                  </Badge>
                </div>
                <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
                  DID Explorer & Registry
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Inspect all registered W3C DIDs, issue new DIDs, and link NFC patient cards.
                </p>
              </Link>

              <Link
                to="/credential-explorer"
                className="group p-5 rounded-2xl border border-border bg-card shadow-sm hover:border-primary hover:shadow-clinical transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-chart-2/10 text-chart-2 flex items-center justify-center">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase">
                    Credentials
                  </Badge>
                </div>
                <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
                  Verifiable Credentials
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Issue, verify, and revoke cryptographic health credentials across the hospital.
                </p>
              </Link>

              <Link
                to="/audit-timeline"
                className="group p-5 rounded-2xl border border-border bg-card shadow-sm hover:border-primary hover:shadow-clinical transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                    <Lock className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase">
                    HIPAA Ledger
                  </Badge>
                </div>
                <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
                  Security & Audit Trail
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Monitor live immutable PHI access logs and cryptographic transaction hashes.
                </p>
              </Link>

              <Link
                to="/staff/command"
                className="group p-5 rounded-2xl border border-border bg-card shadow-sm hover:border-primary hover:shadow-clinical transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase">
                    Hospital Ops
                  </Badge>
                </div>
                <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
                  Hospital Command Center
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Real-time bed occupancy, emergency room allocation, and live doctor locator.
                </p>
              </Link>

              <Link
                to="/staff/patients"
                className="group p-5 rounded-2xl border border-border bg-card shadow-sm hover:border-primary hover:shadow-clinical transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-chart-4/10 text-chart-4 flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase">
                    Users & Records
                  </Badge>
                </div>
                <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
                  Patient & Staff Directory
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Browse patient health records, admissions, and clinician account details.
                </p>
              </Link>

              <Link
                to="/staff/tracker"
                className="group p-5 rounded-2xl border border-border bg-card shadow-sm hover:border-primary hover:shadow-clinical transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Activity className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase">
                    Live Tracking
                  </Badge>
                </div>
                <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
                  Live Doctor Location Tracker
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  View room presence logs, Merkle root verification, and Solana Devnet state.
                </p>
              </Link>
            </div>
          </div>

          {/* Direct DID Issuance Console */}
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-bold">Direct Admin DID Issuance</CardTitle>
              </div>
              <CardDescription>
                Manually issue an official W3C DID for any user account by email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDirectIssueDID} className="grid gap-4 sm:grid-cols-3 items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="issueName" className="text-xs font-semibold">
                    Full Name
                  </Label>
                  <Input
                    id="issueName"
                    placeholder="e.g. Dr. Ananya Sharma"
                    value={issueName}
                    onChange={(e) => setIssueName(e.target.value)}
                    className="text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="issueEmail" className="text-xs font-semibold">
                    User Account Email
                  </Label>
                  <Input
                    id="issueEmail"
                    type="email"
                    placeholder="e.g. ananya@apollohospitals.com"
                    value={issueEmail}
                    onChange={(e) => setIssueEmail(e.target.value)}
                    className="text-xs"
                    required
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="space-y-1.5 flex-1">
                    <Label htmlFor="issueType" className="text-xs font-semibold">
                      Account Role
                    </Label>
                    <select
                      id="issueType"
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value as any)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground outline-none"
                    >
                      <option value="doctor">Doctor</option>
                      <option value="staff">Staff Member</option>
                      <option value="patient">Patient</option>
                    </select>
                  </div>
                  <Button
                    type="submit"
                    disabled={issuingDID}
                    className="h-9 text-xs font-bold px-4 bg-primary text-primary-foreground"
                  >
                    {issuingDID ? "Issuing..." : "Issue DID"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </RouteGuard>
  );
}
