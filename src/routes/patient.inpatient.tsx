import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { RouteGuard } from "@/components/RouteGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, Heart, Pill, Stethoscope, FlaskConical, Calendar, 
  Utensils, FileText, AlertCircle, TrendingUp, Clock, ChevronRight,
  Thermometer, Droplet, Receipt, IndianRupee
} from "lucide-react";
import { 
  currentAdmission, vitalSigns, medications, dailyCheckups, 
  labTests, procedures, nursingNotes, dietOrder 
} from "@/lib/inpatient-data";
import { billSummary } from "@/lib/billing-data";

export const Route = createFileRoute("/patient/inpatient")({
  head: () => ({
    meta: [
      { title: "Inpatient Care — Patient Portal" },
      { name: "description", content: "View your admission details and care plan" },
    ],
  }),
  component: InpatientCare,
});

function InpatientCare() {
  const latestVitals = vitalSigns[0];
  const activeMeds = medications.filter(m => m.status === "active");
  const todayCheckups = dailyCheckups.filter(c => c.date === "2026-05-30");
  const upcomingProcedures = procedures.filter(p => p.status === "scheduled");

  return (
    <RouteGuard requiredRole="patient">
      <PhoneFrame title="Inpatient Care">
        <div className="space-y-4 p-4">
          {/* Admission Status Card */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge variant="default" className="bg-primary">
                  Currently Admitted
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Day {Math.ceil((new Date("2026-05-30").getTime() - new Date(currentAdmission.admissionDate).getTime()) / (1000 * 60 * 60 * 24))} of stay
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Ward</div>
                  <div className="font-medium">{currentAdmission.ward}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Room/Bed</div>
                  <div className="font-medium">{currentAdmission.room} - {currentAdmission.bed}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Admitted</div>
                  <div className="font-medium">{new Date(currentAdmission.admissionDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Expected Discharge</div>
                  <div className="font-medium">{currentAdmission.expectedDischargeDate ? new Date(currentAdmission.expectedDischargeDate).toLocaleDateString() : "TBD"}</div>
                </div>
              </div>
              <div className="pt-2">
                <div className="text-xs text-muted-foreground">Primary Diagnosis</div>
                <div className="font-medium text-sm">{currentAdmission.primaryDiagnosis}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                Attending: {currentAdmission.admittingDoctor}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
                    <Heart className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Heart Rate</div>
                    <div className="text-lg font-semibold">{latestVitals.heartRate} bpm</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">BP</div>
                    <div className="text-lg font-semibold">
                      {latestVitals.bloodPressure.systolic}/{latestVitals.bloodPressure.diastolic}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Billing Summary */}
          <Link to="/patient/billing">
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent hover:shadow-clinical-md transition-shadow">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Receipt className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Current Bill</div>
                      <div className="text-lg font-semibold">
                        ₹{billSummary.totalCharges.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Balance Due</div>
                    <div className="text-sm font-semibold text-destructive">
                      ₹{billSummary.balanceDue.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">View detailed bill</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Tabs for different sections */}
          <Tabs defaultValue="today" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
              <TabsTrigger value="vitals" className="text-xs">Vitals</TabsTrigger>
              <TabsTrigger value="meds" className="text-xs">Meds</TabsTrigger>
              <TabsTrigger value="tests" className="text-xs">Tests</TabsTrigger>
            </TabsList>

            {/* Today's Schedule */}
            <TabsContent value="today" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Today's Checkups</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {todayCheckups.map((checkup) => (
                    <div key={checkup.id} className="flex items-start justify-between rounded-lg border p-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{checkup.time}</span>
                          <Badge variant={checkup.status === "completed" ? "default" : "secondary"} className="text-xs">
                            {checkup.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {checkup.doctor} • {checkup.specialty}
                        </div>
                        {checkup.status === "completed" && (
                          <div className="text-xs mt-1">{checkup.notes}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Upcoming Procedures</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {upcomingProcedures.length > 0 ? (
                    upcomingProcedures.map((proc) => (
                      <div key={proc.id} className="rounded-lg border p-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{proc.name}</div>
                          {proc.requiresFasting && (
                            <Badge variant="outline" className="text-xs">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Fasting
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(proc.scheduledDate).toLocaleDateString()} at {proc.scheduledTime}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Location: {proc.location}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      No procedures scheduled
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Diet Plan</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium">{dietOrder.type}</div>
                  <div className="mt-2 space-y-1">
                    {dietOrder.restrictions.map((restriction, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                        {restriction}
                      </div>
                    ))}
                  </div>
                  {dietOrder.specialInstructions && (
                    <div className="mt-2 text-xs bg-muted p-2 rounded">
                      {dietOrder.specialInstructions}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Vitals Tab */}
            <TabsContent value="vitals" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Latest Vital Signs</CardTitle>
                  <CardDescription className="text-xs">
                    Recorded at {latestVitals.timestamp} by {latestVitals.recordedBy}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <VitalRow 
                    icon={Thermometer} 
                    label="Temperature" 
                    value={`${latestVitals.temperature}°C`}
                    normal={latestVitals.temperature >= 36.5 && latestVitals.temperature <= 37.5}
                  />
                  <VitalRow 
                    icon={Activity} 
                    label="Blood Pressure" 
                    value={`${latestVitals.bloodPressure.systolic}/${latestVitals.bloodPressure.diastolic} mmHg`}
                    normal={latestVitals.bloodPressure.systolic < 140 && latestVitals.bloodPressure.diastolic < 90}
                  />
                  <VitalRow 
                    icon={Heart} 
                    label="Heart Rate" 
                    value={`${latestVitals.heartRate} bpm`}
                    normal={latestVitals.heartRate >= 60 && latestVitals.heartRate <= 100}
                  />
                  <VitalRow 
                    icon={Activity} 
                    label="Respiratory Rate" 
                    value={`${latestVitals.respiratoryRate} /min`}
                    normal={latestVitals.respiratoryRate >= 12 && latestVitals.respiratoryRate <= 20}
                  />
                  <VitalRow 
                    icon={Droplet} 
                    label="O₂ Saturation" 
                    value={`${latestVitals.oxygenSaturation}%`}
                    normal={latestVitals.oxygenSaturation >= 95}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Vitals History</CardTitle>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      View Chart
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {vitalSigns.slice(1, 4).map((vital) => (
                    <div key={vital.id} className="flex items-center justify-between text-xs border-b pb-2">
                      <div>
                        <div className="font-medium">{vital.timestamp}</div>
                        <div className="text-muted-foreground">{vital.recordedBy}</div>
                      </div>
                      <div className="text-right">
                        <div>{vital.heartRate} bpm</div>
                        <div className="text-muted-foreground">
                          {vital.bloodPressure.systolic}/{vital.bloodPressure.diastolic}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Medications Tab */}
            <TabsContent value="meds" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Active Medications</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {activeMeds.map((med) => (
                    <div key={med.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{med.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {med.dosage} • {med.frequency}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Route: {med.route}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Active
                        </Badge>
                      </div>
                      {med.nextDose && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                          <Clock className="h-3 w-3" />
                          Next dose: {med.nextDose}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        Prescribed by: {med.prescribedBy}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tests Tab */}
            <TabsContent value="tests" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Lab Tests</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {labTests.map((test) => (
                    <div key={test.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{test.testName}</div>
                        <Badge 
                          variant={
                            test.status === "completed" ? "default" : 
                            test.status === "in-progress" ? "secondary" : 
                            "outline"
                          }
                          className="text-xs"
                        >
                          {test.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Ordered: {new Date(test.orderedDate).toLocaleDateString()}
                      </div>
                      {test.results && (
                        <div className="mt-2 space-y-1">
                          {test.results.map((result, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span>{result.parameter}</span>
                              <span className={result.flag ? "text-destructive font-medium" : ""}>
                                {result.value} {result.unit}
                                {result.flag && ` (${result.flag})`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Nursing Notes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Recent Nursing Notes</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {nursingNotes.slice(0, 3).map((note) => (
                <div key={note.id} className="rounded-lg border p-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium">{note.timestamp}</div>
                    <Badge 
                      variant={
                        note.priority === "urgent" ? "destructive" : 
                        note.priority === "important" ? "default" : 
                        "secondary"
                      }
                      className="text-xs"
                    >
                      {note.priority}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {note.nurse} • {note.category}
                  </div>
                  <div className="text-xs mt-1">{note.note}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertCircle className="h-4 w-4" />
                Need Assistance?
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Press the call button in your room or contact the nurse station
              </div>
              <Button variant="destructive" size="sm" className="w-full mt-2">
                Call Nurse
              </Button>
            </CardContent>
          </Card>
        </div>
      </PhoneFrame>
    </RouteGuard>
  );
}

function VitalRow({ 
  icon: Icon, 
  label, 
  value, 
  normal 
}: { 
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  normal: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${normal ? "bg-success/10" : "bg-destructive/10"}`}>
          <Icon className={`h-4 w-4 ${normal ? "text-success" : "text-destructive"}`} />
        </div>
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{value}</span>
        {!normal && <AlertCircle className="h-4 w-4 text-destructive" />}
      </div>
    </div>
  );
}
