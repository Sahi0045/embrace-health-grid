import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { DIDCard } from "@/components/did/DIDCard";
import { DIDStatusChip } from "@/components/did/DIDStatusChip";
import { Users, ShieldCheck, Shield, Baby, User, Plus } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/patient/family")({
  head: () => ({ meta: [{ title: "Family & Guardians — DID Hospital" }] }),
  component: FamilyPage,
});

const familyMembers = [
  {
    id: "f1",
    name: "Sunil Sharma",
    relation: "Spouse",
    did: "did:hosp:0xb812…1a04",
    role: "patient" as const,
    accessLevel: "Full healthcare access",
    permissions: ["View records", "Sign consents", "Emergency access", "Billing"],
    status: "active" as const,
  },
  {
    id: "f2",
    name: "Aarav Sharma",
    relation: "Son (Minor)",
    did: "did:hosp:0xc044…fe21",
    role: "patient" as const,
    accessLevel: "Guardian delegation",
    permissions: ["View pediatric records", "Emergency access"],
    status: "active" as const,
  },
  {
    id: "f3",
    name: "Rekha Sharma",
    relation: "Mother (Elder care)",
    did: "did:hosp:0x3311…9d00",
    role: "patient" as const,
    accessLevel: "Elder care access",
    permissions: ["View records", "Manage medications", "Emergency access"],
    status: "active" as const,
  },
];

const delegations = [
  { id: "d1", delegateTo: "Sunil Sharma", scope: "All medical records", expiry: "2026-12-31", status: "active" },
  { id: "d2", delegateTo: "Sunil Sharma", scope: "Billing & Insurance", expiry: "2026-12-31", status: "active" },
  { id: "d3", delegateTo: "Dr. Ravi Menon", scope: "Cardiology records only", expiry: "2026-07-15", status: "active" },
];

function RelationIcon({ relation }: { relation: string }) {
  if (relation.includes("Son") || relation.includes("Minor")) return <Baby className="h-5 w-5 text-chart-2" />;
  if (relation.includes("Mother") || relation.includes("Elder")) return <Users className="h-5 w-5 text-chart-3" />;
  return <User className="h-5 w-5 text-primary" />;
}

function FamilyPage() {
  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Patient app"
        title="Family & Guardians"
        description="Manage family DIDs, guardian access, and delegation permissions"
        actions={
          <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Plus className="h-4 w-4" />
            Add Family Member
          </button>
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 space-y-6">
        <StaggerList className="space-y-5">
          {/* Family members */}
          <StaggerItem>
            <div className="text-sm font-semibold text-foreground mb-3">Family Members</div>
            <div className="space-y-4">
              {familyMembers.map((m) => (
                <div key={m.id} className="rounded-xl border border-border bg-card p-4 shadow-clinical">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
                        <RelationIcon relation={m.relation} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.relation}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">{m.did}</div>
                      </div>
                    </div>
                    <DIDStatusChip status={m.status} />
                  </div>

                  <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">{m.accessLevel}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.permissions.map((p) => (
                        <span key={p} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{p}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </StaggerItem>

          {/* Active delegations */}
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Access Delegations
              </div>
              <div className="space-y-2">
                {delegations.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-foreground">{d.delegateTo}</div>
                      <div className="text-xs text-muted-foreground">{d.scope} · Expires {d.expiry}</div>
                    </div>
                    <button className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors">
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </StaggerItem>

          {/* Privacy notice */}
          <StaggerItem>
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-foreground">DID-based Access Control</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  All family access is mediated by verifiable credentials. Each permission is individually signed and
                  time-limited. You can revoke access at any time. All access events are logged immutably.
                </div>
              </div>
            </div>
          </StaggerItem>
        </StaggerList>
      </div>
    </RouteGuard>
  );
}
