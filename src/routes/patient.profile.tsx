import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Building2,
} from "lucide-react";
import { useLivePatients, useCredentials } from "@/hooks/use-api";
import { RouteGuard } from "@/components/RouteGuard";
import { DidKeypairCard } from "@/components/DidKeypairCard";
import { useCurrentUser } from "@/lib/auth-context";
import { updateProfile, getMe } from "@/lib/api";
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
  const { user: currentUser, refresh: refreshUser, signOut: signOutUser } = useCurrentUser();
  const navigate = useNavigate();

  /* Wallet linking, verification and unlinking were removed along with the
     wallet card. Patients use the server-held signing key issued with their DID;
     there is nothing for them to connect, verify or unlink. */

  const userEmail = currentUser?.email || "";
  // Matching p.id === "pat_001" pulled in a seeded demo patient for whoever was
  // signed in, so one user could be shown another's name, MRN and allergies.
  // The placeholder record is all-null. It used to seed age: 0, gender: "M",
  // bloodGroup: "" and phone: "" — and because `??` only falls through on
  // null/undefined, those empty-but-present values won the coalesce below and
  // were rendered as the patient's real details: "0 years", "Male", a blank
  // blood group. Absent has to be spelled `null` for the "Not recorded" branch
  // to ever run.
  const patientRecord = patients?.find((p: any) => p.email === userEmail) || {
    name: currentUser?.fullName ?? "",
    mrn: null as string | null,
    did: currentUser?.primaryDid ?? "",
    bloodGroup: null as string | null,
    age: null as number | null,
    gender: null as string | null,
    allergies: [] as string[],
    phone: null as string | null,
  };
  const mrn = currentUser?.mrn || patientRecord.mrn || null;

  const name = currentUser?.name || patientRecord.name;
  // These four columns are nullable and were being defaulted to 30 / "M" / "O+"
  // and a placeholder phone number, then rendered as the patient's own details.
  // Verified against production: this account has age, gender and phone all NULL
  // and the profile displayed "30 years", "Male" and "+91 98765 43210".
  //
  // A fabricated blood group on a health record is a transfusion hazard, and a
  // fabricated emergency phone number is one somebody may actually dial. Null
  // renders as "Not recorded".
  // `|| null` rather than `?? null`: a matched directory row can carry "" or 0
  // for an unset field, and both must read as absent.
  const age = currentUser?.age || patientRecord.age || null;
  const gender = currentUser?.gender || patientRecord.gender || null;
  const bloodGroup = currentUser?.bloodGroup || patientRecord.bloodGroup || null;
  const phone = currentUser?.phone || patientRecord.phone || null;
  const allergies = currentUser?.allergies || patientRecord.allergies || [];

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editPhone, setEditPhone] = useState(phone ?? "");
  const [editAge, setEditAge] = useState<number | "">(age ?? "");
  const [editGender, setEditGender] = useState(gender ?? "");
  const [editBloodGroup, setEditBloodGroup] = useState(bloodGroup ?? "");
  const [editAllergies, setEditAllergies] = useState(allergies.join(", "));
  const [updating, setUpdating] = useState(false);

  // Reseed the form whenever the dialog opens.
  //
  // useState only uses its argument on first render, so these fields kept the
  // values captured when the page first mounted. After a successful save the
  // session refreshed and the page showed the new values, but reopening the
  // dialog presented the old ones again — which reads as "the update did not
  // stick".
  useEffect(() => {
    if (!isEditOpen) return;
    setEditName(name);
    // Empty, not a fabricated default: an unrecorded field must open blank so
    // saving the form does not commit a value nobody entered.
    setEditPhone(phone ?? "");
    setEditAge(age ?? "");
    setEditGender(gender ?? "");
    setEditBloodGroup(bloodGroup ?? "");
    setEditAllergies(allergies.join(", "));
  }, [isEditOpen, name, phone, age, gender, bloodGroup, allergies]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      // Blank means "still not recorded", so send undefined and let the server
      // skip the column. `parseInt("")` is NaN, which used to be sent as the age.
      const trimmed = (v: string) => (v.trim() === "" ? undefined : v.trim());
      const res = await updateProfile({
        name: editName,
        phone: trimmed(editPhone),
        age: editAge === "" ? undefined : Number(editAge),
        gender: trimmed(editGender),
        bloodGroup: trimmed(editBloodGroup),
        allergies: editAllergies,
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

  const { data: credentialsData } = useCredentials();

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

  const handleLogout = async () => {
    // Clears the httpOnly session cookie server-side.
    await signOutUser();
    navigate({ to: "/login" });
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

                    <CardDescription className="mt-1">MRN: {mrn ?? "Not assigned"}</CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {" "}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Age</div>
                    <div className="font-medium">
                      {age == null ? (
                        <span className="text-muted-foreground">Not recorded</span>
                      ) : (
                        `${age} years`
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Gender</div>
                    <div className="font-medium">
                      {/* "Other" was also the fallback for an UNSET gender, so a
                          patient who never answered was shown as having. */}
                      {gender === "M" ? (
                        "Male"
                      ) : gender === "F" ? (
                        "Female"
                      ) : gender ? (
                        gender
                      ) : (
                        <span className="text-muted-foreground">Not recorded</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Droplet className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Blood Group</div>
                    <div className="font-medium">
                      {bloodGroup ?? <span className="text-muted-foreground">Not recorded</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Phone</div>
                    <div className="font-medium">
                      {phone ?? <span className="text-muted-foreground">Not recorded</span>}
                    </div>
                  </div>
                </div>
                {/* Which hospital this account belongs to. It governs who the
                    patient may book an appointment with and which tenant holds
                    their records, and it was not surfaced anywhere in the portal
                    — so an empty doctor list looked like a fault rather than a
                    consequence of the registration. */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Registered hospital</div>
                    <div className="font-medium">
                      {currentUser?.hospitalName ?? (
                        <span className="text-muted-foreground">Not linked to a hospital</span>
                      )}
                    </div>
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
                <div className="mt-1 font-mono text-sm font-medium">
                  {currentUser?.did || patientRecord?.did || "Pending Admin Issuance"}
                </div>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                This DID is your identity. Its signing key is below.
              </div>
            </CardContent>
          </Card>

          <DidKeypairCard />

          {/* The Solana wallet card was removed.
              Patients no longer link a personal wallet. Every DID is issued with
              a server-held Ed25519 signing key (20260826100000), so consent
              decisions are signed on the patient's behalf without them
              installing an extension or holding a seed phrase — a seed phrase is
              not an acceptable failure mode for a medical record.

              The wallet linking flow was also inert: the address was verified
              once and then only ever read back to render a badge. Anchoring is
              performed server-side by the anchor-record Edge Function using the
              platform key — verified on devnet, the fee payer is
              BiHvsmTZtisyhSsRYZv4YdwxknMWV5noTs5GAkLasZ52, never the patient's
              wallet. Nothing signed with a linked wallet, so removing it changes
              no behaviour. */}

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
