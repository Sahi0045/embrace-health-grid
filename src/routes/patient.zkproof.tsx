import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { QrPlaceholder } from "@/components/QrPlaceholder";
import { useLivePatients } from "@/hooks/use-api";
import {
  generateZKProof,
  verifyZKProof,
  getDefaultClaims,
  type ZKProofClaim,
  type ZKProof,
  type ZKVerificationResult,
} from "@/lib/zkproof";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Fingerprint,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Zap,
  Layers,
  Key,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/patient/zkproof")({
  head: () => ({ meta: [{ title: "ZK Proof — Embrace Health Grid" }] }),
  component: PatientZkProofPage,
});

const CATEGORY_LABELS: Record<ZKProofClaim["category"], string> = {
  identity: "Identity",
  medical: "Medical",
  credentials: "Credentials",
};

const CATEGORY_COLORS: Record<ZKProofClaim["category"], string> = {
  identity: "text-primary bg-primary/10",
  medical: "text-chart-2 bg-chart-2/10",
  credentials: "text-success bg-success/10",
};

/** Mask a value for privacy preview */
function maskValue(value: string): string {
  if (value.length <= 2) return "●●";
  if (value.includes("·")) return value.split("·")[0].trim() + " · ●●●";
  if (value.length <= 6) return value[0] + "●".repeat(value.length - 1);
  return value.slice(0, 2) + "●●●" + value.slice(-1);
}

function PatientZkProofPage() {
  const { patients } = useLivePatients();
  const userEmail = typeof window !== "undefined" ? localStorage.getItem("userEmail") : "";
  const patientRecord =
    patients?.find((p: { email: string }) => p.email === userEmail) ?? patients?.[0];

  const [claims, setClaims] = useState<ZKProofClaim[]>([]);
  const [proof, setProof] = useState<ZKProof | null>(null);
  const [verifyResult, setVerifyResult] = useState<ZKVerificationResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showValues, setShowValues] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialise claims from patient record
  useEffect(() => {
    if (patientRecord && claims.length === 0) {
      const defaults = getDefaultClaims(patientRecord as unknown as Record<string, unknown>);
      // Default-disclose: bloodGroup, insuranceValid, hospitalPatient, vaccineStatus
      const preDisclosed = ["bloodGroup", "insuranceValid", "hospitalPatient", "vaccineStatus"];
      setClaims(defaults.map((c) => ({ ...c, disclosed: preDisclosed.includes(c.attribute) })));
    }
  }, [patientRecord]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleClaim = (attribute: string) => {
    setClaims((prev) =>
      prev.map((c) => (c.attribute === attribute ? { ...c, disclosed: !c.disclosed } : c)),
    );
    // Reset proof if claims change
    setProof(null);
    setVerifyResult(null);
  };

  const handleGenerate = async () => {
    const did = patientRecord?.did ?? "did:hosp:unknown";
    if (claims.filter((c) => c.disclosed).length === 0) {
      toast.error("Select at least one attribute to disclose");
      return;
    }
    setGenerating(true);
    setVerifyResult(null);
    try {
      // Small artificial delay to simulate circuit computation
      await new Promise((r) => setTimeout(r, 1400));
      const generated = generateZKProof(did, claims);
      setProof(generated);
      toast.success("ZK Proof generated", {
        description: `${claims.filter((c) => c.disclosed).length} attributes disclosed · ${claims.filter((c) => !c.disclosed).length} hidden`,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleVerify = async () => {
    if (!proof) return;
    setVerifying(true);
    try {
      const result = await verifyZKProof(proof);
      setVerifyResult(result);
      if (result.valid) {
        toast.success("Proof verified on-chain", { description: result.message });
      } else {
        toast.error("Proof invalid", { description: result.message });
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleCopy = () => {
    if (!proof) return;
    navigator.clipboard?.writeText(proof.proofId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categorised = (["identity", "medical", "credentials"] as const).map((cat) => ({
    cat,
    items: claims.filter((c) => c.category === cat),
  }));

  const disclosedCount = claims.filter((c) => c.disclosed).length;
  const totalCount = claims.length;

  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Privacy"
        title="Zero-Knowledge Proof"
        description="Prove facts about your identity to care providers without revealing your full medical record — powered by Groth16 on Solana Devnet."
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
            <Zap className="h-3.5 w-3.5" />
            groth16-hospital-v1
          </div>
        }
      />

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 space-y-6">
        {/* ZK Proof Simulation Disclaimer */}
        <div className="rounded-xl border border-warning-foreground/20 bg-warning/5 p-4 text-xs text-warning-foreground flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-foreground mt-0.5" />
          <div>
            <span className="font-semibold">Note on Cryptography:</span> This zero-knowledge proof circuit is simulated locally using Merkle trees and browser-based SHA-256 hashes for demonstration purposes. In production, these proofs are verified using Groth16 zk-SNARK verifier smart contracts.
          </div>
        </div>

        {/* Explainer */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Fingerprint className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                What is a Zero-Knowledge Proof?
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                A ZKP lets you <strong className="text-foreground">prove a fact</strong> (e.g. "my
                blood group is B+") without revealing any other information. The proof is anchored
                immutably on the Solana Devnet ledger. Care providers scan your proof QR — they see
                only what you choose to share.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                {[
                  { icon: Lock, label: "Selective Disclosure" },
                  { icon: Layers, label: "On-Chain Anchor" },
                  { icon: Key, label: "Cryptographic Proof" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="rounded-lg border border-border bg-muted/30 p-2">
                    <Icon className="mx-auto h-4 w-4 text-primary mb-1" />
                    <div className="text-muted-foreground font-medium">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Claim selector */}
        <div className="rounded-xl border border-border bg-card shadow-clinical overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Eye className="h-4 w-4 text-primary" />
              Select attributes to disclose
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {disclosedCount}/{totalCount} selected
              </span>
              <button
                onClick={() => setShowValues((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {showValues ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showValues ? "Hide" : "Preview"}
              </button>
            </div>
          </div>

          <div className="divide-y divide-border/50">
            {categorised.map(({ cat, items }) => (
              <div key={cat} className="px-6 py-4">
                <div
                  className={`mb-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${CATEGORY_COLORS[cat]}`}
                >
                  {CATEGORY_LABELS[cat]}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {items.map((claim) => (
                    <motion.button
                      key={claim.attribute}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => toggleClaim(claim.attribute)}
                      className={[
                        "relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-all",
                        claim.disclosed
                          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                          : "border-border bg-muted/20 hover:bg-muted/40",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate pr-1">
                          {claim.label}
                        </span>
                        <div
                          className={[
                            "h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors",
                            claim.disclosed
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/30 bg-transparent",
                          ].join(" ")}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground truncate">
                        {showValues || claim.disclosed ? claim.value : maskValue(claim.value)}
                      </span>
                      {!claim.disclosed && (
                        <span className="absolute bottom-1.5 right-2">
                          <Lock className="h-2.5 w-2.5 text-muted-foreground/40" />
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleGenerate}
          disabled={generating || disclosedCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-clinical hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {generating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Computing Groth16 proof…
            </>
          ) : proof ? (
            <>
              <RefreshCw className="h-4 w-4" />
              Regenerate proof
            </>
          ) : (
            <>
              <Fingerprint className="h-4 w-4" />
              Generate ZK proof ({disclosedCount} attributes)
            </>
          )}
        </motion.button>

        {/* Generated proof */}
        <AnimatePresence>
          {proof && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.35 }}
              className="rounded-xl border border-success/30 bg-success/5 shadow-clinical overflow-hidden"
            >
              <div className="border-b border-success/20 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  Proof ready
                </div>
                <span className="rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-semibold text-success">
                  {proof.verificationStatus === "pending" ? "Pending verification" : "Verified"}
                </span>
              </div>

              <div className="p-6 space-y-4">
                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="text-muted-foreground mb-1 uppercase tracking-wide text-[9px]">
                      Proof ID
                    </div>
                    <div className="font-mono text-foreground truncate">
                      {proof.proofId.slice(0, 28)}…
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="text-muted-foreground mb-1 uppercase tracking-wide text-[9px]">
                      Circuit
                    </div>
                    <div className="font-mono text-foreground">{proof.circuitId}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="text-muted-foreground mb-1 uppercase tracking-wide text-[9px]">
                      Merkle Root
                    </div>
                    <div className="font-mono text-foreground truncate">
                      0x{proof.merkleRoot.slice(0, 20)}…
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="text-muted-foreground mb-1 uppercase tracking-wide text-[9px]">
                      Expires
                    </div>
                    <div className="text-foreground">
                      {new Date(proof.expiresAt).toLocaleTimeString("en-IN")}
                    </div>
                  </div>
                </div>

                {/* Disclosed attributes */}
                <div>
                  <div className="mb-2 text-xs font-semibold text-foreground">
                    Disclosed attributes ({disclosedCount})
                  </div>
                  <StaggerList className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {proof.claims
                      .filter((c) => c.disclosed)
                      .map((c) => (
                        <StaggerItem key={c.attribute}>
                          <div className="rounded-lg border border-border bg-card p-2.5">
                            <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                              {c.label}
                            </div>
                            <div className="mt-0.5 text-xs font-semibold text-foreground truncate">
                              {c.value}
                            </div>
                          </div>
                        </StaggerItem>
                      ))}
                  </StaggerList>
                  {proof.claims.filter((c) => !c.disclosed).length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      {proof.claims.filter((c) => !c.disclosed).length} attribute(s)
                      cryptographically hidden
                    </div>
                  )}
                </div>

                {/* QR */}
                <div className="flex flex-col items-center gap-2">
                  <div className="text-xs font-semibold text-foreground">Scan to verify</div>
                  <QrPlaceholder value={proof.proofId} size={140} />
                  <div className="text-[10px] text-muted-foreground">
                    Share this QR with care providers
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? "Copied!" : "Copy Proof ID"}
                  </button>
                  <button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {verifying ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Verifying…
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" /> Verify on-chain
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verification result */}
        <AnimatePresence>
          {verifyResult && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className={[
                "rounded-xl border shadow-clinical p-6 space-y-4",
                verifyResult.valid
                  ? "border-success/30 bg-success/5"
                  : "border-destructive/30 bg-destructive/5",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                {verifyResult.valid ? (
                  <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
                )}
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {verifyResult.valid ? "Proof Verified" : "Proof Invalid"}
                  </div>
                  <div className="text-xs text-muted-foreground">{verifyResult.message}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">
                    Block Hash
                  </div>
                  <div className="font-mono text-foreground truncate">
                    {verifyResult.blockHash.slice(0, 26)}…
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">
                    Verified at
                  </div>
                  <div className="text-foreground">
                    {new Date(verifyResult.verifiedAt).toLocaleTimeString("en-IN")}
                  </div>
                </div>
              </div>

              {verifyResult.valid && Object.keys(verifyResult.disclosedAttributes).length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold text-foreground">
                    Verified attributes
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(verifyResult.disclosedAttributes).map(([key, val]) => (
                      <div
                        key={key}
                        className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5"
                      >
                        <ChevronRight className="h-3 w-3 text-success shrink-0" />
                        <div>
                          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                            {key}
                          </div>
                          <div className="text-xs font-semibold text-foreground truncate">
                            {val}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </RouteGuard>
  );
}
