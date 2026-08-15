import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import {
  UtensilsCrossed,
  RefreshCw,
  Plus,
  Package,
  HeartPulse,
  Truck,
  Building2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChefHat,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCafeteriaData,
  updateMenuItemStatus,
  updateDeliveryStatus,
  updateVendorContract,
  updateDietaryRequirementStatus,
} from "@/lib/api";
import { useTableRefresh } from "@/hooks/use-realtime";
import type {
  CafeteriaMenuItem,
  KitchenStockItem,
  DietaryRequirement,
  MealDeliveryRecord,
  CafeteriaVendor,
  FoodWastageLog,
  CafeteriaDashboardStats,
  DeliveryStatus,
  ContractStatus,
  MealPlanStatus,
} from "@/lib/types";

import { CafeteriaKpiBar } from "@/components/cafeteria/CafeteriaKpiBar";
import {
  CafeteriaFilterBar,
  CafeteriaTabType,
  CafeteriaStatusFilter,
} from "@/components/cafeteria/CafeteriaFilterBar";
import { MenuMealsTab } from "@/components/cafeteria/MenuMealsTab";
import { KitchenStockTab } from "@/components/cafeteria/KitchenStockTab";
import { DietaryRequirementsTab } from "@/components/cafeteria/DietaryRequirementsTab";
import { MealDeliveryTab } from "@/components/cafeteria/MealDeliveryTab";
import { VendorsTab } from "@/components/cafeteria/VendorsTab";
import { WastageTab } from "@/components/cafeteria/WastageTab";
import { CreateMenuItemDialog } from "@/components/cafeteria/CreateMenuItemDialog";
import { LogWastageDialog } from "@/components/cafeteria/LogWastageDialog";
import { CreateVendorDialog } from "@/components/cafeteria/CreateVendorDialog";
import { useSpotlightTarget } from "@/hooks/use-spotlight";

export const Route = createFileRoute("/admin/cafeteria")({
  validateSearch: (search: Record<string, unknown>): { highlight?: string } => ({
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Cafeteria & General Inventory — Admin Console" },
      {
        name: "description",
        content:
          "Real-time food service operations, kitchen stock inventory, patient dietary compliance, room meal delivery pipelines, and wastage reduction analytics",
      },
    ],
  }),
  component: CafeteriaManagementPage,
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

function CafeteriaManagementPage() {
  const search = Route.useSearch();
  useSpotlightTarget(search.highlight);

  // Raw State
  const [menu, setMenu] = useState<CafeteriaMenuItem[]>([]);
  const [stock, setStock] = useState<KitchenStockItem[]>([]);
  const [dietary, setDietary] = useState<DietaryRequirement[]>([]);
  const [deliveries, setDeliveries] = useState<MealDeliveryRecord[]>([]);
  const [vendors, setVendors] = useState<CafeteriaVendor[]>([]);
  const [wastage, setWastage] = useState<FoodWastageLog[]>([]);
  const [stats, setStats] = useState<CafeteriaDashboardStats>({
    activeMenuItems: 0,
    pendingDeliveries: 0,
    deliveredToday: 0,
    activeDietaryPlans: 0,
    lowKitchenStockCount: 0,
    todayWastageKg: 0,
    activeVendorsCount: 0,
    averageMealRating: 4.8,
  });
  const [loading, setLoading] = useState(true);

  // Active Tab & Filters
  const [activeTab, setActiveTab] = useState<CafeteriaTabType>("menu");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CafeteriaStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog States
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isLogWastageOpen, setIsLogWastageOpen] = useState(false);
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);

  // Load Data
  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const data = await getCafeteriaData();
      setMenu(data.menu || []);
      setStock(data.stock || []);
      setDietary(data.dietary || []);
      setDeliveries(data.deliveries || []);
      setVendors(data.vendors || []);
      setWastage(data.wastage || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      toast.error("Failed to sync cafeteria data", {
        description: err.message,
      });
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Realtime subscriptions across all 6 tables
  useTableRefresh("cafeteria_menu_items", () => loadData(false));
  useTableRefresh("kitchen_stock", () => loadData(false));
  useTableRefresh("dietary_requirements", () => loadData(false));
  useTableRefresh("meal_deliveries", () => loadData(false));
  useTableRefresh("cafeteria_vendors", () => loadData(false));
  useTableRefresh("food_wastage_logs", () => loadData(false));

  // Handler: Toggle Menu Item Status
  const handleToggleMenuItemStatus = async (
    menuItemId: string,
    nextStatus: "active" | "inactive",
  ) => {
    try {
      await updateMenuItemStatus({ menuItemId, status: nextStatus });
      toast.success(`Menu item #${menuItemId} marked as ${nextStatus.toUpperCase()}`);
      loadData(false);
    } catch (err: any) {
      toast.error("Failed to update menu status", { description: err.message });
    }
  };

  // Handler: Advance Delivery Stage
  const handleAdvanceDeliveryStage = async (
    deliveryId: string,
    nextStatus: DeliveryStatus,
  ) => {
    try {
      await updateDeliveryStatus({ deliveryId, status: nextStatus });
      toast.success(`Meal delivery #${deliveryId} marked as ${nextStatus.toUpperCase()}`);
      loadData(false);
    } catch (err: any) {
      toast.error("Failed to update delivery status", { description: err.message });
    }
  };

  // Handler: Update Vendor Status
  const handleUpdateVendorStatus = async (
    vendorId: string,
    nextStatus: ContractStatus,
  ) => {
    try {
      await updateVendorContract({ vendorId, status: nextStatus });
      toast.success(`Vendor contract #${vendorId} updated to ${nextStatus.toUpperCase()}`);
      loadData(false);
    } catch (err: any) {
      toast.error("Failed to update vendor status", { description: err.message });
    }
  };

  // Handler: Update Dietary Plan Status
  const handleUpdateDietaryStatus = async (
    requirementId: string,
    nextStatus: MealPlanStatus,
  ) => {
    try {
      await updateDietaryRequirementStatus({ requirementId, status: nextStatus });
      toast.success(`Patient meal plan updated to ${nextStatus.toUpperCase()}`);
      loadData(false);
    } catch (err: any) {
      toast.error("Failed to update dietary status", { description: err.message });
    }
  };

  // Filtered Menu Items
  const filteredMenu = useMemo(() => {
    return menu
      .filter((item) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          item.name.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.dietary_tags.some((t) => t.toLowerCase().includes(q));

        const matchesCategory =
          categoryFilter === "all" || item.category === categoryFilter;

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && item.status === "active") ||
          (statusFilter === "inactive" && item.status === "inactive");

        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "name-asc") return a.name.localeCompare(b.name);
        if (sortBy === "name-desc") return b.name.localeCompare(a.name);
        if (sortBy === "calories-asc") return a.calories - b.calories;
        if (sortBy === "calories-desc") return b.calories - a.calories;
        if (sortBy === "price-asc") return a.price - b.price;
        if (sortBy === "price-desc") return b.price - a.price;
        if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [menu, searchQuery, categoryFilter, statusFilter, sortBy]);

  // Filtered Kitchen Stock
  const filteredStock = useMemo(() => {
    return stock
      .filter((item) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          item.item_name.toLowerCase().includes(q) ||
          item.supplier?.toLowerCase().includes(q) ||
          item.storage_location?.toLowerCase().includes(q);

        const matchesCategory =
          categoryFilter === "all" || item.category === categoryFilter;

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && item.status === "normal") ||
          (statusFilter === "low_stock" && (item.status === "low_stock" || item.quantity <= item.reorder_level));

        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "name-asc") return a.item_name.localeCompare(b.item_name);
        if (sortBy === "name-desc") return b.item_name.localeCompare(a.item_name);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [stock, searchQuery, categoryFilter, statusFilter, sortBy]);

  // Filtered Dietary Requirements
  const filteredDietary = useMemo(() => {
    return dietary.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.patient_name.toLowerCase().includes(q) ||
        item.patient_mrn?.toLowerCase().includes(q) ||
        item.room_number?.toLowerCase().includes(q) ||
        item.requirements.some((r) => r.toLowerCase().includes(q));

      const matchesStatus =
        categoryFilter === "all" || item.meal_plan_status === categoryFilter;

      return matchesSearch && matchesStatus;
    });
  }, [dietary, searchQuery, categoryFilter]);

  // Filtered Meal Deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.patient_name.toLowerCase().includes(q) ||
        item.room_number.toLowerCase().includes(q) ||
        item.menu_item_name.toLowerCase().includes(q);

      const matchesStatus =
        categoryFilter === "all" || item.delivery_status === categoryFilter;

      return matchesSearch && matchesStatus;
    });
  }, [deliveries, searchQuery, categoryFilter]);

  // Filtered Vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.contact_person?.toLowerCase().includes(q) ||
        item.contact_email?.toLowerCase().includes(q) ||
        item.supplied_categories.some((c) => c.toLowerCase().includes(q));

      const matchesStatus =
        categoryFilter === "all" || item.contract_status === categoryFilter;

      return matchesSearch && matchesStatus;
    });
  }, [vendors, searchQuery, categoryFilter]);

  // Filtered Food Wastage
  const filteredWastage = useMemo(() => {
    return wastage.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.item_name.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q) ||
        item.meal_type.toLowerCase().includes(q);

      const matchesReason =
        categoryFilter === "all" || item.reason === categoryFilter;

      return matchesSearch && matchesReason;
    });
  }, [wastage, searchQuery, categoryFilter]);

  // Active dataset & pagination slice
  const activeDatasetLength = useMemo(() => {
    switch (activeTab) {
      case "menu":
        return filteredMenu.length;
      case "stock":
        return filteredStock.length;
      case "dietary":
        return filteredDietary.length;
      case "delivery":
        return filteredDeliveries.length;
      case "vendors":
        return filteredVendors.length;
      case "wastage":
        return filteredWastage.length;
      default:
        return 0;
    }
  }, [
    activeTab,
    filteredMenu.length,
    filteredStock.length,
    filteredDietary.length,
    filteredDeliveries.length,
    filteredVendors.length,
    filteredWastage.length,
  ]);

  const totalPages = Math.max(1, Math.ceil(activeDatasetLength / ITEMS_PER_PAGE));

  const paginatedMenu = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMenu.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMenu, currentPage]);

  const paginatedStock = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStock.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredStock, currentPage]);

  const paginatedDietary = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDietary.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDietary, currentPage]);

  const paginatedDeliveries = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDeliveries.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDeliveries, currentPage]);

  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVendors.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredVendors, currentPage]);

  const paginatedWastage = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredWastage.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredWastage, currentPage]);

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6 pb-24">
        {/* Page Header */}
        <PageHeader
          eyebrow="FOOD SERVICE & NUTRITION GOVERNANCE"
          title="Cafeteria & General Inventory"
          description="Real-time clinical dietary tracking, nutritional menus, pantry stock governance, meal dispatch, and wastage analytics"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData(false)}
                className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 hover:bg-accent cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
                <span>Refresh</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setIsAddMenuOpen(true)}
                className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold shadow-clinical-md shadow-primary/25 hover:shadow-clinical transition-all gap-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Menu Item</span>
              </Button>
            </div>
          }
        />


        <StaggerList className="space-y-6">
          {/* 2. Hero Bento Deck KPI Bar */}
          <StaggerItem>
            <CafeteriaKpiBar
              stats={stats}
              menu={menu}
              wastage={wastage}
              activeCategory={categoryFilter}
              onSelectCategory={(cat) => {
                setCategoryFilter(cat);
                setCurrentPage(1);
              }}
            />
          </StaggerItem>

          {/* 3. Filter Bar */}
          <StaggerItem>
            <CafeteriaFilterBar
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
              activeTab={activeTab}
              onAddMenuItemClick={() => setIsAddMenuOpen(true)}
              onLogWastageClick={() => setIsLogWastageOpen(true)}
              onAddVendorClick={() => setIsAddVendorOpen(true)}
              counts={{
                menuTotal: menu.length,
                stockTotal: stock.length,
                dietaryTotal: dietary.length,
                deliveryTotal: deliveries.length,
                vendorsTotal: vendors.length,
                wastageTotal: wastage.length,
              }}
            />
          </StaggerItem>

          {/* 4. Tab Sections with Unified Pagination */}
          <StaggerItem>
            <div className="space-y-5">
              <Tabs
                value={activeTab}
                onValueChange={(val: any) => {
                  setActiveTab(val);
                  setCategoryFilter("all");
                  setCurrentPage(1);
                }}
                className="space-y-5"
              >
                <TabsList className="bg-card border border-border/80 p-1 rounded-2xl shadow-clinical-xs grid grid-cols-2 sm:grid-cols-6 h-auto">
                  <TabsTrigger
                    value="menu"
                    className="rounded-xl py-2 text-xs font-extrabold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 cursor-pointer"
                  >
                    <UtensilsCrossed className="h-4 w-4" />
                    <span>Menu & Meals</span>
                    <span className="opacity-80 text-[10px]">({filteredMenu.length})</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="stock"
                    className="rounded-xl py-2 text-xs font-extrabold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 cursor-pointer"
                  >
                    <Package className="h-4 w-4" />
                    <span>Kitchen Stock</span>
                    <span className="opacity-80 text-[10px]">({filteredStock.length})</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="dietary"
                    className="rounded-xl py-2 text-xs font-extrabold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 cursor-pointer"
                  >
                    <HeartPulse className="h-4 w-4" />
                    <span>Dietary Plans</span>
                    <span className="opacity-80 text-[10px]">({filteredDietary.length})</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="delivery"
                    className="rounded-xl py-2 text-xs font-extrabold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 cursor-pointer"
                  >
                    <Truck className="h-4 w-4" />
                    <span>Meal Delivery</span>
                    <span className="opacity-80 text-[10px]">({filteredDeliveries.length})</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="vendors"
                    className="rounded-xl py-2 text-xs font-extrabold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 cursor-pointer"
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Vendors</span>
                    <span className="opacity-80 text-[10px]">({filteredVendors.length})</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="wastage"
                    className="rounded-xl py-2 text-xs font-extrabold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Food Wastage</span>
                    <span className="opacity-80 text-[10px]">({filteredWastage.length})</span>
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Menu & Meals */}
                <TabsContent value="menu" className="focus-visible:outline-none">
                  <MenuMealsTab
                    items={paginatedMenu}
                    onToggleStatus={handleToggleMenuItemStatus}
                  />
                </TabsContent>

                {/* Tab 2: Kitchen Stock */}
                <TabsContent value="stock" className="focus-visible:outline-none">
                  <KitchenStockTab stock={paginatedStock} />
                </TabsContent>

                {/* Tab 3: Dietary Requirements */}
                <TabsContent value="dietary" className="focus-visible:outline-none">
                  <DietaryRequirementsTab
                    requirements={paginatedDietary}
                    onUpdateStatus={handleUpdateDietaryStatus}
                  />
                </TabsContent>

                {/* Tab 4: Meal Delivery */}
                <TabsContent value="delivery" className="focus-visible:outline-none">
                  <MealDeliveryTab
                    deliveries={paginatedDeliveries}
                    onAdvanceStage={handleAdvanceDeliveryStage}
                  />
                </TabsContent>

                {/* Tab 5: Vendors */}
                <TabsContent value="vendors" className="focus-visible:outline-none">
                  <VendorsTab
                    vendors={paginatedVendors}
                    onUpdateStatus={handleUpdateVendorStatus}
                  />
                </TabsContent>

                {/* Tab 6: Wastage */}
                <TabsContent value="wastage" className="focus-visible:outline-none">
                  <WastageTab logs={paginatedWastage} />
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

        {/* Dialog Modals */}
        <CreateMenuItemDialog
          open={isAddMenuOpen}
          onOpenChange={setIsAddMenuOpen}
          onSuccess={() => loadData(false)}
        />

        <LogWastageDialog
          open={isLogWastageOpen}
          onOpenChange={setIsLogWastageOpen}
          onSuccess={() => loadData(false)}
        />

        <CreateVendorDialog
          open={isAddVendorOpen}
          onOpenChange={setIsAddVendorOpen}
          onSuccess={() => loadData(false)}
        />
      </div>
    </RouteGuard>
  );
}
