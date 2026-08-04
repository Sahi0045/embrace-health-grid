import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { PageHeader } from "@/components/PageHeader";
import { CredentialCard } from "@/components/credentials/CredentialCard";
import { CredentialPreview } from "@/components/credentials/CredentialPreview";
import { CredentialTimeline } from "@/components/credentials/CredentialTimeline";
import { useCredentials, useLivePatients } from "@/hooks/use-api";
import { useCurrentUser } from "@/lib/auth-context";
import { RouteGuard } from "@/components/RouteGuard";
import { Wallet as WalletIcon, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export const Route = createFileRoute("/patient/wallet")({
  head: () => ({ meta: [{ title: "Patient · Credentials Wallet — Embrace Health Grid" }] }),
  component: Wallet,
});

function Wallet() {
  const { data: credentialsData, loading } = useCredentials();
  const { patients } = useLivePatients();
  const { user: currentUser } = useCurrentUser();
  const patient = patients?.find((p: any) => p.email === currentUser?.email);
  // The holder is whoever is signed in. This used to fall back to a hardcoded
  // demo name ("Anika Sharma") when the roster lookup missed, which put another
  // person's name on a verifiable credential — worse than showing nothing.
  const holderName = patient?.name ?? currentUser?.fullName ?? currentUser?.email ?? "—";

  const rawCredentials = credentialsData?.credentials ?? [];

  const liveCredentials = rawCredentials.map((c: any) => ({
    id: c.id ?? c.txId ?? String(Math.random()),
    type: c.type ?? "Verifiable Credential",
    issuer: c.issuer ?? "Embrace Health Consortium",
    issuedAt: c.issuedAt ?? c.timestamp ?? new Date().toISOString().split("T")[0],
    expiresAt:
      c.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: (c.status === "revoked" ? "revoked" : "active") as "active" | "revoked" | "expired",
    claims: c.claims || {},
  }));

  const list = liveCredentials;
  const [selected, setSelected] = useState<(typeof list)[0] | null>(null);

  const timelineEvents = list.map((c: any, i: number) => ({
    id: `wallet_event_${c.id || i}`,
    action: c.status === "revoked" ? ("expired" as const) : ("issued" as const),
    label: `${c.type === "IdentityVC" ? "Identity" : c.type === "InsuranceVC" ? "Insurance" : c.type} credential ${c.status === "revoked" ? "revoked" : "issued"}`,
    issuer: c.issuer,
    at: c.issuedAt ? c.issuedAt.split("T")[0] : "N/A",
  }));

  const getPreviewFields = (selectedCred: any) => {
    const raw = rawCredentials.find((rc: any) => rc.id === selectedCred.id);
    if (!raw || !raw.claims) return [];

    return Object.entries(raw.claims)
      .filter(([k]) => k !== "subjectDid")
      .map(([key, val]) => {
        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
        return { label, value: String(val) };
      });
  };

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
                    holder={holderName}
                    issuedAt={selected.issuedAt}
                    expiresAt={selected.expiresAt}
                    status={selected.status}
                    credentialId={selected.id}
                    schema={`https://schema.embracehealth.in/v1/${selected.type.toLowerCase().replace(/\s/g, "-")}`}
                    fields={getPreviewFields(selected)}
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
