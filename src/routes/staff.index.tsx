import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { staffPatients, accessHistory } from "@/lib/mock-data";
import { Users, ScanLine, CheckCircle2, Clock, ArrowRight, BellRing } from "lucide-react";
import { RouteGuard } from "@/components/RouteGuard";

export const Route = createFileRoute("/staff/")({
  head: () => ({ meta: [{ title: "Staff · Dashboard — DID Hospital" }] }),
  component: StaffDashboard,
});

function StaffDashboard() {
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
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90"
          >
            <ScanLine className="h-4 w-4" /> Verify patient
          </Link>
        }
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Patients verified today" value={23} delta="+4 vs. yesterday" icon={CheckCircle2} tone="success" />
          <StatCard label="Pending access requests" value={2} delta="Awaiting consent" icon={Clock} tone="warning" />
          <StatCard label="My active patients" value={staffPatients.length} icon={Users} />
          <StatCard label="Avg. verify time" value="12s" delta="↓ 6s this week" icon={ScanLine} tone="success" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6 shadow-clinical lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
              <Link to="/staff/patients" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                All patients <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <ul className="mt-4 divide-y divide-border">
              {accessHistory.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium text-foreground">{e.resource}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.actor} · {e.action}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{e.at}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-warning/30 bg-warning/5 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BellRing className="h-4 w-4 text-warning-foreground" /> Real-time alerts
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="rounded-lg border border-border bg-card p-3">
                <div className="font-medium text-foreground">Patient consent granted</div>
                <div className="text-xs text-muted-foreground">Anika Sharma → ECG report · just now</div>
              </li>
              <li className="rounded-lg border border-border bg-card p-3">
                <div className="font-medium text-foreground">Access request pending</div>
                <div className="text-xs text-muted-foreground">Rohan Iyer → 2 min ago</div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
    </RouteGuard>
  );
}
