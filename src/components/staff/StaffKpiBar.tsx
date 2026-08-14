import { Users, UserCheck, Stethoscope, Clock, Activity } from "lucide-react";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { Badge } from "@/components/ui/badge";

export interface StaffKpiStats {
  totalStaff: number;
  onDuty: number;
  availableNow: number;
  onCall: number;
  busyNow: number;
  offDuty: number;
  doctorCount: number;
  nurseCount: number;
  activeShiftName: string;
  shiftWindow: string;
  handoverIn: string;
}

interface StaffKpiBarProps {
  stats: StaffKpiStats;
  className?: string;
}

export function StaffKpiBar({ stats, className = "" }: StaffKpiBarProps) {
  // Sparkline synthetic samples for visual trend activity
  const totalTrend = [28, 30, 31, 32, 34, 35, stats.totalStaff || 36];
  const onDutyTrend = [18, 20, 22, 21, 24, 25, stats.onDuty || 26];
  const availableTrend = [12, 14, 11, 15, 13, 16, stats.availableNow || 14];
  const onCallTrend = [4, 5, 3, 6, 4, 5, stats.onCall || 6];

  const dutyPercentage = stats.totalStaff > 0 ? Math.round((stats.onDuty / stats.totalStaff) * 100) : 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Active Shift Horizon Header Ribbon */}
      <GlowCard accent="primary" glowOnHover={false} className="p-4 md:p-5 border-border/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary">
                  Live Shift Window
                </span>
                <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-extrabold text-primary uppercase">
                  {stats.activeShiftName}
                </Badge>
                <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  {stats.shiftWindow}
                </span>
              </div>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">
                Next ward handover scheduled in <span className="font-bold text-foreground font-mono">{stats.handoverIn}</span>. All clinical stations operational.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            <div className="flex items-center divide-x divide-border/60 rounded-xl border border-border/70 bg-background/80 py-1.5 px-1 shadow-xs">
              <div className="px-3 text-center min-w-[70px]">
                <div className="text-sm font-extrabold font-display text-primary">{stats.doctorCount}</div>
                <div className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">Clinicians</div>
              </div>
              <div className="px-3 text-center min-w-[70px]">
                <div className="text-sm font-extrabold font-display text-teal-600 dark:text-teal-400">{stats.nurseCount}</div>
                <div className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">Nurses</div>
              </div>
              <div className="px-3 text-center min-w-[75px]">
                <div className="text-sm font-extrabold font-display text-success">{dutyPercentage}%</div>
                <div className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">Duty Ratio</div>
              </div>
            </div>
          </div>
        </div>
      </GlowCard>

      {/* 4 Core KPI Tiles Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Total Roster Staff"
          value={stats.totalStaff}
          icon={Users}
          tone="default"
          size="md"
          sparklineData={totalTrend}
          delta="+3 Onboarded this month"
        />

        <KpiTile
          label="Currently On Duty"
          value={stats.onDuty}
          icon={UserCheck}
          tone="success"
          size="md"
          sparklineData={onDutyTrend}
          trend={{ value: `${dutyPercentage}% Coverage`, isPositive: true }}
        />

        <KpiTile
          label="Available for Consult"
          value={stats.availableNow}
          icon={Activity}
          tone="success"
          size="md"
          sparklineData={availableTrend}
          delta="Immediate Dispatch Ready"
        />

        <KpiTile
          label="Emergency On-Call"
          value={stats.onCall}
          icon={Stethoscope}
          tone="destructive"
          size="md"
          sparklineData={onCallTrend}
          delta="High-Acuity Standby"
        />
      </div>
    </div>
  );
}
