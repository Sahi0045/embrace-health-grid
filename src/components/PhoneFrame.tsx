import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Signal, Wifi, BatteryFull } from "lucide-react";

/** Mobile-frame wrapper for the patient app surface. */
export function PhoneFrame({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="mx-auto w-full max-w-[420px] px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[2.25rem] border border-border bg-card shadow-clinical-md"
        style={{
          boxShadow:
            "0 30px 60px -20px oklch(0.2 0.04 240 / 0.18), 0 8px 24px -8px oklch(0.2 0.04 240 / 0.08)",
        }}
      >
        {/* Dynamic-island status bar */}
        <div className="relative flex items-center justify-between bg-card px-6 pt-3 pb-2 text-[11px] font-semibold text-foreground">
          <span>9:41</span>
          <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-foreground/90" />
          <div className="flex items-center gap-1 text-foreground/80">
            <Signal className="h-3 w-3" />
            <Wifi className="h-3 w-3" />
            <BatteryFull className="h-3.5 w-3.5" />
          </div>
        </div>

        {title && (
          <div className="border-b border-border bg-card px-5 pb-3 pt-1 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </div>
        )}

        <motion.div
          key={title}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-[600px] bg-background"
        >
          {children}
        </motion.div>

        {/* Home indicator */}
        <div className="flex items-center justify-center bg-card py-2">
          <div className="h-1 w-28 rounded-full bg-foreground/70" />
        </div>
      </motion.div>
    </div>
  );
}
