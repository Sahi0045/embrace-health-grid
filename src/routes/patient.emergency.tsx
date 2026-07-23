import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import {
  EmergencyAccessCard,
  type EmergencyAccessEvent,
} from "@/components/emergency/EmergencyAccessCard";
import { useLivePatients, useLiveStaff, useAudit } from "@/hooks/use-api";
import { getCurrentUser, setSession } from "@/lib/auth";
import { updateEmergencyProfile } from "@/lib/api";
import {
  Heart,
  AlertTriangle,
  User,
  Phone,
  Droplets,
  ShieldAlert,
  QrCode,
  Activity,
  Edit3,
  Plus,
  X,
  Save,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/patient/emergency")({
  head: () => ({ meta: [{ title: "Emergency Profile — Embrace Health Grid" }] }),
  component: EmergencyPage,
});

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "critical")
    return (
      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
        Critical
      </span>
    );
  if (severity === "managed")
    return (
      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
        Managed
      </span>
    );
  return (
    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
      Controlled
    </span>
  );
}

function EmergencyPage() {
  const { patients: patientsList, refetch: refetchPatients } = useLivePatients();
  const { staff } = useLiveStaff();
  const { data: auditData } = useAudit();
  const currentUser = getCurrentUser();
  const userEmail = currentUser?.email || "";
  const patient =
    patientsList?.find((p: any) => p.email === userEmail) ||
    patientsList?.[0] || {
      name: currentUser?.name || "Patient User",
      mrn: currentUser?.mrn || "MRN-2026-001",
      age: 28,
      gender: "F" as const,
      bloodGroup: "O+",
      allergies: ["Penicillin", "Latex"],
      did: currentUser?.did || "did:hosp:0x4302bbea",
      primaryDoctor: "Dr. Sameer Khan",
      conditions: ["Type 1 Diabetes", "Asthma"],
      organDonor: true,
      emergencyContact: {
        name: "Vikram Sharma",
        relation: "Spouse",
        phone: "+91 98765 43210",
      },
    };
  const [showQr, setShowQr] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form States for Editing
  const [contactName, setContactName] = useState("");
  const [contactRelation, setContactRelation] = useState("Spouse");
  const [contactPhone, setContactPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [organDonor, setOrganDonor] = useState(false);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergyInput, setNewAllergyInput] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [newConditionInput, setNewConditionInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenEditModal = () => {
    setContactName(patient.emergencyContact?.name || "");
    setContactRelation(patient.emergencyContact?.relation || "Spouse");
    setContactPhone(patient.emergencyContact?.phone || "");
    setBloodGroup(patient.bloodGroup || "O+");
    setOrganDonor(patient.organDonor ?? false);
    setAllergies(patient.allergies || []);
    setConditions(patient.conditions || []);
    setIsEditModalOpen(true);
  };

  const handleAddAllergy = () => {
    if (!newAllergyInput.trim()) return;
    if (allergies.includes(newAllergyInput.trim())) {
      toast.error("Allergy already listed");
      return;
    }
    setAllergies((prev) => [...prev, newAllergyInput.trim()]);
    setNewAllergyInput("");
  };

  const handleRemoveAllergy = (index: number) => {
    setAllergies((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCondition = () => {
    if (!newConditionInput.trim()) return;
    if (conditions.includes(newConditionInput.trim())) {
      toast.error("Condition already listed");
      return;
    }
    setConditions((prev) => [...prev, newConditionInput.trim()]);
    setNewConditionInput("");
  };

  const handleRemoveCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveEmergencyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const emergencyContactObj = {
        name: contactName || "Emergency Contact",
        relation: contactRelation || "Spouse",
        phone: contactPhone || "+91 98765 43210",
      };

      const res = await updateEmergencyProfile({
        emergencyContact: emergencyContactObj,
        bloodGroup,
        organDonor,
        allergies,
        conditions,
      });

      if (res.success && res.patient) {
        // Sync local session user
        const token = localStorage.getItem("authToken") || "";
        const updatedUser = {
          ...currentUser,
          ...res.patient,
          emergencyContact: emergencyContactObj,
          bloodGroup,
          organDonor,
          allergies,
          conditions,
        };
        setSession(token, updatedUser);

        toast.success("Emergency Profile Updated On-Chain!", {
          description: "Responders and hospital nodes now have your updated emergency records.",
        });
        refetchPatients();
        setIsEditModalOpen(false);
      }
    } catch (err: any) {
      toast.error("Failed to update emergency profile", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Live Emergency Contacts
  const emergencyContactsList = [];
  if (patient.emergencyContact?.name) {
    emergencyContactsList.push({
      name: patient.emergencyContact.name,
      relation: patient.emergencyContact.relation || "Emergency Contact",
      phone: patient.emergencyContact.phone || "N/A",
      primary: true,
    });
  }
  if (patient.primaryDoctor) {
    const doc = staff?.find(
      (s: any) => s.name === patient.primaryDoctor || s.did === patient.primaryDoctor
    );
    emergencyContactsList.push({
      name: doc ? doc.name : patient.primaryDoctor,
      relation: "Primary Physician",
      phone: doc ? doc.phone : "+91 11-2345-6789",
      primary: false,
    });
  }

  // Live Critical Conditions
  const criticalConditionsList = patient.conditions
    ? patient.conditions.map((cond: string) => ({
        label: cond,
        severity:
          cond.toLowerCase().includes("allergy") || cond.toLowerCase().includes("diabet")
            ? "critical"
            : "controlled",
        since: "Documented",
      }))
    : [];

  // Live Break Glass Events
  const allEvents = auditData?.events || [];
  const breakGlassEventsList: EmergencyAccessEvent[] = allEvents
    .filter(
      (e: any) =>
        e.severity === "critical" ||
        e.action.toLowerCase().includes("break_glass") ||
        e.action.toLowerCase().includes("emergency")
    )
    .map((e: any) => ({
      id: e.txId || e._id,
      actor: e.actor || "Emergency Responder",
      actorRole: e.actor.includes("doc") || e.actor.includes("Dr") ? "Physician" : "Staff",
      reason: e.resource || "Emergency medical records access",
      at: e.loggedAt ? new Date(e.loggedAt).toLocaleString("en-IN") : "N/A",
      autoAudited: true,
    }));

  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Patient app"
        title="Emergency Profile"
        description="Critical health information accessible to emergency responders"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenEditModal}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
            >
              <Edit3 className="h-4 w-4 text-primary" />
              Edit Profile
            </button>
            <button
              onClick={() => setShowQr(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm"
            >
              <QrCode className="h-4 w-4" />
              Emergency QR
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
        <StaggerList className="space-y-5">
          {/* Hero emergency card */}
          <StaggerItem>
            <motion.div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-destructive to-destructive/75 p-6 text-white shadow-clinical-md">
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
              <div className="flex items-center justify-between text-xs opacity-80 mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Emergency Profile — DID Verified
                </div>
                <button
                  onClick={handleOpenEditModal}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30 text-white transition-colors"
                >
                  <Edit3 className="h-3 w-3" /> Quick Edit
                </button>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">
                    Patient
                  </div>
                  <div className="text-lg font-bold">{patient.name}</div>
                  <div className="text-sm opacity-80">
                    {patient.mrn} · Age {patient.age || 28} · {patient.gender === "F" ? "Female" : "Male"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">
                    Blood Group
                  </div>
                  <div className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-red-200" />
                    <span className="text-3xl font-bold">{patient.bloodGroup || "O+"}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">
                    Organ Donor
                  </div>
                  <div className="flex items-center gap-1.5 text-lg font-bold">
                    <Heart className="h-5 w-5 text-pink-300" />
                    {patient.organDonor ? "Yes — Registered" : "No / Not Declared"}
                  </div>
                </div>
              </div>
            </motion.div>
          </StaggerItem>

          {/* Allergies */}
          <StaggerItem>
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Known Allergies ({patient.allergies?.length || 0})
                </div>
                <button
                  onClick={handleOpenEditModal}
                  className="text-xs font-semibold text-destructive hover:underline"
                >
                  + Update Allergies
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {patient.allergies && patient.allergies.length > 0 ? (
                  patient.allergies.map((a: string) => (
                    <span
                      key={a}
                      className="rounded-lg bg-destructive/15 px-3 py-1.5 text-sm font-semibold text-destructive"
                    >
                      {a}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No documented allergies</span>
                )}
              </div>
            </div>
          </StaggerItem>

          {/* Critical conditions + Emergency contacts */}
          <StaggerItem>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Activity className="h-4 w-4 text-primary" />
                    Critical Conditions
                  </div>
                  <button
                    onClick={handleOpenEditModal}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    + Manage
                  </button>
                </div>
                <div className="space-y-2">
                  {criticalConditionsList.map((c) => (
                    <div
                      key={c.label}
                      className="flex items-center justify-between rounded-lg bg-muted px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">{c.label}</div>
                        <div className="text-[11px] text-muted-foreground">{c.since}</div>
                      </div>
                      <SeverityBadge severity={c.severity} />
                    </div>
                  ))}
                  {criticalConditionsList.length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No documented critical conditions
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Phone className="h-4 w-4 text-primary" />
                    Emergency Contacts
                  </div>
                  <button
                    onClick={handleOpenEditModal}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    + Edit Contact
                  </button>
                </div>
                <div className="space-y-2">
                  {emergencyContactsList.map((ec) => (
                    <div
                      key={ec.name}
                      className="flex items-center justify-between rounded-lg bg-muted px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                          {ec.name
                            .split(" ")
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{ec.name}</div>
                          <div className="text-[11px] text-muted-foreground">{ec.relation}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-foreground">{ec.phone}</div>
                        {ec.primary && <span className="text-[10px] text-success font-bold">Primary</span>}
                      </div>
                    </div>
                  ))}
                  {emergencyContactsList.length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No emergency contacts configured
                    </div>
                  )}
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* Break glass history */}
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-4 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold text-foreground">
                  Break-Glass Access History
                </span>
                <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  {breakGlassEventsList.length} events
                </span>
              </div>
              <div className="space-y-3">
                {breakGlassEventsList.map((ev) => (
                  <EmergencyAccessCard key={ev.id} event={ev} />
                ))}
                {breakGlassEventsList.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                    No emergency break-glass access events logged
                  </div>
                )}
              </div>
            </div>
          </StaggerItem>
        </StaggerList>
      </div>

      {/* Edit Emergency Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border border-border bg-card p-6 shadow-clinical-md max-w-lg w-full my-8 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-foreground">
                <Edit3 className="h-5 w-5 text-primary" /> Edit Emergency Profile
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmergencyProfile} className="space-y-4">
              {/* Emergency Contact Section */}
              <div className="rounded-xl bg-muted/40 p-4 border border-border space-y-3">
                <div className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" /> Primary Emergency Contact
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Full Name</label>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="e.g. Vikram Sharma"
                      className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Relationship</label>
                    <select
                      value={contactRelation}
                      onChange={(e) => setContactRelation(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Spouse">Spouse</option>
                      <option value="Parent">Parent</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Child">Child</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Friend / Caretaker">Friend / Caretaker</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Medical Identifiers */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Droplets className="h-3.5 w-3.5 text-red-500" /> Blood Group
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                  >
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5 text-pink-500" /> Organ Donor Declaration
                  </label>
                  <label className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground cursor-pointer hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={organDonor}
                      onChange={(e) => setOrganDonor(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    Registered Organ Donor
                  </label>
                </div>
              </div>

              {/* Known Allergies */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Known Allergies
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newAllergyInput}
                    onChange={(e) => setNewAllergyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddAllergy();
                      }
                    }}
                    placeholder="Add allergy (e.g. Penicillin, Latex)"
                    className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddAllergy}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {allergies.map((alg, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive border border-destructive/20"
                    >
                      {alg}
                      <button
                        type="button"
                        onClick={() => handleRemoveAllergy(idx)}
                        className="hover:text-destructive/70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {allergies.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No allergies added</span>
                  )}
                </div>
              </div>

              {/* Critical Conditions */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-primary" /> Critical Health Conditions
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newConditionInput}
                    onChange={(e) => setNewConditionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCondition();
                      }
                    }}
                    placeholder="Add condition (e.g. Type 1 Diabetes, Asthma)"
                    className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddCondition}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {conditions.map((cond, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary border border-primary/20"
                    >
                      {cond}
                      <button
                        type="button"
                        onClick={() => handleRemoveCondition(idx)}
                        className="hover:text-primary/70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {conditions.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No conditions added</span>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 rounded-xl border border-border bg-card py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving On-Chain..." : "Save Emergency Profile"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Emergency QR Modal */}
      {showQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4"
          onClick={() => setShowQr(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border border-border bg-card p-6 text-center shadow-clinical-md max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-foreground mb-1">Emergency QR Code</div>
            <div className="text-xs text-muted-foreground mb-4">
              Scan to access emergency profile
            </div>
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl bg-muted">
              <QrCode className="h-32 w-32 text-foreground/30" />
            </div>
            <div className="mt-4 rounded-lg bg-destructive/10 p-3">
              <div className="text-xs font-semibold text-destructive">{patient.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {patient.bloodGroup || "O+"} · {patient.allergies?.join(", ") || "No allergies"}
              </div>
            </div>
            <button
              onClick={() => setShowQr(false)}
              className="mt-4 w-full rounded-xl bg-muted py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </RouteGuard>
  );
}
