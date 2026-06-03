import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { staffPatients, accessHistory } from "@/lib/mock-data";
import { mockBeds, mockAmbulances } from "@/lib/mock-infrastructure";
import {
  Users, ScanLine, CheckCircle2, Clock, ArrowRight, BellRing,
  Command, Pill, FlaskConical, Scissors, ShieldAlert, HeartPulse,
  Ambulance, Bed,
} from "lucide-react";
import { RouteGuard } from "@/components/RouteGuard";
import { motion } from "framer-motion";

export const Route = createFileRoute("/staff/")({
  head: () => ({ meta: [{ title: "Staff · Dashboard — DID Hospital" }] }),
  component: StaffDashboard,
});

const quickLinks = [
  { to: "/staff/command" as const, label: "Command Center", icon: Command, color: "text-primary bg-primary/10" },
  { to: "/staff/patients" as const, label: "Patients", icon: Users, color: "text-chart-2 bg-chart-2/10" },
  { to: "/staff/prescriptions" as const, label: "Prescriptions", icon: Pill, color: "text-chart-3 bg-chart-3/10" },
  { to: "/staff/labs" as const, label: "Labs", icon: FlaskConical, color: "text-success bg-success/10" },
  { to: "/staff/surgeries" as const, label: "Surgeries", icon: Scissors, color: "text-chart-4 bg-chart-4/10" },
  { to: "/staff/emergency" as const, label: "Emergency", icon: ShieldAlert, color: "text-destructive bg-destructive/10" },
];

function StaffDashboard() {
  const icuOccupied = mockBeds.filter(b => b.type === "icu" && b.status === "occupied").length;
  const icuTotal = mockBeds.filter(b => b.type === "icu").length;
  const availableAmbs = mockAmbulances.filter(a => a.status === "available").length;

  return (
    <RouteGuard requiredRole="staff">
      <>
        <PageHeader
          eyebrow="Staff portal"
          title="Good morning, Dr. Menon"
          description="Cardiology · Apollo Hospitals · Shift 08:00 – 16:00"
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
          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Patients verified today" value={23} delta="+4 vs. yesterday" icon={CheckCircle2} tone="success" />
            <StatCard label="Pending access requests" value={2} delta="Awaiting consent" icon={Clock} tone="warning" />
            <StatCard label="ICU occupancy" value={`${icuOccupied}/${icuTotal}`} icon={HeartPulse} tone={icuOccupied / icuTotal > 0.8 ? "destructive" : "default"} delta="ICU beds in use" />
            <StatCard label="Ambulances ready" value={availableAmbs} icon={Ambulance} tone="success" delta="Available now" />
          </div>

          {/* Quick links */}
          <StaggerList className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {quickLinks.map(l => {
              const Icon = l.icon;
              return (
                <StaggerItem key={l.to}>
                  <Link
                    to={l.to}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center hover:shadow-clinical-md hover:-translate-y-0.5 transition-all"
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${l.color}`}>
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
                <Link to="/staff/patients" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  All patients <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <ul className="divide-y divide-border">
                {accessHistory.slice(0, 5).map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <div className="font-medium text-foreground">{e.resource}</div>
                      <div className="text-xs text-muted-foreground">{e.actor} · {e.action}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{e.at}</div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Real-time alerts */}
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <BellRing className="h-4 w-4 text-warning-foreground" /> Live alerts
                </div>
                <Link to="/staff/command" className="text-xs text-primary hover:underline flex items-center gap-1">
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
                  <div className="text-xs text-muted-foreground">Anika Sharma → ECG report · just now</div>
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
              <Link to="/staff/patients" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {staffPatients.map(p => (
                <motion.div
                  key={p.id}
                  whileHover={{ scale: 1.02 }}
                  className="rounded-lg border border-border bg-muted p-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {p.name.split(" ").map(w => w[0]).slice(0,2).join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">{p.mrn}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="rounded bg-muted-foreground/10 px-1.5 py-0.5">{p.bloodGroup}</span>
                    {p.allergies.length > 0 && (
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
