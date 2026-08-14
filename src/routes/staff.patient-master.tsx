/**
 * Staff Portal — Patient Master Detail View
 * 
 * Shows comprehensive patient information for assigned patients:
 * - Current admission and ward location
 * - Medical information (records, medications, procedures)
 * - Vitals and nursing observations
 * - Billing status (if authorized)
 * - Quick actions: add records, manage medications, update status
 *
 * RLS enforces:
 * - Staff sees only patients assigned to their ward/unit
 * - Clinical data visible only with active consent
 * - Billing data restricted to admin/billing staff
 */

import React, { useState, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import {
  Search,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Stethoscope,
  Pill,
  FileText,
  Clock,
  Activity,
  AlertCircle,
  Heart,
  User,
  Calendar,
  Plus,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllAdmissions,
  getPatientMaster,
  getPatientCurrentLocation,
  getPatientMedicalRecords,
  getPatientMedications,
  getPatientProcedures,
} from "@/lib/api";
import { createMedicalRecord } from "@/lib/clinical.server";
import { useTableRefresh } from "@/hooks/use-realtime";
import { useCurrentUser } from "@/lib/auth-context";
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

export const Route = createFileRoute("/staff/patient-master")({
  head: () => ({
    meta: [{ title: "Patient Master — Staff Portal" }],
  }),
  component: StaffPatientMasterGuarded,
});

interface PatientMasterData {
  patientDid: string;
  name: string;
  currentAdmission: any;
  currentLocation: any;
  medicalSummary: any;
  assignedDoctorDid: string | null;
}

function StaffPatientMasterPage() {
  const { user: currentUser } = useCurrentUser();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [patientMaster, setPatientMaster] = useState<PatientMasterData | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    location: true,
    medical: false,
    records: false,
  });

  // Modal states for adding records
  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [recordForm, setRecordForm] = useState({
    title: "",
    type: "nursing-note",
    content: "",
  });
  const [savingRecord, setSavingRecord] = useState(false);

  // Load ward patients (RLS restricts to staff's assigned ward)
  const loadPatientList = useCallback(async () => {
    try {
      const res = await getAllAdmissions();
      // RLS will filter to only the staff's ward
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
        const [master, records, meds, procs] = await Promise.all([
          getPatientMaster({ patientDid }),
          getPatientMedicalRecords({ patientDid, limit: 50 }),
          getPatientMedications({ patientDid }),
          getPatientProcedures({ patientDid }),
        ]);

        if (master.ok) setPatientMaster(master.patient);
        if (records.ok) setMedicalRecords(records.records);
        if (meds.ok) setMedications(meds.medications);
        if (procs.ok) setProcedures(procs.procedures);
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
  useTableRefresh("admissions", loadPatientList);
  useTableRefresh("medical_records", () => {
    if (selectedPatient) loadPatientData(selectedPatient);
  });
  useTableRefresh("medications", () => {
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

  const handleAddRecord = async () => {
    if (!recordForm.title || !recordForm.content || !selectedPatient) {
      toast.error("Please fill in all fields");
      return;
    }

    setSavingRecord(true);
    try {
      await createMedicalRecord({
        data: {
          patientDid: selectedPatient,
          title: recordForm.title,
          recordType: recordForm.type,
          content: recordForm.content,
        },
      });

      toast.success("Record added successfully");
      setRecordForm({ title: "", type: "nursing-note", content: "" });
      setAddRecordOpen(false);
      if (selectedPatient) loadPatientData(selectedPatient);
    } catch (err: any) {
      toast.error("Could not add record", { description: err.message });
    } finally {
      setSavingRecord(false);
    }
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
          Staff Portal
        </div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary" /> Patient Care Master
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          View and manage patient information for your assigned ward
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Patient List Sidebar */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                Ward Patients ({filteredPatients.length})
              </CardTitle>
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
                    No patients in your ward
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
              <User className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
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
                          <div className="text-xs font-semibold text-muted-foreground">Ward</div>
                          <div>{patientMaster.currentLocation.ward?.wardName || "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">Room</div>
                          <div>{patientMaster.currentLocation.room?.roomNumber || "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">Floor</div>
                          <div>{patientMaster.currentLocation.floor?.floorNumber || "-"}</div>
                        </div>
                      </div>
                      {patientMaster.currentLocation.admittedAt && (
                        <div className="pt-2 border-t border-border">
                          <div className="text-xs font-semibold text-muted-foreground mb-1">
                            Admitted
                          </div>
                          <div className="text-xs">
                            {new Date(
                              patientMaster.currentLocation.admittedAt,
                            ).toLocaleString("en-IN")}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Medical Information */}
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
                    <Tabs defaultValue="meds" className="w-full">
                      <TabsList className="grid w-full grid-cols-3 text-xs">
                        <TabsTrigger value="meds">Medications</TabsTrigger>
                        <TabsTrigger value="procedures">Procedures</TabsTrigger>
                        <TabsTrigger value="records">Records</TabsTrigger>
                      </TabsList>

                      <TabsContent value="meds" className="space-y-2 mt-3">
                        {medications.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No medications</p>
                        ) : (
                          medications.slice(0, 10).map((med) => (
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
                          <p className="text-xs text-muted-foreground">No procedures</p>
                        ) : (
                          procedures.slice(0, 10).map((proc) => (
                            <div key={proc.procedureId} className="text-xs p-2 rounded-lg bg-muted/50">
                              <div className="font-semibold">{proc.name}</div>
                              <div className="text-muted-foreground">Status: {proc.status}</div>
                            </div>
                          ))
                        )}
                      </TabsContent>

                      <TabsContent value="records" className="space-y-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => setAddRecordOpen(true)}
                          className="w-full text-xs"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Record
                        </Button>
                        {medicalRecords.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No records</p>
                        ) : (
                          medicalRecords.slice(0, 10).map((rec) => (
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
                    </Tabs>
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

      {/* Add Medical Record Dialog */}
      <Dialog open={addRecordOpen} onOpenChange={setAddRecordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Medical Record</DialogTitle>
            <DialogDescription>
              Add a new clinical record for {patientMaster?.name || "patient"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="record-title" className="text-xs font-semibold">
                Title
              </Label>
              <Input
                id="record-title"
                value={recordForm.title}
                onChange={(e) => setRecordForm({ ...recordForm, title: e.target.value })}
                placeholder="e.g., Daily Checkup Notes"
                className="text-xs mt-1"
              />
            </div>

            <div>
              <Label htmlFor="record-type" className="text-xs font-semibold">
                Type
              </Label>
              <select
                id="record-type"
                value={recordForm.type}
                onChange={(e) => setRecordForm({ ...recordForm, type: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs outline-none mt-1"
              >
                <option value="nursing-note">Nursing Note</option>
                <option value="clinical-observation">Clinical Observation</option>
                <option value="doctor-note">Doctor Note</option>
                <option value="test-result">Test Result</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Label htmlFor="record-content" className="text-xs font-semibold">
                Content
              </Label>
              <Textarea
                id="record-content"
                value={recordForm.content}
                onChange={(e) => setRecordForm({ ...recordForm, content: e.target.value })}
                placeholder="Enter record details..."
                rows={4}
                className="text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddRecordOpen(false)}
              disabled={savingRecord}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddRecord}
              disabled={savingRecord}
              className="text-xs"
            >
              {savingRecord ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                "Add Record"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StaffPatientMasterGuarded() {
  return (
    <RouteGuard requiredRole="staff">
      <StaffPatientMasterPage />
    </RouteGuard>
  );
}
