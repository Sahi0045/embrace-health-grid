import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, DollarSign, Scale, Calendar, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logFoodWastage } from "@/lib/api";
import type { FoodWastageReason } from "@/lib/types";

interface LogWastageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function LogWastageDialog({ open, onOpenChange, onSuccess }: LogWastageDialogProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [mealType, setMealType] = useState("lunch");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("3.5");
  const [unit, setUnit] = useState("kg");
  const [costImpact, setCostImpact] = useState("15.75");
  const [reason, setReason] = useState<FoodWastageReason>("overproduction");
  const [submitting, setSubmitting] = useState(false);

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const parsed = parseFloat(val) || 0;
    setCostImpact((parsed * 4.5).toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      toast.error("Please enter the wasted item name");
      return;
    }

    setSubmitting(true);
    try {
      const parsedQty = parseFloat(quantity) || 0;
      const parsedCost = parseFloat(costImpact) || 0;

      await logFoodWastage({
        date,
        mealType,
        itemName: itemName.trim(),
        quantityWasted: parsedQty,
        unit,
        costImpact: parsedCost,
        reason,
      });

      toast.success("Food wastage recorded", {
        description: `Logged ${parsedQty} ${unit} of ${itemName} (${reason}).`,
      });

      // Reset
      setItemName("");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to log food wastage", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 0.999, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-md bg-card border border-border/80 rounded-3xl shadow-clinical-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border/60 bg-rose-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-foreground">Log Food Wastage</h3>
                <p className="text-xs text-muted-foreground">
                  Record prep scrap, unconsumed trays, or spoilage
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Date & Meal Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Meal Period
                </label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                  <option value="prep_waste">Kitchen Prep Waste</option>
                </select>
              </div>
            </div>

            {/* Item Name */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Item / Dish Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Steamed Rice & Vegetable Medley"
                className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {/* Quantity & Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Quantity Wasted
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Unit</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="kg">kg (Kilograms)</option>
                  <option value="lbs">lbs (Pounds)</option>
                  <option value="liters">liters</option>
                  <option value="portions">portions</option>
                </select>
              </div>
            </div>

            {/* Cost Impact & Reason */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Cost Impact ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={costImpact}
                  onChange={(e) => setCostImpact(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Primary Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as FoodWastageReason)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="overproduction">Overproduction</option>
                  <option value="spoilage">Spoilage</option>
                  <option value="unconsumed_tray">Unconsumed Tray</option>
                  <option value="expired_stock">Expired Stock</option>
                  <option value="damaged">Damaged in Prep</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-xs"
              >
                {submitting ? "Logging..." : "Record Wastage"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
