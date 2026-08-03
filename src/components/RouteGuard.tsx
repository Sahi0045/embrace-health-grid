import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCurrentUser, hasAccess } from "@/lib/auth-context";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-level UI gate.
 *
 * The role comes from the database via the server-verified session, replacing
 * the previous implementation which read `localStorage["userRole"]` — a value
 * any user could edit in devtools to reveal another role's screens.
 *
 * This is still only a UI gate. Actual data protection is enforced by RLS in
 * Postgres: bypassing this component reveals empty pages, not other patients'
 * records. The RLS test suite asserts that directly.
 */
interface RouteGuardProps {
  requiredRole: "patient" | "doctor" | "staff" | "admin";
  children: React.ReactNode;
}

export function RouteGuard({ requiredRole, children }: RouteGuardProps) {
  const navigate = useNavigate();
  const { user, loading, signOut } = useCurrentUser();

  useEffect(() => {
    if (!loading && user === null) {
      navigate({ to: "/login" });
    }
  }, [loading, user, navigate]);

  // Render nothing while the session is being verified, so a protected page
  // never flashes before the check completes.
  if (loading || user === null) return null;

  if (!hasAccess(user.role, requiredRole)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is restricted to{" "}
            <span className="font-medium capitalize">{requiredRole}</span> users only.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              onClick={() => {
                if (user.role === "patient") navigate({ to: "/patient" as never });
                else if (user.role === "doctor" || user.role === "staff")
                  navigate({ to: "/staff" as never });
                else navigate({ to: "/" as never });
              }}
            >
              Go to My Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                // Clears the httpOnly cookie server-side; there is no local
                // state to purge.
                await signOut();
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
