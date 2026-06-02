import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { RouteGuard } from "@/components/RouteGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Receipt, CreditCard, FileText, TrendingUp, Calendar, 
  AlertCircle, CheckCircle, Clock, Download, Shield, IndianRupee
} from "lucide-react";
import { 
  billSummary, billItems, dailyCharges, insuranceInfo, paymentRecords 
} from "@/lib/billing-data";

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
  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-success/10 text-success";
      case "partial": return "bg-warning/10 text-warning-foreground";
      case "pending": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <RouteGuard requiredRole="patient">
      <PhoneFrame title="Billing & Charges">
        <div className="space-y-4 p-4">
          {/* Bill Summary Card */}
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Current Bill</CardTitle>
                  <CardDescription className="text-xs">
                    Bill #{billSummary.billNumber}
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(billSummary.status)}>
                  {billSummary.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-primary/5 p-3">
                <div className="text-xs text-muted-foreground">Total Charges</div>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(billSummary.totalCharges)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(billSummary.fromDate).toLocaleDateString()} - {new Date(billSummary.toDate).toLocaleDateString()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border p-2">
                  <div className="text-xs text-muted-foreground">Insurance Claimed</div>
                  <div className="font-semibold text-primary">
                    {formatCurrency(billSummary.insuranceClaimed)}
                  </div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-xs text-muted-foreground">Your Responsibility</div>
                  <div className="font-semibold text-foreground">
                    {formatCurrency(billSummary.patientResponsibility)}
                  </div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-xs text-muted-foreground">Amount Paid</div>
                  <div className="font-semibold text-success">
                    {formatCurrency(billSummary.amountPaid)}
                  </div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-xs text-muted-foreground">Balance Due</div>
                  <div className="font-semibold text-destructive">
                    {formatCurrency(billSummary.balanceDue)}
                  </div>
                </div>
              </div>

              {billSummary.balanceDue > 0 && (
                <Button className="w-full" size="sm">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay Now
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Insurance Info */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Insurance Coverage</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Provider</span>
                <span className="font-medium">{insuranceInfo.provider}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Policy Number</span>
                <span className="font-mono text-xs">{insuranceInfo.policyNumber}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Coverage</span>
                <span className="font-medium">{insuranceInfo.coveragePercentage}% after deductible</span>
              </div>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Deductible Met</span>
                  <span>{formatCurrency(insuranceInfo.deductibleMet)} / {formatCurrency(insuranceInfo.deductible)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div 
                    className="h-full bg-primary" 
                    style={{ width: `${(insuranceInfo.deductibleMet / insuranceInfo.deductible) * 100}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Out-of-Pocket Met</span>
                  <span>{formatCurrency(insuranceInfo.outOfPocketMet)} / {formatCurrency(insuranceInfo.outOfPocketMax)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div 
                    className="h-full bg-success" 
                    style={{ width: `${(insuranceInfo.outOfPocketMet / insuranceInfo.outOfPocketMax) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs for Details */}
          <Tabs defaultValue="daily" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
              <TabsTrigger value="items" className="text-xs">Items</TabsTrigger>
              <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
            </TabsList>

            {/* Daily Charges */}
            <TabsContent value="daily" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Daily Charges Breakdown</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dailyCharges.map((day, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">
                          {new Date(day.date).toLocaleDateString('en-IN', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </div>
                        <div className="font-semibold">{formatCurrency(day.total)}</div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Room</span>
                          <span>{formatCurrency(day.roomCharge)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Nursing</span>
                          <span>{formatCurrency(day.nursingCare)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Meals</span>
                          <span>{formatCurrency(day.meals)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Supplies</span>
                          <span>{formatCurrency(day.supplies)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Itemized Charges */}
            <TabsContent value="items" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm">Itemized Charges</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      <Download className="mr-1 h-3 w-3" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {/* Group by category */}
                  {billSummary.categoryTotals.map((cat) => {
                    const categoryItems = billItems.filter(item => item.category === cat.category);
                    return (
                      <div key={cat.category} className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg bg-muted p-2">
                          <span className="text-sm font-medium capitalize">{cat.category}</span>
                          <span className="text-sm font-semibold">{formatCurrency(cat.amount)}</span>
                        </div>
                        {categoryItems.map((item) => (
                          <div key={item.id} className="ml-2 flex items-start justify-between border-l-2 border-muted pl-3 text-xs">
                            <div className="flex-1">
                              <div className="font-medium">{item.description}</div>
                              <div className="text-muted-foreground">
                                {new Date(item.date).toLocaleDateString()} • Qty: {item.quantity}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">{formatCurrency(item.totalPrice)}</div>
                              {item.coveredByInsurance && (
                                <div className="text-muted-foreground">
                                  You pay: {formatCurrency(item.patientResponsibility)}
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
            <TabsContent value="payments" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Payment History</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {paymentRecords.map((payment) => (
                    <div key={payment.id} className="flex items-start justify-between rounded-lg border p-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-success" />
                          <span className="font-medium text-sm">{formatCurrency(payment.amount)}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {payment.paidBy}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
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
                          <span className="font-medium text-sm">{formatCurrency(billSummary.insurancePending)}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
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
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      Outstanding Balance
                    </div>
                    <div className="mt-2 text-2xl font-bold">
                      {formatCurrency(billSummary.balanceDue)}
                    </div>
                    <div className="mt-3 space-y-2">
                      <Button className="w-full" size="sm">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Pay Online
                      </Button>
                      <Button variant="outline" className="w-full" size="sm">
                        <FileText className="mr-2 h-4 w-4" />
                        Request Payment Plan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download Bill
            </Button>
            <Button variant="outline" size="sm">
              <FileText className="mr-2 h-4 w-4" />
              Email Bill
            </Button>
          </div>
        </div>
      </PhoneFrame>
    </RouteGuard>
  );
}
