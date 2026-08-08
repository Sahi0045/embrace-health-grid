import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { InsuranceCard } from "@/components/insurance/InsuranceCard";
import { ClaimsCard } from "@/components/insurance/ClaimsCard";
import { useInsuranceClaims, useLivePatients } from "@/hooks/use-api";
import { useCurrentUser } from "@/lib/auth-context";
import { updateInsurancePolicy, createInsuranceClaim } from "@/lib/api";
import {
  ShieldCheck,
  FileText,
  TrendingUp,
  IndianRupee,
  Clock,
  PlusCircle,
  Edit3,
  X,
  Save,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/patient/insurance")({
  head: () => ({ meta: [{ title: "Insurance — Embrace Health Grid" }] }),
  component: InsurancePage,
});

const tabs = ["Overview", "Policies", "Claims"] as const;
type Tab = (typeof tabs)[number];

function InsurancePage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const { data: claimsData, refetch: refetchClaims } = useInsuranceClaims();
  const { patients, loading, refetch: refetchPatients } = useLivePatients();
  const { user: currentUser, refresh: refreshUser } = useCurrentUser();
  const patient: any = patients?.find((p: any) => p.email === currentUser?.email) || {
    insuranceProvider: currentUser?.insuranceProvider || "Star Health & Allied Insurance",
    insurancePolicyNo: currentUser?.insurancePolicyNo || "POL-2026-STAR-9942",
    sumInsured: currentUser?.sumInsured || 1000000,
    policyType: currentUser?.policyType || "Comprehensive Health Plan",
    validFrom: currentUser?.validFrom || "2025-04-01",
    validTo: currentUser?.validTo || "2026-03-31",
  };

  // Modals state
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);

  // Policy Form State
  const [provider, setProvider] = useState("Star Health & Allied Insurance");
  const [policyNo, setPolicyNo] = useState("POL-2026-STAR-9942");
  const [sumInsured, setSumInsured] = useState(1000000);
  const [policyType, setPolicyType] = useState("Comprehensive Health Plan");
  const [validFrom, setValidFrom] = useState("2025-04-01");
  const [validTo, setValidTo] = useState("2026-03-31");
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);

  // Claim Form State
  const [claimType, setClaimType] = useState("OPD Consultation & Diagnostic Reimbursement");
  const [claimAmount, setClaimAmount] = useState(12500);
  const [claimDiagnosis, setClaimDiagnosis] = useState("OPD Evaluation & Blood Investigation");
  const [claimDesc, setClaimDesc] = useState(
    "Filed reimbursement for consultation and diagnostic tests.",
  );
  const [isFilingClaim, setIsFilingClaim] = useState(false);

  const handleOpenPolicyModal = () => {
    setProvider(patient.insuranceProvider || "Star Health & Allied Insurance");
    setPolicyNo(patient.insurancePolicyNo || "POL-2026-STAR-9942");
    setSumInsured(patient.sumInsured || 1000000);
    setPolicyType(patient.policyType || "Comprehensive Health Plan");
    setValidFrom(patient.validFrom || "2025-04-01");
    setValidTo(patient.validTo || "2026-03-31");
    setIsPolicyModalOpen(true);
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPolicy(true);
    try {
      const res = await updateInsurancePolicy({
        insuranceProvider: provider,
        insurancePolicyNo: policyNo,
        sumInsured: Number(sumInsured),
        policyType,
        validFrom,
        validTo,
      });

      if (res.success && res.patient) {
        const updatedUser = {
          ...currentUser,
          insuranceProvider: provider,
          insurancePolicyNo: policyNo,
          sumInsured: Number(sumInsured),
          policyType,
          validFrom,
          validTo,
        };
        await refreshUser();

        toast.success("Insurance Policy Updated On-Chain!", {
          description: `${provider} (${policyNo}) linked to your health identity.`,
        });
        refetchPatients();
        setIsPolicyModalOpen(false);
      }
    } catch (err: any) {
      toast.error("Failed to update policy", { description: err.message });
    } finally {
      setIsSavingPolicy(false);
    }
  };

  const handleFileClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFilingClaim(true);
    try {
      const res = await createInsuranceClaim({
        patientDid: currentUser?.did || "did:hosp:0x4302bbea",
        provider: patient.insuranceProvider || "Star Health & Allied Insurance",
        policyNo: patient.insurancePolicyNo || "POL-2026-STAR-9942",
        claimType,
        amount: Number(claimAmount),
        diagnosis: claimDiagnosis,
        description: claimDesc,
      });

      if (res.claim) {
        toast.success("Insurance Claim Filed Successfully!", {
          description: `Claim ID: ${res.claim.claimId} (Amount: ₹${Number(claimAmount).toLocaleString("en-IN")}) is under review.`,
        });
        refetchClaims();
        setIsClaimModalOpen(false);
      }
    } catch (err: any) {
      toast.error("Failed to file claim", { description: err.message });
    } finally {
      setIsFilingClaim(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard requiredRole="patient">
        <PageHeader
          eyebrow="Patient app"
          title="Insurance"
          description="Your coverage, claims, and insurance credentials"
        />
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
          Loading insurance details…
        </div>
      </RouteGuard>
    );
  }

  const livePolicies = [
    {
      provider: patient.insuranceProvider || "Star Health & Allied Insurance",
      policyNo: patient.insurancePolicyNo || "POL-2026-STAR-9942",
      type: patient.policyType || "Comprehensive Health Plan",
      sumInsured: patient.sumInsured || 1000000,
      used: 145000,
      validFrom: patient.validFrom || "2025-04-01",
      validTo: patient.validTo || "2026-03-31",
      status: "active" as const,
    },
  ];

  const patientClaims = (claimsData?.claims ?? []).slice(0, 10);
  const activeClaims = patientClaims.filter(
    (c: any) => c.status === "pending" || c.status === "under-review",
  );
  const totalClaimed = patientClaims.reduce((s: number, c: any) => s + (c.amount || 0), 0);
  const totalApproved = patientClaims
    .filter((c: any) => c.approvedAmount)
    .reduce((s: number, c: any) => s + (c.approvedAmount ?? 0), 0);

  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Patient app"
        title="Insurance & Claims"
        description="Manage your active policies, sum insured, and cashless reimbursement claims"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenPolicyModal}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
            >
              <Edit3 className="h-4 w-4 text-primary" />
              Update Policy
            </button>
            <button
              onClick={() => setIsClaimModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <PlusCircle className="h-4 w-4" />
              File Claim
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-8 bg-card">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 space-y-6">
        {tab === "Overview" && (
          <StaggerList className="space-y-5">
            <StaggerItem>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Active Policies",
                    value: livePolicies.filter((p) => p.status === "active").length,
                    icon: ShieldCheck,
                    color: "text-success bg-success/10",
                  },
                  {
                    label: "Total Claimed",
                    value: `₹${(totalClaimed / 1000).toFixed(0)}K`,
                    icon: IndianRupee,
                    color: "text-primary bg-primary/10",
                  },
                  {
                    label: "Total Approved",
                    value: `₹${(totalApproved / 1000).toFixed(0)}K`,
                    icon: TrendingUp,
                    color: "text-chart-2 bg-chart-2/10",
                  },
                  {
                    label: "Pending Claims",
                    value: activeClaims.length,
                    icon: Clock,
                    color: "text-warning-foreground bg-warning/10",
                  },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.label}
                      className="rounded-xl border border-border bg-card p-4 shadow-clinical"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">
                          {s.label}
                        </div>
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.color}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="mt-3 text-2xl font-semibold text-foreground">{s.value}</div>
                    </div>
                  );
                })}
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground">Active Coverage</div>
                  <button
                    onClick={handleOpenPolicyModal}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    + Edit Policy Info
                  </button>
                </div>
                {livePolicies
                  .filter((p) => p.status === "active")
                  .map((p, i) => (
                    <InsuranceCard key={i} {...p} />
                  ))}
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    Recent Insurance Claims ({patientClaims.length})
                  </div>
                  <button
                    onClick={() => setIsClaimModalOpen(true)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    + File New Claim
                  </button>
                </div>
                <div className="space-y-3">
                  {patientClaims.slice(0, 5).map((c: any) => (
                    <ClaimsCard key={c.id} claim={c} />
                  ))}
                  {patientClaims.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                      No insurance claims filed yet
                    </div>
                  )}
                </div>
              </div>
            </StaggerItem>
          </StaggerList>
        )}

        {tab === "Policies" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="text-sm font-bold text-foreground">Linked Health Policies</div>
              <button
                onClick={handleOpenPolicyModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                <Edit3 className="h-3.5 w-3.5" /> Update Policy
              </button>
            </div>
            {livePolicies.map((p, i) => (
              <InsuranceCard key={i} {...p} />
            ))}
          </div>
        )}

        {tab === "Claims" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="text-sm font-bold text-foreground">Claims History Ledger</div>
              <button
                onClick={() => setIsClaimModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                <PlusCircle className="h-3.5 w-3.5" /> Submit Claim
              </button>
            </div>
            <div className="space-y-3">
              {patientClaims.map((c: any) => (
                <ClaimsCard key={c.id} claim={c} />
              ))}
              {patientClaims.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                  No claims submitted
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Update Policy Modal */}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border border-border bg-card p-6 shadow-clinical-md max-w-md w-full my-8 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-foreground">
                <ShieldCheck className="h-5 w-5 text-primary" /> Update Insurance Policy
              </div>
              <button
                onClick={() => setIsPolicyModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePolicy} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Insurance Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Star Health & Allied Insurance">
                    Star Health & Allied Insurance
                  </option>
                  <option value="HDFC ERGO Health Insurance">HDFC ERGO Health Insurance</option>
                  <option value="ICICI Lombard Health Shield">ICICI Lombard Health Shield</option>
                  <option value="Niva Bupa Health Insurance">Niva Bupa Health Insurance</option>
                  <option value="Care Health Insurance">Care Health Insurance</option>
                  <option value="Reliance General Insurance">Reliance General Insurance</option>
                  <option value="Embrace Health Network Cover">Embrace Health Network Cover</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Policy Number</label>
                <input
                  type="text"
                  required
                  value={policyNo}
                  onChange={(e) => setPolicyNo(e.target.value)}
                  placeholder="e.g. POL-2026-STAR-9942"
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Sum Insured (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={sumInsured}
                    onChange={(e) => setSumInsured(Number(e.target.value))}
                    placeholder="1000000"
                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Policy Plan Type
                  </label>
                  <select
                    value={policyType}
                    onChange={(e) => setPolicyType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Comprehensive Health Plan">Comprehensive Health Plan</option>
                    <option value="Family Floater Shield">Family Floater Shield</option>
                    <option value="Individual Critical Care">Individual Critical Care</option>
                    <option value="Senior Citizen Health Guard">Senior Citizen Health Guard</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Valid From</label>
                  <input
                    type="date"
                    required
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Valid Until</label>
                  <input
                    type="date"
                    required
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="flex-1 rounded-xl border border-border bg-card py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPolicy}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSavingPolicy ? "Linking..." : "Save & Link Policy"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Submit Claim Modal */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border border-border bg-card p-6 shadow-clinical-md max-w-md w-full my-8 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-foreground">
                <PlusCircle className="h-5 w-5 text-primary" /> File Insurance Claim
              </div>
              <button
                onClick={() => setIsClaimModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFileClaim} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Claim Category
                </label>
                <select
                  value={claimType}
                  onChange={(e) => setClaimType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="OPD Consultation & Diagnostic Reimbursement">
                    OPD Consultation & Diagnostic Reimbursement
                  </option>
                  <option value="Inpatient Hospitalization Cashless Claim">
                    Inpatient Hospitalization Cashless Claim
                  </option>
                  <option value="Pharmacy & Medication Reimbursement">
                    Pharmacy & Medication Reimbursement
                  </option>
                  <option value="Emergency Ambulance & Trauma Claim">
                    Emergency Ambulance & Trauma Claim
                  </option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Claim Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(Number(e.target.value))}
                  placeholder="e.g. 12500"
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Diagnosis / Clinical Reason
                </label>
                <input
                  type="text"
                  required
                  value={claimDiagnosis}
                  onChange={(e) => setClaimDiagnosis(e.target.value)}
                  placeholder="e.g. Acute Cardiac Evaluation & ECG Test"
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Additional Notes & Summary
                </label>
                <textarea
                  rows={2}
                  value={claimDesc}
                  onChange={(e) => setClaimDesc(e.target.value)}
                  placeholder="Provide any hospital bill details or diagnostic notes..."
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(false)}
                  className="flex-1 rounded-xl border border-border bg-card py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isFilingClaim}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isFilingClaim ? "Submitting..." : "Submit Claim On-Chain"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </RouteGuard>
  );
}
