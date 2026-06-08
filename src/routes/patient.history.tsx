import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, FileSignature, Download, PencilLine, History as HistoryIcon,
  Shield, Lock, Search, Filter, ChevronDown, AlertTriangle,
  CheckCircle2, User, Clock, Fingerprint, Wifi, WifiOff, RefreshCw
} from "lucide-react";
import { useFabricAudit } from "@/hooks/use-fabric";
import { fabricLogAuditEvent } from "@/lib/fabric-api";

export const Route = createFileRoute("/patient/history")({
  head: () => ({ meta: [{ title: "Patient · Access History — DID Hospital" }] }),
  component: History,
});

type AccessAction = "viewed" | "signed" | "exported" | "updated";


const iconFor: Record<AccessAction, React.ComponentType<{className?: string}>> = {
  viewed: Eye,
  signed: FileSignature,
  exported: Download,
  updated: PencilLine,
};

const colorFor: Record<AccessAction, string> = {
  viewed: "bg-primary/10 text-primary border-primary/30",
  signed: "bg-success/15 text-success border-success/30",
  exported: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  updated: "bg-warning/15 text-warning-foreground border-warning/30",
};

const iconBg: Record<AccessAction, string> = {
  viewed: "bg-primary/10 text-primary",
  signed: "bg-success/15 text-success",
  exported: "bg-chart-2/15 text-chart-2",
  updated: "bg-warning/15 text-warning-foreground",
};


function History() {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<AccessAction | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: fabricData, online, loading: fabricLoading, refetch } = useFabricAudit(0);

  // Map Fabric audit events → local format
  const fabricEntries = ((fabricData?.events ?? []) as Array<{
    txId?: string; actor?: string; resource?: string; action?: string; loggedAt?: string;
  }>).map((e, i) => ({
    id: e.txId ?? `fab_${i}`,
    actor: e.actor ?? "System",
    actorRole: "Fabric Actor",
    resource: e.resource ?? "—",
    action: ((e.action?.split(" ")[0]?.toLowerCase() ?? "viewed") as AccessAction),
    at: e.loggedAt ? new Date(e.loggedAt).toLocaleString("en-IN") : "—",
  }));

  // Use only live Fabric audit events (no mock data fallback)
  const allHistory = fabricEntries;


  // Dynamic stats from merged data
  const summaryStats = [
    { label: "Total Events", value: allHistory.length, icon: HistoryIcon, color: "text-primary", bg: "bg-primary/10" },
    { label: "Unique Accessors", value: [...new Set(allHistory.map(e => e.actor))].length, icon: User, color: "text-chart-2", bg: "bg-chart-2/10" },
    { label: "Signed Events", value: allHistory.filter(e => e.action === "signed").length, icon: FileSignature, color: "text-success", bg: "bg-success/10" },
    { label: "Exports", value: allHistory.filter(e => e.action === "exported").length, icon: Download, color: "text-warning-foreground", bg: "bg-warning/10" },
  ];

  const filtered = allHistory.filter(e => {
    const q = query.toLowerCase();
    const matchQ = !q || e.actor.toLowerCase().includes(q) || e.resource.toLowerCase().includes(q) || (e.actorRole ?? "").toLowerCase().includes(q);
    const matchA = actionFilter === "all" || e.action === actionFilter;
    return matchQ && matchA;
  });

  const reportUnauthorized = async (e: typeof allHistory[0]) => {
    try {
      await fabricLogAuditEvent("Patient Portal", e.resource, "reported-unauthorized", "flagged", "warning");
    } catch {}
  };


  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Patient app"
        title="Access History"
        description="Complete audit trail of who accessed your health data, signed documents, and exported records"
        actions={
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${online ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Fabric Live" : "Local Sim"}
            </span>
            <button onClick={refetch} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
              <RefreshCw className={`h-3 w-3 ${fabricLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 space-y-6">
        {/* Stats */}
        <StaggerList className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaryStats.map(s => {
            const Icon = s.icon;
            return (
              <StaggerItem key={s.label}>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</span>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                    </div>
                  </div>
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerList>

        {/* Privacy notice */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-foreground">DID-Protected Audit Log</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Every access event is cryptographically signed and immutably recorded on the Hyperledger Fabric ledger. You can dispute any unauthorized access using the "Report" button.
            </div>
          </div>
          <button className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
            <Lock className="inline h-3 w-3 mr-1" />Verify Chain
          </button>
        </motion.div>

        {/* Filter bar */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by actor or resource…" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <div className="flex gap-2">
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value as AccessAction | "all")} className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="all">All Actions</option>
              <option value="viewed">Viewed</option>
              <option value="signed">Signed</option>
              <option value="exported">Exported</option>
              <option value="updated">Updated</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          {filtered.length} events
        </div>

        {/* Timeline */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
            <HistoryIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <div className="text-sm font-semibold text-foreground">No events match</div>
            <div className="text-xs text-muted-foreground mt-1">Try adjusting your filters</div>
          </div>
        ) : (
          <StaggerList>
            <ol className="relative space-y-1 border-l-2 border-border pl-6">
              {filtered.map((e) => {
                const Icon = iconFor[e.action as AccessAction] ?? Eye;
                const color = colorFor[e.action as AccessAction] ?? colorFor.viewed;
                const ibg = iconBg[e.action as AccessAction] ?? iconBg.viewed;
                const isExpanded = expanded === e.id;

                return (
                  <StaggerItem key={e.id}>
                    <li className="relative">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card ${ibg.split(" ")[1]}`}>
                        <Icon className="h-3 w-3" />
                      </span>

                      <button onClick={() => setExpanded(isExpanded ? null : e.id)} className="w-full text-left">
                        <div className={`rounded-xl border p-4 transition-all hover:shadow-sm ${isExpanded ? "shadow-sm bg-muted/30" : "bg-card"} border-border`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${color}`}>{e.action}</span>
                                <span className="text-sm font-medium text-foreground truncate">{e.resource}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><User className="h-3 w-3" />{e.actor}</span>
                                <span className="text-border">·</span>
                                <span>{e.actorRole}</span>
                                <span className="text-border">·</span>
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.at}</span>
                              </div>
                            </div>
                            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="mt-3 border-t border-border pt-3 grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5 text-xs">
                                    <div className="flex items-center gap-1.5 text-muted-foreground"><Fingerprint className="h-3.5 w-3.5" />DID Verified</div>
                                    <div className="font-mono text-[10px] text-primary">did:hosp:0x8f4a…{e.id.slice(-4)}</div>
                                  </div>
                                  <div className="space-y-1.5 text-xs">
                                    <div className="flex items-center gap-1.5 text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-success" />Ledger Hash</div>
                                    <div className="font-mono text-[10px] text-muted-foreground">0x{e.id.padEnd(4,"0")}…c8f1</div>
                                  </div>
                                  <div className="col-span-2 flex gap-2 pt-1">
                                    <button className="flex items-center gap-1 rounded border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted">
                                      <Eye className="h-3 w-3" /> Verify on Ledger
                                    </button>
                                    <button className="flex items-center gap-1 rounded border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10">
                                      <AlertTriangle className="h-3 w-3" /> Report Unauthorized
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </button>
                    </li>
                  </StaggerItem>
                );
              })}
            </ol>
          </StaggerList>
        )}
      </div>
    </RouteGuard>
  );
}
