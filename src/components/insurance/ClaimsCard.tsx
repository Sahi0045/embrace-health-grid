import type { InsuranceClaim } from "@/lib/types";
import { Clock, CheckCircle, XCircle, Eye } from "lucide-react";

interface ClaimsCardProps {
  claim: InsuranceClaim;
}

const statusConfig = {
  pending: { icon: Clock, badge: "bg-warning/10 text-warning-foreground" },
  approved: { icon: CheckCircle, badge: "bg-success/10 text-success" },
  rejected: { icon: XCircle, badge: "bg-destructive/10 text-destructive" },
  "under-review": { icon: Eye, badge: "bg-primary/10 text-primary" },
  paid: { icon: CheckCircle, badge: "bg-chart-2/10 text-chart-2" },
};

const typeLabels: Record<string, string> = {
  hospitalization: "Hospitalisation",
  outpatient: "Outpatient",
  surgery: "Surgery",
  pharmacy: "Pharmacy",
  lab: "Lab / Diagnostics",
};

export function ClaimsCard({ claim }: ClaimsCardProps) {
  const cfg = statusConfig[claim.status];
  const Icon = cfg.icon;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{claim.claimNo}</div>
          <div className="text-xs text-muted-foreground">{typeLabels[claim.claimType]} · {claim.insuranceProvider}</div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0 ${cfg.badge}`}>
          <Icon className="h-3 w-3" />
          {claim.status.replace("-", " ")}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div>
          <div className="text-[10px] uppercase tracking-wide opacity-70">Claimed</div>
          <div className="font-semibold text-foreground">₹{claim.amount.toLocaleString("en-IN")}</div>
        </div>
        {claim.approvedAmount && (
          <div>
            <div className="text-[10px] uppercase tracking-wide opacity-70">Approved</div>
            <div className="font-semibold text-success">₹{claim.approvedAmount.toLocaleString("en-IN")}</div>
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-muted-foreground">{claim.remarks}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">Submitted: {claim.submittedDate}{claim.processedDate ? ` · Processed: ${claim.processedDate}` : ""}</div>
    </div>
  );
}
