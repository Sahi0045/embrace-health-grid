import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hospital, Users, Fingerprint, Award, GitBranch, Link2, Plus } from "lucide-react";
import { getHospitals } from "@/lib/hospitals.server";

export const Route = createFileRoute("/super/")({
  head: () => ({ meta: [{ title: "Platform — Embrace Health Grid" }] }),
  component: SuperHomeGuarded,
});

interface HospitalRow {
  hospital_id: string;
  name: string;
  status: "active" | "suspended";
  onchain_tx: string | null;
  staff_count?: number;
  patient_count?: number;
}

function SuperHome() {
  const [hospitals, setHospitals] = useState<HospitalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = (await getHospitals()) as unknown as { hospitals: HospitalRow[] };
      setHospitals(res.hospitals ?? []);
    } catch {
      // The hub should still render if the count query fails.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = hospitals.filter((h) => h.status === "active").length;
  const suspended = hospitals.filter((h) => h.status !== "active").length;
  const anchored = hospitals.filter((h) => h.onchain_tx).length;
  const staff = hospitals.reduce((n, h) => n + (h.staff_count ?? 0), 0);
  const patients = hospitals.reduce((n, h) => n + (h.patient_count ?? 0), 0);

  const stats = [
    { label: "Hospitals", value: hospitals.length, icon: Hospital },
    { label: "Active", value: active, icon: Hospital },
    { label: "Suspended", value: suspended, icon: Hospital },
    { label: "On chain", value: anchored, icon: Link2 },
    { label: "Staff", value: staff, icon: Users },
    { label: "Patients", value: patients, icon: Users },
  ];

  const tools = [
    {
      title: "Hospitals",
      description: "Admit a hospital, issue its DID, suspend or reinstate it.",
      url: "/super/hospitals" as const,
      icon: Hospital,
    },
    {
      title: "DID Registry",
      description: "Every decentralized identifier across all hospitals.",
      url: "/did-explorer" as const,
      icon: Fingerprint,
    },
    {
      title: "Security & Audit Trail",
      description: "Audit activity across every tenant.",
      url: "/audit-timeline" as const,
      icon: GitBranch,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <PageHeader
        eyebrow="Platform"
        title="Platform operations"
        description="You operate the consortium: admit hospitals, issue their DIDs, and oversee the registry. Hospitals manage their own staff and patients."
        actions={
          <Button asChild size="sm">
            <Link to="/super/hospitals">
              <Plus className="mr-2 h-4 w-4" />
              Onboard hospital
            </Link>
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <div className="mt-1 text-2xl font-bold text-foreground">{loading ? "—" : value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {tools.map(({ title, description, url, icon: Icon }) => (
          <Link key={url} to={url}>
            <Card className="h-full transition-shadow hover:shadow-clinical-md">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground">{title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {!loading && hospitals.length > 0 && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hospitals
            </div>
            <div className="space-y-2">
              {hospitals.map((h) => (
                <div
                  key={h.hospital_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm"
                >
                  <span className="font-medium text-foreground">{h.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {h.staff_count ?? 0} staff · {h.patient_count ?? 0} patients
                    </span>
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
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Platform hub. /super previously had no index route at all, so the URL returned
 * a 404 even though /super/hospitals worked — every other portal has a landing
 * page at its root.
 */
function SuperHomeGuarded() {
  return (
    <RouteGuard requiredRole="super_admin">
      <SuperHome />
    </RouteGuard>
  );
}
