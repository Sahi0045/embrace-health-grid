import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export interface GlowCardProps {
  children: ReactNode;
  accent?: "primary" | "success" | "warning" | "destructive" | "none";
  className?: string;
  glowOnHover?: boolean;
  onClick?: (e?: any) => void;
}

export function GlowCard({
  children,
  accent = "primary",
  className = "",
  glowOnHover = true,
  onClick,
}: GlowCardProps) {
  const accentGlow = {
    primary: "bg-primary/20",
    success: "bg-success/20",
    warning: "bg-warning/20",
    destructive: "bg-destructive/20",
    none: "transparent",
  }[accent];

  return (
    <motion.div
      onClick={onClick}
      whileHover={glowOnHover ? { y: -4, scale: 1.015 } : undefined}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="relative group rounded-2xl h-full flex flex-col"
    >
      {/* Background Hotspot Glow */}
      {accent !== "none" && (
        <div
          className={`absolute -top-10 -left-10 h-32 w-32 rounded-full blur-3xl opacity-10 group-hover:opacity-25 transition-opacity duration-500 pointer-events-none ${accentGlow}`}
        />
      )}

      <Card
        className={`relative overflow-hidden rounded-2xl liquid-glass transition-all duration-300 group-hover:border-primary/40 dark:group-hover:border-primary/50 group-hover:shadow-clinical-md h-full flex flex-col ${className}`}
      >
        {children}
      </Card>
    </motion.div>
  );
}
