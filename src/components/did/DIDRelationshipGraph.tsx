import { motion } from "framer-motion";
import {
  Building2,
  Bed,
  User,
  Stethoscope,
  Ambulance,
  Wrench,
  ShieldCheck,
  FileText,
} from "lucide-react";

export type GraphNode = {
  id: string;
  label: string;
  did: string;
  type:
    | "hospital"
    | "department"
    | "ward"
    | "bed"
    | "patient"
    | "doctor"
    | "equipment"
    | "ambulance"
    | "prescription";
  status: "active" | "occupied" | "available" | "maintenance" | "offline";
  x: number;
  y: number;
};

export type GraphEdge = {
  from: string;
  to: string;
  label?: string;
};

interface DIDRelationshipGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  selectedId?: string;
  width?: number;
  height?: number;
}

const typeIcon: Record<GraphNode["type"], React.ComponentType<{ className?: string }>> = {
  hospital: Building2,
  department: Building2,
  ward: Bed,
  bed: Bed,
  patient: User,
  doctor: Stethoscope,
  equipment: Wrench,
  ambulance: Ambulance,
  prescription: FileText,
};

const typeColor: Record<GraphNode["type"], { fill: string; stroke: string; text: string }> = {
  hospital: {
    fill: "hsl(var(--primary) / 0.15)",
    stroke: "hsl(var(--primary) / 0.6)",
    text: "hsl(var(--primary))",
  },
  department: {
    fill: "hsl(var(--chart-2) / 0.15)",
    stroke: "hsl(var(--chart-2) / 0.6)",
    text: "hsl(var(--chart-2))",
  },
  ward: {
    fill: "hsl(var(--chart-3) / 0.15)",
    stroke: "hsl(var(--chart-3) / 0.6)",
    text: "hsl(var(--chart-3))",
  },
  bed: {
    fill: "hsl(var(--success) / 0.15)",
    stroke: "hsl(var(--success) / 0.6)",
    text: "hsl(var(--success))",
  },
  patient: {
    fill: "hsl(var(--primary) / 0.1)",
    stroke: "hsl(var(--primary) / 0.5)",
    text: "hsl(var(--primary))",
  },
  doctor: {
    fill: "hsl(var(--chart-2) / 0.1)",
    stroke: "hsl(var(--chart-2) / 0.5)",
    text: "hsl(var(--chart-2))",
  },
  equipment: {
    fill: "hsl(var(--chart-4) / 0.15)",
    stroke: "hsl(var(--chart-4) / 0.6)",
    text: "hsl(var(--chart-4))",
  },
  ambulance: {
    fill: "hsl(var(--destructive) / 0.1)",
    stroke: "hsl(var(--destructive) / 0.5)",
    text: "hsl(var(--destructive))",
  },
  prescription: {
    fill: "hsl(var(--chart-5) / 0.15)",
    stroke: "hsl(var(--chart-5) / 0.6)",
    text: "hsl(var(--chart-5))",
  },
};

const statusDot: Record<string, string> = {
  active: "hsl(var(--success))",
  occupied: "hsl(var(--primary))",
  available: "hsl(var(--success))",
  maintenance: "hsl(var(--warning))",
  offline: "hsl(var(--destructive))",
};

export function DIDRelationshipGraph({
  nodes,
  edges,
  onNodeClick,
  selectedId,
  width = 800,
  height = 500,
}: DIDRelationshipGraphProps) {
  const NODE_W = 130;
  const NODE_H = 50;

  return (
    <div className="overflow-auto rounded-xl border border-border bg-card">
      <svg width={width} height={height} className="select-none">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--border))" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const from = nodes.find((n) => n.id === edge.from);
          const to = nodes.find((n) => n.id === edge.to);
          if (!from || !to) return null;

          const x1 = from.x + NODE_W / 2;
          const y1 = from.y + NODE_H;
          const x2 = to.x + NODE_W / 2;
          const y2 = to.y;
          const cx = (x1 + x2) / 2;
          const cy = (y1 + y2) / 2;

          return (
            <g key={i}>
              <path
                d={`M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth={1.5}
                markerEnd="url(#arrowhead)"
              />
              {edge.label && (
                <text
                  x={cx}
                  y={cy - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="hsl(var(--muted-foreground))"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const colors = typeColor[node.type];
          const Icon = typeIcon[node.type];
          const isSelected = node.id === selectedId;

          return (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              style={{ cursor: onNodeClick ? "pointer" : "default" }}
              onClick={() => onNodeClick?.(node)}
              transform={`translate(${node.x}, ${node.y})`}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={colors.fill}
                stroke={isSelected ? colors.text : colors.stroke}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
              {/* Status dot */}
              <circle cx={NODE_W - 10} cy={10} r={4} fill={statusDot[node.status]} />
              {/* Label */}
              <text x={14} y={19} fontSize={10} fontWeight="600" fill={colors.text}>
                {node.type.charAt(0).toUpperCase() + node.type.slice(1)}
              </text>
              <text
                x={14}
                y={34}
                fontSize={10}
                fill="hsl(var(--foreground))"
                style={{ fontFamily: "system-ui" }}
              >
                {node.label.length > 15 ? node.label.slice(0, 15) + "…" : node.label}
              </text>
              <text
                x={14}
                y={44}
                fontSize={8}
                fill="hsl(var(--muted-foreground))"
                style={{ fontFamily: "monospace" }}
              >
                {node.did.slice(0, 22) + "…"}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
