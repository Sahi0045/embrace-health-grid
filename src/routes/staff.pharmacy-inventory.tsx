import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Route = createFileRoute("/staff/pharmacy-inventory")({
  component: StaffPharmacyInventory,
});

function StaffPharmacyInventory() {
  const [activeTab, setActiveTab] = useState("dispense");
  const [searchTerm, setSearchTerm] = useState("");

  // Refresh triggers for real-time updates
  const queryClient = useQueryClient();
  /**
   * Force the pharmacy queries to refetch.
   *
   * This replaces `useTableRefresh()`, which returned a FUNCTION that callers put
   * into their React Query keys. React Query hashes keys with JSON.stringify,
   * which serialises a function to `null` — so the key was constant and nothing
   * ever refetched. Dispensing, receiving and transferring all succeeded and the
   * screen kept showing the old quantities until a full page reload.
   */
  const refreshInventory = () => queryClient.invalidateQueries();

  // ─── Queries ────────────────────────────────────────────────────────────

  // Pending prescriptions for dispensing
  const { data: prescriptionsData } = useQuery({
    queryKey: ["pending-dispensing-rx"],
    queryFn: () => getPendingDispensingPrescriptions({ data: { limit: 20 } }),
    enabled: activeTab === "dispense",
  });

  // Inventory items
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory-items-staff", searchTerm],
    queryFn: () => getInventoryItems({ data: { search: searchTerm || undefined, limit: 100 } }),
    enabled: activeTab === "inventory",
  });

  // All batches
  const { data: batchesData } = useQuery({
    queryKey: ["batches-staff"],
    queryFn: () => getBatches({ data: { limit: 100 } }),
    enabled: activeTab === "receive" || activeTab === "inventory",
  });

  // Low-stock items
  const { data: lowStockData } = useQuery({
    queryKey: ["low-stock-alerts-staff"],
    queryFn: () => getLowStockItems({ data: { resolved: false, limit: 10 } }),
  });

  // Near-expiry items
  const { data: nearExpiryData } = useQuery({
    queryKey: ["near-expiry-staff"],
    queryFn: () =>
      getNearExpiryItems({ data: { status: "near_expiry", resolved: false, limit: 10 } }),
  });

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <RouteGuard requiredRole="staff">
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Pharmacy Stock Operations</h1>
            <p className="text-muted-foreground">
              Dispense medications, receive stock, track movements, and manage alerts
            </p>
          </div>

          {/* Alert Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="border-warning/30 bg-warning/10">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <TrendingDown className="w-4 h-4 text-warning" />
                  Low Stock Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">
                  {lowStockData?.alerts?.length || 0}
                </div>
                <p className="text-xs text-warning mt-1">Items below threshold</p>
              </CardContent>
            </Card>

            <Card className="border-warning/30 bg-warning/10">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="w-4 h-4 text-warning" />
                  Near-Expiry Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">
                  {nearExpiryData?.alerts?.length || 0}
                </div>
                <p className="text-xs text-warning mt-1">Within 30 days</p>
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-primary/10">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Package className="w-4 h-4 text-primary" />
                  Pending Dispenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {prescriptionsData?.prescriptions?.filter((rx: any) => rx.readyToDispense)
                    .length || 0}
                </div>
                <p className="text-xs text-primary mt-1">Ready to dispense</p>
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
                    Prescriptions awaiting dispensing, and what is blocking them
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* The list used to be filtered to readyToDispense, so a
                      prescription whose medication is out of stock vanished and
                      the queue read "No prescriptions ready for dispensing".
                      That is the one case a pharmacist most needs to see: with
                      no stock at all, four waiting prescriptions showed as an
                      empty queue and nothing prompted a reorder. Blocked
                      prescriptions are now listed and labelled. */}
                  {prescriptionsData?.prescriptions &&
                  prescriptionsData.prescriptions.length > 0 ? (
                    <div className="space-y-4">
                      {prescriptionsData.prescriptions.map((rx: any) =>
                        rx.readyToDispense ? (
                          <DispenseCard
                            key={rx.rx_id}
                            prescription={rx}
                            onSuccess={() => refreshInventory()}
                          />
                        ) : (
                          <div
                            key={rx.rx_id}
                            className="rounded-lg border border-warning/30 bg-warning/5 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-semibold text-sm">
                                  {rx.patient_name || rx.patient_did}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {rx.diagnosis || "No diagnosis recorded"} · {rx.rx_id}
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-warning-foreground">
                                Cannot dispense
                              </span>
                            </div>
                            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                              {(rx.medicationDetails ?? []).map((m: any, i: number) => (
                                <li key={m.item_id ?? `${rx.rx_id}-${i}`}>
                                  {m.name}
                                  {m.isAvailable
                                    ? " — in stock"
                                    : ` — out of stock (need ${m.quantity ?? "?"}, have ${m.available ?? 0})`}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No prescriptions awaiting dispensing</p>
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
                            <th className="text-left py-3 px-3 font-medium">Batch Number</th>
                            <th className="text-left py-3 px-3 font-medium">Available</th>
                            <th className="text-left py-3 px-3 font-medium">Expiry</th>
                            <th className="text-left py-3 px-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchesData.batches.map((batch: any) => (
                            <tr key={batch.batch_id} className="border-b hover:bg-muted">
                              <td className="py-3 px-3 font-medium">{batch.batch_number}</td>
                              <td className="py-3 px-3">{batch.quantity_available}</td>
                              <td className="py-3 px-3">
                                {batch.expiry_date
                                  ? new Date(batch.expiry_date).toLocaleDateString()
                                  : "—"}
                              </td>
                              <td className="py-3 px-3">
                                <Badge
                                  variant={batch.quantity_available > 0 ? "default" : "secondary"}
                                >
                                  {batch.quantity_available > 0 ? "In Stock" : "Depleted"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">No batches found</p>
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
                            <th className="text-left py-3 px-3 font-medium">Item</th>
                            <th className="text-left py-3 px-3 font-medium">Code</th>
                            <th className="text-left py-3 px-3 font-medium">Type</th>
                            <th className="text-left py-3 px-3 font-medium">Unit</th>
                            <th className="text-left py-3 px-3 font-medium">Reorder Level</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryData.items.map((item: any) => (
                            <tr key={item.item_id} className="border-b hover:bg-muted">
                              <td className="py-3 px-3 font-medium">{item.item_name}</td>
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
                    <p className="text-center py-8 text-muted-foreground">No items found</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </RouteGuard>
  );
}

// ─── Dispense Card Component ─────────────────────────────────────────────────

function DispenseCard({ prescription, onSuccess }: { prescription: any; onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: dispensePrescriptionMedications,
    onSuccess: (res: any) => {
      setIsOpen(false);
      onSuccess();
      // A partial dispense used to close the dialog silently, so a pharmacist
      // could hand over 2 of 3 medications believing all three were done.
      const failed = res?.failedCount ?? 0;
      if (failed > 0) {
        toast.warning(`${res?.dispensedCount ?? 0} dispensed, ${failed} failed`, {
          description: (res?.errors ?? []).join("; ") || "Check stock for the remaining items.",
        });
      } else {
        toast.success(`Dispensed ${res?.dispensedCount ?? ""}`.trim());
      }
    },
    onError: (err: unknown) =>
      toast.error("Dispense failed", {
        description: err instanceof Error ? err.message : String(err),
      }),
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
      <div className="border rounded-lg p-4 bg-white hover:bg-primary/10 transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-foreground">Prescription {prescription.rx_id}</h3>
              {prescription.allMedicationsAvailable && (
                <Badge className="bg-success/10 text-success">All in stock</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Patient: {prescription.patient_did}</p>
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
        <div className="space-y-2 bg-muted p-3 rounded">
          {prescription.medicationDetails?.map((med: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <span className="text-foreground">
                {med.name} x{med.quantity}
              </span>
              <Badge
                variant={med.isAvailable ? "outline" : "destructive"}
                className={
                  med.isAvailable
                    ? "bg-success/10 text-success border-success/30"
                    : "bg-destructive/10 text-destructive"
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
            <div key={idx} className="flex justify-between items-center p-3 border rounded-lg">
              <span className="font-medium">{med.name}</span>
              <span className="text-sm text-muted-foreground">x{med.quantity}</span>
            </div>
          ))}
        </div>

        <Button onClick={handleDispense} disabled={mutation.isPending} className="w-full">
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

  const { data: items } = useQuery({
    queryKey: ["items-receive"],
    queryFn: () => getInventoryItems({ data: { limit: 100 } }),
  });

  // Batches for the chosen item. The form previously held `batchNumber` state
  // with NO input rendered for it, so it always submitted batchId: "" and
  // addStock's validator threw "batchId is required" — every single time, with
  // no onError to surface it. "Receive Stock" was a button that did nothing.
  const { data: batches } = useQuery({
    queryKey: ["batches-receive", itemId],
    queryFn: () => getBatches({ data: { itemId, limit: 100 } }),
    enabled: Boolean(itemId),
  });

  const mutation = useMutation({
    mutationFn: addStock,
    onSuccess: () => {
      setItemId("");
      setBatchNumber("");
      setQuantity("");
      onSuccess();
      toast.success("Stock received");
    },
    // Without this every failure was silent — the button simply stopped
    // spinning and nothing changed.
    onError: (err: unknown) =>
      toast.error("Could not receive stock", {
        description: err instanceof Error ? err.message : String(err),
      }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !batchNumber) {
      toast.error("Choose an item and a batch");
      return;
    }
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
        <label className="text-sm font-medium">Batch *</label>
        <Select value={batchNumber} onValueChange={setBatchNumber} disabled={!itemId}>
          <SelectTrigger>
            <SelectValue placeholder={itemId ? "Select batch" : "Choose an item first"} />
          </SelectTrigger>
          <SelectContent>
            {(batches?.batches ?? []).map((b: any) => (
              <SelectItem key={b.batch_id} value={b.batch_id}>
                {b.batch_number}
                {b.expiry_date ? ` · expires ${b.expiry_date}` : ""} · {b.quantity_available} left
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
  const [operation, setOperation] = useState<"transfer" | "consume" | "waste">("consume");
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
    removeStockMutation.isPending || consumeStockMutation.isPending || wasteStockMutation.isPending;

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
        <div className="text-center py-8 text-muted-foreground">
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
              <tr key={mov.movement_id} className="border-b hover:bg-muted">
                <td className="py-3 px-3 font-mono text-xs">{mov.movement_id}</td>
                <td className="py-3 px-3">
                  <Badge variant="outline">{mov.movement_type}</Badge>
                </td>
                <td className="py-3 px-3 font-medium">{mov.quantity_moved}</td>
                <td className="py-3 px-3 text-muted-foreground">{mov.quantity_before}</td>
                <td className="py-3 px-3 text-muted-foreground">{mov.quantity_after}</td>
                <td className="py-3 px-3 text-xs text-muted-foreground">
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
