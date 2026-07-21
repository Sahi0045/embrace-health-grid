import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { InsuranceCard } from "@/components/insurance/InsuranceCard";
import { ClaimsCard } from "@/components/insurance/ClaimsCard";
import { useInsuranceClaims, useLivePatients } from "@/hooks/use-api";
import { getCurrentUser } from "@/lib/auth";
import { ShieldCheck, FileText, TrendingUp, IndianRupee, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { getInsurancePolicies } from "@/lib/api";

export const Route = createFileRoute("/patient/insurance")({
  head: () => ({ meta: [{ title: "Insurance — Embrace Health Grid" }] }),
  component: InsurancePage,
});

const tabs = ["Overview", "Policies", "Claims"] as const;
type Tab = typeof tabs[number];

function InsurancePage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const { data: claimsData } = useInsuranceClaims();
  const { patients, loading } = useLivePatients();
  const currentUser = getCurrentUser();
  const patient = patients?.find((p: any) => p.email === currentUser?.email);

  if (loading) {
    return (
      <RouteGuard requiredRole="patient">
        <PageHeader
          eyebrow="Patient app"
          title="Insurance"
          description="Your coverage, claims, and insurance credentials"
        />
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
          Loading insurance details…
        </div>
      </RouteGuard>
    );
  }

  const livePolicies = patient?.insuranceProvider ? [
    {
      provider: patient.insuranceProvider,
      policyNo: patient.insurancePolicyNo || "POL-UNKNOWN-001",
      type: "Comprehensive Health Plan",
      sumInsured: 1000000,
      used: 0,
      validFrom: "2025-04-01",
      validTo: "2026-03-31",
      status: "active" as const,
    }
  ] : [
    {
      provider: "Embrace Health Insurance",
      policyNo: "POL-EMBRACE-DEFAULT",
      type: "Comprehensive Health Plan",
      sumInsured: 1000000,
      used: 145000,
      validFrom: "2025-04-01",
      validTo: "2026-03-31",
      status: "active" as const,
    }
  ];

  const patientClaims = (claimsData?.claims ?? []).slice(0, 10);
  const activeClaims = patientClaims.filter((c: any) => c.status === "pending" || c.status === "under-review");
  const totalClaimed = patientClaims.reduce((s: number, c: any) => s + (c.amount || 0), 0);
  const totalApproved = patientClaims.filter((c: any) => c.approvedAmount).reduce((s: number, c: any) => s + (c.approvedAmount ?? 0), 0);

  const [policies, setPolicies] = useState<any[]>([]);
  const patientDid = typeof window !== "undefined" ? localStorage.getItem("userDID") || "" : "";

  useEffect(() => {
    if (!patientDid) return;
    getInsurancePolicies(patientDid)
      .then((res) => setPolicies(res.policies || []))
      .catch((err) => console.error("Error loading policies:", err));
  }, [patientDid]);


  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Patient app"
        title="Insurance"
        description="Your coverage, claims, and insurance credentials"
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-8 bg-card">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 space-y-6">
        {tab === "Overview" && (
          <StaggerList className="space-y-5">
            <StaggerItem>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Active Policies", value: livePolicies.filter(p => p.status === "active").length, icon: ShieldCheck, color: "text-success bg-success/10" },
                  { label: "Total Claimed", value: `₹${(totalClaimed / 1000).toFixed(0)}K`, icon: IndianRupee, color: "text-primary bg-primary/10" },
                  { label: "Total Approved", value: `₹${(totalApproved / 1000).toFixed(0)}K`, icon: TrendingUp, color: "text-chart-2 bg-chart-2/10" },
                  { label: "Pending Claims", value: activeClaims.length, icon: Clock, color: "text-warning-foreground bg-warning/10" },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-clinical">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</div>
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="mt-3 text-2xl font-semibold text-foreground">{s.value}</div>
                    </div>
                  );
                })}
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="space-y-4">
                <div className="text-sm font-semibold text-foreground">Active Coverage</div>
                {livePolicies.filter(p => p.status === "active").map((p, i) => (
                  <InsuranceCard key={i} {...p} />
                ))}
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Recent Claims
                </div>
                <div className="space-y-3">
                  {patientClaims.slice(0, 3).map((c: any) => <ClaimsCard key={c.id} claim={c} />)}
                </div>
              </div>
            </StaggerItem>
          </StaggerList>
        )}

        {tab === "Policies" && (
          <div className="space-y-4">
            {livePolicies.map((p, i) => <InsuranceCard key={i} {...p} />)}
          </div>
        )}

        {tab === "Claims" && (
          <div className="space-y-3">
            {patientClaims.map((c: any) => <ClaimsCard key={c.id} claim={c} />)}
          </div>
        )}

      </div>
    </RouteGuard>
  );
}
