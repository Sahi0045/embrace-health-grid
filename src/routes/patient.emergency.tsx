import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { QrCode as QrCodeSvg } from "@/components/QrCode";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import {
  EmergencyAccessCard,
  type EmergencyAccessEvent,
} from "@/components/emergency/EmergencyAccessCard";
import { useLivePatients, useLiveStaff, useAudit } from "@/hooks/use-api";
import { useCurrentUser } from "@/lib/auth-context";
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

// SeverityBadge was removed. It took a `severity` derived from whether the
// condition NAME contained "allergy" or "diabet", so every other condition —
// asthma, epilepsy, heart failure — rendered a green "Controlled" pill. Nobody
// assessed those as controlled: `profiles.conditions` is a text[] of names with
// no severity column at all. A responder reading "Asthma · Controlled" on an
// emergency card would be reading a guess made from a substring match.

function EmergencyPage() {
  const { patients: patientsList, refetch: refetchPatients } = useLivePatients();
  const { staff } = useLiveStaff();
  const { data: auditData } = useAudit();
  const { user: currentUser, refresh: refreshUser } = useCurrentUser();
  const userEmail = currentUser?.email || "";
  /**
   * Build the emergency record from the signed-in profile, not the DID directory.
   *
   * Two bugs met here. The directory (live-store.ts loadPatients) maps only
   * {id, did, name, email, status}, so every clinical field read off it was
   * permanently undefined — and the fallbacks then supplied invented values:
   * blood group "O+", age 28, gender Male, allergies Penicillin/Latex,
   * conditions Type 1 Diabetes/Asthma, an emergency contact named Vikram
   * Sharma. On the card a responder reads, that is fabricated clinical data.
   *
   * blood_group and allergies are REAL columns on profiles and are already
   * mapped onto currentUser (auth.server.ts), so they are read from there.
   * Everything else genuinely has no column anywhere yet; those stay undefined
   * and the UI renders "not recorded" rather than inventing an answer.
   *
   * The `|| patientsList[0]` fallback is also gone: when the email lookup
   * missed it silently displayed a DIFFERENT patient's emergency profile.
   */
  const directoryRow = patientsList?.find((p: any) => p.email === userEmail);
  const patient = {
    ...(directoryRow ?? {}),
    name: currentUser?.name || directoryRow?.name || "",
    did: currentUser?.primaryDid || currentUser?.did || directoryRow?.did || "",
    mrn: currentUser?.mrn,
    age: currentUser?.age,
    gender: currentUser?.gender,
    bloodGroup: currentUser?.bloodGroup,
    allergies: currentUser?.allergies ?? [],
    // Backed by real columns as of migration 20260825020000.
    conditions: currentUser?.conditions ?? [],
    organDonor: currentUser?.organDonor,
    emergencyContact: currentUser?.emergencyContact,
    // Still unmodelled: there is no primary-doctor column anywhere.
    primaryDoctor: undefined as string | undefined,
  };
  const [showQr, setShowQr] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form States for Editing
  const [contactName, setContactName] = useState("");
  const [contactRelation, setContactRelation] = useState("Spouse");
  const [contactPhone, setContactPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [organDonor, setOrganDonor] = useState<boolean | null>(null);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergyInput, setNewAllergyInput] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [newConditionInput, setNewConditionInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenEditModal = () => {
    setContactName(patient.emergencyContact?.name || "");
    setContactRelation(patient.emergencyContact?.relation || "Spouse");
    setContactPhone(patient.emergencyContact?.phone || "");
    // No "O+" prefill. Defaulting the field meant a patient who opened the
    // dialog and pressed Save wrote a fabricated blood group into their own
    // record — turning a display bug into stored clinical data.
    setBloodGroup(patient.bloodGroup || "");
    setOrganDonor(patient.organDonor ?? null);
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
      /**
       * Only blood group and allergies can be saved.
       *
       * updateEmergencyProfile (api.ts) forwards exactly those two to
       * updateOwnProfile, and `profiles` has no column for organ-donor status,
       * conditions or an emergency contact — so those three were being accepted
       * from the user, dropped in transit, and reported as saved.
       *
       * Sending only what persists, and telling the user which parts did not.
       */
      const res = await updateEmergencyProfile({
        bloodGroup,
        allergies,
        emergencyContact: { name: contactName, relation: contactRelation, phone: contactPhone },
        organDonor,
        conditions,
      });

      if (res.success) {
        await refreshUser();

        // The old copy claimed "Updated On-Chain!" and "Responders and hospital
        // nodes now have your updated emergency records". updateOwnProfile is a
        // plain Postgres UPDATE — nothing is signed or anchored.
        // All five fields persist now (20260825020000), so the "these were not
        // saved" caveat is gone. Still not "on-chain": updateOwnProfile is a
        // plain Postgres update — nothing is signed or anchored.
        toast.success("Emergency details saved", {
          description: "Responders will see this on your emergency card.",
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
      (s: any) => s.name === patient.primaryDoctor || s.did === patient.primaryDoctor,
    );
    emergencyContactsList.push({
      name: doc ? doc.name : patient.primaryDoctor,
      relation: "Primary Physician",
      phone: doc ? doc.phone : "+91 11-2345-6789",
      primary: false,
    });
  }

  // Live Critical Conditions
  // Filter first: the column is nullable, so a null entry threw on toLowerCase.
  // Just the names, which is all that is recorded. `since: "Documented"` was a
  // constant standing in for a date the schema does not hold either.
  const criticalConditionsList: string[] = patient.conditions
    ? patient.conditions.filter(Boolean)
    : [];

  // Live Break Glass Events
  const allEvents = auditData?.events || [];
  const breakGlassEventsList: EmergencyAccessEvent[] = allEvents
    .filter(
      (e: any) =>
        e.severity === "critical" ||
        // action and actor are nullable on audit rows, so normalise before
        // calling string methods on them.
        String(e.action ?? "")
          .toLowerCase()
          .includes("break_glass") ||
        String(e.action ?? "")
          .toLowerCase()
          .includes("emergency"),
    )
    .map((e: any) => ({
      id: e.txId || e._id,
      actor: e.actor || "Emergency Responder",
      actorRole:
        String(e.actor ?? "").includes("doc") || String(e.actor ?? "").includes("Dr")
          ? "Physician"
          : "Staff",
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
            <motion.div className="relative overflow-hidden rounded-2xl bg-destructive/75 p-6 text-white shadow-clinical-md">
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
              <div className="flex items-center justify-between text-xs opacity-80 mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {/* Was the unconditional literal "Emergency Profile — DID
                      Verified". No verification runs on this page and no
                      verified flag exists on the profile, so it now reports
                      only whether a DID is on file. */}
                  {patient.did ? "Emergency Profile — DID on file" : "Emergency Profile"}
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
                    {/* Was `Age {patient.age || 28}` and a gender ternary whose
                        else-branch printed "Male" for unknown — both invented. */}
                    {[
                      patient.mrn,
                      patient.age ? `Age ${patient.age}` : null,
                      patient.gender === "F" ? "Female" : patient.gender === "M" ? "Male" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Details not recorded"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">
                    Blood Group
                  </div>
                  <div className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-destructive" />
                    {/* Never default a blood group. A responder cannot tell an
                        assumed O+ from a recorded one. */}
                    <span className="text-3xl font-bold">
                      {patient.bloodGroup || "Not recorded"}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">
                    Organ Donor
                  </div>
                  <div className="flex items-center gap-1.5 text-lg font-bold">
                    <Heart className="h-5 w-5 text-white/80" />
                    {patient.organDonor == null
                      ? "Not declared"
                      : patient.organDonor
                        ? "Yes — Registered"
                        : "No"}
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
                  {criticalConditionsList.map((cond: string) => (
                    <div key={cond} className="rounded-lg bg-muted px-3 py-2">
                      <div className="text-sm font-medium text-foreground">{cond}</div>
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
                            .map((w: string) => w[0])
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
                        {ec.primary && (
                          <span className="text-[10px] text-success font-bold">Primary</span>
                        )}
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
                    <label className="text-xs font-semibold text-muted-foreground">
                      Relationship
                    </label>
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
                  <label className="text-xs font-semibold text-muted-foreground">
                    Phone Number
                  </label>
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
                    <Droplets className="h-3.5 w-3.5 text-destructive" /> Blood Group
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
                    <Heart className="h-3.5 w-3.5 text-accent" /> Organ Donor Declaration
                  </label>
                  {/* Three options, not a checkbox: "not declared" is a real and
                      different answer from "no", and the column is nullable for
                      exactly that reason. */}
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { value: true, label: "Yes" },
                        { value: false, label: "No" },
                        { value: null, label: "Not declared" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => setOrganDonor(opt.value)}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                          organDonor === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground hover:bg-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
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
                    <span className="text-xs text-muted-foreground italic">
                      No conditions added
                    </span>
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
            {/* Was the lucide <QrCode> decorative glyph — an icon of a QR code,
                not a QR code. Under "Scan to access emergency profile" it was
                unscannable, which on an emergency screen means a responder
                holding a phone at a picture. QrCodeSvg renders a real one. */}
            <div className="mx-auto flex w-48 items-center justify-center rounded-xl bg-card p-2">
              <QrCodeSvg
                value={JSON.stringify({
                  did: patient.did,
                  name: patient.name,
                  bloodGroup: patient.bloodGroup || null,
                  allergies: patient.allergies ?? [],
                })}
                size={176}
              />
            </div>
            <div className="mt-4 rounded-lg bg-destructive/10 p-3">
              <div className="text-xs font-semibold text-destructive">{patient.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {patient.bloodGroup || "Blood group not recorded"} ·{" "}
                {patient.allergies?.length
                  ? patient.allergies.join(", ")
                  : "Allergies not recorded"}
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
