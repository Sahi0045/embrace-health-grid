import { motion } from "framer-motion";
import { Building2, ShieldCheck, Globe, Link2, Clock } from "lucide-react";

export interface FederationNodeData {
  id: string;
  name: string;
  did: string;
  city: string;
  trust: "full" | "partial" | "pending";
  status: "connected" | "pending" | "disconnected";
  sharedCredentials: number;
  crossVerifications: number;
  lastSync: string;
  specialties: string[];
}

interface FederationNodeProps {
  node: FederationNodeData;
  isSelected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
}

const trustConfig = {
  full: { label: "Full Trust", color: "text-success", ring: "ring-success/30", bg: "bg-success/10" },
  partial: { label: "Partial Trust", color: "text-warning-foreground", ring: "ring-warning/30", bg: "bg-warning/10" },
  pending: { label: "Pending", color: "text-muted-foreground", ring: "ring-border", bg: "bg-muted" },
};

const statusDot = {
  connected: "bg-success",
  pending: "bg-warning animate-pulse",
  disconnected: "bg-muted-foreground",
};

export function FederationNode({ node, isSelected, onClick, size = "md" }: FederationNodeProps) {
  const trust = trustConfig[node.trust];
  const isLg = size === "lg";

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`rounded-2xl border bg-card shadow-clinical transition-all ${isSelected ? "border-primary/50 ring-2 ring-primary/20" : "border-border hover:shadow-clinical-md"} ${onClick ? "cursor-pointer" : ""} ${isLg ? "p-6" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold ${isLg ? "h-12 w-12 text-sm" : "h-9 w-9 text-xs"}`}>
            {node.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div className={`font-semibold text-foreground ${isLg ? "text-base" : "text-sm"}`}>{node.name}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              {node.city}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className={`h-2 w-2 rounded-full ${statusDot[node.status]}`} />
          <span className={`text-[10px] font-semibold ${trust.color}`}>{trust.label}</span>
        </div>
      </div>

      {isLg && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted p-2.5">
            <div className="text-base font-bold text-foreground">{node.sharedCredentials}</div>
            <div className="text-[10px] text-muted-foreground">Shared Creds</div>
          </div>
          <div className="rounded-lg bg-muted p-2.5">
            <div className="text-base font-bold text-foreground">{node.crossVerifications}</div>
            <div className="text-[10px] text-muted-foreground">Cross Verif.</div>
          </div>
          <div className={`rounded-lg p-2.5 ${trust.bg}`}>
            <div className={`text-base font-bold ${trust.color} capitalize`}>{node.trust}</div>
            <div className="text-[10px] text-muted-foreground">Trust Level</div>
          </div>
        </div>
      )}

      {!isLg && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            <span>{node.sharedCredentials} creds</span>
          </div>
          <div className="flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            <span>{node.crossVerifications} verif.</span>
          </div>
        </div>
      )}

      {isLg && node.specialties.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {node.specialties.slice(0, 4).map(s => (
            <span key={s} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{s}</span>
          ))}
        </div>
      )}

      {isLg && node.lastSync !== "—" && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Last sync: {node.lastSync}
        </div>
      )}

      <div className={`mt-2 font-mono text-[10px] text-muted-foreground/50 truncate ${!isLg && "mt-2"}`}>{node.did}</div>
    </motion.div>
  );
}
