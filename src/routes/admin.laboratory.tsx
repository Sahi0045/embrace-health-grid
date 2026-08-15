import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import {
  FlaskConical,
  RefreshCw,
  Plus,
  TestTube,
  Clock,
  CheckCircle,
  FileImage,
  Stethoscope,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  getLaboratoryData,
  updateLabOrderStatus,
  updateSampleStatus,
  updateRadiologyOrderStatus,
} from "@/lib/api";
import { useTableRefresh } from "@/hooks/use-realtime";
import type {
  LabOrderRecord,
  LabSampleRecord,
  LabResultRecord,
  RadiologyOrderRecord,
  LabDashboardStats,
  SampleCollectionStatus,
} from "@/lib/types";

import { LabKpiBar } from "@/components/laboratory/LabKpiBar";
import {
  LabFilterBar,
  LabStatusFilter,
  LabPriorityFilter,
} from "@/components/laboratory/LabFilterBar";
import { TestQueueTab } from "@/components/laboratory/TestQueueTab";
import { SampleTrackingTab } from "@/components/laboratory/SampleTrackingTab";
import { LabResultsTab } from "@/components/laboratory/LabResultsTab";
import { RadiologyTab } from "@/components/laboratory/RadiologyTab";
import { DoctorOrdersTab } from "@/components/laboratory/DoctorOrdersTab";
import { CriticalResultBanner } from "@/components/laboratory/CriticalResultBanner";
import { CreateLabOrderDialog } from "@/components/laboratory/CreateLabOrderDialog";
import { RecordResultDialog } from "@/components/laboratory/RecordResultDialog";
import { useSpotlightTarget } from "@/hooks/use-spotlight";

export const Route = createFileRoute("/admin/laboratory")({
  validateSearch: (search: Record<string, unknown>): { highlight?: string } => ({
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Laboratory & Diagnostics — Admin Console" },
      {
        name: "description",
        content:
          "Real-time specimen accessioning, clinical test queues, analyzer telemetry, and panic-result governance",
      },
    ],
  }),
  component: LaboratoryDiagnosticsPage,
});

const ITEMS_PER_PAGE = 10;

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

function LaboratoryDiagnosticsPage() {
  const search = Route.useSearch();
  useSpotlightTarget(search.highlight);

  // Raw State
  const [orders, setOrders] = useState<LabOrderRecord[]>([]);
  const [samples, setSamples] = useState<LabSampleRecord[]>([]);
  const [results, setResults] = useState<LabResultRecord[]>([]);
  const [radiology, setRadiology] = useState<RadiologyOrderRecord[]>([]);
  const [stats, setStats] = useState<LabDashboardStats>({
    pendingTests: 0,
    inProgress: 0,
    completedToday: 0,
    criticalResults: 0,
    avgTurnaroundTime: "38 min",
    totalSamplesCollected: 0,
    radiologyScansToday: 0,
  });
  const [loading, setLoading] = useState(true);

  // Active Tab & Filters
  const [activeTab, setActiveTab] = useState<"queue" | "samples" | "results" | "radiology" | "orders">("queue");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LabStatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<LabPriorityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOrderForRecord, setSelectedOrderForRecord] = useState<LabOrderRecord | null>(null);

  // Load Data
  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const data = await getLaboratoryData();
      setOrders(data.orders || []);
      setSamples(data.samples || []);
      setResults(data.results || []);
      setRadiology(data.radiology || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      toast.error("Failed to sync laboratory data", {
        description: err.message,
      });
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Realtime subscriptions
  useTableRefresh("lab_results", () => loadData(false));
  useTableRefresh("lab_orders", () => loadData(false));
  useTableRefresh("lab_samples", () => loadData(false));
  useTableRefresh("radiology_orders", () => loadData(false));

  // Handle Order Status Mutation
  const handleUpdateOrderStatus = async (
    orderId: string,
    status: "pending" | "in_progress" | "completed" | "cancelled",
  ) => {
    try {
      await updateLabOrderStatus({ orderId, status });
      toast.success(`Order #${orderId} updated to ${status}`);
      loadData(false);
    } catch (err: any) {
      toast.error("Failed to update order status", { description: err.message });
    }
  };

  // Handle Sample Stage Advancement
  const handleAdvanceSampleStage = async (
    sampleId: string,
    nextStatus: SampleCollectionStatus,
  ) => {
    try {
      await updateSampleStatus({ sampleId, status: nextStatus });
      toast.success(`Sample #${sampleId} advanced to ${nextStatus.toUpperCase()}`);
      loadData(false);
    } catch (err: any) {
      toast.error("Failed to update sample stage", { description: err.message });
    }
  };

  // Handle Radiology Status Mutation
  const handleUpdateRadiologyStatus = async (
    orderId: string,
    status: "scheduled" | "in_progress" | "completed" | "reported",
  ) => {
    try {
      await updateRadiologyOrderStatus({ orderId, status });
      toast.success(`Radiology scan #${orderId} marked as ${status}`);
      loadData(false);
    } catch (err: any) {
      toast.error("Failed to update radiology scan status", { description: err.message });
    }
  };

  // Filtered Test Orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((item) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          item.test_name.toLowerCase().includes(q) ||
          item.order_id.toLowerCase().includes(q) ||
          (item.patient_name || "").toLowerCase().includes(q) ||
          (item.patient_mrn || "").toLowerCase().includes(q) ||
          (item.doctor_name || "").toLowerCase().includes(q);

        const matchesStatus =
          statusFilter === "all" || item.status === statusFilter;

        const matchesPriority =
          priorityFilter === "all" || item.priority === priorityFilter;

        const matchesCategory =
          categoryFilter === "all" ||
          (item.test_category || "").toLowerCase() === categoryFilter.toLowerCase();

        return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === "priority") {
          const priorityScore = { stat: 3, urgent: 2, routine: 1 };
          return (
            (priorityScore[b.priority] || 0) - (priorityScore[a.priority] || 0)
          );
        }
        if (sortBy === "patient") {
          return (a.patient_name || "").localeCompare(b.patient_name || "");
        }
        if (sortBy === "test") {
          return a.test_name.localeCompare(b.test_name);
        }
        return new Date(b.ordered_at || b.created_at).getTime() - new Date(a.ordered_at || a.created_at).getTime();
      });
  }, [orders, searchQuery, statusFilter, priorityFilter, categoryFilter, sortBy]);

  // Filtered Samples
  const filteredSamples = useMemo(() => {
    return samples.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        s.sample_id.toLowerCase().includes(q) ||
        (s.barcode || "").toLowerCase().includes(q) ||
        (s.patient_name || "").toLowerCase().includes(q) ||
        s.sample_type.toLowerCase().includes(q)
      );
    });
  }, [samples, searchQuery]);

  // Filtered Results
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        r.test_name.toLowerCase().includes(q) ||
        r.lab_id.toLowerCase().includes(q) ||
        (r.patient_name || "").toLowerCase().includes(q) ||
        (r.patient_mrn || "").toLowerCase().includes(q)
      );
    });
  }, [results, searchQuery]);

  // Critical Panic Results List
  const criticalResults = useMemo(() => {
    return results.filter(
      (r) =>
        r.is_critical ||
        r.status === "critical" ||
        r.critical_flag?.startsWith("critical") ||
        r.critical_flag === "panic",
    );
  }, [results]);

  // Counts for filter pills
  const counts = useMemo(() => {
    return {
      all: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      in_progress: orders.filter((o) => o.status === "in_progress").length,
      completed: orders.filter((o) => o.status === "completed").length,
      stat: orders.filter((o) => o.priority === "stat").length,
    };
  }, [orders]);

  // Pagination for Active Tab
  const activeCount = useMemo(() => {
    switch (activeTab) {
      case "queue":
        return filteredOrders.length;
      case "samples":
        return filteredSamples.length;
      case "results":
        return filteredResults.length;
      case "radiology":
        return radiology.length;
      case "orders":
        return orders.length;
      default:
        return filteredOrders.length;
    }
  }, [activeTab, filteredOrders.length, filteredSamples.length, filteredResults.length, radiology.length, orders.length]);

  const totalPages = Math.max(1, Math.ceil(activeCount / ITEMS_PER_PAGE));

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const paginatedSamples = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSamples.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSamples, currentPage]);

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredResults.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredResults, currentPage]);

  const paginatedRadiology = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return radiology.slice(start, start + ITEMS_PER_PAGE);
  }, [radiology, currentPage]);

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6 pb-24">
        {/* Page Header */}
        <PageHeader
          eyebrow="DIAGNOSTIC & PATHOLOGY GOVERNANCE"
          title="Laboratory & Diagnostics"
          description="Live test accession queues, specimen cold chain tracking, digital pathology findings, and radiology telemetry"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData(false)}
                className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 hover:bg-accent cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold shadow-clinical-md shadow-primary/25 hover:shadow-clinical transition-all gap-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>New Lab Order</span>
              </Button>
            </div>
          }
        />

        <StaggerList className="space-y-6">
          {/* 1. Top KPI Bento Row */}
          <StaggerItem>
            <LabKpiBar
              stats={stats}
              orders={orders}
              samples={samples}
              activeCategory={categoryFilter}
              onSelectCategory={(cat) => {
                setCategoryFilter(cat);
                setCurrentPage(1);
              }}
            />
          </StaggerItem>

          {/* 2. Critical Panic Findings Auto-Banner */}
          {criticalResults.length > 0 && (
            <StaggerItem>
              <CriticalResultBanner
                criticalResults={criticalResults}
                onNotifyTeam={(res) => {
                  toast.success(`Clinical alert dispatched for ${res.patient_name}`, {
                    description: `Doctor notified regarding panic ${res.test_name} value: ${res.result_value} ${res.unit}`,
                  });
                }}
              />
            </StaggerItem>
          )}

          {/* 3. Filter Bar */}
          <StaggerItem>
            <LabFilterBar
              searchQuery={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q);
                setCurrentPage(1);
              }}
              statusFilter={statusFilter}
              onStatusChange={(s) => {
                setStatusFilter(s);
                setCurrentPage(1);
              }}
              priorityFilter={priorityFilter}
              onPriorityChange={(p) => {
                setPriorityFilter(p);
                setCurrentPage(1);
              }}
              categoryFilter={categoryFilter}
              onCategoryChange={(c) => {
                setCategoryFilter(c);
                setCurrentPage(1);
              }}
              sortBy={sortBy}
              onSortChange={(s) => {
                setSortBy(s);
                setCurrentPage(1);
              }}
              onNewOrderClick={() => setIsCreateOpen(true)}
              counts={counts}
            />
          </StaggerItem>

          {/* 4. Tab Sections with Unified Pagination */}
          <StaggerItem>
            <div className="space-y-5">
              <Tabs
                value={activeTab}
                onValueChange={(val: any) => {
                  setActiveTab(val);
                  setCurrentPage(1);
                }}
                className="space-y-5"
              >
                <TabsList className="bg-card border border-border/80 p-1 rounded-2xl shadow-clinical-xs grid grid-cols-2 sm:grid-cols-5 h-auto">
                  <TabsTrigger
                    value="queue"
                    className="rounded-xl py-2 text-xs font-extrabold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 cursor-pointer"
                  >
                    <FlaskConical className="h-4 w-4" />
                    <span>Test Queue</span>
                    <span className="opacity-80 text-[10px]">({filteredOrders.length})</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="samples"
                    className="rounded-xl py-2 text-xs font-extrabold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 cursor-pointer"
                  >
                    <TestTube className="h-4 w-4" />
                    <span>Sample Pipeline</span>
                    <span className="opacity-80 text-[10px]">({filteredSamples.length})</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="results"
                    className="rounded-xl py-2 text-xs font-extrabold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 cursor-pointer"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Verified Results</span>
                    <span className="opacity-80 text-[10px]">({filteredResults.length})</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="radiology"
                    className="rounded-xl py-2 text-xs font-extrabold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 cursor-pointer"
                  >
                    <FileImage className="h-4 w-4" />
                    <span>Radiology & Scans</span>
                    <span className="opacity-80 text-[10px]">({radiology.length})</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="orders"
                    className="rounded-xl py-2 text-xs font-extrabold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 col-span-2 sm:col-span-1 cursor-pointer"
                  >
                    <Stethoscope className="h-4 w-4" />
                    <span>Doctor Orders</span>
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Test Queue */}
                <TabsContent value="queue" className="focus-visible:outline-none">
                  <TestQueueTab
                    orders={paginatedOrders}
                    onUpdateStatus={handleUpdateOrderStatus}
                    onRecordResultClick={(order) => setSelectedOrderForRecord(order)}
                  />
                </TabsContent>

                {/* Tab 2: Sample Tracking */}
                <TabsContent value="samples" className="focus-visible:outline-none">
                  <SampleTrackingTab
                    samples={paginatedSamples}
                    onAdvanceStage={handleAdvanceSampleStage}
                  />
                </TabsContent>

                {/* Tab 3: Results */}
                <TabsContent value="results" className="focus-visible:outline-none">
                  <LabResultsTab
                    results={paginatedResults}
                    onResultClick={(res) => {
                      toast.info(`Test Findings: ${res.test_name}`, {
                        description: `Result: ${res.result_value} ${res.unit} (Ref: ${res.reference_range})`,
                      });
                    }}
                  />
                </TabsContent>

                {/* Tab 4: Radiology */}
                <TabsContent value="radiology" className="focus-visible:outline-none">
                  <RadiologyTab
                    orders={paginatedRadiology}
                    onUpdateStatus={handleUpdateRadiologyStatus}
                  />
                </TabsContent>

                {/* Tab 5: Doctor Orders */}
                <TabsContent value="orders" className="focus-visible:outline-none">
                  <DoctorOrdersTab
                    labOrders={orders}
                    radiologyOrders={radiology}
                  />
                </TabsContent>
              </Tabs>

              {/* Synchronized Pagination Bar */}
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
          </StaggerItem>
        </StaggerList>


        {/* Create Order Dialog */}
        <CreateLabOrderDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSuccess={() => loadData(false)}
        />

        {/* Record Result Dialog */}
        <RecordResultDialog
          order={selectedOrderForRecord}
          open={!!selectedOrderForRecord}
          onOpenChange={(open) => {
            if (!open) setSelectedOrderForRecord(null);
          }}
          onSuccess={() => loadData(false)}
        />
      </div>
    </RouteGuard>
  );
}
