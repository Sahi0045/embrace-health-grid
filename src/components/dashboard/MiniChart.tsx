import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";

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
}

export function DonutChart({
  data,
  centerLabel,
  centerSublabel = "Total",
  height = 180,
  innerRadius = 48,
  outerRadius = 68,
}: DonutChartProps) {
  const activeData = data.filter((d) => d.value > 0);

  return (
    <div className="relative w-full flex items-center justify-center" style={{ height }}>
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
            paddingAngle={4}
            dataKey="value"
            stroke="none"
          >
            {(activeData.length > 0 ? activeData : [{ color: "var(--color-muted)" }]).map(
              (entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ),
            )}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-card, #fff)",
              borderColor: "var(--color-border, #ccc)",
              borderRadius: "0.75rem",
              fontSize: "0.75rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {centerLabel !== undefined && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center"
        >
          <span className="text-2xl font-extrabold text-foreground tracking-tight font-display">
            {centerLabel}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {centerSublabel}
          </span>
        </motion.div>
      )}
    </div>
  );
}
