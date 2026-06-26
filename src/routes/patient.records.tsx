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
  TrendingUp,
  Activity,
  FlaskConical,
  ImageIcon,
  ClipboardList,
  Star,
  Stethoscope,
  Dumbbell,
  MessageSquare,
  ShoppingBag,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  prescriptions,
  medicalDocuments,
  healthMetrics,
  pharmacyOrders,
  rehabSessions,
  feedbackList,
} from "@/lib/medical-records-data";
import { useState, useEffect } from "react";
import { getPrescriptions, getMedicalRecords } from "@/lib/api";

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
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [apiPrescriptions, setApiPrescriptions] = useState<any[]>([]);
  const [apiRecords, setApiRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const patientDid = typeof window !== "undefined" ? localStorage.getItem("userDID") || "" : "";

  useEffect(() => {
    if (!patientDid) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const fetchData = async () => {
      try {
        const [rxRes, recRes] = await Promise.all([
          getPrescriptions(patientDid),
          getMedicalRecords(patientDid),
        ]);
        if (mounted) {
          setApiPrescriptions(rxRes.prescriptions || []);
          setApiRecords(recRes.records || []);
        }
      } catch (err) {
        console.warn("Could not load medical records from API, using mock data:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      mounted = false;
    };
  }, [patientDid]);

  const displayPrescriptions = [
    ...apiPrescriptions.map((rx) => ({
      id: rx.rxId,
      diagnosis: rx.diagnosis,
      doctor: rx.signedBy || "Doctor",
      specialty: "General Care",
      date: rx.signedAt || new Date().toISOString(),
      status: rx.status || "active",
      medicines: rx.drugs || [],
      nextReviewDate: "",
      notes: rx.notes,
    })),
    ...prescriptions,
  ];

  const displayDocuments = [
    ...apiRecords.map((rec) => ({
      id: rec.recordId,
      title: rec.title,
      type: rec.type, // e.g. "lab-report"
      date: rec.createdAt || new Date().toISOString(),
      issuedBy: rec.doctorName || "Doctor",
      fileSize: "N/A",
      summary: rec.content,
      isNew: true,
    })),
    ...medicalDocuments,
  ];

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Patient app"
          title="Medical Records"
          description="Prescriptions, reports, health metrics, pharmacy and rehabilitation"
        />

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
                  Loading latest prescriptions...
                </div>
              )}
              {displayPrescriptions.map((rx) => (
                <Card key={rx.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{rx.diagnosis}</CardTitle>
                        <CardDescription>
                          {rx.doctor} · {rx.specialty} · {new Date(rx.date).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={rx.status === "active" ? "default" : "secondary"}>
                          {rx.status}
                        </Badge>
                        <Button variant="outline" size="sm">
                          <Download className="mr-1 h-3 w-3" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {rx.medicines.map((med: any, i: number) => (
                        <div key={i} className="rounded-lg border p-3">
                          <div className="flex items-center gap-2">
                            <Pill className="h-4 w-4 text-primary shrink-0" />
                            <div className="font-medium">
                              {med.name} {med.dosage}
                            </div>
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {med.frequency} · {med.duration}
                          </div>
                          {med.instructions && (
                            <div className="mt-1 text-xs text-muted-foreground italic">
                              {med.instructions}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {rx.nextReviewDate && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/5 p-2 text-sm">
                        <Activity className="h-4 w-4 text-primary" />
                        Next review: {new Date(rx.nextReviewDate).toLocaleDateString()}
                      </div>
                    )}
                    {rx.notes && (
                      <div className="mt-2 text-xs text-muted-foreground italic">
                        Notes: {rx.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
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
                    value: `${healthMetrics[0].weight} kg`,
                    sub: `BMI ${healthMetrics[0].bmi}`,
                    trend: -1,
                  },
                  {
                    label: "Blood Pressure",
                    value: `${healthMetrics[0].bloodPressure?.systolic}/${healthMetrics[0].bloodPressure?.diastolic}`,
                    sub: "mmHg",
                    trend: -1,
                  },
                  {
                    label: "Blood Sugar (F)",
                    value: `${healthMetrics[0].bloodSugar?.fasting} mg/dL`,
                    sub: "Fasting",
                    trend: -1,
                  },
                  {
                    label: "HbA1c",
                    value: `${healthMetrics[0].hba1c}%`,
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
                      {order.medicines.map((m, i) => (
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
    </RouteGuard>
  );
}
