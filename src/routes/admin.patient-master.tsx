/**
 * Admin Portal — Patient Master Detail View
 * 
 * Provides comprehensive unified patient information and actions:
 * - Patient summary (demographics, DIDs, preferences)
 * - Current admission and location (bed, room, ward, building, hospital)
 * - Medical information (records, procedures, medications, lab results)
 * - Billing and insurance
 * - Admission and transfer history
 * - Quick actions: admit, transfer, discharge
 */

import React, { useState, useCallback, useMemo } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import {
  Users,
  Search,
  RefreshCw,
  Bed,
  MapPin,
  FileText,
  Pill,
  Stethoscope,
  Receipt,
  History,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Heart,
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  DollarSign,
  Building,
  Activity,
  Plus,
  Edit,
  LogOut,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPatientMaster,
  getPatientAdmissionHistory,
  getPatientTransferHistory,
  getPatientMedicalRecords,
  getPatientMedications,
  getPatientProcedures,
  getPatientLabResults,
  getPatientBilling,
  getPatientDischargeInfo,
  getAllAdmissions,
} from "@/lib/api";
import { useTableRefresh } from "@/hooks/use-realtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/patient-master")({
  head: () => ({
    meta: [{ title: "Patient Master — Admin Console" }],
  }),
  validateSearch: (search: any) => ({
    patientDid: search.patientDid ?? "",
  }),
  component: AdminPatientMasterGuarded,
});

interface PatientMasterData {
  patientDid: string;
  name: string;
  hospitalId: string;
  hospitalName: string;
  currentAdmission: any;
  currentLocation: any;
  assignedDoctorDid: string | null;
  assignedNurseId: string | null;
  medicalSummary: any;
  billing: any;
  insurance: any;
  preferences: any;
  registeredAt: string;
  lastAdmissionDate: string;
}

function AdminPatientMasterPage() {
  const search = useSearch({ from: "/admin/patient-master" });
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(search.patientDid ?? null);
  const [patientMaster, setPatientMaster] = useState<PatientMasterData | null>(null);
  const [admissionHistory, setAdmissionHistory] = useState<any[]>([]);
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [labResults, setLabResults] = useState<any[]>([]);
  const [billing, setBilling] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    location: true,
    medical: false,
    billing: false,
    history: false,
  });

  // Load all patients for search
  const loadPatientList = useCallback(async () => {
    try {
      const res = await getAllAdmissions();
      setPatients(res.admissions ?? []);
    } catch (err: any) {
      toast.error("Could not load patients", { description: err.message });
    }
  }, []);

  // Load detailed patient master data
  const loadPatientData = useCallback(
    async (patientDid: string) => {
      if (!patientDid) return;
      setLoading(true);
      try {
        const [master, history, transfers, records, meds, procs, labs, bill] = await Promise.all([
          getPatientMaster({ patientDid }),
          getPatientAdmissionHistory({ patientDid, limit: 50 }),
          getPatientTransferHistory({ patientDid, limit: 50 }),
          getPatientMedicalRecords({ patientDid, limit: 50 }),
          getPatientMedications({ patientDid }),
          getPatientProcedures({ patientDid }),
          getPatientLabResults({ patientDid, limit: 50 }),
          getPatientBilling({ patientDid }),
        ]);

        if (master.ok) setPatientMaster(master.patient);
        if (history.ok) setAdmissionHistory(history.admissions);
        if (transfers.ok) setTransferHistory(transfers.transfers);
        if (records.ok) setMedicalRecords(records.records);
        if (meds.ok) setMedications(meds.medications);
        if (procs.ok) setProcedures(procs.procedures);
        if (labs.ok) setLabResults(labs.labResults);
        if (bill.ok) setBilling(bill);
      } catch (err: any) {
        toast.error("Could not load patient data", { description: err.message });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    loadPatientList();
  }, [loadPatientList]);

  React.useEffect(() => {
    if (selectedPatient) {
      loadPatientData(selectedPatient);
    }
  }, [selectedPatient, loadPatientData]);

  // Live updates
  useTableRefresh("admissions", () => loadPatientList());
  useTableRefresh("billing_accounts", () => {
    if (selectedPatient) loadPatientData(selectedPatient);
  });

  const filteredPatients = useMemo(() => {
    const q = searchQ.toLowerCase();
    return patients.filter(
      (p) =>
        p.patient_name?.toLowerCase().includes(q) || 
        p.patient_did?.toLowerCase().includes(q) ||
        p.ward?.toLowerCase().includes(q),
    );
  }, [patients, searchQ]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading && !patientMaster) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading patient data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
          Admin Console
        </div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary" /> Patient Master
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Unified patient information, admission history, medical records, and billing
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Patient List Sidebar */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Patients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  className="pl-8 text-xs"
                />
              </div>
              <div className="max-h-[70vh] overflow-y-auto space-y-1">
                {filteredPatients.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-2 text-center">
                    No patients found
                  </div>
                ) : (
                  filteredPatients.map((p) => (
                    <button
                      key={p.patient_did}
                      onClick={() => setSelectedPatient(p.patient_did)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        selectedPatient === p.patient_did
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="font-semibold truncate">{p.patient_name || "Unknown"}</div>
                      <div className="text-[10px] opacity-75 truncate">{p.patient_did}</div>
                      {p.status === "admitted" && (
                        <div className="text-[10px] opacity-75">📍 {p.ward}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Patient Details */}
        <div className="lg:col-span-3 space-y-4">
          {!selectedPatient ? (
            <Card className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a patient to view details</p>
            </Card>
          ) : patientMaster ? (
            <>
              {/* Patient Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {patientMaster.name}
                      </CardTitle>
                      <CardDescription className="mt-1 font-mono text-xs">
                        {patientMaster.patientDid}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {patientMaster.currentAdmission ? "Admitted" : "Not Admitted"}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>

              {/* Current Location */}
              {patientMaster.currentLocation && (
                <Card>
                  <CardHeader
                    className="pb-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleSection("location")}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MapPin className="h-4 w-4" /> Current Location
                      </CardTitle>
                      {expandedSections.location ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedSections.location && (
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">Bed</div>
                          <div className="font-mono">
                            {patientMaster.currentLocation.bed?.bedNumber || "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">Room</div>
                          <div>{patientMaster.currentLocation.room?.roomNumber || "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">Ward</div>
                          <div>{patientMaster.currentLocation.ward?.wardName || "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">Floor</div>
                          <div>{patientMaster.currentLocation.floor?.floorNumber || "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">Building</div>
                          <div>{patientMaster.currentLocation.building?.buildingName || "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">Hospital</div>
                          <div>{patientMaster.currentLocation.hospital?.hospitalName || "-"}</div>
                        </div>
                      </div>
                      {patientMaster.currentLocation.admittedAt && (
                        <div className="pt-2 border-t border-border">
                          <div className="text-xs font-semibold text-muted-foreground mb-1">
                            Admitted
                          </div>
                          <div className="text-xs">
                            {new Date(patientMaster.currentLocation.admittedAt).toLocaleString(
                              "en-IN",
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Medical Summary */}
              <Card>
                <CardHeader
                  className="pb-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleSection("medical")}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Stethoscope className="h-4 w-4" /> Medical Information
                    </CardTitle>
                    {expandedSections.medical ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CardHeader>
                {expandedSections.medical && (
                  <CardContent className="space-y-4">
                    <Tabs defaultValue="records" className="w-full">
                      <TabsList className="grid w-full grid-cols-4 text-xs">
                        <TabsTrigger value="records">Records</TabsTrigger>
                        <TabsTrigger value="meds">Medications</TabsTrigger>
                        <TabsTrigger value="procedures">Procedures</TabsTrigger>
                        <TabsTrigger value="labs">Lab Results</TabsTrigger>
                      </TabsList>

                      <TabsContent value="records" className="space-y-2 mt-3">
                        {medicalRecords.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No records found</p>
                        ) : (
                          medicalRecords.slice(0, 5).map((rec) => (
                            <div key={rec.recordId} className="text-xs p-2 rounded-lg bg-muted/50">
                              <div className="font-semibold">{rec.title}</div>
                              <div className="text-muted-foreground">{rec.recordType}</div>
                              <div className="text-[10px] mt-1">
                                {new Date(rec.createdAt).toLocaleDateString("en-IN")}
                              </div>
                            </div>
                          ))
                        )}
                      </TabsContent>

                      <TabsContent value="meds" className="space-y-2 mt-3">
                        {medications.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No medications found</p>
                        ) : (
                          medications.slice(0, 5).map((med) => (
                            <div
                              key={med.medicationId}
                              className="text-xs p-2 rounded-lg bg-muted/50 flex justify-between items-start"
                            >
                              <div>
                                <div className="font-semibold">{med.name}</div>
                                <div className="text-muted-foreground">
                                  {med.dosage} · {med.frequency}
                                </div>
                              </div>
                              <Badge variant="outline" className="text-[10px]">
                                {med.status}
                              </Badge>
                            </div>
                          ))
                        )}
                      </TabsContent>

                      <TabsContent value="procedures" className="space-y-2 mt-3">
                        {procedures.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No procedures found</p>
                        ) : (
                          procedures.slice(0, 5).map((proc) => (
                            <div key={proc.procedureId} className="text-xs p-2 rounded-lg bg-muted/50">
                              <div className="font-semibold">{proc.name}</div>
                              <div className="text-muted-foreground">Status: {proc.status}</div>
                              <div className="text-[10px] mt-1">
                                {proc.scheduledFor ? new Date(proc.scheduledFor).toLocaleDateString("en-IN") : "Not scheduled"}
                              </div>
                            </div>
                          ))
                        )}
                      </TabsContent>

                      <TabsContent value="labs" className="space-y-2 mt-3">
                        {labResults.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No lab results found</p>
                        ) : (
                          labResults.slice(0, 5).map((lab) => (
                            <div
                              key={lab.labId}
                              className="text-xs p-2 rounded-lg bg-muted/50 flex justify-between items-start"
                            >
                              <div>
                                <div className="font-semibold">{lab.testName}</div>
                                <div className="text-muted-foreground">
                                  {lab.resultValue} {lab.unit}
                                </div>
                              </div>
                              <Badge variant="outline" className="text-[10px]">
                                {lab.status}
                              </Badge>
                            </div>
                          ))
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                )}
              </Card>

              {/* Billing */}
              {billing && (
                <Card>
                  <CardHeader
                    className="pb-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleSection("billing")}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Receipt className="h-4 w-4" /> Billing & Insurance
                      </CardTitle>
                      {expandedSections.billing ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedSections.billing && (
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg bg-muted/50 p-3">
                          <div className="text-xs font-semibold text-muted-foreground">
                            Total Billed
                          </div>
                          <div className="text-lg font-bold">
                            ${billing.billing?.totalBilled || 0}
                          </div>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <div className="text-xs font-semibold text-muted-foreground">
                            Outstanding
                          </div>
                          <div className="text-lg font-bold text-destructive">
                            ${billing.billing?.outstanding || 0}
                          </div>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <div className="text-xs font-semibold text-muted-foreground">Paid</div>
                          <div className="text-lg font-bold text-success">
                            ${billing.billing?.totalPaid || 0}
                          </div>
                        </div>
                      </div>
                      {billing.insurance && (
                        <div className="pt-3 border-t border-border">
                          <div className="text-sm font-semibold mb-2">Insurance</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Provider: </span>
                              {billing.insurance.provider}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Policy: </span>
                              {billing.insurance.policyNumber}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Coverage: </span>
                              {billing.insurance.coveragePercentage}%
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Admission History */}
              <Card>
                <CardHeader
                  className="pb-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleSection("history")}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <History className="h-4 w-4" /> Admission & Transfer History
                    </CardTitle>
                    {expandedSections.history ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CardHeader>
                {expandedSections.history && (
                  <CardContent className="space-y-3">
                    {admissionHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No admission history</p>
                    ) : (
                      admissionHistory.map((adm) => (
                        <div key={adm.admissionId} className="border-l-2 border-primary/50 pl-3 py-2">
                          <div className="text-sm font-semibold flex items-center justify-between">
                            {adm.status === "discharged" ? "Discharged" : "Admitted"}
                            <Badge variant="outline" className="text-[10px]">
                              {adm.lengthOfStayDays} days
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(adm.admittedAt).toLocaleDateString("en-IN")}
                            {adm.dischargedAt && ` - ${new Date(adm.dischargedAt).toLocaleDateString("en-IN")}`}
                          </div>
                          <div className="text-xs mt-1">{adm.diagnosis || "No diagnosis recorded"}</div>
                        </div>
                      ))
                    )}
                  </CardContent>
                )}
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Could not load patient data</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminPatientMasterGuarded() {
  return (
    <RouteGuard requiredRole="admin">
      <AdminPatientMasterPage />
    </RouteGuard>
  );
}
