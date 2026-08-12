import { motion } from "framer-motion";

export interface SparklineProps {
  data?: number[];
  tone?: "primary" | "success" | "warning" | "destructive";
  height?: number;
  className?: string;
}

export function Sparkline({
  data = [12, 18, 15, 25, 20, 32, 28, 40, 38, 48],
  tone = "primary",
  height = 42,
  className = "",
}: SparklineProps) {
  const strokeColor = {
    primary: "oklch(0.44 0.19 242)",
    success: "oklch(0.58 0.16 155)",
    warning: "oklch(0.7 0.17 75)",
    destructive: "oklch(0.52 0.23 22)",
  }[tone];

  const gradientId = `sparkline-grad-${tone}-${Math.random().toString(36).substr(2, 6)}`;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 4;
  const width = 140;
  const effectiveHeight = height - padding * 2;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - padding - ((val - min) / range) * effectiveHeight;
    return { x, y };
  });

  // Generate smooth SVG curve path
  const pathD = points.reduce((acc, pt, idx, arr) => {
    if (idx === 0) return `M ${pt.x},${pt.y}`;
    const prev = arr[idx - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
  }, "");

  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <div className={`relative w-full overflow-hidden ${className}`} style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Fill Area Gradient */}
        <motion.path
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          d={areaD}
          fill={`url(#${gradientId})`}
        />

        {/* Stroke Line */}
        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
