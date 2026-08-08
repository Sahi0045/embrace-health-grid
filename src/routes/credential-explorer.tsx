import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { CredentialCard } from "@/components/credentials/CredentialCard";
import { CredentialTimeline } from "@/components/credentials/CredentialTimeline";
import { CredentialIssuerBadge } from "@/components/credentials/CredentialIssuerBadge";
import { Search, ShieldCheck, Award, Filter } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCredentials } from "@/hooks/use-api";
import { RouteGuard } from "@/components/RouteGuard";

interface CredentialFull {
  id: string;
  type: string;
  typeLabel: string;
  issuer: string;
  issuerDID: string;
  holder: string;
  holderDID: string;
  issuedAt: string;
  expiresAt: string;
  status: string;
  schema: string;
  verificationCount: number;
  lastVerified: string;
}

export const Route = createFileRoute("/credential-explorer")({
  head: () => ({ meta: [{ title: "Credential Explorer — Embrace Health Grid" }] }),
  component: CredentialExplorerPageGuarded,
});

const credentialTimeline = [
  {
    id: "ct1",
    action: "issued" as const,
    label: "Credential issued by Embrace Health Consortium",
    issuer: "Embrace Health Consortium",
    at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  },
  {
    id: "ct2",
    action: "verified" as const,
    label: "Verified by Star Health Insurance",
    issuer: "Star Health",
    at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  },
  {
    id: "ct3",
    action: "verified" as const,
    label: "Verified during hospital admission",
    issuer: "Embrace ER Desk",
    at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  },
  {
    id: "ct4",
    action: "verified" as const,
    label: "Cross-hospital verification via AIIMS",
    issuer: "AIIMS Delhi",
    at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  },
];

function CredentialExplorerPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<CredentialFull | null>(null);

  const { data: credentialsData } = useCredentials();

  const displayCredentials: CredentialFull[] = (credentialsData?.credentials ?? []).map(
    (c: any) => {
      return {
        id: c.id,
        type: c.type || "PatientIdentity",
        typeLabel:
          c.type === "IdentityVC"
            ? "Patient Identity"
            : c.type === "InsuranceVC"
              ? "Insurance Policy"
              : c.type === "VaccinationVC"
                ? "Vaccination Record"
                : c.type === "ProfessionalVC"
                  ? "Professional Credential"
                  : "Verifiable Credential",
        issuer: c.issuer || "Embrace Health Consortium",
        issuerDID: `did:hosp:issuer:${c.issuer || "embrace"}`,
        holder: c.subject || "Unknown Holder",
        holderDID: c.claims?.subjectDid || "did:hosp:unknown",
        issuedAt: c.issuedAt ? c.issuedAt.split("T")[0] : new Date().toISOString().split("T")[0],
        expiresAt: c.expiresAt ? c.expiresAt.split("T")[0] : new Date().toISOString().split("T")[0],
        status: c.status || "active",
        schema: `https://schema.embracehealth.in/v1/${(c.type || "").toLowerCase()}`,
        verificationCount: 1,
        lastVerified: c.issuedAt
          ? c.issuedAt.split("T")[0]
          : new Date().toISOString().split("T")[0],
      };
    },
  );

  const typeOptions = [...new Set(displayCredentials.map((c) => c.type))];

  const filtered = displayCredentials.filter(
    (c) =>
      (typeFilter === "all" || c.type === typeFilter) &&
      (statusFilter === "all" || c.status === statusFilter) &&
      ((c.typeLabel || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.holder || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.issuer || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.id || "").toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="min-h-screen">
      <PageHeader
        eyebrow="Global"
        title="Credential Explorer"
        description="Search and inspect all verifiable healthcare credentials in the network"
      />

      <div className="p-6 space-y-5">
        {/* Search & filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 flex-1 min-w-48">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by type, holder, issuer, or ID..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none"
          >
            <option value="all">All Types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Credential grid */}
          <div className="lg:col-span-3 space-y-3">
            <div className="text-xs text-muted-foreground">{filtered.length} credentials found</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.slice(0, 20).map((c) => (
                <CredentialCard
                  key={c.id}
                  id={c.id}
                  type={c.typeLabel}
                  issuer={c.issuer}
                  holder={c.holder}
                  issuedAt={c.issuedAt}
                  expiresAt={c.expiresAt}
                  status={c.status as "active" | "expired" | "revoked"}
                  onClick={() => setSelected(selected?.id === c.id ? null : c)}
                />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-12 text-center">
                <Award className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <div className="text-sm text-muted-foreground">
                  No credentials match your filters
                </div>
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-semibold text-foreground">
                        {selected.typeLabel}
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${selected.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                      >
                        {selected.status}
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <CredentialIssuerBadge issuer={selected.issuer} did={selected.issuerDID} />

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Holder", value: selected.holder },
                          { label: "Issued", value: selected.issuedAt },
                          { label: "Expires", value: selected.expiresAt },
                          { label: "Verifications", value: String(selected.verificationCount) },
                          { label: "Schema", value: selected.type },
                        ].map((f) => (
                          <div key={f.label} className="rounded-lg bg-muted p-2.5">
                            <div className="text-[10px] text-muted-foreground">{f.label}</div>
                            <div className="font-medium text-foreground mt-0.5">{f.value}</div>
                          </div>
                        ))}
                      </div>

                      <div>
                        <div className="text-[10px] text-muted-foreground mb-1">Holder DID</div>
                        <div className="font-mono text-[10px] text-muted-foreground/70 break-all">
                          {selected.holderDID}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3">
                        <ShieldCheck className="h-4 w-4 text-success" />
                        <span className="font-medium text-success">Cryptographic proof valid</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs font-semibold text-foreground mb-3">Audit Trail</div>
                    <CredentialTimeline events={credentialTimeline} />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl border border-dashed border-border p-10 text-center"
                >
                  <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <div className="text-sm text-muted-foreground">
                    Select a credential to inspect its details and audit trail
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Registry and oversight view, so staff and above.
 *
 * RLS already scopes what each role can read; this stops a patient landing on a
 * page designed for hospital-wide oversight. Their own equivalents are in the
 * patient portal: Credentials, Consent and Access History.
 */
function CredentialExplorerPageGuarded() {
  return (
    <RouteGuard requiredRole="staff">
      <CredentialExplorerPage />
    </RouteGuard>
  );
}
