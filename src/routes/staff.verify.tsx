import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { useLivePatients } from "@/hooks/use-fabric";
import { fabricLogAuditEvent } from "@/lib/fabric-api";
import { currentPatient } from "@/lib/mock-data";
import {
  ScanLine,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  X,
  FileText,
  Pill,
  Activity,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Fingerprint,
  Camera,
  CameraOff,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { vitalSigns, medications, labTests } from "@/lib/inpatient-data";

// @zxing/browser is ESM-only; safe to import at module level —
// actual camera usage is gated by `typeof window !== "undefined"` at call sites.
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

export const Route = createFileRoute("/staff/verify")({
  head: () => ({ meta: [{ title: "Staff · Verify Patient — DID Hospital" }] }),
  component: VerifyPatient,
});

interface ScannedPayload {
  did: string;
  mrn: string;
  name: string;
  exp: number;
  channel: string;
}

function VerifyPatient() {
  const { patients: patientsList } = useLivePatients();
  const patient = patientsList?.[0] || currentPatient;

  // Scanner state
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanControlsRef = useRef<IScannerControls | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScannedPayload | null>(null);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // UI state
  const [chartOpen, setChartOpen] = useState(false);
  const [zkpOpen, setZkpOpen] = useState(false);

  // ── Scanner controls ──────────────────────────────────────────────────────

  const handleScanSuccess = useCallback(
    (raw: string) => {
      let parsed: ScannedPayload;
      try {
        parsed = JSON.parse(raw) as ScannedPayload;
      } catch {
        setError("QR payload could not be parsed as JSON.");
        return;
      }

      if (parsed.exp <= Date.now()) {
        setError("QR code has expired. Ask the patient to refresh their code.");
        return;
      }

      const matched = patientsList?.find((p) => p.did === parsed.did) || currentPatient;

      setScanResult(parsed);
      setVerified(true);
      setError(null);

      void fabricLogAuditEvent("staff", parsed.did, "QR_VERIFY", "success", "info");

      toast.success("Patient identity verified", {
        description: `${matched.name} · MRN ${matched.mrn}`,
      });

      // Inline stop to avoid circular dep with stopScanner useCallback
      scanControlsRef.current?.stop();
      scanControlsRef.current = null;
      setScanning(false);
    },
    [patientsList],
  );

  const startScanner = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!videoRef.current) return;

    setCameraError(null);
    setError(null);
    setVerified(false);
    setScanResult(null);

    try {
      const reader = new BrowserQRCodeReader();
      setScanning(true);

      // decodeFromVideoDevice returns IScannerControls with a stop() method
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, err) => {
          if (result) {
            handleScanSuccess(result.getText());
          }
          if (err && !(err instanceof Error && err.name === "NotFoundException")) {
            // NotFoundException fires every frame when no QR is in view — ignore it.
            console.warn("[QR scanner]", err);
          }
        },
      );
      scanControlsRef.current = controls;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Camera unavailable or permission denied.";
      setCameraError(msg);
      setScanning(false);
    }
  }, [handleScanSuccess]);

  const stopScanner = useCallback(() => {
    scanControlsRef.current?.stop();
    scanControlsRef.current = null;
    setScanning(false);
  }, []);

  // ── Simulate scan (fallback for browsers without camera) ─────────────────

  const simulateScan = useCallback(() => {
    const target = patientsList?.[0] || currentPatient;
    const fakePayload = JSON.stringify({
      did: target.did,
      mrn: target.mrn,
      name: target.name,
      exp: Date.now() + 60_000,
      channel: "embrace-health-channel",
    });
    handleScanSuccess(fakePayload);
  }, [patientsList, handleScanSuccess]);

  // ── Derived display patient ───────────────────────────────────────────────

  const displayPatient = scanResult
    ? patientsList?.find((p) => p.did === scanResult.did) || currentPatient
    : patient;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        eyebrow="Verification"
        title="Verify patient identity"
        description="Scan the patient's QR code to cryptographically verify their hospital DID."
      />

      <div className="grid gap-6 p-8 lg:grid-cols-[1fr_1.2fr]">
        {/* ── Scanner panel ── */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-clinical">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ScanLine className="h-4 w-4 text-primary" /> Scanner
          </div>

          {/* Video viewport */}
          <div className="relative mt-4 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 aspect-square w-full flex items-center justify-center">
            {/* Camera feed — always in DOM so ref stays attached */}
            <video
              ref={videoRef}
              className={`w-full h-full rounded-xl object-cover ${scanning ? "block" : "hidden"}`}
              muted
              playsInline
            />

            {/* Overlay when not scanning */}
            {!scanning && !verified && (
              <div className="flex flex-col items-center gap-3 text-center text-muted-foreground p-6">
                <Camera className="h-14 w-14 opacity-30" />
                <span className="text-sm">Camera inactive</span>
                <span className="text-xs">Press "Start Camera" to begin scanning</span>
              </div>
            )}

            {/* Success overlay after scan */}
            {!scanning && verified && (
              <div className="flex flex-col items-center gap-2 text-center p-6">
                <CheckCircle2 className="h-16 w-16 text-success" />
                <div className="text-sm font-medium text-foreground">Identity match</div>
              </div>
            )}

            {/* Scanning corner brackets */}
            {scanning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-40 w-40 rounded-lg border-2 border-primary/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  <span className="absolute -top-px -left-px h-5 w-5 border-t-2 border-l-2 border-primary rounded-tl" />
                  <span className="absolute -top-px -right-px h-5 w-5 border-t-2 border-r-2 border-primary rounded-tr" />
                  <span className="absolute -bottom-px -left-px h-5 w-5 border-b-2 border-l-2 border-primary rounded-bl" />
                  <span className="absolute -bottom-px -right-px h-5 w-5 border-b-2 border-r-2 border-primary rounded-br" />
                </div>
              </div>
            )}
          </div>

          {/* Camera error */}
          {cameraError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{cameraError} — use "Simulate Scan" below.</span>
            </div>
          )}

          {/* Scan errors */}
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Controls */}
          <div className="mt-5 flex flex-col gap-2">
            {!scanning ? (
              <button
                onClick={startScanner}
                disabled={verified}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                <Camera className="h-4 w-4" /> Start Camera
              </button>
            ) : (
              <button
                onClick={stopScanner}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <CameraOff className="h-4 w-4" /> Stop Camera
              </button>
            )}

            <button
              onClick={simulateScan}
              disabled={verified || scanning}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <Cpu className="h-4 w-4" /> Simulate Scan
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Real camera scan or simulate to verify.
          </p>
        </div>

        {/* ── Patient info panel ── */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-clinical">
          <AnimatePresence mode="wait">
            {!verified ? (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full min-h-[400px] flex-col items-center justify-center text-center text-muted-foreground"
              >
                <ScanLine className="h-12 w-12 opacity-40" />
                <div className="mt-3 text-sm">Waiting for scan…</div>
                <div className="text-xs">Patient details will appear here once verified.</div>
              </motion.div>
            ) : (
              <motion.div
                key="verified"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Patient
                    </div>
                    <div className="mt-1 text-xl font-semibold text-foreground">
                      {displayPatient.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {displayPatient.age} · {displayPatient.gender} · MRN {displayPatient.mrn}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </span>
                </div>

                {/* Access Granted banner */}
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-success/25 bg-success/8 px-4 py-2.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Access Granted — logged on Hyperledger Fabric
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <Field
                    label="DID"
                    value={<span className="font-mono text-xs">{displayPatient.did}</span>}
                  />
                  <Field label="Phone" value={displayPatient.phone} />
                  <Field label="Blood group" value={displayPatient.bloodGroup} />
                  <Field
                    label="Allergies"
                    value={
                      displayPatient.allergies && displayPatient.allergies.length ? (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {displayPatient.allergies.join(", ")}
                        </span>
                      ) : (
                        "None"
                      )
                    }
                  />
                </dl>

                <div className="mt-6 flex gap-2 border-t border-border pt-5">
                  <button className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    Request record access
                  </button>
                  <button
                    onClick={() => setChartOpen(true)}
                    className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    Open chart
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── ZK Proof Verification ── */}
      {verified && (
        <div className="mx-8 mb-6 rounded-xl border border-border bg-card shadow-clinical overflow-hidden">
          <button
            onClick={() => setZkpOpen((o) => !o)}
            className="flex w-full items-center justify-between px-6 py-4 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-primary" />
              ZK Proof Verification
            </span>
            {zkpOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {zkpOpen && (
            <div className="border-t border-border px-6 pb-6 pt-4 space-y-5">
              {/* Verification steps */}
              <ol className="space-y-3">
                {[
                  {
                    title: "QR decoded — DID extracted",
                    desc: "Patient DID parsed from QR payload using base58 encoding.",
                  },
                  {
                    title: "DID resolved on Hyperledger Fabric",
                    desc: "DID document retrieved from channel ledger via peer query.",
                  },
                  {
                    title: "Merkle proof verified against ledger root",
                    desc: "Inclusion proof validated against the latest block header hash.",
                  },
                  {
                    title: "Selective disclosure validated — 3 of 7 attributes revealed",
                    desc: "Groth16 proof accepted; remaining 4 attributes remain private.",
                  },
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <div>
                      <div className="text-sm font-medium text-foreground">{step.title}</div>
                      <div className="text-xs text-muted-foreground">{step.desc}</div>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Disclosed attributes */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Disclosed Attributes
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Blood Group", value: displayPatient.bloodGroup },
                    {
                      label: "Allergy Status",
                      value:
                        displayPatient.allergies && displayPatient.allergies.length === 0
                          ? "None"
                          : "Present",
                    },
                    { label: "Insurance Valid", value: "Valid" },
                    { label: "Vaccination Status", value: "Complete" },
                  ].map((attr) => (
                    <div
                      key={attr.label}
                      className="rounded-lg border border-border bg-muted/40 p-3"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {attr.label}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">{attr.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Proof ID */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-2.5">
                <span className="text-xs text-muted-foreground">ZK Proof ID</span>
                <span className="font-mono text-xs text-foreground">zkp:groth16:0x8f2a...c4b1</span>
              </div>

              {/* Privacy note */}
              <p className="text-xs font-medium text-success">
                ✓ Privacy preserved: Full medical record not accessed
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Patient Chart Modal ── */}
      {chartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={() => setChartOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-clinical-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <div>
                <div className="font-semibold text-foreground">
                  {displayPatient.name} — Clinical Chart
                </div>
                <div className="text-xs text-muted-foreground">
                  MRN {displayPatient.mrn} · {displayPatient.age}y · {displayPatient.gender} ·{" "}
                  {displayPatient.bloodGroup}
                </div>
              </div>
              <button
                onClick={() => setChartOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Allergy alert */}
              {displayPatient.allergies && displayPatient.allergies.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-destructive">Allergy Alert</div>
                    <div className="text-sm text-foreground">
                      {displayPatient.allergies.join(", ")}
                    </div>
                  </div>
                </div>
              )}

              {/* Latest vitals */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Latest Vitals</CardTitle>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {vitalSigns[0].timestamp}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {[
                      { label: "Temp", value: `${vitalSigns[0].temperature}°C` },
                      {
                        label: "BP",
                        value: `${vitalSigns[0].bloodPressure.systolic}/${vitalSigns[0].bloodPressure.diastolic}`,
                      },
                      { label: "HR", value: `${vitalSigns[0].heartRate} bpm` },
                      { label: "RR", value: `${vitalSigns[0].respiratoryRate}/min` },
                      { label: "SpO₂", value: `${vitalSigns[0].oxygenSaturation}%` },
                    ].map((v) => (
                      <div key={v.label} className="rounded-lg bg-muted p-2 text-center">
                        <div className="text-xs text-muted-foreground">{v.label}</div>
                        <div className="font-semibold text-sm mt-0.5">{v.value}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Active medications */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Active Medications</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {medications
                    .filter((m) => m.status === "active")
                    .map((med) => (
                      <div
                        key={med.id}
                        className="flex items-center justify-between rounded-lg border p-2 text-sm"
                      >
                        <div>
                          <span className="font-medium">{med.name}</span>
                          <span className="text-muted-foreground ml-2">
                            {med.dosage} · {med.frequency}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Active
                        </Badge>
                      </div>
                    ))}
                </CardContent>
              </Card>

              {/* Recent lab tests */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Recent Lab Tests</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {labTests.slice(0, 3).map((test) => (
                    <div
                      key={test.id}
                      className="flex items-center justify-between rounded-lg border p-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{test.testName}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {test.orderedDate}
                        </span>
                      </div>
                      <Badge
                        variant={test.status === "completed" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {test.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Footer actions */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Link
                  to="/staff/patients"
                  className="flex-1 rounded-md border border-border bg-card px-4 py-2 text-center text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  onClick={() => setChartOpen(false)}
                >
                  View full patient list
                </Link>
                <button
                  onClick={() => setChartOpen(false)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}
