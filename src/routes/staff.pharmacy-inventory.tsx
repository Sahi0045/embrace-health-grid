import { createFileRoute } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  Plus,
  Inbox,
  Send,
  AlertCircle,
  TrendingDown,
  Clock,
  CheckCircle,
  PackagePlus,
  Package,
  Trash2,
  ArrowRight,
} from "lucide-react";
import {
  getInventoryItems,
  getBatches,
  addStock,
  removeStock,
  consumeStock,
  transferStock,
  recordWastage,
  getLowStockItems,
  getNearExpiryItems,
  getPendingDispensingPrescriptions,
  dispensePrescriptionMedications,
  getItemMovements,
} from "@/lib/pharmacy.server";
import { useTableRefresh } from "@/lib/hooks/useTableRefresh";

export const Route = createFileRoute("/staff/pharmacy-inventory")({
  component: StaffPharmacyInventory,
});

function StaffPharmacyInventory() {
  const [activeTab, setActiveTab] = useState("dispense");
  const [searchTerm, setSearchTerm] = useState("");

  // Refresh triggers for real-time updates
  const refreshInventory = useTableRefresh();

  // ─── Queries ────────────────────────────────────────────────────────────

  // Pending prescriptions for dispensing
  const { data: prescriptionsData } = useQuery({
    queryKey: ["pending-dispensing-rx", refreshInventory],
    queryFn: () => getPendingDispensingPrescriptions({ data: { limit: 20 } }),
    enabled: activeTab === "dispense",
  });

  // Inventory items
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory-items-staff", searchTerm, refreshInventory],
    queryFn: () =>
          getInventoryItems({ data: { search: searchTerm || undefined, limit: 100 } }),
    enabled: activeTab === "inventory",
  });

  // All batches
  const { data: batchesData } = useQuery({
    queryKey: ["batches-staff", refreshInventory],
    queryFn: () => getBatches({ data: { limit: 100 } }),
    enabled: activeTab === "receive" || activeTab === "inventory",
  });

  // Low-stock items
  const { data: lowStockData } = useQuery({
    queryKey: ["low-stock-alerts-staff", refreshInventory],
    queryFn: () => getLowStockItems({ data: { resolved: false, limit: 10 } }),
  });

  // Near-expiry items
  const { data: nearExpiryData } = useQuery({
    queryKey: ["near-expiry-staff", refreshInventory],
    queryFn: () =>
          getNearExpiryItems({ data: { status: "near_expiry", resolved: false, limit: 10 } }),
  });

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Pharmacy Stock Operations
          </h1>
          <p className="text-gray-600">
            Dispense medications, receive stock, track movements, and manage alerts
          </p>
        </div>

        {/* Alert Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <TrendingDown className="w-4 h-4 text-yellow-600" />
                Low Stock Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-700">
                {lowStockData?.alerts?.length || 0}
              </div>
              <p className="text-xs text-yellow-600 mt-1">Items below threshold</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Clock className="w-4 h-4 text-orange-600" />
                Near-Expiry Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">
                {nearExpiryData?.alerts?.length || 0}
              </div>
              <p className="text-xs text-orange-600 mt-1">Within 30 days</p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Package className="w-4 h-4 text-blue-600" />
                Pending Dispenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {prescriptionsData?.prescriptions?.filter((rx: any) => rx.readyToDispense)
                  .length || 0}
              </div>
              <p className="text-xs text-blue-600 mt-1">Ready to dispense</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-white border">
            <TabsTrigger value="dispense">Dispense</TabsTrigger>
            <TabsTrigger value="receive">Receive Stock</TabsTrigger>
            <TabsTrigger value="movements">Movements</TabsTrigger>
            <TabsTrigger value="transfer">Transfer</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>

          {/* Dispense Tab */}
          <TabsContent value="dispense" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Prescription Dispenses</CardTitle>
                <CardDescription>
                  Prescriptions ready for medication dispensing
                </CardDescription>
              </CardHeader>
              <CardContent>
                {prescriptionsData?.prescriptions &&
                prescriptionsData.prescriptions.length > 0 ? (
                  <div className="space-y-4">
                    {prescriptionsData.prescriptions
                      .filter((rx: any) => rx.readyToDispense)
                      .map((rx: any) => (
                        <DispenseCard
                          key={rx.rx_id}
                          prescription={rx}
                          onSuccess={() => refreshInventory()}
                        />
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No prescriptions ready for dispensing</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Receive Stock Tab */}
          <TabsContent value="receive" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Receive Stock</CardTitle>
                <CardDescription>Record incoming shipments</CardDescription>
              </CardHeader>
              <CardContent>
                <ReceiveStockForm onSuccess={() => refreshInventory()} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Batches</CardTitle>
                <CardDescription>Current inventory by batch</CardDescription>
              </CardHeader>
              <CardContent>
                {batchesData?.batches && batchesData.batches.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-3 font-medium">
                            Batch Number
                          </th>
                          <th className="text-left py-3 px-3 font-medium">
                            Available
                          </th>
                          <th className="text-left py-3 px-3 font-medium">
                            Expiry
                          </th>
                          <th className="text-left py-3 px-3 font-medium">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchesData.batches.map((batch: any) => (
                          <tr
                            key={batch.batch_id}
                            className="border-b hover:bg-gray-50"
                          >
                            <td className="py-3 px-3 font-medium">
                              {batch.batch_number}
                            </td>
                            <td className="py-3 px-3">
                              {batch.quantity_available}
                            </td>
                            <td className="py-3 px-3">
                              {batch.expiry_date
                                ? new Date(batch.expiry_date).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="py-3 px-3">
                              <Badge
                                variant={
                                  batch.quantity_available > 0
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {batch.quantity_available > 0
                                  ? "In Stock"
                                  : "Depleted"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-gray-500">No batches found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Movements Tab */}
          <TabsContent value="movements" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Stock Movement History</CardTitle>
                <CardDescription>Track all inventory movements</CardDescription>
              </CardHeader>
              <CardContent>
                <MovementsTable onRefresh={() => refreshInventory()} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transfer Tab */}
          <TabsContent value="transfer" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transfer & Adjust Stock</CardTitle>
                <CardDescription>Move stock between locations or record wastage</CardDescription>
              </CardHeader>
              <CardContent>
                <TransferForm onSuccess={() => refreshInventory()} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Items</CardTitle>
                <CardDescription>Current stock levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Input
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {inventoryData?.items && inventoryData.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-3 font-medium">
                            Item
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
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryData.items.map((item: any) => (
                          <tr
                            key={item.item_id}
                            className="border-b hover:bg-gray-50"
                          >
                            <td className="py-3 px-3 font-medium">
                              {item.item_name}
                            </td>
                            <td className="py-3 px-3">{item.item_code}</td>
                            <td className="py-3 px-3">
                              <Badge variant="outline">{item.item_type}</Badge>
                            </td>
                            <td className="py-3 px-3">{item.unit_of_measure}</td>
                            <td className="py-3 px-3">{item.reorder_level}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-gray-500">No items found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Dispense Card Component ─────────────────────────────────────────────────

function DispenseCard({
  prescription,
  onSuccess,
}: {
  prescription: any;
  onSuccess: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: dispensePrescriptionMedications,
    onSuccess: () => {
      setIsOpen(false);
      onSuccess();
    },
  });

  const handleDispense = async () => {
    if (!prescription.medicationDetails) return;

    const medications = prescription.medicationDetails
      .filter((m: any) => m.isAvailable)
      .map((m: any) => ({
        itemId: m.item_id,
        batchId: m.batch_id,
        quantityToDispense: m.quantity,
        medicationName: m.name,
      }));

    mutation.mutate({
      data: {
        prescriptionId: prescription.rx_id,
        patientDid: prescription.patient_did,
        medications,
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-4 bg-white hover:bg-blue-50 transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-900">
                Prescription {prescription.rx_id}
              </h3>
              {prescription.allMedicationsAvailable && (
                <Badge className="bg-green-100 text-green-800">All in stock</Badge>
              )}
            </div>
            <p className="text-sm text-gray-600">Patient: {prescription.patient_did}</p>
          </div>
          <DialogTrigger asChild>
            <Button
              size="sm"
              disabled={!prescription.allMedicationsAvailable || mutation.isPending}
              onClick={() => setIsOpen(true)}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Dispense
            </Button>
          </DialogTrigger>
        </div>

        {/* Medications List */}
        <div className="space-y-2 bg-gray-50 p-3 rounded">
          {prescription.medicationDetails?.map((med: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <span className="text-gray-700">
                {med.name} x{med.quantity}
              </span>
              <Badge
                variant={med.isAvailable ? "outline" : "destructive"}
                className={
                  med.isAvailable
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-red-50 text-red-700"
                }
              >
                {med.isAvailable
                  ? `${med.available} available`
                  : `Short ${med.quantity - med.available}`}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Dispense Dialog */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispense Prescription</DialogTitle>
          <DialogDescription>
            Confirm dispensing of all medications for {prescription.rx_id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {prescription.medicationDetails?.map((med: any, idx: number) => (
            <div
              key={idx}
              className="flex justify-between items-center p-3 border rounded-lg"
            >
              <span className="font-medium">{med.name}</span>
              <span className="text-sm text-gray-600">x{med.quantity}</span>
            </div>
          ))}
        </div>

        <Button
          onClick={handleDispense}
          disabled={mutation.isPending}
          className="w-full"
        >
          {mutation.isPending ? "Dispensing..." : "Confirm Dispense"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Receive Stock Form ──────────────────────────────────────────────────────

function ReceiveStockForm({ onSuccess }: { onSuccess: () => void }) {
  const [itemId, setItemId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const { data: items } = useQuery({
    queryKey: ["items-receive"],
    queryFn: () => getInventoryItems({ data: { limit: 100 } }),
  });

  const mutation = useMutation({
    mutationFn: addStock,
    onSuccess: () => {
      setItemId("");
      setBatchNumber("");
      setQuantity("");
      setExpiryDate("");
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      data: {
        itemId,
        batchId: batchNumber,
        quantityToAdd: parseInt(quantity),
        reason: "Stock received",
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Use the admin portal to create batches. Here you can add quantity to existing batches.
        </AlertDescription>
      </Alert>

      <div>
        <label className="text-sm font-medium">Item *</label>
        <Select value={itemId} onValueChange={setItemId}>
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
        <label className="text-sm font-medium">Quantity to Add *</label>
        <Input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0"
          min={1}
          required
        />
      </div>

      <Button type="submit" disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? "Receiving..." : "Receive Stock"}
      </Button>
    </form>
  );
}

// ─── Transfer Form ──────────────────────────────────────────────────────────

function TransferForm({ onSuccess }: { onSuccess: () => void }) {
  const [operation, setOperation] = useState<"transfer" | "consume" | "waste">(
    "consume"
  );
  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const { data: batches } = useQuery({
    queryKey: ["batches-transfer"],
    queryFn: () => getBatches({ data: { limit: 100 } }),
  });

  const removeStockMutation = useMutation({
    mutationFn: removeStock,
    onSuccess: () => {
      setBatchId("");
      setQuantity("");
      setReason("");
      onSuccess();
    },
  });

  const consumeStockMutation = useMutation({
    mutationFn: consumeStock,
    onSuccess: () => {
      setBatchId("");
      setQuantity("");
      setReason("");
      onSuccess();
    },
  });

  const wasteStockMutation = useMutation({
    mutationFn: recordWastage,
    onSuccess: () => {
      setBatchId("");
      setQuantity("");
      setReason("");
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const batch = batches?.batches?.find((b: any) => b.batch_id === batchId);
    if (!batch) return;

    const qty = parseInt(quantity);

    if (operation === "consume") {
      consumeStockMutation.mutate({
        data: {
          itemId: batch.item_id,
          batchId,
          quantityToConsume: qty,
          reason: reason || "Consumed",
        },
      });
    } else if (operation === "waste") {
      wasteStockMutation.mutate({
        data: {
          itemId: batch.item_id,
          batchId,
          quantityWasted: qty,
          reason: reason || "Wastage",
        },
      });
    }
  };

  const isLoading =
    removeStockMutation.isPending ||
    consumeStockMutation.isPending ||
    wasteStockMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="text-sm font-medium">Operation *</label>
        <Select value={operation} onValueChange={(v: any) => setOperation(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="consume">Consume (Patient Use)</SelectItem>
            <SelectItem value="waste">Record Wastage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium">Batch *</label>
        <Select value={batchId} onValueChange={setBatchId}>
          <SelectTrigger>
            <SelectValue placeholder="Select batch" />
          </SelectTrigger>
          <SelectContent>
            {batches?.batches
              ?.filter((b: any) => b.quantity_available > 0)
              .map((batch: any) => (
                <SelectItem key={batch.batch_id} value={batch.batch_id}>
                  {batch.batch_number} ({batch.quantity_available} available)
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium">Quantity *</label>
        <Input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0"
          min={1}
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium">Reason</label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for this operation"
          rows={3}
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Processing..." : `Record ${operation}`}
      </Button>
    </form>
  );
}

// ─── Movements Table ────────────────────────────────────────────────────────

function MovementsTable({ onRefresh }: { onRefresh: () => void }) {
  const [itemIdFilter, setItemIdFilter] = useState("");
  const { data } = useQuery({
    queryKey: ["movements-staff", itemIdFilter],
    queryFn: () =>
      itemIdFilter
        ? getItemMovements({ data: { itemId: itemIdFilter, limit: 50 } })
        : Promise.resolve({ ok: true as const, movements: [] }),
  });

  const { data: items } = useQuery({
    queryKey: ["items-filter"],
    queryFn: () => getInventoryItems({ data: { limit: 100 } }),
  });

  if (!data?.movements || data.movements.length === 0) {
    return (
      <div className="space-y-4">
        <Select value={itemIdFilter} onValueChange={setItemIdFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by item..." />
          </SelectTrigger>
          <SelectContent>
            {items?.items?.map((item: any) => (
              <SelectItem key={item.item_id} value={item.item_id}>
                {item.item_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-center py-8 text-gray-500">
          Select an item to view movements
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Select value={itemIdFilter} onValueChange={setItemIdFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Filter by item..." />
        </SelectTrigger>
        <SelectContent>
          {items?.items?.map((item: any) => (
            <SelectItem key={item.item_id} value={item.item_id}>
              {item.item_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-3 font-medium">Movement ID</th>
              <th className="text-left py-3 px-3 font-medium">Type</th>
              <th className="text-left py-3 px-3 font-medium">Quantity</th>
              <th className="text-left py-3 px-3 font-medium">Before</th>
              <th className="text-left py-3 px-3 font-medium">After</th>
              <th className="text-left py-3 px-3 font-medium">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {data.movements.map((mov: any) => (
              <tr key={mov.movement_id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-3 font-mono text-xs">{mov.movement_id}</td>
                <td className="py-3 px-3">
                  <Badge variant="outline">{mov.movement_type}</Badge>
                </td>
                <td className="py-3 px-3 font-medium">{mov.quantity_moved}</td>
                <td className="py-3 px-3 text-gray-600">{mov.quantity_before}</td>
                <td className="py-3 px-3 text-gray-600">{mov.quantity_after}</td>
                <td className="py-3 px-3 text-xs text-gray-500">
                  {new Date(mov.movement_timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
