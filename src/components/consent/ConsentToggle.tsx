import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldX } from "lucide-react";

interface ConsentToggleProps {
  label: string;
  description?: string;
  defaultEnabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  disabled?: boolean;
}

export function ConsentToggle({ label, description, defaultEnabled = false, onToggle, disabled }: ConsentToggleProps) {
  const [enabled, setEnabled] = useState(defaultEnabled);

  const handleToggle = () => {
    if (disabled) return;
    const next = !enabled;
    setEnabled(next);
    onToggle?.(next);
  };

  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${enabled ? "border-success/30 bg-success/5" : "border-border bg-card"} ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
          {enabled ? <ShieldCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${enabled ? "bg-success" : "bg-muted"} ${disabled ? "cursor-not-allowed" : ""}`}
        role="switch"
        aria-checked={enabled}
        aria-label={label}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 700, damping: 30 }}
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ${enabled ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}
