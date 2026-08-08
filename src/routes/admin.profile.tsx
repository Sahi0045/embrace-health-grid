import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  Shield,
  LogOut,
  Edit,
  Key,
  Building2,
  Lock,
} from "lucide-react";
import { RouteGuard } from "@/components/RouteGuard";
import { signOut } from "@/lib/auth.server";
import { useCurrentUser } from "@/lib/auth-context";
import { getMyHospital } from "@/lib/hospitals.server";
import { getAuditEvents } from "@/lib/api";
import { useEffect, useState } from "react";

/**
 * audit_events.action holds machine values like "did.issue" or "record_create".
 * Render them as prose rather than leaking the enum into the UI.
 */
function formatAuditAction(action?: string): string {
  if (!action) return "Action";
  return action
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Relative time for recent events, absolute date once they are older than a week. */
function formatAuditTime(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const Route = createFileRoute("/admin/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Admin Console" },
      { name: "description", content: "View and manage your admin profile" },
    ],
  }),
  component: AdminProfileGuarded,
});

/**
 * Static parts of an administrator profile.
 *
 * Name, email, DID, hospital and role now come from the session — this page
 * previously rendered a hardcoded fixture ("Priya Krishnan",
 * priya.krishnan@apollohospitals.com, ADM-1042), so every administrator of every
 * hospital saw the same fictional person as their own profile.
 *
 * What remains here is genuinely static: the permission set attached to the admin
 * role. Employee id, phone and join date are not modelled on profiles, so they
 * are omitted rather than invented.
 */
const ADMIN_PERMISSIONS = [
  "User Management",
  "DID Issuance & Revocation",
  "Policy Configuration",
  "Audit Log Access",
  "System Configuration",
  "Compliance Reporting",
];

function AdminProfile() {
  const { user } = useCurrentUser();
  const [hospital, setHospital] = useState<{ name: string; city: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await getMyHospital()) as unknown as {
          hospital: { name: string; city: string | null } | null;
        };
        if (!cancelled) setHospital(res.hospital);
      } catch {
        // The profile should render even if the hospital lookup fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getAuditEvents();
        const mine = (res.events ?? [])
          .filter((e: { actor?: string }) => !user?.did || e.actor === user.did)
          .slice(0, 8)
          .map((e: { action?: string; resource?: string; loggedAt?: string }) => ({
            action: formatAuditAction(e.action),
            target: e.resource ?? "—",
            timestamp: formatAuditTime(e.loggedAt),
          }));
        if (!cancelled) setRecentActivity(mine);
      } catch {
        // The profile should still render if the audit read fails.
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.did]);

  // A super_admin operates the platform and has no hospital, so label it as such
  // rather than showing an empty field.
  const roleLabel =
    user?.role === "super_admin" ? "Platform Administrator" : "Hospital Administrator";

  // Real administrative actions from audit_events. This used to be a fabricated
  // list ("Issued DID to Karthik Rao (MRN-205288)" — a person who does not
  // exist), then an empty array. Scoped to this admin's own DID: an admin's RLS
  // view spans their whole hospital, so an unfiltered read would show colleagues'
  // actions on a page titled "Your recent administrative actions".
  const [recentActivity, setRecentActivity] = useState<
    { action: string; target: string; timestamp: string }[]
  >([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const handleLogout = () => {
    // The session is an httpOnly cookie, so only the server can end it.
    // Clearing localStorage left the user signed in.
    void signOut().finally(() => {
      window.location.href = "/login";
    });
  };

  return (
    <RouteGuard requiredRole="admin">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <PageHeader title="My Profile" description="View and manage your administrator profile" />

        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-chart-4/10 text-chart-4">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">
                      {user?.fullName ?? user?.email ?? "—"}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {roleLabel} {hospital?.name ? `• ${hospital.name}` : ""}
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
                    <div className="text-sm text-muted-foreground">Hospital</div>
                    <div className="font-medium">{hospital?.name ?? "—"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Access Level</div>
                    <div className="font-medium">{roleLabel}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Email</div>
                    <div className="font-medium text-sm">{user?.email ?? "—"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Location</div>
                    <div className="font-medium">{hospital?.city ?? "—"}</div>
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
                  {ADMIN_PERMISSIONS.map((perm) => (
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
                <div className="mt-1 font-mono text-sm font-medium">
                  {user?.primaryDid ?? "not issued"}
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  This DID grants system-wide administrative access. All actions are logged and
                  audited.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your recent administrative actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activityLoading ? (
                  <p className="text-sm text-muted-foreground">Loading your activity…</p>
                ) : recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No administrative actions recorded yet.
                  </p>
                ) : null}
                {recentActivity.map((activity, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <div className="font-medium">{activity.action}</div>
                      <div className="text-sm text-muted-foreground">{activity.target}</div>
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
              <Link to="/">Back to Console</Link>
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

/**
 * Admin gate. The role comes from Postgres via the server-verified session, and
 * RLS enforces the boundary independently — bypassing this renders empty data,
 * not another user's records.
 */
function AdminProfileGuarded() {
  return (
    <RouteGuard requiredRole="admin">
      <AdminProfile />
    </RouteGuard>
  );
}
