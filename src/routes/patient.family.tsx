import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { DIDCard } from "@/components/did/DIDCard";
import { DIDStatusChip } from "@/components/did/DIDStatusChip";
import { 
  Users, 
  ShieldCheck, 
  Shield, 
  Baby, 
  User, 
  Plus, 
  Settings, 
  Eye,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
  X,
  Trash2,
  Edit,
  UserPlus,
  Heart,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

import { useLivePatients, useLiveStaff, useConsents } from "@/hooks/use-api";
import { useCurrentUser } from "@/lib/auth-context";
import { revokeConsent } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/patient/family")({
  head: () => ({ meta: [{ title: "Family & Guardians — Embrace Health Grid" }] }),
  component: FamilyPage,
});

function RelationIcon({ relation }: { relation: string }) {
  if (relation.includes("Son") || relation.includes("Minor"))
    return <Baby className="h-5 w-5 text-chart-2" />;
  if (relation.includes("Mother") || relation.includes("Elder"))
    return <Users className="h-5 w-5 text-chart-3" />;
  return <User className="h-5 w-5 text-primary" />;
}

function FamilyPage() {
  const { patients } = useLivePatients();
  const { staff } = useLiveStaff();
  const { data: consentsData, refetch: refetchConsents } = useConsents();
  const { user: currentUser } = useCurrentUser();
  
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditPermissionsModal, setShowEditPermissionsModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedDelegation, setSelectedDelegation] = useState<any>(null);

  const userEmail = currentUser?.email || "";
  const patient = patients?.find((p: any) => p.email === userEmail);

  const lastName = patient ? patient.name.split(" ").slice(-1)[0] : "";
  const familyFromPatients = patients
    ? patients
        .filter((p: any) => p.email !== userEmail && lastName && p.name.endsWith(lastName))
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          relation: p.gender === "M" ? "Spouse/Relative" : "Spouse/Relative",
          did: p.did,
          role: "patient" as const,
          accessLevel: "Full healthcare access",
          permissions: ["View records", "Sign consents", "Emergency access"],
          status:
            p.status === "active" || p.status === "inpatient"
              ? ("active" as const)
              : ("inactive" as const),
        }))
    : [];

  const emergencyMember = patient?.emergencyContact?.name
    ? (() => {
        // emergencyContact is PHI and absent from the directory, so guard it
        // rather than dereferencing through undefined.
        const contactName = patient.emergencyContact?.name?.toLowerCase();
        const contactPhone = patient.emergencyContact?.phone;
        const foundFamilyPatient = patients?.find(
          (p: any) =>
            (contactName && p.name?.toLowerCase() === contactName) ||
            (contactPhone && p.phone === contactPhone),
        );
        return [
          {
            id: "emergency",
            name: patient.emergencyContact.name,
            relation: patient.emergencyContact.relation || "Emergency Contact",
            did: foundFamilyPatient ? foundFamilyPatient.did : "did:hosp:unknown",
            role: "patient" as const,
            accessLevel: "Emergency contact access",
            permissions: ["Emergency access"],
            status: foundFamilyPatient
              ? (foundFamilyPatient.status as string) === "active" ||
                foundFamilyPatient.status === "inpatient"
                ? ("active" as const)
                : ("inactive" as const)
              : ("active" as const),
          },
        ];
      })()
    : [];

  const familyMembersList = [...emergencyMember, ...familyFromPatients];

  const getDoctorName = (did: string) => {
    const doc = staff?.find((s: any) => s.did === did);
    return doc ? doc.name : did;
  };

  const patientConsents =
    consentsData?.consents?.filter((c: any) => c.patientDid === patient?.did) || [];

  const delegationsList = patientConsents.map((c: any) => ({
    id: c.grantId,
    delegateTo: getDoctorName(c.doctorDid),
    scope: c.resource,
    expiry: c.expiry ? new Date(c.expiry).toLocaleDateString("en-IN") : "Never",
    status: c.status,
  }));

  const handleRevoke = async (grantId: string) => {
    try {
      await revokeConsent(grantId);
      toast.success("Consent revoked successfully");
      refetchConsents();
    } catch (err: any) {
      toast.error("Failed to revoke consent", { description: err.message });
    }
  };

  const handleAddFamilyMember = () => {
    setShowAddMemberModal(true);
  };

  const handleEditPermissions = (member: any) => {
    setSelectedMember(member);
    setShowEditPermissionsModal(true);
  };

  const handleRemoveFamilyMember = (memberId: string, memberName: string) => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
      {
        loading: `Removing ${memberName}...`,
        success: `${memberName} removed from family group`,
        error: "Failed to remove family member",
      }
    );
  };

  // Statistics
  const stats = [
    {
      label: "Family Members",
      value: familyMembersList.length,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Active Delegations",
      value: delegationsList.filter((d: any) => d.status === 'active').length,
      icon: ShieldCheck,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Emergency Contacts",
      value: emergencyMember.length,
      icon: AlertCircle,
      color: "text-warning-foreground",
      bg: "bg-warning/10",
    },
    {
      label: "Guardian Access",
      value: familyMembersList.filter(m => m.permissions.includes("Full healthcare access")).length,
      icon: Heart,
      color: "text-chart-2",
      bg: "bg-chart-2/10",
    },
  ];

  return (
    <RouteGuard requiredRole="patient">
      <PageHeader
        eyebrow="Patient app"
        title="Family & Guardians"
        description="Manage family DIDs, guardian access, and delegation permissions"
        actions={
          <button
            onClick={handleAddFamilyMember}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Family Member
          </button>
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 space-y-6">
        {/* Statistics Cards */}
        <StaggerList className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <StaggerItem key={s.label}>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </span>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                    </div>
                  </div>
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerList>

        <StaggerList className="space-y-5">
          {/* Family members */}
          <StaggerItem>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-foreground">Family Members</div>
              <span className="text-xs text-muted-foreground">
                {familyMembersList.length} member{familyMembersList.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-3">
              {familyMembersList.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border bg-card p-4 shadow-clinical hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <RelationIcon relation={m.relation} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-foreground">{m.name}</div>
                          <DIDStatusChip status={m.status === "active" ? "active" : "suspended"} />
                        </div>
                        <div className="text-xs text-muted-foreground">{m.relation}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/60 truncate">
                          {m.did}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditPermissions(m)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit permissions"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {m.id !== "emergency" && (
                        <button
                          onClick={() => handleRemoveFamilyMember(m.id, m.name)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove from family"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {m.accessLevel}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.permissions.map((p) => (
                          <span
                            key={p}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2 pt-1">
                      <button className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                        <Eye className="h-3 w-3" />
                        View Access Log
                      </button>
                      <button className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                        <FileText className="h-3 w-3" />
                        Shared Records
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
              {familyMembersList.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <div className="text-sm font-semibold text-foreground">No family members linked</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Add family members to manage their healthcare access
                  </div>
                  <button
                    onClick={handleAddFamilyMember}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add First Family Member
                  </button>
                </div>
              )}
            </div>
          </StaggerItem>

          {/* Active delegations */}
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Healthcare Access Delegations
                </div>
                <span className="text-xs text-muted-foreground">
                  {delegationsList.filter((d: any) => d.status === 'active').length} active
                </span>
              </div>
              <div className="space-y-2">
                {delegationsList.map((d: any) => (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{d.delegateTo}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {d.scope}
                          </span>
                          <span className="text-border">·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires {d.expiry}
                          </span>
                        </div>
                      </div>
                      {d.status === 'active' && (
                        <div className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRevoke(d.id)}
                      className="ml-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      Revoke
                    </button>
                  </motion.div>
                ))}
                {delegationsList.length === 0 && (
                  <div className="py-8 text-center">
                    <ShieldCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <div className="text-sm font-medium text-foreground">No active delegations</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Healthcare providers you grant consent to will appear here
                    </div>
                  </div>
                )}
              </div>
            </div>
          </StaggerItem>

          {/* Privacy notice */}
          <StaggerItem>
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-foreground">
                  DID-based Access Control
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  All family access is mediated by verifiable credentials. Each permission is
                  individually signed and time-limited. You can revoke access at any time. All
                  access events are logged immutably on the blockchain.
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* Quick Actions Panel */}
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Quick Actions
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => toast.info("Feature coming soon")}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Invite Guardian</span>
                </button>
                <button 
                  onClick={() => toast.info("Feature coming soon")}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  <span>Share Records</span>
                </button>
                <button 
                  onClick={() => toast.info("Feature coming soon")}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Eye className="h-4 w-4" />
                  <span>View All Access</span>
                </button>
                <button 
                  onClick={() => toast.info("Feature coming soon")}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Emergency Settings</span>
                </button>
              </div>
            </div>
          </StaggerItem>
        </StaggerList>

        {/* Add Family Member Modal */}
        <AnimatePresence>
          {showAddMemberModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
              onClick={() => setShowAddMemberModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-clinical-md p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground">Add Family Member</h3>
                  <button
                    onClick={() => setShowAddMemberModal(false)}
                    className="p-1 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Family Member DID
                    </label>
                    <input
                      type="text"
                      placeholder="did:hosp:0x..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Relationship
                    </label>
                    <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option>Spouse</option>
                      <option>Parent</option>
                      <option>Child</option>
                      <option>Guardian</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-2">
                      Access Permissions
                    </label>
                    <div className="space-y-2">
                      {["View records", "Sign consents", "Emergency access", "Appointment booking"].map((perm) => (
                        <label key={perm} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" className="rounded" defaultChecked={perm === "View records"} />
                          <span>{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setShowAddMemberModal(false)}
                      className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        toast.success("Family member added successfully");
                        setShowAddMemberModal(false);
                      }}
                      className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Add Member
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </RouteGuard>
  );
}
