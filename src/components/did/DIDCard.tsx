import { motion } from "framer-motion";
import { ShieldCheck, Copy } from "lucide-react";
import { useState } from "react";

interface DIDCardProps {
  did: string;
  subject: string;
  role: "patient" | "doctor" | "nurse" | "admin" | "equipment" | "bed" | "ambulance";
  subLabel?: string;
  status?: "active" | "revoked" | "suspended";
  compact?: boolean;
}

const roleGradients: Record<DIDCardProps["role"], string> = {
  patient: "from-primary to-primary/80",
  doctor: "from-chart-2 to-chart-2/80",
  nurse: "from-chart-3 to-chart-3/80",
  admin: "from-chart-4 to-chart-4/80",
  equipment: "from-chart-5 to-chart-5/80",
  bed: "from-success to-success/80",
  ambulance: "from-destructive to-destructive/80",
};

export function DIDCard({
  did,
  subject,
  role,
  subLabel,
  status = "active",
  compact = false,
}: DIDCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(did);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${roleGradients[role]} text-white shadow-clinical-md ${compact ? "p-4" : "p-5"}`}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/5" />

      <div className="relative">
        <div className="flex items-center justify-between text-xs opacity-80">
          <span className="capitalize">{role} DID</span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            <span className={status === "active" ? "text-green-200" : "text-red-300"}>
              {status}
            </span>
          </div>
        </div>

        <div className={`mt-2 font-mono ${compact ? "text-xs" : "text-sm"} opacity-90 truncate`}>
          {did}
        </div>

        <div className={`${compact ? "mt-3" : "mt-4"} flex items-end justify-between`}>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-70">Subject</div>
            <div className={`${compact ? "text-sm" : "text-base"} font-semibold`}>{subject}</div>
            {subLabel && <div className="text-[11px] opacity-70">{subLabel}</div>}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-white/25 transition-colors"
          >
            <Copy className="h-3 w-3" />
            {copied ? "Copied" : "Copy DID"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
