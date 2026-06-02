import type { ReactNode } from "react";

/**
 * Full-width page wrapper — phone frame removed.
 * Kept as a thin wrapper so existing imports don't break.
 */
export function PhoneFrame({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {title && (
        <div className="sticky top-0 z-10 flex h-12 items-center justify-center border-b border-border bg-background/90 backdrop-blur text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
}
