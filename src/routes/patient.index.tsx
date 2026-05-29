import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { currentPatient, consents, appointments } from "@/lib/mock-data";
import { QrCode, Wallet, ShieldCheck, History, Heart, ChevronRight, BellRing, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/patient/")({
  head: () => ({ meta: [{ title: "Patient · Home — DID Hospital" }] }),
  component: PatientHome,
});

const quickActions = [
  { to: "/patient/qr" as const, label: "Show QR", icon: QrCode },
  { to: "/patient/appointments" as const, label: "Visits", icon: CalendarDays },
  { to: "/patient/wallet" as const, label: "Wallet", icon: Wallet },
  { to: "/patient/consent" as const, label: "Consent", icon: ShieldCheck },
  { to: "/patient/history" as const, label: "History", icon: History },
];

function PatientHome() {
  const pendingConsents = consents.filter((c) => c.status === "pending").length;
  const nextVisit = appointments.find((a) => a.status === "upcoming");

  return (
    <PhoneFrame title="Home">
      <StaggerList className="space-y-5 p-5">
        <StaggerItem>
          <div className="text-xs text-muted-foreground">Good morning</div>
          <div className="text-xl font-semibold text-foreground">{currentPatient.name.split(" ")[0]}</div>
        </StaggerItem>

        <StaggerItem>
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-clinical-md"
          >
            <div className="flex items-center justify-between text-xs opacity-80">
              <span>Hospital DID</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5">Verified</span>
            </div>
            <div className="mt-2 font-mono text-sm">{currentPatient.did}</div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider opacity-70">MRN</div>
                <div className="text-sm font-medium">{currentPatient.mrn}</div>
              </div>
              <Link to="/patient/qr" className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-white/25 transition-colors">
                Check-in QR <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        </StaggerItem>

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

        {nextVisit && (
          <StaggerItem>
            <Link
              to="/patient/appointments"
              className="block rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-clinical-md"
            >
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-medium uppercase tracking-wider text-primary">Next visit</div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">{nextVisit.doctor}</div>
              <div className="text-xs text-muted-foreground">{nextVisit.specialty} · {nextVisit.time}</div>
            </Link>
          </StaggerItem>
        )}

        <StaggerItem>
          <div className="grid grid-cols-5 gap-2">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <motion.div key={a.to} whileTap={{ scale: 0.92 }}>
                  <Link
                    to={a.to}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center text-[10px] font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    {a.label}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Heart className="h-4 w-4 text-destructive" />
              Emergency info
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground">Blood group</div>
                <div className="font-semibold text-foreground">{currentPatient.bloodGroup}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Allergies</div>
                <div className="font-semibold text-foreground">
                  {currentPatient.allergies.join(", ") || "None"}
                </div>
              </div>
            </div>
          </div>
        </StaggerItem>
      </StaggerList>
    </PhoneFrame>
  );
}
