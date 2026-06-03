import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { mockPatients, type PatientFull } from "@/lib/mock-patients";
import { Search, Receipt, CreditCard, User, History, Shield, Download, FileText, CheckCircle, AlertTriangle, Printer, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/financial")({
  head: () => ({ meta: [{ title: "Financials — Admin Console" }] }),
  component: AdminFinancialPage,
});

interface Transaction {
  id: string;
  patientName: string;
  did: string;
  category: "consultation" | "pharmacy" | "lab" | "room" | "surgery";
  amount: number;
  status: "paid" | "outstanding" | "refunded";
  date: string;
  reference: string;
}

const mockTransactions: Transaction[] = [
  { id: "tx1", patientName: "Anika Sharma", did: "did:hosp:0x4a91…b7d2", category: "consultation", amount: 1500, status: "paid", date: "2026-06-03", reference: "REF-98124A" },
  { id: "tx2", patientName: "Rohan Iyer", did: "did:hosp:0x91c2…ee04", category: "pharmacy", amount: 4820, status: "paid", date: "2026-06-02", reference: "REF-10948B" },
  { id: "tx3", patientName: "Meera Pillai", did: "did:hosp:0x77a3…12fa", category: "room", amount: 15000, status: "outstanding", date: "2026-06-02", reference: "REF-99211C" },
  { id: "tx4", patientName: "Karthik Rao", did: "did:hosp:0xbe49…3c20", category: "lab", amount: 3500, status: "paid", date: "2026-06-01", reference: "REF-33928D" },
  { id: "tx5", patientName: "Anika Sharma", did: "did:hosp:0x4a91…b7d2", category: "surgery", amount: 85000, status: "paid", date: "2026-05-28", reference: "REF-88421E" },
  { id: "tx6", patientName: "Sanjay Verma", did: "did:hosp:0x33ef…aa10", category: "consultation", amount: 1500, status: "refunded", date: "2026-05-27", reference: "REF-77621F" }
];

const categoryTotals = {
  consultation: 245000,
  pharmacy: 890000,
  lab: 420000,
  room: 1560000,
  surgery: 3450000
};

function AdminFinancialPage() {
  const [didQuery, setDidQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientFull | null>(null);
  const [showInvoice, setShowInvoice] = useState<Transaction | null>(null);

  // Financial statistics
  const totalRevenue = 6565000;
  const outstandingDues = 485000;
  const refundsProcessed = 32000;
  const transactionVolume = 2840;

  const handleSearch = () => {
    const trimmed = didQuery.trim();
    if (!trimmed) return;
    
    // Find patient in mockPatients by DID or Name
    const found = mockPatients.find(p => p.did.toLowerCase().includes(trimmed.toLowerCase()) || p.name.toLowerCase().includes(trimmed.toLowerCase()));
    
    if (found) {
      setSelectedPatient(found);
      toast.success("Patient profile retrieved via DID authentication");
    } else {
      toast.error("DID not found", { description: "Please enter a valid patient DID or name" });
    }
  };

  const downloadStatement = () => {
    if (!selectedPatient) return;
    toast.success("Financial statement generated", { description: `Statement PDF for ${selectedPatient.name} downloaded successfully.` });
  };

  const generateMockInvoice = (tx: Transaction) => {
    setShowInvoice(tx);
  };

  const fmt = (val: number) => `₹${val.toLocaleString("en-IN")}`;

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        
        <PageHeader
          eyebrow="Admin Console"
          title="Financial Ledger & Identity Lookup"
          description="Authenticate patient profiles using DIDs and track end-to-end healthcare payments."
        />

        {/* Financial Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Revenue Settled" value={fmt(totalRevenue)} icon={Receipt} tone="success" delta="62% coverage ratio" />
          <StatCard label="Outstanding Dues" value={fmt(outstandingDues)} icon={AlertTriangle} tone="destructive" delta="Pending insurance claim audits" />
          <StatCard label="Refunds Settled" value={fmt(refundsProcessed)} icon={History} tone="default" delta="Approved by compliance" />
          <StatCard label="Transactions Settled" value={transactionVolume.toLocaleString()} icon={CreditCard} tone="default" delta="+184 settled today" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Main search and profile retrieval */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Patient DID Lookup */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Patient DID Resolution</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the patient's DID or name to retrieve verified medical histories, active admission files, and payment statements.
              </p>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. did:hosp:0x4a91…b7d2 or Anika Sharma"
                  value={didQuery}
                  onChange={(e) => setDidQuery(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={handleSearch}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Resolve DID
                </button>
              </div>

              {/* Suggestions */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>Quick demo DIDs:</span>
                {mockPatients.slice(0, 3).map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setDidQuery(p.did); setSelectedPatient(p); toast.success("Sample DID resolved"); }}
                    className="underline hover:text-primary"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolved Profile Details */}
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
                        <h2 className="text-lg font-bold text-foreground">{selectedPatient.name}</h2>
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-bold text-success">
                          <CheckCircle className="h-3 w-3" /> DID Verified
                        </span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">{selectedPatient.did}</p>
                    </div>
                    <button
                      onClick={downloadStatement}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Statement
                    </button>
                  </div>

                  {/* Summary grid */}
                  <div className="grid gap-4 sm:grid-cols-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">MRN</span>
                      <p className="font-semibold text-foreground mt-0.5">{selectedPatient.mrn}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Demographics</span>
                      <p className="font-semibold text-foreground mt-0.5">{selectedPatient.age}y · {selectedPatient.gender === "M" ? "Male" : "Female"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Blood Type</span>
                      <p className="font-semibold text-foreground mt-0.5">{selectedPatient.bloodGroup}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contact</span>
                      <p className="font-semibold text-foreground mt-0.5">{selectedPatient.phone}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Insurance provider</span>
                      <p className="font-semibold text-primary mt-0.5">{selectedPatient.insuranceProvider}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Policy Number</span>
                      <p className="font-mono text-foreground mt-0.5">{selectedPatient.insurancePolicyNo}</p>
                    </div>
                  </div>

                  {/* Admission records */}
                  <div className="rounded-lg bg-muted/50 p-4 border border-border space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Admission & Ward Placement</span>
                    <div className="grid gap-2 sm:grid-cols-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Location</span>
                        <p className="font-semibold text-foreground mt-0.5">{selectedPatient.ward} Bed {selectedPatient.bed}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Primary Physician</span>
                        <p className="font-semibold text-foreground mt-0.5">{selectedPatient.primaryDoctor}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Admission Date</span>
                        <p className="font-semibold text-foreground mt-0.5">{selectedPatient.admitDate}</p>
                      </div>
                    </div>
                  </div>

                  {/* Diagnostics, History & Prescriptions */}
                  <div className="grid gap-4 sm:grid-cols-2 text-xs">
                    
                    <div className="rounded-lg border border-border p-3 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Prescriptions</span>
                      <div className="space-y-1">
                        {selectedPatient.conditions.slice(0, 3).map((c, i) => (
                          <div key={i} className="flex justify-between items-center bg-card p-1.5 rounded border border-border">
                            <span className="font-semibold text-foreground">{c} Meds Plan</span>
                            <span className="text-[10px] text-muted-foreground">Active</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border p-3 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Diagnosed Conditions</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedPatient.conditions.map((c, i) => (
                          <span key={i} className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>

                  </div>

                </motion.div>
              )}
            </AnimatePresence>

            {/* Payment Ledger / Audit logs */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Recent Transactions & Audit Logs</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground uppercase font-bold tracking-wider">
                    <tr>
                      <th className="px-3 py-2 rounded-l-lg">Patient</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2 rounded-r-lg text-right">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {mockTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-3 py-3 font-semibold text-foreground">{tx.patientName}</td>
                        <td className="px-3 py-3 capitalize text-muted-foreground">{tx.category}</td>
                        <td className="px-3 py-3 font-mono text-muted-foreground">{tx.reference}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${tx.status === "paid" ? "bg-success/10 text-success" : tx.status === "outstanding" ? "bg-warning/10 text-warning-foreground" : "bg-destructive/10 text-destructive"}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold text-foreground">{fmt(tx.amount)}</td>
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={() => generateMockInvoice(tx)}
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

          {/* Column 3: Category totals chart & insurance info */}
          <div className="space-y-6">
            
            {/* Category totals breakdown */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Receipt className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Revenue by Category</h3>
              </div>
              
              <div className="space-y-3">
                {Object.entries(categoryTotals).map(([cat, val]) => (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="capitalize text-foreground">{cat}</span>
                      <span className="text-foreground">{fmt(val)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(val / 3450000) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insurance Claims Audit Center */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Insurance Settlement Audit</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Verification status of out-of-hospital claims submitted via cryptographic proofs.
              </p>
              
              <div className="space-y-2">
                {[
                  { claim: "CLM-9912", patient: "Anika Sharma", status: "Approved", coverage: "90%" },
                  { claim: "CLM-1049", patient: "Rohan Iyer", status: "Audit Review", coverage: "80%" },
                  { claim: "CLM-3829", patient: "Karthik Rao", status: "Pending Settlement", coverage: "100%" }
                ].map((item, idx) => (
                  <div key={idx} className="rounded-lg bg-muted/50 p-2.5 border border-border text-xs flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-foreground">{item.claim} · {item.patient}</div>
                      <div className="text-[10px] text-muted-foreground">Authorized coverage: {item.coverage}</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${item.status === "Approved" ? "bg-success/15 text-success" : item.status === "Audit Review" ? "bg-warning/15 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Invoice Generator Modal Dialog */}
      <AnimatePresence>
        {showInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 backdrop-blur-sm p-4"
            onClick={() => setShowInvoice(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-clinical-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* Invoice Layout */}
              <div className="border border-border rounded-xl p-5 space-y-4 font-mono text-xs">
                
                {/* Header */}
                <div className="flex justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">DID HOSPITAL</h3>
                    <p className="text-[10px] text-muted-foreground">Apollo Campus, Mumbai</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">INVOICE</p>
                    <p className="text-[10px] text-muted-foreground">{showInvoice.date}</p>
                  </div>
                </div>

                {/* Patient section */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PATIENT:</span>
                    <span className="font-bold text-foreground">{showInvoice.patientName}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">DID:</span>
                    <span className="text-muted-foreground">{showInvoice.did}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="border-t border-b border-border py-3 space-y-2">
                  <div className="flex justify-between font-bold text-foreground">
                    <span>ITEM</span>
                    <span>AMOUNT</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span className="capitalize">{showInvoice.category} Charge</span>
                    <span>{fmt(showInvoice.amount)}</span>
                  </div>
                </div>

                {/* Totals */}
                <div className="space-y-1 text-right">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SUBTOTAL:</span>
                    <span className="font-bold text-foreground">{fmt(showInvoice.amount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground text-sm">
                    <span>TOTAL:</span>
                    <span>{fmt(showInvoice.amount)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">REF:</span>
                    <span className="text-muted-foreground">{showInvoice.reference}</span>
                  </div>
                </div>

              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowInvoice(null)}
                  className="flex-1 rounded-xl border border-border bg-card py-2 text-xs font-semibold hover:bg-muted"
                >
                  Close
                </button>
                <button
                  onClick={() => { toast.success("Sent to printer queue"); setShowInvoice(null); }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground py-2 text-xs font-bold hover:bg-primary/90"
                >
                  <Printer className="h-4 w-4" /> Print Invoice
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </RouteGuard>
  );
}
