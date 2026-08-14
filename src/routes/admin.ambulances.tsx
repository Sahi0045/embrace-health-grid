import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { Ambulance, RefreshCw, Plus, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { getAmbulances, updateAmbulanceStatus } from "@/lib/api";
import { useTableRefresh } from "@/hooks/use-realtime";
import type { AmbulanceRecord, AmbulanceStatus } from "@/lib/types";

import { AmbulanceKpiBar, AmbulanceKpiStats } from "@/components/ambulance/AmbulanceKpiBar";
import {
  AmbulanceFilterBar,
  AmbulanceStatusFilter,
  AmbulanceTypeFilter,
} from "@/components/ambulance/AmbulanceFilterBar";
import { AmbulanceFleetCard } from "@/components/ambulance/AmbulanceFleetCard";
import { AmbulanceDetailPanel } from "@/components/ambulance/AmbulanceDetailPanel";

export const Route = createFileRoute("/admin/ambulances")({
  head: () => ({
    meta: [
      { title: "Ambulance Fleet Management — Admin Console" },
      {
        name: "description",
        content:
          "Real-time emergency fleet tracking, active paramedic mission dispatch, vehicle telemetry, and equipment readiness",
      },
    ],
  }),
  component: AmbulanceManagementPage,
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

function AmbulanceManagementPage() {
  // Raw Data State
  const [ambulances, setAmbulances] = useState<AmbulanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Controls State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AmbulanceStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AmbulanceTypeFilter>("all");
  const [sortBy, setSortBy] = useState("vehicle-asc");
  const [currentPage, setCurrentPage] = useState(1);

  // Selected for Detail Drawer
  const [selectedAmbulance, setSelectedAmbulance] = useState<AmbulanceRecord | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAmbulances();
      setAmbulances(res.ambulances || []);
    } catch (err: any) {
      toast.error("Failed to sync ambulance fleet data", {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time table subscriptions
  useTableRefresh("ambulances", loadData);

  // Handle Status Update
  const handleUpdateStatus = async (
    ambulanceId: string,
    newStatus: AmbulanceStatus,
    location?: string,
  ) => {
    await updateAmbulanceStatus({ ambulanceId, status: newStatus, location });
    await loadData();
    if (selectedAmbulance && selectedAmbulance.id === ambulanceId) {
      setSelectedAmbulance({
        ...selectedAmbulance,
        status: newStatus,
        location: location || selectedAmbulance.location,
      });
    }
  };

  // KPI Calculations
  const kpiStats: AmbulanceKpiStats = useMemo(() => {
    const total = ambulances.length;
    const available = ambulances.filter((a) => a.status === "available").length;
    const enRoute = ambulances.filter((a) => a.status === "en-route").length;
    const atScene = ambulances.filter((a) => a.status === "at-scene").length;
    const returning = ambulances.filter((a) => a.status === "returning").length;
    const maintenance = ambulances.filter((a) => a.status === "maintenance").length;

    return {
      total,
      available,
      enRoute,
      atScene,
      returning,
      maintenance,
    };
  }, [ambulances]);

  // Counts for status pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: ambulances.length,
      available: 0,
      "en-route": 0,
      "at-scene": 0,
      returning: 0,
      maintenance: 0,
    };
    for (const a of ambulances) {
      if (counts[a.status] !== undefined) {
        counts[a.status]++;
      }
    }
    return counts;
  }, [ambulances]);

  // Filtered & Sorted list
  const filteredAmbulances = useMemo(() => {
    return ambulances
      .filter((a) => {
        const q = searchQuery.toLowerCase().trim();
        const vehicleName = (a.vehicleNo || a.registration || a.id).toLowerCase();
        const matchesSearch =
          !q ||
          vehicleName.includes(q) ||
          (a.driver && a.driver.toLowerCase().includes(q)) ||
          (a.location && a.location.toLowerCase().includes(q)) ||
          (a.did && a.did.toLowerCase().includes(q)) ||
          (a.type && a.type.toLowerCase().includes(q));

        const matchesStatus = statusFilter === "all" || a.status === statusFilter;
        const matchesType =
          typeFilter === "all" || (a.type || "").toLowerCase() === typeFilter.toLowerCase();

        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        const nameA = a.vehicleNo || a.registration || a.id;
        const nameB = b.vehicleNo || b.registration || b.id;
        if (sortBy === "vehicle-asc") return nameA.localeCompare(nameB);
        if (sortBy === "status") return a.status.localeCompare(b.status);
        if (sortBy === "type") return (a.type || "").localeCompare(b.type || "");
        return 0;
      });
  }, [ambulances, searchQuery, statusFilter, typeFilter, sortBy]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredAmbulances.length / ITEMS_PER_PAGE));
  const paginatedAmbulances = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAmbulances.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAmbulances, currentPage]);

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8 pb-24">
        {/* Page Header */}
        <PageHeader
          eyebrow="Emergency Fleet & Mission Telemetry"
          title="Ambulance Management"
          description="Real-time GPS vehicle tracking, active paramedic mission dispatch, and equipment readiness"
          actions={
            <div className="flex items-center gap-2">
              <Button
                onClick={loadData}
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-bold shadow-xs hover:bg-accent"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Sync Telemetry
              </Button>
            </div>
          }
        />

        <StaggerList className="space-y-8">
          {/* Top KPI Bento Deck: Readiness Gauge & Dispatch Lifecycle Pipeline */}
          <StaggerItem>
            <AmbulanceKpiBar
              stats={kpiStats}
              ambulances={ambulances}
              activeFilter={statusFilter}
              onSelectStatus={(s) => {
                setStatusFilter(s);
                setCurrentPage(1);
              }}
            />
          </StaggerItem>

          {/* Search, Filter Pills & Sort Controls Bar */}
          <StaggerItem>
            <AmbulanceFilterBar
              searchQuery={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q);
                setCurrentPage(1);
              }}
              statusFilter={statusFilter}
              onStatusFilterChange={(s) => {
                setStatusFilter(s);
                setCurrentPage(1);
              }}
              typeFilter={typeFilter}
              onTypeFilterChange={(t) => {
                setTypeFilter(t);
                setCurrentPage(1);
              }}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              totalFilteredCount={filteredAmbulances.length}
              statusCounts={statusCounts}
            />
          </StaggerItem>

          {/* Fleet Grid */}
          <StaggerItem>
            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-border bg-muted/40 h-56 p-5 space-y-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 bg-muted rounded-2xl" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-16 bg-muted rounded-xl" />
                    <div className="h-4 bg-muted rounded w-full" />
                  </div>
                ))}
              </div>
            ) : filteredAmbulances.length === 0 ? (
              <EmptyState
                icon={Ambulance}
                title="No Ambulances Found"
                description={
                  ambulances.length === 0
                    ? "No ambulance vehicles registered in the hospital database."
                    : "No ambulance matches the selected search filters. Try resetting your criteria."
                }
                action={
                  ambulances.length > 0 ? (
                    <Button
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("all");
                        setTypeFilter("all");
                      }}
                      className="bg-primary text-primary-foreground font-extrabold rounded-xl shadow-clinical-md text-xs"
                    >
                      Reset Filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {paginatedAmbulances.map((ambulance) => (
                    <AmbulanceFleetCard
                      key={ambulance.id}
                      ambulance={ambulance}
                      onSelect={(a) => setSelectedAmbulance(a)}
                    />
                  ))}
                </div>

                {/* Numbered Pagination (Only visible when > 9 cards, i.e. totalPages > 1) */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/60 text-xs font-medium text-muted-foreground">
                    <div>
                      Page <span className="font-bold text-foreground">{currentPage}</span> of{" "}
                      <span className="font-bold text-foreground">{totalPages}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="rounded-xl h-8 px-2.5 gap-1 text-xs font-bold"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Prev
                      </Button>

                      {getPaginationRange(currentPage, totalPages).map((item, idx) =>
                        typeof item === "number" ? (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setCurrentPage(item)}
                            className={`h-8 min-w-[32px] px-2 rounded-xl text-xs font-extrabold transition-all ${
                              currentPage === item
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "border border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            {item}
                          </button>
                        ) : (
                          <span
                            key={`ellipsis-${idx}`}
                            className="px-1 text-xs font-bold text-muted-foreground/60 select-none"
                          >
                            …
                          </span>
                        ),
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="rounded-xl h-8 px-2.5 gap-1 text-xs font-bold"
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </StaggerItem>
        </StaggerList>

        {/* Slide-in Detail Drawer */}
        <AmbulanceDetailPanel
          ambulance={selectedAmbulance}
          onClose={() => setSelectedAmbulance(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      </div>
    </RouteGuard>
  );
}
