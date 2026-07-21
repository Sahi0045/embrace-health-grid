import { motion } from "framer-motion";
import { ShieldAlert, User, Clock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";

export interface BreakGlassRequest {
  id: string;
  requestedBy: string;
  requestorRole: string;
  patientName: string;
  patientMRN: string;
  reason: string;
  urgency: "critical" | "high" | "medium";
  requestedAt: string;
  status: "pending" | "approved" | "denied" | "expired";
  autoApproved?: boolean;
  approvedBy?: string;
}

interface BreakGlassRequestCardProps {
  request: BreakGlassRequest;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
}

const urgencyConfig = {
  critical: {
    badge: "bg-destructive/15 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
  high: { badge: "bg-warning/15 text-warning-foreground border-warning/30", dot: "bg-warning" },
  medium: { badge: "bg-primary/10 text-primary border-primary/20", dot: "bg-primary" },
};

const statusConfig = {
  pending: { label: "Awaiting Approval", color: "text-warning-foreground" },
  approved: { label: "Approved", color: "text-success" },
  denied: { label: "Denied", color: "text-destructive" },
  expired: { label: "Expired", color: "text-muted-foreground" },
};

export function BreakGlassRequestCard({ request, onApprove, onDeny }: BreakGlassRequestCardProps) {
  const [localStatus, setLocalStatus] = useState(request.status);
  const urg = urgencyConfig[request.urgency];
  const st = statusConfig[localStatus];

  const handleApprove = () => {
    setLocalStatus("approved");
    onApprove?.(request.id);
  };

  const handleDeny = () => {
    setLocalStatus("denied");
    onDeny?.(request.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 ${localStatus === "approved" ? "border-success/30 bg-success/5" : localStatus === "denied" ? "border-border bg-muted/30" : "border-destructive/25 bg-destructive/5"}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15">
          <ShieldAlert className="h-5 w-5 text-destructive" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">Break-Glass Request</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${urg.badge}`}
            >
              <div className={`h-1.5 w-1.5 rounded-full ${urg.dot}`} />
              {request.urgency}
            </span>
            <span className={`text-[10px] font-semibold ${st.color}`}>{st.label}</span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 shrink-0" />
              <span className="font-medium text-foreground">{request.requestedBy}</span> ·{" "}
              {request.requestorRole}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 shrink-0" />
              {request.requestedAt}
            </div>
          </div>

          <div className="mt-2 rounded-lg bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Patient:</span> {request.patientName} ·{" "}
            {request.patientMRN}
            <br />
            <span className="font-medium text-foreground">Reason:</span> {request.reason}
          </div>

          {request.autoApproved && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-warning-foreground">
              <AlertTriangle className="h-3 w-3" />
              Auto-approved due to critical emergency — full audit generated
            </div>
          )}

          {request.approvedBy && localStatus === "approved" && (
            <div className="mt-1 text-[11px] text-success">Approved by {request.approvedBy}</div>
          )}

          {localStatus === "pending" && (onApprove || onDeny) && (
            <div className="mt-3 flex gap-2">
              {onApprove && (
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-1.5 rounded-lg bg-success/15 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/25 transition-colors"
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Approve
                </button>
              )}
              {onDeny && (
                <button
                  onClick={handleDeny}
                  className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <XCircle className="h-3.5 w-3.5" /> Deny
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
