import { createFileRoute, Link } from "@tanstack/react-router";
import { User, Stethoscope, ShieldCheck, ArrowRight, Hospital } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DID Hospital Infrastructure — Demo" },
      { name: "description", content: "Choose a role to explore the patient, staff, or admin experience." },
    ],
  }),
  component: Home,
});

const surfaces = [
  {
    to: "/patient" as const,
    role: "Patient",
    icon: User,
    blurb: "Mobile-styled experience for patients: QR check-in, credentials wallet, consent control.",
    accent: "from-primary/10",
  },
  {
    to: "/staff" as const,
    role: "Staff",
    icon: Stethoscope,
    blurb: "Clinician portal to verify patients, request access, and sign prescriptions with DID + biometric.",
    accent: "from-chart-2/15",
  },
  {
    to: "/admin" as const,
    role: "Admin",
    icon: ShieldCheck,
    blurb: "Operations console for DID issuance, consent oversight, audit, fraud, and compliance.",
    accent: "from-chart-4/15",
  },
];

function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        <Hospital className="h-3.5 w-3.5" />
        Decentralized identity for healthcare
      </div>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        One identity. Three surfaces.<br />
        <span className="text-muted-foreground">Built on verifiable credentials.</span>
      </h1>
      <p className="mt-4 max-w-2xl text-base text-muted-foreground">
        This demo unifies the patient mobile app, clinician portal, and admin console into one
        shell so you can walk an end-to-end DID workflow — check-in, consent, audit — without
        switching apps.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {surfaces.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.to}
              to={s.to}
              className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-clinical transition-all hover:-translate-y-0.5 hover:shadow-clinical-md`}
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${s.accent} to-transparent opacity-60`} />
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.role}
                </div>
                <h3 className="mt-1 text-lg font-semibold text-foreground">
                  Enter {s.role.toLowerCase()} experience
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.blurb}</p>
                <div className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-14 grid gap-6 rounded-2xl border border-border bg-card p-6 sm:grid-cols-3">
        <Stat label="DIDs issued" value="12,847" />
        <Stat label="Avg. check-in" value="18s" sub="↓ 74% vs. paper" />
        <Stat label="Compliance score" value="96 / 100" sub="HIPAA · GDPR · DPDP" />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
