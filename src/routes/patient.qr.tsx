import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { QrPlaceholder } from "@/components/QrPlaceholder";
import { currentPatient } from "@/lib/mock-data";
import { RefreshCw, Lock } from "lucide-react";

export const Route = createFileRoute("/patient/qr")({
  head: () => ({ meta: [{ title: "Patient · QR Code — DID Hospital" }] }),
  component: PatientQr,
});

function PatientQr() {
  return (
    <PhoneFrame title="Check-in QR">
      <div className="flex flex-col items-center px-5 py-6 text-center">
        <div className="text-sm text-muted-foreground">Show this at the front desk or kiosk</div>
        <div className="mt-2 text-lg font-semibold text-foreground">{currentPatient.name}</div>
        <div className="text-xs text-muted-foreground">{currentPatient.mrn}</div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-clinical">
          <QrPlaceholder value={currentPatient.did} size={240} />
        </div>

        <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" /> Rotates every 60 seconds · signed with biometric
        </div>

        <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90">
          <RefreshCw className="h-4 w-4" /> Refresh code
        </button>

        <div className="mt-8 w-full rounded-xl bg-muted/60 p-4 text-left text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Tip</div>
          Brightness is auto-boosted while this screen is visible so the scanner can read your code instantly.
        </div>
      </div>
    </PhoneFrame>
  );
}
