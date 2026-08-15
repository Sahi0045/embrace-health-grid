import { useState } from "react";
import {
  X,
  Siren,
  AlertTriangle,
  Flame,
  Activity,
  ShieldAlert,
  Lock,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { broadcastEmergencyAlert } from "@/lib/api";
import { playClinicalAlert } from "@/lib/audio-alerts";
import type { EmergencyBroadcastCode, AlertSeverity } from "@/lib/types";

export interface BroadcastEmergencyDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EMERGENCY_CODES: {
  code: EmergencyBroadcastCode;
  title: string;
  desc: string;
  icon: typeof Siren;
  severity: AlertSeverity;
  toneClass: string;
}[] = [
  {
    code: "code_blue",
    title: "CODE BLUE (Cardiac/Respiratory Arrest)",
    desc: "Immediate clinical resuscitation team dispatch",
    icon: Activity,
    severity: "critical",
    toneClass: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  {
    code: "trauma_alpha",
    title: "TRAUMA ALPHA (Mass Influx / Critical Trauma)",
    desc: "Surgical, ICU, and blood bank rapid readiness",
    icon: Siren,
    severity: "critical",
    toneClass: "border-warning/40 bg-warning/10 text-warning-foreground",
  },
  {
    code: "code_red",
    title: "CODE RED (Fire / Facility Hazard)",
    desc: "Fire safety containment and evacuation protocol",
    icon: Flame,
    severity: "critical",
    toneClass: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  {
    code: "cyber_incident",
    title: "CYBER INCIDENT (Ransomware / Data Breach)",
    desc: "Isolate network segment and switch to offline EMR",
    icon: ShieldAlert,
    severity: "warning",
    toneClass: "border-primary/40 bg-primary/10 text-primary",
  },
  {
    code: "lockdown",
    title: "FACILITY LOCKDOWN (Security Threat)",
    desc: "Secure all hospital perimeter gates and ward doors",
    icon: Lock,
    severity: "critical",
    toneClass: "border-destructive/40 bg-destructive/10 text-destructive",
  },
];

export function BroadcastEmergencyDialog({
  open,
  onClose,
  onSuccess,
}: BroadcastEmergencyDialogProps) {
  const [selectedCode, setSelectedCode] = useState<EmergencyBroadcastCode>("code_blue");
  const [location, setLocation] = useState("Ward 3B - ICU Floor 2");
  const [customMessage, setCustomMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const currentDef = EMERGENCY_CODES.find((c) => c.code === selectedCode) || EMERGENCY_CODES[0];

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) {
      toast.error("Please specify physical location");
      return;
    }

    setLoading(true);
    try {
      await broadcastEmergencyAlert({
        broadcastCode: selectedCode,
        title: currentDef.title,
        message:
          customMessage.trim() ||
          `${currentDef.title} triggered at ${location}. All designated personnel respond immediately.`,
        location: location.trim(),
        severity: currentDef.severity,
      });

      playClinicalAlert("critical");
      toast.success("Emergency Alert Broadcasted", {
        description: `Code ${selectedCode.toUpperCase()} dispatched to hospital grid.`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error("Failed to broadcast emergency alert", {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-foreground/50 backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg rounded-2xl border border-destructive/40 bg-card p-6 shadow-clinical-xl z-10 space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive animate-pulse">
                <Siren className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                  Hospital Emergency Broadcast
                </h3>
                <p className="text-[11px] font-medium text-muted-foreground">
                  High-Priority Central Dispatch Sentinel
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-1.5 hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-4">
            {/* Emergency Code Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground border-l-2 border-primary/30 pl-3">
                Select Emergency Code
              </label>
              <div className="grid grid-cols-1 gap-2 pt-1">
                {EMERGENCY_CODES.map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedCode === item.code;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setSelectedCode(item.code)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? `${item.toneClass} ring-2 ring-primary/40 font-bold shadow-xs`
                          : "border-border/80 bg-background/60 hover:bg-accent text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-foreground">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Location Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Exact Hospital Location / Ward / Room
              </label>
              <Input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Ward 3B, Room 302, ER Bay 1"
                className="rounded-xl bg-background border-border/80 text-xs"
              />
            </div>

            {/* Message Override */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Custom Instructions (Optional)
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Provide situational details, required equipment, or specific team callsigns..."
                rows={2}
                className="w-full rounded-xl bg-background border border-border/80 p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Submit CTA */}
            <div className="pt-2 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 rounded-xl h-10 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl h-10 text-xs font-extrabold bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-clinical-md shadow-destructive/25 gap-2"
              >
                <Radio className="h-4 w-4 animate-pulse" />
                <span>{loading ? "Dispatching..." : "Broadcast Code"}</span>
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
