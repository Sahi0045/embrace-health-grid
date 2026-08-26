/**
 * /super/admins — Hospital Admins Management
 *
 * Super Admin only. Lists all hospital administrators across every hospital,
 * lets the super admin create a new hospital admin for any hospital, and lets
 * them suspend/reinstate an admin account.
 *
 * Why this is super-admin only
 * ----------------------------
 * A hospital admin may onboard doctors and staff for their OWN hospital via the
 * standard /admin/onboarding route. They must not be able to create a second
 * admin for a DIFFERENT hospital or promote themselves — that's platform-level
 * configuration.
 */

import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCog, Plus, RefreshCw, Hospital } from "lucide-react";
import { toast } from "sonner";
import { getHospitals } from "@/lib/hospitals.server";
import { getHospitalAdmins, createHospitalAdmin } from "@/lib/super-admin.server";

export const Route = createFileRoute("/super/admins")({
  head: () => ({ meta: [{ title: "Platform · Hospital Admins — Embrace Health Grid" }] }),
  component: AdminsPageGuarded,
});

interface AdminRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  hospital_id: string | null;
  hospital_name?: string;
  created_at: string;
}

interface HospitalOption {
  hospital_id: string;
  name: string;
  status: string;
}

function AdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hospitalId, setHospitalId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [adminRes, hospRes] = await Promise.all([
        getHospitalAdmins() as unknown as Promise<{ admins: AdminRow[] }>,
        getHospitals() as unknown as Promise<{ hospitals: HospitalOption[] }>,
      ]);
      setAdmins(adminRes.admins ?? []);
      setHospitals((hospRes.hospitals ?? []).filter((h) => h.status === "active"));
    } catch (err: unknown) {
      toast.error("Could not load data", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setHospitalId("");
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || password.length < 8 || !hospitalId) {
      toast.error("All fields are required, and password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    try {
      await createHospitalAdmin({
        data: {
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          hospitalId,
        },
      });

      const hosp = hospitals.find((h) => h.hospital_id === hospitalId);
      toast.success(`Admin created for ${hosp?.name ?? "hospital"}`);
      resetForm();
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create admin");
    } finally {
      setSubmitting(false);
    }
  };

  // Group admins by hospital
  const byHospital = new Map<string, AdminRow[]>();
  for (const admin of admins) {
    const key = admin.hospital_id ?? "unassigned";
    const existing = byHospital.get(key) ?? [];
    existing.push(admin);
    byHospital.set(key, existing);
  }

  const hospitalNameMap = new Map(hospitals.map((h) => [h.hospital_id, h.name]));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <PageHeader
        eyebrow="Platform"
        title="Hospital Admins"
        description="Each hospital has one or more administrators who onboard doctors, staff, and patients. Only the Super Admin can create or assign hospital administrators."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="mr-2 h-4 w-4" />
              Add admin
            </Button>
          </div>
        }
      />

      {showForm && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Create Hospital Administrator</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="aFullName">Full name</Label>
                  <Input
                    id="aFullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Ravi Sharma"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aEmail">Email</Label>
                  <Input
                    id="aEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@hospital.org"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="aPassword">Initial password</Label>
                  <Input
                    id="aPassword"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Share via a secure channel — cannot be recovered after creation.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aHospital">Assign to hospital</Label>
                  <Select value={hospitalId} onValueChange={setHospitalId}>
                    <SelectTrigger id="aHospital">
                      <SelectValue placeholder="Select hospital…" />
                    </SelectTrigger>
                    <SelectContent>
                      {hospitals.map((h) => (
                        <SelectItem key={h.hospital_id} value={h.hospital_id}>
                          {h.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">This admin will be able to:</strong> onboard
                doctors, staff, and patients to the selected hospital; manage rooms, beds,
                appointments, certifications, and all hospital-specific data. They cannot access
                other hospitals.
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  <UserCog className="mr-2 h-4 w-4" />
                  {submitting ? "Creating…" : "Create administrator"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading administrators…</div>
        ) : admins.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No hospital admins yet. Add the first one above.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Array.from(byHospital.entries()).map(([hId, hAdmins]) => (
              <Card key={hId}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Hospital className="h-4 w-4 text-primary" />
                    {hId === "unassigned"
                      ? "Unassigned"
                      : hospitalNameMap.get(hId) ?? hId}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {hAdmins.map((admin) => (
                      <div
                        key={admin.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-foreground text-sm">
                            {admin.full_name}
                          </div>
                          <div className="text-xs text-muted-foreground">{admin.email}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className="border-primary/30 bg-primary/10 text-primary text-xs"
                          >
                            {admin.role}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(admin.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminsPageGuarded() {
  return (
    <RouteGuard requiredRole="super_admin">
      <AdminsPage />
    </RouteGuard>
  );
}
