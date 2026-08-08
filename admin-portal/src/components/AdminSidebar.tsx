import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Command,
  Network,
  Receipt,
  Layers,
  Code2,
  User,
  Building2,
  Bed,
  Users,
  UserCheck,
  KeyRound,
  Award,
  BookLock,
  Activity,
  AlertTriangle,
  BarChart3,
  Globe,
  Search,
  GitBranch,
  Hospital,
  LogOut,
  Fingerprint,
  Pill,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { adminCurrentUser, adminSignOut } from "~/lib/supabase";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const adminNav: Item[] = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Command Center", url: "/command", icon: Command },
  { title: "Digital Twin", url: "/digital-twin", icon: Network },
  { title: "Financials", url: "/financial", icon: Receipt },
  { title: "My Profile", url: "/profile", icon: User },
  { title: "People", url: "/people", icon: Users },
  { title: "DID Management", url: "/dids", icon: KeyRound },
  { title: "Credentials", url: "/credentials", icon: Award },
  { title: "Prescriptions", url: "/prescriptions", icon: Pill },
  { title: "Policies", url: "/policies", icon: BookLock },
  { title: "Audit Logs", url: "/audit", icon: Activity },
  { title: "Fraud Detection", url: "/fraud", icon: AlertTriangle },
  { title: "NFC Cards", url: "/nfc-cards", icon: Fingerprint },
];

const globalNav: Item[] = [
  { title: "DID Explorer", url: "/did-explorer", icon: Search },
  { title: "Credential Explorer", url: "/credential-explorer", icon: Award },
  { title: "Audit Timeline", url: "/audit-timeline", icon: GitBranch },
];

function NavGroup({ label, items }: { label: string; items: Item[] }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarGroup>
      {!collapsed && (
        <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active =
              pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url + "/"));
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active}>
                  <Link to={item.url} className="flex items-center gap-2">
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                    )}
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AdminSidebar() {
  const router = useRouter();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [user, setUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
    did: string | null;
  } | null>(null);

  useEffect(() => {
    // The role is read from Postgres, not from client state, so editing local
    // storage cannot grant access. RLS enforces the boundary regardless.
    let cancelled = false;
    void adminCurrentUser().then((currentUser) => {
      if (cancelled) return;
      setUser(currentUser);
      if (!currentUser) router.navigate({ to: "/login" });
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogout = async () => {
    await adminSignOut();
    router.navigate({ to: "/login" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-clinical-sm">
            <Hospital className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-foreground">
                Embrace Health
              </div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                Admin Console
              </div>
            </div>
          )}
        </div>
        {!collapsed && user && (
          <div className="mt-2 px-2 py-1.5 bg-muted/50 rounded-lg text-[11px] text-muted-foreground">
            Logged in as: <strong className="text-foreground">{user.name}</strong>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <NavGroup label="Administrative Console" items={adminNav} />
        <NavGroup label="Network Explorers" items={globalNav} />

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
              Session
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleLogout}
                  className="text-destructive hover:text-destructive flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>Sign out</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
