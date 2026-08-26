import { createFileRoute, Link } from "@tanstack/react-router";
import {
  User,
  Stethoscope,
  ArrowRight,
  Hospital,
  Search,
  GitBranch,
  Award,
  Syringe,
  CreditCard,
  Heart,
  Video,
  Users2,
  Command,
  FlaskConical,
  Scissors,
  ShieldAlert,
  Bed,
  Globe,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Embrace Health Grid" },
      {
        name: "description",
        content:
          "Decentralized Healthcare Identity Infrastructure — patient, staff, and admin portals.",
      },
    ],
  }),
  component: Home,
});

const portals = [
  {
    to: "/patient" as const,
    role: "Patient Portal",
    icon: User,
    blurb:
      "QR check-in, credentials wallet, emergency profile, vaccines, insurance, telemedicine, family access.",
    accent: "from-primary/20",
    color: "text-primary",
    count: "15 screens",
  },
  {
    to: "/staff" as const,
    role: "Staff Portal",
    icon: Stethoscope,
    blurb:
      "Command center, patient management, prescriptions, labs, surgeries, emergency response.",
    accent: "from-chart-2/20",
    color: "text-chart-2",
    count: "12 screens",
  },
];

const globalTools = [
  {
    to: "/did-explorer" as const,
    label: "DID Explorer",
    icon: Search,
    desc: "Search all DID records",
  },
  {
    to: "/audit-timeline" as const,
    label: "Audit Timeline",
    icon: GitBranch,
    desc: "5,000 immutable audit events",
  },
];

const featureModules = [
  {
    icon: Heart,
    label: "Emergency Profile",
    color: "text-destructive bg-destructive/10",
    portal: "Patient",
  },
  {
    icon: Syringe,
    label: "Vaccine Passport",
    color: "text-chart-2 bg-chart-2/10",
    portal: "Patient",
  },
  {
    icon: CreditCard,
    label: "Insurance & Claims",
    color: "text-success bg-success/10",
    portal: "Patient",
  },
  { icon: Video, label: "Telemedicine", color: "text-primary bg-primary/10", portal: "Patient" },
  { icon: Users2, label: "Family Access", color: "text-chart-3 bg-chart-3/10", portal: "Patient" },
  { icon: Command, label: "Command Center", color: "text-chart-4 bg-chart-4/10", portal: "Staff" },
  { icon: FlaskConical, label: "Lab Orders", color: "text-chart-2 bg-chart-2/10", portal: "Staff" },
  { icon: Scissors, label: "Surgeries", color: "text-primary bg-primary/10", portal: "Staff" },
  {
    icon: ShieldAlert,
    label: "Emergency Dept.",
    color: "text-destructive bg-destructive/10",
    portal: "Staff",
  },
  { icon: Bed, label: "Resource Tracking", color: "text-success bg-success/10", portal: "Staff" },
  {
    icon: Globe,
    label: "Federation Network",
    color: "text-chart-2 bg-chart-2/10",
    portal: "Staff",
  },
  { icon: Activity, label: "Admin Command", color: "text-chart-4 bg-chart-4/10", portal: "Staff" },
];

function AnimatedSection({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Home() {
  return (
    <div className="relative mx-auto max-w-6xl px-6 py-16 space-y-20">
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-20 h-96 w-96 rounded-full bg-accent/8 blur-3xl" />

      {/* Hero */}
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass-bg px-4 py-2 text-sm font-medium text-primary backdrop-blur mb-6"
        >
          <Hospital className="h-4 w-4" />
          Embrace Health Grid — Healthcare Identity Infrastructure
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-4xl font-bold tracking-[-0.02em] text-foreground sm:text-6xl"
        >
          One identity.
          <br />
          <span className="text-muted-foreground">Every healthcare touchpoint.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground"
        >
          A complete healthcare DID platform: patient mobile app, clinician portal, and admin
          console unified under verifiable credentials — built for modern, secure, and compliant
          health systems.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 flex flex-wrap gap-3"
        >
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-clinical transition-all duration-300 hover:bg-primary/90 hover:shadow-clinical-md hover:-translate-y-0.5"
          >
            Sign In <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/did-explorer"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-clinical transition-all duration-300 hover:bg-muted hover:shadow-clinical-md hover:-translate-y-0.5"
          >
            <Search className="h-4 w-4" />
            DID Explorer
          </Link>
        </motion.div>
      </div>

      {/* Stats bar */}
      <AnimatedSection delay={0.1}>
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "DIDs Issued", value: "12,847", sub: "+128 today", icon: ShieldCheck },
            { label: "Registered Patients", value: "500", sub: "Full dataset", icon: User },
            { label: "Credentials", value: "1,000", sub: "12 types", icon: Award },
            { label: "Audit Events", value: "5,000", sub: "Immutable log", icon: GitBranch },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-glass-border bg-glass-bg p-5 backdrop-blur shadow-clinical-sm"
            >
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                {s.value}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>
      </AnimatedSection>

      {/* Portals */}
      <AnimatedSection delay={0.15}>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-6">
          Two Portals
        </div>
        <div className="grid gap-4 sm:grid-cols-2 max-w-4xl mx-auto">
          {portals.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.to}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to={p.to}
                  className="group relative block overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-clinical transition-all duration-300 hover:-translate-y-1 hover:shadow-clinical-lg"
                >
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${p.accent} to-transparent`}
                  />
                  <div className="relative">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${p.accent} shadow-clinical-sm ${p.color}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <h3 className="text-base font-semibold text-foreground">{p.role}</h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {p.count}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.blurb}</p>
                    <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Enter portal{" "}
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </AnimatedSection>

      {/* Global tools */}
      <AnimatedSection delay={0.2}>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-6">
          Global Network Tools
        </div>
        <div className="grid gap-3 sm:grid-cols-3 max-w-5xl mx-auto">
          {globalTools.map((t, i) => {
            const Icon = t.icon;
            return (
              <motion.div
                key={t.to}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to={t.to}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-clinical transition-all duration-300 hover:-translate-y-0.5 hover:shadow-clinical-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
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
      </AnimatedSection>

      {/* Feature modules grid */}
      <AnimatedSection delay={0.25}>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-6">
          New Feature Modules
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {featureModules.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center shadow-clinical-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-clinical"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${f.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-[11px] font-medium leading-tight text-foreground">
                  {f.label}
                </div>
                <div className="text-[10px] text-muted-foreground">{f.portal}</div>
              </motion.div>
            );
          })}
        </div>
      </AnimatedSection>

      {/* Compliance footer */}
      <AnimatedSection delay={0.3}>
        <div className="grid gap-6 rounded-2xl border border-border bg-card p-6 sm:grid-cols-3 text-center shadow-clinical">
          {[
            { label: "HIPAA", value: "98/100", sub: "Compliant" },
            { label: "GDPR", value: "95/100", sub: "Compliant" },
            { label: "DPDP Act", value: "97/100", sub: "India 2023" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
              <div className="mt-1 text-2xl font-bold text-success">{s.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>
      </AnimatedSection>
    </div>
  );
}
