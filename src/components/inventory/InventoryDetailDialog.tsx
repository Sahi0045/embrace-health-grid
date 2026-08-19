import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Clock,
  MapPin,
  Building2,
  Calendar,
  AlertTriangle,
  Layers,
  Save,
  CheckCircle2,
  History,
  ShieldCheck,
  CircleDollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getStockMovements, recordStockMovement, updateItemReorderSettings } from "@/lib/api";
import { StockMovementTimeline } from "./StockMovementTimeline";
import type { InventoryItem, InventoryCategory, StockMovement } from "@/lib/types";

export interface InventoryDetailDialogProps {
  item: InventoryItem | null;
  category?: InventoryCategory;
  onClose: () => void;
  onStockUpdated: () => void;
}

export function InventoryDetailDialog({
  item,
  category,
  onClose,
  onStockUpdated,
}: InventoryDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<"action" | "reorder" | "history">("action");

  // Stock Movement Action Form State
  const [movementType, setMovementType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN");
  const [quantity, setQuantity] = useState<number>(10);
  const [reason, setReason] = useState<string>("");
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Reorder Settings Form State
  const [reorderLevel, setReorderLevel] = useState<number>(item?.reorder_level || 10);
  const [reorderQty, setReorderQty] = useState<number>(item?.reorder_qty || 50);
  const [storageLocation, setStorageLocation] = useState<string>(item?.storage_location || "");
  const [supplier, setSupplier] = useState<string>(item?.supplier || "");
  const [unitCost, setUnitCost] = useState<number>(item?.unit_cost || 0);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // Movement History State
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Sync state when item changes
  useEffect(() => {
    if (item) {
      setReorderLevel(item.reorder_level || 10);
      setReorderQty(item.reorder_qty || 50);
      setStorageLocation(item.storage_location || "");
      setSupplier(item.supplier || "");
      setUnitCost(item.unit_cost || 0);
      setReason("");
      setQuantity(10);
      loadHistory(item.item_id);
    }
  }, [item]);

  const loadHistory = useCallback(async (itemId: string) => {
    setLoadingHistory(true);
    try {
      const res = await getStockMovements(itemId);
      setMovements(res.movements || []);
    } catch {
      setMovements([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  if (!item) return null;

  const availableStock = Math.max(0, item.current_stock - item.reserved_stock);
  const totalValuation = (Number(item.current_stock) || 0) * (Number(item.unit_cost) || 0);

  // Handle Record Movement
  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || quantity <= 0) {
      toast.error("Please enter a valid quantity greater than 0");
      return;
    }

    setSubmittingAction(true);
    try {
      await recordStockMovement({
        itemId: item.item_id,
        movementType,
        quantity: Number(quantity),
        reason: reason.trim() || `Manual stock ${movementType} recorded`,
      });

      toast.success(
        `Successfully recorded ${movementType} transaction of ${quantity} ${item.unit}`,
      );
      setReason("");
      onStockUpdated();
      await loadHistory(item.item_id);
    } catch (err: any) {
      toast.error(err.message || "Failed to record stock movement");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Save Reorder Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await updateItemReorderSettings({
        itemId: item.item_id,
        reorderLevel: Number(reorderLevel),
        reorderQty: Number(reorderQty),
        storageLocation: storageLocation.trim(),
        supplier: supplier.trim(),
        unitCost: Number(unitCost),
      });

      toast.success("Inventory reorder parameters updated");
      onStockUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to update reorder settings");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-foreground/40 backdrop-blur-md"
        />

        {/* Centered Modal Card Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="relative w-full max-w-2xl rounded-3xl border border-border/80 bg-card p-6 sm:p-7 shadow-clinical-xl z-10 space-y-6 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-border/60">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-xs">
                <Package className="h-6 w-6" />
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase"
                    style={{
                      borderColor: `${category?.color_code || "#3b82f6"}40`,
                      backgroundColor: `${category?.color_code || "#3b82f6"}10`,
                      color: category?.color_code || "var(--color-primary)",
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: category?.color_code || "#3b82f6" }}
                    />
                    {category?.name || item.category_id}
                  </span>

                  <span className="font-mono text-[11px] font-bold text-muted-foreground bg-muted/60 rounded-md px-2 py-0.5">
                    {item.sku}
                  </span>
                </div>

                <h2 className="font-display font-extrabold text-lg sm:text-xl text-foreground tracking-tight line-clamp-1">
                  {item.name}
                </h2>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-xl p-2 hover:bg-muted text-muted-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Metric Summary Cells */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border/80 bg-background/80 p-3.5 text-center">
              <div className="text-xl font-extrabold font-display text-primary">
                {item.current_stock}
              </div>
              <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mt-0.5">
                Current Stock ({item.unit})
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/80 p-3.5 text-center">
              <div className="text-xl font-extrabold font-display text-success">
                {availableStock}
              </div>
              <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mt-0.5">
                Available Stock
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/80 p-3.5 text-center">
              <div className="text-xl font-extrabold font-display text-foreground">
                ${totalValuation.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mt-0.5">
                Valuation ($)
              </div>
            </div>
          </div>

          {/* Tabs Switcher */}
          <div className="flex items-center gap-1.5 border-b border-border/60 pb-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("action")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === "action"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Stock Operations
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("reorder")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === "reorder"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              Reorder Settings
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === "history"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Movement Log ({movements.length})
            </button>
          </div>

          {/* Tab 1: Stock Movement Action */}
          {activeTab === "action" && (
            <form onSubmit={handleRecordMovement} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-foreground uppercase tracking-wider">
                  Select Transaction Type
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMovementType("IN")}
                    className={`flex items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                      movementType === "IN"
                        ? "bg-success/15 border-success text-success ring-2 ring-success/20 shadow-xs"
                        : "border-border/80 bg-background text-muted-foreground hover:border-border"
                    }`}
                  >
                    <ArrowDownLeft className="h-4 w-4" />
                    Receive (IN)
                  </button>

                  <button
                    type="button"
                    onClick={() => setMovementType("OUT")}
                    className={`flex items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                      movementType === "OUT"
                        ? "bg-destructive/15 border-destructive text-destructive ring-2 ring-destructive/20 shadow-xs"
                        : "border-border/80 bg-background text-muted-foreground hover:border-border"
                    }`}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Dispatch (OUT)
                  </button>

                  <button
                    type="button"
                    onClick={() => setMovementType("ADJUSTMENT")}
                    className={`flex items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                      movementType === "ADJUSTMENT"
                        ? "bg-primary/15 border-primary text-primary ring-2 ring-primary/20 shadow-xs"
                        : "border-border/80 bg-background text-muted-foreground hover:border-border"
                    }`}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Adjust
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Quantity ({item.unit})
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="rounded-xl bg-background border-border/80 text-xs font-mono font-bold h-10"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Projected Stock After
                  </label>
                  <div className="flex items-center h-10 px-3 rounded-xl bg-muted/40 border border-border/60 text-xs font-mono font-extrabold text-foreground">
                    {movementType === "IN"
                      ? item.current_stock + quantity
                      : movementType === "OUT"
                        ? Math.max(0, item.current_stock - quantity)
                        : item.current_stock + quantity}{" "}
                    {item.unit}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">
                  Reason / Department Notes
                </label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Ward transfer, OR replenishment batch, emergency restock..."
                  className="rounded-xl bg-background border-border/80 text-xs h-10"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 rounded-xl h-10 text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingAction}
                  className="flex-1 bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold rounded-xl shadow-clinical-md shadow-primary/25 text-xs h-10 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {submittingAction ? "Processing..." : `Confirm ${movementType} Transaction`}
                </Button>
              </div>
            </form>
          )}

          {/* Tab 2: Reorder Configuration */}
          {activeTab === "reorder" && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Reorder Threshold ({item.unit})
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(parseInt(e.target.value) || 0)}
                    className="rounded-xl bg-background border-border/80 text-xs font-mono font-bold h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Default Reorder Batch Qty
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={reorderQty}
                    onChange={(e) => setReorderQty(parseInt(e.target.value) || 1)}
                    className="rounded-xl bg-background border-border/80 text-xs font-mono font-bold h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Storage Location / Bay
                  </label>
                  <Input
                    value={storageLocation}
                    onChange={(e) => setStorageLocation(e.target.value)}
                    placeholder="e.g. Cold Storage Bay A1"
                    className="rounded-xl bg-background border-border/80 text-xs h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Unit Cost ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={unitCost}
                    onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                    className="rounded-xl bg-background border-border/80 text-xs font-mono font-bold h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">
                  Primary Supply Partner
                </label>
                <Input
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Medtronic / Pfizer Hospital"
                  className="rounded-xl bg-background border-border/80 text-xs h-10"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 rounded-xl h-10 text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingSettings}
                  className="flex-1 bg-primary text-primary-foreground font-extrabold rounded-xl shadow-clinical-md text-xs h-10 cursor-pointer"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingSettings ? "Saving Settings..." : "Save Parameters"}
                </Button>
              </div>
            </form>
          )}

          {/* Tab 3: Movement Log */}
          {activeTab === "history" && (
            <div className="space-y-3">
              <StockMovementTimeline movements={movements} loading={loadingHistory} />
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
