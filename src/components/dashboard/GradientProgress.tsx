import { motion } from "framer-motion";

export interface GradientProgressProps {
  value: number;
  tone?: "primary" | "success" | "warning" | "destructive" | "cyan";
  height?: number;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function GradientProgress({
  value,
  tone = "primary",
  height = 8,
  showLabel = false,
  label,
  className = "",
}: GradientProgressProps) {
  const fillGradient = {
    primary: "from-primary to-primary shadow-primary/30",
    success: "from-success to-success shadow-success/30",
    warning: "from-warning to-warning shadow-warning/30",
    destructive: "from-destructive to-destructive shadow-destructive/30",
    cyan: "from-primary to-primary shadow-primary/30",
  }[tone];

  const clamped = Math.min(100, Math.max(0, value || 0));

  return (
    <div className={`space-y-1 w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-muted-foreground">{label}</span>
          <span className="text-foreground font-mono">{clamped}%</span>
        </div>
      )}
      <div className="relative w-full overflow-hidden rounded-full bg-muted/60" style={{ height }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full bg-gradient-to-r ${fillGradient} shadow-sm`}
        />
      </div>
    </div>
  );
}
