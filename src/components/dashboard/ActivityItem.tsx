import { motion } from "framer-motion";
import type { ComponentType, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export interface ActivityItemProps {
  icon?: ComponentType<{ className?: string }>;
  severity?: "critical" | "warning" | "info" | "success";
  title: string;
  subtitle?: string;
  time?: string;
  badge?: ReactNode;
  isLast?: boolean;
}

export function ActivityItem({
  icon: Icon,
  severity = "info",
  title,
  subtitle,
  time,
  badge,
  isLast = false,
}: ActivityItemProps) {
  const dotColor = {
    critical: "bg-destructive animate-pulse shadow-destructive/50 shadow-sm",
    warning: "bg-warning shadow-warning/50 shadow-sm",
    info: "bg-primary",
    success: "bg-success",
  }[severity];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="relative flex items-start gap-3.5 group py-2.5"
    >
      {/* Timeline Connecting Line */}
      {!isLast && (
        <span
          className="absolute left-[17px] top-8 bottom-0 w-[2px] bg-border/60 group-hover:bg-primary/30 transition-colors"
          aria-hidden="true"
        />
      )}

      {/* Icon / Dot Container */}
      <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-card border border-border/80 shadow-clinical-sm group-hover:border-primary/40 group-hover:scale-105 transition-all">
        {Icon ? (
          <Icon className="h-4 w-4 text-foreground/80 group-hover:text-primary transition-colors" />
        ) : (
          <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
            {title}
          </p>
          {badge ? (
            typeof badge === "string" ? (
              <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                {badge}
              </Badge>
            ) : (
              badge
            )
          ) : null}
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {time && <span className="shrink-0 font-medium">{time}</span>}
        </div>
      </div>
    </motion.div>
  );
}
