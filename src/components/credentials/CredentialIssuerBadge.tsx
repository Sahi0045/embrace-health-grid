import { ShieldCheck } from "lucide-react";

interface CredentialIssuerBadgeProps {
  issuer: string;
  did?: string;
  verified?: boolean;
}

export function CredentialIssuerBadge({ issuer, did, verified = true }: CredentialIssuerBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
        {issuer.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-foreground truncate">{issuer}</div>
        {did && <div className="font-mono text-[10px] text-muted-foreground truncate">{did}</div>}
      </div>
      {verified && (
        <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
      )}
    </div>
  );
}
