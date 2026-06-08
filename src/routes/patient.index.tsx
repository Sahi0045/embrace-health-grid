import { createFileRoute, Link } from "@tanstack/react-router";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { currentPatient } from "@/lib/mock-data";
import {
  useLivePatients,
  useFabricConsents,
  useFabricAppointments,
} from "@/hooks/use-fabric";
import { QrCode, Wallet, ShieldCheck, History, Heart, ChevronRight, BellRing, CalendarDays, Activity, ClipboardList, Syringe, CreditCard, Video, Users2 } from "lucide-react";
import { motion } from "framer-motion";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/patient/")({
  head: () => ({ meta: [{ title: "Patient · Home — DID Hospital" }] }),
  component: PatientHome,
});

const quickActions: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { to: "/patient/inpatient",    label: "Inpatient",  icon: Activity },
  { to: "/patient/records",      label: "Records",    icon: ClipboardList },
  { to: "/patient/qr",           label: "Show QR",    icon: QrCode },
  { to: "/patient/appointments", label: "Visits",     icon: CalendarDays },
  { to: "/patient/wallet",       label: "Wallet",     icon: Wallet },
  { to: "/patient/consent",      label: "Consent",    icon: ShieldCheck },
  { to: "/patient/history",      label: "History",    icon: History },
  { to: "/patient/emergency",    label: "Emergency",  icon: Heart },
  { to: "/patient/vaccines",     label: "Vaccines",   icon: Syringe },
  { to: "/patient/insurance",    label: "Insurance",  icon: CreditCard },
  { to: "/patient/telemedicine", label: "Tele",       icon: Video },
  { to: "/patient/family",       label: "Family",     icon: Users2 },
];

function PatientHome() {
  const { patients } = useLivePatients();
  const { data: consentsData } = useFabricConsents();
  const { data: apptsData } = useFabricAppointments();

  const userEmail = typeof window !== "undefined" ? localStorage.getItem("userEmail") : "";
  const userName = typeof window !== "undefined" ? localStorage.getItem("userName") : "";
  const patientRecord = patients?.find((p: any) => p.email === userEmail);

  if (!patientRecord) {
    return (
      <RouteGuard requiredRole="patient">
        <div className="flex min-h-[80vh] items-center justify-center px-4">
          <div className="max-w-md text-center bg-card p-8 rounded-2xl border border-border shadow-clinical">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-foreground">Awaiting DID Provisioning</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Welcome to the Patient Portal, <span className="font-semibold">{userName || userEmail}</span>.
            </p>
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
              Your decentralized identity (DID) document must be approved and issued on the blockchain by an Administrator before you can access health services, appointments, or medical wallets.
            </p>
            <div className="mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  localStorage.removeItem("userRole");
                  localStorage.removeItem("userEmail");
                  localStorage.removeItem("userName");
                  window.location.href = "/login";
                }}
              >
                Logout / Switch Account
              </Button>
            </div>
          </div>
        </div>
      </RouteGuard>
    );
  }

  const pendingConsents = consentsData?.consents?.filter((c: any) => c.status === "pending" || c.status === "requested")?.length ?? 0;
  
  // Find upcoming appointment
  const patientAppts = apptsData?.appointments?.filter((a: any) => a.patientDid === patientRecord.did) ?? [];
  const nextVisit = patientAppts.find((a: any) => a.status === "confirmed" || a.status === "upcoming" || a.status === "upcoming-visit") as any;

  const displayNextVisit = nextVisit ? {
    doctor: nextVisit.doctorName || nextVisit.doctorDid || "Doctor Specialist",
    specialty: nextVisit.specialty || "General Medicine",
    time: nextVisit.slot || "Confirmed Appointment Slot"
  } : null;

  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Patient app"
          title={`Good morning, ${patientRecord.name.split(" ")[0]}`}
          description="Your health summary and quick actions"
        />

        <StaggerList className="mt-6 space-y-5">
          {/* DID Card */}
          <StaggerItem>
            <motion.div
              whileTap={{ scale: 0.99 }}
              className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-clinical-md"
            >
              <div className="flex items-center justify-between text-xs opacity-80">
                <span>Hospital DID</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5">Verified</span>
              </div>
              <div className="mt-2 font-mono text-sm">{patientRecord.did}</div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70">MRN</div>
                  <div className="text-sm font-medium">{patientRecord.mrn}</div>
                </div>
                <Link to="/patient/qr" className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-white/25 transition-colors">
                  Check-in QR <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </motion.div>
          </StaggerItem>

          {/* Pending consent alert */}
          {pendingConsents > 0 && (
            <StaggerItem>
              <Link
                to="/patient/consent"
                className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm transition-colors hover:bg-warning/15"
              >
                <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.8 }}>
                  <BellRing className="h-4 w-4 text-warning-foreground" />
                </motion.span>
                <span className="flex-1 text-foreground">
                  <b>{pendingConsents}</b> pending consent request{pendingConsents > 1 ? "s" : ""}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </StaggerItem>
          )}

          {/* Two-column row: next visit + emergency info */}
          <StaggerItem>
            <div className="grid gap-4 sm:grid-cols-2">
              {displayNextVisit && (
                <Link
                  to="/patient/appointments"
                  className="block rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-clinical-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-primary">Next visit</div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">{displayNextVisit.doctor}</div>
                  <div className="text-xs text-muted-foreground">{displayNextVisit.specialty} · {displayNextVisit.time}</div>
                </Link>
              )}

              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Heart className="h-4 w-4 text-destructive" />
                  Emergency info
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Blood group</div>
                    <div className="font-semibold text-foreground">{patientRecord.bloodGroup}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Allergies</div>
                    <div className="font-semibold text-foreground">
                      {patientRecord.allergies.join(", ") || "None"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </StaggerItem>


          {/* Quick actions grid */}
          <StaggerItem>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <motion.div key={a.to} whileTap={{ scale: 0.92 }}>
                    <a
                      href={a.to}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-center text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      {a.label}
                    </a>
                  </motion.div>
                );
              })}
            </div>
          </StaggerItem>
        </StaggerList>
      </div>
    </RouteGuard>
  );
}
