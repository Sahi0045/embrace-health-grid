import { motion } from "framer-motion";
import { ShieldAlert, User, Clock, AlertTriangle } from "lucide-react";

/**
 * One break-glass event, as recorded.
 *
 * This is a REVIEW surface, not an approval queue. Break-glass has no request
 * step: supabase/functions/break-glass either performs the access and writes
 * BREAK_GLASS_ACCESS, or refuses it and writes BREAK_GLASS_DENIED. By the time
 * a row reaches this card the PHI has already been read or already been
 * withheld, and audit_events is append-only.
 *
 * The card used to carry Approve and Deny buttons that flipped local component
 * state and nothing else. They could not have done more: nothing consults an
 * approval before returning records, so a button that reads as authorising
 * emergency PHI access while gating nothing is worse than no button.
 */
export interface BreakGlassRequest {
  id: string;
  requestedBy: string;
  // Nullable: audit_events carries no MRN and no urgency, and the reason lives
  // in metadata and may be absent. These were typed as required and filled with
  // constants ("Clinical Staff", "—", "Emergency access", urgency "critical" on
  // every row), which is what made a fabricated value the only possible render.
  requestorRole: string | null;
  patientName: string;
  patientMRN: string | null;
  reason: string | null;
  urgency: "critical" | "high" | "medium" | null;
  requestedAt: string;
  status: "pending" | "approved" | "denied" | "expired";
  autoApproved?: boolean;
  approvedBy?: string;
}

interface BreakGlassRequestCardProps {
  request: BreakGlassRequest;
}

const urgencyConfig = {
  critical: {
    badge: "bg-destructive/15 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
  high: { badge: "bg-warning/15 text-warning-foreground border-warning/30", dot: "bg-warning" },
  medium: { badge: "bg-primary/10 text-primary border-primary/20", dot: "bg-primary" },
};

// Each label states what the event was, not what someone might still do about it.
const statusConfig = {
  pending: { label: "Recorded", color: "text-muted-foreground" },
  approved: { label: "Access Granted", color: "text-success" },
  denied: { label: "Access Refused", color: "text-destructive" },
  expired: { label: "Expired", color: "text-muted-foreground" },
};

export function BreakGlassRequestCard({ request }: BreakGlassRequestCardProps) {
  const status = request.status;
  // Urgency is not recorded on an audit event. Render neutral rather than
  // reinstating the "critical" that used to be hardcoded for every row.
  const urg = request.urgency ? urgencyConfig[request.urgency] : null;
  const st = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 ${status === "approved" ? "border-success/30 bg-success/5" : status === "denied" ? "border-border bg-muted/30" : "border-destructive/25 bg-destructive/5"}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15">
          <ShieldAlert className="h-5 w-5 text-destructive" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">Break-Glass Access</span>
            {urg && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${urg.badge}`}
              >
                <div className={`h-1.5 w-1.5 rounded-full ${urg.dot}`} />
                {request.urgency}
              </span>
            )}
            <span className={`text-[10px] font-semibold ${st.color}`}>{st.label}</span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 shrink-0" />
              <span className="font-medium text-foreground">{request.requestedBy}</span>
              {request.requestorRole ? ` · ${request.requestorRole}` : ""}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 shrink-0" />
              {request.requestedAt}
            </div>
          </div>

          <div className="mt-2 rounded-lg bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Patient:</span> {request.patientName}
            {request.patientMRN ? ` · ${request.patientMRN}` : ""}
            <br />
            <span className="font-medium text-foreground">Reason:</span>{" "}
            {request.reason ?? "No reason recorded"}
          </div>

          {request.autoApproved && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-warning-foreground">
              <AlertTriangle className="h-3 w-3" />
              Granted without prior approval — this access is already recorded
            </div>
          )}

          {request.approvedBy && status === "approved" && (
            <div className="mt-1 text-[11px] text-success">Approved by {request.approvedBy}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
