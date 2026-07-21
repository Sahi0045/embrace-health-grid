import { motion } from "framer-motion";
import {
  Building2,
  ShieldCheck,
  Globe,
  Link2,
  Clock,
  ArrowRight,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { FederationNodeData } from "./FederationNode";

interface FederationHospitalCardProps {
  hospital: FederationNodeData;
  showActions?: boolean;
  onViewDetails?: (id: string) => void;
  onDisconnect?: (id: string) => void;
}

const statusConfig = {
  connected: {
    badge: "bg-success/10 text-success border-success/30",
    dot: "bg-success",
    icon: Wifi,
    label: "Connected",
  },
  pending: {
    badge: "bg-warning/10 text-warning-foreground border-warning/30",
    dot: "bg-warning animate-pulse",
    icon: Clock,
    label: "Pending",
  },
  disconnected: {
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
    icon: WifiOff,
    label: "Disconnected",
  },
};

const trustConfig = {
  full: "bg-success/10 text-success",
  partial: "bg-warning/10 text-warning-foreground",
  pending: "bg-muted text-muted-foreground",
};

export function FederationHospitalCard({
  hospital,
  showActions = true,
  onViewDetails,
  onDisconnect,
}: FederationHospitalCardProps) {
  const st = statusConfig[hospital.status];
  const StatusIcon = st.icon;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-clinical hover:shadow-clinical-md transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-sm font-bold">
            {hospital.name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{hospital.name}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3 shrink-0" />
              {hospital.city}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${st.badge}`}
          >
            <div className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${trustConfig[hospital.trust]}`}
          >
            {hospital.trust} trust
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted p-2">
          <div className="text-base font-bold text-foreground">
            {hospital.sharedCredentials.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">Credentials</div>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <div className="text-base font-bold text-foreground">
            {hospital.crossVerifications.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">Verifications</div>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <div className="text-base font-bold text-primary">{hospital.specialties.length}</div>
          <div className="text-[10px] text-muted-foreground">Specialties</div>
        </div>
      </div>

      {/* Specialties */}
      <div className="mt-3 flex flex-wrap gap-1">
        {hospital.specialties.slice(0, 3).map((s) => (
          <span
            key={s}
            className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
          >
            {s}
          </span>
        ))}
        {hospital.specialties.length > 3 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            +{hospital.specialties.length - 3}
          </span>
        )}
      </div>

      {/* Last sync */}
      {hospital.lastSync !== "—" && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Last sync: {hospital.lastSync}
        </div>
      )}

      {/* DID */}
      <div className="mt-2 font-mono text-[10px] text-muted-foreground/50 truncate">
        {hospital.did}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="mt-4 flex items-center gap-2 pt-3 border-t border-border">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(hospital.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              View Details <ArrowRight className="h-3 w-3" />
            </button>
          )}
          {onDisconnect && hospital.status === "connected" && (
            <button
              onClick={() => onDisconnect(hospital.id)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
