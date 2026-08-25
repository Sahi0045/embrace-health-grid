import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "../components/AdminSidebar";
import { Toaster } from "@/components/ui/sonner";

import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { adminCurrentUser } from "~/lib/supabase";

/**
 * Root-level auth gate for the admin portal.
 *
 * Until now this portal had no route guard at all: only `login.tsx` verified
 * anything, so opening /audit, /fraud, /policies or /dids directly rendered the
 * console to anyone. RLS meant the queries returned nothing, so no PHI leaked —
 * but an unauthenticated visitor still got the admin console's chrome instead of
 * being sent to sign in.
 *
 * `adminCurrentUser()` re-reads the profile from Postgres and re-checks the
 * role, so this cannot be satisfied by editing local state. It remains a UI
 * gate: RLS is still the boundary that protects data.
 *
 * NOTE: this portal is not deployed (nothing in vercel.json builds it) and it
 * holds its Supabase session in browser storage rather than an httpOnly cookie.
 * That weakness is unchanged by this guard and is why `src/lib/supabase.ts` says
 * the portal should be folded into the main app before it ever ships.
 */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ location }) => {
    // The sign-in page itself must stay reachable, or this redirects forever.
    if (location.pathname === "/login") return;

    const user = await adminCurrentUser();
    if (!user) {
      // No `redirect` search param: login.tsx always navigates to "/" and does
      // not read one, so passing it would only imply a deep-link round trip
      // that does not happen. Worth adding on both sides together.
      throw redirect({ to: "/login" });
    }
  },
  component: RootComponent,
});

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Sign-in renders bare: showing the console's sidebar and "Live" header around
  // a login form implies you are already inside it.
  if (pathname === "/login") {
    return (
      <>
        <Outlet />
        <Toaster />
      </>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border/50 bg-background/70 px-4 backdrop-blur-xl">
            <SidebarTrigger />
            <div className="flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span>Admin Console — Live</span>
            </div>
            <span className="ml-auto" />
            <ThemeToggle />
            <NotificationBell />
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}
