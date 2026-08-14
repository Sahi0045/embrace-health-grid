import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import {
  User,
  ArrowLeft,
  RefreshCw,
  FileText,
  Bed,
  Activity,
  Pill,
  FlaskConical,
  Stethoscope,
  Calendar,
  CreditCard,
  Shield,
  Award,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { getPatientFullProfile } from "@/lib/api";
import { useTableRefresh } from "@/hooks/use-realtime";

import { ProfileSidebar } from "@/components/patient-profile/ProfileSidebar";
import { MedicalHistoryTab } from "@/components/patient-profile/MedicalHistoryTab";
import { VisitsTab } from "@/components/patient-profile/VisitsTab";
import { DiagnosesTab } from "@/components/patient-profile/DiagnosesTab";
import { PrescriptionsTab } from "@/components/patient-profile/PrescriptionsTab";
import { LabReportsTab } from "@/components/patient-profile/LabReportsTab";
import { ProceduresTab } from "@/components/patient-profile/ProceduresTab";
import { AppointmentsTab } from "@/components/patient-profile/AppointmentsTab";
import { PaymentsTab } from "@/components/patient-profile/PaymentsTab";
import { InsuranceTab } from "@/components/patient-profile/InsuranceTab";
import { DocumentsTab } from "@/components/patient-profile/DocumentsTab";
import { DischargeWizard } from "@/components/patient-profile/DischargeWizard";

export const Route = createFileRoute("/admin/patient-profile")({
  head: () => ({
    meta: [
      { title: "Patient Profile — Admin Console" },
      {
        name: "description",
        content:
          "Comprehensive medical history, visits, prescriptions, and billing governance profile",
      },
    ],
  }),
  component: PatientProfilePage,
});

function PatientProfilePage() {
  const search: any = useSearch({ strict: false });
  const patientDid = search?.did || "";
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDischargeOpen, setIsDischargeOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!patientDid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getPatientFullProfile(patientDid);
      setProfileData(data);
    } catch (error: any) {
      toast.error("Failed to load patient profile", { description: error.message });
    } finally {
      setLoading(false);
    }
  }, [patientDid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time table subscriptions
  useTableRefresh("medical_records", loadData);
  useTableRefresh("prescriptions", loadData);
  useTableRefresh("admissions", loadData);
  useTableRefresh("lab_results", loadData);
  useTableRefresh("billing_accounts", loadData);
  useTableRefresh("payments", loadData);

  const activeAdmission = profileData?.admissions?.find((a: any) => a.status === "admitted");

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8 pb-24">
        {/* Navigation Back & Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/admin/people" })}
            className="rounded-xl text-xs font-bold shadow-xs hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to People Directory
          </Button>
        </div>

        <PageHeader
          eyebrow="Patient Health Grid & Governance Profile"
          title={
            profileData?.did?.owner_name || profileData?.profile?.full_name || "Patient Profile"
          }
          description="Complete longitudinal health history, active inpatient status, prescriptions, and financial ledger"
          actions={
            <div className="flex items-center gap-2">
              <Button
                onClick={loadData}
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-bold shadow-xs hover:bg-accent"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
              {activeAdmission && (
                <Button
                  onClick={() => setIsDischargeOpen(true)}
                  size="sm"
                  className="bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold rounded-xl shadow-clinical-md shadow-primary/25 text-xs"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Process Discharge
                </Button>
              )}
            </div>
          }
        />

        {!patientDid ? (
          <EmptyState
            icon={User}
            title="No Patient Specified"
            description="Please select a patient from the People directory to view their complete profile."
            action={
              <Button
                onClick={() => navigate({ to: "/admin/people" })}
                className="bg-primary text-primary-foreground font-extrabold rounded-xl shadow-clinical-md text-xs"
              >
                Go to People Directory
              </Button>
            }
          />
        ) : loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 animate-pulse rounded-2xl border border-border bg-muted/40 h-[500px]" />
            <div className="lg:col-span-8 space-y-4">
              <div className="animate-pulse rounded-2xl border border-border bg-muted/40 h-12" />
              <div className="animate-pulse rounded-2xl border border-border bg-muted/40 h-[400px]" />
            </div>
          </div>
        ) : (
          <StaggerList className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Patient Sticky Profile Sidebar */}
            <StaggerItem className="lg:col-span-4 lg:sticky lg:top-6">
              <ProfileSidebar
                did={profileData?.did}
                profile={profileData?.profile}
                admissions={profileData?.admissions}
                billing={profileData?.billing}
                insurancePolicy={profileData?.insurancePolicy}
                onOpenDischarge={() => setIsDischargeOpen(true)}
              />
            </StaggerItem>

            {/* Right Column: Multi-tab Patient EHR Sections */}
            <StaggerItem className="lg:col-span-8">
              <Tabs defaultValue="medical-history" className="w-full space-y-6">
                <TabsList className="flex w-full items-center justify-start overflow-x-auto scrollbar-none no-scrollbar p-1.5 bg-card border border-border/80 rounded-2xl shadow-clinical-xs gap-1.5 h-auto min-h-[52px]">
                  <TabsTrigger
                    value="medical-history"
                    className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-extrabold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    History ({profileData?.medicalRecords?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="visits"
                    className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-extrabold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Bed className="h-3.5 w-3.5" />
                    Visits ({profileData?.admissions?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="diagnoses"
                    className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-extrabold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Diagnoses
                  </TabsTrigger>
                  <TabsTrigger
                    value="prescriptions"
                    className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-extrabold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Pill className="h-3.5 w-3.5" />
                    Prescriptions ({profileData?.prescriptions?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="labs"
                    className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-extrabold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <FlaskConical className="h-3.5 w-3.5" />
                    Labs ({profileData?.labResults?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="procedures"
                    className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-extrabold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Stethoscope className="h-3.5 w-3.5" />
                    Procedures
                  </TabsTrigger>
                  <TabsTrigger
                    value="appointments"
                    className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-extrabold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Appointments
                  </TabsTrigger>
                  <TabsTrigger
                    value="payments"
                    className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-extrabold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Payments
                  </TabsTrigger>
                  <TabsTrigger
                    value="insurance"
                    className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-extrabold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Insurance
                  </TabsTrigger>
                  <TabsTrigger
                    value="documents"
                    className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-extrabold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Award className="h-3.5 w-3.5" />
                    Documents
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="medical-history" className="focus-visible:outline-none">
                  <MedicalHistoryTab records={profileData?.medicalRecords || []} />
                </TabsContent>

                <TabsContent value="visits" className="focus-visible:outline-none">
                  <VisitsTab admissions={profileData?.admissions || []} />
                </TabsContent>

                <TabsContent value="diagnoses" className="focus-visible:outline-none">
                  <DiagnosesTab
                    prescriptions={profileData?.prescriptions || []}
                    medicalRecords={profileData?.medicalRecords || []}
                  />
                </TabsContent>

                <TabsContent value="prescriptions" className="focus-visible:outline-none">
                  <PrescriptionsTab prescriptions={profileData?.prescriptions || []} />
                </TabsContent>

                <TabsContent value="labs" className="focus-visible:outline-none">
                  <LabReportsTab labResults={profileData?.labResults || []} />
                </TabsContent>

                <TabsContent value="procedures" className="focus-visible:outline-none">
                  <ProceduresTab
                    procedures={profileData?.procedures || []}
                    surgeries={profileData?.surgeries || []}
                  />
                </TabsContent>

                <TabsContent value="appointments" className="focus-visible:outline-none">
                  <AppointmentsTab appointments={profileData?.appointments || []} />
                </TabsContent>

                <TabsContent value="payments" className="focus-visible:outline-none">
                  <PaymentsTab
                    billing={profileData?.billing}
                    payments={profileData?.payments || []}
                  />
                </TabsContent>

                <TabsContent value="insurance" className="focus-visible:outline-none">
                  <InsuranceTab
                    insurancePolicy={profileData?.insurancePolicy}
                    insuranceClaims={profileData?.insuranceClaims || []}
                  />
                </TabsContent>

                <TabsContent value="documents" className="focus-visible:outline-none">
                  <DocumentsTab
                    credentials={profileData?.credentials || []}
                    medicalRecords={profileData?.medicalRecords || []}
                    vaccines={profileData?.vaccines || []}
                  />
                </TabsContent>
              </Tabs>
            </StaggerItem>
          </StaggerList>
        )}

        {/* Discharge Wizard Dialog */}
        <DischargeWizard
          isOpen={isDischargeOpen}
          onClose={() => setIsDischargeOpen(false)}
          patientDid={patientDid}
          patientName={profileData?.did?.owner_name || profileData?.profile?.full_name || "Patient"}
          activeAdmission={activeAdmission}
          billing={profileData?.billing}
          insurancePolicy={profileData?.insurancePolicy}
          prescriptions={profileData?.prescriptions}
          onDischargeSuccess={loadData}
        />
      </div>
    </RouteGuard>
  );
}
