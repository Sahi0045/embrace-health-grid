import type { ReactNode } from "react";

/** Mobile-frame wrapper for the patient app surface. */
export function PhoneFrame({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="mx-auto w-full max-w-[420px] px-4 py-8">
      <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-clinical-md">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3 text-[11px] font-medium text-muted-foreground">
          <span>9:41</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider">
            {title ?? "Patient app"}
          </span>
          <span>100%</span>
        </div>
        <div className="min-h-[600px] bg-background">{children}</div>
      </div>
    </div>
  );
}
