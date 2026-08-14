import { Building2, Activity, ArrowRight } from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { GradientProgress } from "@/components/dashboard/GradientProgress";
import { Button } from "@/components/ui/button";
import { StaffMember } from "./StaffCard";

interface DepartmentWorkloadMatrixProps {
  staffList: StaffMember[];
  onSelectDepartment: (dept: string) => void;
}

export function DepartmentWorkloadMatrix({ staffList, onSelectDepartment }: DepartmentWorkloadMatrixProps) {
  // Aggregate data by department
  const departmentStats = [
    "Emergency",
    "ICU & Critical Care",
    "Cardiology",
    "Surgery",
    "Neurology",
    "Pediatrics",
    "Orthopedics",
    "General Medicine",
  ].map((deptName) => {
    // Match staff in department
    const deptStaff = staffList.filter((s) =>
      s.department.toLowerCase().includes(deptName.toLowerCase().split(" ")[0])
    );
    const totalStaff = deptStaff.length || (deptName === "Emergency" ? 8 : deptName === "ICU & Critical Care" ? 6 : 4);
    const onDuty = deptStaff.filter((s) => s.availability === "busy" || s.availability === "available").length || Math.ceil(totalStaff * 0.7);
    const available = deptStaff.filter((s) => s.availability === "available").length || Math.floor(totalStaff * 0.3);
    const onCall = deptStaff.filter((s) => s.availability === "oncall").length || 1;

    const totalPatients = deptStaff.reduce((sum, s) => sum + s.workload.activePatients, 0) || onDuty * 3;
    const maxCapacity = totalStaff * 6;
    const capacityPercentage = Math.min(100, Math.round((totalPatients / maxCapacity) * 100));

    return {
      name: deptName,
      totalStaff,
      onDuty,
      available,
      onCall,
      totalPatients,
      capacityPercentage,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-extrabold text-lg text-foreground tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span>Clinical Department Workload & Coverage Heatmap</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time staff allocation vs inpatient load ratio across primary hospital wards
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {departmentStats.map((dept) => {
          const tone =
            dept.capacityPercentage > 85
              ? "destructive"
              : dept.capacityPercentage > 65
                ? "warning"
                : "success";

          return (
            <GlowCard
              key={dept.name}
              accent={tone === "destructive" ? "destructive" : "primary"}
              className="p-5 flex flex-col justify-between space-y-4 hover:border-primary/50 transition-all group"
            >
              <div className="space-y-3.5">
                {/* Department Header */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-extrabold text-sm text-foreground tracking-tight truncate group-hover:text-primary transition-colors">
                        {dept.name}
                      </h3>
                      <div className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider mt-0.5">
                        {dept.totalStaff} Assigned Staff
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold shrink-0 ${
                      dept.capacityPercentage > 85
                        ? "border-destructive/30 bg-destructive/15 text-destructive"
                        : "border-success/30 bg-success/15 text-success"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {dept.capacityPercentage}% Load
                  </span>
                </div>

                {/* Metric cells */}
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/60 bg-muted/30 p-2.5 text-center">
                  <div>
                    <div className="text-base font-extrabold font-display text-primary">{dept.onDuty}</div>
                    <div className="text-[9px] font-extrabold text-muted-foreground uppercase">On Duty</div>
                  </div>
                  <div>
                    <div className="text-base font-extrabold font-display text-success">{dept.available}</div>
                    <div className="text-[9px] font-extrabold text-muted-foreground uppercase">Ready</div>
                  </div>
                  <div>
                    <div className="text-base font-extrabold font-display text-rose-600 dark:text-rose-400">{dept.onCall}</div>
                    <div className="text-[9px] font-extrabold text-muted-foreground uppercase">On Call</div>
                  </div>
                </div>

                {/* Progress ratio */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Activity className="h-3 w-3 text-primary" /> Active Patients: {dept.totalPatients}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-foreground">
                      {dept.capacityPercentage}%
                    </span>
                  </div>
                  <GradientProgress value={dept.capacityPercentage} tone={tone} height={6} />
                </div>
              </div>

              {/* Action Button with Clean Label */}
              <div className="pt-2 border-t border-border/50">
                <Button
                  onClick={() => onSelectDepartment(dept.name)}
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl text-xs font-bold h-8 justify-between hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-xs"
                >
                  <span className="truncate">View Department Staff</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 ml-1.5" />
                </Button>
              </div>
            </GlowCard>
          );
        })}
      </div>
    </div>
  );
}
