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
  Hospital,
  Plus,
  ShieldCheck,
  ShieldX,
  Copy,
  Check,
  Link2,
  Users,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { getHospitals, onboardHospital, setHospitalStatus } from "@/lib/hospitals.server";

export const Route = createFileRoute("/super/hospitals")({
  head: () => ({ meta: [{ title: "Platform · Hospitals — Embrace Health Grid" }] }),
  component: HospitalsPageGuarded,
});

interface HospitalRow {
  hospital_id: string;
  hospital_did: string;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  status: "active" | "suspended";
  onchain_tx: string | null;
  staff_count?: number;
  patient_count?: number;
}

interface OnboardResult {
  hospitalId: string;
  hospitalDid: string;
  name: string;
  credentialId: string;
  admin: { email: string; did: string };
  onchain: { signature: string; slot: number } | null;
  anchorError: string | null;
}

function HospitalsPage() {
  const [hospitals, setHospitals] = useState<HospitalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OnboardResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("IN");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await getHospitals()) as unknown as { hospitals: HospitalRow[] };
      setHospitals(res.hospitals ?? []);
    } catch (err: unknown) {
      toast.error("Could not load hospitals", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const resetForm = () => {
    setName("");
    setCity("");
    setAdminFullName("");
    setAdminEmail("");
    setAdminPassword("");
    setResult(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !adminEmail.trim() || !adminFullName.trim() || adminPassword.length < 8) {
      toast.error(
        "Hospital name, admin name, admin email and an 8+ character password are required",
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = (await onboardHospital({
        data: {
          name: name.trim(),
          city: city.trim() || undefined,
          country: country.trim() || undefined,
          adminEmail: adminEmail.trim(),
          adminPassword,
          adminFullName: adminFullName.trim(),
        },
      })) as unknown as OnboardResult;

      setResult(res);
      // An anchor failure is not an onboarding failure: the hospital is usable
      // and the registration can be retried, so say so rather than implying the
      // whole operation failed.
      if (res.anchorError) {
        toast.warning(`${res.name} admitted, on-chain registration pending`, {
          description: res.anchorError,
        });
      } else {
        toast.success(`${res.name} admitted to the consortium`);
      }
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (h: HospitalRow) => {
    const next = h.status === "active" ? "suspended" : "active";
    try {
      await setHospitalStatus({ data: { hospitalId: h.hospital_id, status: next } });
      toast.success(`${h.name} is now ${next}`);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not change status");
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <PageHeader
        eyebrow="Platform"
        title="Hospitals"
        description="Each hospital receives its own DID and becomes the issuing authority for the credentials it grants its staff."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="mr-2 h-4 w-4" />
              Onboard hospital
            </Button>
          </div>
        }
      />

      {result && (
        <Card className="mt-6 border-success/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Check className="h-4 w-4 text-success" />
              {result.name} is ready
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Share the admin password over a secure channel — it cannot be recovered from here.
            </p>
            {[
              { label: "Hospital DID", value: result.hospitalDid },
              { label: "Credential", value: result.credentialId },
              { label: "Admin", value: result.admin.email },
              { label: "Admin DID", value: result.admin.did },
              ...(result.onchain
                ? [{ label: "On-chain tx", value: result.onchain.signature }]
                : []),
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </div>
                  <div className="truncate font-mono text-xs">{value}</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copy(label, value)}
                >
                  {copied === label ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            ))}

            {result.anchorError && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
                <div className="font-semibold">On-chain registration pending</div>
                <div className="mt-1 text-muted-foreground">
                  {result.anchorError}. The hospital is fully usable; the registration can be
                  retried without affecting it.
                </div>
              </div>
            )}

            <Button onClick={resetForm}>Done</Button>
          </CardContent>
        </Card>
      )}

      {showForm && !result && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Onboard a hospital</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hname">Hospital name</Label>
                  <Input
                    id="hname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="City Care Hospital"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Becomes the DID slug, capped at 19 characters by the on-chain seed limit.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hcity">City</Label>
                  <Input
                    id="hcity"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Pune"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  First hospital administrator
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="aname">Full name</Label>
                    <Input
                      id="aname"
                      value={adminFullName}
                      onChange={(e) => setAdminFullName(e.target.value)}
                      placeholder="Priya Nair"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aemail">Email</Label>
                    <Input
                      id="aemail"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@citycare.org"
                      required
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="apass">Initial password</Label>
                  <Input
                    id="apass"
                    type="text"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="mb-1 font-semibold text-foreground">This will create</div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">Hospital record</Badge>
                  <Badge variant="outline">Hospital DID</Badge>
                  <Badge variant="outline">Signed HospitalCredential</Badge>
                  <Badge variant="outline">On-chain registration</Badge>
                  <Badge variant="outline">Administrator account</Badge>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  <Hospital className="mr-2 h-4 w-4" />
                  {submitting ? "Onboarding…" : "Onboard hospital"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading hospitals…</div>
        ) : hospitals.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No hospitals yet. Onboard the first one to get started.
            </CardContent>
          </Card>
        ) : (
          hospitals.map((h) => (
            <Card key={h.hospital_id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{h.name}</span>
                    <Badge
                      variant="outline"
                      className={
                        h.status === "active"
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                      }
                    >
                      {h.status}
                    </Badge>
                    {h.onchain_tx ? (
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/10 text-primary"
                      >
                        <Link2 className="mr-1 h-3 w-3" />
                        on chain
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        anchor pending
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {h.hospital_did}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {h.city && <span>{[h.city, h.country].filter(Boolean).join(", ")}</span>}
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {h.staff_count ?? 0} staff · {h.patient_count ?? 0} patients
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleStatus(h)}
                  className={h.status === "active" ? "text-destructive" : "text-success"}
                >
                  {h.status === "active" ? (
                    <>
                      <ShieldX className="mr-2 h-4 w-4" />
                      Suspend
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Reinstate
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Platform-level, so super_admin only. A hospital admin must not be able to
 * admit a peer tenant or reinstate their own suspended hospital — the Edge
 * Function and RLS enforce that too; this only avoids rendering a page that
 * would fail.
 */
function HospitalsPageGuarded() {
  return (
    <RouteGuard requiredRole="super_admin">
      <HospitalsPage />
    </RouteGuard>
  );
}
