import { ShieldCheck, ShieldX, ShieldAlert } from "lucide-react";

interface DIDStatusChipProps {
  status: "active" | "revoked" | "suspended" | "pending";
  size?: "sm" | "md";
}

const config = {
  active: { label: "Active", icon: ShieldCheck, className: "bg-success/15 text-success border-success/30" },
  revoked: { label: "Revoked", icon: ShieldX, className: "bg-destructive/15 text-destructive border-destructive/30" },
  suspended: { label: "Suspended", icon: ShieldAlert, className: "bg-warning/15 text-warning-foreground border-warning/40" },
  pending: { label: "Pending", icon: ShieldAlert, className: "bg-muted text-muted-foreground border-border" },
};

export function DIDStatusChip({ status, size = "md" }: DIDStatusChipProps) {
  const cfg = config[status];
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium ${cfg.className} ${size === "sm" ? "text-[10px]" : "text-xs"}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}
