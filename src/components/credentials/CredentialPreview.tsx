import { motion } from "framer-motion";
import { ShieldCheck, Calendar, Building2, User } from "lucide-react";

interface CredentialPreviewProps {
  type: string;
  issuer: string;
  holder: string;
  issuedAt: string;
  expiresAt: string;
  status: "active" | "expired" | "revoked" | "suspended";
  credentialId: string;
  schema?: string;
  fields?: { label: string; value: string }[];
}

const statusStyles = {
  active: "from-success/20 to-success/5 border-success/30",
  expired: "from-muted/40 to-muted/20 border-border",
  revoked: "from-destructive/15 to-destructive/5 border-destructive/30",
  suspended: "from-warning/15 to-warning/5 border-warning/30",
};

export function CredentialPreview({
  type,
  issuer,
  holder,
  issuedAt,
  expiresAt,
  status,
  credentialId,
  schema,
  fields,
}: CredentialPreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-clinical-md ${statusStyles[status]}`}
    >
      {/* Watermark */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Verifiable Credential
          </div>
          <div className="mt-1 text-base font-bold text-foreground">{type}</div>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            status === "active"
              ? "bg-success/15 text-success border-success/30"
              : status === "revoked"
                ? "bg-destructive/15 text-destructive border-destructive/30"
                : "bg-muted text-muted-foreground border-border"
          }`}
        >
          <ShieldCheck className="h-3 w-3" />
          {status}
        </div>
      </div>

      {/* Core fields */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-background/40 p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <Building2 className="h-3 w-3" /> Issuer
          </div>
          <div className="font-semibold text-foreground">{issuer}</div>
        </div>
        <div className="rounded-lg bg-background/40 p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <User className="h-3 w-3" /> Holder
          </div>
          <div className="font-semibold text-foreground">{holder}</div>
        </div>
        <div className="rounded-lg bg-background/40 p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <Calendar className="h-3 w-3" /> Issued
          </div>
          <div className="font-semibold text-foreground">{issuedAt}</div>
        </div>
        <div className="rounded-lg bg-background/40 p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <Calendar className="h-3 w-3" /> Expires
          </div>
          <div className="font-semibold text-foreground">{expiresAt}</div>
        </div>
      </div>

      {/* Custom fields */}
      {fields && fields.length > 0 && (
        <div className="mt-3 rounded-lg bg-background/40 p-3 space-y-1.5">
          {fields.map((f) => (
            <div key={f.label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{f.label}</span>
              <span className="font-medium text-foreground">{f.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-border/50 space-y-1">
        {schema && <div className="text-[10px] text-muted-foreground/70">Schema: {schema}</div>}
        <div className="font-mono text-[10px] text-muted-foreground/60 truncate">
          {credentialId}
        </div>
      </div>
    </motion.div>
  );
}
