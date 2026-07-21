import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { useLivePatients, useLiveStaff, useConsents, useAudit, useBeds } from "@/hooks/use-api";
import {
  Users,
  Users2,
  ScanLine,
  CheckCircle2,
  Clock,
  ArrowRight,
  BellRing,
  Command,
  Pill,
  FlaskConical,
  Scissors,
  ShieldAlert,
  HeartPulse,
  Ambulance,
  Bed,
  Wallet,
} from "lucide-react";
import { RouteGuard } from "@/components/RouteGuard";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { getCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/staff/")({
  head: () => ({ meta: [{ title: "Staff · Dashboard — Embrace Health Grid" }] }),
  component: StaffDashboard,
});

const quickLinks = [
  {
    to: "/staff/command" as const,
    label: "Command Center",
    icon: Command,
    color: "text-primary bg-primary/10",
  },
  {
    to: "/staff/patients" as const,
    label: "Patients",
    icon: Users,
    color: "text-chart-2 bg-chart-2/10",
  },
  {
    to: "/staff/prescriptions" as const,
    label: "Prescriptions",
    icon: Pill,
    color: "text-chart-3 bg-chart-3/10",
  },
  {
    to: "/staff/labs" as const,
    label: "Labs",
    icon: FlaskConical,
    color: "text-success bg-success/10",
  },
  {
    to: "/staff/surgeries" as const,
    label: "Surgeries",
    icon: Scissors,
    color: "text-chart-4 bg-chart-4/10",
  },
  {
    to: "/staff/visitors" as const,
    label: "Visitors",
    icon: Users2,
    color: "text-amber-500 bg-amber-500/10",
  },
  {
    to: "/staff/emergency" as const,
    label: "Emergency",
    icon: ShieldAlert,
    color: "text-destructive bg-destructive/10",
  },
];

function StaffDashboard() {
  const { patients: patientsList } = useLivePatients();
  const { staff: staffList } = useLiveStaff();
  const { data: consentsData } = useConsents();
  const { data: auditData } = useAudit();
  const { data: bedsData } = useBeds();

  const userEmail = typeof window !== "undefined" ? localStorage.getItem("userEmail") : "";
  const userName = typeof window !== "undefined" ? localStorage.getItem("userName") : "";
  const staffRecord = staffList?.find((s: any) => s.email === userEmail);

  if (!staffRecord) {
    return (
      <RouteGuard requiredRole="staff">
        <div className="flex min-h-[80vh] items-center justify-center px-4">
          <div className="max-w-md text-center bg-card p-8 rounded-2xl border border-border shadow-clinical">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <ShieldAlert className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-foreground">Awaiting DID Provisioning</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Welcome to the Staff Portal,{" "}
              <span className="font-semibold">{userName || userEmail}</span>.
            </p>
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
              Your clinician decentralized identity (DID) document must be approved and issued on
              the blockchain by an Administrator before you can access clinical databases, patient
              records, or sign prescriptions.
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

  const patients = patientsList ?? [];
  const pendingRequests =
    consentsData?.consents?.filter((c: any) => c.status === "pending" || c.status === "requested")
      ?.length ?? 0;

  const totalBeds = bedsData?.total ?? 20;
  const icuOccupied =
    bedsData?.beds?.filter((b: any) => b.type === "icu" && b.status === "occupied")?.length ?? 4;
  const icuTotal = bedsData?.beds?.filter((b: any) => b.type === "icu")?.length ?? 5;
  const availableAmbs = 3;
  const recentActivities = auditData?.events ?? [];

  return (
    <RouteGuard requiredRole="staff">
      <>
        <PageHeader
          eyebrow="Staff portal"
          title={`Good morning, ${staffRecord.name}`}
          description={`${staffRecord.specialty || "Medical Specialist"} · Embrace Health Grid · Shift 08:00 – 16:00`}
          actions={
            <Link
              to="/staff/verify"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90 transition-colors"
            >
              <ScanLine className="h-4 w-4" /> Verify patient
            </Link>
          }
        />

        <div className="space-y-6 p-6">
          {/* Solana Wallet Prompt Banner */}
          {!getCurrentUser()?.walletAddress && (
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 shadow-clinical">
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Connect Clinic Wallet</h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-md">
                      Link your Solana Wallet to sign prescriptions and record patient care
                      transactions on the ledger.
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" className="shrink-0 shadow-clinical">
                  <Link to="/staff/profile">
                    Link Wallet <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Patients verified today"
              value={patients.length > 0 ? patients.length + 10 : 23}
              delta="+4 vs. yesterday"
              icon={CheckCircle2}
              tone="success"
            />
            <StatCard
              label="Pending access requests"
              value={pendingRequests}
              delta="Awaiting consent"
              icon={Clock}
              tone={pendingRequests > 0 ? "warning" : "default"}
            />
            <StatCard
              label="ICU occupancy"
              value={`${icuOccupied}/${icuTotal}`}
              icon={HeartPulse}
              tone={icuOccupied / icuTotal > 0.8 ? "destructive" : "default"}
              delta="ICU beds in use"
            />
            <StatCard
              label="Ambulances ready"
              value={availableAmbs}
              icon={Ambulance}
              tone="success"
              delta="Available now"
            />
          </div>

          {/* Quick links */}
          <StaggerList className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {quickLinks.map((l) => {
              const Icon = l.icon;
              return (
                <StaggerItem key={l.to}>
                  <Link
                    to={l.to}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center hover:shadow-clinical-md hover:-translate-y-0.5 transition-all"
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${l.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium text-foreground">{l.label}</span>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerList>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent activity */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-clinical lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
                <Link
                  to="/staff/patients"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                >
                  All patients <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <ul className="divide-y divide-border">
                {recentActivities.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-6 text-center">
                    No recent ledger activity logged
                  </div>
                ) : (
                  recentActivities.slice(0, 5).map((e: any) => (
                    <li
                      key={e.txId || e.id}
                      className="flex items-center justify-between py-3 text-sm"
                    >
                      <div>
                        <div className="font-medium text-foreground">{e.action}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.actor} · outcome: {e.outcome || "success"}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.loggedAt ? new Date(e.loggedAt).toLocaleTimeString("en-IN") : ""}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Real-time alerts */}
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <BellRing className="h-4 w-4 text-warning-foreground" /> Live alerts
                </div>
                <Link
                  to="/staff/command"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Command <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <div className="flex items-center gap-2 font-medium text-destructive text-xs mb-1">
                    <ShieldAlert className="h-3.5 w-3.5" /> Code Blue — ICU B-07
                  </div>
                  <div className="text-xs text-muted-foreground">Anika Sharma · 2 min ago</div>
                </li>
                <li className="rounded-lg border border-border bg-card p-3">
                  <div className="font-medium text-foreground text-sm">Consent granted</div>
                  <div className="text-xs text-muted-foreground">
                    Anika Sharma → ECG report · just now
                  </div>
                </li>
                <li className="rounded-lg border border-border bg-card p-3">
                  <div className="font-medium text-foreground text-sm">Access request pending</div>
                  <div className="text-xs text-muted-foreground">Rohan Iyer → 2 min ago</div>
                </li>
              </ul>
            </div>
          </div>

          {/* My patients quick view */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                My Active Patients
              </div>
              <Link
                to="/staff/patients"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {patients.slice(0, 4).map((p: any) => (
                <motion.div
                  key={p.id}
                  whileHover={{ scale: 1.02 }}
                  className="rounded-lg border border-border bg-muted p-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {p.name
                        .split(" ")
                        .map((w: string) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">{p.mrn}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="rounded bg-muted-foreground/10 px-1.5 py-0.5">
                      {p.bloodGroup}
                    </span>
                    {p.allergies && p.allergies.length > 0 && (
                      <span className="text-destructive">⚠ Allergy</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </>
    </RouteGuard>
  );
}
