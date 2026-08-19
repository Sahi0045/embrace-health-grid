import { motion } from "framer-motion";
import {
  Stethoscope,
  User,
  FlaskConical,
  Camera,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { LabOrderRecord, RadiologyOrderRecord } from "@/lib/types";

interface DoctorOrdersTabProps {
  labOrders: LabOrderRecord[];
  radiologyOrders: RadiologyOrderRecord[];
}

interface DoctorGroup {
  doctorName: string;
  doctorDid: string;
  labOrders: LabOrderRecord[];
  radiologyOrders: RadiologyOrderRecord[];
  totalCount: number;
}

export function DoctorOrdersTab({ labOrders, radiologyOrders }: DoctorOrdersTabProps) {
  // Group orders by ordering physician
  const doctorGroups: Record<string, DoctorGroup> = {};

  for (const lo of labOrders) {
    const docName = lo.doctor_name || "Attending Clinician";
    if (!doctorGroups[docName]) {
      doctorGroups[docName] = {
        doctorName: docName,
        doctorDid: lo.ordered_by || "did:health:doctor",
        labOrders: [],
        radiologyOrders: [],
        totalCount: 0,
      };
    }
    doctorGroups[docName].labOrders.push(lo);
    doctorGroups[docName].totalCount++;
  }

  for (const ro of radiologyOrders) {
    const docName = ro.doctor_name || "Attending Clinician";
    if (!doctorGroups[docName]) {
      doctorGroups[docName] = {
        doctorName: docName,
        doctorDid: ro.ordered_by || "did:health:doctor",
        labOrders: [],
        radiologyOrders: [],
        totalCount: 0,
      };
    }
    doctorGroups[docName].radiologyOrders.push(ro);
    doctorGroups[docName].totalCount++;
  }

  const groupList = Object.values(doctorGroups).sort((a, b) => b.totalCount - a.totalCount);

  if (groupList.length === 0) {
    return (
      <EmptyState
        icon={Stethoscope}
        title="No physician orders logged"
        description="Active clinical doctor test requests will appear grouped here."
      />
    );
  }

  return (
    <div className="space-y-5">
      {groupList.map((group, gIdx) => (
        <motion.div
          key={group.doctorName}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: gIdx * 0.05 }}
          className="rounded-2xl border border-border/80 bg-card p-5 shadow-clinical-sm space-y-4"
        >
          {/* Doctor Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                  {group.doctorName}
                </h3>
                <p className="font-mono text-[10px] text-muted-foreground">{group.doctorDid}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-extrabold text-primary">
                <span>{group.totalCount} Active Requisitions</span>
              </span>
            </div>
          </div>

          {/* Sub-list of Requisitions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Lab Orders */}
            {group.labOrders.map((lo) => (
              <div
                key={lo.order_id}
                className="rounded-xl border border-border/60 bg-background/60 p-3.5 space-y-2 hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                    <FlaskConical className="h-3 w-3" />
                    Lab: {lo.test_category || "General"}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                      lo.priority === "stat"
                        ? "bg-destructive/15 text-destructive border-destructive/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {lo.priority.toUpperCase()}
                  </span>
                </div>

                <div>
                  <h4 className="font-display font-bold text-xs text-foreground">{lo.test_name}</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Patient: <strong className="text-foreground">{lo.patient_name}</strong>
                  </p>
                </div>

                {lo.clinical_notes && (
                  <p className="text-[11px] text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                    "{lo.clinical_notes}"
                  </p>
                )}
              </div>
            ))}

            {/* Radiology Orders */}
            {group.radiologyOrders.map((ro) => (
              <div
                key={ro.order_id}
                className="rounded-xl border border-border/60 bg-background/60 p-3.5 space-y-2 hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase bg-purple-500/15 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-md">
                    <Camera className="h-3 w-3" />
                    Imaging: {ro.modality.toUpperCase()}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                      ro.priority === "stat"
                        ? "bg-destructive/15 text-destructive border-destructive/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {ro.priority.toUpperCase()}
                  </span>
                </div>

                <div>
                  <h4 className="font-display font-bold text-xs text-foreground">{ro.body_part}</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Patient: <strong className="text-foreground">{ro.patient_name}</strong>
                  </p>
                </div>

                <p className="text-[11px] text-muted-foreground italic border-l-2 border-purple-500/30 pl-2">
                  "{ro.clinical_indication}"
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
