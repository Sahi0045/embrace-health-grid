import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Stethoscope,
  Mail,
  Phone,
  Calendar,
  Shield,
  LogOut,
  Edit,
  Award,
  Building2,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { RouteGuard } from "@/components/RouteGuard";
import { DidKeypairCard } from "@/components/DidKeypairCard";
import { useCurrentUser } from "@/lib/auth-context";
import {
  updateProfile,
  API_BASE_URL,
  requestDID,
  getStaffRequests,
  getMe,
  getCertificationsByStaffDid,
} from "@/lib/api";
import { useLiveStaff } from "@/hooks/use-api";
import { getAllDIDs } from "@/lib/clinical.server";
import { useTableRefresh } from "@/hooks/use-realtime";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOut } from "@/lib/auth.server";

export const Route = createFileRoute("/staff/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Staff Portal" },
      { name: "description", content: "View and manage your staff profile" },
    ],
  }),
  component: StaffProfile,
});

function StaffProfile() {
  const { staff } = useLiveStaff();
  const { user: currentUser, refresh: refreshUser } = useCurrentUser();
  const [adminDid, setAdminDid] = useState<string | null>(null);
  const [didLoading, setDidLoading] = useState(true);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [certificationsLoading, setCertificationsLoading] = useState(true);

  const userEmail = currentUser?.email || "";

  const [requestingDid, setRequestingDid] = useState(false);
  const [pendingReq, setPendingReq] = useState<any>(null);

  // Refresh session from backend
  const refreshSession = useCallback(async () => {
    try {
      const res = await getMe();
      if (res.user) {
        await refreshUser();
      }
    } catch {
      /* silent */
    }
  }, []);

  const checkPendingRequest = useCallback(async () => {
    try {
      // getStaffRequests, not getDIDRequests.
      //
      // getDIDRequests calls the identity-ops "list-did-requests" op, which is
      // gated on caller.role === "admin" — so for the staff member whose profile
      // this is, it threw 403 every time and the empty catch below swallowed it.
      // It then matched on `ownerEmail`, which that mapper does not return
      // either. Between the two, a pending DID request was never detected and
      // the page kept offering "Request DID" to someone who already had one
      // waiting.
      //
      // getStaffRequests is RLS-scoped to the caller's own rows, which is
      // exactly the question being asked here.
      const res = await getStaffRequests();
      const match = (res?.requests ?? []).find(
        (r: any) => r.type === "did-issuance" && r.status === "pending",
      );
      setPendingReq(match || null);
    } catch {
      /* ignore */
    }
  }, []);

  const handleRequestDIDClick = async () => {
    // A DID is an identity credential. Falling back to the demo record here
    // would submit the request under a fictional clinician's name and
    // department, and the admin issuing it has no way to know. Refuse instead.
    if (!currentUser?.name) {
      toast.error("Add your full name to your profile before requesting a DID.");
      return;
    }

    setRequestingDid(true);
    try {
      const res = await requestDID({
        ownerName: currentUser.name,
        ownerType: currentUser.role || "doctor",
        department: currentUser.department || "",
      });
      if (res.success) {
        toast.success("DID Request Submitted to Admin!", {
          description: "Hospital administrator has been notified to issue your official W3C DID.",
        });
        checkPendingRequest();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit DID request");
    } finally {
      setRequestingDid(false);
    }
  };

  useEffect(() => {
    refreshSession();
    async function fetchAdminDid() {
      try {
        const didRes = await getAllDIDs();
        const dids = didRes.dids || [];
        const match = dids.find(
          (d: { did?: string; owner_name?: string }) =>
            (d.owner_name &&
              currentUser?.name &&
              d.owner_name.toLowerCase() === currentUser.name.toLowerCase()) ||
            (d.did && currentUser?.did && d.did === currentUser.did),
        );
        if (match?.did) {
          setAdminDid(match.did);
        } else if (currentUser?.did?.startsWith("did:hosp:")) {
          setAdminDid(currentUser.did);
        } else {
          setAdminDid(null);
        }
      } catch {
        setAdminDid(currentUser?.did?.startsWith("did:hosp:") ? currentUser.did : null);
      } finally {
        setDidLoading(false);
      }
    }
    fetchAdminDid();
    checkPendingRequest();
  }, [userEmail, currentUser?.name, currentUser?.did, checkPendingRequest, refreshSession]);

  // Load certifications from the database whenever the staff DID is known
  const loadCertifications = useCallback(async () => {
    const staffDid = adminDid || currentUser?.did;
    if (!staffDid) {
      setCertificationsLoading(false);
      return;
    }
    setCertificationsLoading(true);
    try {
      const res = await getCertificationsByStaffDid(staffDid);
      setCertifications(res.certifications || []);
    } catch {
      // Silently fallback — certifications table may not exist yet in dev
      setCertifications([]);
    } finally {
      setCertificationsLoading(false);
    }
  }, [adminDid, currentUser?.did]);

  useEffect(() => {
    loadCertifications();
  }, [loadCertifications]);

  // Re-fetch whenever admin updates the certifications table
  useTableRefresh("staff_certifications", loadCertifications);

  /**
   * Never fall back to `staffData`.
   *
   * That demo record is a fictional cardiologist, and falling back to it meant a
   * real user with an incomplete profile was shown someone else's name, phone,
   * department and specialisations — then, if they opened Edit and pressed Save
   * without touching anything, wrote that stranger's details onto their own row.
   * An empty field is honest; a plausible wrong one is not.
   */
  const staffRecord = staff?.find((s: any) => s.email === userEmail) || {
    name: currentUser?.name ?? "",
    did: adminDid || currentUser?.did || "",
    employeeId: currentUser?.employeeId ?? "",
    email: currentUser?.email ?? "",
    phone: currentUser?.phone ?? "",
    department: currentUser?.department ?? "",
    role: currentUser?.role ?? "",
    joinDate: "",
    specializations: currentUser?.specializations ?? [],
    certifications: [] as { name: string; issuer: string; year: string }[],
  };

  const name = currentUser?.name || staffRecord.name || "";
  /** Authorization role (admin / doctor / staff) — displayed, never editable. */
  const role = currentUser?.role || staffRecord.role || "Staff";
  /** Job title ("Senior Cardiologist"). Separate column, freely editable. */
  const title = currentUser?.title ?? "";
  const phone = currentUser?.phone || staffRecord.phone || "";
  const department = currentUser?.department || staffRecord.department || "";
  const specializations =
    currentUser?.specializations || (staffRecord as any).specializations || [];

  const employeeId = currentUser?.employeeId || staffRecord.employeeId;
  const joinDate = currentUser?.joinDate || staffRecord.joinDate || "";

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editSpecializations, setEditSpecializations] = useState("");
  const [updating, setUpdating] = useState(false);

  /**
   * Seed the form when the dialog opens, not at first render.
   *
   * `useState(name)` reads its argument once, on the very first render — which
   * happens before `currentUser` has resolved. The initial values were therefore
   * captured from the demo record and never updated, which is why the header
   * showed the real user while the dialog underneath it showed "Dr. Ravi Menon".
   * Seeding on open also means Cancel-then-reopen discards a half-finished edit
   * rather than resurrecting it.
   */
  useEffect(() => {
    if (!isEditOpen) return;
    setEditName(name);
    setEditPhone(phone);
    setEditDepartment(department);
    setEditTitle(title);
    setEditSpecializations(specializations.join(", "));
  }, [isEditOpen, name, phone, department, title, specializations]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const res = await updateProfile({
        name: editName,
        phone: editPhone,
        department: editDepartment,
        // `title`, not `role`: the auth role is not self-editable, and RLS
        // (profiles_update_own) rejects a change to it regardless.
        title: editTitle,
        specializations: editSpecializations,
      });
      if (res.success && res.user) {
        await refreshUser();
        toast.success("Profile updated successfully!");
        setIsEditOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    // The session is an httpOnly cookie, so only the server can end it.
    // Clearing localStorage left the user signed in.
    void signOut().finally(() => {
      window.location.href = "/login";
    });
  };

  return (
    <RouteGuard requiredRole="staff">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <PageHeader
          title="My Profile"
          description="View and manage your professional information"
        />

        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-chart-2/10 text-chart-2">
                    <Stethoscope className="h-8 w-8" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{name || "Your profile"}</CardTitle>
                    <CardDescription className="mt-1">
                      {/* Job title leads when set — it is what a colleague
                          recognises. The sign-in role and staff number follow,
                          and each is dropped when absent rather than rendered as
                          a stray bullet. */}
                      {[title, role, employeeId].filter(Boolean).join(" • ")}
                    </CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Department</div>
                    <div className="font-medium">{department}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Joined</div>
                    <div className="font-medium">
                      {/* Was reading staffData.joinDate — a hardcoded 2018 date
                          shown to every user regardless of when they joined. */}
                      {joinDate
                        ? new Date(joinDate).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Email</div>
                    <div className="font-medium text-sm">{staffRecord.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Phone</div>
                    <div className="font-medium">{phone}</div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Award className="h-4 w-4 text-primary" />
                  Specializations
                </div>
                <div className="flex flex-wrap gap-2">
                  {specializations.length > 0 ? (
                    specializations.map((spec: string) => (
                      <Badge key={spec} variant="secondary">
                        {spec}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No specializations listed</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle>Professional Identity (DID)</CardTitle>
                </div>
                {adminDid ? (
                  <Badge
                    variant="outline"
                    className="bg-success/15 text-success border-success/30 text-[10px] font-bold"
                  >
                    🟢 Admin-Issued DID
                  </Badge>
                ) : pendingReq ? (
                  <Badge
                    variant="outline"
                    className="bg-warning/15 text-warning border-warning/30 text-[10px] font-bold"
                  >
                    🟡 Request Pending Admin Review
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] font-bold"
                  >
                    ⚠️ Not Issued
                  </Badge>
                )}
              </div>
              <CardDescription>
                Your verified professional identity on the hospital DID registry
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4 font-mono text-sm font-medium">
                {didLoading ? (
                  <span className="text-muted-foreground text-xs font-sans">
                    Checking DID Registry...
                  </span>
                ) : adminDid ? (
                  <div>
                    <div className="text-xs text-muted-foreground font-sans">Official W3C DID</div>
                    <div className="mt-1 text-primary font-bold break-all">{adminDid}</div>
                  </div>
                ) : pendingReq ? (
                  <div className="space-y-1 font-sans">
                    <div className="text-warning font-semibold text-sm">
                      🟡 DID Request Pending Admin Approval
                    </div>
                    <p className="text-xs text-muted-foreground font-normal">
                      Your request to issue an official W3C DID was submitted on{" "}
                      <span className="font-semibold text-foreground">
                        {new Date(pendingReq.requestedAt).toLocaleDateString()}
                      </span>
                      . Hospital admin will review and issue your DID shortly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 font-sans">
                    <div>
                      <div className="text-destructive font-semibold text-sm">
                        No Official DID Issued
                      </div>
                      <p className="text-xs text-muted-foreground font-normal mt-0.5">
                        An official W3C DID has not been issued for your staff account yet. Click
                        below to submit a request to the hospital administrator to issue your
                        official DID.
                      </p>
                    </div>
                    <Button
                      onClick={handleRequestDIDClick}
                      disabled={requestingDid}
                      className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2"
                    >
                      {requestingDid ? "Submitting Request..." : "Request Official DID from Admin"}
                    </Button>
                  </div>
                )}
              </div>
              {adminDid && (
                <div className="mt-4 text-xs text-muted-foreground">
                  This DID verifies your clinician credentials and authorizes room check-ins &
                  patient data access.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clinicians hold an embedded signing key, same as patients and
              admins. Only super-admins use an external wallet. */}
          <DidKeypairCard />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  <CardTitle>Certifications &amp; Qualifications</CardTitle>
                </div>
                {!certificationsLoading && (
                  <Badge variant="outline" className="text-[10px]">
                    {certifications.filter((c) => c.status === "active").length} active
                  </Badge>
                )}
              </div>
              <CardDescription>
                Managed by hospital admin · Linked to your verified DID
              </CardDescription>
            </CardHeader>
            <CardContent>
              {certificationsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading certifications...
                </div>
              ) : certifications.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                  <Award className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <div className="text-sm font-medium text-foreground">
                    No certifications on record
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Contact your hospital admin to add your qualifications.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* DID linkage indicator */}
                  {adminDid && (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                      <Shield className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        All certifications linked to your verified DID:{" "}
                        <span className="font-mono">{adminDid.slice(0, 24)}…</span>
                      </span>
                    </div>
                  )}
                  {certifications.map((cert) => {
                    const isActive = cert.status === "active";
                    const isExpired = cert.status === "expired";
                    const isRevoked = cert.status === "revoked";
                    const isExpiringSoon =
                      cert.expiry_date &&
                      new Date(cert.expiry_date) < new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
                    return (
                      <div
                        key={cert.cert_id}
                        className={`rounded-lg border p-3 transition-colors ${
                          isRevoked
                            ? "border-destructive/30 bg-destructive/5 opacity-60"
                            : isExpired
                              ? "border-border bg-muted/30 opacity-70"
                              : "border-border bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 min-w-0">
                            <CheckCircle2
                              className={`h-4 w-4 mt-0.5 shrink-0 ${
                                isActive ? "text-success" : "text-muted-foreground"
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground flex items-center gap-2 flex-wrap">
                                {cert.cert_name}
                                {cert.verified_by_admin && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold">
                                    <Shield className="h-2.5 w-2.5" />
                                    Admin Verified
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {cert.issuing_body}
                                {cert.cert_number && (
                                  <span className="font-mono"> · {cert.cert_number}</span>
                                )}
                              </div>
                              {cert.cert_type && (
                                <div className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                                  {cert.cert_type}
                                </div>
                              )}
                              {/* Dates row */}
                              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                                {cert.issue_date && (
                                  <span>
                                    Issued:{" "}
                                    <span className="font-medium text-foreground">
                                      {new Date(cert.issue_date).toLocaleDateString("en-IN", {
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </span>
                                  </span>
                                )}
                                {cert.expiry_date && (
                                  <span
                                    className={isExpiringSoon ? "text-warning font-semibold" : ""}
                                  >
                                    {isExpiringSoon ? "⚠️ " : ""}Expires:{" "}
                                    <span className="font-medium">
                                      {new Date(cert.expiry_date).toLocaleDateString("en-IN", {
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </span>
                                  </span>
                                )}
                              </div>
                              {cert.notes && (
                                <div className="mt-1 text-[10px] italic text-muted-foreground">
                                  {cert.notes}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Status badge */}
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-[10px] font-bold capitalize ${
                              isActive
                                ? "bg-success/10 text-success border-success/30"
                                : isRevoked
                                  ? "bg-destructive/10 text-destructive border-destructive/30"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {cert.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
                <DialogDescription>
                  Update your professional details. Your sign-in role and DID are issued by your
                  hospital and cannot be changed here.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateProfile} className="space-y-4 py-4">
                <div className="space-y-1">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="title">Job Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Senior Cardiologist"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dept">Department</Label>
                    <Input
                      id="dept"
                      placeholder="e.g. Cardiology"
                      value={editDepartment}
                      onChange={(e) => setEditDepartment(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="specializations">Specializations (comma separated)</Label>
                  <Input
                    id="specializations"
                    placeholder="e.g. Cardiology, Echocardiography"
                    value={editSpecializations}
                    onChange={(e) => setEditSpecializations(e.target.value)}
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updating}>
                    {updating ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" asChild>
              <Link to="/staff">Back to Dashboard</Link>
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
