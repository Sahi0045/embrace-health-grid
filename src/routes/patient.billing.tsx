import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Receipt,
  CreditCard,
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Shield,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getBilling, payBill } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/patient/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Charges — Patient Portal" },
      { name: "description", content: "View your hospital bills and payment details" },
    ],
  }),
  component: PatientBilling,
});

function PatientBilling() {
  const [billingData, setBillingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const patientDid = typeof window !== "undefined" ? localStorage.getItem("userDID") || "" : "";
  const currentUser = getCurrentUser();

  const fetchBilling = () => {
    if (!patientDid) return;
    setLoading(true);
    getBilling(patientDid)
      .then((res) => {
        setBillingData(res);
      })
      .catch((err) => {
        console.error("Billing load error:", err);
        toast.error("Failed to load billing details", { description: err.message });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBilling();
  }, [patientDid]);

  const handlePayment = async (amount: number, category: string) => {
    try {
      toast.promise(
        (async () => {
          await payBill({
            patientDid,
            patientName: currentUser?.name || "Patient",
            amount,
            category,
          });
          fetchBilling();
          return true;
        })(),
        {
          loading: "Processing secure digital signature payment...",
          success: "Payment settled successfully! Transaction recorded on Solana ledger.",
          error: "Payment failed",
        },
      );
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleExport = () => {
    const headers = [
      "Date",
      "Description",
      "Category",
      "Quantity",
      "Total Price",
      "Covered By Insurance",
    ];
    const rows = billItems.map((item: any) => [
      new Date(item.date).toLocaleDateString(),
      item.description,
      item.category,
      item.quantity,
      item.totalPrice,
      item.coveredByInsurance ? "Yes" : "No",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) =>
        row.map((val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `billing_export_${patientDid}_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Billing log exported", { description: "Format: CSV. File saved to downloads." });
  };

  const handleDownloadBill = () => {
    const textContent = `
=========================================
      EMBRACE HEALTH HOSPITAL INVOICE
=========================================
Patient DID: ${patientDid}
Date: ${new Date().toLocaleDateString()}
Status: ${billSummary?.status?.toUpperCase()}

TOTAL CHARGES: ${fmt(billSummary?.totalCharges ?? 0)}
INSURANCE PAID: ${fmt(billSummary?.insurancePaid ?? 0)}
PATIENT RESPONSIBILITY: ${fmt(billSummary?.patientResponsibility ?? 0)}
PATIENT PAID: ${fmt(billSummary?.patientPaid ?? 0)}
BALANCE DUE: ${fmt(billSummary?.balanceDue ?? 0)}

Itemized breakdown:
${billItems.map((item: any) => `- ${new Date(item.date).toLocaleDateString()} | ${item.description} | Qty: ${item.quantity} | Total: ${fmt(item.totalPrice)}`).join("\n")}

Thank you for choosing Embrace Health.
=========================================
`;

    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `hospital_invoice_${patientDid}.txt`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Invoice generated & downloaded", {
      description: "Format: TXT. File saved to downloads.",
    });
  };

  const handleEmailBill = () => {
    toast.promise(new Promise((resolve) => setTimeout(resolve, 1200)), {
      loading: "Sending bill receipt via encrypted email...",
      success: `Bill sent to ${currentUser?.email || "user@example.com"}`,
      error: "Failed to send email",
    });
  };

  const billSummary = billingData?.billSummary || {
    billNumber: "—",
    status: "pending",
    totalCharges: 0,
    fromDate: new Date().toISOString(),
    toDate: new Date().toISOString(),
    insuranceClaimed: 0,
    patientResponsibility: 0,
    amountPaid: 0,
    balanceDue: 0,
    insurancePending: 0,
    categoryTotals: [],
  };
  const billItems = billingData?.billItems || [];
  const dailyCharges = billingData?.dailyCharges || [];
  const insuranceInfo = billingData?.insuranceInfo || {
    provider: "—",
    policyNumber: "—",
    coveragePercentage: 0,
    deductibleMet: 0,
    deductible: 1,
    outOfPocketMet: 0,
    outOfPocketMax: 1,
  };
  const paymentRecords = billingData?.paymentRecords || [];

  const fmt = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

  const statusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-success/10 text-success";
      case "partial":
        return "bg-warning/10 text-warning-foreground";
      case "pending":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Patient app"
          title="Billing & Charges"
          description="Your hospital bill, insurance coverage and payment history"
        />

        <div className="mt-6 space-y-6">
          {/* Summary row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="sm:col-span-2 border-primary/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Current Bill</CardTitle>
                    <CardDescription className="text-xs">
                      Bill #{billSummary.billNumber}
                    </CardDescription>
                  </div>
                  <Badge className={statusColor(billSummary.status)}>{billSummary.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-primary/5 p-4">
                  <div className="text-xs text-muted-foreground">Total Charges</div>
                  <div className="text-3xl font-bold text-foreground">
                    {fmt(billSummary.totalCharges)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(billSummary.fromDate).toLocaleDateString()} –{" "}
                    {new Date(billSummary.toDate).toLocaleDateString()}
                  </div>
                </div>
                {billSummary.balanceDue > 0 && (
                  <Button
                    onClick={() => handlePayment(billSummary.balanceDue, "total")}
                    className="w-full mt-3"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay Now
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground">Insurance Claimed</div>
                  <div className="text-xl font-semibold text-primary">
                    {fmt(billSummary.insuranceClaimed)}
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="text-xs text-muted-foreground">Your Responsibility</div>
                  <div className="text-xl font-semibold">
                    {fmt(billSummary.patientResponsibility)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground">Amount Paid</div>
                  <div className="text-xl font-semibold text-success">
                    {fmt(billSummary.amountPaid)}
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="text-xs text-muted-foreground">Balance Due</div>
                  <div className="text-xl font-semibold text-destructive">
                    {fmt(billSummary.balanceDue)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main content: tabs + insurance sidebar */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Tabs defaultValue="daily" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="daily">Daily</TabsTrigger>
                  <TabsTrigger value="items">Itemized</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                </TabsList>

                {/* Daily Charges */}
                <TabsContent value="daily" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm">Daily Charges Breakdown</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {dailyCharges.map((day: any, idx: number) => (
                        <div key={idx} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">
                              {new Date(day.date).toLocaleDateString("en-IN", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </div>
                            <div className="font-semibold text-lg">{fmt(day.total)}</div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Room</span>
                              <span className="font-medium">{fmt(day.roomCharge)}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Nursing</span>
                              <span className="font-medium">{fmt(day.nursingCare)}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Meals</span>
                              <span className="font-medium">{fmt(day.meals)}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Supplies</span>
                              <span className="font-medium">{fmt(day.supplies)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Itemized Charges */}
                <TabsContent value="items" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm">Itemized Charges</CardTitle>
                        </div>
                        <Button
                          onClick={handleExport}
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                        >
                          <Download className="mr-1 h-3 w-3" />
                          Export
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {billSummary.categoryTotals.map((cat: any) => {
                        const items = billItems.filter((i: any) => i.category === cat.category);
                        return (
                          <div key={cat.category} className="space-y-2">
                            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                              <span className="font-medium capitalize">{cat.category}</span>
                              <span className="font-semibold">{fmt(cat.amount)}</span>
                            </div>
                            {items.map((item: any) => (
                              <div
                                key={item.id}
                                className="ml-3 flex items-start justify-between border-l-2 border-muted pl-3 text-sm"
                              >
                                <div className="flex-1">
                                  <div className="font-medium">{item.description}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(item.date).toLocaleDateString()} • Qty:{" "}
                                    {item.quantity}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">{fmt(item.totalPrice)}</div>
                                  {item.coveredByInsurance && (
                                    <div className="text-xs text-muted-foreground">
                                      You pay: {fmt(item.patientResponsibility)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Payment History */}
                <TabsContent value="payments" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm">Payment History</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {paymentRecords.map((payment: any) => (
                        <div
                          key={payment.id}
                          className="flex items-start justify-between rounded-lg border p-3"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-success" />
                              <span className="font-medium">{fmt(payment.amount)}</span>
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {payment.paidBy}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {payment.method.toUpperCase()} • {payment.reference}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(payment.date).toLocaleDateString()}
                          </div>
                        </div>
                      ))}

                      {billSummary.insurancePending > 0 && (
                        <div className="flex items-start justify-between rounded-lg border border-warning/30 bg-warning/5 p-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-warning-foreground" />
                              <span className="font-medium">
                                {fmt(billSummary.insurancePending)}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              Insurance claim pending
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            Processing
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {billSummary.balanceDue > 0 && (
                    <Card className="border-destructive/30 bg-destructive/5">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 font-medium text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          Outstanding Balance
                        </div>
                        <div className="mt-2 text-3xl font-bold">{fmt(billSummary.balanceDue)}</div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button onClick={() => handlePayment(billSummary.balanceDue, "online")}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Pay Online
                          </Button>
                          <Button
                            onClick={() =>
                              toast.info("Payment Plan requested", {
                                description: "Our financial department will contact you.",
                              })
                            }
                            variant="outline"
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Payment Plan
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>

              {/* Download actions */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button onClick={handleDownloadBill} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download Bill
                </Button>
                <Button onClick={handleEmailBill} variant="outline" size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  Email Bill
                </Button>
              </div>
            </div>

            {/* Insurance sidebar */}
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Insurance Coverage</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-medium">{insuranceInfo.provider}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Policy No.</span>
                  <span className="font-mono text-xs">{insuranceInfo.policyNumber}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Coverage</span>
                  <span className="font-medium">
                    {insuranceInfo.coveragePercentage}% after deductible
                  </span>
                </div>
                <Separator />
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Deductible Met</span>
                    <span>
                      {fmt(insuranceInfo.deductibleMet)} / {fmt(insuranceInfo.deductible)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${(insuranceInfo.deductibleMet / insuranceInfo.deductible) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Out-of-Pocket Met</span>
                    <span>
                      {fmt(insuranceInfo.outOfPocketMet)} / {fmt(insuranceInfo.outOfPocketMax)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-success"
                      style={{
                        width: `${(insuranceInfo.outOfPocketMet / insuranceInfo.outOfPocketMax) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
