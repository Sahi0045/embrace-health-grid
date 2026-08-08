import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { DIDCard } from "@/components/did/DIDCard";
import { DIDStatusChip } from "@/components/did/DIDStatusChip";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import {
  Search,
  ShieldCheck,
  User,
  Stethoscope,
  Bed,
  Wrench,
  Ambulance,
  Fingerprint,
  RefreshCw,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDIDs, useAudit, useNFCCards } from "~/lib/admin-hooks";
import { adminCurrentUser } from "~/lib/supabase";
import {
  adminIssueNFCCard as issueNFCCard,
  adminRevokeNFCCard as revokeNFCCard,
} from "~/lib/admin-api";
import { toast } from "sonner";

export const Route = createFileRoute("/did-explorer")({
  head: () => ({ meta: [{ title: "DID Explorer — DID Hospital" }] }),
  component: DIDExplorerPage,
});

type DIDSearchType = "patient" | "doctor" | "nurse" | "admin" | "resource";

interface DIDResult {
  did: string;
  subject: string;
  type: DIDSearchType;
  status: "active" | "revoked" | "suspended";
  issuedAt: string;
  linkedCredentials: number;
  description: string;
}

const typeConfig: Record<
  DIDSearchType,
  { icon: React.ComponentType<{ className?: string }>; label: string; color: string }
> = {
  patient: { icon: User, label: "Patient", color: "text-primary" },
  doctor: { icon: Stethoscope, label: "Doctor", color: "text-chart-2" },
  nurse: { icon: User, label: "Nurse", color: "text-success" },
  admin: { icon: ShieldCheck, label: "Admin", color: "text-chart-4" },
  resource: { icon: Wrench, label: "Resource", color: "text-destructive" },
};

function DIDExplorerPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DIDSearchType | "all">("all");
  const [selected, setSelected] = useState<DIDResult | null>(null);
  const [viewMode, setViewMode] = useState<"dids" | "nfc">("dids");
  const [cardToRevoke, setCardToRevoke] = useState<string | null>(null);

  // Async because the profile is read from Postgres rather than local storage.
  const [currentUser, setCurrentUser] = useState<{ did: string | null; role: string } | null>(null);
  useEffect(() => {
    void adminCurrentUser().then(setCurrentUser);
  }, []);
  const isAdmin = currentUser?.role === "admin";

  const { data: didsData } = useDIDs();
  const { data: auditData } = useAudit();
  const { data: nfcCardsData, refetch: refetchNFCCards } = useNFCCards();
  // useNFCCards now returns { entries: [...] } from Postgres.
  const nfcCards = nfcCardsData?.entries ?? [];

  const patientCardEntry = selected
    ? nfcCards.find((c: any) => c.value?.patientDid === selected.did)
    : null;
  const patientCard = patientCardEntry?.value;

  const registryDIDs: DIDResult[] = (didsData?.dids ?? []).map((d: any) => {
    let t: DIDSearchType = "patient";
    const role = d.role || d.ownerType || "";
    if (role === "doctor" || role === "staff") t = "doctor";
    else if (role === "nurse") t = "nurse";
    else if (role === "admin") t = "admin";

    return {
      did: d.did || d.id || "",
      subject: d.ownerName || d.owner || "Anonymous Subject",
      type: t,
      status: (d.status === "active"
        ? "active"
        : d.status === "revoked"
          ? "revoked"
          : "suspended") as DIDResult["status"],
      issuedAt: d.createdAt ? d.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
      linkedCredentials: d.extraFields?.credentials ?? (role === "patient" ? 2 : 5),
      description: `${role.toUpperCase() || "USER"} · ${d.owner || "Anonymous"} · Active Identity`,
    };
  });

  const filtered = registryDIDs.filter(
    (d) =>
      (typeFilter === "all" || d.type === typeFilter) &&
      ((d.did || "").toLowerCase().includes(query.toLowerCase()) ||
        (d.subject || "").toLowerCase().includes(query.toLowerCase()) ||
        (d.description || "").toLowerCase().includes(query.toLowerCase())),
  );

  const filteredNfcCards = nfcCards.filter((c: any) => {
    const val = c.value || {};
    return (
      (val.cardId || "").toLowerCase().includes(query.toLowerCase()) ||
      (val.patientName || "").toLowerCase().includes(query.toLowerCase()) ||
      (val.patientDid || "").toLowerCase().includes(query.toLowerCase()) ||
      (val.issuedBy || "").toLowerCase().includes(query.toLowerCase())
    );
  });

  const handleSelectNfcCard = (cardVal: any) => {
    const foundDid = registryDIDs.find((d) => d.did === cardVal.patientDid);
    if (foundDid) {
      setSelected(foundDid);
    } else {
      setSelected({
        did: cardVal.patientDid,
        subject: cardVal.patientName,
        type: "patient",
        status: "active",
        issuedAt: cardVal.issuedAt.split("T")[0],
        linkedCredentials: 1,
        description: `PATIENT · ${cardVal.patientName} · NFC Registered`,
      });
    }
  };

  const activityEvents = (auditData?.events ?? []).slice(0, 20).map((e: any) => ({
    id: e.txId || e.id,
    category: e.category || "access",
    action: e.action || "Viewed Record",
    actor: e.actor || "System",
    actorRole: "Staff",
    actorDID: e.actorDID || "did:hosp:sys",
    target: e.resource || "Ledger",
    ip: "10.0.1.44",
    result: "success" as const,
    severity: "info" as const,
    at: e.loggedAt || new Date().toISOString(),
    details: e.details || "",
    hash: e.txId || "sha256:hash",
  }));

  return (
    <div className="min-h-screen">
      <PageHeader
        eyebrow="Global"
        title="DID Explorer"
        description="Search and inspect all DID records across the hospital network"
      />

      <div className="p-6 space-y-5">
        {/* View Mode Tabs (Admin Only) */}
        {isAdmin && (
          <div className="flex border-b border-border/80 gap-4 mb-2">
            <button
              onClick={() => setViewMode("dids")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors -mb-[2px] ${viewMode === "dids" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              DID Registry
            </button>
            <button
              onClick={() => {
                setViewMode("nfc");
                void refetchNFCCards();
              }}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors -mb-[2px] ${viewMode === "nfc" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              NFC Cards Registry
            </button>
          </div>
        )}

        {/* Search bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-clinical flex-1 min-w-64">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                viewMode === "nfc"
                  ? "Search Card ID, Name, DID..."
                  : "Search DID, subject, or description..."
              }
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Type filters (Only show when in DID mode) */}
          {viewMode === "dids" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setTypeFilter("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${typeFilter === "all" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground"}`}
              >
                All
              </button>
              {(
                Object.entries(typeConfig) as [DIDSearchType, (typeof typeConfig)[DIDSearchType]][]
              ).map(([type, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${typeFilter === type ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground"}`}
                  >
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Results List */}
          {viewMode === "nfc" ? (
            <div className="lg:col-span-3 space-y-3">
              <div className="text-xs text-muted-foreground">
                {filteredNfcCards.length} cards found
              </div>
              {filteredNfcCards.map((c: any) => {
                const cardVal = c.value || {};
                const isSelected = selected?.did === cardVal.patientDid;
                return (
                  <motion.div
                    key={cardVal.cardId}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleSelectNfcCard(cardVal)}
                    className={`cursor-pointer rounded-xl border bg-card p-4 shadow-clinical hover:shadow-clinical-md transition-all ${isSelected ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Fingerprint
                          className={`h-4 w-4 ${cardVal.status === "active" ? "text-success" : "text-destructive"}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">
                            {cardVal.patientName}
                          </span>
                          <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {cardVal.cardId}
                          </span>
                          <span
                            className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${cardVal.status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                          >
                            {cardVal.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-muted-foreground truncate">
                          {cardVal.patientDid}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Issued by {cardVal.issuedBy}
                        </div>
                      </div>
                      <div className="text-right shrink-0 text-[10px] text-muted-foreground">
                        {new Date(cardVal.issuedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {filteredNfcCards.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-12 text-center">
                  <Fingerprint className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <div className="text-sm font-medium text-muted-foreground">
                    No NFC Cards registered for "{query}"
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="lg:col-span-3 space-y-3">
              <div className="text-xs text-muted-foreground">{filtered.length} results</div>
              {filtered.map((did) => {
                const cfg = typeConfig[did.type];
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={did.did}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelected(selected?.did === did.did ? null : did)}
                    className={`cursor-pointer rounded-xl border bg-card p-4 shadow-clinical hover:shadow-clinical-md transition-all ${selected?.did === did.did ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">
                            {did.subject}
                          </span>
                          <span className={`text-[10px] font-medium ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <DIDStatusChip status={did.status} size="sm" />
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {did.did}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {did.description}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-foreground">
                          {did.linkedCredentials} creds
                        </div>
                        <div className="text-[10px] text-muted-foreground">{did.issuedAt}</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {filtered.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-12 text-center">
                  <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <div className="text-sm font-medium text-muted-foreground">
                    No DIDs found for "{query}"
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right panel */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={selected.did}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <DIDCard
                    did={selected.did}
                    subject={selected.subject}
                    role={
                      selected.type === "patient" || selected.type === "doctor"
                        ? selected.type
                        : "equipment"
                    }
                    subLabel={selected.description}
                    status={selected.status}
                  />

                  {/* NFC Card Management Component (Admin Only for Patients) */}
                  {selected.type === "patient" && isAdmin && (
                    <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-clinical">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Fingerprint className="h-4 w-4 text-primary animate-pulse" />
                          NFC Card Management
                        </div>
                        {patientCard ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${patientCard.status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                          >
                            {patientCard.status.toUpperCase()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground">
                            UNREGISTERED
                          </span>
                        )}
                      </div>

                      {patientCard ? (
                        <div className="space-y-2 text-xs">
                          <div className="grid grid-cols-3 py-1.5 border-b border-border/40">
                            <span className="text-muted-foreground">Card ID</span>
                            <span className="col-span-2 font-mono font-medium text-foreground">
                              {patientCard.cardId}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 py-1.5 border-b border-border/40">
                            <span className="text-muted-foreground">Issued At</span>
                            <span className="col-span-2 text-foreground">
                              {new Date(patientCard.issuedAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 py-1.5 border-b border-border/40">
                            <span className="text-muted-foreground">Issued By</span>
                            <span className="col-span-2 text-foreground">
                              {patientCard.issuedBy}
                            </span>
                          </div>
                          {patientCard.status === "revoked" && patientCard.revokedAt && (
                            <div className="grid grid-cols-3 py-1.5 border-b border-border/40 bg-destructive/5 px-1 rounded-sm">
                              <span className="text-destructive font-medium">Revoked At</span>
                              <span className="col-span-2 text-destructive font-medium">
                                {new Date(patientCard.revokedAt).toLocaleString()}
                              </span>
                            </div>
                          )}

                          {patientCard.status === "active" ? (
                            <button
                              onClick={() => setCardToRevoke(patientCard.cardId)}
                              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-white hover:bg-destructive/90 transition-colors shadow-clinical"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Revoke Identity Card
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await issueNFCCard({
                                    patientDid: selected.did,
                                    patientName: selected.subject,
                                    mrn: `MRN-${selected.did.slice(-6).toUpperCase()}`,
                                  });
                                  toast.success("NFC Card Issued", {
                                    description: `New Card ${res.card.cardId} registered.`,
                                  });
                                  void refetchNFCCards();
                                } catch (err: any) {
                                  toast.error("Failed to issue card", { description: err.message });
                                }
                              }}
                              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-clinical"
                            >
                              <Fingerprint className="h-3.5 w-3.5" />
                              Issue New Card
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-4 space-y-3">
                          <p className="text-xs text-muted-foreground">
                            This patient has no active NFC Identity Card registered.
                          </p>
                          <button
                            onClick={async () => {
                              try {
                                const res = await issueNFCCard({
                                  patientDid: selected.did,
                                  patientName: selected.subject,
                                  mrn: `MRN-${selected.did.slice(-6).toUpperCase()}`,
                                });
                                toast.success("NFC Card Issued", {
                                  description: `New Card ${res.card.cardId} registered.`,
                                });
                                void refetchNFCCards();
                              } catch (err: any) {
                                toast.error("Failed to issue card", { description: err.message });
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-clinical"
                          >
                            <Fingerprint className="h-3.5 w-3.5" />
                            Issue NFC Identity Card
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 rounded-xl border border-border bg-card p-4">
                    <div className="text-xs font-semibold text-foreground mb-3">
                      Activity Timeline
                    </div>
                    <AuditTimeline events={activityEvents} limit={8} />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl border border-dashed border-border p-10 text-center"
                >
                  <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <div className="text-sm text-muted-foreground">Select a DID to view details</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Activity feed */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-semibold text-foreground mb-3">Network Activity</div>
              <AuditTimeline events={activityEvents} limit={6} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Professional Revocation Confirm Dialog ── */}
      <AnimatePresence>
        {cardToRevoke && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-clinical-md"
            >
              <div className="flex items-center gap-3 text-destructive">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Revoke Identity Card</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground animate-pulse-subtle">
                Are you sure you want to revoke this NFC card (
                <span className="font-mono font-medium text-foreground">{cardToRevoke}</span>)? This
                action is permanent and will prevent any future authentication using this card.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setCardToRevoke(null)}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const id = cardToRevoke;
                    setCardToRevoke(null);
                    try {
                      await revokeNFCCard(id);
                      toast.success("NFC Card Revoked", {
                        description: `Card ${id} was successfully deactivated.`,
                      });
                      void refetchNFCCards();
                    } catch (err: any) {
                      toast.error("Failed to revoke card", { description: err.message });
                    }
                  }}
                  className="rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-white hover:bg-destructive/90 transition-colors shadow-clinical cursor-pointer"
                >
                  Revoke Card
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
