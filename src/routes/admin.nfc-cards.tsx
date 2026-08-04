import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAdminNfcCards as useNFCCards, useLivePatients } from "@/hooks/use-admin";
import { issueNFCCard, revokeNFCCard } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  Search,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  RefreshCw,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/admin/nfc-cards")({
  head: () => ({
    meta: [{ title: "NFC Card Management — Admin Console" }],
  }),
  component: NfcCardsGuarded,
});

function NfcCards() {
  const { data: nfcCardsData, loading, refetch: refetchNFCCards } = useNFCCards();
  const { patients: patientsList } = useLivePatients();
  // useNFCCards now returns { entries: [...] } from Postgres.
  const cards = (nfcCardsData?.entries ?? []).map((entry: any) => entry.value);
  const patients = patientsList ?? [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("all");
  const [cardToRevoke, setCardToRevoke] = useState<string | null>(null);
  const [issuePatientDid, setIssuePatientDid] = useState("");
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const filteredCards = cards.filter((card: any) => {
    const matchSearch =
      card.cardId?.toLowerCase().includes(search.toLowerCase()) ||
      card.patientName?.toLowerCase().includes(search.toLowerCase()) ||
      card.mrn?.toLowerCase().includes(search.toLowerCase()) ||
      card.patientDid?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || card.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCount = cards.filter((c: any) => c.status === "active").length;
  const revokedCount = cards.filter((c: any) => c.status === "revoked").length;

  const handleIssue = async () => {
    if (!issuePatientDid) {
      toast.error("Please select a patient.");
      return;
    }
    const patient = patients.find((p: any) => p.did === issuePatientDid);
    if (!patient) {
      toast.error("Patient not found.");
      return;
    }
    setIssuing(true);
    try {
      const res = await issueNFCCard({
        patientDid: patient.did,
        patientName: patient.name,
        mrn: patient.mrn,
      });
      toast.success("NFC Card Issued", {
        description: `Card ${res.card.cardId} registered for ${patient.name}.`,
      });
      setShowIssueForm(false);
      setIssuePatientDid("");
      void refetchNFCCards();
    } catch (err: any) {
      toast.error("Failed to issue card", { description: err.message });
    } finally {
      setIssuing(false);
    }
  };

  const handleRevoke = async (cardId: string) => {
    setCardToRevoke(null);
    try {
      await revokeNFCCard(cardId);
      toast.success("NFC Card Revoked", {
        description: `Card ${cardId} has been permanently deactivated.`,
      });
      void refetchNFCCards();
    } catch (err: any) {
      toast.error("Failed to revoke card", { description: err.message });
    }
  };

  return (
    <RouteGuard requiredRole="admin">
      <PageHeader
        eyebrow="Identity Infrastructure"
        title="NFC Card Management"
        description="Issue, monitor, and revoke patient NFC identity cards."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => void refetchNFCCards()}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
            <button
              onClick={() => setShowIssueForm((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Fingerprint className="h-3 w-3" />
              {showIssueForm ? "Cancel" : "Issue New Card"}
            </button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Total Cards</div>
            <div className="mt-1 text-2xl font-bold text-foreground">{cards.length}</div>
          </div>
          <div className="rounded-xl border border-success/30 bg-success/5 p-4">
            <div className="text-xs text-success">Active</div>
            <div className="mt-1 text-2xl font-bold text-success">{activeCount}</div>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="text-xs text-destructive">Revoked</div>
            <div className="mt-1 text-2xl font-bold text-destructive">{revokedCount}</div>
          </div>
        </div>

        {/* Issue Form */}
        <AnimatePresence>
          {showIssueForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="text-sm font-semibold text-foreground mb-3">Issue NFC Card</div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={issuePatientDid}
                    onChange={(e) => setIssuePatientDid(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select patient...</option>
                    {patients.map((p: any) => (
                      <option key={p.did} value={p.did}>
                        {p.name} — {p.mrn} ({p.did.slice(0, 24)}…)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleIssue}
                    disabled={issuing || !issuePatientDid}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {issuing && <Loader2 className="h-3 w-3 animate-spin" />}
                    Issue Card
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by card ID, patient name, MRN, or DID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5">
            {(["all", "active", "revoked"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Cards Table */}
        {loading && cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-card rounded-2xl border border-border">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Loading NFC card registry...</p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-2xl border border-border p-6">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <Fingerprint className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">No NFC Cards Found</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {search ? `No cards matching "${search}".` : "Issue a new card to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Card ID
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Patient
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                      MRN
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                      Issued
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCards.map((card: any) => (
                    <tr key={card.cardId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {card.cardId}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground text-sm">
                          {card.patientName}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {card.patientDid?.slice(0, 30)}…
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {card.mrn}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            card.status === "active"
                              ? "bg-success/10 text-success"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {card.status === "active" ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {card.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {new Date(card.issuedAt).toLocaleDateString()}
                        <div className="text-[10px]">by {card.issuedBy}</div>
                      </td>
                      <td className="px-4 py-3">
                        {card.status === "active" ? (
                          <button
                            onClick={() => setCardToRevoke(card.cardId)}
                            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            Revoke
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {card.revokedAt &&
                              `Revoked ${new Date(card.revokedAt).toLocaleDateString()}`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Revocation Confirm Dialog */}
      <AnimatePresence>
        {cardToRevoke && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/40 backdrop-blur-sm p-4">
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
                <h3 className="text-lg font-semibold text-foreground">Revoke NFC Card</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Are you sure you want to permanently revoke card{" "}
                <span className="font-mono font-medium text-foreground">{cardToRevoke}</span>? This
                action cannot be undone.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setCardToRevoke(null)}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRevoke(cardToRevoke)}
                  className="rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-white hover:bg-destructive/90 transition-colors"
                >
                  Revoke Card
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}

/**
 * Admin gate. The role comes from Postgres via the server-verified session, and
 * RLS enforces the boundary independently — bypassing this renders empty data,
 * not another user's records.
 */
function NfcCardsGuarded() {
  return (
    <RouteGuard requiredRole="admin">
      <NfcCards />
    </RouteGuard>
  );
}
