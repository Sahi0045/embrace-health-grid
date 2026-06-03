import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { EmergencyAccessCard, type EmergencyAccessEvent } from "@/components/emergency/EmergencyAccessCard";
import { currentPatient } from "@/lib/mock-data";
import { Heart, AlertTriangle, User, Phone, Droplets, ShieldAlert, QrCode, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export const Route = createFileRoute("/patient/emergency")({
  head: () => ({ meta: [{ title: "Emergency Profile — DID Hospital" }] }),
  component: EmergencyPage,
});

const emergencyContacts = [
  { name: "Sunil Sharma", relation: "Spouse", phone: "+91 98765 43210", primary: true },
  { name: "Dr. Ravi Menon", relation: "Primary Physician", phone: "+91 11-2345-6789", primary: false },
];

const criticalConditions = [
  { label: "Type 2 Diabetes", severity: "managed", since: "2019" },
  { label: "Hypertension", severity: "controlled", since: "2021" },
  { label: "Penicillin Allergy", severity: "critical", since: "childhood" },
  { label: "Sulfa Drug Allergy", severity: "critical", since: "2018" },
];

const breakGlassEvents: EmergencyAccessEvent[] = [
  { id: "bg1", actor: "Dr. Priya Nair", actorRole: "ER Physician", reason: "Patient unconscious at arrival, no prior consent available", at: "2026-04-14 22:31", autoAudited: true },
  { id: "bg2", actor: "Dr. Sameer Khan", actorRole: "ICU Resident", reason: "Cardiac event — immediate allergy check required", at: "2025-11-03 03:45", autoAudited: true },
];

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "critical") return <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">Critical</span>;
  if (severity === "managed") return <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">Managed</span>;
  return <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">Controlled</span>;
}

function EmergencyPage() {
  const [showQr, setShowQr] = useState(false);

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
            <motion.div
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-destructive to-destructive/75 p-6 text-white shadow-clinical-md"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
              <div className="flex items-center gap-2 text-xs opacity-80 mb-3">
                <AlertTriangle className="h-3.5 w-3.5" />
                Emergency Profile — DID Verified
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Patient</div>
                  <div className="text-lg font-bold">{currentPatient.name}</div>
                  <div className="text-sm opacity-80">{currentPatient.mrn} · Age {currentPatient.age} · {currentPatient.gender === "F" ? "Female" : "Male"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Blood Group</div>
                  <div className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-red-200" />
                    <span className="text-3xl font-bold">{currentPatient.bloodGroup}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Organ Donor</div>
                  <div className="flex items-center gap-1.5 text-lg font-bold">
                    <Heart className="h-5 w-5 text-pink-300" />
                    Yes — Registered
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
                {currentPatient.allergies.map((a) => (
                  <span key={a} className="rounded-lg bg-destructive/15 px-3 py-1.5 text-sm font-semibold text-destructive">{a}</span>
                ))}
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
                  {criticalConditions.map((c) => (
                    <div key={c.label} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-foreground">{c.label}</div>
                        <div className="text-[11px] text-muted-foreground">Since {c.since}</div>
                      </div>
                      <SeverityBadge severity={c.severity} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Phone className="h-4 w-4 text-primary" />
                  Emergency Contacts
                </div>
                <div className="space-y-2">
                  {emergencyContacts.map((ec) => (
                    <div key={ec.name} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                          {ec.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
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
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* Break glass history */}
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-4 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold text-foreground">Break-Glass Access History</span>
                <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">{breakGlassEvents.length} events</span>
              </div>
              <div className="space-y-3">
                {breakGlassEvents.map((ev) => (
                  <EmergencyAccessCard key={ev.id} event={ev} />
                ))}
              </div>
            </div>
          </StaggerItem>
        </StaggerList>
      </div>

      {/* Emergency QR Modal */}
      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4" onClick={() => setShowQr(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border border-border bg-card p-6 text-center shadow-clinical-md max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-foreground mb-1">Emergency QR Code</div>
            <div className="text-xs text-muted-foreground mb-4">Scan to access emergency profile</div>
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl bg-muted">
              <QrCode className="h-32 w-32 text-foreground/30" />
            </div>
            <div className="mt-4 rounded-lg bg-destructive/10 p-3">
              <div className="text-xs font-semibold text-destructive">{currentPatient.name}</div>
              <div className="text-[11px] text-muted-foreground">{currentPatient.bloodGroup} · {currentPatient.allergies.join(", ")}</div>
            </div>
            <button onClick={() => setShowQr(false)} className="mt-4 w-full rounded-xl bg-muted py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors">
              Close
            </button>
          </motion.div>
        </div>
      )}
    </RouteGuard>
  );
}
