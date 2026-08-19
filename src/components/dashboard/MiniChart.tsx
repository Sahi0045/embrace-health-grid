import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { motion, AnimatePresence } from "framer-motion";

export interface DonutDataItem {
  name: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutDataItem[];
  centerLabel?: string;
  centerSublabel?: string;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showTooltip?: boolean;
}

export function DonutChart({
  data,
  centerLabel,
  centerSublabel = "Total",
  height = 180,
  innerRadius = 48,
  outerRadius = 68,
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const activeData = data.filter((d) => d.value > 0);
  const currentHovered =
    hoveredIndex !== null && activeData[hoveredIndex] ? activeData[hoveredIndex] : null;

  const displayValue = currentHovered ? String(currentHovered.value) : centerLabel;
  const displaySublabel = currentHovered ? currentHovered.name : centerSublabel;

  return (
    <div
      className="relative w-full flex items-center justify-center select-none"
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={
              activeData.length > 0
                ? activeData
                : [{ name: "Empty", value: 1, color: "var(--color-muted)" }]
            }
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
            onMouseEnter={(_, index) => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {(activeData.length > 0 ? activeData : [{ color: "var(--color-muted)" }]).map(
              (entry, index) => {
                const isHovered = hoveredIndex === index;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="transition-all duration-200 cursor-pointer outline-none"
                    style={{
                      opacity: hoveredIndex === null || isHovered ? 1 : 0.45,
                      filter: isHovered ? "drop-shadow(0 0 6px rgba(0,0,0,0.25))" : "none",
                      transform: isHovered ? "scale(1.04)" : "scale(1)",
                      transformOrigin: "center center",
                    }}
                  />
                );
              },
            )}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {displayValue !== undefined && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center z-10 px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={displayValue + displaySublabel}
              initial={{ opacity: 0, scale: 0.92, y: 2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -2 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex flex-col items-center justify-center max-w-[130px]"
            >
              <span
                className="text-2xl font-extrabold tracking-tight font-display"
                style={{
                  color: currentHovered ? currentHovered.color : "var(--color-foreground)",
                }}
              >
                {displayValue}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground line-clamp-1 truncate w-full">
                {displaySublabel}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
