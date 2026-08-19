import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import {
  Wrench,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Layers,
  Cpu,
  LayoutGrid,
  Building2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { getEquipment } from "@/lib/api";
import { useTableRefresh } from "@/hooks/use-realtime";
import type { EquipmentRecord, EquipmentStatus } from "@/lib/types";

export type EquipmentViewMode = "grid" | "department" | "radar";

import { EquipmentBentoHero, EquipmentKpiStats } from "@/components/equipment/EquipmentBentoHero";
import {
  EquipmentFilterBar,
  EquipmentStatusFilter,
} from "@/components/equipment/EquipmentFilterBar";
import { EquipmentGridCard } from "@/components/equipment/EquipmentGridCard";
import { EquipmentDepartmentView } from "@/components/equipment/EquipmentDepartmentView";
import { EquipmentMaintenanceRadar } from "@/components/equipment/EquipmentMaintenanceRadar";
import { EquipmentDetailPanel } from "@/components/equipment/EquipmentDetailPanel";

import { useSpotlightTarget } from "@/hooks/use-spotlight";

export const Route = createFileRoute("/admin/equipment")({
  validateSearch: (search: Record<string, unknown>): { highlight?: string } => ({
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Equipment & Biomedical Assets — Admin Console" },
      {
        name: "description",
        content:
          "Real-time clinical engineering asset management, device telemetry, ISO calibration tracking, and maintenance governance ledger",
      },
    ],
  }),
  component: EquipmentManagementPage,
});

const ITEMS_PER_PAGE = 9;

function getPaginationRange(current: number, total: number): (number | string)[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, 4, "...", total];
  }
  if (current >= total - 2) {
    return [1, "...", total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

function EquipmentManagementPage() {
  const search = Route.useSearch();
  useSpotlightTarget(search.highlight);

  // Raw Data State
  const [equipmentList, setEquipmentList] = useState<EquipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'grid' | 'department' | 'radar'
  const [viewMode, setViewMode] = useState<EquipmentViewMode>("grid");

  // Filters & Controls State
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<EquipmentStatusFilter>("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [currentPage, setCurrentPage] = useState(1);

  // Drawer / Inspector Selection State
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentRecord | null>(null);

  // If highlight param matches, auto-open drawer
  useEffect(() => {
    if (search.highlight && equipmentList.length > 0) {
      const match = equipmentList.find(
        (e) => e.id === search.highlight || `eq-alert-${e.id}` === search.highlight,
      );
      if (match) {
        setSelectedEquipment(match);
      }
    }
  }, [search.highlight, equipmentList]);

  // Load Data
  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await getEquipment();
      setEquipmentList(res.equipment || []);
    } catch (err: any) {
      toast.error("Failed to sync clinical equipment registry", {
        description: err.message,
      });
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Real-time table subscriptions
  useTableRefresh("equipment", () => loadData(false));
  useTableRefresh("equipment_maintenance_log", () => loadData(false));

  // Extract distinct departments and types
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const eq of equipmentList) {
      if (eq.department) set.add(eq.department);
    }
    return Array.from(set).sort();
  }, [equipmentList]);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const eq of equipmentList) {
      if (eq.type) set.add(eq.type);
    }
    return Array.from(set).sort();
  }, [equipmentList]);

  // KPI Calculations
  const kpiStats: EquipmentKpiStats = useMemo(() => {
    const total = equipmentList.length;
    const operational = equipmentList.filter((e) => e.status === "operational").length;
    const inUse = equipmentList.filter((e) => e.status === "in-use").length;
    const maintenance = equipmentList.filter((e) => e.status === "maintenance").length;
    const offline = equipmentList.filter((e) => e.status === "offline").length;

    const totalUtil = equipmentList.reduce((acc, curr) => acc + (curr.utilization || 0), 0);
    const avgUtilization = total > 0 ? Math.round(totalUtil / total) : 0;

    return {
      total,
      operational,
      inUse,
      maintenance,
      offline,
      avgUtilization,
    };
  }, [equipmentList]);

  // Status counts for pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: equipmentList.length,
      operational: 0,
      "in-use": 0,
      maintenance: 0,
      offline: 0,
    };
    for (const e of equipmentList) {
      if (counts[e.status] !== undefined) {
        counts[e.status]++;
      }
    }
    return counts;
  }, [equipmentList]);

  // Filtered & Sorted items
  const filteredEquipment = useMemo(() => {
    return equipmentList
      .filter((eq) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          eq.name.toLowerCase().includes(q) ||
          eq.id.toLowerCase().includes(q) ||
          eq.serial.toLowerCase().includes(q) ||
          eq.model.toLowerCase().includes(q) ||
          eq.manufacturer.toLowerCase().includes(q) ||
          (eq.assignedWard && eq.assignedWard.toLowerCase().includes(q)) ||
          (eq.location && eq.location.toLowerCase().includes(q)) ||
          eq.did.toLowerCase().includes(q);

        const matchesDept = departmentFilter === "all" || eq.department === departmentFilter;

        const matchesType =
          typeFilter === "all" || eq.type.toLowerCase() === typeFilter.toLowerCase();

        const matchesStatus = statusFilter === "all" || eq.status === statusFilter;

        return matchesSearch && matchesDept && matchesType && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name-desc":
            return b.name.localeCompare(a.name);
          case "utilization-desc":
            return (b.utilization || 0) - (a.utilization || 0);
          case "utilization-asc":
            return (a.utilization || 0) - (b.utilization || 0);
          case "maint-soon":
            return (a.nextMaintenance || "").localeCompare(b.nextMaintenance || "");
          case "status":
            return a.status.localeCompare(b.status);
          case "name-asc":
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [equipmentList, searchQuery, departmentFilter, typeFilter, statusFilter, sortBy]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, departmentFilter, typeFilter, statusFilter, sortBy]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredEquipment.length / ITEMS_PER_PAGE));
  const paginatedEquipment = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEquipment.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEquipment, currentPage]);

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8 pb-24">
        {/* Page Header */}
        <PageHeader
          eyebrow="Biomedical Engineering & Clinical Assets"
          title="Equipment Management"
          description="Live telemetry deck, ISO calibration compliance, preventive maintenance logs, and departmental device utilization"
          actions={
            <div className="flex items-center gap-2.5">
              <Button
                onClick={() => loadData(true)}
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-bold shadow-xs hover:bg-accent h-9"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Sync Telemetry
              </Button>
            </div>
          }
        />

        <StaggerList className="space-y-6">
          {/* Top 2026 Bento Command Hub */}
          <StaggerItem>
            <EquipmentBentoHero
              stats={kpiStats}
              equipment={equipmentList}
              activeFilter={statusFilter}
              onSelectStatus={(s) => setStatusFilter(s)}
            />
          </StaggerItem>

          {/* Filter & Search Bar */}
          <StaggerItem>
            <EquipmentFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              departmentFilter={departmentFilter}
              onDepartmentFilterChange={setDepartmentFilter}
              departments={departments}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              types={types}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              totalFilteredCount={filteredEquipment.length}
              statusCounts={statusCounts}
            />
          </StaggerItem>

          {/* View Toolbar: Section Title (Left) + View Mode Switcher (Right) */}
          <StaggerItem>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
              <div>
                <h3 className="font-display font-extrabold text-base text-foreground tracking-tight flex items-center gap-2">
                  <span>
                    {viewMode === "grid"
                      ? "Clinical Asset Registry"
                      : viewMode === "department"
                        ? "Department Spatial Clusters"
                        : "ISO Calibration & Maintenance Radar"}
                  </span>
                  <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-lg border border-border/60">
                    {filteredEquipment.length} units
                  </span>
                </h3>
              </div>

              {/* Segmented View Switcher directly above content */}
              <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border/80 shrink-0 self-start sm:self-auto">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === "grid"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Grid Matrix View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>Grid</span>
                </button>

                <button
                  onClick={() => setViewMode("department")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === "department"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Department Clusters View"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Departments</span>
                </button>

                <button
                  onClick={() => setViewMode("radar")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === "radar"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Maintenance Radar"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Service Radar</span>
                </button>
              </div>
            </div>
          </StaggerItem>

          {/* Dynamic View Mode Content */}
          <StaggerItem>
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-64 rounded-2xl border border-border bg-card p-6 shadow-clinical animate-pulse space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="h-10 w-10 rounded-xl bg-muted" />
                      <div className="h-5 w-20 rounded-full bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-3/4 rounded bg-muted" />
                      <div className="h-3 w-1/2 rounded bg-muted/60" />
                    </div>
                    <div className="pt-6 border-t border-border/40 space-y-2">
                      <div className="h-3 w-full rounded bg-muted/40" />
                      <div className="h-2 w-full rounded-full bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEquipment.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center bg-card shadow-clinical-sm">
                <Wrench className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                  No Biomedical Equipment Found
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  No devices match your search query or active department/status filter parameters.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setDepartmentFilter("all");
                      setTypeFilter("all");
                      setStatusFilter("all");
                    }}
                    className="rounded-xl text-xs font-bold shadow-xs"
                  >
                    Reset All Filters
                  </Button>
                </div>
              </div>
            ) : viewMode === "department" ? (
              <EquipmentDepartmentView
                equipment={filteredEquipment}
                onSelectEquipment={(item) => setSelectedEquipment(item)}
              />
            ) : viewMode === "radar" ? (
              <EquipmentMaintenanceRadar
                equipment={filteredEquipment}
                onSelectEquipment={(item) => setSelectedEquipment(item)}
              />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {paginatedEquipment.map((eq) => (
                    <EquipmentGridCard
                      key={eq.id}
                      equipment={eq}
                      onSelect={(item) => setSelectedEquipment(item)}
                    />
                  ))}
                </div>

                {/* Numbered Pagination Section (for Grid View) */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/60">
                    <div className="text-xs font-medium text-muted-foreground">
                      Showing{" "}
                      <strong className="text-foreground">
                        {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                      </strong>{" "}
                      to{" "}
                      <strong className="text-foreground">
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredEquipment.length)}
                      </strong>{" "}
                      of <strong className="text-foreground">{filteredEquipment.length}</strong>{" "}
                      equipment units
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="rounded-xl text-xs font-bold shadow-xs h-8 px-2.5 gap-1"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span>Prev</span>
                      </Button>

                      <div className="flex items-center gap-1">
                        {getPaginationRange(currentPage, totalPages).map((p, idx) =>
                          p === "..." ? (
                            <span
                              key={`ellipsis-${idx}`}
                              className="px-1 text-xs font-bold text-muted-foreground/60"
                            >
                              ...
                            </span>
                          ) : (
                            <button
                              key={`page-${p}`}
                              onClick={() => setCurrentPage(p as number)}
                              className={`h-8 min-w-[32px] px-2 rounded-xl text-xs font-extrabold transition-all ${
                                currentPage === p
                                  ? "bg-primary text-primary-foreground shadow-xs"
                                  : "border border-border/80 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                              }`}
                            >
                              {p}
                            </button>
                          ),
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="rounded-xl text-xs font-bold shadow-xs h-8 px-2.5 gap-1"
                      >
                        <span>Next</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </StaggerItem>
        </StaggerList>

        {/* Equipment Detail Modal */}
        <EquipmentDetailPanel
          equipment={selectedEquipment}
          isOpen={!!selectedEquipment}
          onClose={() => setSelectedEquipment(null)}
          onEquipmentUpdated={() => loadData(false)}
        />
      </div>
    </RouteGuard>
  );
}
