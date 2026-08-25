import { AlertTriangle, Clock, User, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

export type EmergencyAccessEvent = {
  id: string;
  actor: string;
  // Nullable: who_role may be unset, and the justification lives in
  // metadata.reason and may be absent. Both were typed required and filled with
  // the constants "Clinical Staff" and "Emergency access".
  actorRole: string | null;
  reason: string | null;
  at: string;
  autoAudited: boolean;
};

interface EmergencyAccessCardProps {
  event: EmergencyAccessEvent;
}

export function EmergencyAccessCard({ event }: EmergencyAccessCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15">
        <ShieldAlert className="h-4 w-4 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">Break-Glass Access</span>
          {event.autoAudited && (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
              Auto-Audited
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span>{event.actor}</span>
          {event.actorRole && (
            <>
              <span>·</span>
              <span>{event.actorRole}</span>
            </>
          )}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {event.reason ?? "No reason recorded"}
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {event.at}
        </div>
      </div>
    </motion.div>
  );
}
