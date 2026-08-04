import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Download,
  Pill,
  TrendingDown,
  Activity,
  FlaskConical,
  ImageIcon,
  ClipboardList,
  Star,
  Dumbbell,
  MessageSquare,
  ShoppingBag,
  CheckCircle2,
  Loader2,
  Lock,
  Share2,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Stethoscope,
  CalendarDays,
  User,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import { buildPatientAnchorTx } from "@/lib/clinical.server";
import { useTableRefresh } from "@/hooks/use-realtime";
import { useState, useEffect, useCallback } from "react";
import {
  getPrescriptions,
  getMedicalRecords,
  getHealthMetrics,
  getPharmacyOrders,
  getRehabSessions,
  getFeedbackList,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/auth-context";

export const Route = createFileRoute("/patient/records")({
  head: () => ({
    meta: [
      { title: "Medical Records — Patient Portal" },
      { name: "description", content: "Your prescriptions, reports, health metrics and more" },
    ],
  }),
  component: MedicalRecords,
});

const docTypeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  "lab-report": FlaskConical,
  imaging: ImageIcon,
  prescription: Pill,
  "discharge-summary": ClipboardList,
  referral: FileText,
  "procedure-report": Activity,
  vaccination: CheckCircle2,
};

function MedicalRecords() {
  const { user: currentUser } = useCurrentUser();
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [apiPrescriptions, setApiPrescriptions] = useState<any[]>([]);
  const [apiRecords, setApiRecords] = useState<any[]>([]);
  const [apiHealthMetrics, setApiHealthMetrics] = useState<any[]>([]);
  const [apiPharmacyOrders, setApiPharmacyOrders] = useState<any[]>([]);
  const [apiRehabSessions, setApiRehabSessions] = useState<any[]>([]);
  const [apiFeedbackList, setApiFeedbackList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRxJson, setSelectedRxJson] = useState<any | null>(null);
  // expanded consultation card
  const [expandedRxId, setExpandedRxId] = useState<string | null>(null);

  const patientDid = currentUser?.primaryDid ?? "";

  const { publicKey, signTransaction, connected } = useWallet();
  const [anchoring, setAnchoring] = useState(false);
  const [onChainRoot, setOnChainRoot] = useState<string | null>(null);
  const [onChainTx, setOnChainTx] = useState<string | null>(null);

  const fetchOnChainRoot = useCallback(async () => {
    if (!publicKey || !patientDid) return;
    try {
      const PROGRAM_ID = new PublicKey("BxkLrjBYdb3nh2m9GCfpLXBWrAj3s9MqnRbwktLqSfN3");
      const [patientRootPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("patient-root"), Buffer.from(patientDid)],
        PROGRAM_ID,
      );
      const connection = new Connection("https://api.devnet.solana.com", "confirmed");
      const accountInfo = await connection.getAccountInfo(patientRootPda);
      if (accountInfo) {
        const didLen = accountInfo.data.readUInt32LE(8);
        const rootOffset = 8 + 4 + didLen;
        const rootBytes = accountInfo.data.slice(rootOffset, rootOffset + 32);
        setOnChainRoot(Buffer.from(rootBytes).toString("hex"));
      } else {
        setOnChainRoot(null);
      }
    } catch (err) {
      console.warn("Could not load on-chain Merkle Root:", err);
    }
  }, [publicKey, patientDid]);

  useEffect(() => {
    fetchOnChainRoot();
  }, [fetchOnChainRoot]);

  const handleAnchorRecords = async () => {
    if (!publicKey || !signTransaction) {
      toast.error("Please connect your Phantom wallet first");
      return;
    }
    setAnchoring(true);
    try {
      // Server builds the UNSIGNED transaction; the patient signs with their
      // own Phantom wallet, so the platform never holds their key.
      const res = await buildPatientAnchorTx({
        data: { authorityPubkey: publicKey.toBase58() },
      });
      const tx = Transaction.from(Buffer.from(res.transactionPayload, "base64"));

      toast.info("Requesting signature from Phantom wallet...");
      const connection = new Connection("https://api.devnet.solana.com", "confirmed");

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;

      const signedTx = await signTransaction(tx);
      toast.info("Broadcasting transaction to Solana Devnet...");

      const txid = await connection.sendRawTransaction(signedTx.serialize());
      toast.info("Awaiting transaction confirmation on-chain...");

      await connection.confirmTransaction(txid, "confirmed");

      setOnChainRoot(res.merkleRoot);
      setOnChainTx(txid);
      toast.success("Medical records successfully anchored on Solana Devnet!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to anchor medical records");
    } finally {
      setAnchoring(false);
    }
  };

  useEffect(() => {
    if (!patientDid) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const fetchData = async () => {
      try {
        const [rxRes, recRes, hmRes, poRes, rsRes, fbRes] = await Promise.all([
          getPrescriptions(patientDid),
          getMedicalRecords(patientDid),
          getHealthMetrics(patientDid),
          getPharmacyOrders(patientDid),
          getRehabSessions(patientDid),
          getFeedbackList(patientDid),
        ]);
        if (mounted) {
          setApiPrescriptions(rxRes.prescriptions || []);
          setApiRecords(recRes.records || []);
          setApiHealthMetrics(hmRes.metrics || []);
          setApiPharmacyOrders(poRes.orders || []);
          setApiRehabSessions(rsRes.sessions || []);
          setApiFeedbackList(fbRes.feedback || []);
        }
      } catch (err) {
        console.warn("Could not load medical records from API:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      mounted = false;
    };
  }, [patientDid]);

  // Real-time sync via Supabase Realtime (replaces the ws://localhost:3001
  // socket). RLS applies to the subscription, so only changes to rows this
  // patient is permitted to see are delivered at all.
  const refreshClinical = useCallback(async () => {
    if (!patientDid) return;
    try {
      const [rxRes, recRes] = await Promise.all([
        getPrescriptions(patientDid),
        getMedicalRecords(patientDid),
      ]);
      setApiPrescriptions(rxRes.prescriptions || []);
      setApiRecords(recRes.records || []);
    } catch {
      /* leave the previous data in place on a transient failure */
    }
  }, [patientDid]);

  useTableRefresh("prescriptions", refreshClinical);
  useTableRefresh("medical_records", refreshClinical);

  const pharmacyOrders = apiPharmacyOrders;
  const healthMetrics = apiHealthMetrics;
  const rehabSessions = apiRehabSessions;
  const feedbackList = apiFeedbackList;

  // Join each prescription with its linked medical report (matched by rxId)
  const consultations = apiPrescriptions
    .sort((a: any, b: any) => (b.signedAt || "").localeCompare(a.signedAt || ""))
    .map((rx: any) => ({
      // prescription fields
      rxId: rx.rxId,
      diagnosis: rx.diagnosis || "—",
      chiefComplaint: rx.chiefComplaint || "",
      symptoms: rx.symptoms || "",
      doctor: rx.doctorName || rx.signedBy || "Doctor",
      doctorDid: rx.doctorDid || "",
      apptId: rx.apptId || "",
      date: rx.signedAt || new Date().toISOString(),
      status: rx.status || "active",
      medicines: rx.drugs || [],
      notes: rx.notes || "",
      followUpDate: rx.followUpDate || "",
      // linked medical report — matched by rxId
      report: apiRecords.find((r: any) => r.rxId === rx.rxId) ?? null,
    }));

  // Non-prescription records (no rxId link) go to the Reports tab
  const displayDocuments = apiRecords
    .filter((rec: any) => !rec.rxId)
    .map((rec: any) => ({
      id: rec.recordId,
      title: rec.title,
      type: rec.type,
      date: rec.createdAt || new Date().toISOString(),
      issuedBy: rec.doctorName || "Doctor",
      fileSize: "N/A",
      summary: rec.content,
      isNew: true,
    }));

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Patient app"
          title="Medical Records"
          description="Prescriptions, reports, health metrics, pharmacy and rehabilitation"
        />

        {/* Solana On-Chain Merkle Ledger Registry */}
        <Card className="mt-6 border-primary/20 bg-primary/5 shadow-clinical">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg">Solana On-Chain Medical Registry</CardTitle>
                  <CardDescription>
                    Anchor the cryptographic proof (Merkle Root) of your medical records on Solana.
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                {connected ? (
                  <Button
                    onClick={handleAnchorRecords}
                    disabled={
                      anchoring || (apiRecords.length === 0 && apiPrescriptions.length === 0)
                    }
                    className="cursor-pointer"
                  >
                    {anchoring ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Anchoring...
                      </>
                    ) : onChainRoot ? (
                      "Update On-Chain Root"
                    ) : (
                      "Anchor Records"
                    )}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground italic">
                    Connect Phantom wallet on profile page to anchor
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground">
                  Current Medical Records Hash Count
                </div>
                <div className="text-lg font-bold text-foreground mt-1">
                  {apiRecords.length + apiPrescriptions.length} items (Records & Prescriptions)
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground">On-Chain Merkle Root</div>
                <div className="text-sm font-semibold font-mono text-primary truncate mt-1">
                  {onChainRoot
                    ? `0x${onChainRoot.slice(0, 10)}...${onChainRoot.slice(-10)}`
                    : "Not Anchored"}
                </div>
              </div>
            </div>
            {onChainTx && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-success/10 p-2.5 text-xs text-success-foreground border border-success/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Records successfully anchored on Solana Devnet!</span>
                </div>
                <a
                  href={`https://solscan.io/tx/${onChainTx}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 font-semibold underline text-primary hover:text-primary/80"
                >
                  <Share2 className="h-3 w-3" />
                  View on Solscan
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6">
          <Tabs defaultValue="prescriptions" className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1 mb-6">
              <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="metrics">Health Metrics</TabsTrigger>
              <TabsTrigger value="pharmacy">Pharmacy</TabsTrigger>
              <TabsTrigger value="rehab">Rehab</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
            </TabsList>

            {/* ── Prescriptions ── */}
            <TabsContent value="prescriptions" className="space-y-4">
              {loading && (
                <div className="text-center py-4 text-sm text-muted-foreground animate-pulse">
                  Loading prescriptions…
                </div>
              )}
              {!loading && consultations.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-card py-10 text-center text-sm text-muted-foreground">
                  No prescriptions yet. They appear here after a doctor signs one for you.
                </div>
              )}
              {consultations.map((cx) => {
                const isExp = expandedRxId === cx.rxId;
                const statusCls =
                  cx.status === "active"
                    ? "bg-primary/10 text-primary"
                    : cx.status === "dispensed"
                      ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground";
                return (
                  <Card key={cx.rxId} className="overflow-hidden">
                    {/* ── Consultation header (always visible) ── */}
                    <CardHeader className="pb-3 bg-muted/30">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="space-y-0.5">
                          <CardTitle className="text-base">{cx.diagnosis}</CardTitle>
                          <CardDescription className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span className="font-medium text-foreground">{cx.doctor}</span>
                            </span>
                            {cx.doctorDid && (
                              <span className="font-mono text-[10px] text-primary">
                                {cx.doctorDid.slice(0, 22)}…
                              </span>
                            )}
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {new Date(cx.date).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            {cx.apptId && (
                              <>
                                <span>·</span>
                                <span className="font-mono text-[10px]">Appt: {cx.apptId}</span>
                              </>
                            )}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant={cx.status === "active" ? "default" : "secondary"}
                            className={`capitalize text-[10px] ${statusCls}`}
                          >
                            {cx.status}
                          </Badge>
                          {cx.report && (
                            <span className="rounded-full bg-chart-2/15 text-chart-2 px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
                              <FileText className="h-2.5 w-2.5" /> Report
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedRxId(isExp ? null : cx.rxId)}
                            className="h-7 px-2"
                          >
                            {isExp ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7"
                            onClick={() => setSelectedRxJson(cx)}
                          >
                            <FileText className="mr-1 h-3 w-3" /> JSON
                          </Button>
                        </div>
                      </div>

                      {/* Chief complaint + symptoms summary */}
                      {(cx.chiefComplaint || cx.symptoms) && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs">
                          {cx.chiefComplaint && (
                            <div className="rounded-lg bg-card border border-border px-3 py-2">
                              <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5 flex items-center gap-1">
                                <Stethoscope className="h-3 w-3" /> Chief Complaint
                              </div>
                              <div className="text-foreground">{cx.chiefComplaint}</div>
                            </div>
                          )}
                          {cx.symptoms && (
                            <div className="rounded-lg bg-card border border-border px-3 py-2">
                              <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">
                                Symptoms
                              </div>
                              <div className="text-foreground">{cx.symptoms}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="pt-4 space-y-4">
                      {/* Medicines grid */}
                      <div className="grid gap-2 sm:grid-cols-2">
                        {cx.medicines.map((med: any, i: number) => (
                          <div key={i} className="rounded-lg border border-border p-3 space-y-1">
                            <div className="flex items-center gap-2">
                              <Pill className="h-4 w-4 text-primary shrink-0" />
                              <div className="font-semibold text-sm text-foreground">
                                {med.name}
                                {med.dosage && (
                                  <span className="font-normal text-muted-foreground">
                                    {" "}
                                    · {med.dosage}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground pl-6 flex flex-wrap gap-x-3 gap-y-0.5">
                              {med.frequency && <span>{med.frequency}</span>}
                              {med.duration && <span>· {med.duration}</span>}
                              {med.usage && (
                                <span className="text-primary font-medium">· {med.usage}</span>
                              )}
                            </div>
                            {med.instructions && (
                              <div className="text-xs text-muted-foreground pl-6 italic">
                                {med.instructions}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Notes + follow-up */}
                      <div className="flex flex-wrap gap-3 text-xs">
                        {cx.notes && (
                          <div className="flex-1 min-w-[160px] rounded-lg bg-muted/50 border border-border px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">
                              Additional Notes
                            </div>
                            <div className="text-foreground">{cx.notes}</div>
                          </div>
                        )}
                        {cx.followUpDate && (
                          <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary shrink-0" />
                            <div>
                              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                                Follow-up
                              </div>
                              <div className="font-medium text-foreground">
                                {new Date(cx.followUpDate).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Linked Medical Report (expanded) */}
                      {isExp && cx.report && (
                        <div className="rounded-xl border border-chart-2/30 bg-chart-2/5 p-4 space-y-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-chart-2">
                            <FileText className="h-4 w-4" /> Medical Report — {cx.report.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(cx.report.createdAt).toLocaleString("en-IN")} ·{" "}
                            {cx.report.recordId}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 text-xs">
                            {cx.report.consultationSummary && (
                              <div className="sm:col-span-2 rounded-lg bg-card border px-3 py-2">
                                <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">
                                  Consultation Summary
                                </div>
                                <div className="text-foreground">
                                  {cx.report.consultationSummary}
                                </div>
                              </div>
                            )}
                            {cx.report.clinicalNotes && (
                              <div className="rounded-lg bg-card border px-3 py-2">
                                <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">
                                  Clinical Notes
                                </div>
                                <div className="text-foreground">{cx.report.clinicalNotes}</div>
                              </div>
                            )}
                            {cx.report.testResults && (
                              <div className="rounded-lg bg-card border px-3 py-2">
                                <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5 flex items-center gap-1">
                                  <FlaskConical className="h-3 w-3" /> Test Results
                                </div>
                                <div className="text-foreground">{cx.report.testResults}</div>
                              </div>
                            )}
                            {cx.report.recommendedFollowUp && (
                              <div className="rounded-lg bg-card border px-3 py-2">
                                <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">
                                  Recommended Follow-up
                                </div>
                                <div className="text-foreground">
                                  {cx.report.recommendedFollowUp}
                                </div>
                              </div>
                            )}
                            {cx.report.content && !cx.report.consultationSummary && (
                              <div className="sm:col-span-2 rounded-lg bg-card border px-3 py-2">
                                <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">
                                  Report Content
                                </div>
                                <div className="text-foreground">{cx.report.content}</div>
                              </div>
                            )}
                          </div>
                          {/* Treating Doctor Info */}
                          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                                Treating Doctor
                              </div>
                              <div className="font-medium text-foreground">
                                {cx.report.doctorName || cx.doctor}
                              </div>
                              {cx.report.doctorDid && (
                                <div className="font-mono text-[10px] text-primary">
                                  {cx.report.doctorDid}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expand hint when report exists but not expanded */}
                      {!isExp && cx.report && (
                        <button
                          onClick={() => setExpandedRxId(cx.rxId)}
                          className="w-full text-xs text-chart-2 font-medium flex items-center justify-center gap-1 hover:underline py-1"
                        >
                          <FileText className="h-3 w-3" /> Show linked medical report
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      )}

                      {/* Digital signature status */}
                      <div className="flex items-center gap-2 rounded-lg bg-success/5 border border-success/20 px-3 py-2 text-xs">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        <div>
                          <span className="font-semibold text-success">Digitally Signed</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · DID + Ed25519 · {new Date(cx.date).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* ── Reports & Documents ── */}
            <TabsContent value="reports" className="space-y-4">
              {loading && (
                <div className="text-center py-4 text-sm text-muted-foreground animate-pulse">
                  Loading latest reports...
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {displayDocuments.map((doc) => {
                  const Icon = docTypeIcon[doc.type] ?? FileText;
                  return (
                    <Card
                      key={doc.id}
                      className={doc.isNew ? "border-primary/40 bg-primary/5" : ""}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium text-sm leading-tight">{doc.title}</div>
                              {doc.isNew && <Badge className="shrink-0 text-xs">New</Badge>}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">{doc.issuedBy}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(doc.date).toLocaleDateString()} · {doc.fileSize}
                            </div>
                            {doc.summary && (
                              <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                                {doc.summary}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="mt-3 w-full">
                          <Download className="mr-1 h-3 w-3" />
                          Download
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* ── Health Metrics ── */}
            <TabsContent value="metrics" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Latest Weight",
                    value: `${healthMetrics[0]?.weight ?? "—"} kg`,
                    sub: `BMI ${healthMetrics[0]?.bmi ?? "—"}`,
                    trend: -1,
                  },
                  {
                    label: "Blood Pressure",
                    value: `${healthMetrics[0]?.bloodPressure?.systolic ?? "—"}/${healthMetrics[0]?.bloodPressure?.diastolic ?? "—"}`,
                    sub: "mmHg",
                    trend: -1,
                  },
                  {
                    label: "Blood Sugar (F)",
                    value: `${healthMetrics[0]?.bloodSugar?.fasting ?? "—"} mg/dL`,
                    sub: "Fasting",
                    trend: -1,
                  },
                  {
                    label: "HbA1c",
                    value: `${healthMetrics[0]?.hba1c ?? "—"}%`,
                    sub: "3-month avg",
                    trend: -1,
                  },
                ].map((item) => (
                  <Card key={item.label}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">{item.label}</div>
                        <TrendingDown className="h-4 w-4 text-success" />
                      </div>
                      <div className="mt-1 text-2xl font-bold">{item.value}</div>
                      <div className="text-xs text-muted-foreground">{item.sub}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Trend History (Last 5 months)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="pb-2 text-left font-medium">Month</th>
                          <th className="pb-2 text-right font-medium">Weight</th>
                          <th className="pb-2 text-right font-medium">BP</th>
                          <th className="pb-2 text-right font-medium">FBS</th>
                          <th className="pb-2 text-right font-medium">LDL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {healthMetrics.map((m, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-2 font-medium">
                              {new Date(m.date).toLocaleDateString("en-IN", {
                                month: "short",
                                year: "2-digit",
                              })}
                              {i === 0 && (
                                <span className="ml-2 text-xs text-primary">(Latest)</span>
                              )}
                            </td>
                            <td className="py-2 text-right">{m.weight} kg</td>
                            <td className="py-2 text-right">
                              {m.bloodPressure?.systolic}/{m.bloodPressure?.diastolic}
                            </td>
                            <td className="py-2 text-right">{m.bloodSugar?.fasting}</td>
                            <td className="py-2 text-right">{m.cholesterol?.ldl ?? "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Pharmacy ── */}
            <TabsContent value="pharmacy" className="space-y-4">
              {pharmacyOrders.map((order) => (
                <Card key={order.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          Order #{order.id.replace("pho_", "PH-")}
                        </CardTitle>
                        <CardDescription>
                          Ordered on {new Date(order.orderedOn).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          order.status === "dispensed"
                            ? "default"
                            : order.status === "pending"
                              ? "secondary"
                              : order.status === "out-of-stock"
                                ? "destructive"
                                : "outline"
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {order.medicines.map((m: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div>
                            <div className="font-medium text-sm">{m.name}</div>
                            <div className="text-xs text-muted-foreground">{m.instructions}</div>
                          </div>
                          <div className="text-sm font-medium">
                            {m.qty} {m.unit}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
                      <span className="text-muted-foreground">Total Cost</span>
                      <span className="font-semibold">
                        ₹{order.totalCost.toLocaleString("en-IN")}
                      </span>
                    </div>
                    {order.status === "dispensed" && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        Dispensed by {order.dispensedBy} at {order.dispensedAt}
                      </div>
                    )}
                    {order.status === "pending" && (
                      <Button className="mt-3 w-full sm:w-auto">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        Request Refill
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* ── Rehab / Physiotherapy ── */}
            <TabsContent value="rehab" className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-2">
                {rehabSessions.map((session) => (
                  <Card key={session.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium capitalize">
                            {session.type.replace(/-/g, " ")}
                          </div>
                          <div className="text-sm text-muted-foreground">{session.therapist}</div>
                        </div>
                        <Badge
                          variant={
                            session.status === "completed"
                              ? "default"
                              : session.status === "scheduled"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {session.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          {new Date(session.date).toLocaleDateString()} at {session.time}
                        </span>
                        <span>{session.duration} min</span>
                      </div>
                      {session.progress !== undefined && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Overall progress</span>
                            <span className="font-medium">{session.progress}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${session.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {session.notes && (
                        <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                          {session.notes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* ── Feedback ── */}
            <TabsContent value="feedback" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Submit Feedback</CardTitle>
                  <CardDescription>Share your experience to help us improve</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setFeedbackRating(n)}
                        className={`text-2xl transition-transform hover:scale-110 ${n <= feedbackRating ? "text-warning" : "text-muted"}`}
                      >
                        <Star
                          className="h-7 w-7"
                          fill={n <= feedbackRating ? "currentColor" : "none"}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Tell us about your experience..."
                    className="w-full rounded-lg border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                  <Button>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Submit Feedback
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">Previous Feedback</div>
                {feedbackList.map((fb) => (
                  <Card key={fb.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${i < fb.rating ? "text-warning fill-warning" : "text-muted"}`}
                              />
                            ))}
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {fb.category}
                            {fb.staffName ? ` · ${fb.staffName}` : ""}
                            {fb.department ? ` · ${fb.department}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={fb.status === "resolved" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {fb.status}
                          </Badge>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {new Date(fb.date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      {fb.comment && (
                        <div className="mt-2 text-sm text-muted-foreground">{fb.comment}</div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* JSON Viewer Modal Overlay */}
      <AnimatePresence>
        {selectedRxJson && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 backdrop-blur-sm p-4"
            onClick={() => setSelectedRxJson(null)}
          >
            <div
              className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-clinical-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Cryptographic JSON Payload
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    Verifiable raw ledger metadata for Rx {selectedRxJson.rxId}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRxJson(null)}
                  className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="bg-muted p-4 rounded-xl border border-border/60 overflow-x-auto">
                <pre className="text-xs font-mono text-foreground leading-relaxed select-all">
                  {JSON.stringify(
                    {
                      rxId: selectedRxJson.rxId,
                      patientDid,
                      diagnosis: selectedRxJson.diagnosis,
                      chiefComplaint: selectedRxJson.chiefComplaint || undefined,
                      symptoms: selectedRxJson.symptoms || undefined,
                      signedBy: selectedRxJson.doctor,
                      doctorDid: selectedRxJson.doctorDid || undefined,
                      apptId: selectedRxJson.apptId || undefined,
                      signedAt: selectedRxJson.date,
                      status: selectedRxJson.status,
                      followUpDate: selectedRxJson.followUpDate || undefined,
                      drugs: selectedRxJson.medicines,
                      notes: selectedRxJson.notes || undefined,
                      linkedReport: selectedRxJson.report
                        ? {
                            recordId: selectedRxJson.report.recordId,
                            title: selectedRxJson.report.title,
                            consultationSummary:
                              selectedRxJson.report.consultationSummary || undefined,
                            clinicalNotes: selectedRxJson.report.clinicalNotes || undefined,
                            testResults: selectedRxJson.report.testResults || undefined,
                            recommendedFollowUp:
                              selectedRxJson.report.recommendedFollowUp || undefined,
                            createdAt: selectedRxJson.report.createdAt,
                          }
                        : undefined,
                      hash: `sha256:d8c0b56${selectedRxJson.rxId?.slice(-8)}`,
                      blockchainMeta: { network: "solana-devnet", verified: true },
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setSelectedRxJson(null)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Close Payload
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}
