import { createFileRoute, Link } from "@tanstack/react-router";
import {
  User, Stethoscope, ShieldCheck, ArrowRight, Hospital,
  Network, Search, GitBranch, Award, Syringe, CreditCard,
  Heart, Video, Users2, Command, FlaskConical, Scissors,
  ShieldAlert, Bed, Globe, Activity,
} from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DID Hospital Infrastructure — Demo" },
      { name: "description", content: "Healthcare Identity Infrastructure Platform — patient, staff, and admin portals." },
    ],
  }),
  component: Home,
});

const portals = [
  {
    to: "/patient" as const,
    role: "Patient Portal",
    icon: User,
    blurb: "QR check-in, credentials wallet, emergency profile, vaccines, insurance, telemedicine, family access.",
    accent: "from-primary/10",
    color: "text-primary",
    count: "15 screens",
  },
  {
    to: "/staff" as const,
    role: "Staff Portal",
    icon: Stethoscope,
    blurb: "Command center, patient management, prescriptions, labs, surgeries, emergency response.",
    accent: "from-chart-2/15",
    color: "text-chart-2",
    count: "12 screens",
  },
];

const globalTools = [
  { to: "/did-explorer" as const, label: "DID Explorer", icon: Search, desc: "Search all DID records" },
  { to: "/credential-explorer" as const, label: "Credential Explorer", icon: Award, desc: "Browse verifiable credentials" },
  { to: "/audit-timeline" as const, label: "Audit Timeline", icon: GitBranch, desc: "5,000 immutable audit events" },
];

const featureModules = [
  { icon: Heart, label: "Emergency Profile", color: "text-destructive bg-destructive/10", portal: "Patient" },
  { icon: Syringe, label: "Vaccine Passport", color: "text-chart-2 bg-chart-2/10", portal: "Patient" },
  { icon: CreditCard, label: "Insurance & Claims", color: "text-success bg-success/10", portal: "Patient" },
  { icon: Video, label: "Telemedicine", color: "text-primary bg-primary/10", portal: "Patient" },
  { icon: Users2, label: "Family Access", color: "text-chart-3 bg-chart-3/10", portal: "Patient" },
  { icon: Command, label: "Command Center", color: "text-chart-4 bg-chart-4/10", portal: "Staff" },
  { icon: FlaskConical, label: "Lab Orders", color: "text-chart-2 bg-chart-2/10", portal: "Staff" },
  { icon: Scissors, label: "Surgeries", color: "text-primary bg-primary/10", portal: "Staff" },
  { icon: ShieldAlert, label: "Emergency Dept.", color: "text-destructive bg-destructive/10", portal: "Staff" },
  { icon: Bed, label: "Resource Tracking", color: "text-success bg-success/10", portal: "Staff" },
  { icon: Globe, label: "Federation Network", color: "text-chart-2 bg-chart-2/10", portal: "Staff" },
  { icon: Activity, label: "Admin Command", color: "text-chart-4 bg-chart-4/10", portal: "Staff" },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 space-y-16">
      {/* Hero */}
      <div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-4"
        >
          <Hospital className="h-4 w-4" />
          DID Hospital — Healthcare Identity Infrastructure
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl"
        >
          One identity.<br />
          <span className="text-muted-foreground">Every healthcare touchpoint.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 max-w-2xl text-base text-muted-foreground"
        >
          A complete healthcare DID platform: patient mobile app, clinician portal, and admin
          console unified under verifiable credentials — built for investors, executives, and
          hackathon judges.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-6 flex flex-wrap gap-3"
        >
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign In <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/did-explorer"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Search className="h-4 w-4" />
            DID Explorer
          </Link>
        </motion.div>
      </div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid gap-6 rounded-2xl border border-border bg-card p-6 sm:grid-cols-4"
      >
        {[
          { label: "DIDs Issued", value: "12,847", sub: "+128 today" },
          { label: "Mock Patients", value: "500", sub: "Full dataset" },
          { label: "Credentials", value: "1,000", sub: "12 types" },
          { label: "Audit Events", value: "5,000", sub: "Immutable log" },
        ].map(s => (
          <div key={s.label}>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{s.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </motion.div>

      {/* Portals */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">Two Portals</div>
        <div className="grid gap-4 sm:grid-cols-2 max-w-4xl mx-auto">
          {portals.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.to}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <Link
                  to={p.to}
                  className={`group relative block overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-clinical transition-all hover:-translate-y-0.5 hover:shadow-clinical-md`}
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${p.accent} to-transparent`} />
                  <div className="relative">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-card shadow-clinical ${p.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <h3 className="text-base font-semibold text-foreground">{p.role}</h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{p.count}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.blurb}</p>
                    <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Enter portal <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Global tools */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">Global Network Tools</div>
        <div className="grid gap-3 sm:grid-cols-3 max-w-5xl mx-auto">
          {globalTools.map((t, i) => {
            const Icon = t.icon;
            return (
              <motion.div
                key={t.to}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
              >
                <Link
                  to={t.to}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-clinical hover:shadow-clinical-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Feature modules grid */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">New Feature Modules</div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {featureModules.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i }}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${f.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-[11px] font-medium text-foreground leading-tight">{f.label}</div>
                <div className="text-[10px] text-muted-foreground">{f.portal}</div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Compliance footer */}
      <div className="grid gap-6 rounded-2xl border border-border bg-card p-6 sm:grid-cols-3 text-center">
        {[
          { label: "HIPAA", value: "98/100", sub: "Compliant" },
          { label: "GDPR", value: "95/100", sub: "Compliant" },
          { label: "DPDP Act", value: "97/100", sub: "India 2023" },
        ].map(s => (
          <div key={s.label}>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold text-success">{s.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
