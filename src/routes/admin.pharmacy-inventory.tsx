import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  Plus,
  Package,
  AlertCircle,
  TrendingDown,
  Clock,
  Trash2,
  Edit,
} from "lucide-react";
import {
  getInventoryItems,
  getBatches,
  getSuppliers,
  getLowStockItems,
  getNearExpiryItems,
  getExpiredStock,
  getPurchaseOrders,
  createInventoryItem,
  createSupplier,
  createBatch,
} from "@/lib/api";
import { useTableRefresh } from "@/lib/hooks/useTableRefresh";

export const Route = createFileRoute("/admin/pharmacy-inventory")({
  component: AdminPharmacyInventory,
});

function AdminPharmacyInventory() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Refresh triggers for real-time updates
  const refreshInventory = useTableRefresh();
  const refreshMovements = useTableRefresh();

  // ─── Queries ────────────────────────────────────────────────────────────

  // Inventory items
  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ["inventory-items", searchTerm, statusFilter, refreshInventory],
    queryFn: () =>
      getInventoryItems({
        search: searchTerm || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
    enabled: activeTab === "inventory" || activeTab === "overview",
  });

  // Low-stock alerts
  const { data: lowStockData } = useQuery({
    queryKey: ["low-stock-alerts", refreshInventory],
    queryFn: () => getLowStockItems({ resolved: false, limit: 10 }),
    enabled: activeTab === "overview" || activeTab === "alerts",
  });

  // Near-expiry items
  const { data: nearExpiryData } = useQuery({
    queryKey: ["near-expiry-alerts", refreshInventory],
    queryFn: () =>
      getNearExpiryItems({ status: "near_expiry", resolved: false, limit: 10 }),
    enabled: activeTab === "overview" || activeTab === "alerts",
  });

  // Expired stock
  const { data: expiredData } = useQuery({
    queryKey: ["expired-stock", refreshInventory],
    queryFn: () => getExpiredStock({ limit: 5 }),
    enabled: activeTab === "alerts",
  });

  // Suppliers
  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers", refreshInventory],
    queryFn: () => getSuppliers({ active: true }),
    enabled: activeTab === "suppliers" || activeTab === "overview",
  });

  // Purchase orders
  const { data: purchaseOrdersData } = useQuery({
    queryKey: ["purchase-orders", refreshInventory],
    queryFn: () => getPurchaseOrders({ limit: 20 }),
    enabled: activeTab === "purchase-orders",
  });

  // ─── Mutations ──────────────────────────────────────────────────────────

  const createItemMutation = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => {
      refreshInventory();
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      refreshInventory();
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: createBatch,
    onSuccess: () => {
      refreshInventory();
    },
  });

  // ─── Render ─────────────────────────────────────────────────────────────

  const lowStockCount = lowStockData?.alerts?.length || 0;
  const nearExpiryCount = nearExpiryData?.alerts?.length || 0;
  const expiredCount = expiredData?.alerts?.length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Pharmacy Inventory Management
          </h1>
          <p className="text-gray-600">
            Manage medicines, stock levels, suppliers, and alerts
          </p>
        </div>

        {/* Alert Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Low Stock Alert */}
          <Card className={lowStockCount > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <TrendingDown className="w-4 h-4 text-yellow-600" />
                Low Stock Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-700">
                {lowStockCount}
              </div>
              <p className="text-xs text-yellow-600 mt-1">
                Items below reorder level
              </p>
            </CardContent>
          </Card>

          {/* Near-Expiry Alert */}
          <Card className={nearExpiryCount > 0 ? "border-orange-200 bg-orange-50" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Clock className="w-4 h-4 text-orange-600" />
                Near-Expiry Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">
                {nearExpiryCount}
              </div>
              <p className="text-xs text-orange-600 mt-1">
                Items within 30 days of expiry
              </p>
            </CardContent>
          </Card>

          {/* Expired Alert */}
          <Card className={expiredCount > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Expired Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">
                {expiredCount}
              </div>
              <p className="text-xs text-red-600 mt-1">
                {expiredData?.totalQuantityExpired || 0} units total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-5 bg-white border">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="batches">Batches</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="purchase-orders">Orders</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Low Stock Items</CardTitle>
                <CardDescription>Items below reorder level</CardDescription>
              </CardHeader>
              <CardContent>
                {lowStockData?.alerts && lowStockData.alerts.length > 0 ? (
                  <div className="space-y-3">
                    {lowStockData.alerts.slice(0, 5).map((alert: any) => (
                      <div
                        key={alert.alert_id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {alert.inventory_items?.item_name || "Unknown Item"}
                          </p>
                          <p className="text-sm text-gray-500">
                            Current: {alert.current_quantity} | Reorder: {alert.reorder_level}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-yellow-50">
                          Short by {alert.quantity_short}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-6">
                    All items well-stocked
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Near-Expiry Items</CardTitle>
                <CardDescription>Items expiring within 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                {nearExpiryData?.alerts && nearExpiryData.alerts.length > 0 ? (
                  <div className="space-y-3">
                    {nearExpiryData.alerts.slice(0, 5).map((alert: any) => (
                      <div
                        key={alert.alert_id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {alert.inventory_items?.item_name || "Unknown Item"}
                          </p>
                          <p className="text-sm text-gray-500">
                            Batch: {alert.inventory_batches?.batch_number}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-orange-600">
                            {alert.days_until_expiry} days
                          </p>
                          <p className="text-xs text-gray-500">
                            Qty: {alert.quantity_affected}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-6">
                    No items near expiry
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Inventory Items</CardTitle>
                    <CardDescription>
                      {inventoryData?.items?.length || 0} items managed
                    </CardDescription>
                  </div>
                  <AddItemDialog onSuccess={() => refreshInventory()} />
                </div>
              </CardHeader>
              <CardContent>
                {/* Search & Filter */}
                <div className="flex gap-3 mb-6">
                  <Input
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="discontinued">Discontinued</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Items Table */}
                {inventoryLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : inventoryData?.items && inventoryData.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-3 font-medium">
                            Name
                          </th>
                          <th className="text-left py-3 px-3 font-medium">
                            Code
                          </th>
                          <th className="text-left py-3 px-3 font-medium">
                            Type
                          </th>
                          <th className="text-left py-3 px-3 font-medium">
                            Unit
                          </th>
                          <th className="text-left py-3 px-3 font-medium">
                            Reorder Level
                          </th>
                          <th className="text-left py-3 px-3 font-medium">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryData.items.map((item: any) => (
                          <tr key={item.item_id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-3">{item.item_name}</td>
                            <td className="py-3 px-3 text-gray-600">
                              {item.item_code}
                            </td>
                            <td className="py-3 px-3">
                              <Badge variant="outline">{item.item_type}</Badge>
                            </td>
                            <td className="py-3 px-3">{item.unit_of_measure}</td>
                            <td className="py-3 px-3">{item.reorder_level}</td>
                            <td className="py-3 px-3">
                              <Badge
                                variant={
                                  item.status === "active" ? "default" : "outline"
                                }
                              >
                                {item.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No inventory items found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Batches Tab */}
          <TabsContent value="batches" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Inventory Batches</CardTitle>
                    <CardDescription>
                      All active batches with tracking
                    </CardDescription>
                  </div>
                  <AddBatchDialog onSuccess={() => refreshInventory()} />
                </div>
              </CardHeader>
              <CardContent>
                <BatchesTable onRefresh={() => refreshInventory()} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Low Stock Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-yellow-600" />
                    Low Stock Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lowStockData?.alerts && lowStockData.alerts.length > 0 ? (
                    <div className="space-y-3">
                      {lowStockData.alerts.map((alert: any) => (
                        <div
                          key={alert.alert_id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {alert.inventory_items?.item_name}
                            </p>
                            <p className="text-sm text-gray-600">
                              Current: {alert.current_quantity} | Threshold: {alert.reorder_level}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigate({
                                to: "/admin/pharmacy-inventory",
                                search: { tab: "purchase-orders" },
                              });
                            }}
                          >
                            Create Order
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-6">
                      No low stock alerts
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Near-Expiry Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-600" />
                    Near-Expiry Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {nearExpiryData?.alerts && nearExpiryData.alerts.length > 0 ? (
                    <div className="space-y-3">
                      {nearExpiryData.alerts.map((alert: any) => (
                        <div
                          key={alert.alert_id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-orange-50"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {alert.inventory_items?.item_name}
                            </p>
                            <p className="text-sm text-gray-600">
                              Batch: {alert.inventory_batches?.batch_number} | 
                              Qty: {alert.quantity_affected}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-orange-600">
                              {alert.days_until_expiry} days
                            </p>
                            <p className="text-xs text-gray-500">to expiry</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-6">
                      No near-expiry items
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Expired Stock */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Expired Stock History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {expiredData?.alerts && expiredData.alerts.length > 0 ? (
                    <div className="space-y-3">
                      {expiredData.alerts.map((alert: any) => (
                        <div
                          key={alert.alert_id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-red-50"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {alert.inventory_items?.item_name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {alert.action_notes}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-600">
                              {new Date(alert.action_taken_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-6">
                      No expired stock records
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Purchase Orders Tab */}
          <TabsContent value="purchase-orders" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Purchase Orders</CardTitle>
                    <CardDescription>
                      {purchaseOrdersData?.orders?.length || 0} orders
                    </CardDescription>
                  </div>
                  <AddPurchaseOrderDialog onSuccess={() => refreshInventory()} />
                </div>
              </CardHeader>
              <CardContent>
                <PurchaseOrdersTable
                  orders={purchaseOrdersData?.orders || []}
                  onRefresh={() => refreshInventory()}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Dialog Components ──────────────────────────────────────────────────────

function AddItemDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => {
      setOpen(false);
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    mutation.mutate({
      itemCode: formData.get("itemCode") as string,
      itemName: formData.get("itemName") as string,
      itemType: formData.get("itemType") as string,
      category: formData.get("category") as string,
      unitOfMeasure: formData.get("unitOfMeasure") as string,
      reorderLevel: parseInt(formData.get("reorderLevel") as string) || 50,
      reorderQuantity: parseInt(formData.get("reorderQuantity") as string) || 100,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Inventory Item</DialogTitle>
          <DialogDescription>Create a new medicine or supply</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Item Code *</label>
            <Input name="itemCode" placeholder="e.g., PARA500" required />
          </div>
          <div>
            <label className="text-sm font-medium">Item Name *</label>
            <Input name="itemName" placeholder="e.g., Paracetamol 500mg" required />
          </div>
          <div>
            <label className="text-sm font-medium">Type *</label>
            <Select name="itemType" required>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medicine">Medicine</SelectItem>
                <SelectItem value="consumable">Consumable</SelectItem>
                <SelectItem value="medical_supply">Medical Supply</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Unit of Measure *</label>
            <Input name="unitOfMeasure" placeholder="e.g., tablet, vial" required />
          </div>
          <div>
            <label className="text-sm font-medium">Reorder Level</label>
            <Input
              name="reorderLevel"
              type="number"
              defaultValue={50}
              min={1}
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Create Item"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddBatchDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: items } = useQuery({
    queryKey: ["inventory-items-select"],
    queryFn: () => getInventoryItems({ limit: 100 }),
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-select"],
    queryFn: () => getSuppliers(),
  });

  const mutation = useMutation({
    mutationFn: createBatch,
    onSuccess: () => {
      setOpen(false);
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    mutation.mutate({
      itemId: formData.get("itemId") as string,
      batchNumber: formData.get("batchNumber") as string,
      quantityReceived: parseInt(formData.get("quantityReceived") as string),
      supplierId: (formData.get("supplierId") as string) || undefined,
      expiryDate: (formData.get("expiryDate") as string) || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" variant="outline">
          <Plus className="w-4 h-4" />
          Add Batch
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive New Batch</DialogTitle>
          <DialogDescription>Register incoming stock</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Item *</label>
            <Select name="itemId" required>
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {items?.items?.map((item: any) => (
                  <SelectItem key={item.item_id} value={item.item_id}>
                    {item.item_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Batch Number *</label>
            <Input name="batchNumber" placeholder="e.g., BATCH-2026-001" required />
          </div>
          <div>
            <label className="text-sm font-medium">Quantity *</label>
            <Input
              name="quantityReceived"
              type="number"
              placeholder="Quantity"
              required
              min={1}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Supplier</label>
            <Select name="supplierId">
              <SelectTrigger>
                <SelectValue placeholder="Select supplier (optional)" />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.suppliers?.map((supplier: any) => (
                  <SelectItem key={supplier.supplier_id} value={supplier.supplier_id}>
                    {supplier.supplier_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Expiry Date</label>
            <Input name="expiryDate" type="date" />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Receive Batch"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddPurchaseOrderDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-po"],
    queryFn: () => getSuppliers(),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>
            Request stock from supplier (detailed interface coming)
          </DialogDescription>
        </DialogHeader>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Purchase order creation requires a more detailed interface. Use the
            pharmacy staff portal for full functionality.
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  );
}

function BatchesTable({ onRefresh }: { onRefresh: () => void }) {
  const { data } = useQuery({
    queryKey: ["batches-all"],
    queryFn: () => getBatches({ limit: 50 }),
  });

  if (!data?.batches || data.batches.length === 0) {
    return <div className="text-center py-8 text-gray-500">No batches found</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-3 font-medium">Batch Number</th>
            <th className="text-left py-3 px-3 font-medium">Item</th>
            <th className="text-left py-3 px-3 font-medium">Available</th>
            <th className="text-left py-3 px-3 font-medium">Expiry Date</th>
            <th className="text-left py-3 px-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.batches.map((batch: any) => (
            <tr key={batch.batch_id} className="border-b hover:bg-gray-50">
              <td className="py-3 px-3 font-medium">{batch.batch_number}</td>
              <td className="py-3 px-3">{batch.item_id}</td>
              <td className="py-3 px-3">
                <span className="font-medium">{batch.quantity_available}</span>
                <span className="text-gray-500 text-xs ml-1">
                  / {batch.quantity_received}
                </span>
              </td>
              <td className="py-3 px-3">
                {batch.expiry_date
                  ? new Date(batch.expiry_date).toLocaleDateString()
                  : "—"}
              </td>
              <td className="py-3 px-3">
                <Badge
                  variant={
                    batch.quantity_available > 0 ? "default" : "destructive"
                  }
                >
                  {batch.quantity_available > 0 ? "Active" : "Depleted"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PurchaseOrdersTable({
  orders,
  onRefresh,
}: {
  orders: any[];
  onRefresh: () => void;
}) {
  if (!orders || orders.length === 0) {
    return <div className="text-center py-8 text-gray-500">No purchase orders</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-3 font-medium">Order ID</th>
            <th className="text-left py-3 px-3 font-medium">Supplier</th>
            <th className="text-left py-3 px-3 font-medium">Status</th>
            <th className="text-left py-3 px-3 font-medium">Total</th>
            <th className="text-left py-3 px-3 font-medium">Expected</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order: any) => (
            <tr key={order.order_id} className="border-b hover:bg-gray-50">
              <td className="py-3 px-3 font-medium">{order.order_id}</td>
              <td className="py-3 px-3">
                {order.suppliers?.supplier_name || "—"}
              </td>
              <td className="py-3 px-3">
                <Badge variant="outline">{order.status}</Badge>
              </td>
              <td className="py-3 px-3">${order.total_cost || "—"}</td>
              <td className="py-3 px-3">
                {order.expected_delivery_date
                  ? new Date(order.expected_delivery_date).toLocaleDateString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
