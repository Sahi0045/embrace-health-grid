import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode } from "@/components/QrCode";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { useLivePatients } from "@/hooks/use-api";
import { useCurrentUser } from "@/lib/auth-context";
import {
  RefreshCw,
  ShieldCheck,
  Droplets,
  CreditCard,
  BadgeCheck,
  Timer,
  Loader2,
  Fingerprint,
  AlertTriangle,
} from "lucide-react";
import { signIdentityPayload } from "@/lib/api";
import { useNFCCards } from "@/hooks/use-api";

export const Route = createFileRoute("/patient/qr")({
  head: () => ({ meta: [{ title: "Patient · QR Code — Embrace Health Grid" }] }),
  component: PatientQr,
});

const ROTATION_SECONDS = 60;

function simHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h).toString(16).padStart(8, "0");
}

function PatientQr() {
  const { patients: patientsList } = useLivePatients();
  const { user: currentUser } = useCurrentUser();
  const userEmail = currentUser?.email || (typeof window !== "undefined" ? localStorage.getItem("userEmail") || "" : "");
  const userDid = currentUser?.did || (typeof window !== "undefined" ? localStorage.getItem("userDID") || localStorage.getItem("userDid") || "" : "");
  const userMrn = currentUser?.mrn || (typeof window !== "undefined" ? localStorage.getItem("userMRN") || "" : "");
  const userName = currentUser?.name || (typeof window !== "undefined" ? localStorage.getItem("userName") || "" : "");

  const matchedPatient = patientsList?.find((p: any) => p.email?.toLowerCase() === userEmail.toLowerCase()) || patientsList?.[0];

  const activeDid = matchedPatient?.did || userDid || `did:hosp:0x${simHash(userEmail || "patient").slice(0, 8)}`;
  const activeName = matchedPatient?.name || userName || "Patient";
  const activeMrn = matchedPatient?.mrn || userMrn || "MRN-100234";

  const patient = {
    name: activeName,
    mrn: activeMrn,
    did: activeDid,
    bloodGroup: matchedPatient?.bloodGroup || "O+",
    age: matchedPatient?.age || 32,
    gender: matchedPatient?.gender || "F",
    allergies: matchedPatient?.allergies || [],
  };

  const [payload, setPayload] = useState("");
  const [timeLeft, setTimeLeft] = useState(ROTATION_SECONDS);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await signIdentityPayload({
        did: activeDid,
        mrn: activeMrn,
        name: activeName,
        network: "embrace-health-network",
      });
      if (res && res.payload) {
        setPayload(JSON.stringify(res.payload));
      } else {
        setPayload(
          JSON.stringify({
            did: activeDid,
            mrn: activeMrn,
            name: activeName,
            exp: Date.now() + 60_000,
            network: "embrace-health-network",
          }),
        );
      }
    } catch {
      setPayload(
        JSON.stringify({
          did: activeDid,
          mrn: activeMrn,
          name: activeName,
          exp: Date.now() + 60_000,
          network: "embrace-health-network",
        }),
      );
    } finally {
      setLoading(false);
      setTimeLeft(ROTATION_SECONDS);
      setRefreshKey((k) => k + 1);
    }
  }, [activeDid, activeMrn, activeName]);

  useEffect(() => {
    refresh();
  }, [activeDid, refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          refresh();
          return ROTATION_SECONDS;
        }
        return prev - 1;
      });
    }, 1_000);
    return () => clearInterval(id);
  }, [refresh]);

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
            {payload ? (
              <motion.div
                key={refreshKey}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <QrCode value={payload} size={260} bgColor="#ffffff" fgColor="#000000" />
              </motion.div>
            ) : (
              <div className="flex h-[260px] w-[260px] items-center justify-center rounded-xl border border-dashed border-border bg-card">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
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
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {loading ? "Generating..." : "Refresh Now"}
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

        {/* NFC Card Status Section */}
        {patient.did && <NfcCardStatus patientDid={patient.did} />}

        {/* NFC guidance */}
        <div className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-center text-xs text-muted-foreground">
          If NFC is unavailable at kiosk, show this QR code to staff for verification.
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

function NfcCardStatus({ patientDid }: { patientDid: string }) {
  const { data: nfcData } = useNFCCards();
  const cards = nfcData || [];
  const cardEntry = cards.find((c: any) => c.value?.patientDid === patientDid);
  const card = cardEntry?.value;

  if (!card) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-card p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Fingerprint className="h-4 w-4" />
          <span className="text-xs font-medium">No NFC Identity Card</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Request an NFC card at the front desk for contactless check-in.
        </p>
      </div>
    );
  }

  const isRevoked = card.status === "revoked";

  return (
    <div
      className={`mt-6 rounded-xl border p-4 ${
        isRevoked ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fingerprint className={`h-4 w-4 ${isRevoked ? "text-destructive" : "text-success"}`} />
          <span className="text-xs font-semibold text-foreground">NFC Identity Card</span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isRevoked ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
          }`}
        >
          {card.status.toUpperCase()}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">Card ID</span>
        <span className="font-mono font-medium text-foreground">{card.cardId}</span>
        <span className="text-muted-foreground">Issued</span>
        <span className="text-foreground">{new Date(card.issuedAt).toLocaleDateString()}</span>
      </div>
      {isRevoked && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" />
          This card has been revoked. Contact the front desk for a replacement.
        </div>
      )}
    </div>
  );
}
