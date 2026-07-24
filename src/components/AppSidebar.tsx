import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Home,
  QrCode,
  Wallet,
  ShieldCheck,
  History,
  CalendarDays,
  LayoutDashboard,
  ScanLine,
  Users,
  FileSignature,
  Calendar,
  KeyRound,
  Activity,
  AlertTriangle,
  BarChart3,
  Settings,
  Hospital,
  BookLock,
  User,
  Receipt,
  Building2,
  ClipboardList,
  Clock,
  UserCheck,
  Heart,
  Syringe,
  CreditCard,
  Users2,
  Video,
  Command,
  Pill,
  FlaskConical,
  Scissors,
  ShieldAlert,
  Bed,
  Wrench,
  Award,
  Globe,
  Network,
  Search,
  FileText,
  GitBranch,
  MapPin,
  Layers,
  Fingerprint,
  Code2,
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
import { RoleSwitcher } from "./RoleSwitcher";
import { getCurrentUser, type AuthUser } from "@/lib/auth";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const patientNav: Item[] = [
  { title: "Home", url: "/patient", icon: Home },
  { title: "My Profile", url: "/patient/profile", icon: User },
  { title: "Inpatient Care", url: "/patient/inpatient", icon: Activity },
  { title: "Billing", url: "/patient/billing", icon: Receipt },
  { title: "Medical Records", url: "/patient/records", icon: ClipboardList },
  { title: "My QR Code", url: "/patient/qr", icon: QrCode },
  { title: "Appointments", url: "/patient/appointments", icon: CalendarDays },
  { title: "Credentials", url: "/patient/wallet", icon: Wallet },
  { title: "Consent", url: "/patient/consent", icon: ShieldCheck },
  { title: "Access History", url: "/patient/history", icon: History },
  { title: "Emergency", url: "/patient/emergency", icon: Heart },
  { title: "Vaccines", url: "/patient/vaccines", icon: Syringe },
  { title: "Insurance", url: "/patient/insurance", icon: CreditCard },
  { title: "Family", url: "/patient/family", icon: Users2 },
  { title: "Telemedicine", url: "/patient/telemedicine", icon: Video },
  { title: "ZK Proof", url: "/patient/zkproof", icon: Fingerprint },
];

const staffNav: Item[] = [
  { title: "Dashboard", url: "/staff", icon: LayoutDashboard },
  { title: "Command Center", url: "/staff/command", icon: Command },
  { title: "Doctor Locator", url: "/staff/tracker", icon: MapPin },
  { title: "Room Check-In", url: "/staff/rooms", icon: Building2 },
  { title: "My Profile", url: "/staff/profile", icon: User },
  { title: "My Attendance", url: "/staff/attendance", icon: Clock },
  { title: "Verify Patient", url: "/staff/verify", icon: ScanLine },
  { title: "Patients", url: "/staff/patients", icon: Users },
  { title: "Schedule", url: "/staff/schedule", icon: Calendar },
  { title: "Sign & Prescribe", url: "/staff/sign", icon: FileSignature },
  { title: "Prescriptions", url: "/staff/prescriptions", icon: Pill },
  { title: "Labs", url: "/staff/labs", icon: FlaskConical },
  { title: "Surgeries", url: "/staff/surgeries", icon: Scissors },
  { title: "Emergency", url: "/staff/emergency", icon: ShieldAlert },
];

const adminNav: Item[] = [
  { title: "Admin Portal Hub", url: "/admin", icon: LayoutDashboard },
  { title: "DID Registry", url: "/did-explorer", icon: Search },
  { title: "Verifiable Credentials", url: "/credential-explorer", icon: Award },
  { title: "Security & Audit Trail", url: "/audit-timeline", icon: GitBranch },
  { title: "Hospital Command Center", url: "/staff/command", icon: Command },
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

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    setUser(getCurrentUser());
  }, [pathname]);

  const currentPortal: "patient" | "staff" | "admin" = pathname.startsWith("/patient")
    ? "patient"
    : pathname.startsWith("/staff")
      ? "staff"
      : pathname.startsWith("/admin") || pathname === "/did-explorer" || pathname === "/credential-explorer" || pathname === "/audit-timeline"
        ? "admin"
        : (user?.role as any) || "patient";

  const isPatientUser = user?.role === "patient";
  const isStaffUser = user?.role === "staff";
  const isAdminUser = user?.role === "admin";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Hospital className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-semibold">Embrace Health Grid</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Infrastructure
              </div>
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
        {(currentPortal === "patient" || isPatientUser) && <NavGroup label="Patient Portal" items={patientNav} />}
        {(currentPortal === "staff" || isStaffUser || isAdminUser) && <NavGroup label="Doctor & Staff Portal" items={staffNav} />}
        {(currentPortal === "admin" || isAdminUser) && <NavGroup label="Admin Portal" items={adminNav} />}

        <NavGroup label="Network" items={globalNav} />

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
