import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Heart,
  Pill,
  Stethoscope,
  FlaskConical,
  Calendar,
  Utensils,
  FileText,
  AlertCircle,
  Clock,
  ChevronRight,
  Thermometer,
  Droplet,
  Receipt,
} from "lucide-react";
import { useState, useEffect } from "react";
import { usePatientVitals, useInpatientData } from "@/hooks/use-api";
import { getBilling, getLabs } from "@/lib/api";
import { toast } from "sonner";

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
  const patientDid =
    typeof window !== "undefined" ? localStorage.getItem("userDID") || "pat_001" : "pat_001";
  const { vitals: liveVitals } = usePatientVitals(patientDid);
  const { data: inpatientData } = useInpatientData(patientDid);

  const [billSummary, setBillSummary] = useState<any>({ totalCharges: 0, balanceDue: 0 });
  const [labTests, setLabTests] = useState<any[]>([]);

  useEffect(() => {
    getBilling(patientDid)
      .then((res) => {
        if (res?.billSummary) {
          setBillSummary(res.billSummary);
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load billing summary", { description: err.message });
      });

    getLabs(patientDid)
      .then((res) => {
        setLabTests(res?.labs || []);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load lab tests", { description: err.message });
      });
  }, [patientDid]);

  const apiVitalSigns = inpatientData?.vitalSigns ?? [];
  const medications = inpatientData?.medications ?? [];
  const dailyCheckups = inpatientData?.checkups ?? [];
  const procedures = inpatientData?.procedures ?? [];
  const nursingNotes = inpatientData?.nursingNotes ?? [];
  const dietOrder = inpatientData?.dietOrder ?? {
    type: "Regular",
    restrictions: [],
    specialInstructions: "",
  };
  const currentAdmission = inpatientData?.admission ?? {
    admissionDate: new Date().toISOString(),
    expectedDischargeDate: null,
    ward: "—",
    room: "—",
    bed: "—",
    primaryDiagnosis: "—",
    admittingDoctor: "—",
  };

  const defaultVital = {
    id: "v0",
    heartRate: 72,
    bloodPressure: { systolic: 120, diastolic: 80 },
    oxygenSaturation: 98,
    temperature: 36.6,
    respiratoryRate: 16,
    timestamp: "—",
    recordedBy: "—",
  };

  const latestVitals = liveVitals
    ? {
        ...(apiVitalSigns[0] || defaultVital),
        heartRate: liveVitals.heartRate,
        bloodPressure: {
          systolic: parseInt(liveVitals.bp) || 120,
          diastolic: parseInt(liveVitals.bp.split("/")[1]) || 80,
        },
        oxygenSaturation: liveVitals.spo2,
        temperature: liveVitals.temp,
        respiratoryRate: liveVitals.respRate,
        timestamp: "Live telemetry (WS)",
      }
    : apiVitalSigns[0] || defaultVital;

  const activeMeds = medications.filter((m: any) => m.status === "active");
  const todayCheckups = dailyCheckups.filter(
    (c: any) => c.date === new Date().toISOString().split("T")[0],
  );
  const upcomingProcedures = procedures.filter((p: any) => p.status === "scheduled");

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Patient app"
          title="Inpatient Care"
          description="Your admission details, vitals, medications and care plan"
        />

        <div className="mt-6 space-y-6">
          {/* Top row: admission card + quick stats + billing */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Admission Status */}
            <Card className="border-primary/30 bg-primary/5 lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="default" className="bg-primary">
                    Currently Admitted
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Day{" "}
                    {Math.ceil(
                      (new Date().getTime() - new Date(currentAdmission.admissionDate).getTime()) /
                        (1000 * 60 * 60 * 24),
                    )}{" "}
                    of stay
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Ward</div>
                    <div className="font-medium">{currentAdmission.ward}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Room / Bed</div>
                    <div className="font-medium">
                      {currentAdmission.room} — {currentAdmission.bed}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Admitted</div>
                    <div className="font-medium">
                      {new Date(currentAdmission.admissionDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Expected Discharge</div>
                    <div className="font-medium">
                      {currentAdmission.expectedDischargeDate
                        ? new Date(currentAdmission.expectedDischargeDate).toLocaleDateString()
                        : "TBD"}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground">Primary Diagnosis</div>
                  <div className="font-medium">{currentAdmission.primaryDiagnosis}</div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Attending: {currentAdmission.admittingDoctor}
                </div>
              </CardContent>
            </Card>

            {/* Quick vitals + billing */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
                        <Heart className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Heart Rate</div>
                        <div className="text-lg font-semibold">{latestVitals.heartRate} bpm</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Activity className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">BP</div>
                        <div className="text-lg font-semibold">
                          {latestVitals.bloodPressure.systolic}/
                          {latestVitals.bloodPressure.diastolic}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Link to="/patient/billing">
                <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent hover:shadow-clinical-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Receipt className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Current Bill</div>
                          <div className="text-lg font-semibold">
                            ₹{billSummary.totalCharges.toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Balance Due</div>
                        <div className="text-sm font-semibold text-destructive">
                          ₹{billSummary.balanceDue.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>View detailed bill</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>

          {/* Main content: tabs on left, nursing notes + emergency on right */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Tabs defaultValue="today" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="today">Today</TabsTrigger>
                  <TabsTrigger value="vitals">Vitals</TabsTrigger>
                  <TabsTrigger value="meds">Meds</TabsTrigger>
                  <TabsTrigger value="tests">Tests</TabsTrigger>
                </TabsList>

                {/* Today's Schedule */}
                <TabsContent value="today" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm">Today's Checkups</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {todayCheckups.map((checkup: any) => (
                        <div
                          key={checkup.id}
                          className="flex items-start justify-between rounded-lg border p-3"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{checkup.time}</span>
                              <Badge
                                variant={checkup.status === "completed" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {checkup.status}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {checkup.doctor} • {checkup.specialty}
                            </div>
                            {checkup.status === "completed" && (
                              <div className="text-sm mt-1">{checkup.notes}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm">Upcoming Procedures</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {upcomingProcedures.length > 0 ? (
                          upcomingProcedures.map((proc: any) => (
                            <div key={proc.id} className="rounded-lg border p-3">
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
                                {new Date(proc.scheduledDate).toLocaleDateString()} at{" "}
                                {proc.scheduledTime}
                              </div>
                              <div className="text-xs text-muted-foreground">{proc.location}</div>
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
                        <div className="font-medium">{dietOrder.type}</div>
                        <div className="mt-2 space-y-1">
                          {dietOrder.restrictions.map((r: any, idx: number) => (
                            <div
                              key={idx}
                              className="text-sm text-muted-foreground flex items-center gap-1"
                            >
                              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                              {r}
                            </div>
                          ))}
                        </div>
                        {dietOrder.specialInstructions && (
                          <div className="mt-2 text-sm bg-muted p-2 rounded">
                            {dietOrder.specialInstructions}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Vitals Tab */}
                <TabsContent value="vitals" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Latest Vital Signs</CardTitle>
                      <CardDescription className="text-xs">
                        Recorded at {latestVitals.timestamp} by {latestVitals.recordedBy}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      <VitalRow
                        icon={Thermometer}
                        label="Temperature"
                        value={`${latestVitals.temperature}°C`}
                        normal={
                          latestVitals.temperature >= 36.5 && latestVitals.temperature <= 37.5
                        }
                      />
                      <VitalRow
                        icon={Activity}
                        label="Blood Pressure"
                        value={`${latestVitals.bloodPressure.systolic}/${latestVitals.bloodPressure.diastolic} mmHg`}
                        normal={latestVitals.bloodPressure.systolic < 140}
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
                        normal={
                          latestVitals.respiratoryRate >= 12 && latestVitals.respiratoryRate <= 20
                        }
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
                      {apiVitalSigns.slice(1, 4).map((vital: any) => (
                        <div
                          key={vital.id}
                          className="flex items-center justify-between text-sm border-b pb-2"
                        >
                          <div>
                            <div className="font-medium">{vital.timestamp}</div>
                            <div className="text-muted-foreground text-xs">{vital.recordedBy}</div>
                          </div>
                          <div className="text-right">
                            <div>{vital.heartRate} bpm</div>
                            <div className="text-muted-foreground text-xs">
                              {vital.bloodPressure.systolic}/{vital.bloodPressure.diastolic} mmHg
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Medications Tab */}
                <TabsContent value="meds" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm">Active Medications</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      {activeMeds.map((med: any) => (
                        <div key={med.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{med.name}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {med.dosage} • {med.frequency}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Route: {med.route}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              Active
                            </Badge>
                          </div>
                          {med.nextDose && (
                            <div className="mt-2 flex items-center gap-1 text-sm text-primary">
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
                <TabsContent value="tests" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm">Lab Tests</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      {labTests.map((test) => (
                        <div key={test.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{test.testName}</div>
                            <Badge
                              variant={
                                test.status === "completed"
                                  ? "default"
                                  : test.status === "in-progress"
                                    ? "secondary"
                                    : "outline"
                              }
                              className="text-xs"
                            >
                              {test.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Ordered: {new Date(test.orderedDate).toLocaleDateString()}
                          </div>
                          {test.results && (
                            <div className="mt-2 space-y-1">
                              {test.results.map((result: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <span>{result.parameter}</span>
                                  <span
                                    className={result.flag ? "text-destructive font-medium" : ""}
                                  >
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
            </div>

            {/* Right sidebar: nursing notes + emergency */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Recent Nursing Notes</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {nursingNotes.slice(0, 3).map((note: any) => (
                    <div key={note.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium">{note.timestamp}</div>
                        <Badge
                          variant={
                            note.priority === "urgent"
                              ? "destructive"
                              : note.priority === "important"
                                ? "default"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {note.priority}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {note.nurse} • {note.category}
                      </div>
                      <div className="text-sm mt-1">{note.note}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 font-medium text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Need Assistance?
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Press the call button in your room or contact the nurse station
                  </div>
                  <Button variant="destructive" size="sm" className="w-full mt-3">
                    Call Nurse
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}

function VitalRow({
  icon: Icon,
  label,
  value,
  normal,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  normal: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${normal ? "bg-success/10" : "bg-destructive/10"}`}
        >
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
