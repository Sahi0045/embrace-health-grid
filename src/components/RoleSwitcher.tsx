import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { User, Stethoscope, ShieldCheck, Lock } from "lucide-react";
import { useCurrentUser } from "@/lib/auth-context";

const roles = [
  { id: "patient", label: "Patient", icon: User, to: "/patient" as const },
  { id: "staff", label: "Doctor/Staff", icon: Stethoscope, to: "/staff" as const },
  { id: "admin", label: "Admin", icon: ShieldCheck, to: "/admin" as const },
];

export function RoleSwitcher() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const { user: user } = useCurrentUser();
  useEffect(() => {}, [pathname]);

  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/40 p-1">
      {roles.map((r) => {
        const active = pathname.startsWith(r.to);
        const Icon = r.icon;
        // Mirror hasAccess(): an admin may enter staff areas but NOT the patient
        // portal, which belongs to a patient's own records. Offering it here
        // showed an unlocked tab that the guard then refused.
        const isAvailable =
          user?.role === r.id ||
          (user?.role === "admin" && r.id !== "patient") ||
          (user?.role === "doctor" && r.id === "staff");

        if (!isAvailable) {
          return (
            <div
              key={r.id}
              className="flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[9px] font-medium text-muted-foreground/40 cursor-not-allowed text-center"
              title="Access restricted"
            >
              <Lock className="h-3 w-3" />
              <span className="truncate">{r.label}</span>
            </div>
          );
        }

        return (
          <Link
            key={r.id}
            to={r.to}
            className={[
              "flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[9px] font-medium transition-colors text-center",
              active
                ? "bg-card text-foreground shadow-clinical font-bold"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{r.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
