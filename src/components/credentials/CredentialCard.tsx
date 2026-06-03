import { motion } from "framer-motion";
import { ShieldCheck, ShieldX, Calendar, Building2 } from "lucide-react";

export type CredStatus = "active" | "expired" | "revoked" | "suspended";

interface CredentialCardProps {
  id: string;
  type: string;
  issuer: string;
  holder?: string;
  issuedAt: string;
  expiresAt: string;
  status: CredStatus;
  onClick?: () => void;
}

const statusConfig: Record<CredStatus, { label: string; className: string; icon: typeof ShieldCheck }> = {
  active: { label: "Verified", className: "bg-success/15 text-success", icon: ShieldCheck },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground", icon: ShieldX },
  revoked: { label: "Revoked", className: "bg-destructive/15 text-destructive", icon: ShieldX },
  suspended: { label: "Suspended", className: "bg-warning/15 text-warning-foreground", icon: ShieldX },
};

export function CredentialCard({ id, type, issuer, holder, issuedAt, expiresAt, status, onClick }: CredentialCardProps) {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className={`group rounded-xl border border-border bg-card p-4 shadow-clinical transition-shadow hover:shadow-clinical-md ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{type}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{issuer}</span>
          </div>
          {holder && <div className="mt-0.5 text-xs text-muted-foreground">Holder: {holder}</div>}
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0 ${cfg.className}`}>
          <Icon className="h-3 w-3" />
          {cfg.label}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Issued {issuedAt}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Expires {expiresAt}</span>
        </div>
      </div>

      <div className="mt-2 font-mono text-[10px] text-muted-foreground/60">{id}</div>
    </motion.div>
  );
}
