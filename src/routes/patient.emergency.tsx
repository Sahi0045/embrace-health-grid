import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import {
  EmergencyAccessCard,
  type EmergencyAccessEvent,
} from "@/components/emergency/EmergencyAccessCard";
import { useLivePatients, useLiveStaff, useAudit } from "@/hooks/use-api";
import { getCurrentUser } from "@/lib/auth";
import {
  Heart,
  AlertTriangle,
  User,
  Phone,
  Droplets,
  ShieldAlert,
  QrCode,
  Activity,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export const Route = createFileRoute("/patient/emergency")({
  head: () => ({ meta: [{ title: "Emergency Profile — DID Hospital" }] }),
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
  const { patients: patientsList } = useLivePatients();
  const { staff } = useLiveStaff();
  const { data: auditData } = useAudit();
  const currentUser = getCurrentUser();
  const userEmail = currentUser?.email || "";
  const patient = patientsList?.find((p: any) => p.email === userEmail) || patientsList?.[0] || { name: "", mrn: "", age: 0, gender: "F" as const, bloodGroup: "", allergies: [] as string[], did: "", primaryDoctor: "", conditions: [] as string[], organDonor: false };
  const [showQr, setShowQr] = useState(false);

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
    const doc = staff?.find((s: any) => s.name === patient.primaryDoctor || s.did === patient.primaryDoctor);
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
        severity: cond.toLowerCase().includes("allergy") || cond.toLowerCase().includes("diabet") ? "critical" : "controlled",
        since: "N/A",
      }))
    : [];

  // Live Break Glass Events
  const allEvents = auditData?.events || [];
  const breakGlassEventsList: EmergencyAccessEvent[] = allEvents
    .filter((e: any) => e.severity === "critical" || e.action.toLowerCase().includes("break_glass") || e.action.toLowerCase().includes("emergency"))
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
          <button
            onClick={() => setShowQr(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            <QrCode className="h-4 w-4" />
            Emergency QR
          </button>
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
        <StaggerList className="space-y-5">
          {/* Hero emergency card */}
          <StaggerItem>
            <motion.div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-destructive to-destructive/75 p-6 text-white shadow-clinical-md">
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
              <div className="flex items-center gap-2 text-xs opacity-80 mb-3">
                <AlertTriangle className="h-3.5 w-3.5" />
                Emergency Profile — DID Verified
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">
                    Patient
                  </div>
                  <div className="text-lg font-bold">{patient.name}</div>
                  <div className="text-sm opacity-80">
                    {patient.mrn} · Age {patient.age} · {patient.gender === "F" ? "Female" : "Male"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">
                    Blood Group
                  </div>
                  <div className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-red-200" />
                    <span className="text-3xl font-bold">{patient.bloodGroup || "N/A"}</span>
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
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Known Allergies
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
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Activity className="h-4 w-4 text-primary" />
                  Critical Conditions
                </div>
                <div className="space-y-2">
                  {criticalConditionsList.map((c) => (
                    <div
                      key={c.label}
                      className="flex items-center justify-between rounded-lg bg-muted px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">{c.label}</div>
                        <div className="text-[11px] text-muted-foreground">Since {c.since}</div>
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
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Phone className="h-4 w-4 text-primary" />
                  Emergency Contacts
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
                        {ec.primary && <span className="text-[10px] text-success">Primary</span>}
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
                {patient.bloodGroup} · {patient.allergies && patient.allergies.join(", ")}
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
