import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Calendar, Droplet, AlertCircle, Shield, LogOut, Edit } from "lucide-react";
import { currentPatient, credentials } from "@/lib/mock-data";
import { RouteGuard } from "@/components/RouteGuard";

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
  const handleLogout = () => {
    localStorage.removeItem("userRole");
    localStorage.removeItem("userEmail");
    window.location.href = "/login";
  };

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 md:max-w-4xl">
      <PageHeader
        title="My Profile"
        description="View and manage your personal information"
      />

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-8 w-8" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{currentPatient.name}</CardTitle>
                  <CardDescription className="mt-1">
                    MRN: {currentPatient.mrn}
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
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Age</div>
                  <div className="font-medium">{currentPatient.age} years</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Gender</div>
                  <div className="font-medium">{currentPatient.gender === "M" ? "Male" : "Female"}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Droplet className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Blood Group</div>
                  <div className="font-medium">{currentPatient.bloodGroup}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div className="font-medium">{currentPatient.phone}</div>
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
                {currentPatient.allergies.map((allergy) => (
                  <Badge key={allergy} variant="destructive">
                    {allergy}
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
              <CardTitle>Decentralized Identity</CardTitle>
            </div>
            <CardDescription>
              Your unique digital identity on the blockchain
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4">
              <div className="text-sm text-muted-foreground">DID</div>
              <div className="mt-1 font-mono text-sm font-medium">{currentPatient.did}</div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              This DID is cryptographically secured and gives you control over your health data.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verifiable Credentials</CardTitle>
            <CardDescription>
              Your active credentials and certifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {credentials.filter(c => c.status === "active").map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <div className="font-medium">{cred.type}</div>
                    <div className="text-sm text-muted-foreground">
                      Issued by {cred.issuer}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-success/10 text-success">
                    Active
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" asChild>
            <Link to="/patient">
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
