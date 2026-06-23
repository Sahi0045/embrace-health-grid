import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Mail, Phone, Calendar, Shield, LogOut, Edit, Key, Building2, Lock } from "lucide-react";
import { RouteGuard } from "@/components/RouteGuard";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Admin Console" },
      { name: "description", content: "View and manage your admin profile" },
    ],
  }),
  component: AdminProfile,
});

const adminData = {
  name: "Priya Krishnan",
  did: "did:hosp:0xa7f2…8d91",
  employeeId: "ADM-1042",
  email: "priya.krishnan@apollohospitals.com",
  phone: "+91 98765 12345",
  department: "IT & Security",
  role: "System Administrator",
  joinDate: "2020-06-01",
  accessLevel: "Super Admin",
  permissions: [
    "User Management",
    "DID Issuance & Revocation",
    "Policy Configuration",
    "Audit Log Access",
    "System Configuration",
    "Compliance Reporting",
  ],
  recentActivity: [
    { action: "Issued DID", target: "Karthik Rao (MRN-205288)", timestamp: "2026-05-29 14:32" },
    { action: "Updated Policy", target: "Default consent expiry", timestamp: "2026-05-28 11:15" },
    { action: "Reviewed Audit", target: "Fraud Alert #F1", timestamp: "2026-05-27 16:48" },
  ],
};

function AdminProfile() {
  const handleLogout = () => {
    localStorage.removeItem("userRole");
    localStorage.removeItem("userEmail");
    window.location.href = "/login";
  };

  return (
    <RouteGuard requiredRole="admin">
      <div className="container mx-auto max-w-4xl px-4 py-6">
      <PageHeader
        title="My Profile"
        description="View and manage your administrator profile"
      />

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-chart-4/10 text-chart-4">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{adminData.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {adminData.role} • {adminData.employeeId}
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
                  <div className="font-medium">{adminData.department}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Access Level</div>
                  <div className="font-medium">{adminData.accessLevel}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div className="font-medium text-sm">{adminData.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div className="font-medium">{adminData.phone}</div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Key className="h-4 w-4 text-primary" />
                System Permissions
              </div>
              <div className="flex flex-wrap gap-2">
                {adminData.permissions.map((perm) => (
                  <Badge key={perm} variant="secondary">
                    {perm}
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
              <CardTitle>Administrator Identity (DID)</CardTitle>
            </div>
            <CardDescription>
              Your verified administrator identity with elevated privileges
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4">
              <div className="text-sm text-muted-foreground">DID</div>
              <div className="mt-1 font-mono text-sm font-medium">{adminData.did}</div>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                This DID grants system-wide administrative access. All actions are logged and audited.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Your recent administrative actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {adminData.recentActivity.map((activity, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <div className="font-medium">{activity.action}</div>
                    <div className="text-sm text-muted-foreground">
                      {activity.target}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {activity.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" asChild>
            <Link to="/admin">
              Back to Console
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
