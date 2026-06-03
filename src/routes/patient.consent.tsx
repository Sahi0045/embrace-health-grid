import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { ConsentCard, type ConsentRecord } from "@/components/consent/ConsentCard";
import { ConsentHistory } from "@/components/consent/ConsentHistory";
import { ConsentToggle } from "@/components/consent/ConsentToggle";
import { consents as initial } from "@/lib/mock-data";
import { toast } from "sonner";
import { ShieldCheck, History, Settings2 } from "lucide-react";

export const Route = createFileRoute("/patient/consent")({
  head: () => ({ meta: [{ title: "Patient · Consent — DID Hospital" }] }),
  component: Consent,
});

// Global consent preferences
const globalPreferences = [
  { id: "gp1", label: "Emergency Access (Break-Glass)", description: "Allow emergency override when you are incapacitated", defaultEnabled: true },
  { id: "gp2", label: "Insurance Claim Verification", description: "Allow your insurer to verify credentials for claims", defaultEnabled: true },
  { id: "gp3", label: "Research Data Sharing", description: "Anonymised data may be used for medical research", defaultEnabled: false },
  { id: "gp4", label: "Cross-Hospital Record Access", description: "Allow federated hospitals to resolve your DID", defaultEnabled: false },
];

type Tab = "active" | "history" | "preferences";

function Consent() {
  const [tab, setTab] = useState<Tab>("active");
  const [list, setList] = useState<ConsentRecord[]>(
    initial.map(c => ({ ...c, status: c.status as ConsentRecord["status"] }))
  );

  const handleRevoke = (id: string) => {
    setList(prev => prev.map(c => c.id === id ? { ...c, status: "revoked" as const } : c));
    const c = list.find(x => x.id === id);
    toast.success(`Access revoked from ${c?.requester}`);
  };

  const handleApprove = (id: string) => {
    setList(prev => prev.map(c => c.id === id ? { ...c, status: "active" as const } : c));
    const c = list.find(x => x.id === id);
    toast.success(`Consent approved for ${c?.requester}`);
  };

  const active = list.filter(c => c.status === "active");
  const pending = list.filter(c => c.status === "pending");
  const history = list.filter(c => c.status === "revoked" || c.status === "expired");

  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Patient app"
        title="Consent Management"
        description="Control who can access your health records and manage permissions"
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-8 bg-card">
        {([
          { key: "active" as Tab, label: `Active (${active.length + pending.length})`, icon: ShieldCheck },
          { key: "history" as Tab, label: "History", icon: History },
          { key: "preferences" as Tab, label: "Preferences", icon: Settings2 },
        ]).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8">
        {tab === "active" && (
          <div className="space-y-5">
            {/* Pending requests first */}
            {pending.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-warning-foreground">
                    Pending Requests ({pending.length})
                  </span>
                </div>
                <StaggerList className="grid gap-3 sm:grid-cols-2">
                  {pending.map(c => (
                    <StaggerItem key={c.id}>
                      <ConsentCard consent={c} onApprove={handleApprove} onRevoke={handleRevoke} />
                    </StaggerItem>
                  ))}
                </StaggerList>
              </div>
            )}

            {/* Active consents */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Active Consents ({active.length})
                </span>
              </div>
              {active.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  No active consents
                </div>
              ) : (
                <StaggerList className="grid gap-3 sm:grid-cols-2">
                  {active.map(c => (
                    <StaggerItem key={c.id}>
                      <ConsentCard consent={c} onRevoke={handleRevoke} />
                    </StaggerItem>
                  ))}
                </StaggerList>
              )}
            </div>
          </div>
        )}

        {tab === "history" && (
          <div>
            <div className="text-xs text-muted-foreground mb-4">
              Complete consent activity — all events are immutably recorded on the audit ledger
            </div>
            <ConsentHistory consents={list} />
          </div>
        )}

        {tab === "preferences" && (
          <div className="space-y-3 max-w-xl">
            <div className="text-xs text-muted-foreground mb-4">
              Global consent preferences apply across all healthcare providers in your network
            </div>
            {globalPreferences.map(p => (
              <ConsentToggle
                key={p.id}
                label={p.label}
                description={p.description}
                defaultEnabled={p.defaultEnabled}
                onToggle={(enabled) => toast(enabled ? `${p.label} enabled` : `${p.label} disabled`)}
              />
            ))}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
