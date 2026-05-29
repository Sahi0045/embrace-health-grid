import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, QrCode, Wallet, ShieldCheck, History,
  LayoutDashboard, ScanLine, Users, FileSignature,
  KeyRound, Activity, AlertTriangle, BarChart3, Settings, Hospital,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { RoleSwitcher } from "./RoleSwitcher";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const patientNav: Item[] = [
  { title: "Home", url: "/patient", icon: Home },
  { title: "My QR Code", url: "/patient/qr", icon: QrCode },
  { title: "Credentials", url: "/patient/wallet", icon: Wallet },
  { title: "Consent", url: "/patient/consent", icon: ShieldCheck },
  { title: "Access history", url: "/patient/history", icon: History },
];

const staffNav: Item[] = [
  { title: "Dashboard", url: "/staff", icon: LayoutDashboard },
  { title: "Verify patient", url: "/staff/verify", icon: ScanLine },
  { title: "Patients", url: "/staff/patients", icon: Users },
  { title: "Sign & prescribe", url: "/staff/sign", icon: FileSignature },
];

const adminNav: Item[] = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard },
  { title: "DID management", url: "/admin/dids", icon: KeyRound },
  { title: "Audit logs", url: "/admin/audit", icon: Activity },
  { title: "Fraud detection", url: "/admin/fraud", icon: AlertTriangle },
  { title: "Compliance", url: "/admin/compliance", icon: BarChart3 },
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
            const active = pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url + "/"));
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

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const role: "patient" | "staff" | "admin" | null =
    pathname.startsWith("/patient") ? "patient"
    : pathname.startsWith("/staff") ? "staff"
    : pathname.startsWith("/admin") ? "admin"
    : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Hospital className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-semibold">DID Hospital</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Infrastructure</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="px-1 pb-2">
            <RoleSwitcher />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {role === "patient" && <NavGroup label="Patient app" items={patientNav} />}
        {role === "staff" && <NavGroup label="Staff portal" items={staffNav} />}
        {role === "admin" && <NavGroup label="Admin console" items={adminNav} />}

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>System</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/" className="flex items-center gap-2">
                    <Settings className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Demo home</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
