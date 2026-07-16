import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { AuditEventCard } from "@/components/audit/AuditEventCard";
import { Search, Filter, Activity, ShieldX, AlertTriangle, Info } from "lucide-react";
import { useState, useMemo } from "react";
import { useAudit } from "@/hooks/use-api";

export const Route = createFileRoute("/audit-timeline")({
  head: () => ({ meta: [{ title: "Audit Timeline — Embrace Health Grid" }] }),
  component: AuditTimelinePage,
});

const CATEGORIES = [
  "access",
  "consent",
  "credential",
  "infrastructure",
  "auth",
  "prescription",
  "emergency",
] as const;
type Category = (typeof CATEGORIES)[number];

function AuditTimelinePage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | "info" | "warning" | "critical">(
    "all",
  );
  const [resultFilter, setResultFilter] = useState<"all" | "success" | "denied" | "error">("all");
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 25;

  const { data: auditData } = useAudit();

  const liveEvents = useMemo(() => {
    const events = (auditData?.events ?? []) as Array<{
      actor?: string;
      actorRole?: string;
      actorDID?: string;
      resource?: string;
      action?: string;
      loggedAt?: string;
      category?: string;
      txId?: string;
      details?: string;
      result?: string;
      severity?: string;
    }>;

    return events.map((e, idx) => ({
      id: e.txId ?? `evt_timeline_${idx}`,
      category: (e.category?.toLowerCase() || "access") as Category,
      action: e.action || "Action executed",
      actor: e.actor || "System",
      actorRole: e.actorRole || "Staff",
      actorDID: e.actorDID || "did:hosp:sys",
      target: e.resource || "Ledger",
      ip: "10.0.1.44",
      result: (e.result || "success") as "success" | "denied" | "error",
      severity: (e.severity || "info") as "info" | "warning" | "critical",
      at: e.loggedAt || new Date().toISOString(),
      details: e.details || "",
      hash: e.txId || "sha256:hash",
    }));
  }, [auditData]);

  const filtered = useMemo(() => {
    return liveEvents.filter(
      (e) =>
        (categoryFilter === "all" || e.category === categoryFilter) &&
        (severityFilter === "all" || e.severity === severityFilter) &&
        (resultFilter === "all" || e.result === resultFilter) &&
        (search === "" ||
          e.action.toLowerCase().includes(search.toLowerCase()) ||
          e.actor.toLowerCase().includes(search.toLowerCase()) ||
          e.target.toLowerCase().includes(search.toLowerCase()) ||
          e.details.toLowerCase().includes(search.toLowerCase())),
    );
  }, [liveEvents, search, categoryFilter, severityFilter, resultFilter]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const criticals = liveEvents.filter((e) => e.severity === "critical").length;
  const warnings = liveEvents.filter((e) => e.severity === "warning").length;
  const denied = liveEvents.filter((e) => e.result === "denied").length;

  return (
    <div className="min-h-screen">
      <PageHeader
        eyebrow="Global"
        title="Audit Timeline"
        description="Immutable audit log of all access, consent, credential, and infrastructure events"
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 px-6 pt-6">
        <StatCard
          label="Total Events"
          value={liveEvents.length.toLocaleString()}
          icon={Activity}
          tone="default"
          delta="Last 180 days"
        />
        <StatCard
          label="Critical Events"
          value={criticals}
          icon={ShieldX}
          tone="destructive"
          delta="Require review"
        />
        <StatCard
          label="Warnings"
          value={warnings}
          icon={AlertTriangle}
          tone="warning"
          delta="Anomalies flagged"
        />
        <StatCard
          label="Denied Access"
          value={denied}
          icon={ShieldX}
          tone="destructive"
          delta="Blocked by policy"
        />
      </div>

      <div className="p-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 flex-1 min-w-48">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search events..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as Category | "all");
              setPage(0);
            }}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value as typeof severityFilter);
              setPage(0);
            }}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none"
          >
            <option value="all">All Severity</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={resultFilter}
            onChange={(e) => {
              setResultFilter(e.target.value as typeof resultFilter);
              setPage(0);
            }}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none"
          >
            <option value="all">All Results</option>
            <option value="success">Success</option>
            <option value="denied">Denied</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              setCategoryFilter("all");
              setPage(0);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${categoryFilter === "all" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground"}`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategoryFilter(cat);
                setPage(0);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium border capitalize transition-colors ${categoryFilter === cat ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground"}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="text-xs text-muted-foreground">
          Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
          {filtered.length.toLocaleString()} events
        </div>

        {/* Events */}
        <div className="space-y-3">
          {paginated.map((event) => (
            <AuditEventCard key={event.id} event={event} />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
