import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { useLivePatients, useAmbulances, useFraudAlerts } from "@/hooks/use-api";
import { useBeds } from "@/hooks/use-api";
import {
  AlertTriangle,
  Activity,
  Bed,
  Ambulance,
  FileSignature,
  ShieldAlert,
  Stethoscope,
  HeartPulse,
  Clock,
  TrendingUp,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { getAllPrescriptions, getSurgeries, signPrescription } from "@/lib/api";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/auth-context";

/**
 * ICU is a property of the WARD, not of the bed.
 *
 * These tiles used to filter `b.type === "icu"`. `beds` has no `type` column —
 * `bed_type` describes the frame ("Electric"), not the level of care — so the
 * filter matched nothing and every ICU occupancy figure read 0/0 regardless of
 * how full the unit was.
 */
function isIcuBed(b: { ward?: string | null }) {
  return (b.ward ?? "").toLowerCase().includes("icu");
}

export const Route = createFileRoute("/staff/command")({
  head: () => ({ meta: [{ title: "Command Center — Staff Portal" }] }),
  component: StaffCommandCenter,
});

function UrgencyDot({ urgency }: { urgency: string | null }) {
  // null = not modelled. It renders neutral rather than as the "medium" the
  // caller used to hardcode for every row.
  const cls =
    urgency === "high"
      ? "bg-destructive"
      : urgency === "medium"
        ? "bg-warning"
        : "bg-muted-foreground";
  return <div className={`h-2 w-2 rounded-full shrink-0 ${cls}`} />;
}

function StaffCommandCenter() {
  const { user: currentUser } = useCurrentUser();
  const { patients: livePatients = [] } = useLivePatients();
  const { data: bedsData } = useBeds();
  const { data: ambulancesData } = useAmbulances();
  const allBeds = bedsData?.beds ?? [];
  const allAmbulances = ambulancesData?.ambulances ?? [];
  const { data: fraudData } = useFraudAlerts();

  const liveAlerts: { id: string; msg: string; severity: string; time: string }[] = (
    fraudData?.alerts ?? []
  ).map((a: any) => ({
    // String(Math.random()) as a React key remounts the row on every render.
    id: a.alertId ?? a.id ?? `${a.type ?? "alert"}-${a.detectedAt ?? ""}`,
    // `affectedResource` is not a field the mapper returns; `actor` is the one
    // that identifies who triggered the alert.
    msg: a.message ?? `${a.type ?? "Alert"} — ${a.actor ?? "System"}`,
    // fraud_alerts carries its own severity. Re-deriving it from riskScore
    // overrode what the detector recorded, and mapped everything below 80 to
    // "warning" — including alerts the detector had marked critical.
    severity: a.severity ?? (a.riskScore >= 80 ? "critical" : "warning"),
    time: a.detectedAt
      ? new Date(a.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—",
  }));

  const icuBeds = allBeds.filter(isIcuBed).slice(0, 8);
  const criticalPatients = livePatients.filter((p) => {
    return (
      (p.conditions || []).some(
        (c: string) => c.includes("Cardiac") || c.includes("COPD") || c.includes("Kidney"),
      ) || p.status === "inpatient"
    );
  });

  const occupiedICU = icuBeds.filter((b: any) => b.status === "occupied").length;
  const availableAmbulances = allAmbulances.filter((a: any) => a.status === "available").length;

  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [surgeries, setSurgeries] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const staffDid =
    typeof window !== "undefined" ? (currentUser?.primaryDid ?? "") : "did:hosp:staff:current";

  const fetchData = () => {
    setLoadingData(true);
    Promise.all([getAllPrescriptions(), getSurgeries()])
      .then(([rxRes, surgRes]) => {
        setPrescriptions(rxRes.prescriptions || []);
        setSurgeries(surgRes.surgeries || []);
      })
      .catch((err) => console.error("Error loading staff command data:", err))
      .finally(() => setLoadingData(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSign = async (rxId: string) => {
    // signPrescription mints a credential whose SUBJECT is the patient, so it
    // needs the patient's DID. This used to pass `{ rxId, staffDid }` only, so
    // `patientDid` resolved to "" and signCredential threw
    // "subjectDid and credentialType are required" — every "Sign now" click
    // ended in "Failed to sign prescription" and the queue never drained.
    const rx = prescriptions.find((p) => p.rxId === rxId);
    if (!rx?.patientDid) {
      toast.error("Cannot sign: this prescription has no patient DID on record");
      return;
    }

    toast.promise(
      (async () => {
        await signPrescription({ rxId, patientDid: rx.patientDid, staffDid });
        fetchData();
        return true;
      })(),
      {
        loading: "Signing prescription using clinician credential...",
        success: "Prescription signed and logged on ledger!",
        error: (e) => `Failed to sign prescription: ${e instanceof Error ? e.message : e}`,
      },
    );
  };

  const pendingSignatures = prescriptions
    .filter((p) => !p.signed && p.status !== "signed")
    .map((p) => ({
      id: p.rxId,
      type: "Prescription",
      // getPrescriptions returns patientDid / doctorDid / createdAt. `patientName`,
      // `clinicName` and `date` are not fields it returns and not columns that
      // exist, so every pending signature displayed "Unknown Patient", "OPD Desk"
      // and "Today" — three constants dressed as a work queue.
      patient: p.patientDid ?? "Unknown patient",
      requestedBy: p.doctorDid ?? "Unknown prescriber",
      // Urgency is not modelled on prescriptions; it was the literal "medium".
      urgency: null,
      time: p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—",
    }));

  const todayProcedures = surgeries.map((s) => ({
    id: s.id,
    patient: s.patient,
    procedure: s.procedure,
    room: s.room,
    time: s.time,
    status: s.status,
  }));

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Staff Portal"
        title="Command Center"
        description="Real-time overview of critical patients, alerts, and pending actions"
      />

      <div className="p-6 space-y-6">
        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Critical Patients"
            value={criticalPatients.length}
            icon={HeartPulse}
            tone="destructive"
            delta="Requires immediate attention"
          />
          <StatCard
            label="ICU Occupied"
            value={`${occupiedICU}/${icuBeds.length}`}
            icon={Bed}
            tone="warning"
            delta="ICU capacity"
          />
          <StatCard
            label="Pending Signatures"
            value={pendingSignatures.length}
            icon={FileSignature}
            tone="default"
            delta="Awaiting your sign-off"
          />
          <StatCard
            label="Available Ambulances"
            value={availableAmbulances}
            icon={Ambulance}
            tone="success"
            delta="Ready for dispatch"
          />
        </div>

        {/* Alerts */}
        <StaggerList className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Live Alerts
          </div>
          {liveAlerts.map((a) => (
            <StaggerItem key={a.id}>
              <motion.div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${a.severity === "critical" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}`}
              >
                {a.severity === "critical" ? (
                  <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning-foreground shrink-0" />
                )}
                <span className="flex-1 text-sm text-foreground">{a.msg}</span>
                <span className="text-xs text-muted-foreground shrink-0">{a.time}</span>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerList>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pending signatures */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileSignature className="h-4 w-4 text-primary" />
              Pending Signatures ({pendingSignatures.length})
            </div>
            <div className="space-y-2">
              {pendingSignatures.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
                  <UrgencyDot urgency={s.urgency} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {s.type} — {s.patient}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.requestedBy}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">{s.time}</div>
                    <button
                      onClick={() => handleSign(s.id)}
                      className="mt-0.5 text-[10px] font-semibold text-primary hover:underline"
                    >
                      Sign now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's procedures */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Activity className="h-4 w-4 text-primary" />
              Today's Procedures
            </div>
            <div className="space-y-2">
              {todayProcedures.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
                  <div
                    className={`h-2 w-2 rounded-full shrink-0 ${p.status === "in-progress" ? "bg-success" : "bg-primary"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{p.procedure}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.patient} · {p.room}
                    </div>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground shrink-0">{p.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ICU snapshot */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-clinical">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bed className="h-4 w-4 text-primary" />
            ICU Bed Occupancy Snapshot
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {icuBeds.map((b: any) => (
              <div
                key={b.id}
                title={b.patientName ?? b.status}
                className={`flex h-14 flex-col items-center justify-center rounded-xl text-center text-[10px] font-semibold transition-colors ${b.status === "occupied" ? "bg-primary/10 text-primary" : b.status === "available" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
              >
                <Bed className="h-4 w-4 mb-0.5" />
                {b.bedNumber ?? b.bedId}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-primary" /> Occupied
            </span>
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-success" /> Available
            </span>
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-muted-foreground" /> Maintenance
            </span>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
