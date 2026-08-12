import { motion } from "framer-motion";
import type { ComponentType, ReactNode } from "react";
import { Sparkline } from "./Sparkline";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface KpiTileProps {
  label: string;
  value: number | string;
  delta?: string;
  trend?: { value: string; isPositive?: boolean };
  icon?: ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "destructive";
  size?: "sm" | "md" | "lg";
  sparklineData?: number[];
  children?: ReactNode;
  className?: string;
}

export function KpiTile({
  label,
  value,
  delta,
  trend,
  icon: Icon,
  tone = "default",
  size = "md",
  sparklineData,
  children,
  className = "",
}: KpiTileProps) {
  const toneStyles = {
    default: {
      iconBg: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground",
      glowBorder: "group-hover:border-primary/40 dark:group-hover:border-primary/50",
      accentDot: "bg-primary",
      sparkTone: "primary" as const,
    },
    success: {
      iconBg: "bg-success/15 text-success dark:bg-success/25 dark:text-success",
      glowBorder: "group-hover:border-success/40 dark:group-hover:border-success/50",
      accentDot: "bg-success",
      sparkTone: "success" as const,
    },
    warning: {
      iconBg:
        "bg-warning/20 text-warning-foreground dark:bg-warning/30 dark:text-warning-foreground",
      glowBorder: "group-hover:border-warning/40 dark:group-hover:border-warning/50",
      accentDot: "bg-warning",
      sparkTone: "warning" as const,
    },
    destructive: {
      iconBg: "bg-destructive/15 text-destructive dark:bg-destructive/25 dark:text-destructive",
      glowBorder: "group-hover:border-destructive/40 dark:group-hover:border-destructive/50",
      accentDot: "bg-destructive",
      sparkTone: "destructive" as const,
    },
  }[tone];

  const sizeClasses = {
    sm: "p-4 space-y-2",
    md: "p-5 space-y-3",
    lg: "p-6 space-y-4",
  }[size];

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={`group relative overflow-hidden rounded-2xl liquid-glass border border-border/80 shadow-clinical transition-all duration-300 ${toneStyles.glowBorder} ${sizeClasses} ${className}`}
    >
      {/* Background Ambient Glow Spot */}
      <div
        className={`absolute -top-12 -right-12 h-28 w-28 rounded-full blur-2xl opacity-15 transition-opacity duration-300 group-hover:opacity-30 pointer-events-none ${toneStyles.accentDot}`}
      />

      {/* Header Line */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90">
            {label}
          </span>
        </div>
        {Icon && (
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 shadow-sm ${toneStyles.iconBg}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Main Stat & Trend Line */}
      <div className="relative z-10 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={
              size === "lg"
                ? "text-3xl font-extrabold tracking-tight text-foreground font-display"
                : "text-3xl font-extrabold tracking-tight text-foreground font-display"
            }
          >
            {value}
          </motion.div>

          {trend ? (
            <div
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                trend.isPositive !== false
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {trend.isPositive !== false ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{trend.value}</span>
            </div>
          ) : delta ? (
            <span
              className={`text-xs font-semibold ${
                delta.startsWith("+") ||
                delta.includes("Available") ||
                delta.includes("Ready") ||
                delta.includes("Success") ||
                delta.includes("Attendance")
                  ? "text-success"
                  : delta.startsWith("-") || delta.includes("Required")
                    ? "text-destructive"
                    : "text-muted-foreground"
              }`}
            >
              {delta}
            </span>
          ) : null}
        </div>
      </div>

      {/* Optional Sparkline Graph under card */}
      {sparklineData ? (
        <div className="relative z-10 pt-1 -mb-1">
          <Sparkline data={sparklineData} tone={toneStyles.sparkTone} height={36} />
        </div>
      ) : null}

      {children && <div className="relative z-10 pt-2">{children}</div>}
    </motion.div>
  );
}
