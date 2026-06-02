import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Stethoscope, Mail, Phone, Calendar, Shield, LogOut, Edit, Award, Building2 } from "lucide-react";
import { RouteGuard } from "@/components/RouteGuard";

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
                  <CardTitle className="text-2xl">{staffData.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {staffData.role} • {staffData.employeeId}
                  </CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm">
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
                  <div className="font-medium">{staffData.department}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Joined</div>
                  <div className="font-medium">
                    {new Date(staffData.joinDate).toLocaleDateString('en-US', { 
                      month: 'short', 
                      year: 'numeric' 
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
                  <div className="font-medium text-sm">{staffData.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div className="font-medium">{staffData.phone}</div>
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
                {staffData.specializations.map((spec) => (
                  <Badge key={spec} variant="secondary">
                    {spec}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Professional Identity (DID)</CardTitle>
            </div>
            <CardDescription>
              Your verified professional identity on the blockchain
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4">
              <div className="text-sm text-muted-foreground">DID</div>
              <div className="mt-1 font-mono text-sm font-medium">{staffData.did}</div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              This DID verifies your credentials and authorizes access to patient records.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Certifications & Qualifications</CardTitle>
            <CardDescription>
              Your professional credentials and certifications
            </CardDescription>
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
                    <div className="text-sm text-muted-foreground">
                      {cert.issuer}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-success/10 text-success">
                    {cert.year}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" asChild>
            <Link to="/staff">
              Back to Dashboard
            </Link>
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
