import { motion } from "framer-motion";
import {
  TestTube2,
  CheckCircle2,
  Clock,
  QrCode,
  Thermometer,
  Package,
  User,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import type { LabSampleRecord, SampleCollectionStatus } from "@/lib/types";

interface SampleTrackingTabProps {
  samples: LabSampleRecord[];
  onAdvanceStage: (sampleId: string, nextStatus: SampleCollectionStatus) => void;
}

const PIPELINE_STAGES: { key: SampleCollectionStatus; label: string; step: number }[] = [
  { key: "collected", label: "Collected", step: 1 },
  { key: "lab_received", label: "Lab Received", step: 2 },
  { key: "processing", label: "Processing", step: 3 },
  { key: "resulted", label: "Resulted", step: 4 },
  { key: "reported", label: "Reported", step: 5 },
];

function getStageIndex(status: SampleCollectionStatus): number {
  const found = PIPELINE_STAGES.findIndex((s) => s.key === status);
  return found === -1 ? 0 : found;
}

export function SampleTrackingTab({ samples, onAdvanceStage }: SampleTrackingTabProps) {
  if (samples.length === 0) {
    return (
      <EmptyState
        icon={TestTube2}
        title="No biological samples tracked"
        description="No specimens currently logged in the laboratory accession ledger."
      />
    );
  }

  return (
    <div className="space-y-4">
      {samples.map((sample, index) => {
        const currentIdx = getStageIndex(sample.collection_status);
        const isComplete = sample.collection_status === "reported";
        const nextStage = !isComplete ? PIPELINE_STAGES[currentIdx + 1] : null;

        return (
          <motion.div
            key={sample.sample_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
            className="rounded-2xl border border-border/80 bg-card p-5 shadow-clinical-sm hover:border-primary/40 transition-all space-y-4"
          >
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                  <TestTube2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                      {sample.patient_name || "Patient Specimen"}
                    </h3>
                    <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                      {sample.sample_id}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>
                      Barcode:{" "}
                      <strong className="font-mono text-foreground">
                        {sample.barcode || "N/A"}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Type:{" "}
                      <strong className="uppercase text-foreground">{sample.sample_type}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button to advance stage */}
              {nextStage && (
                <Button
                  size="sm"
                  onClick={() => onAdvanceStage(sample.sample_id, nextStage.key)}
                  className="h-8 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold gap-1.5 shadow-xs hover:bg-primary/90"
                >
                  <span>Advance to {nextStage.label}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* 5-Step Pipeline Timeline */}
            <div className="relative py-2">
              {/* Progress track line */}
              <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-1 bg-border/80 rounded-full z-0">
                <div
                  className="h-full bg-gradient-to-r from-primary to-blue-600 rounded-full transition-all duration-500"
                  style={{
                    width: `${(currentIdx / (PIPELINE_STAGES.length - 1)) * 100}%`,
                  }}
                />
              </div>

              {/* Stage nodes */}
              <div className="relative z-10 flex items-center justify-between">
                {PIPELINE_STAGES.map((stage, sIdx) => {
                  const isPassed = sIdx < currentIdx;
                  const isCurrent = sIdx === currentIdx;
                  const isFuture = sIdx > currentIdx;

                  return (
                    <div
                      key={stage.key}
                      className="flex flex-col items-center gap-1.5 bg-card px-1"
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-extrabold transition-all ${
                          isPassed
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : isCurrent
                              ? "bg-card text-primary border-primary ring-4 ring-primary/20 shadow-sm"
                              : "bg-background text-muted-foreground/60 border-border/80"
                        }`}
                      >
                        {isPassed ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <span>{stage.step}</span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-extrabold tracking-wider uppercase text-center ${
                          isCurrent
                            ? "text-primary"
                            : isPassed
                              ? "text-foreground font-bold"
                              : "text-muted-foreground/70"
                        }`}
                      >
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Metadata Footer Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-background/60 rounded-xl p-3 border border-border/60 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Container
                </span>
                <p className="font-semibold text-foreground truncate">
                  {sample.container_type || "Standard Vial"}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Thermometer className="h-3 w-3 text-cyan-500" />
                  Storage Temp
                </span>
                <p className="font-semibold text-foreground">
                  {sample.temperature_c
                    ? `${sample.temperature_c}°C (Cold Chain)`
                    : "Ambient (20°C)"}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Collector
                </span>
                <p className="font-semibold text-foreground truncate">
                  {sample.collected_by || "Clinical Staff"}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Collected At
                </span>
                <p className="font-semibold text-foreground">
                  {new Date(sample.collected_at || sample.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {/* Notes if present */}
            {sample.notes && (
              <p className="text-xs text-muted-foreground italic pl-1 border-l-2 border-primary/40">
                "{sample.notes}"
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
