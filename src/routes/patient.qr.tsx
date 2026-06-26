import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode } from "@/components/QrCode";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { useLivePatients } from "@/hooks/use-fabric";
import { currentPatient } from "@/lib/mock-data";
import { RefreshCw, ShieldCheck, Droplets, CreditCard, BadgeCheck, Timer } from "lucide-react";

export const Route = createFileRoute("/patient/qr")({
  head: () => ({ meta: [{ title: "Patient · QR Code — DID Hospital" }] }),
  component: PatientQr,
});

const ROTATION_SECONDS = 60;

function buildPayload(patient: { did: string; mrn: string; name: string }) {
  return JSON.stringify({
    did: patient.did,
    mrn: patient.mrn,
    name: patient.name,
    exp: Date.now() + 60_000,
    channel: "embrace-health-channel",
  });
}

function PatientQr() {
  const { patients: patientsList } = useLivePatients();
  const patient = patientsList?.[0] || currentPatient;

  const [payload, setPayload] = useState(() => buildPayload(patient));
  const [timeLeft, setTimeLeft] = useState(ROTATION_SECONDS);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setPayload(buildPayload(patient));
    setTimeLeft(ROTATION_SECONDS);
    setRefreshKey((k) => k + 1);
  }, [patient]);

  // Re-build payload only when the DID identity changes, not on every patient object update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPayload(buildPayload(patient));
  }, [patient.did]);

  // Countdown + auto-rotate
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setPayload(buildPayload(patient));
          setRefreshKey((k) => k + 1);
          return ROTATION_SECONDS;
        }
        return prev - 1;
      });
    }, 1_000);
    return () => clearInterval(id);
  }, [patient]);

  const urgency =
    timeLeft <= 10 ? "text-destructive" : timeLeft <= 20 ? "text-warning" : "text-muted-foreground";

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6">
        <PageHeader
          eyebrow="Patient app"
          title="Check-in QR"
          description="Show this at the front desk or kiosk to verify your hospital DID"
        />

        {/* Patient name / MRN */}
        <div className="mt-6 flex flex-col items-center text-center">
          <div className="text-lg font-semibold text-foreground">{patient.name}</div>
          <div className="text-sm text-muted-foreground font-mono">{patient.mrn}</div>
        </div>

        {/* Valid indicator */}
        <div className="mt-3 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Valid · On-chain DID
          </span>
        </div>

        {/* QR card with framer-motion fade/scale on refresh */}
        <div className="mt-6 flex flex-col items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={refreshKey}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <QrCode value={payload} size={260} bgColor="#ffffff" fgColor="#000000" />
            </motion.div>
          </AnimatePresence>

          {/* DID monospace */}
          <p className="mt-3 max-w-xs truncate text-center font-mono text-[10px] text-muted-foreground">
            {patient.did}
          </p>
        </div>

        {/* Countdown timer */}
        <div
          className={`mt-4 flex items-center justify-center gap-1.5 text-sm font-medium ${urgency}`}
        >
          <Timer className="h-4 w-4" />
          Refreshes in <span className="tabular-nums">{timeLeft}s</span>
        </div>

        {/* Refresh Now button */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Refresh Now
          </button>
        </div>

        {/* Info chips */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm">
            <Droplets className="h-3.5 w-3.5 text-destructive" />
            {patient.bloodGroup}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm">
            <CreditCard className="h-3.5 w-3.5 text-primary" />
            {patient.mrn}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-success shadow-sm">
            <BadgeCheck className="h-3.5 w-3.5" />
            Verified
          </span>
        </div>

        {/* Solana badge */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Signed on Solana Devnet · embrace-health-anchor
        </div>
      </div>
    </RouteGuard>
  );
}
