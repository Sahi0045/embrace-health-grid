import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, Sun, Sunset, Moon, PhoneCall, User } from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StaffMember } from "./StaffCard";

export interface RosterShiftEntry {
  shiftId: string;
  staffId: string;
  shiftDate: string; // YYYY-MM-DD
  role: string;
  startsAt: string;
  endsAt: string;
  unit: string;
  patientCount?: number;
  confirmed: boolean;
  notes?: string;
}

interface DutyRosterGridProps {
  staffList: StaffMember[];
  schedules: RosterShiftEntry[];
  onSelectStaff: (staff: StaffMember) => void;
}

export function DutyRosterGrid({ staffList, schedules, onSelectStaff }: DutyRosterGridProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  // Compute 7 days of the current week based on offset
  const weekDays = useMemo(() => {
    const base = new Date();
    // Start on Monday of the current week
    const currentDay = base.getDay(); // 0 is Sun, 1 is Mon...
    const distanceToMonday = (currentDay + 6) % 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - distanceToMonday + weekOffset * 7);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isoDate = d.toISOString().split("T")[0];
      const isToday = isoDate === new Date().toISOString().split("T")[0];
      return {
        date: d,
        isoDate,
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        monthDay: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        isToday,
      };
    });
  }, [weekOffset]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length < 7) return "";
    return `${weekDays[0].monthDay} — ${weekDays[6].monthDay}, ${weekDays[0].date.getFullYear()}`;
  }, [weekDays]);

  // Lookup map: staffId_isoDate -> RosterShiftEntry[]
  const shiftMap = useMemo(() => {
    const map = new Map<string, RosterShiftEntry[]>();
    for (const s of schedules) {
      const key = `${s.staffId}_${s.shiftDate}`;
      const existing = map.get(key) || [];
      existing.push(s);
      map.set(key, existing);
    }
    return map;
  }, [schedules]);

  // Color mapping for shift types
  const getShiftBadgeStyle = (role: string, startsAt: string) => {
    const r = role.toLowerCase();
    const startHour = parseInt(startsAt?.split(":")[0] || "0", 10);

    if (r.includes("call") || r.includes("emergency")) {
      return {
        bg: "bg-rose-500/15 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30",
        icon: PhoneCall,
        label: "On-Call",
      };
    }
    if (startHour >= 22 || startHour < 6 || r.includes("night")) {
      return {
        bg: "bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30",
        icon: Moon,
        label: "Night",
      };
    }
    if (startHour >= 14 || r.includes("evening")) {
      return {
        bg: "bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
        icon: Sunset,
        label: "Evening",
      };
    }
    return {
      bg: "bg-blue-500/15 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
      icon: Sun,
      label: "Morning",
    };
  };

  return (
    <div className="space-y-4">
      {/* Week Navigator & Legend Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border/80 p-3 rounded-2xl shadow-clinical-sm">
        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="rounded-xl h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset(0)}
            className={`rounded-xl text-xs font-extrabold h-8 px-3 ${
              weekOffset === 0 ? "bg-primary text-primary-foreground border-primary" : ""
            }`}
          >
            Today
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="rounded-xl h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <span className="text-xs font-extrabold font-display text-foreground pl-2">
            {weekRangeLabel}
          </span>
        </div>

        {/* Shift Type Legend */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 text-[10px] font-bold">
          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> Morning
          </div>
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Evening
          </div>
          <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
            <span className="h-2 w-2 rounded-full bg-purple-500" /> Night
          </div>
          <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> On-Call
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-muted" /> Off
          </div>
        </div>
      </div>

      {/* Roster Calendar Matrix */}
      <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-clinical-sm">
        <table className="w-full min-w-[960px] border-collapse text-left text-xs">
          {/* Header Row */}
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground">
              <th className="py-3 px-4 font-extrabold uppercase tracking-wider text-[10px] w-64">
                Clinician / Staff Member
              </th>
              {weekDays.map((wd) => (
                <th
                  key={wd.isoDate}
                  className={`py-3 px-2 text-center font-extrabold uppercase tracking-wider text-[10px] ${
                    wd.isToday
                      ? "bg-primary/10 text-primary border-x-2 border-primary/40 font-black"
                      : ""
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span>{wd.dayName}</span>
                    <span className={`text-xs ${wd.isToday ? "text-primary font-mono font-extrabold" : "text-foreground font-semibold"}`}>
                      {wd.monthDay}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-border/50">
            {staffList.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground">
                  No staff members match the selected filter.
                </td>
              </tr>
            ) : (
              staffList.map((member) => (
                <tr key={member.id} className="hover:bg-muted/20 transition-colors">
                  {/* Left Fixed Staff Column */}
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => onSelectStaff(member)}
                      className="text-left w-full flex items-center gap-2.5 group"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary font-display font-extrabold text-xs">
                        {member.fullName
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                          {member.fullName}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium truncate">
                          {member.department} · {member.role}
                        </div>
                      </div>
                    </button>
                  </td>

                  {/* 7 Days Shift Cells */}
                  {weekDays.map((wd) => {
                    const shifts = shiftMap.get(`${member.id}_${wd.isoDate}`) || [];
                    const hasShift = shifts.length > 0;

                    return (
                      <td
                        key={wd.isoDate}
                        className={`py-2 px-1.5 align-top ${
                          wd.isToday ? "bg-primary/5 border-x-2 border-primary/20" : ""
                        }`}
                      >
                        {hasShift ? (
                          <div className="space-y-1">
                            {shifts.map((shift) => {
                              const style = getShiftBadgeStyle(shift.role, shift.startsAt);
                              const IconComponent = style.icon;

                              return (
                                <button
                                  key={shift.shiftId}
                                  type="button"
                                  onClick={() => onSelectStaff(member)}
                                  className={`w-full text-left rounded-xl border p-1.5 text-[10px] transition-all hover:scale-[1.02] shadow-2xs ${style.bg}`}
                                >
                                  <div className="flex items-center justify-between font-extrabold gap-1">
                                    <span className="flex items-center gap-1 truncate">
                                      <IconComponent className="h-3 w-3 shrink-0" />
                                      {style.label}
                                    </span>
                                    {shift.confirmed && (
                                      <CheckCircle2 className="h-2.5 w-2.5 text-success shrink-0" />
                                    )}
                                  </div>

                                  <div className="font-mono text-[9px] text-muted-foreground mt-0.5 truncate">
                                    {shift.startsAt}–{shift.endsAt}
                                  </div>

                                  {shift.unit && (
                                    <div className="text-[9px] font-semibold text-foreground/80 truncate mt-0.5">
                                      {shift.unit}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="h-12 rounded-xl border border-dashed border-border/40 bg-muted/10 flex items-center justify-center text-[10px] text-muted-foreground/50 font-medium">
                            Off
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
