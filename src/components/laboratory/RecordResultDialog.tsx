import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FlaskConical, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { recordLabResult, updateLabOrderStatus } from "@/lib/api";
import type { LabOrderRecord } from "@/lib/types";

interface RecordResultDialogProps {
  order: LabOrderRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RecordResultDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: RecordResultDialogProps) {
  const [resultValue, setResultValue] = useState("");
  const [unit, setUnit] = useState("mg/dL");
  const [referenceRange, setReferenceRange] = useState("70 – 99 mg/dL");
  const [isCritical, setIsCritical] = useState(false);
  const [criticalFlag, setCriticalFlag] = useState<"high" | "low" | "critical_high" | "critical_low" | "panic" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    if (!resultValue.trim()) {
      toast.error("Please enter a valid result value");
      return;
    }

    setSubmitting(true);
    try {
      await recordLabResult({
        orderId: order.order_id,
        patientDid: order.patient_did,
        patientName: order.patient_name,
        patientMrn: order.patient_mrn,
        testName: order.test_name,
        category: order.test_category,
        resultValue,
        unit,
        referenceRange,
        isCritical,
        criticalFlag: isCritical ? (criticalFlag || "critical_high") : null,
      });

      // Complete order
      await updateLabOrderStatus({
        orderId: order.order_id,
        status: "completed",
      });

      toast.success(isCritical ? "CRITICAL panic result logged" : "Lab result verified & recorded", {
        description: `${order.test_name}: ${resultValue} ${unit}`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error("Failed to record result", {
        description: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !order) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 bg-foreground/40 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-clinical-xl z-10 space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                  Record Test Analytical Findings
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Order #{order.order_id} • {order.patient_name}
                </p>
              </div>
            </div>

            <button
              onClick={() => onOpenChange(false)}
              className="rounded-xl p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Test Context Display */}
            <div className="rounded-xl bg-background border border-border/70 p-3 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Clinical Test
              </span>
              <p className="font-display font-bold text-sm text-foreground">
                {order.test_name}
              </p>
              <p className="text-xs text-muted-foreground">
                Discipline: <span className="uppercase font-semibold text-primary">{order.test_category || "Biochemistry"}</span>
              </p>
            </div>

            {/* Finding Value & Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                  Observed Value
                </label>
                <input
                  type="text"
                  value={resultValue}
                  onChange={(e) => setResultValue(e.target.value)}
                  placeholder="e.g. 14.8 or Positive"
                  required
                  className="w-full rounded-xl bg-background border border-border/80 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/40 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                  Unit of Measurement
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. mg/dL, g/dL, ng/L"
                  className="w-full rounded-xl bg-background border border-border/80 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/40 focus:outline-none"
                />
              </div>
            </div>

            {/* Reference Range */}
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                Reference Normal Range
              </label>
              <input
                type="text"
                value={referenceRange}
                onChange={(e) => setReferenceRange(e.target.value)}
                placeholder="e.g. 70 – 99 mg/dL or Negative"
                className="w-full rounded-xl bg-background border border-border/80 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/40 focus:outline-none"
              />
            </div>

            {/* Critical Panic Toggle */}
            <div className="rounded-xl border border-border/80 bg-background/60 p-3.5 space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCritical}
                  onChange={(e) => setIsCritical(e.target.checked)}
                  className="h-4 w-4 rounded text-destructive focus:ring-destructive/40"
                />
                <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  Mark as Critical / Panic Value (Immediate Doctor Alert)
                </span>
              </label>

              {isCritical && (
                <div className="space-y-1 pl-6 pt-1">
                  <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                    Panic Severity Tier
                  </label>
                  <select
                    value={criticalFlag || "critical_high"}
                    onChange={(e) => setCriticalFlag(e.target.value as any)}
                    className="w-full rounded-lg bg-card border border-destructive/40 px-2.5 py-1.5 text-xs font-bold text-destructive focus:outline-none cursor-pointer"
                  >
                    <option value="critical_high">Critical High (Exceeds upper safety threshold)</option>
                    <option value="critical_low">Critical Low (Below viable lower threshold)</option>
                    <option value="panic">Severe Panic (Immediate life-threatening)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 rounded-xl h-10 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl h-10 bg-gradient-to-r from-primary to-blue-600 text-primary-foreground text-xs font-extrabold shadow-clinical-md shadow-primary/25"
              >
                {submitting ? "Signing & Saving..." : "Sign & Record Result"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
