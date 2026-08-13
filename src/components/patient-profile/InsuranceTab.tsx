import { Shield, FileText, Calendar, DollarSign, CheckCircle2, AlertCircle } from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";

interface InsuranceTabProps {
  insurancePolicy: any;
  insuranceClaims: any[];
}

export function InsuranceTab({ insurancePolicy, insuranceClaims }: InsuranceTabProps) {
  return (
    <div className="space-y-6">
      {/* Primary Policy Banner */}
      {insurancePolicy ? (
        <GlowCard className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-lg text-foreground tracking-tight">
                  {insurancePolicy.provider || "Primary Health Insurance"}
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Policy #: <strong className="text-foreground font-mono">{insurancePolicy.policy_number || "POL-109283"}</strong>
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/15 px-3 py-1 text-[10px] font-extrabold text-success uppercase tracking-wider">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Active Policy
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-background/60 p-4 rounded-xl border border-border/60 text-xs">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Coverage Rate
              </span>
              <span className="text-lg font-extrabold font-display text-success mt-0.5 block">
                {insurancePolicy.coverage_percentage || 80}%
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Co-Pay
              </span>
              <span className="text-lg font-extrabold font-display text-foreground mt-0.5 block">
                ${insurancePolicy.copay || 25}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Deductible Met
              </span>
              <span className="text-lg font-extrabold font-display text-foreground mt-0.5 block">
                ${insurancePolicy.deductible_met || 500} / ${insurancePolicy.deductible || 1000}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Out-of-Pocket Met
              </span>
              <span className="text-lg font-extrabold font-display text-foreground mt-0.5 block">
                ${insurancePolicy.out_of_pocket_met || 1200} / ${insurancePolicy.out_of_pocket_max || 3000}
              </span>
            </div>
          </div>
        </GlowCard>
      ) : (
        <EmptyState
          icon={Shield}
          title="No Active Insurance Policy"
          description="No primary insurance policy details found on file for this patient."
        />
      )}

      {/* Claims List */}
      <div className="space-y-4">
        <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Insurance Claims History ({insuranceClaims?.length || 0})
        </div>

        {!insuranceClaims || insuranceClaims.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Claims Submitted"
            description="No insurance claims submitted for treatments or hospital stays."
          />
        ) : (
          <div className="space-y-3">
            {insuranceClaims.map((claim) => (
              <GlowCard key={claim.claim_id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="font-display font-extrabold text-sm text-foreground">
                      Claim #{claim.claim_id.slice(-6).toUpperCase()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {claim.description || "General Medical Claim"} • Submitted {claim.submitted_at ? new Date(claim.submitted_at).toLocaleDateString() : "N/A"}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-base font-extrabold font-display text-foreground">
                    ${Number(claim.amount || 0).toLocaleString()}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase">
                    {claim.status || "Submitted"}
                  </span>
                </div>
              </GlowCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
