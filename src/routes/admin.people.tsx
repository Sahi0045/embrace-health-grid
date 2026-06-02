import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Users, UserCog, Stethoscope, HeartPulse, UserCheck, Search,
  Phone, Mail, MapPin, Calendar, Award, Briefcase, ClipboardList,
  Activity, AlertCircle, Clock
} from "lucide-react";
import { patients, doctors, nurses, supportStaff, peopleStats } from "@/lib/people-data";
import { useState } from "react";

export const Route = createFileRoute("/admin/people")({
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
              value={peopleStats.totalPatients.toLocaleString()} 
              delta={`+${peopleStats.newRegistrationsToday} today`}
              icon={Users} 
            />
            <StatCard 
              label="Doctors" 
              value={peopleStats.totalDoctors} 
              delta={`${peopleStats.doctorsOnDuty} on duty`}
              icon={Stethoscope}
              tone="success"
            />
            <StatCard 
              label="Nurses" 
              value={peopleStats.totalNurses} 
              delta={`${peopleStats.nursesOnDuty} on duty`}
              icon={HeartPulse}
            />
            <StatCard 
              label="Support Staff" 
              value={peopleStats.totalSupportStaff} 
              delta={`${peopleStats.supportStaffOnDuty} on duty`}
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
            </TabsList>

            {/* Patients Tab */}
            <TabsContent value="patients" className="space-y-4 mt-4">
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Currently Admitted</div>
                    <div className="text-2xl font-semibold">{peopleStats.admittedPatients}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Outpatients</div>
                    <div className="text-2xl font-semibold">{peopleStats.outpatients.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Today's Appointments</div>
                    <div className="text-2xl font-semibold">{peopleStats.todayAppointments}</div>
                  </CardContent>
                </Card>
              </div>

              {patients.map((patient) => (
                <Card key={patient.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{patient.name}</CardTitle>
                        <CardDescription className="mt-1">
                          MRN: {patient.mrn} • DID: {patient.did}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(patient.status)}>
                        {patient.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Age / Gender</div>
                        <div className="font-medium">{patient.age} years • {patient.gender === "M" ? "Male" : "Female"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Blood Group</div>
                        <div className="font-medium">{patient.bloodGroup}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Visits</div>
                        <div className="font-medium">{patient.totalVisits}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Outstanding Bills</div>
                        <div className={patient.outstandingBills > 0 ? "font-medium text-destructive" : "font-medium text-success"}>
                          ₹{patient.outstandingBills.toLocaleString()}
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

                    {patient.currentAdmission && (
                      <div className="mt-3 rounded-lg bg-primary/5 p-3">
                        <div className="text-sm font-medium">Current Admission</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {patient.currentAdmission.ward} • {patient.currentAdmission.room} - {patient.currentAdmission.bed}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Admitted: {new Date(patient.currentAdmission.admittedOn).toLocaleDateString()}
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

                    {patient.chronicConditions.length > 0 && (
                      <div className="mt-3">
                        <div className="mb-1 text-sm font-medium">Chronic Conditions</div>
                        <div className="flex flex-wrap gap-1">
                          {patient.chronicConditions.map((condition, idx) => (
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
                    <div className="text-2xl font-semibold">{peopleStats.doctorsOnDuty}/{peopleStats.totalDoctors}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Today's Appointments</div>
                    <div className="text-2xl font-semibold">{doctors.reduce((sum, doc) => sum + doc.todayAppointments, 0)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Active Cases</div>
                    <div className="text-2xl font-semibold">{doctors.reduce((sum, doc) => sum + doc.activeCases, 0)}</div>
                  </CardContent>
                </Card>
              </div>

              {doctors.map((doctor) => (
                <Card key={doctor.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{doctor.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {doctor.designation} • {doctor.department}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(doctor.status)}>
                          {doctor.status}
                        </Badge>
                        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <Award className="h-3 w-3 text-warning" />
                          <span>{doctor.rating}/5</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Specialty</div>
                        <div className="font-medium">{doctor.specialty}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Experience</div>
                        <div className="font-medium">{doctor.experience} years</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Consultation Fee</div>
                        <div className="font-medium">₹{doctor.consultationFee}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Patients</div>
                        <div className="font-medium">{doctor.totalPatientsTreated.toLocaleString()}</div>
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
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">{doctor.chamberLocation}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">{doctor.consultationTiming}</span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-2 text-sm font-medium">Qualifications</div>
                      <div className="flex flex-wrap gap-1">
                        {doctor.qualification.map((qual, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {qual}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-2 text-sm font-medium">Sub-specialties</div>
                      <div className="flex flex-wrap gap-1">
                        {doctor.subSpecialties.map((spec, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-xs text-muted-foreground">Active Cases</div>
                        <div className="font-semibold">{doctor.activeCases}</div>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-xs text-muted-foreground">Today's Appointments</div>
                        <div className="font-semibold">{doctor.todayAppointments}</div>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-xs text-muted-foreground">License</div>
                        <div className="text-xs font-mono">{doctor.licenseNumber}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline">
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule
                      </Button>
                      <Button size="sm" variant="outline">
                        <Activity className="mr-2 h-4 w-4" />
                        Performance
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
                    <div className="text-2xl font-semibold">{peopleStats.nursesOnDuty}/{peopleStats.totalNurses}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Total Patients Assigned</div>
                    <div className="text-2xl font-semibold">{nurses.reduce((sum, nurse) => sum + nurse.assignedPatients, 0)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Avg Experience</div>
                    <div className="text-2xl font-semibold">
                      {Math.round(nurses.reduce((sum, nurse) => sum + nurse.experience, 0) / nurses.length)} years
                    </div>
                  </CardContent>
                </Card>
              </div>

              {nurses.map((nurse) => (
                <Card key={nurse.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{nurse.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {nurse.department} • {nurse.ward}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(nurse.status)}>
                        {nurse.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Qualification</div>
                        <div className="font-medium">{nurse.qualification}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Experience</div>
                        <div className="font-medium">{nurse.experience} years</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Shift</div>
                        <div className="font-medium capitalize">{nurse.shift}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Assigned Patients</div>
                        <div className="font-medium">{nurse.assignedPatients}</div>
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
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">{nurse.nursingStation}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">License: {nurse.licenseNumber}</span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-2 text-sm font-medium">Specializations</div>
                      <div className="flex flex-wrap gap-1">
                        {nurse.specialization.map((spec, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline">
                        <Calendar className="mr-2 h-4 w-4" />
                        Roster
                      </Button>
                      <Button size="sm" variant="outline">
                        <Users className="mr-2 h-4 w-4" />
                        Assigned Patients
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
                    <div className="text-2xl font-semibold">{peopleStats.supportStaffOnDuty}/{peopleStats.totalSupportStaff}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Open Vacancies</div>
                    <div className="text-2xl font-semibold">{peopleStats.staffVacancies}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Total Roles</div>
                    <div className="text-2xl font-semibold">{new Set(supportStaff.map(s => s.role)).size}</div>
                  </CardContent>
                </Card>
              </div>

              {supportStaff.map((staff) => (
                <Card key={staff.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{staff.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {staff.role} • {staff.department}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(staff.status)}>
                        {staff.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 text-sm sm:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{staff.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">{staff.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">Supervisor: {staff.supervisor}</span>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-xs text-muted-foreground">Shift</div>
                        <div className="font-medium capitalize">{staff.shift}</div>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-xs text-muted-foreground">Employee ID</div>
                        <div className="font-mono text-xs">{staff.employeeId}</div>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-xs text-muted-foreground">Join Date</div>
                        <div className="text-xs">{new Date(staff.joinDate).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </>
    </RouteGuard>
  );
}
