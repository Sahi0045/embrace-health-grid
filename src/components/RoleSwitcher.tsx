import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { User, Stethoscope, ShieldCheck, Lock } from "lucide-react";
import { getCurrentUser, type AuthUser } from "@/lib/auth";

const roles = [
  { id: "patient", label: "Patient", icon: User, to: "/patient" as const },
  { id: "staff", label: "Staff", icon: Stethoscope, to: "/staff" as const },
];

export function RoleSwitcher() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  // Defer localStorage read to client only to avoid SSR hydration mismatch
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    setUser(getCurrentUser());
  }, [pathname]);

  const availableRoles = roles.filter((r) => {
    if (user?.role === "admin") return true; // Keep admin permission if logged in as admin to bypass patient/staff switcher
    return r.id === user?.role;
  });

  if (availableRoles.length <= 1) return null;

  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/40 p-1">
      {roles.map((r) => {
        const active = pathname.startsWith(r.to);
        const Icon = r.icon;
        const isAvailable = availableRoles.some((ar) => ar.id === r.id);

        if (!isAvailable) {
          return (
            <div
              key={r.id}
              className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground/40 cursor-not-allowed"
              title="Access restricted"
            >
              <Lock className="h-4 w-4" />
              <span>{r.label}</span>
            </div>
          );
        }

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
