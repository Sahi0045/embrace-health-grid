import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/50 px-8 py-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "destructive";
}) {
  const toneClass = {
    default: "text-primary bg-gradient-to-br from-primary/15 to-primary/5",
    success: "text-success bg-gradient-to-br from-success/15 to-success/5",
    warning: "text-warning-foreground bg-gradient-to-br from-warning/20 to-warning/5",
    destructive: "text-destructive bg-gradient-to-br from-destructive/15 to-destructive/5",
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-clinical transition-all duration-300 hover:-translate-y-0.5 hover:shadow-clinical-md">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {Icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">{value}</div>
      {delta && (
        <div
          className={`mt-1 text-xs font-medium ${
            delta.startsWith("+") || delta.startsWith("↑")
              ? "text-success"
              : delta.startsWith("-") || delta.startsWith("↓")
                ? "text-destructive"
                : "text-muted-foreground"
          }`}
        >
          {delta}
        </div>
      )}
    </div>
  );
}
