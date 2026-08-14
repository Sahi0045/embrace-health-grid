import {
  DollarSign,
  CreditCard,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";

interface PaymentsTabProps {
  billing: any;
  payments: any[];
}

export function PaymentsTab({ billing, payments }: PaymentsTabProps) {
  const outstanding = billing?.outstanding ? Number(billing.outstanding) : 0;
  const totalBilled = billing?.total_billed ? Number(billing.total_billed) : 0;
  const totalPaid = billing?.total_paid ? Number(billing.total_paid) : 0;

  return (
    <div className="space-y-6">
      {/* Billing Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-clinical space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Total Billed
          </span>
          <div className="text-2xl font-extrabold font-display text-foreground">
            ${totalBilled.toLocaleString()}
          </div>
          <span className="text-[11px] font-medium text-muted-foreground block">
            Lifetime hospital charges
          </span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-clinical space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Total Paid
          </span>
          <div className="text-2xl font-extrabold font-display text-success">
            ${totalPaid.toLocaleString()}
          </div>
          <span className="text-[11px] font-medium text-success flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Settled payments
          </span>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-clinical space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
            Outstanding Due
          </span>
          <div className="text-2xl font-extrabold font-display text-primary">
            ${outstanding.toLocaleString()}
          </div>
          <span className="text-[11px] font-medium text-primary flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Balance pending payment
          </span>
        </div>
      </div>

      {/* Payment History List */}
      <div className="space-y-4">
        <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Payment Transactions ({payments?.length || 0})
        </div>

        {!payments || payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No Payment History"
            description="No payments or billing transactions recorded for this patient."
          />
        ) : (
          <div className="space-y-3">
            {payments.map((p) => (
              <GlowCard key={p.payment_id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success shadow-xs">
                    <CreditCard className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="font-display font-extrabold text-sm text-foreground">
                      Payment #{p.payment_id.slice(-6).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>
                        Method:{" "}
                        <strong className="text-foreground capitalize">{p.method || "card"}</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {p.paid_at || p.created_at
                          ? new Date(p.paid_at || p.created_at).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-base font-extrabold font-display text-foreground">
                    +${Number(p.amount || 0).toLocaleString()}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/30 px-2 py-0.5 text-[10px] font-extrabold text-success uppercase">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {p.status || "Paid"}
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
