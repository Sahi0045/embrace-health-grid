import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Droplet,
  AlertCircle,
  Shield,
  LogOut,
  Edit,
  Wallet,
} from "lucide-react";
import { useLivePatients, useCredentials } from "@/hooks/use-api";
import { RouteGuard } from "@/components/RouteGuard";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getCurrentUser, setSession, logout } from "@/lib/auth";
import { linkWalletAddress, updateProfile } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/patient/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Patient Portal" },
      { name: "description", content: "View and manage your profile information" },
    ],
  }),
  component: PatientProfile,
});

function PatientProfile() {
  const { patients } = useLivePatients();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const { publicKey, connected } = useWallet();
  const [linking, setLinking] = useState(false);

  const userEmail = currentUser?.email || "";
  const patientRecord = patients?.find((p: any) => p.email === userEmail || p.id === "pat_001") || { name: "", mrn: "", did: "", bloodGroup: "", age: 0, gender: "M" as const, allergies: [] as string[], phone: "" };
  const mrn = currentUser?.mrn || patientRecord.mrn;

  const name = currentUser?.name || patientRecord.name;
  const age = currentUser?.age || patientRecord.age || 30;
  const gender = currentUser?.gender || patientRecord.gender || "M";
  const bloodGroup = currentUser?.bloodGroup || patientRecord.bloodGroup || "O+";
  const phone = currentUser?.phone || patientRecord.phone || "+91 98765 43210";
  const allergies = currentUser?.allergies || patientRecord.allergies || [];

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editPhone, setEditPhone] = useState(phone);
  const [editAge, setEditAge] = useState(age);
  const [editGender, setEditGender] = useState(gender);
  const [editBloodGroup, setEditBloodGroup] = useState(bloodGroup);
  const [editAllergies, setEditAllergies] = useState(allergies.join(", "));
  const [updating, setUpdating] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const res = await updateProfile({
        name: editName,
        phone: editPhone,
        age: parseInt(String(editAge)),
        gender: editGender,
        bloodGroup: editBloodGroup,
        allergies: editAllergies,
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

  const { data: credentialsData } = useCredentials();


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
  const rawCredentials = credentialsData?.credentials || [];

  const liveCredentials = rawCredentials.map((c: any) => ({
    id: c.id || c.txId || String(Math.random()),
    type: c.type || "Verifiable Credential",
    issuer: c.issuer || "Embrace Health Consortium",
    status: (c.status === "revoked" ? "revoked" : "active") as "active" | "revoked",
  }));

  const activeCreds =
    liveCredentials.length > 0
      ? liveCredentials.filter((c: any) => c.status === "active")
      : [
          { id: "c1", type: "Patient Identity", issuer: "Embrace Health Consortium" },
          { id: "c2", type: "Health Insurance", issuer: "Star Health" },
          { id: "c3", type: "Vaccination Record", issuer: "Govt. of India" },
        ];


  const handleLogout = () => {
    logout();
  };

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 md:max-w-4xl">
        <PageHeader title="My Profile" description="View and manage your personal information" />

        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-8 w-8" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{name}</CardTitle>

                    <CardDescription className="mt-1">MRN: {mrn}</CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Age</div>
                    <div className="font-medium">{age} years</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Gender</div>
                    <div className="font-medium">
                      {gender === "M" ? "Male" : gender === "F" ? "Female" : "Other"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Droplet className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Blood Group</div>
                    <div className="font-medium">{bloodGroup}</div>
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
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Allergies
                </div>
                <div className="flex flex-wrap gap-2">
                  {allergies.length > 0 ? (
                    allergies.map((allergy: string) => (
                      <Badge key={allergy} variant="destructive">
                        {allergy}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No allergies listed</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Decentralized Identity</CardTitle>
              </div>
              <CardDescription>Your unique digital identity on the blockchain</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4">
                <div className="text-sm text-muted-foreground">DID</div>
                <div className="mt-1 font-mono text-sm font-medium">{patientRecord.did}</div>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                This DID is cryptographically secured and gives you control over your health data.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <CardTitle>Solana Wallet Integration</CardTitle>
              </div>
              <CardDescription>
                Link a single Solana wallet address to sign consents and access records.
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
                      ⚠️ Mismatched Wallet: Currently connected to {publicKey!.toBase58().slice(0, 6)}...{publicKey!.toBase58().slice(-4)}. Please switch to your registered wallet.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
                  <div className="text-xs font-semibold text-warning uppercase tracking-wider mb-1">
                    No Wallet Linked
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    You have not linked a Solana wallet to your profile yet. Connect your wallet and link it below to enable blockchain auditing.
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
              <CardTitle>Verifiable Credentials</CardTitle>
              <CardDescription>Your active credentials and certifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeCreds.map((cred: any) => (
                  <div
                    key={cred.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <div className="font-medium">{cred.type}</div>
                      <div className="text-sm text-muted-foreground">Issued by {cred.issuer}</div>
                    </div>
                    <Badge variant="outline" className="bg-success/10 text-success">
                      Active
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
                Update your personal and clinical details. Some parameters are synced on-chain.
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
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={editAge}
                    onChange={(e) => setEditAge(parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={editGender} onValueChange={setEditGender}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male</SelectItem>
                      <SelectItem value="F">Female</SelectItem>
                      <SelectItem value="O">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="blood">Blood Group</Label>
                  <Select value={editBloodGroup} onValueChange={setEditBloodGroup}>
                    <SelectTrigger id="blood">
                      <SelectValue placeholder="Blood Group" />
                    </SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                        <SelectItem key={bg} value={bg}>
                          {bg}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </div>
              <div className="space-y-1">
                <Label htmlFor="allergies">Allergies (comma separated)</Label>
                <Input
                  id="allergies"
                  placeholder="e.g. Peanuts, Penicillin"
                  value={editAllergies}
                  onChange={(e) => setEditAllergies(e.target.value)}
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
            <Link to="/patient">Back to Dashboard</Link>
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
