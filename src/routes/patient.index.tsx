import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { currentPatient, consents } from "@/lib/mock-data";
import { QrCode, Wallet, ShieldCheck, History, Heart, ChevronRight, BellRing } from "lucide-react";

export const Route = createFileRoute("/patient/")({
  head: () => ({ meta: [{ title: "Patient · Home — DID Hospital" }] }),
  component: PatientHome,
});

const quickActions = [
  { to: "/patient/qr" as const, label: "Show my QR", icon: QrCode },
  { to: "/patient/wallet" as const, label: "Credentials", icon: Wallet },
  { to: "/patient/consent" as const, label: "Consent", icon: ShieldCheck },
  { to: "/patient/history" as const, label: "History", icon: History },
];

function PatientHome() {
  const pendingConsents = consents.filter((c) => c.status === "pending").length;

  return (
    <PhoneFrame title="Home">
      <div className="space-y-5 p-5">
        <div>
          <div className="text-xs text-muted-foreground">Good morning</div>
          <div className="text-xl font-semibold text-foreground">{currentPatient.name.split(" ")[0]}</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-clinical-md">
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
            <Link to="/patient/qr" className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-white/25">
              Check-in QR <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {pendingConsents > 0 && (
          <Link
            to="/patient/consent"
            className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm"
          >
            <BellRing className="h-4 w-4 text-warning-foreground" />
            <span className="flex-1 text-foreground">
              <b>{pendingConsents}</b> pending consent request{pendingConsents > 1 ? "s" : ""}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        )}

        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.to}
                to={a.to}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-center text-[11px] font-medium text-foreground hover:bg-muted"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                {a.label}
              </Link>
            );
          })}
        </div>

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
      </div>
    </PhoneFrame>
  );
}
