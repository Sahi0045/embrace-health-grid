import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Stethoscope, Mail, Phone, Calendar, Shield, LogOut, Edit,
  Award, Building2, Wallet, CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";
import { RouteGuard } from "@/components/RouteGuard";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getCurrentUser, setSession } from "@/lib/auth";
import {
  updateProfile, API_BASE_URL, requestDID, getDIDRequests,
  requestWalletChallenge, verifyAndLinkWallet, getMe,
} from "@/lib/api";
import { useLiveStaff } from "@/hooks/use-api";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/staff/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Staff Portal" },
      { name: "description", content: "View and manage your staff profile" },
    ],
  }),
  component: StaffProfile,
});

const staffData = {
  name: "Dr. Ravi Menon",
  did: "did:hosp:0xd103…99aa",
  employeeId: "EMP-2847",
  email: "ravi.menon@apollohospitals.com",
  phone: "+91 98765 43210",
  department: "Cardiology",
  role: "Senior Cardiologist",
  joinDate: "2018-03-15",
  specializations: ["Interventional Cardiology", "Echocardiography", "Heart Failure Management"],
  certifications: [
    { name: "MD Cardiology", issuer: "AIIMS Delhi", year: "2015" },
    { name: "FESC", issuer: "European Society of Cardiology", year: "2019" },
    { name: "Advanced Cardiac Life Support", issuer: "American Heart Association", year: "2023" },
  ],
};

function StaffProfile() {
  const { staff } = useLiveStaff();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const { publicKey, connected, signMessage } = useWallet();
  const [verifying, setVerifying]   = useState(false);
  const [adminDid,   setAdminDid]   = useState<string | null>(null);
  const [didLoading, setDidLoading] = useState(true);

  const userEmail       = currentUser?.email || "";
  const walletVerified  = (currentUser as any)?.walletVerified === true;

  const [requestingDid, setRequestingDid] = useState(false);
  const [pendingReq,    setPendingReq]    = useState<any>(null);

  // Refresh session from backend (picks up walletVerified)
  const refreshSession = useCallback(async () => {
    try {
      const res = await getMe();
      if (res.user) {
        const token = localStorage.getItem("authToken") || "";
        setSession(token, res.user);
        setCurrentUser(getCurrentUser());
      }
    } catch { /* silent */ }
  }, []);

  const checkPendingRequest = useCallback(async () => {
    if (!userEmail) return;
    try {
      const res = await getDIDRequests();
      if (res?.requests) {
        const match = res.requests.find(
          (r: any) => r.ownerEmail?.toLowerCase() === userEmail.toLowerCase() && r.status === "pending"
        );
        setPendingReq(match || null);
      }
    } catch { /* ignore */ }
  }, [userEmail]);

  // ── Full wallet verification flow: challenge → signMessage → verify ──────
  const handleVerifyWallet = async () => {
    if (!publicKey || !signMessage) {
      toast.error("Please connect your Phantom wallet first");
      return;
    }
    setVerifying(true);
    try {
      const address = publicKey.toBase58();

      // Step 1: get challenge message from backend
      const { message } = await requestWalletChallenge(address);

      // Step 2: ask the wallet to sign it
      toast.info("Please approve the signature request in your wallet…");
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = await signMessage(msgBytes);
      const sigBase64 = Buffer.from(sigBytes).toString("base64");

      // Step 3: send signature to backend — verifies ownership + links wallet
      const res = await verifyAndLinkWallet(address, sigBase64);
      if (res.success && res.verified && res.user) {
        const token = localStorage.getItem("authToken") || "";
        setSession(token, res.user);
        setCurrentUser(getCurrentUser());
        toast.success("Wallet verified and linked!", {
          description: `${address.slice(0, 8)}…${address.slice(-6)} is now permanently associated with your account.`,
        });
      }
    } catch (err: any) {
      // "User rejected" from Phantom → friendly message
      if (err.message?.includes("User rejected") || err.message?.includes("cancelled")) {
        toast.error("Signature cancelled", { description: "You must approve the signing request in your wallet to verify ownership." });
      } else {
        toast.error(err.message || "Wallet verification failed");
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleRequestDIDClick = async () => {
    if (!walletVerified) {
      toast.error("Verify your Solana wallet first before requesting a DID.");
      return;
    }
    setRequestingDid(true);
    try {
      const res = await requestDID({
        ownerName:  currentUser?.name  || staffData.name,
        ownerType:  currentUser?.role  || "doctor",
        department: currentUser?.department || staffData.department,
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
        const res = await fetch(`${API_BASE_URL}/api/did`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            "x-client-key": "apollo-consortium-client-secret-2026",
          },
        });
        if (res.ok) {
          const data = await res.json();
          const dids = data.dids || [];
          const match = dids.find(
            (d: any) =>
              (d.ownerEmail && d.ownerEmail.toLowerCase() === userEmail.toLowerCase()) ||
              (d.owner && currentUser?.name && d.owner.toLowerCase() === currentUser.name.toLowerCase()) ||
              (d.did && currentUser?.did && d.did === currentUser.did)
          );
          if (match?.did) {
            setAdminDid(match.did);
          } else if (currentUser?.did?.startsWith("did:hosp:")) {
            setAdminDid(currentUser.did);
          } else {
            setAdminDid(null);
          }
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

  const staffRecord = staff?.find((s: any) => s.email === userEmail) || {
    name: currentUser?.name || staffData.name,
    did: adminDid || currentUser?.did || "",
    employeeId: currentUser?.employeeId || staffData.employeeId,
    email: currentUser?.email || staffData.email,
    phone: currentUser?.phone || staffData.phone,
    department: currentUser?.department || staffData.department,
    role: currentUser?.role || staffData.role,
    joinDate: staffData.joinDate,
    specializations: currentUser?.specializations || staffData.specializations,
    certifications: staffData.certifications,
  };

  const name = currentUser?.name || staffRecord.name;
  const role = currentUser?.role || staffRecord.role || "Staff";
  const phone = currentUser?.phone || staffRecord.phone || "+91 98765 43210";
  const department = currentUser?.department || staffRecord.department || "General Medicine";
  const specializations =
    currentUser?.specializations || (staffRecord as any).specializations || [];

  const employeeId = currentUser?.employeeId || staffRecord.employeeId;

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editPhone, setEditPhone] = useState(phone);
  const [editDepartment, setEditDepartment] = useState(department);
  const [editRole, setEditRole] = useState(role);
  const [editSpecializations, setEditSpecializations] = useState(specializations.join(", "));
  const [updating, setUpdating] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const res = await updateProfile({
        name: editName,
        phone: editPhone,
        department: editDepartment,
        role: editRole,
        specializations: editSpecializations,
      });
      if (res.success && res.user) {
        const token = localStorage.getItem("authToken") || "";
        setSession(token, res.user);
        setCurrentUser(getCurrentUser());
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
    localStorage.removeItem("userRole");
    localStorage.removeItem("userEmail");
    window.location.href = "/login";
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
                    <CardTitle className="text-2xl">{name}</CardTitle>
                    <CardDescription className="mt-1">
                      {role} • {employeeId}
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
                      {new Date(staffData.joinDate).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
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
                  <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[10px] font-bold">
                    🟢 Admin-Issued DID
                  </Badge>
                ) : pendingReq ? (
                  <Badge variant="outline" className="bg-amber-500/15 text-amber-500 border-amber-500/30 text-[10px] font-bold">
                    🟡 Request Pending Admin Review
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] font-bold">
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
                  <span className="text-muted-foreground text-xs font-sans">Checking DID Registry...</span>
                ) : adminDid ? (
                  <div>
                    <div className="text-xs text-muted-foreground font-sans">Official W3C DID</div>
                    <div className="mt-1 text-primary font-bold break-all">{adminDid}</div>
                  </div>
                ) : pendingReq ? (
                  <div className="space-y-1 font-sans">
                    <div className="text-amber-500 font-semibold text-sm">
                      🟡 DID Request Pending Admin Approval
                    </div>
                    <p className="text-xs text-muted-foreground font-normal">
                      Your request to issue an official W3C DID was submitted on <span className="font-semibold text-foreground">{new Date(pendingReq.requestedAt).toLocaleDateString()}</span>. Hospital admin will review and issue your DID shortly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 font-sans">
                    <div>
                      <div className="text-destructive font-semibold text-sm">No Official DID Issued</div>
                      <p className="text-xs text-muted-foreground font-normal mt-0.5">
                        An official W3C DID has not been issued for your staff account yet. Click below to submit a request to the hospital administrator to issue your official DID.
                      </p>
                    </div>
                    <Button
                      onClick={handleRequestDIDClick}
                      disabled={requestingDid || !walletVerified}
                      className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2"
                      title={!walletVerified ? "Verify your Solana wallet first" : undefined}
                    >
                      {requestingDid ? "Submitting Request..." : "Request Official DID from Admin"}
                    </Button>
                    {!walletVerified && (
                      <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        You must verify your Solana wallet before requesting a DID.
                      </div>
                    )}
                  </div>
                )}
              </div>
              {adminDid && (
                <div className="mt-4 text-xs text-muted-foreground">
                  This DID verifies your clinician credentials and authorizes room check-ins & patient data access.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <CardTitle>Solana Wallet</CardTitle>
                </div>
                {walletVerified ? (
                  <Badge className="bg-success/15 text-success border border-success/30 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Ownership Verified
                  </Badge>
                ) : currentUser?.walletAddress ? (
                  <Badge variant="outline" className="bg-warning/10 text-warning-foreground border-warning/30 text-[10px]">
                    Linked — Unverified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Not Linked</Badge>
                )}
              </div>
              <CardDescription>
                Connect and verify one Solana wallet. Wallet verification is required before requesting a DID.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Workflow steps */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                {[
                  { step: "1", label: "Connect Wallet",     done: connected },
                  { step: "2", label: "Verify Ownership",   done: walletVerified },
                  { step: "3", label: "Request DID",        done: !!adminDid },
                ].map((s) => (
                  <div key={s.step} className={`rounded-lg border px-2 py-2 space-y-1 ${s.done ? "border-success/30 bg-success/5" : "border-border bg-muted/30"}`}>
                    <div className={`text-base font-black ${s.done ? "text-success" : "text-muted-foreground"}`}>
                      {s.done ? "✓" : s.step}
                    </div>
                    <div className={s.done ? "text-success font-semibold" : "text-muted-foreground"}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Linked address display */}
              {currentUser?.walletAddress ? (
                <div className={`rounded-lg border p-4 space-y-2 ${walletVerified ? "border-success/25 bg-success/5" : "border-warning/25 bg-warning/5"}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${walletVerified ? "text-success" : "text-warning-foreground"}`}>
                      {walletVerified ? "Verified Wallet Address" : "Wallet Address (Unverified)"}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-foreground select-all break-all">
                    {currentUser.walletAddress}
                  </div>
                  {connected && publicKey?.toBase58() !== currentUser.walletAddress && (
                    <div className="flex items-center gap-2 text-xs text-destructive font-medium mt-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Connected wallet differs from linked address. Switch to your registered wallet.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 text-xs text-muted-foreground">
                  No wallet linked. Connect your Phantom wallet and verify ownership to continue.
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !rounded-lg !h-10 !text-sm !font-semibold !px-4" />
                {connected && !walletVerified && (
                  <Button onClick={handleVerifyWallet} disabled={verifying}
                    className="h-10 text-sm font-semibold gap-2">
                    {verifying
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>
                      : <><Shield className="h-4 w-4" /> Verify & Link Wallet</>}
                  </Button>
                )}
                {walletVerified && (
                  <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 h-10 text-xs font-semibold text-success">
                    <CheckCircle2 className="h-4 w-4" /> Wallet ownership confirmed
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Each account may link only one wallet, and each wallet may belong to only one account.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Certifications & Qualifications</CardTitle>
              <CardDescription>Your professional credentials and certifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {staffData.certifications.map((cert, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <div className="font-medium">{cert.name}</div>
                      <div className="text-sm text-muted-foreground">{cert.issuer}</div>
                    </div>
                    <Badge variant="outline" className="bg-success/10 text-success">
                      {cert.year}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
                <DialogDescription>
                  Update your professional and department details. Some parameters are synced
                  on-chain.
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
                    <Label htmlFor="role">Role / Title</Label>
                    <Input
                      id="role"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dept">Department</Label>
                    <Input
                      id="dept"
                      value={editDepartment}
                      onChange={(e) => setEditDepartment(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    required
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
