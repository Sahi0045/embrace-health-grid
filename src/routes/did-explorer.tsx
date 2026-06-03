import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { DIDCard } from "@/components/did/DIDCard";
import { DIDStatusChip } from "@/components/did/DIDStatusChip";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { mockAuditEvents } from "@/lib/mock-audit";
import { Search, ShieldCheck, User, Stethoscope, Bed, Wrench, Ambulance } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/did-explorer")({
  head: () => ({ meta: [{ title: "DID Explorer — DID Hospital" }] }),
  component: DIDExplorerPage,
});

type DIDSearchType = "patient" | "doctor" | "bed" | "equipment" | "ambulance";

interface DIDResult {
  did: string;
  subject: string;
  type: DIDSearchType;
  status: "active" | "revoked" | "suspended";
  issuedAt: string;
  linkedCredentials: number;
  description: string;
}

const sampleDIDs: DIDResult[] = [
  { did: "did:hosp:0x4a91…b7d2", subject: "Anika Sharma", type: "patient", status: "active", issuedAt: "2025-01-12", linkedCredentials: 6, description: "Patient · MRN-204871 · O+ · Apollo Hospitals" },
  { did: "did:hosp:0xd103…99aa", subject: "Dr. Ravi Menon", type: "doctor", status: "active", issuedAt: "2024-11-08", linkedCredentials: 24, description: "Cardiologist · Apollo Hospitals · MBBS MD DM" },
  { did: "did:hosp:bed:A1", subject: "Bed A-1, Ward 4A", type: "bed", status: "active", issuedAt: "2024-08-01", linkedCredentials: 3, description: "HDU Bed · Cardiology Ward 4A · Floor 4 Main Block" },
  { did: "did:hosp:equipment:equip_0001", subject: "SIEMENS MAGNETOM 3T MRI #001", type: "equipment", status: "active", issuedAt: "2024-09-15", linkedCredentials: 1, description: "MRI Scanner · Radiology Dept · Siemens Healthineers" },
  { did: "did:hosp:ambulance:amb_001", subject: "MH-01-AM-1000", type: "ambulance", status: "active", issuedAt: "2024-06-20", linkedCredentials: 2, description: "ALS Ambulance · Driver: Ramesh K. · Available" },
  { did: "did:hosp:0x91c2…ee04", subject: "Rohan Iyer", type: "patient", status: "active", issuedAt: "2025-02-04", linkedCredentials: 4, description: "Patient · MRN-204902 · B+ · Apollo Hospitals" },
  { did: "did:hosp:0x55ef…7711", subject: "Dr. Aanya Verma", type: "doctor", status: "active", issuedAt: "2025-01-30", linkedCredentials: 18, description: "Radiologist · Apollo Hospitals · MBBS MD Radiology" },
  { did: "did:hosp:0x019a…ff32", subject: "Old Test Account", type: "patient", status: "revoked", issuedAt: "2024-02-01", linkedCredentials: 0, description: "Revoked · Test account · Deactivated 2024-06-01" },
];

const typeConfig: Record<DIDSearchType, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  patient: { icon: User, label: "Patient", color: "text-primary" },
  doctor: { icon: Stethoscope, label: "Doctor", color: "text-chart-2" },
  bed: { icon: Bed, label: "Bed", color: "text-success" },
  equipment: { icon: Wrench, label: "Equipment", color: "text-chart-4" },
  ambulance: { icon: Ambulance, label: "Ambulance", color: "text-destructive" },
};

function DIDExplorerPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DIDSearchType | "all">("all");
  const [selected, setSelected] = useState<DIDResult | null>(null);

  const filtered = sampleDIDs.filter(d =>
    (typeFilter === "all" || d.type === typeFilter) &&
    (d.did.toLowerCase().includes(query.toLowerCase()) ||
     d.subject.toLowerCase().includes(query.toLowerCase()) ||
     d.description.toLowerCase().includes(query.toLowerCase()))
  );

  const activityEvents = mockAuditEvents.slice(0, 20);

  return (
    <div className="min-h-screen">
      <PageHeader
        eyebrow="Global"
        title="DID Explorer"
        description="Search and inspect all DID records across the hospital network"
      />

      <div className="p-6 space-y-5">
        {/* Search bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-clinical flex-1 min-w-64">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search DID, subject, or description..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Type filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setTypeFilter("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${typeFilter === "all" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground"}`}
            >
              All
            </button>
            {(Object.entries(typeConfig) as [DIDSearchType, typeof typeConfig[DIDSearchType]][]).map(([type, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${typeFilter === type ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground"}`}
                >
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Results */}
          <div className="lg:col-span-3 space-y-3">
            <div className="text-xs text-muted-foreground">{filtered.length} results</div>
            {filtered.map((did) => {
              const cfg = typeConfig[did.type];
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={did.did}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelected(selected?.did === did.did ? null : did)}
                  className={`cursor-pointer rounded-xl border bg-card p-4 shadow-clinical hover:shadow-clinical-md transition-all ${selected?.did === did.did ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{did.subject}</span>
                        <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                        <DIDStatusChip status={did.status} size="sm" />
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-muted-foreground">{did.did}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{did.description}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-medium text-foreground">{did.linkedCredentials} creds</div>
                      <div className="text-[10px] text-muted-foreground">{did.issuedAt}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-12 text-center">
                <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <div className="text-sm font-medium text-muted-foreground">No DIDs found for "{query}"</div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div key={selected.did} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                  <DIDCard
                    did={selected.did}
                    subject={selected.subject}
                    role={selected.type === "patient" || selected.type === "doctor" ? selected.type : "equipment"}
                    subLabel={selected.description}
                    status={selected.status}
                  />

                  <div className="mt-4 rounded-xl border border-border bg-card p-4">
                    <div className="text-xs font-semibold text-foreground mb-3">Activity Timeline</div>
                    <AuditTimeline events={activityEvents} limit={8} />
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-dashed border-border p-10 text-center">
                  <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <div className="text-sm text-muted-foreground">Select a DID to view details</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Activity feed */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-semibold text-foreground mb-3">Network Activity</div>
              <AuditTimeline events={activityEvents} limit={6} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
