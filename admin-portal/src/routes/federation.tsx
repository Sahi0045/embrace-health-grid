import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { FederationHospitalCard } from "@/components/federation/FederationHospitalCard";
import { FederationNode, type FederationNodeData } from "@/components/federation/FederationNode";
import { Building2, ShieldCheck, Link2, CheckCircle, Clock, Globe } from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export const Route = createFileRoute("/federation")({
  head: () => ({ meta: [{ title: "Federation — Admin Console" }] }),
  component: FederationPage,
});

const federatedHospitals: FederationNodeData[] = [
  {
    id: "fh1", name: "Max Healthcare, Delhi",
    did: "did:hosp:fed:max001", city: "New Delhi",
    trust: "full", status: "connected",
    sharedCredentials: 1240, crossVerifications: 312, lastSync: "2026-06-02 09:45",
    specialties: ["Cardiology", "Oncology", "Neurology", "Transplant"],
  },
  {
    id: "fh2", name: "Fortis Hospitals, Bangalore",
    did: "did:hosp:fed:fortis001", city: "Bangalore",
    trust: "full", status: "connected",
    sharedCredentials: 892, crossVerifications: 214, lastSync: "2026-06-02 10:12",
    specialties: ["Orthopedics", "Cardiac Surgery", "Transplant"],
  },
  {
    id: "fh3", name: "AIIMS, New Delhi",
    did: "did:hosp:fed:aiims001", city: "New Delhi",
    trust: "full", status: "connected",
    sharedCredentials: 2104, crossVerifications: 580, lastSync: "2026-06-02 08:30",
    specialties: ["All Specialties", "Research", "Rare Diseases"],
  },
  {
    id: "fh4", name: "Narayana Health, Kolkata",
    did: "did:hosp:fed:narayana001", city: "Kolkata",
    trust: "partial", status: "pending",
    sharedCredentials: 0, crossVerifications: 0, lastSync: "—",
    specialties: ["Cardiology", "Pediatrics"],
  },
  {
    id: "fh5", name: "Manipal Hospitals, Goa",
    did: "did:hosp:fed:manipal001", city: "Goa",
    trust: "partial", status: "connected",
    sharedCredentials: 340, crossVerifications: 88, lastSync: "2026-06-01 16:20",
    specialties: ["General Medicine", "Emergency"],
  },
  {
    id: "fh6", name: "Aster Hospitals, Kochi",
    did: "did:hosp:fed:aster001", city: "Kochi",
    trust: "full", status: "connected",
    sharedCredentials: 561, crossVerifications: 143, lastSync: "2026-06-02 07:55",
    specialties: ["Cardiology", "Orthopedics", "Oncology"],
  },
];

const trustRelationships = [
  { source: "Apollo Hospitals (us)", target: "Max Healthcare", type: "Mutual DID Resolution + Credential Sharing", status: "active" },
  { source: "Apollo Hospitals (us)", target: "AIIMS Delhi", type: "Credential Sharing + Cross Verification", status: "active" },
  { source: "Apollo Hospitals (us)", target: "Fortis Hospitals", type: "Mutual DID Resolution", status: "active" },
  { source: "Apollo Hospitals (us)", target: "Aster Hospitals", type: "Mutual DID Resolution", status: "active" },
  { source: "Apollo Hospitals (us)", target: "Manipal Hospitals", type: "Partial Credential Sharing", status: "active" },
  { source: "Apollo Hospitals (us)", target: "Narayana Health", type: "Pending MOU", status: "pending" },
];

function FederationPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedHospital = federatedHospitals.find(h => h.id === selectedId) ?? null;

  const connected = federatedHospitals.filter(h => h.status === "connected").length;
  const totalCreds = federatedHospitals.reduce((s, h) => s + h.sharedCredentials, 0);
  const totalVerifications = federatedHospitals.reduce((s, h) => s + h.crossVerifications, 0);

  return (
    <RouteGuard requiredRole="admin">
      <PageHeader
        eyebrow="Admin Console"
        title="Hospital Federation Network"
        description="Connected hospitals, trust relationships, and cross-hospital credential verification"
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 px-6 pt-6">
        <StatCard label="Connected Hospitals" value={connected} icon={Building2} tone="success"
          delta={`${federatedHospitals.length} total in network`} />
        <StatCard label="Shared Credentials" value={totalCreds.toLocaleString()} icon={ShieldCheck} tone="default"
          delta="Cross-hospital issued" />
        <StatCard label="Cross Verifications" value={totalVerifications.toLocaleString()} icon={CheckCircle} tone="default"
          delta="Verified across network" />
        <StatCard label="Trust Relationships" value={trustRelationships.length} icon={Link2} tone="default"
          delta={`${trustRelationships.filter(t => t.status === "active").length} active`} />
      </div>

      <div className="p-6 space-y-6">
        <div className="flex gap-6">
          {/* Hospital cards */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Federation Members ({federatedHospitals.length})
            </div>
            <StaggerList className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {federatedHospitals.map(h => (
                <StaggerItem key={h.id}>
                  <FederationHospitalCard
                    hospital={h}
                    showActions
                    onViewDetails={(id) => setSelectedId(id === selectedId ? null : id)}
                    onDisconnect={(id) => console.log("disconnect", id)}
                  />
                </StaggerItem>
              ))}
            </StaggerList>
          </div>

          {/* Selected hospital detail */}
          <AnimatePresence mode="wait">
            {selectedHospital && (
              <motion.div
                key={selectedHospital.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                className="w-80 shrink-0"
              >
                <FederationNode node={selectedHospital} size="lg" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Trust relationships table */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Link2 className="h-4 w-4 text-primary" />
            Trust Relationships ({trustRelationships.length})
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {["Source", "Target", "Relationship Type", "Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trustRelationships.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium">{r.source}</td>
                    <td className="px-4 py-3 text-foreground font-medium">{r.target}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${r.status === "active" ? "bg-success/10 text-success" : "bg-warning/10 text-warning-foreground"}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${r.status === "active" ? "bg-success" : "bg-warning"}`} />
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Network visualization placeholder */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Globe className="h-4 w-4 text-primary" />
            Federation Network Map
          </div>
          <div className="relative h-48 rounded-xl bg-muted/40 overflow-hidden flex items-center justify-center">
            {/* Animated node network */}
            <svg viewBox="0 0 600 200" className="absolute inset-0 w-full h-full opacity-20">
              {[
                [300, 100], [100, 60], [500, 60], [80, 150], [520, 150], [300, 170],
              ].map(([cx, cy], i) => (
                <g key={i}>
                  <circle cx={cx} cy={cy} r={8} fill="hsl(var(--primary))" />
                  {i > 0 && <line x1={300} y1={100} x2={cx} y2={cy} stroke="hsl(var(--primary))" strokeWidth={1.5} />}
                </g>
              ))}
            </svg>
            <div className="relative text-center">
              <Globe className="h-10 w-10 mx-auto text-primary/30 mb-2" />
              <div className="text-sm font-medium text-muted-foreground">{connected} hospitals connected</div>
              <div className="text-xs text-muted-foreground">{totalVerifications.toLocaleString()} cross-verifications performed</div>
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
