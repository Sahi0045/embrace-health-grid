import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, FlaskConical, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { orderLabTestDirect } from "@/lib/api";

interface CreateLabOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const COMMON_TESTS = [
  {
    name: "Complete Blood Count (CBC) with Diff",
    category: "hematology",
    specimen: "Whole Blood (EDTA)",
  },
  {
    name: "Comprehensive Metabolic Panel (CMP)",
    category: "biochemistry",
    specimen: "Serum (SST)",
  },
  {
    name: "High-Sensitivity Troponin-I & CK-MB",
    category: "biochemistry",
    specimen: "Serum (Heparin)",
  },
  {
    name: "Arterial Blood Gas (ABG) & Lactate",
    category: "biochemistry",
    specimen: "Heparinized Blood",
  },
  {
    name: "Blood Culture & Sensitivity",
    category: "microbiology",
    specimen: "Blood Culture Bottles",
  },
  { name: "Lipid Profile (Total, HDL, LDL, Trig)", category: "biochemistry", specimen: "Serum" },
  { name: "HbA1c Glycated Hemoglobin", category: "biochemistry", specimen: "Whole Blood" },
  {
    name: "Coagulation Panel (PT/INR & APTT)",
    category: "hematology",
    specimen: "Sodium Citrate Tube",
  },
];

export function CreateLabOrderDialog({ open, onOpenChange, onSuccess }: CreateLabOrderDialogProps) {
  const [patientDid, setPatientDid] = useState("did:health:pat-001");
  const [patientName, setPatientName] = useState("Sarah Jenkins");
  const [patientMrn, setPatientMrn] = useState("MRN-88421");
  const [selectedTest, setSelectedTest] = useState(COMMON_TESTS[0].name);
  const [testCategory, setTestCategory] = useState(COMMON_TESTS[0].category);
  const [specimenType, setSpecimenType] = useState(COMMON_TESTS[0].specimen);
  const [priority, setPriority] = useState<"stat" | "urgent" | "routine">("routine");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleTestSelect = (name: string) => {
    setSelectedTest(name);
    const found = COMMON_TESTS.find((t) => t.name === name);
    if (found) {
      setTestCategory(found.category);
      setSpecimenType(found.specimen);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTest.trim()) {
      toast.error("Please select a valid test");
      return;
    }

    setSubmitting(true);
    try {
      await orderLabTestDirect({
        patientDid,
        patientName,
        patientMrn,
        testName: selectedTest,
        testCategory,
        priority,
        clinicalNotes,
        specimenType,
      });

      toast.success("Lab order requisitions created", {
        description: `Order dispatched for ${patientName} (${priority.toUpperCase()})`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error("Failed to create lab order", {
        description: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

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
                  New Diagnostic Test Order
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Dispatch laboratory requisition & specimen collection order
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
            {/* Patient selector */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                  Patient Name
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  required
                  className="w-full rounded-xl bg-background border border-border/80 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/40 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                  Patient MRN
                </label>
                <input
                  type="text"
                  value={patientMrn}
                  onChange={(e) => setPatientMrn(e.target.value)}
                  required
                  className="w-full rounded-xl bg-background border border-border/80 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/40 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Test Selection */}
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                Select Clinical Panel / Test
              </label>
              <select
                value={selectedTest}
                onChange={(e) => handleTestSelect(e.target.value)}
                className="w-full rounded-xl bg-background border border-border/80 px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary/40 focus:outline-none cursor-pointer"
              >
                {COMMON_TESTS.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.category.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Priority & Specimen */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full rounded-xl bg-background border border-border/80 px-3 py-2 text-xs font-extrabold focus:ring-2 focus:ring-primary/40 focus:outline-none cursor-pointer"
                >
                  <option value="routine">Routine (Standard Queue)</option>
                  <option value="urgent">Urgent (&lt; 2h TAT)</option>
                  <option value="stat">STAT (Immediate Critical)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                  Specimen Type
                </label>
                <input
                  type="text"
                  value={specimenType}
                  onChange={(e) => setSpecimenType(e.target.value)}
                  className="w-full rounded-xl bg-background border border-border/80 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/40 focus:outline-none"
                />
              </div>
            </div>

            {/* Clinical Indications */}
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                Clinical Indications / Symptoms
              </label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="e.g. Chest pain, rule out acute coronary syndrome or sepsis..."
                rows={2}
                className="w-full rounded-xl bg-background border border-border/80 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/40 focus:outline-none resize-none"
              />
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
                {submitting ? "Submitting..." : "Issue Requisition"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
