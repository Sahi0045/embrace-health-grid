import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { PageHeader } from "@/components/PageHeader";
import { CredentialCard } from "@/components/credentials/CredentialCard";
import { CredentialPreview } from "@/components/credentials/CredentialPreview";
import { CredentialTimeline } from "@/components/credentials/CredentialTimeline";
import { useFabricCredentials } from "@/hooks/use-fabric";
import { RouteGuard } from "@/components/RouteGuard";
import { Wallet as WalletIcon, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { credentials } from "@/lib/mock-data";

export const Route = createFileRoute("/patient/wallet")({
  head: () => ({ meta: [{ title: "Patient · Credentials Wallet — DID Hospital" }] }),
  component: Wallet,
});

const timelineEvents = [
  {
    id: "t1",
    action: "issued" as const,
    label: "Patient Identity credential issued",
    issuer: "Apollo Hospitals",
    at: "2025-01-12",
  },
  {
    id: "t2",
    action: "verified" as const,
    label: "Identity verified at OPD check-in",
    issuer: "Apollo Hospitals OPD Desk",
    at: "2025-06-02",
  },
  {
    id: "t3",
    action: "issued" as const,
    label: "Health Insurance credential issued",
    issuer: "Star Health Insurance",
    at: "2025-04-02",
  },
  {
    id: "t4",
    action: "verified" as const,
    label: "Insurance verified for cashless admission",
    issuer: "Apollo Billing Dept.",
    at: "2025-11-18",
  },
  {
    id: "t5",
    action: "expired" as const,
    label: "Lab Report Access credential expired",
    issuer: "Apollo Diagnostics",
    at: "2025-09-21",
  },
];

const previewFields: Record<string, { label: string; value: string }[]> = {
  c1: [
    { label: "Full Name", value: "Anika Sharma" },
    { label: "MRN", value: "MRN-204871" },
    { label: "Blood Group", value: "O+" },
    { label: "Date of Birth", value: "1992-03-14" },
  ],
  c2: [
    { label: "Policy No.", value: "POL-2025-STAR-00881" },
    { label: "Sum Insured", value: "₹10,00,000" },
    { label: "Coverage Type", value: "Comprehensive" },
  ],
  c3: [
    { label: "Vaccines", value: "COVID-19, Hep-B, Tetanus, OPV" },
    { label: "Issuing Authority", value: "Govt. of India — NHM" },
    { label: "Last Updated", value: "2024-03-10" },
  ],
  c4: [
    { label: "Lab", value: "Apollo Diagnostics" },
    { label: "Tests", value: "CBC, HbA1c, Lipid Panel" },
    { label: "Report Date", value: "2025-03-21" },
  ],
};

function Wallet() {
  const { data: credentialsData, loading } = useFabricCredentials();
  const rawCredentials = credentialsData?.credentials ?? [];

  const liveCredentials = rawCredentials.map((c: any) => ({
    id: c.id ?? c.txId ?? String(Math.random()),
    type: c.type ?? "Verifiable Credential",
    issuer: c.issuer ?? "Apollo Hospitals",
    issuedAt: c.issuedAt ?? c.timestamp ?? "2025-01-12",
    expiresAt: c.expiresAt ?? "2026-01-12",
    status: (c.status === "revoked" ? "revoked" : "active") as "active" | "revoked" | "expired",
  }));

  // Use live credentials; fall back to empty mock array (defined in mock-data)
  const list = liveCredentials.length > 0 ? liveCredentials : credentials;
  const [selected, setSelected] = useState<(typeof list)[0] | null>(null);

  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Patient app"
        title="Credentials Wallet"
        description={`${list.length} verifiable credentials · secured by Ed25519`}
        actions={
          <div className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            <ShieldCheck className="h-3.5 w-3.5" />
            All credentials verified
          </div>
        }
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 space-y-6">
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
            Loading credentials from Solana Devnet…
          </div>
        )}

        {/* Empty state */}
        {!loading && list.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-16 text-center"
          >
            <WalletIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <div className="text-sm font-semibold text-foreground">No credentials found</div>
            <div className="text-xs text-muted-foreground mt-1">
              Your verifiable credentials will appear here once issued by a healthcare provider
            </div>
          </motion.div>
        )}

        {/* Credential cards + preview */}
        {!loading && list.length > 0 && (
          <>
            <StaggerList className="grid gap-3 sm:grid-cols-2">
              {list.map((c: any) => (
                <StaggerItem key={c.id}>
                  <CredentialCard
                    id={c.id}
                    type={c.type}
                    issuer={c.issuer}
                    issuedAt={c.issuedAt}
                    expiresAt={c.expiresAt}
                    status={c.status}
                    onClick={() => setSelected(selected?.id === c.id ? null : c)}
                  />
                </StaggerItem>
              ))}
            </StaggerList>

            {/* Expanded credential preview */}
            <AnimatePresence mode="wait">
              {selected && (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-foreground">
                      Credential Preview
                    </span>
                    <button
                      onClick={() => setSelected(null)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <CredentialPreview
                    type={selected.type}
                    issuer={selected.issuer}
                    holder="Anika Sharma"
                    issuedAt={selected.issuedAt}
                    expiresAt={selected.expiresAt}
                    status={selected.status}
                    credentialId={selected.id}
                    schema={`https://schema.did-hospital.in/v1/${selected.type.toLowerCase().replace(/\s/g, "-")}`}
                    fields={previewFields[selected.id]}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Timeline – always visible */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <WalletIcon className="h-4 w-4 text-primary" />
            Credential Activity Timeline
          </div>
          <CredentialTimeline events={timelineEvents} />
        </div>
      </div>
    </RouteGuard>
  );
}
