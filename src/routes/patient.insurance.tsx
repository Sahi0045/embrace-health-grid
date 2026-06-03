import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { InsuranceCard } from "@/components/insurance/InsuranceCard";
import { ClaimsCard } from "@/components/insurance/ClaimsCard";
import { mockInsuranceClaims } from "@/lib/mock-infrastructure";
import { ShieldCheck, FileText, TrendingUp, IndianRupee, Clock } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/patient/insurance")({
  head: () => ({ meta: [{ title: "Insurance — DID Hospital" }] }),
  component: InsurancePage,
});

const policies = [
  {
    provider: "Star Health Insurance",
    policyNo: "POL-2025-STAR-00881",
    type: "Comprehensive Health Plan",
    sumInsured: 1000000,
    used: 145000,
    validFrom: "2025-04-01",
    validTo: "2026-03-31",
    status: "active" as const,
  },
  {
    provider: "HDFC Ergo",
    policyNo: "POL-2024-HDFC-44201",
    type: "Top-Up Policy (₹5L)",
    sumInsured: 500000,
    used: 0,
    validFrom: "2024-07-15",
    validTo: "2025-07-14",
    status: "expired" as const,
  },
];

const tabs = ["Overview", "Policies", "Claims"] as const;
type Tab = typeof tabs[number];

function InsurancePage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const patientClaims = mockInsuranceClaims.slice(0, 10);
  const activeClaims = patientClaims.filter(c => c.status === "pending" || c.status === "under-review");
  const totalClaimed = patientClaims.reduce((s, c) => s + c.amount, 0);
  const totalApproved = patientClaims.filter(c => c.approvedAmount).reduce((s, c) => s + (c.approvedAmount ?? 0), 0);

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
                  { label: "Active Policies", value: policies.filter(p => p.status === "active").length, icon: ShieldCheck, color: "text-success bg-success/10" },
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
                {policies.filter(p => p.status === "active").map((p, i) => (
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
                  {patientClaims.slice(0, 3).map(c => <ClaimsCard key={c.id} claim={c} />)}
                </div>
              </div>
            </StaggerItem>
          </StaggerList>
        )}

        {tab === "Policies" && (
          <div className="space-y-4">
            {policies.map((p, i) => <InsuranceCard key={i} {...p} />)}
          </div>
        )}

        {tab === "Claims" && (
          <div className="space-y-3">
            {patientClaims.map(c => <ClaimsCard key={c.id} claim={c} />)}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
