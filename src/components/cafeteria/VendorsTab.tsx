import { motion } from "framer-motion";
import {
  Building2,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Star,
  Package,
  MapPin,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import type { CafeteriaVendor, ContractStatus } from "@/lib/types";

interface VendorsTabProps {
  vendors: CafeteriaVendor[];
  onUpdateStatus: (vendorId: string, nextStatus: ContractStatus) => void;
}

const CONTRACT_CONFIGS: Record<ContractStatus, { label: string; color: string; border: string }> = {
  active: { label: "Active Contract", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20" },
  pending: { label: "Pending Renewal", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
  expired: { label: "Contract Expired", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400", border: "border-rose-500/20" },
  terminated: { label: "Terminated", color: "bg-muted text-muted-foreground", border: "border-border/60" },
};

export function VendorsTab({
  vendors,
  onUpdateStatus,
}: VendorsTabProps) {
  if (vendors.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No Cafeteria Vendors Registered"
        description="There are currently no food or beverage ingredient vendors in the procurement directory."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
      {vendors.map((vendor) => {
        const statusConfig = CONTRACT_CONFIGS[vendor.contract_status] || CONTRACT_CONFIGS.active;
        const isExpiringSoon = vendor.contract_expiry
          ? new Date(vendor.contract_expiry).getTime() - Date.now() < 30 * 24 * 3600 * 1000
          : false;

        return (
          <GlowCard
            key={vendor.vendor_id}
            accent={vendor.contract_status === "active" ? "primary" : "warning"}
            className="p-5 flex flex-col justify-between h-full bg-card border border-border/80 rounded-2xl shadow-clinical-xs transition-all hover:border-primary/40"
          >
            {/* Header: Name + Rating + Status */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/60">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-foreground tracking-tight line-clamp-1">
                    {vendor.name}
                  </h4>
                </div>
                {vendor.contact_person && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Rep: <span className="font-semibold text-foreground">{vendor.contact_person}</span>
                  </p>
                )}
              </div>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${statusConfig.color} ${statusConfig.border}`}
              >
                {statusConfig.label}
              </span>
            </div>

            {/* Middle: Supplied Categories & Contact Info */}
            <div className="my-3 space-y-3 flex-1">
              {/* Supplied categories tags */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Supplied Categories
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {vendor.supplied_categories.map((cat, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-muted text-foreground border border-border/60"
                    >
                      📦 {cat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Contact information details */}
              <div className="space-y-1.5 pt-1 text-xs text-muted-foreground">
                {vendor.contact_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{vendor.contact_email}</span>
                  </div>
                )}
                {vendor.contact_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{vendor.contact_phone}</span>
                  </div>
                )}
                {vendor.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{vendor.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer: Contract Expiry & Actions */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs">
              <div className="text-[11px] text-muted-foreground">
                {vendor.contract_expiry ? (
                  <span className={isExpiringSoon ? "text-amber-500 font-bold" : ""}>
                    Expiry: {vendor.contract_expiry}
                  </span>
                ) : (
                  <span>Perpetual Contract</span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {vendor.contract_status === "active" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onUpdateStatus(vendor.vendor_id, "pending")}
                    className="h-7 px-2 text-[10px] font-bold rounded-lg border-amber-500/30 text-amber-600 hover:bg-amber-500/10 cursor-pointer"
                  >
                    Flag Renewal
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onUpdateStatus(vendor.vendor_id, "active")}
                    className="h-7 px-2 text-[10px] font-bold rounded-lg border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                  >
                    Renew
                  </Button>
                )}
              </div>
            </div>
          </GlowCard>
        );
      })}
    </div>
  );
}
