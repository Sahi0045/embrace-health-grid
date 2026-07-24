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
  Lock,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getDIDRequests,
  approveDIDRequest,
  rejectDIDRequest,
  getAllDIDs,
  createDID,
  API_BASE_URL,
} from "@/lib/api";
import { toast } from "sonner";
import { useDIDs, useLivePatients, useLiveStaff } from "@/hooks/use-api";

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
  const currentUser = getCurrentUser();
  const { data: didsData, refetch: refetchDIDs } = useDIDs();
  const { patients } = useLivePatients();
  const { staff } = useLiveStaff();

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
      const res = await getDIDRequests();
      if (res && res.requests) {
        setDidRequests(res.requests || []);
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

  const pendingRequests = didRequests.filter((r) => r.status === "pending");
  const registeredDIDs = didsData?.dids || [];

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
                    {staff?.length || 12}
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

          {/* Pending DID Approval Center */}
          <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-500/5 shadow-clinical">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-lg font-bold">
                    Clinician & Staff DID Approval Queue ({pendingRequests.length})
                  </CardTitle>
                </div>
                <Badge variant="outline" className="bg-amber-500/15 text-amber-500 border-amber-500/30 text-[10px] font-bold uppercase">
                  Action Required
                </Badge>
              </div>
              <CardDescription>
                Review and issue official W3C Decentralized Identifiers for requested clinician accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRequests ? (
                <p className="text-xs text-muted-foreground py-4">Loading DID requests...</p>
              ) : pendingRequests.length === 0 ? (
                <div className="p-6 text-center border rounded-xl bg-muted/20 text-muted-foreground text-sm space-y-1">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-success/70" />
                  <p className="font-semibold text-foreground">No Pending DID Requests</p>
                  <p className="text-xs">All clinician and staff DID requests have been processed.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between space-y-3 shadow-sm"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-sm">{req.ownerName}</span>
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase font-bold">
                            {req.ownerType}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{req.ownerEmail}</p>
                        <p className="text-xs text-muted-foreground">
                          Department: <span className="font-semibold text-foreground">{req.department || "Clinical Services"}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Requested: {new Date(req.requestedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <Button
                          onClick={() => handleApprove(req.id, req.ownerName)}
                          disabled={approvingId === req.id}
                          className="flex-1 bg-success text-success-foreground hover:bg-success/90 text-xs font-bold py-2"
                        >
                          {approvingId === req.id ? "Issuing..." : "Approve & Issue DID"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleReject(req.id)}
                          className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs font-semibold"
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
