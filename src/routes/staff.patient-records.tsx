import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { getMedicalRecordsForPatient, getPrescriptionsForPatient } from "@/lib/clinical.server";
import { logAuditEvent } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth-context";
import { motion } from "framer-motion";
import {
  FileText,
  Pill,
  AlertTriangle,
  Calendar,
  User,
  Loader2,
  ShieldCheck,
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/staff/patient-records")({
  head: () => ({ meta: [{ title: "Patient Records — Staff Portal" }] }),
  component: PatientRecordsPage,
  validateSearch: (search: Record<string, unknown>): { patientDid?: string } => {
    return {
      patientDid: search.patientDid as string | undefined,
    };
  },
});

function PatientRecordsPage() {
  const { patientDid } = Route.useSearch();
  const { user: currentUser } = useCurrentUser();
  
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [expandedRx, setExpandedRx] = useState<string | null>(null);

  useEffect(() => {
    if (!patientDid) {
      setError("No patient selected. Please access this page from the consent management page.");
      setLoading(false);
      return;
    }

    const fetchRecords = async () => {
      setLoading(true);
      setError(null);

      try {
        const [recordsRes, rxRes] = await Promise.all([
          getMedicalRecordsForPatient({ data: { patientDid } }),
          getPrescriptionsForPatient({ data: { patientDid } }),
        ]);

        setMedicalRecords(recordsRes.records || []);
        setPrescriptions(rxRes.prescriptions || []);

        // Log audit event for accessing patient records
        if (currentUser?.primaryDid) {
          try {
            await logAuditEvent(
              currentUser.primaryDid,
              patientDid,
              `VIEWED_MEDICAL_RECORDS`,
              "success",
              "info"
            );
            await logAuditEvent(
              currentUser.primaryDid,
              patientDid,
              `VIEWED_PRESCRIPTIONS`,
              "success",
              "info"
            );
          } catch (auditErr) {
            console.warn("Failed to log audit event:", auditErr);
          }
        }

        if ((recordsRes.records || []).length === 0 && (rxRes.prescriptions || []).length === 0) {
          toast.info("No records found", {
            description: "This patient has no medical records or prescriptions, or consent may have expired.",
          });
        } else {
          toast.success("Records loaded", {
            description: `${recordsRes.records?.length || 0} medical records and ${rxRes.prescriptions?.length || 0} prescriptions`,
          });
        }
      } catch (err: any) {
        console.error("Error fetching patient records:", err);
        
        // Handle different error types
        if (err.message === "Not authenticated") {
          setError(
            "You are not logged in. Please log in to the staff portal first."
          );
          toast.error("Not authenticated", {
            description: "Please log in to view patient records.",
          });
        } else if (err.message?.includes("consent") || err.message?.includes("permission")) {
          setError(
            "Access denied. You may not have active consent from this patient."
          );
          toast.error("Access denied", {
            description: "Consent may have expired or was not granted.",
          });
        } else {
          setError(
            err.message || "Failed to load patient records. You may not have active consent."
          );
          toast.error("Failed to load records", {
            description: err.message || "Unable to load records. Please check your access permissions.",
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [patientDid]);

  if (!patientDid) {
    return (
      <RouteGuard requiredRole="staff">
        <PageHeader
          eyebrow="Patient Records"
          title="Medical Records & Prescriptions"
          description="View patient medical records and prescriptions with active consent"
        />
        <div className="p-8">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-12 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive/60" />
            <div className="text-sm font-semibold text-foreground">No patient selected</div>
            <div className="text-xs text-muted-foreground">
              Please access this page from the Consent Management page by clicking "View Records" on
              an active consent.
            </div>
          </div>
        </div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Patient Records"
        title="Medical Records & Prescriptions"
        description={`Viewing records for patient: ${patientDid}`}
      />

      <div className="p-8 space-y-6">
        {/* Patient Info Banner */}
        <div className="rounded-xl border border-success/30 bg-success/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15">
              <ShieldCheck className="h-5 w-5 text-success" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Consent Active</div>
              <div className="text-xs text-muted-foreground font-mono">{patientDid}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading patient records...
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60" />
            <div className="text-sm font-semibold text-foreground">Access Denied</div>
            <div className="text-xs text-muted-foreground">{error}</div>
          </div>
        )}

        {!loading && !error && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Medical Records Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Medical Records
                  <Badge variant="outline" className="ml-2">
                    {medicalRecords.length}
                  </Badge>
                </h2>
              </div>

              {medicalRecords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center space-y-2">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground/30" />
                  <div className="text-sm text-muted-foreground">No medical records found</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {medicalRecords.map((record, index) => (
                    <motion.div
                      key={record.recordId || record.id || `record-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-clinical-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-foreground">
                            {record.title || record.recordType || "Medical Record"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            {record.createdAt
                              ? new Date(record.createdAt).toLocaleDateString("en-IN", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "Date unknown"}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setExpandedRecord(
                              expandedRecord === record.recordId ? null : record.recordId
                            )
                          }
                          className="p-1 hover:bg-muted rounded-lg transition-colors"
                        >
                          {expandedRecord === record.recordId ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {record.doctorName && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <User className="h-3 w-3" />
                          <span>
                            Recorded by: <span className="font-medium">{record.doctorName}</span>
                          </span>
                        </div>
                      )}

                      {expandedRecord === record.recordId && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-t border-border pt-3 space-y-2"
                        >
                          <div className="text-xs">
                            <div className="font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                              Notes
                            </div>
                            <div className="text-foreground whitespace-pre-wrap">
                              {record.notes || record.content || "No additional notes"}
                            </div>
                          </div>

                          {record.diagnosis && (
                            <div className="text-xs">
                              <div className="font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Diagnosis
                              </div>
                              <div className="text-foreground">{record.diagnosis}</div>
                            </div>
                          )}

                          {record.treatment && (
                            <div className="text-xs">
                              <div className="font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Treatment
                              </div>
                              <div className="text-foreground">{record.treatment}</div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Prescriptions Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Pill className="h-5 w-5 text-primary" />
                  Prescriptions
                  <Badge variant="outline" className="ml-2">
                    {prescriptions.length}
                  </Badge>
                </h2>
              </div>

              {prescriptions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center space-y-2">
                  <Pill className="h-8 w-8 mx-auto text-muted-foreground/30" />
                  <div className="text-sm text-muted-foreground">No prescriptions found</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {prescriptions.map((rx, index) => (
                    <motion.div
                      key={rx.rxId || rx.id || `rx-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-clinical-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-foreground">
                            {rx.medicationName || rx.medication || "Prescription"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            {rx.prescribedAt || rx.createdAt
                              ? new Date(rx.prescribedAt || rx.createdAt).toLocaleDateString(
                                  "en-IN",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  }
                                )
                              : "Date unknown"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {rx.status && (
                            <Badge
                              variant={rx.status === "active" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {rx.status}
                            </Badge>
                          )}
                          <button
                            onClick={() =>
                              setExpandedRx(expandedRx === rx.rxId ? null : rx.rxId)
                            }
                            className="p-1 hover:bg-muted rounded-lg transition-colors"
                          >
                            {expandedRx === rx.rxId ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Dosage info */}
                      {(rx.dosage || rx.frequency) && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {rx.dosage && (
                            <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                Dosage
                              </div>
                              <div className="font-medium text-foreground mt-0.5">{rx.dosage}</div>
                            </div>
                          )}
                          {rx.frequency && (
                            <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                Frequency
                              </div>
                              <div className="font-medium text-foreground mt-0.5">
                                {rx.frequency}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {rx.doctorName && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <User className="h-3 w-3" />
                          <span>
                            Prescribed by:{" "}
                            <span className="font-medium">{rx.doctorName || rx.prescribedBy}</span>
                          </span>
                        </div>
                      )}

                      {expandedRx === rx.rxId && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-t border-border pt-3 space-y-2"
                        >
                          {rx.instructions && (
                            <div className="text-xs">
                              <div className="font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Instructions
                              </div>
                              <div className="text-foreground whitespace-pre-wrap">
                                {rx.instructions}
                              </div>
                            </div>
                          )}

                          {rx.duration && (
                            <div className="text-xs">
                              <div className="font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Duration
                              </div>
                              <div className="text-foreground">{rx.duration}</div>
                            </div>
                          )}

                          {rx.notes && (
                            <div className="text-xs">
                              <div className="font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Additional Notes
                              </div>
                              <div className="text-foreground">{rx.notes}</div>
                            </div>
                          )}

                          {rx.signed && (
                            <div className="flex items-center gap-1.5 text-xs text-success mt-2">
                              <ShieldCheck className="h-3 w-3" />
                              <span>Digitally signed prescription</span>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Access Notice */}
        {!loading && !error && (medicalRecords.length > 0 || prescriptions.length > 0) && (
          <div className="rounded-xl border border-info/30 bg-info/5 p-4 text-xs text-muted-foreground flex items-start gap-2">
            <Clock className="h-4 w-4 shrink-0 mt-0.5 text-info" />
            <div>
              <span className="font-semibold text-foreground">Access is time-limited.</span> This
              consent will expire according to the patient's approval settings. All record access is
              logged on the blockchain for compliance and audit purposes.
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
