import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getCurrentUser, hasAccess, type AuthUser } from "@/lib/auth";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RouteGuardProps {
  requiredRole: "patient" | "staff" | "admin";
  children: React.ReactNode;
}

export function RouteGuard({ requiredRole, children }: RouteGuardProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined); // undefined = not yet checked

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  // Still loading on client — render nothing to avoid flash
  if (user === undefined) return null;

  // Not logged in — redirect to login
  if (user === null) {
    navigate({ to: "/login" });
    return null;
  }

  // Logged in but wrong role
  if (!hasAccess(user.role, requiredRole)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is restricted to <span className="font-medium capitalize">{requiredRole}</span> users only.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              onClick={() => {
                if (user.role === "patient") navigate({ to: "/patient" });
                else if (user.role === "staff") navigate({ to: "/staff" });
                else if (user.role === "admin") navigate({ to: "/" });
                else navigate({ to: "/" });
              }}
            >
              Go to My Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                localStorage.removeItem("userRole");
                localStorage.removeItem("userEmail");
                navigate({ to: "/login" });
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
