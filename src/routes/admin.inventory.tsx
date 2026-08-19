import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import {
  Package,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { getInventoryData } from "@/lib/api";
import { useTableRefresh } from "@/hooks/use-realtime";
import type { InventoryItem, InventoryCategory, InventoryAlert } from "@/lib/types";

import { InventoryKpiBar, InventoryKpiStats } from "@/components/inventory/InventoryKpiBar";
import { InventoryAlertPanel } from "@/components/inventory/InventoryAlertPanel";
import {
  InventoryFilterBar,
  InventoryStatusFilter,
} from "@/components/inventory/InventoryFilterBar";
import { InventoryItemCard } from "@/components/inventory/InventoryItemCard";
import { InventoryDetailDialog } from "@/components/inventory/InventoryDetailDialog";

import { useSpotlightTarget } from "@/hooks/use-spotlight";

export const Route = createFileRoute("/admin/inventory")({
  validateSearch: (search: Record<string, unknown>): { highlight?: string } => ({
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Inventory & Stock Dashboard — Admin Console" },
      {
        name: "description",
        content:
          "Real-time clinical supply chain tracking, stock movement audit ledger, near-expiry monitoring, and automated reorder governance",
      },
    ],
  }),
  component: InventoryDashboardPage,
});

const ITEMS_PER_PAGE = 12;

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

function InventoryDashboardPage() {
  const search = Route.useSearch();
  useSpotlightTarget(search.highlight);

  // Raw Data State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [stats, setStats] = useState<InventoryKpiStats>({
    totalItems: 0,
    lowStockCount: 0,
    criticalCount: 0,
    nearExpiryCount: 0,
    reorderPendingCount: 0,
    totalStockValuation: 0,
    categoryBreakdown: {},
  });
  const [loading, setLoading] = useState(true);

  // Filters & Sorting State
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<InventoryStatusFilter>("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [currentPage, setCurrentPage] = useState(1);

  // Detail Modal State
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // If highlight param matches an item, ensure it's selected
  useEffect(() => {
    if (search.highlight && items.length > 0) {
      const match = items.find((i) => i.item_id === search.highlight);
      if (match) {
        setSelectedItem(match);
      }
    }
  }, [search.highlight, items]);

  // Load Data
  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await getInventoryData();
      setItems(res.items || []);
      setCategories(res.categories || []);
      setAlerts(res.alerts || []);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err: any) {
      toast.error("Failed to sync inventory supply data", {
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
  useTableRefresh("inventory_items", () => loadData(false));
  useTableRefresh("stock_movements", () => loadData(false));
  useTableRefresh("inventory_alerts", () => loadData(false));
  useTableRefresh("inventory_categories", () => loadData(false));

  // Category map helper
  const categoryMap = useMemo(() => {
    const map: Record<string, InventoryCategory> = {};
    for (const c of categories) {
      map[c.category_id] = c;
    }
    return map;
  }, [categories]);

  // Counts for status pills
  const statusCounts = useMemo(() => {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const counts: Record<string, number> = {
      all: items.length,
      normal: items.filter((i) => i.status === "normal" && i.current_stock > i.reorder_level)
        .length,
      low_stock: items.filter(
        (i) =>
          i.status === "low_stock" || (i.current_stock <= i.reorder_level && i.current_stock > 0),
      ).length,
      critical: items.filter((i) => i.status === "critical" || i.current_stock === 0).length,
      near_expiry: items.filter((i) => {
        if (!i.expiry_date) return false;
        const exp = new Date(i.expiry_date);
        return exp <= thirtyDaysLater;
      }).length,
    };
    return counts;
  }, [items]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return items
      .filter((item) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.storage_location && item.storage_location.toLowerCase().includes(q)) ||
          (item.supplier && item.supplier.toLowerCase().includes(q));

        const matchesCat = categoryFilter === "all" || item.category_id === categoryFilter;

        let matchesStatus = true;
        if (statusFilter === "normal") {
          matchesStatus = item.status === "normal" && item.current_stock > item.reorder_level;
        } else if (statusFilter === "low_stock") {
          matchesStatus =
            item.status === "low_stock" ||
            (item.current_stock <= item.reorder_level && item.current_stock > 0);
        } else if (statusFilter === "critical") {
          matchesStatus = item.status === "critical" || item.current_stock === 0;
        } else if (statusFilter === "near_expiry") {
          if (!item.expiry_date) {
            matchesStatus = false;
          } else {
            const exp = new Date(item.expiry_date);
            matchesStatus = exp <= thirtyDaysLater;
          }
        }

        return matchesSearch && matchesCat && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "name-asc") return a.name.localeCompare(b.name);
        if (sortBy === "stock-asc") return a.current_stock - b.current_stock;
        if (sortBy === "stock-desc") return b.current_stock - a.current_stock;
        if (sortBy === "expiry-asc") {
          if (!a.expiry_date) return 1;
          if (!b.expiry_date) return -1;
          return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
        }
        if (sortBy === "cost-desc") {
          const valA = a.current_stock * a.unit_cost;
          const valB = b.current_stock * b.unit_cost;
          return valB - valA;
        }
        return 0;
      });
  }, [items, searchQuery, categoryFilter, statusFilter, sortBy]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8 pb-24">
        {/* Page Header */}
        <PageHeader
          eyebrow="Supply Chain & Stock Governance"
          title="Inventory & Stock Dashboard"
          description="Real-time clinical SKU occupancy, lot expiry telemetry, consumption audit ledger, and automated reorder alerts"
          actions={
            <div className="flex items-center gap-2">
              <Button
                onClick={() => loadData(false)}
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-bold shadow-xs hover:bg-accent"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Sync Telemetry
              </Button>
              <Button
                onClick={() => toast.success("Stock valuation report generated (CSV)")}
                size="sm"
                className="bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold rounded-xl shadow-clinical-md shadow-primary/25 text-xs"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Ledger
              </Button>
            </div>
          }
        />

        <StaggerList className="space-y-8">
          {/* Top Bento Deck: Portfolio Hero & 4 Operational KPI Tiles */}
          <StaggerItem>
            <InventoryKpiBar
              stats={stats}
              categories={categories}
              activeFilter={categoryFilter}
              onSelectCategory={(catId) => {
                setCategoryFilter(catId);
                setCurrentPage(1);
              }}
            />
          </StaggerItem>

          {/* Operational Alerts Panel */}
          {alerts.length > 0 && (
            <StaggerItem>
              <InventoryAlertPanel
                alerts={alerts}
                onSelectAlertItem={(itemId) => {
                  const target = items.find((i) => i.item_id === itemId);
                  if (target) setSelectedItem(target);
                }}
                onDismissAlert={(alertId) => {
                  setAlerts((prev) => prev.filter((a) => a.alert_id !== alertId));
                }}
              />
            </StaggerItem>
          )}

          {/* Search, Filter Pills & Sort Controls Bar */}
          <StaggerItem>
            <InventoryFilterBar
              searchQuery={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q);
                setCurrentPage(1);
              }}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={(c) => {
                setCategoryFilter(c);
                setCurrentPage(1);
              }}
              categories={categories}
              statusFilter={statusFilter}
              onStatusFilterChange={(s) => {
                setStatusFilter(s);
                setCurrentPage(1);
              }}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              totalFilteredCount={filteredItems.length}
              statusCounts={statusCounts}
            />
          </StaggerItem>

          {/* Main Inventory Items Grid */}
          <StaggerItem>
            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-border bg-muted/40 h-56 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-5 bg-muted rounded-full w-1/3" />
                      <div className="h-5 bg-muted rounded-full w-1/4" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-5 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </div>
                    <div className="h-16 bg-muted rounded-xl" />
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No Inventory Items Found"
                description={
                  items.length === 0
                    ? "No inventory supplies registered in the hospital database."
                    : "No stock items match your selected filter criteria. Try resetting filters."
                }
                action={
                  items.length > 0 ? (
                    <Button
                      onClick={() => {
                        setSearchQuery("");
                        setCategoryFilter("all");
                        setStatusFilter("all");
                      }}
                      className="bg-primary text-primary-foreground font-extrabold rounded-xl shadow-clinical-md text-xs cursor-pointer"
                    >
                      Reset Filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {paginatedItems.map((item) => (
                    <InventoryItemCard
                      key={item.item_id}
                      item={item}
                      category={categoryMap[item.category_id]}
                      onSelect={(i) => setSelectedItem(i)}
                    />
                  ))}
                </div>

                {/* Numbered Pagination Bar */}
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
                        className="rounded-xl h-8 px-2.5 gap-1 text-xs font-bold cursor-pointer"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Prev
                      </Button>

                      {getPaginationRange(currentPage, totalPages).map((pageNumber, idx) =>
                        typeof pageNumber === "number" ? (
                          <button
                            key={pageNumber}
                            type="button"
                            onClick={() => setCurrentPage(pageNumber)}
                            className={`h-8 min-w-[32px] px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                              currentPage === pageNumber
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "border border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            {pageNumber}
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
                        className="rounded-xl h-8 px-2.5 gap-1 text-xs font-bold cursor-pointer"
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

        {/* Centered Modal Detail Dialog */}
        <InventoryDetailDialog
          item={selectedItem}
          category={selectedItem ? categoryMap[selectedItem.category_id] : undefined}
          onClose={() => setSelectedItem(null)}
          onStockUpdated={async () => {
            const res = await getInventoryData();
            if (res.items) {
              setItems(res.items);
              if (selectedItem) {
                const refreshed = res.items.find((i) => i.item_id === selectedItem.item_id);
                if (refreshed) setSelectedItem(refreshed);
              }
            }
            if (res.stats) setStats(res.stats);
            if (res.alerts) setAlerts(res.alerts);
          }}
        />
      </div>
    </RouteGuard>
  );
}
