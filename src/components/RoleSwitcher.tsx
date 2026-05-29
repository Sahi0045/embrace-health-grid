import { Link, useRouterState } from "@tanstack/react-router";
import { User, Stethoscope, ShieldCheck } from "lucide-react";

const roles = [
  { id: "patient", label: "Patient", icon: User, to: "/patient" as const, blurb: "Mobile app" },
  { id: "staff", label: "Staff", icon: Stethoscope, to: "/staff" as const, blurb: "Clinician portal" },
  { id: "admin", label: "Admin", icon: ShieldCheck, to: "/admin" as const, blurb: "Operations" },
];

export function RoleSwitcher() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/40 p-1">
      {roles.map((r) => {
        const active = pathname.startsWith(r.to);
        const Icon = r.icon;
        return (
          <Link
            key={r.id}
            to={r.to}
            className={[
              "flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-clinical"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            <span>{r.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
