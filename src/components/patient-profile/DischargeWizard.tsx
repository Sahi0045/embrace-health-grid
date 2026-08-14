import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Stethoscope,
  CreditCard,
  Pill,
  Calendar,
  FileText,
  AlertCircle,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { dischargePatient } from "@/lib/admissions.server";

interface DischargeWizardProps {
  isOpen: boolean;
  onClose: () => void;
  patientDid: string;
  patientName: string;
  activeAdmission: any;
  billing: any;
  insurancePolicy: any;
  prescriptions: any[];
  onDischargeSuccess: () => void;
}

export function DischargeWizard({
  isOpen,
  onClose,
  patientDid,
  patientName,
  activeAdmission,
  billing,
  insurancePolicy,
  prescriptions,
  onDischargeSuccess,
}: DischargeWizardProps) {
  const [step, setStep] = useState(1);
  const [summaryNote, setSummaryNote] = useState("");
  const [finalBillAmount, setFinalBillAmount] = useState<number>(
    billing?.outstanding ? Number(billing.outstanding) : 250,
  );
  const [followupDate, setFollowupDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !activeAdmission) return null;

  const handleConfirmDischarge = async () => {
    setSubmitting(true);
    try {
      await dischargePatient({
        data: {
          admissionId: activeAdmission.admission_id,
          dischargeSummary:
            summaryNote || "Standard discharge completed. Patient in stable condition.",
          finalBillAmount,
        },
      });

      toast.success("Patient successfully discharged!", {
        description: `Admission ${activeAdmission.admission_id} closed and bed released.`,
      });
      onDischargeSuccess();
      onClose();
    } catch (error: any) {
      toast.error("Failed to process discharge", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const STEPS = [
    { num: 1, label: "Treatment Summary", icon: Stethoscope },
    { num: 2, label: "Billing & Insurance", icon: CreditCard },
    { num: 3, label: "Medications", icon: Pill },
    { num: 4, label: "Final Review", icon: CheckCircle2 },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-foreground/40 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-clinical-xl z-10 space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                <LogOut className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display font-extrabold text-lg text-foreground tracking-tight">
                  Patient Discharge Flow
                </h2>
                <p className="text-xs font-medium text-muted-foreground">
                  Discharging <strong className="text-foreground">{patientName}</strong> • Ward{" "}
                  {activeAdmission.ward}, Room {activeAdmission.room}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-xl p-1.5 hover:bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Stepper Bar */}
          <div className="flex items-center justify-between relative px-2">
            <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-0.5 bg-border/60 -z-0" />
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isDone = s.num < step;
              const isCurrent = s.num === step;

              return (
                <div
                  key={s.num}
                  className="relative z-10 flex flex-col items-center gap-1.5 bg-card px-2"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-extrabold transition-all ${
                      isDone
                        ? "bg-success text-success-foreground"
                        : isCurrent
                          ? "bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground border border-border/80"
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : s.num}
                  </div>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider ${
                      isCurrent ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Step Contents */}
          <div className="py-2 min-h-[260px]">
            {step === 1 && (
              <div className="space-y-4">
                <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Step 1: Clinical & Treatment Summary
                </div>

                <div className="p-4 rounded-xl bg-background/80 border border-border/60 space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Admission ID:</span>
                    <span className="font-extrabold font-mono text-foreground">
                      {activeAdmission.admission_id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Admitted Date:</span>
                    <span className="font-bold text-foreground">
                      {activeAdmission.admitted_at
                        ? new Date(activeAdmission.admitted_at).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Admitting Physician:</span>
                    <span className="font-bold text-foreground">
                      {activeAdmission.admitting_doctor || "Staff Physician"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-foreground block">
                    Discharge Summary & Clinical Notes
                  </label>
                  <Textarea
                    value={summaryNote}
                    onChange={(e) => setSummaryNote(e.target.value)}
                    placeholder="Enter final clinical outcome, condition at discharge, and recovery advice..."
                    className="rounded-xl bg-background border border-border/80 text-xs min-h-[100px]"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Step 2: Settlement & Final Bill
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-background/80 border border-border/60 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                      Primary Insurance
                    </span>
                    <div className="font-extrabold text-foreground text-sm">
                      {insurancePolicy?.provider || "Self-Pay (No Insurance)"}
                    </div>
                    <span className="text-[11px] text-success font-bold block">
                      Coverage: {insurancePolicy?.coverage_percentage || 0}%
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-primary">
                      Current Outstanding
                    </span>
                    <div className="font-extrabold text-primary text-lg">
                      ${billing?.outstanding ? Number(billing.outstanding).toLocaleString() : "0"}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-foreground block">
                    Final Discharge Bill Amount ($)
                  </label>
                  <Input
                    type="number"
                    value={finalBillAmount}
                    onChange={(e) => setFinalBillAmount(Number(e.target.value))}
                    className="rounded-xl bg-background border border-border/80 text-xs h-10 font-bold"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This amount will be billed to the patient's account upon discharge completion.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Step 3: Discharge Medications Checklist
                </div>

                {prescriptions && prescriptions.length > 0 ? (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {prescriptions.map((rx) => (
                      <div
                        key={rx.rx_id}
                        className="p-3 rounded-xl bg-background/80 border border-border/60 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-foreground">
                            Rx #{rx.rx_id.slice(-6).toUpperCase()}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {rx.diagnosis || "Active Medication"}
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/30 px-2 py-0.5 text-[10px] font-extrabold text-success uppercase">
                          <CheckCircle2 className="h-3 w-3" />
                          Ready
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground space-y-1">
                    <Pill className="h-6 w-6 mx-auto text-muted-foreground/60" />
                    <p className="font-bold">No active prescriptions required for discharge.</p>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Step 4: Final Confirmation & Discharge
                </div>

                <div className="p-4 rounded-2xl border border-primary/30 bg-primary/5 space-y-3 text-xs">
                  <div className="flex items-center gap-2 font-bold text-foreground">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Discharge Governance Verification</span>
                  </div>
                  <ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
                    <li>
                      Room {activeAdmission.room}, Bed {activeAdmission.bed} will be marked as{" "}
                      <strong>Cleaning/Available</strong>.
                    </li>
                    <li>Discharge summary recorded on immutable audit log.</li>
                    <li>
                      Final bill of <strong>${finalBillAmount}</strong> processed.
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-foreground block">
                    Follow-up Appointment Date (Optional)
                  </label>
                  <Input
                    type="date"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    className="rounded-xl bg-background border border-border/80 text-xs h-10"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border/60">
            <Button
              variant="outline"
              onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
              className="rounded-xl h-10 text-xs font-bold"
            >
              {step > 1 ? (
                <>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </>
              ) : (
                "Cancel"
              )}
            </Button>

            {step < 4 ? (
              <Button
                onClick={() => setStep(step + 1)}
                className="bg-primary text-primary-foreground font-extrabold rounded-xl h-10 text-xs px-6 shadow-xs"
              >
                Next Step
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                disabled={submitting}
                onClick={handleConfirmDischarge}
                className="bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold rounded-xl h-10 text-xs px-6 shadow-clinical-md shadow-primary/25"
              >
                {submitting ? "Processing..." : "Complete & Execute Discharge"}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
