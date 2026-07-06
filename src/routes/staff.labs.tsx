import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import {
  FlaskConical,
  Plus,
  Search,
  ShieldCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  User,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useLabs, useLivePatients } from "@/hooks/use-api";
import { orderLab } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/labs")({
  head: () => ({ meta: [{ title: "Labs — Staff Portal" }] }),
  component: LabsPage,
});

const labTests = [
  "CBC (Complete Blood Count)",
  "HbA1c",
  "Lipid Panel",
  "Troponin I",
  "D-Dimer",
  "BNP",
  "TSH",
  "FT4",
  "FT3",
  "Urine R&M",
  "Urine Culture",
  "Serum Creatinine",
  "Liver Function Tests",
  "Kidney Function Tests",
  "Blood Glucose (Fasting)",
  "PT/INR",
  "APTT",
  "Blood Culture",
  "Sputum Culture",
  "ECG Interpretation",
];

const statusConfig = {
  pending: { label: "Pending", icon: Clock, badge: "bg-muted text-muted-foreground" },
  "in-progress": { label: "In Progress", icon: FlaskConical, badge: "bg-primary/10 text-primary" },
  completed: { label: "Completed", icon: CheckCircle, badge: "bg-success/10 text-success" },
  cancelled: {
    label: "Cancelled",
    icon: AlertTriangle,
    badge: "bg-destructive/10 text-destructive",
  },
};

const urgencyConfig = {
  routine: "bg-muted text-muted-foreground",
  urgent: "bg-warning/10 text-warning-foreground",
  stat: "bg-destructive/10 text-destructive",
};

// Lab orders sourced entirely from backend API — no local fallback

function LabsPage() {
  const [tab, setTab] = useState<"orders" | "builder">("orders");
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [testSearch, setTestSearch] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientDid, setSelectedPatientDid] = useState("");
  const [priority, setPriority] = useState<"routine" | "urgent" | "stat">("routine");
  const [ordering, setOrdering] = useState(false);

  const { data: labsData, loading: labsLoading, refetch } = useLabs();
  const { patients: patientsList } = useLivePatients();

  const filteredTests = labTests.filter((t) => t.toLowerCase().includes(testSearch.toLowerCase()));

  const filteredPatients = (patientsList || []).filter(
    (p) =>
      p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.mrn.toLowerCase().includes(patientSearch.toLowerCase()),
  );

  const selectedPatient = (patientsList || []).find((p) => p.did === selectedPatientDid);

  const toggleTest = (t: string) => {
    setSelectedTests((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const handleSendToLab = async () => {
    if (!selectedPatientDid || selectedTests.length === 0) {
      toast.error("Please select a patient and at least one test.");
      return;
    }

    setOrdering(true);
    const orderedBy =
      typeof window !== "undefined"
        ? localStorage.getItem("userEmail") || "clinician@apollo.in"
        : "clinician@apollo.in";

    try {
      await orderLab(selectedPatientDid, orderedBy, selectedTests, priority);
      toast.success("Lab order sent successfully", {
        description: `Ordered for ${selectedPatient?.name || "Patient"}`,
      });
      setSelectedTests([]);
      setSelectedPatientDid("");
      setPatientSearch("");
      setPriority("routine");
      setTab("orders");
      refetch();
    } catch (err: any) {
      toast.error("Failed to submit lab order", { description: err.message });
    } finally {
      setOrdering(false);
    }
  };

  // Map API lab orders to view model
  const displayOrders = ((labsData?.labs ?? []) as any[]).map((lab: any) => {
    const pt = (patientsList || []).find((p) => p.did === lab.patientDid);
    return {
      id: lab.labId ?? lab.id ?? String(Math.random()),
      patient: pt?.name ?? lab.patientName ?? lab.patientDid ?? "Unknown Patient",
      mrn: pt?.mrn ?? lab.mrn ?? "—",
      tests: lab.tests || [],
      urgency: lab.priority || "routine",
      status: lab.status || "pending",
      ordered: lab.orderedAt ? new Date(lab.orderedAt).toLocaleString("en-IN") : "—",
    };
  });

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
        {(["orders", "builder"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "orders" ? "All Orders" : "Order Builder"}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-4">
        {tab === "orders" && (
          <>
            {labsLoading && (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Loading lab orders from registry…
              </div>
            )}

            {!labsLoading && (
              <StaggerList className="space-y-3">
                {displayOrders.map((o) => {
                  const cfg =
                    statusConfig[o.status as keyof typeof statusConfig] || statusConfig.pending;
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
                              <div className="text-sm font-semibold text-foreground">
                                {o.patient}
                              </div>
                              <div className="text-xs text-muted-foreground">{o.mrn}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${urgencyConfig[o.urgency as keyof typeof urgencyConfig] || urgencyConfig.routine}`}
                            >
                              {o.urgency}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${cfg.badge}`}
                            >
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {o.tests.map((t: string) => (
                            <span
                              key={t}
                              className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          Ordered: {o.ordered}
                        </div>
                        {o.status === "completed" && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-success" />
                            <span className="text-xs font-medium text-success">
                              Report signed & verified
                            </span>
                          </div>
                        )}
                      </div>
                    </StaggerItem>
                  );
                })}
              </StaggerList>
            )}
          </>
        )}

        {tab === "builder" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-6 lg:grid-cols-2"
          >
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-clinical">
              <div className="text-sm font-semibold text-foreground">Build Lab Order</div>

              {/* Patient Selection Dropdown */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Patient
                </label>
                <div className="mt-1 relative">
                  {selectedPatient ? (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-primary/5 p-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-foreground">
                          {selectedPatient.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({selectedPatient.mrn})
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedPatientDid("")}
                        className="text-muted-foreground hover:text-foreground font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                        placeholder="Search patient name or MRN..."
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                      />
                      {patientSearch && (
                        <div className="absolute z-15 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-clinical-md">
                          {filteredPatients.slice(0, 5).map((p) => (
                            <button
                              key={p.did}
                              onClick={() => {
                                setSelectedPatientDid(p.did);
                                setPatientSearch("");
                              }}
                              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left transition-colors"
                            >
                              <span className="font-medium text-foreground">{p.name}</span>
                              <span className="text-xs text-muted-foreground">{p.mrn}</span>
                            </button>
                          ))}
                          {filteredPatients.length === 0 && (
                            <div className="p-3 text-xs text-muted-foreground text-center">
                              No patients found
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Search Tests
                </label>
                <div className="mt-1 relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    className="w-full rounded-lg border border-border bg-muted pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    placeholder="Search lab tests..."
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pt-1">
                {(testSearch ? filteredTests : labTests).map((t) => (
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
                <label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Priority
                </label>
                <div className="mt-1 flex gap-2">
                  {(["routine", "urgent", "stat"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase transition-colors ${priority === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
              <div className="text-sm font-semibold text-foreground mb-4">Order Summary</div>
              {selectedTests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <FlaskConical className="h-10 w-10 opacity-30 mb-2" />
                  <div className="text-sm">No tests selected</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1">
                    <div>
                      <span className="font-semibold">Patient:</span>{" "}
                      {selectedPatient ? (
                        selectedPatient.name
                      ) : (
                        <span className="text-destructive">None Selected</span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold">Priority:</span>{" "}
                      <span className="uppercase font-bold">{priority}</span>
                    </div>
                  </div>
                  {selectedTests.map((t) => (
                    <div
                      key={t}
                      className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
                    >
                      <span className="text-foreground text-xs">{t}</span>
                      <button
                        onClick={() => toggleTest(t)}
                        className="text-muted-foreground hover:text-destructive font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleSendToLab}
                    disabled={ordering || !selectedPatientDid}
                    className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {ordering ? "Submitting Order..." : "Send to Lab"}
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
