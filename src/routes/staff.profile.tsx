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
  Wallet,
} from "lucide-react";
import { RouteGuard } from "@/components/RouteGuard";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getCurrentUser, setSession } from "@/lib/auth";
import { linkWalletAddress, updateProfile, API_BASE_URL, requestDID, getDIDRequests } from "@/lib/api";
import { useLiveStaff } from "@/hooks/use-api";
import { toast } from "sonner";
import { useState, useEffect } from "react";
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
  const { publicKey, connected } = useWallet();
  const [linking, setLinking] = useState(false);
  const [adminDid, setAdminDid] = useState<string | null>(null);
  const [didLoading, setDidLoading] = useState(true);

  const userEmail = currentUser?.email || "";

  const [requestingDid, setRequestingDid] = useState(false);
  const [pendingReq, setPendingReq] = useState<any>(null);

  const checkPendingRequest = useCallback(async () => {
    if (!userEmail) return;
    try {
      const res = await getDIDRequests();
      if (res && res.requests) {
        const match = res.requests.find(
          (r: any) => r.ownerEmail?.toLowerCase() === userEmail.toLowerCase() && r.status === "pending"
        );
        setPendingReq(match || null);
      }
    } catch {
      /* ignore */
    }
  }, [userEmail]);

  const handleRequestDIDClick = async () => {
    setRequestingDid(true);
    try {
      const res = await requestDID({
        ownerName: currentUser?.name || staffData.name,
        ownerType: currentUser?.role || "doctor",
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
          if (match && match.did) {
            setAdminDid(match.did);
          } else if (currentUser?.did && currentUser.did.startsWith("did:hosp:")) {
            setAdminDid(currentUser.did);
          } else {
            setAdminDid(null);
          }
        } else if (currentUser?.did && currentUser.did.startsWith("did:hosp:")) {
          setAdminDid(currentUser.did);
        } else {
          setAdminDid(null);
        }
      } catch {
        setAdminDid(currentUser?.did && currentUser.did.startsWith("did:hosp:") ? currentUser.did : null);
      } finally {
        setDidLoading(false);
      }
    }
    fetchAdminDid();
    checkPendingRequest();
  }, [userEmail, currentUser?.name, currentUser?.did, checkPendingRequest]);

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

  const handleLinkWallet = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }
    setLinking(true);
    try {
      const address = publicKey.toBase58();
      const res = await linkWalletAddress(address);
      if (res.success && res.user) {
        const token = localStorage.getItem("authToken") || "";
        setSession(token, res.user);
        setCurrentUser(getCurrentUser());
        toast.success("Wallet linked successfully to your profile!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to link wallet");
    } finally {
      setLinking(false);
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
                  This DID verifies your clinician credentials and authorizes room check-ins & patient data access.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <CardTitle>Solana Wallet Integration</CardTitle>
              </div>
              <CardDescription>
                Link a single Solana wallet address to sign prescriptions and write ledger audit
                events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentUser?.walletAddress ? (
                <div className="rounded-lg border border-success/25 bg-success/5 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-success uppercase tracking-wider">
                      Linked Address
                    </span>
                    <Badge className="bg-success/15 text-success border border-success/35">
                      Verified Profile Link
                    </Badge>
                  </div>
                  <div className="font-mono text-xs text-foreground select-all break-all">
                    {currentUser.walletAddress}
                  </div>
                  {connected && publicKey?.toBase58() !== currentUser.walletAddress && (
                    <div className="text-xs text-destructive font-medium mt-1">
                      ⚠️ Mismatched Wallet: Currently connected to{" "}
                      {publicKey!.toBase58().slice(0, 6)}...{publicKey!.toBase58().slice(-4)}.
                      Please switch to your registered wallet.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
                  <div className="text-xs font-semibold text-warning uppercase tracking-wider mb-1">
                    No Wallet Linked
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    You have not linked a Solana wallet to your profile yet. Connect your wallet and
                    link it below to enable clinical ledger signatures.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <div className="wallet-adapter-button-trigger">
                  <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !rounded-lg !h-10 !text-sm !font-semibold !px-4" />
                </div>
                {connected && publicKey?.toBase58() !== currentUser?.walletAddress && (
                  <Button
                    onClick={handleLinkWallet}
                    disabled={linking}
                    className="h-10 text-sm font-semibold shadow-clinical cursor-pointer"
                  >
                    {linking ? "Linking..." : "Link Connected Wallet"}
                  </Button>
                )}
              </div>
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
