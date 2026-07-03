import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { useLivePatients } from "@/hooks/use-api";
import { logAuditEvent, verifyNFCCard, resolveDID, API_BASE_URL } from "@/lib/api";
import { currentPatient } from "@/lib/mock-data";
import { PublicKey, Connection } from "@solana/web3.js";
import { MerkleTree } from "@/lib/merkle";
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
  RefreshCw,
  CreditCard,
  Wifi,
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

  const [chartOpen, setChartOpen] = useState(false);
  const [zkpOpen, setZkpOpen] = useState(false);

  const [solanaVerifying, setSolanaVerifying] = useState(false);
  const [solanaVerified, setSolanaVerified] = useState(false);
  const [solanaRoot, setSolanaRoot] = useState<string | null>(null);

  useEffect(() => {
    if (!scanResult?.did) {
      setSolanaVerified(false);
      setSolanaRoot(null);
      return;
    }

    const verifyOnChain = async () => {
      setSolanaVerifying(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/medical-records/${encodeURIComponent(scanResult.did)}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
          }
        });
        if (!response.ok) throw new Error("Failed to fetch medical records");
        const data = await response.json();
        const records = data.records || [];

        if (records.length === 0) {
          setSolanaVerified(false);
          setSolanaRoot(null);
          return;
        }

        const hashes = records.map((r: any) => r.hash || `sha256:${r.recordId}`);
        const tree = new MerkleTree(hashes);
        await tree.build();
        const localRoot = tree.getRoot();

        const PROGRAM_ID = new PublicKey("BxkLrjBYdb3nh2m9GCfpLXBWrAj3s9MqnRbwktLqSfN3");
        const [patientRootPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("patient-root"), Buffer.from(scanResult.did)],
          PROGRAM_ID
        );

        const connection = new Connection("https://api.devnet.solana.com", "confirmed");
        const accountInfo = await connection.getAccountInfo(patientRootPda);

        if (accountInfo) {
          const didLen = accountInfo.data.readUInt32LE(8);
          const rootOffset = 8 + 4 + didLen;
          const rootBytes = accountInfo.data.slice(rootOffset, rootOffset + 32);
          const chainRoot = Buffer.from(rootBytes).toString("hex");
          
          setSolanaRoot(chainRoot);
          if (chainRoot === localRoot) {
            setSolanaVerified(true);
            toast.success("Medical records cryptographically verified on Solana Devnet!");
          } else {
            setSolanaVerified(false);
            toast.warning("On-chain root mismatch! Records might be out of sync or modified.");
          }
        } else {
          setSolanaRoot(null);
          setSolanaVerified(false);
        }
      } catch (err) {
        console.warn("Solana verification failed:", err);
        setSolanaVerified(false);
      } finally {
        setSolanaVerifying(false);
      }
    };

    verifyOnChain();
  }, [scanResult?.did]);

  // NFC & Fallback States
  const [activeTab, setActiveTab] = useState<"qr" | "nfc">("qr");
  const [nfcStatus, setNfcStatus] = useState<
    "idle" | "reading" | "verifying" | "success" | "error"
  >("idle");
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [manualMrn, setManualMrn] = useState("");
  const [isManualInputActive, setIsManualInputActive] = useState(false);

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

      void logAuditEvent("staff", parsed.did, "QR_VERIFY", "success", "info");

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

  // ── NFC & Manual handlers ────────────────────────────────────────────────

  const handleNfcSimulateSuccess = useCallback(() => {
    setNfcStatus("reading");
    setNfcError(null);
    setError(null);
    setVerified(false);
    setScanResult(null);

    setTimeout(async () => {
      setNfcStatus("verifying");

      try {
        const target = patientsList?.[0] || currentPatient;
        // Resolve DID document from API
        await resolveDID(target.did).catch(() => null);
        // Verify card
        await verifyNFCCard({ cardId: "NFC-SIMULATED-CARD" }).catch(() => ({
          verified: true,
        }));

        const payload: ScannedPayload = {
          did: target.did,
          mrn: target.mrn,
          name: target.name,
          exp: Date.now() + 31536000000, // 1 year validity for cards
          channel: "embrace-health-channel",
        };

        setScanResult(payload);
        setVerified(true);
        setNfcStatus("success");
        void logAuditEvent("staff", payload.did, "NFC_VERIFY", "success", "info");

        toast.success("Patient NFC Verified", {
          description: `${target.name} · MRN ${target.mrn}`,
        });
      } catch (err: any) {
        setNfcStatus("error");
        setNfcError(err.message || "NFC card verification failed.");
        toast.error("NFC Verification Failed", { description: err.message });
      }
    }, 1000);
  }, [patientsList]);

  const handleNfcSimulateFailure = useCallback(() => {
    setNfcStatus("reading");
    setNfcError(null);
    setError(null);
    setVerified(false);
    setScanResult(null);

    setTimeout(() => {
      setNfcStatus("error");
      setNfcError("NDEF signature verification failed. Card payload is unsigned or tampered.");
      toast.error("NFC Verification Failed", {
        description: "Signature mismatch or invalid issuer.",
      });
      setIsManualInputActive(true);
    }, 1200);
  }, []);

  const handleManualCheckin = useCallback(() => {
    if (!manualMrn.trim()) {
      toast.error("Please enter a valid MRN.");
      return;
    }

    const matched = patientsList?.find(
      (p) => p.mrn.toLowerCase() === manualMrn.trim().toLowerCase(),
    );

    if (matched) {
      const payload: ScannedPayload = {
        did: matched.did,
        mrn: matched.mrn,
        name: matched.name,
        exp: Date.now() + 60_000,
        channel: "embrace-health-channel",
      };

      setScanResult(payload);
      setVerified(true);
      setError(null);
      setNfcError(null);
      if (activeTab === "nfc") {
        setNfcStatus("success");
      }
      void logAuditEvent("staff", matched.did, "MANUAL_VERIFY", "success", "info");
      toast.success("Patient verified manually", {
        description: `${matched.name} · MRN ${matched.mrn}`,
      });
    } else {
      toast.error("MRN not found", {
        description: `No patient registered with MRN: ${manualMrn}`,
      });
    }
  }, [manualMrn, patientsList, activeTab]);

  // ── Derived display patient ───────────────────────────────────────────────

  const displayPatient = scanResult
    ? patientsList?.find((p) => p.did === scanResult.did) || currentPatient
    : patient;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Verification"
        title="Verify patient identity"
        description="Verify the patient's identity using secure decentralized methods."
      />

      <div className="grid gap-6 p-8 lg:grid-cols-[1fr_1.2fr]">
        {/* ── Scanner panel ── */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-clinical">
          {/* Method Tabs */}
          <div className="flex border-b border-border mb-6">
            <button
              onClick={() => {
                setActiveTab("qr");
                setError(null);
                setNfcError(null);
                setIsManualInputActive(false);
              }}
              className={`flex-1 pb-3 text-center text-sm font-semibold border-b-2 transition-all ${
                activeTab === "qr"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <ScanLine className="h-4 w-4" /> QR Code
              </span>
            </button>
            <button
              onClick={() => {
                setActiveTab("nfc");
                setError(null);
                setNfcError(null);
                setIsManualInputActive(false);
                if (scanning) {
                  stopScanner();
                }
              }}
              className={`flex-1 pb-3 text-center text-sm font-semibold border-b-2 transition-all ${
                activeTab === "nfc"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <CreditCard className="h-4 w-4" /> NFC Card
              </span>
            </button>
          </div>

          {/* QR Scan Interface */}
          {activeTab === "qr" && (
            <div>
              {/* Video viewport */}
              <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 aspect-square w-full flex items-center justify-center">
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
          )}

          {/* NFC Tap Interface */}
          {activeTab === "nfc" && (
            <div>
              <NfcContactlessReader status={nfcStatus} errorText={nfcError} />

              {/* NFC status error message */}
              {nfcStatus === "error" && nfcError && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{nfcError}</span>
                </div>
              )}

              {/* NFC Controls */}
              <div className="mt-5 flex flex-col gap-2">
                {nfcStatus === "idle" && (
                  <>
                    <button
                      onClick={handleNfcSimulateSuccess}
                      className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90 transition-colors"
                    >
                      <Cpu className="h-4 w-4" /> Simulate NFC Tap
                    </button>
                    <button
                      onClick={handleNfcSimulateFailure}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      Simulate Tap Failure
                    </button>
                  </>
                )}
                {(nfcStatus === "success" || nfcStatus === "error") && (
                  <button
                    onClick={() => {
                      setNfcStatus("idle");
                      setNfcError(null);
                      setVerified(false);
                      setScanResult(null);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    Reset Reader
                  </button>
                )}
              </div>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                Simulate NFC tap to verify Patient DID document.
              </p>
            </div>
          )}

          {/* Manual Input Fallback */}
          {!isManualInputActive ? (
            <button
              onClick={() => setIsManualInputActive(true)}
              className="mt-4 text-xs text-primary hover:underline block mx-auto text-center font-medium transition-all"
            >
              Trouble scanning? Check-in by MRN manually
            </button>
          ) : (
            <div className="mt-5 border-t border-border pt-4">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Manual Patient MRN Check-In
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. MRN-60914"
                  value={manualMrn}
                  onChange={(e) => setManualMrn(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleManualCheckin}
                  className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/90 transition-colors"
                >
                  Verify
                </button>
              </div>
              <button
                onClick={() => setIsManualInputActive(false)}
                className="mt-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors hover:underline block"
              >
                Cancel manual input
              </button>
            </div>
          )}
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
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </span>
                    {solanaVerifying ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning border border-warning/30 animate-pulse">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Checking Solana...
                      </span>
                    ) : solanaVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success border border-success/30">
                        <ShieldCheck className="h-3 w-3" /> Solana Secured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground border">
                        <Lock className="h-3 w-3" /> Root Unanchored
                      </span>
                    )}
                  </div>
                </div>

                {/* Access Granted banner */}
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-success/25 bg-success/8 px-4 py-2.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Access Granted — logged on Solana Devnet
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
                    title: "DID resolved on Solana Devnet",
                    desc: "DID document retrieved from Anchor program state.",
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
    </RouteGuard>
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

interface NfcReaderProps {
  status: "idle" | "reading" | "verifying" | "success" | "error";
  errorText: string | null;
}

function NfcContactlessReader({ status, errorText }: NfcReaderProps) {
  const cardVariants: any = {
    idle: {
      y: [0, -8, 0],
      rotateX: [10, 6, 10],
      rotateY: [-8, -4, -8],
      rotateZ: [0, 0.5, 0],
      scale: 1,
      transition: {
        y: { repeat: Infinity, duration: 4, ease: "easeInOut" },
        rotateX: { repeat: Infinity, duration: 4, ease: "easeInOut" },
        rotateY: { repeat: Infinity, duration: 4, ease: "easeInOut" },
        rotateZ: { repeat: Infinity, duration: 4, ease: "easeInOut" },
      },
    },
    reading: {
      y: 70,
      rotateX: 30,
      rotateY: 0,
      scale: 0.9,
      transition: { type: "spring", stiffness: 350, damping: 15 },
    },
    verifying: {
      y: 0,
      rotateX: [15, 15, 15],
      rotateY: [0, 180, 360],
      scale: 1.05,
      transition: {
        rotateY: { repeat: Infinity, duration: 2, ease: "linear" },
        y: { type: "spring", stiffness: 100, damping: 10 },
      },
    },
    success: {
      y: 0,
      rotateX: 0,
      rotateY: 0,
      scale: 1.05,
      transition: { type: "spring", stiffness: 200, damping: 12 },
    },
    error: {
      x: [0, -10, 10, -10, 10, -5, 5, 0],
      y: -25,
      rotateX: 12,
      rotateY: -12,
      scale: 0.95,
      transition: {
        x: { duration: 0.5 },
        y: { type: "spring", stiffness: 200, damping: 15 },
      },
    },
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 aspect-square w-full flex flex-col items-center justify-center text-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(var(--primary-rgb),0.05),transparent_70%)] pointer-events-none" />

      <div
        className="flex-1 flex items-center justify-center relative w-full"
        style={{ perspective: "1000px" }}
      >
        <motion.div
          style={{
            perspective: "1200px",
            transformStyle: "preserve-3d",
            width: "280px",
            height: "170px",
          }}
          className="relative"
          animate={status}
          variants={cardVariants}
        >
          {/* Card Front */}
          <div
            style={{
              backfaceVisibility: "hidden",
              transformStyle: "preserve-3d",
            }}
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/30 via-white/5 to-white/10 backdrop-blur-md border border-white/20 p-5 shadow-2xl flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute -inset-10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent_40%)] pointer-events-none" />

            {status === "reading" && (
              <motion.div
                initial={{ top: "0%" }}
                animate={{ top: "100%" }}
                transition={{ duration: 1, ease: "easeInOut", repeat: Infinity }}
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-warning to-transparent shadow-[0_0_8px_#eab308] z-20 pointer-events-none"
              />
            )}

            <div className="flex justify-between items-start">
              <div className="flex flex-col text-left">
                <span className="text-[9px] tracking-widest text-primary font-bold">
                  EMBRACE HEALTH
                </span>
                <span className="text-[7px] text-muted-foreground tracking-wider">
                  HEALTH DID CARD
                </span>
              </div>
              <Wifi className="h-5 w-5 text-primary/80" />
            </div>

            <div className="w-9 h-7 rounded bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 border border-amber-500/30 relative overflow-hidden shadow-inner self-start">
              <div className="absolute inset-x-2 inset-y-1 border-r border-amber-900/10" />
              <div className="absolute inset-x-1 inset-y-2 border-b border-amber-900/10" />
            </div>

            <div className="flex justify-between items-end">
              <div className="flex flex-col text-left">
                <span className="font-mono text-xs tracking-wider text-foreground">
                  did:solana:patient:••••••••
                </span>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">
                  SECURED BY SOLANA
                </span>
              </div>
              <div className="h-6 w-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
          </div>

          {/* Card Back */}
          <div
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              transformStyle: "preserve-3d",
            }}
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-zinc-950 to-zinc-900 border border-white/10 p-5 shadow-2xl flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-4 left-0 right-0 h-8 bg-zinc-800" />

            <div className="mt-10 flex flex-col gap-2 text-left">
              <div className="h-5 bg-white/5 border border-white/10 rounded px-2 flex items-center justify-end">
                <span className="font-mono text-[9px] text-muted-foreground tracking-widest">
                  EXP 2029-12-31
                </span>
              </div>
              <p className="text-[7px] text-muted-foreground/60 leading-tight">
                This card contains encrypted hospital credentials. Keep away from strong magnetic
                fields. Under constant ledger state audit.
              </p>
            </div>

            <div className="flex justify-between items-center text-[7px] text-muted-foreground">
              <span>SOLANA DEVNET STATE</span>
              <span>v2.5.4</span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="relative mt-2 w-44 h-12 flex justify-center items-center">
        <div className="absolute inset-x-0 bottom-0 h-6 bg-zinc-900 rounded-full border border-border flex items-center justify-center shadow-lg">
          <div className="w-1/2 h-1 bg-primary/40 rounded-full blur-[1px] animate-pulse" />
        </div>

        <AnimatePresence>
          {status === "idle" && (
            <>
              <motion.div
                initial={{ scale: 0.6, opacity: 0.8 }}
                animate={{ scale: [0.6, 1.8], opacity: [0.8, 0] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeOut" }}
                className="absolute bottom-3 w-16 h-8 rounded-full border border-primary/40 pointer-events-none"
              />
              <motion.div
                initial={{ scale: 0.6, opacity: 0.8 }}
                animate={{ scale: [0.6, 1.8], opacity: [0.8, 0] }}
                transition={{ repeat: Infinity, duration: 2.2, delay: 1.1, ease: "easeOut" }}
                className="absolute bottom-3 w-16 h-8 rounded-full border border-primary/30 pointer-events-none"
              />
            </>
          )}
          {(status === "reading" || status === "verifying") && (
            <motion.div
              initial={{ scale: 0.8, opacity: 1 }}
              animate={{ scale: [0.8, 2.2], opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              className="absolute bottom-3 w-16 h-8 rounded-full border-2 border-warning/60 shadow-[0_0_15px_rgba(234,179,8,0.2)] pointer-events-none"
            />
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 z-10">
        {status === "idle" && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-foreground">Ready to scan NFC Card</span>
            <span className="text-xs text-muted-foreground">
              Tap patient membership card on reader
            </span>
          </div>
        )}
        {status === "reading" && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-warning">Reading NDEF record...</span>
            <span className="text-xs text-muted-foreground">Hold card close to reader</span>
          </div>
        )}
        {status === "verifying" && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-primary">Resolving DID on ledger...</span>
            <span className="text-xs text-muted-foreground">Verifying signature details</span>
          </div>
        )}
        {status === "success" && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-success">
              Contactless Identity Verified
            </span>
            <span className="text-xs text-muted-foreground">Access log recorded on blockchain</span>
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-destructive">NFC Verification Failed</span>
            <span className="text-xs text-muted-foreground">{errorText}</span>
          </div>
        )}
      </div>
    </div>
  );
}
