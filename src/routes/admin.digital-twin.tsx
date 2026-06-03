import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { DIDRelationshipGraph, type GraphNode, type GraphEdge } from "@/components/did/DIDRelationshipGraph";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Building2, Bed, User, Stethoscope, Ambulance, Wrench,
  ShieldCheck, ChevronRight, X, Network, GitBranch,
} from "lucide-react";

export const Route = createFileRoute("/admin/digital-twin")({
  head: () => ({ meta: [{ title: "Digital Twin — Admin Console" }] }),
  component: DigitalTwinPage,
});

// ── Graph nodes (positioned for clear layout) ─────────────────────────────────
const graphNodes: GraphNode[] = [
  // Hospital (root)
  { id: "hosp", label: "Apollo Hospitals", did: "did:hosp:hospital:apollo-mumbai", type: "hospital", status: "active", x: 335, y: 20 },
  // Departments
  { id: "dept_card", label: "Cardiology", did: "did:hosp:dept:cardiology", type: "department", status: "active", x: 40, y: 120 },
  { id: "dept_icu", label: "ICU Block B", did: "did:hosp:dept:icu", type: "department", status: "occupied", x: 220, y: 120 },
  { id: "dept_emrg", label: "Emergency", did: "did:hosp:dept:emergency", type: "department", status: "active", x: 410, y: 120 },
  { id: "dept_rad", label: "Radiology", did: "did:hosp:dept:radiology", type: "department", status: "active", x: 590, y: 120 },
  // Wards
  { id: "ward_4a", label: "Ward 4A", did: "did:hosp:ward:4a", type: "ward", status: "occupied", x: 40, y: 230 },
  { id: "ward_icu", label: "ICU Ward B", did: "did:hosp:ward:icu-b", type: "ward", status: "occupied", x: 220, y: 230 },
  // Beds
  { id: "bed_a1", label: "Bed A-1", did: "did:hosp:bed:A1", type: "bed", status: "occupied", x: 40, y: 330 },
  { id: "bed_b3", label: "Bed B-3", did: "did:hosp:bed:B3", type: "bed", status: "available", x: 200, y: 330 },
  // Patient & Doctor
  { id: "pat_anika", label: "Anika Sharma", did: "did:hosp:0x4a91…b7d2", type: "patient", status: "active", x: 20, y: 430 },
  { id: "doc_ravi", label: "Dr. Ravi Menon", did: "did:hosp:0xd103…99aa", type: "doctor", status: "active", x: 190, y: 430 },
  // Prescription
  { id: "rx_9821", label: "RX-9821", did: "did:hosp:rx:9821", type: "prescription", status: "active", x: 100, y: 540 },
  // Equipment
  { id: "equip_mri", label: "MRI SIEMENS 3T", did: "did:hosp:equipment:equip_0001", type: "equipment", status: "occupied", x: 560, y: 230 },
  { id: "equip_ct", label: "GE Revolution CT", did: "did:hosp:equipment:equip_0012", type: "equipment", status: "available", x: 700, y: 230 },
  // Ambulance
  { id: "amb_001", label: "MH-01-AM-1000", did: "did:hosp:ambulance:amb_001", type: "ambulance", status: "available", x: 380, y: 230 },
];

const graphEdges: GraphEdge[] = [
  // Hospital → Departments
  { from: "hosp", to: "dept_card", label: "has dept" },
  { from: "hosp", to: "dept_icu", label: "has dept" },
  { from: "hosp", to: "dept_emrg", label: "has dept" },
  { from: "hosp", to: "dept_rad", label: "has dept" },
  // Departments → Wards/Equipment/Ambulance
  { from: "dept_card", to: "ward_4a", label: "has ward" },
  { from: "dept_icu", to: "ward_icu", label: "has ward" },
  { from: "dept_rad", to: "equip_mri", label: "has equip" },
  { from: "dept_rad", to: "equip_ct", label: "has equip" },
  { from: "dept_emrg", to: "amb_001", label: "has amb" },
  // Ward → Beds
  { from: "ward_4a", to: "bed_a1", label: "has bed" },
  { from: "ward_4a", to: "bed_b3", label: "has bed" },
  // Bed → Patient
  { from: "bed_a1", to: "pat_anika", label: "assigned" },
  // Patient → Doctor
  { from: "pat_anika", to: "doc_ravi", label: "treated by" },
  // Doctor → Prescription
  { from: "doc_ravi", to: "rx_9821", label: "issued" },
];

// ── Tree view (hierarchical) ───────────────────────────────────────────────────
type NodeType = "hospital" | "department" | "ward" | "bed" | "patient" | "doctor" | "equipment" | "ambulance" | "prescription";

interface TwinNode {
  id: string; label: string; type: NodeType; did: string;
  status: "active" | "occupied" | "available" | "maintenance" | "offline";
  children?: TwinNode[];
  meta?: Record<string, string>;
}

const nodeConfig: Record<NodeType, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string }> = {
  hospital: { icon: Building2, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30" },
  department: { icon: Building2, color: "text-chart-2", bg: "bg-chart-2/10", border: "border-chart-2/30" },
  ward: { icon: Bed, color: "text-chart-3", bg: "bg-chart-3/10", border: "border-chart-3/30" },
  bed: { icon: Bed, color: "text-success", bg: "bg-success/10", border: "border-success/30" },
  patient: { icon: User, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30" },
  doctor: { icon: Stethoscope, color: "text-chart-2", bg: "bg-chart-2/10", border: "border-chart-2/30" },
  equipment: { icon: Wrench, color: "text-chart-4", bg: "bg-chart-4/10", border: "border-chart-4/30" },
  ambulance: { icon: Ambulance, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
  prescription: { icon: ShieldCheck, color: "text-chart-5", bg: "bg-chart-5/10", border: "border-chart-5/30" },
};

const statusDot: Record<string, string> = {
  active: "bg-success", occupied: "bg-primary", available: "bg-success", maintenance: "bg-warning", offline: "bg-destructive",
};

const hospitalTree: TwinNode = {
  id: "hosp_001", label: "Apollo Hospitals, Mumbai", type: "hospital",
  did: "did:hosp:hospital:apollo-mumbai", status: "active",
  meta: { beds: "250", staff: "320", patients: "198", occupancy: "79%" },
  children: [
    {
      id: "dept_card", label: "Cardiology", type: "department",
      did: "did:hosp:dept:cardiology", status: "active",
      meta: { head: "Dr. Ravi Menon", beds: "45" },
      children: [
        {
          id: "ward_4a", label: "Ward 4A", type: "ward",
          did: "did:hosp:ward:4a", status: "occupied",
          meta: { beds: "20", occupied: "16" },
          children: [
            {
              id: "bed_a1", label: "Bed A-1", type: "bed",
              did: "did:hosp:bed:A1", status: "occupied",
              meta: { since: "2026-05-28" },
              children: [
                {
                  id: "pat_anika", label: "Anika Sharma", type: "patient",
                  did: "did:hosp:0x4a91…b7d2", status: "active",
                  meta: { mrn: "MRN-204871", blood: "O+" },
                  children: [
                    {
                      id: "doc_ravi", label: "Dr. Ravi Menon", type: "doctor",
                      did: "did:hosp:0xd103…99aa", status: "active",
                      meta: { specialty: "Cardiologist" },
                      children: [
                        {
                          id: "rx_9821", label: "Prescription RX-9821", type: "prescription",
                          did: "did:hosp:rx:9821", status: "active",
                          meta: { medication: "Metoprolol 50mg OD" },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "dept_icu", label: "ICU Block B", type: "department",
      did: "did:hosp:dept:icu", status: "occupied",
      meta: { beds: "16", occupancy: "87%" },
    },
    {
      id: "dept_emrg", label: "Emergency Dept.", type: "department",
      did: "did:hosp:dept:emergency", status: "active",
      meta: { trauma_bays: "6" },
      children: [
        {
          id: "amb_001", label: "Ambulance MH-01-AM-1000", type: "ambulance",
          did: "did:hosp:ambulance:amb_001", status: "available",
          meta: { type: "ALS" },
        },
      ],
    },
    {
      id: "dept_rad", label: "Radiology", type: "department",
      did: "did:hosp:dept:radiology", status: "active",
      children: [
        {
          id: "equip_mri", label: "SIEMENS MRI 3T #001", type: "equipment",
          did: "did:hosp:equipment:equip_0001", status: "occupied",
          meta: { model: "MAGNETOM Vida" },
        },
      ],
    },
  ],
};

function NodeCard({ node, depth, onSelect }: { node: TwinNode; depth: number; onSelect: (n: TwinNode) => void }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const cfg = nodeConfig[node.type];
  const Icon = cfg.icon;
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div className={`relative ${depth > 0 ? "ml-5 pl-4 border-l-2 border-dashed border-border" : ""}`}>
      <motion.div
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: depth * 0.03 }}
        className={`mb-2 flex items-center gap-2 rounded-xl border ${cfg.border} ${cfg.bg} px-3 py-2.5 cursor-pointer hover:shadow-clinical transition-shadow`}
        onClick={() => { onSelect(node); if (hasChildren) setExpanded(!expanded); }}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card">
          <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">{node.label}</div>
          <div className="font-mono text-[10px] text-muted-foreground/70 truncate">{node.did}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`h-2 w-2 rounded-full ${statusDot[node.status]}`} />
          {hasChildren && <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />}
        </div>
      </motion.div>

      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            {node.children?.map(child => <NodeCard key={child.id} node={child} depth={depth + 1} onSelect={onSelect} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NodeDetailPanel({ node, onClose }: { node: TwinNode; onClose: () => void }) {
  const cfg = nodeConfig[node.type];
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className="rounded-2xl border border-border bg-card shadow-clinical-md p-5 h-fit sticky top-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${cfg.bg}`}>
            <Icon className={`h-5 w-5 ${cfg.color}`} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground capitalize">{node.type} DID</div>
            <div className="text-[10px] text-muted-foreground">Node Inspector</div>
          </div>
        </div>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg bg-muted p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Label</div>
          <div className="text-sm font-semibold text-foreground">{node.label}</div>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">DID</div>
          <div className="font-mono text-xs text-foreground break-all">{node.did}</div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
          <div className={`h-2.5 w-2.5 rounded-full ${statusDot[node.status]}`} />
          <span className="text-xs font-medium text-foreground capitalize">{node.status}</span>
        </div>
        {node.meta && Object.keys(node.meta).length > 0 && (
          <div className="rounded-lg border border-border p-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Metadata</div>
            {Object.entries(node.meta).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                <span className="font-medium text-foreground">{v}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3">
          <ShieldCheck className="h-4 w-4 text-success" />
          <span className="text-xs font-medium text-success">DID Cryptographically Verified</span>
        </div>
      </div>
    </motion.div>
  );
}

type ViewMode = "tree" | "graph";

function DigitalTwinPage() {
  const [selected, setSelected] = useState<TwinNode | null>(null);
  const [view, setView] = useState<ViewMode>("tree");
  const [selectedGraphNode, setSelectedGraphNode] = useState<string | undefined>();

  const allNodeTypes: NodeType[] = ["hospital","department","ward","bed","patient","doctor","equipment","ambulance","prescription"];

  const handleGraphNodeClick = (n: GraphNode) => {
    setSelectedGraphNode(n.id);
    // map graph node to TwinNode shape for detail panel
    const mock: TwinNode = { id: n.id, label: n.label, type: n.type, did: n.did, status: n.status };
    setSelected(mock);
  };

  return (
    <RouteGuard requiredRole="admin">
      <PageHeader
        eyebrow="Admin Console"
        title="Healthcare Digital Twin"
        description="Visual DID hierarchy — Hospital → Department → Ward → Bed → Patient → Doctor → Prescription"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-border bg-card p-1 gap-1">
              <button
                onClick={() => setView("tree")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${view === "tree" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <GitBranch className="h-3.5 w-3.5" /> Tree
              </button>
              <button
                onClick={() => setView("graph")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${view === "graph" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Network className="h-3.5 w-3.5" /> Graph
              </button>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
              <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Live
            </div>
          </div>
        }
      />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-border bg-muted/30">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">DID Types:</span>
        {allNodeTypes.map(type => {
          const cfg = nodeConfig[type];
          const Icon = cfg.icon;
          return (
            <div key={type} className={`flex items-center gap-1 rounded-full border ${cfg.border} ${cfg.bg} px-2 py-0.5`}>
              <Icon className={`h-2.5 w-2.5 ${cfg.color}`} />
              <span className={`text-[10px] font-medium ${cfg.color} capitalize`}>{type}</span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 p-6 min-h-[70vh]">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {view === "tree" ? (
              <motion.div key="tree" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="overflow-y-auto rounded-xl border border-border bg-card/50 p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" />
                  Hospital DID Hierarchy — Click to expand & inspect
                </div>
                <NodeCard node={hospitalTree} depth={0} onSelect={setSelected} />
              </motion.div>
            ) : (
              <motion.div key="graph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <Network className="h-3.5 w-3.5" />
                  DID Relationship Graph — Click nodes to inspect
                </div>
                <DIDRelationshipGraph
                  nodes={graphNodes}
                  edges={graphEdges}
                  onNodeClick={handleGraphNodeClick}
                  selectedId={selectedGraphNode}
                  width={860}
                  height={620}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Inspector panel */}
        <div className="w-72 shrink-0">
          <AnimatePresence mode="wait">
            {selected ? (
              <NodeDetailPanel key={selected.id} node={selected} onClose={() => { setSelected(null); setSelectedGraphNode(undefined); }} />
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                Select any node to inspect its DID, status, and metadata
              </motion.div>
            )}
          </AnimatePresence>

          {/* Relationship types legend */}
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-semibold text-foreground mb-3">DID Relationships</div>
            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              {[
                "Hospital → Department",
                "Department → Ward",
                "Ward → Bed",
                "Bed → Patient",
                "Patient → Doctor",
                "Doctor → Prescription",
                "Department → Equipment",
                "Department (ER) → Ambulance",
              ].map(r => (
                <div key={r} className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
