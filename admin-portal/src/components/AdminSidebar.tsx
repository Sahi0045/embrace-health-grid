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
import { logout, getCurrentUser, type AuthUser } from "@/lib/auth";

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
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active =
              pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url + "/"));
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active}>
                  <Link to={item.url} className="flex items-center gap-2">
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
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    // If not logged in or not admin, redirect to login page (we can check route auth in route levels later)
    if (!currentUser || currentUser.role !== "admin") {
      router.navigate({ to: "/login" });
    }
  }, []);

  const handleLogout = () => {
    logout();
    router.navigate({ to: "/login" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Hospital className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-semibold text-foreground">Embrace Health</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Admin Console
              </div>
            </div>
          )}
        </div>
        {!collapsed && user && (
          <div className="mt-2 px-2 py-1 bg-muted/50 rounded-md text-[11px] text-muted-foreground">
            Logged in as: <strong className="text-foreground">{user.name}</strong>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="bg-sidebar">
        <NavGroup label="Administrative Console" items={adminNav} />
        <NavGroup label="Network Explorers" items={globalNav} />

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Session</SidebarGroupLabel>}
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
