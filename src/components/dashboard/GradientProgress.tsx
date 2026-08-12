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
    primary: "from-blue-500 to-indigo-600 shadow-blue-500/30",
    success: "from-emerald-400 to-teal-500 shadow-emerald-500/30",
    warning: "from-amber-400 to-orange-500 shadow-amber-500/30",
    destructive: "from-rose-500 to-red-600 shadow-rose-500/30",
    cyan: "from-cyan-400 to-blue-500 shadow-cyan-500/30",
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
