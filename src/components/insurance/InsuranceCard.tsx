import { ShieldCheck, Calendar } from "lucide-react";
import { motion } from "framer-motion";

interface InsuranceCardProps {
  provider: string;
  policyNo: string;
  type: string;
  sumInsured: number;
  used: number;
  validFrom: string;
  validTo: string;
  status: "active" | "expired" | "claimed";
}

export function InsuranceCard({
  provider,
  policyNo,
  type,
  sumInsured,
  used,
  validFrom,
  validTo,
  status,
}: InsuranceCardProps) {
  const pct = Math.min(Math.round((used / sumInsured) * 100), 100);
  const remaining = sumInsured - used;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-chart-2 to-chart-2/70 p-5 text-white shadow-clinical-md"
    >
      <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />

      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-70">Insurance</div>
          <div className="text-base font-bold mt-0.5">{provider}</div>
          <div className="text-[11px] opacity-80">{type}</div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold">
          <ShieldCheck className="h-3 w-3" />
          {status === "active" ? "Active" : status === "expired" ? "Expired" : "Claimed"}
        </div>
      </div>

      <div className="mt-4 font-mono text-xs opacity-70">{policyNo}</div>

      <div className="mt-4">
        <div className="flex justify-between text-xs opacity-80 mb-1.5">
          <span>₹{used.toLocaleString("en-IN")} used</span>
          <span>₹{remaining.toLocaleString("en-IN")} remaining</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white/80 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] opacity-60">
          Sum insured: ₹{sumInsured.toLocaleString("en-IN")} · {pct}% utilised
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10px] opacity-70">
        <Calendar className="h-3 w-3" />
        <span>
          {validFrom} — {validTo}
        </span>
      </div>
    </motion.div>
  );
}
