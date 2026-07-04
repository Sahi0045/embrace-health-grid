import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader, StatCard } from "@/components/PageHeader";
import {
  getLivePatients,
  getLiveTransactions,
  recordPayment,
  storeEvents,
  type LivePatient,
  type LiveTransaction,
} from "@/lib/realtime-store";
import { getNamespace } from "@/lib/api";
import {
  Search,
  Receipt,
  CreditCard,
  History,
  Shield,
  Download,
  FileText,
  CheckCircle,
  AlertTriangle,
  Printer,
  Key,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/financial")({
  head: () => ({ meta: [{ title: "Financials — Admin Console" }] }),
  component: AdminFinancialPage,
});

function AdminFinancialPage() {
  const [didQuery, setDidQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<LivePatient | null>(null);
  const [showInvoice, setShowInvoice] = useState<LiveTransaction | null>(null);
  const [transactions, setTransactions] = useState<LiveTransaction[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());
  const [billingRecords, setBillingRecords] = useState<any[]>([]);

  const refresh = useCallback(() => {
    setTransactions(getLiveTransactions());
    setLastUpdate(new Date().toLocaleTimeString());
    getNamespace("billing")
      .then((res) => setBillingRecords(res || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    storeEvents.addEventListener("payment:recorded", handler);
    const poll = setInterval(refresh, 5000);
    return () => {
      storeEvents.removeEventListener("payment:recorded", handler);
      clearInterval(poll);
    };
  }, [refresh]);

  const handleSearch = () => {
    const q = didQuery.trim().toLowerCase();
    if (!q) return;
    const patients = getLivePatients();
    const found = patients.find(
      (p) =>
        p.did.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q),
    );
    if (found) {
      setSelectedPatient(found);
      toast.success("Patient resolved via DID", { description: `${found.name} — ${found.did}` });
    } else {
      toast.error("Not found", { description: "No patient matches that DID, name, or MRN." });
    }
  };

  const handleRecordPayment = async (category: LiveTransaction["category"]) => {
    if (!selectedPatient) return;
    const amounts: Record<string, number> = {
      consultation: 1500,
      pharmacy: 3200,
      lab: 2800,
      room: 12000,
      surgery: 65000,
    };
    await recordPayment(selectedPatient, amounts[category] ?? 2000, category);
    refresh();
  };

  const fmt = (v: number) => `₹${v.toLocaleString("en-IN")}`;

  const totalRevenue = transactions
    .filter((t) => t.status === "paid")
    .reduce((s, t) => s + t.amount, 0);
  const outstanding = transactions
    .filter((t) => t.status === "outstanding")
    .reduce((s, t) => s + t.amount, 0);
  const refunded = transactions
    .filter((t) => t.status === "refunded")
    .reduce((s, t) => s + t.amount, 0);

  // Revenue by category
  const byCategory = transactions.reduce<Record<string, number>>((acc, t) => {
    if (t.status === "paid") acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});
  const maxCat = Math.max(...Object.values(byCategory), 1);

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <PageHeader
          eyebrow={`Admin Console — Last sync ${lastUpdate}`}
          title="Financial Ledger & Identity Lookup"
          description="Live database-backed payment records, DID-based patient resolution, and real-time revenue analytics."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Revenue Settled"
            value={fmt(totalRevenue)}
            icon={Receipt}
            tone="success"
            delta={`${transactions.filter((t) => t.status === "paid").length} transactions`}
          />
          <StatCard
            label="Outstanding Dues"
            value={fmt(outstanding)}
            icon={AlertTriangle}
            tone="destructive"
            delta={`${transactions.filter((t) => t.status === "outstanding").length} pending`}
          />
          <StatCard
            label="Refunds Processed"
            value={fmt(refunded)}
            icon={History}
            tone="default"
            delta={`${transactions.filter((t) => t.status === "refunded").length} refunds`}
          />
          <StatCard
            label="On-Chain Records"
            value={billingRecords.length.toString()}
            icon={Key}
            tone="default"
            delta="Audit committed"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* DID Lookup */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold">Patient DID Resolution</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Resolve patients from the live secure DID registry using DID, name, or MRN.
              </p>
              <div className="flex gap-2">
                <input
                  value={didQuery}
                  onChange={(e) => setDidQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="did:hosp:0x… or Anika Sharma or MRN-200000"
                  className="flex-1 rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={handleSearch}
                  className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold hover:bg-primary/90"
                >
                  Resolve DID
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>Quick resolve:</span>
                {getLivePatients()
                  .slice(0, 3)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setDidQuery(p.did);
                        setSelectedPatient(p);
                      }}
                      className="underline hover:text-primary"
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
            </div>

            {/* Resolved Patient */}
            <AnimatePresence mode="wait">
              {selectedPatient && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="rounded-xl border border-border bg-card p-6 shadow-clinical space-y-5"
                >
                  <div className="flex items-start justify-between border-b border-border pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold">{selectedPatient.name}</h2>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${selectedPatient.isOnChain ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                        >
                          <CheckCircle className="h-3 w-3" />
                          {selectedPatient.isOnChain
                            ? "DID Verified On-Chain"
                            : "Pending DID Registration"}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">
                        {selectedPatient.did}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        toast.success("Statement generated", {
                          description: `PDF for ${selectedPatient.name}`,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold hover:bg-muted"
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 text-xs">
                    {[
                      ["MRN", selectedPatient.mrn],
                      [
                        "Demographics",
                        `${selectedPatient.age}y · ${selectedPatient.gender === "M" ? "Male" : "Female"}`,
                      ],
                      ["Blood Type", selectedPatient.bloodGroup],
                      ["Contact", selectedPatient.phone],
                      ["Insurance", selectedPatient.insuranceProvider],
                      ["Policy", selectedPatient.insurancePolicyNo],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <span className="text-muted-foreground">{k}</span>
                        <p className="font-semibold mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Active Credentials */}
                  {selectedPatient.activeCredentials.length > 0 && (
                    <div className="rounded-lg bg-muted/40 p-3 border border-border">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        Active Verifiable Credentials
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPatient.activeCredentials.map((vc) => (
                          <span
                            key={vc.id}
                            className="rounded-full bg-success/10 text-success border border-success/20 px-2 py-0.5 text-[9px] font-bold"
                          >
                            ✓ {vc.type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick charge buttons */}
                  <div>
                    <div className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
                      Record New Payment (Commits to Secure Registry)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          "consultation",
                          "pharmacy",
                          "lab",
                          "room",
                          "surgery",
                        ] as LiveTransaction["category"][]
                      ).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => handleRecordPayment(cat)}
                          className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold capitalize hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-colors"
                        >
                          + {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Transactions Table */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold">Live Transaction Ledger</h3>
                <span className="rounded-full bg-primary/10 text-primary text-[9px] px-2 py-0.5 font-bold">
                  {transactions.length} records
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground uppercase font-bold tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Patient</th>
                      <th className="px-3 py-2">DID</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2 text-right">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.slice(0, 30).map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-3 py-3 font-semibold">{tx.patientName}</td>
                        <td className="px-3 py-3 font-mono text-primary text-[9px] max-w-[100px] truncate">
                          {tx.patientDid}
                        </td>
                        <td className="px-3 py-3 capitalize text-muted-foreground">
                          {tx.category}
                        </td>
                        <td className="px-3 py-3 font-mono text-muted-foreground text-[9px]">
                          {tx.reference}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                              tx.status === "paid"
                                ? "bg-success/10 text-success"
                                : tx.status === "outstanding"
                                  ? "bg-warning/10 text-warning-foreground"
                                  : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold">{fmt(tx.amount)}</td>
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={() => setShowInvoice(tx)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                          >
                            <FileText className="h-3 w-3" /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Receipt className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold">Revenue by Category</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(byCategory).map(([cat, val]) => (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="capitalize">{cat}</span>
                      <span>{fmt(val)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${(val / maxCat) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {Object.keys(byCategory).length === 0 && (
                  <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
                )}
              </div>
            </div>

            {/* On-chain billing */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold">Secure Audit Records</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {billingRecords.length} billing entries committed to Secure Registry.
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {billingRecords.slice(0, 10).map((r, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-muted/40 p-2.5 border border-border text-xs"
                  >
                    <div className="font-semibold font-mono text-[9px] text-primary">{r.key}</div>
                    <div className="text-muted-foreground text-[9px] mt-0.5">
                      Updated: {r.updatedAt}
                    </div>
                  </div>
                ))}
                {billingRecords.length === 0 && (
                  <p className="text-xs text-muted-foreground">No on-chain billing records yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      <AnimatePresence>
        {showInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
            onClick={() => setShowInvoice(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-clinical-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border border-border rounded-xl p-5 space-y-4 font-mono text-xs">
                <div className="flex justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="font-black text-sm">DID HOSPITAL</h3>
                    <p className="text-[10px] text-muted-foreground">Apollo Campus, Mumbai</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">INVOICE</p>
                    <p className="text-[10px] text-muted-foreground">{showInvoice.date}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PATIENT:</span>
                    <span className="font-bold">{showInvoice.patientName}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">DID:</span>
                    <span className="truncate max-w-[160px]">{showInvoice.patientDid}</span>
                  </div>
                  {showInvoice.blockTxId && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">TX:</span>
                      <span className="truncate max-w-[160px]">{showInvoice.blockTxId}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-b border-border py-3 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>ITEM</span>
                    <span>AMOUNT</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span className="capitalize">{showInvoice.category} Charge</span>
                    <span>{fmt(showInvoice.amount)}</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold text-sm">
                  <span>TOTAL:</span>
                  <span>{fmt(showInvoice.amount)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowInvoice(null)}
                  className="flex-1 rounded-xl border border-border py-2 text-xs font-semibold hover:bg-muted"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    window.print();
                    setShowInvoice(null);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground py-2 text-xs font-bold hover:bg-primary/90"
                >
                  <Printer className="h-4 w-4" /> Print
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}
