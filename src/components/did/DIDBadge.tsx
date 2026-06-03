import { ShieldCheck } from "lucide-react";

interface DIDBadgeProps {
  did: string;
  verified?: boolean;
  className?: string;
}

export function DIDBadge({ did, verified = true, className = "" }: DIDBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 ${className}`}>
      {verified && <ShieldCheck className="h-3 w-3 text-success shrink-0" />}
      <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[160px]">{did}</span>
    </div>
  );
}
