import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { FlaskConical, Plus, Search, ShieldCheck, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export const Route = createFileRoute("/staff/labs")({
  head: () => ({ meta: [{ title: "Labs — Staff Portal" }] }),
  component: LabsPage,
});

const labOrders = [
  { id: "lo1", patient: "Anika Sharma", mrn: "MRN-204871", tests: ["CBC", "HbA1c", "Lipid Panel"], urgency: "routine", status: "pending", ordered: "2026-06-02 08:30" },
  { id: "lo2", patient: "Rohan Iyer", mrn: "MRN-204902", tests: ["Troponin I", "D-Dimer", "BNP"], urgency: "urgent", status: "in-progress", ordered: "2026-06-02 07:12" },
  { id: "lo3", patient: "Meera Pillai", mrn: "MRN-205110", tests: ["TSH", "FT4", "FT3"], urgency: "routine", status: "completed", ordered: "2026-06-01 16:45" },
  { id: "lo4", patient: "Karthik Rao", mrn: "MRN-205288", tests: ["Urine R&M", "Urine Culture", "Serum Creatinine"], urgency: "stat", status: "completed", ordered: "2026-06-01 14:20" },
];

const labTests = [
  "CBC (Complete Blood Count)", "HbA1c", "Lipid Panel", "Troponin I", "D-Dimer", "BNP",
  "TSH", "FT4", "FT3", "Urine R&M", "Urine Culture", "Serum Creatinine",
  "Liver Function Tests", "Kidney Function Tests", "Blood Glucose (Fasting)",
  "PT/INR", "APTT", "Blood Culture", "Sputum Culture", "ECG Interpretation",
];

const statusConfig = {
  pending: { label: "Pending", icon: Clock, badge: "bg-muted text-muted-foreground" },
  "in-progress": { label: "In Progress", icon: FlaskConical, badge: "bg-primary/10 text-primary" },
  completed: { label: "Completed", icon: CheckCircle, badge: "bg-success/10 text-success" },
  cancelled: { label: "Cancelled", icon: AlertTriangle, badge: "bg-destructive/10 text-destructive" },
};

const urgencyConfig = {
  routine: "bg-muted text-muted-foreground",
  urgent: "bg-warning/10 text-warning-foreground",
  stat: "bg-destructive/10 text-destructive",
};

function LabsPage() {
  const [tab, setTab] = useState<"orders" | "builder">("orders");
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [testSearch, setTestSearch] = useState("");

  const filtered = labTests.filter(t => t.toLowerCase().includes(testSearch.toLowerCase()));

  const toggleTest = (t: string) => {
    setSelectedTests(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Staff Portal"
        title="Laboratory"
        description="Lab orders, pending results, and signed reports"
        actions={
          <button
            onClick={() => setTab(tab === "orders" ? "builder" : "orders")}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {tab === "orders" ? "New Lab Order" : "View Orders"}
          </button>
        }
      />

      <div className="flex gap-1 border-b border-border px-6 bg-card">
        {(["orders", "builder"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "orders" ? "All Orders" : "Order Builder"}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-4">
        {tab === "orders" && (
          <StaggerList className="space-y-3">
            {labOrders.map((o) => {
              const cfg = statusConfig[o.status as keyof typeof statusConfig];
              const Icon = cfg.icon;
              return (
                <StaggerItem key={o.id}>
                  <div className="rounded-xl border border-border bg-card p-4 shadow-clinical">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <FlaskConical className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">{o.patient}</div>
                          <div className="text-xs text-muted-foreground">{o.mrn}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${urgencyConfig[o.urgency as keyof typeof urgencyConfig]}`}>{o.urgency}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${cfg.badge}`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {o.tests.map((t) => (
                        <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">{t}</span>
                      ))}
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">Ordered: {o.ordered}</div>
                    {o.status === "completed" && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-success" />
                        <span className="text-xs font-medium text-success">Report signed & verified</span>
                      </div>
                    )}
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerList>
        )}

        {tab === "builder" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="text-sm font-semibold text-foreground">Build Lab Order</div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Patient</label>
                <input className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none" placeholder="Search patient..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Search Tests</label>
                <div className="mt-1 relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    className="w-full rounded-lg border border-border bg-muted pl-8 pr-3 py-2 text-sm outline-none"
                    placeholder="Search lab tests..."
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
                {(testSearch ? filtered : labTests).map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTest(t)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${selectedTests.includes(t) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Priority</label>
                <div className="mt-1 flex gap-2">
                  {["Routine","Urgent","STAT"].map(p => (
                    <button key={p} className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="text-sm font-semibold text-foreground mb-4">Order Summary</div>
              {selectedTests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <FlaskConical className="h-10 w-10 opacity-30 mb-2" />
                  <div className="text-sm">No tests selected</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedTests.map((t) => (
                    <div key={t} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                      <span className="text-foreground">{t}</span>
                      <button onClick={() => toggleTest(t)} className="text-muted-foreground hover:text-destructive">×</button>
                    </div>
                  ))}
                  <button className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                    Send to Lab
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </RouteGuard>
  );
}
