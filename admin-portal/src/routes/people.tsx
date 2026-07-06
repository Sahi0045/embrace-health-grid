import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserCog,
  Stethoscope,
  HeartPulse,
  UserCheck,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Award,
  Briefcase,
  ClipboardList,
  Activity,
  AlertCircle,
  Clock,
} from "lucide-react";
import { DIDBadge } from "@/components/did/DIDBadge";
import { DIDStatusChip } from "@/components/did/DIDStatusChip";
import { useState, useEffect } from "react";
import { getUsers, createDID } from "@/lib/api";
import { toast } from "sonner";
import { useLivePatients, useLiveStaff } from "@/hooks/use-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/people")({
  head: () => ({
    meta: [
      { title: "People Management — Admin Console" },
      { name: "description", content: "Manage patients, doctors, nurses, and staff" },
    ],
  }),
  component: PeopleManagement,
});

function PeopleManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const { patients: livePatients } = useLivePatients();
  const { staff: liveStaff } = useLiveStaff();

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await getUsers();
      setUsers(res.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const [selectedUserForDID, setSelectedUserForDID] = useState<any | null>(null);
  const [didDialogId, setDidDialogId] = useState("");
  const [isDidDialogOpen, setIsDidDialogOpen] = useState(false);
  const [isSubmittingDID, setIsSubmittingDID] = useState(false);

  const handleIssueDIDClick = (user: any) => {
    setSelectedUserForDID(user);
    if (user.role === "patient") {
      setDidDialogId(`MRN-${Math.floor(100000 + Math.random() * 900000)}`);
    } else {
      setDidDialogId(`EMP-${Math.floor(1000 + Math.random() * 9000)}`);
    }
    setIsDidDialogOpen(true);
  };

  const handleConfirmIssueDID = async () => {
    if (!selectedUserForDID) return;
    setIsSubmittingDID(true);
    try {
      let didRole = selectedUserForDID.role;
      if (didRole === "staff") {
        didRole = "doctor";
      }

      const extraFields =
        didRole === "patient" ? { mrn: didDialogId } : { employeeId: didDialogId };

      const res = await createDID(
        selectedUserForDID.name,
        didRole,
        undefined,
        selectedUserForDID.email,
        extraFields,
      );
      toast.success(`DID issued successfully for ${selectedUserForDID.name}!`, {
        description: res.did,
      });
      setIsDidDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to issue DID");
    } finally {
      setIsSubmittingDID(false);
    }
  };

  // Filter lists in real-time
  const patientsList = (livePatients || []).filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.mrn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.did?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const doctorsList = (liveStaff || []).filter(
    (s) =>
      s.role?.toLowerCase() === "doctor" &&
      (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.did?.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const nursesList = (liveStaff || []).filter(
    (s) =>
      s.role?.toLowerCase() === "nurse" &&
      (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.did?.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const supportStaffList = (liveStaff || []).filter(
    (s) =>
      s.role?.toLowerCase() !== "doctor" &&
      s.role?.toLowerCase() !== "nurse" &&
      (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.did?.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  // Compute stats in real-time
  const totalPatients = (livePatients || []).length;
  const totalDoctors = (liveStaff || []).filter((s) => s.role?.toLowerCase() === "doctor").length;
  const totalNurses = (liveStaff || []).filter((s) => s.role?.toLowerCase() === "nurse").length;
  const totalSupportStaff = (liveStaff || []).filter(
    (s) => s.role?.toLowerCase() !== "doctor" && s.role?.toLowerCase() !== "nurse",
  ).length;

  const doctorsOnDuty = (liveStaff || []).filter(
    (s) => s.role?.toLowerCase() === "doctor" && s.onDuty,
  ).length;
  const nursesOnDuty = (liveStaff || []).filter(
    (s) => s.role?.toLowerCase() === "nurse" && s.onDuty,
  ).length;
  const supportOnDuty = (liveStaff || []).filter(
    (s) => s.role?.toLowerCase() !== "doctor" && s.role?.toLowerCase() !== "nurse" && s.onDuty,
  ).length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "admitted":
        return "bg-success/10 text-success";
      case "outpatient":
        return "bg-primary/10 text-primary";
      case "on-leave":
        return "bg-warning/10 text-warning-foreground";
      case "inactive":
      case "discharged":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <RouteGuard requiredRole="admin">
      <>
        <PageHeader
          eyebrow="Admin console"
          title="People Management"
          description="Complete directory of patients, doctors, nurses, and hospital staff"
        />

        <div className="space-y-6 p-8">
          {/* Overview Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Patients"
              value={totalPatients.toLocaleString()}
              delta={`Live on-chain`}
              icon={Users}
            />
            <StatCard
              label="Doctors"
              value={totalDoctors}
              delta={`${doctorsOnDuty} on duty`}
              icon={Stethoscope}
              tone="success"
            />
            <StatCard
              label="Nurses"
              value={totalNurses}
              delta={`${nursesOnDuty} on duty`}
              icon={HeartPulse}
            />
            <StatCard
              label="Support Staff"
              value={totalSupportStaff}
              delta={`${supportOnDuty} on duty`}
              icon={UserCog}
            />
          </div>

          {/* Search Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, MRN, employee ID, or specialty..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Main Content Tabs */}
          <Tabs defaultValue="patients" className="w-full">
            <TabsList>
              <TabsTrigger value="patients">Patients</TabsTrigger>
              <TabsTrigger value="doctors">Doctors</TabsTrigger>
              <TabsTrigger value="nurses">Nurses</TabsTrigger>
              <TabsTrigger value="staff">Support Staff</TabsTrigger>
              <TabsTrigger value="registered">
                Registered Gateway Users ({users.length})
              </TabsTrigger>
            </TabsList>

            {/* Patients Tab */}
            <TabsContent value="patients" className="space-y-4 mt-4">
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Currently Admitted</div>
                    <div className="text-2xl font-semibold">
                      {patientsList.filter((p) => p.ward && p.status !== "discharged").length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Outpatients</div>
                    <div className="text-2xl font-semibold">
                      {patientsList.filter((p) => !p.ward || p.status === "outpatient").length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Total Live Patients</div>
                    <div className="text-2xl font-semibold">{patientsList.length}</div>
                  </CardContent>
                </Card>
              </div>

              {patientsList.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No patients found.
                </div>
              )}

              {patientsList.map((patient) => (
                <Card key={patient.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{patient.name}</CardTitle>
                        <CardDescription className="mt-1">
                          MRN: {patient.mrn} • DID: {patient.did}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(patient.status)}>{patient.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Age / Gender</div>
                        <div className="font-medium">
                          {patient.age} years • {patient.gender === "M" ? "Male" : "Female"}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Blood Group</div>
                        <div className="font-medium">{patient.bloodGroup}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Visits</div>
                        <div className="font-medium">{patient.totalVisits ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Outstanding Bills</div>
                        <div
                          className={
                            (patient.outstandingBills || 0) > 0
                              ? "font-medium text-destructive"
                              : "font-medium text-success"
                          }
                        >
                          ₹{(patient.outstandingBills ?? 0).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{patient.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">{patient.email}</span>
                      </div>
                    </div>

                    {patient.ward && (
                      <div className="mt-3 rounded-lg bg-primary/5 p-3">
                        <div className="text-sm font-medium">Current Admission</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {patient.ward} • Bed {patient.bed}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Admitted: {new Date(patient.admitDate).toLocaleDateString()}
                        </div>
                      </div>
                    )}

                    {patient.allergies.length > 0 && (
                      <div className="mt-3">
                        <div className="mb-1 flex items-center gap-2 text-sm font-medium text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          Allergies
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {patient.allergies.map((allergy, idx) => (
                            <Badge key={idx} variant="destructive" className="text-xs">
                              {allergy}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {patient.conditions.length > 0 && (
                      <div className="mt-3">
                        <div className="mb-1 text-sm font-medium">Chronic Conditions</div>
                        <div className="flex flex-wrap gap-1">
                          {patient.conditions.map((condition, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline">
                        <ClipboardList className="mr-2 h-4 w-4" />
                        View Records
                      </Button>
                      <Button size="sm" variant="outline">
                        <Calendar className="mr-2 h-4 w-4" />
                        Appointments
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Doctors Tab */}
            <TabsContent value="doctors" className="space-y-4 mt-4">
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Doctors On Duty</div>
                    <div className="text-2xl font-semibold">
                      {doctorsList.filter((d) => d.onDuty).length}/{doctorsList.length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Active Department</div>
                    <div className="text-2xl font-semibold">
                      {new Set(doctorsList.map((d) => d.department)).size}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Total Credentials</div>
                    <div className="text-2xl font-semibold">
                      {doctorsList.reduce((sum, d) => sum + (d.credentials ?? 0), 0)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {doctorsList.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No doctors found.
                </div>
              )}

              {doctorsList.map((doctor) => (
                <Card key={doctor.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{doctor.name}</CardTitle>
                        <CardDescription className="mt-1">
                          Role: Doctor • ID: {doctor.employeeId} • DID: {doctor.did}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(doctor.status)}>{doctor.status}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Specialty / Dept</div>
                        <div className="font-medium">
                          {doctor.specialty} • {doctor.department}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Active Shift</div>
                        <div className="font-medium capitalize">{doctor.shift}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Blockchain Credentials</div>
                        <div className="font-medium">{doctor.credentials} VC</div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{doctor.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">{doctor.email}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline">
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule
                      </Button>
                      <Button size="sm" variant="outline">
                        <Activity className="mr-2 h-4 w-4" />
                        Duty: {doctor.onDuty ? "On Duty" : "Off Duty"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Nurses Tab */}
            <TabsContent value="nurses" className="space-y-4 mt-4">
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Nurses On Duty</div>
                    <div className="text-2xl font-semibold">
                      {nursesList.filter((n) => n.onDuty).length}/{nursesList.length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Active Shift</div>
                    <div className="text-2xl font-semibold">
                      {new Set(nursesList.map((n) => n.shift)).size}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Total Credentials</div>
                    <div className="text-2xl font-semibold">
                      {nursesList.reduce((sum, n) => sum + (n.credentials ?? 0), 0)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {nursesList.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No nurses found.
                </div>
              )}

              {nursesList.map((nurse) => (
                <Card key={nurse.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{nurse.name}</CardTitle>
                        <CardDescription className="mt-1">
                          Role: Nurse • ID: {nurse.employeeId} • DID: {nurse.did}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(nurse.status)}>{nurse.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Department</div>
                        <div className="font-medium">{nurse.department}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Active Shift</div>
                        <div className="font-medium capitalize">{nurse.shift}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Blockchain Credentials</div>
                        <div className="font-medium">{nurse.credentials} VC</div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{nurse.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">{nurse.email}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline">
                        <Calendar className="mr-2 h-4 w-4" />
                        Roster
                      </Button>
                      <Button size="sm" variant="outline">
                        <Users className="mr-2 h-4 w-4" />
                        Duty: {nurse.onDuty ? "On Duty" : "Off Duty"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Support Staff Tab */}
            <TabsContent value="staff" className="space-y-4 mt-4">
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Staff On Duty</div>
                    <div className="text-2xl font-semibold">
                      {supportStaffList.filter((s) => s.onDuty).length}/{supportStaffList.length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Active Roles</div>
                    <div className="text-2xl font-semibold">
                      {new Set(supportStaffList.map((s) => s.role)).size}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Total Credentials</div>
                    <div className="text-2xl font-semibold">
                      {supportStaffList.reduce((sum, s) => sum + (s.credentials ?? 0), 0)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {supportStaffList.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No support staff found.
                </div>
              )}

              {supportStaffList.map((staff) => (
                <Card key={staff.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{staff.name}</CardTitle>
                        <CardDescription className="mt-1">
                          Role: {staff.role} • ID: {staff.employeeId} • DID: {staff.did}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(staff.status)}>{staff.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Department</div>
                        <div className="font-medium">{staff.department}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Active Shift</div>
                        <div className="font-medium capitalize">{staff.shift}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Blockchain Credentials</div>
                        <div className="font-medium">{staff.credentials} VC</div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{staff.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">{staff.email}</span>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-xs text-muted-foreground">Duty Shift</div>
                        <div className="font-medium capitalize">{staff.shift}</div>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-xs text-muted-foreground">Duty Status</div>
                        <div className="text-xs font-semibold">
                          {staff.onDuty ? "On Duty" : "Off Duty"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-xs text-muted-foreground">Join Date</div>
                        <div className="text-xs">
                          {new Date(staff.joinedDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Registered Users tab */}
            <TabsContent value="registered" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Registered Accounts</CardTitle>
                  <CardDescription>
                    Users who registered via the gateway. Click "Issue DID" to anchor their profile
                    to the blockchain.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingUsers ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      Loading users...
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      No registered users found.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {users.map((u: any) => (
                        <div key={u.email} className="flex items-center justify-between py-4">
                          <div>
                            <div className="font-semibold text-foreground text-sm">{u.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {u.email} · Role:{" "}
                              <span className="capitalize font-medium">{u.role}</span>
                            </div>
                            {u.walletAddress ? (
                              <div className="mt-1 text-[10px] font-mono text-primary flex items-center gap-1">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                                Wallet linked: {u.walletAddress.slice(0, 6)}...{u.walletAddress.slice(-6)}
                              </div>
                            ) : (
                              <div className="mt-1 text-[10px] text-muted-foreground italic">
                                No wallet linked
                              </div>
                            )}
                            {u.did ? (
                              <div className="mt-1 text-[10px] font-mono text-success">
                                On-chain DID: {u.did}
                              </div>
                            ) : (
                              <div className="mt-1 text-[10px] font-mono text-warning">
                                Awaiting blockchain registration
                              </div>
                            )}
                          </div>
                          <div>
                            {!u.did ? (
                              <Button
                                size="sm"
                                onClick={() => handleIssueDIDClick(u)}
                                className="inline-flex items-center gap-1 shadow-clinical"
                              >
                                Issue DID
                              </Button>
                            ) : (
                              <span className="text-xs font-semibold text-success bg-success/10 border border-success/20 px-3 py-1 rounded-full">
                                Anchored
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </>

      <Dialog open={isDidDialogOpen} onOpenChange={setIsDidDialogOpen}>
        <DialogContent className="sm:max-w-md animate-in fade-in zoom-in duration-200">
          <DialogHeader>
            <DialogTitle>Assign Profile ID & Issue DID</DialogTitle>
            <DialogDescription>
              Assign a unique identifier for {selectedUserForDID?.name || "the user"} before
              registering their DID on the blockchain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                {selectedUserForDID?.role === "patient" ? "Patient ID (MRN)" : "Employee ID"}
              </label>
              <Input
                value={didDialogId}
                onChange={(e) => setDidDialogId(e.target.value)}
                placeholder={
                  selectedUserForDID?.role === "patient" ? "e.g. MRN-204871" : "e.g. EMP-1029"
                }
              />
            </div>
            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">User Name:</span>
                <span className="font-semibold">{selectedUserForDID?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">User Email:</span>
                <span className="font-semibold">{selectedUserForDID?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">System Role:</span>
                <span className="font-semibold capitalize">{selectedUserForDID?.role}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDidDialogOpen(false)}
              disabled={isSubmittingDID}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmIssueDID}
              disabled={isSubmittingDID || !didDialogId.trim()}
            >
              {isSubmittingDID ? "Issuing..." : "Confirm & Issue DID"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RouteGuard>
  );
}

function StaffDIDsPanel({ searchTerm, liveStaff }: { searchTerm: string; liveStaff: any[] }) {
  const [roleFilter, setRoleFilter] = useState("all");

  const filtered = liveStaff.filter(
    (s) =>
      (roleFilter === "all" || s.role === roleFilter) &&
      (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.did.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const onDuty = liveStaff.filter((s) => s.onDuty).length;
  const roles = [...new Set(liveStaff.map((s) => s.role))].sort();

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Staff", value: liveStaff.length, color: "text-primary bg-primary/10" },
          { label: "On Duty", value: onDuty, color: "text-success bg-success/10" },
          {
            label: "Doctors",
            value: liveStaff.filter((s) => s.role === "Doctor" || s.role === "Surgeon").length,
            color: "text-chart-2 bg-chart-2/10",
          },
          {
            label: "Nurses",
            value: liveStaff.filter((s) => s.role === "Nurse").length,
            color: "text-chart-3 bg-chart-3/10",
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-[10px] font-medium opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Filter:</span>
        <button
          onClick={() => setRoleFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${roleFilter === "all" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground"}`}
        >
          All ({liveStaff.length})
        </button>
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${roleFilter === role ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground"}`}
          >
            {role} ({liveStaff.filter((s) => s.role === role).length})
          </button>
        ))}
      </div>

      {/* Staff DID table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-clinical">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {["Staff Member", "Role / Dept.", "DID", "Status", "Credentials", "Duty"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden-when-small"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {s.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground">{s.employeeId}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-foreground">{s.role}</div>
                  <div className="text-xs text-muted-foreground">{s.department}</div>
                </td>
                <td className="px-4 py-3">
                  <DIDBadge did={s.did} />
                </td>
                <td className="px-4 py-3">
                  <DIDStatusChip
                    status={
                      s.status === "active"
                        ? "active"
                        : s.status === "inactive"
                          ? "revoked"
                          : "suspended"
                    }
                    size="sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {s.credentials}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div
                    className={`flex items-center gap-1.5 text-xs font-medium ${s.onDuty ? "text-success" : "text-muted-foreground"}`}
                  >
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${s.onDuty ? "bg-success" : "bg-muted-foreground"}`}
                    />
                    {s.onDuty ? "On duty" : "Off duty"}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No staff match your search
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {liveStaff.length} staff members — each staff member has a
        unique hospital DID
      </div>
    </div>
  );
}
