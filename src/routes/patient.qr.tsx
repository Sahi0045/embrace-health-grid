import { createFileRoute } from "@tanstack/react-router";
import { QrPlaceholder } from "@/components/QrPlaceholder";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { currentPatient } from "@/lib/mock-data";
import { useLivePatients } from "@/hooks/use-fabric";
import { RefreshCw, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/patient/qr")({
  head: () => ({ meta: [{ title: "Patient · QR Code — DID Hospital" }] }),
  component: PatientQr,
});

function PatientQr() {
  const { patients: patientsList } = useLivePatients();
  const patient = patientsList?.[0] || currentPatient;

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6">
        <PageHeader
          eyebrow="Patient app"
          title="Check-in QR"
          description="Show this at the front desk or kiosk"
        />

        <div className="mt-6 flex flex-col items-center text-center">
          <div className="text-lg font-semibold">{patient.name}</div>
          <div className="text-sm text-muted-foreground">{patient.mrn}</div>

          <Card className="mt-6 w-full">
            <CardContent className="flex justify-center p-6">
              <QrPlaceholder value={patient.did} size={260} />
            </CardContent>
          </Card>

          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" /> Rotates every 60 seconds · signed with biometric
          </div>

          <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90">
            <RefreshCw className="h-4 w-4" /> Refresh code
          </button>

          <div className="mt-8 w-full rounded-xl bg-muted/60 p-4 text-left text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Tip</div>
            Brightness is auto-boosted while this screen is visible so the scanner can read your code instantly.
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
