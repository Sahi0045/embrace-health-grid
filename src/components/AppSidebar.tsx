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
  { title: "Overview", url: "/admin", icon: LayoutDashboard },
  { title: "Command Center", url: "/admin/command", icon: Command },
  { title: "Digital Twin", url: "/admin/digital-twin", icon: Network },
  { title: "Financials", url: "/admin/financial", icon: Receipt },
  { title: "Hyperledger Console", url: "/admin/hyperledger", icon: Layers },
  { title: "Chaincode", url: "/admin/chaincode", icon: Code2 },
  { title: "My Profile", url: "/admin/profile", icon: User },
  { title: "Infrastructure", url: "/admin/infrastructure", icon: Building2 },
  { title: "Resources", url: "/admin/resources", icon: Bed },
  { title: "People", url: "/admin/people", icon: Users },
  { title: "Attendance", url: "/admin/attendance", icon: UserCheck },
  { title: "DID Management", url: "/admin/dids", icon: KeyRound },
  { title: "Credentials", url: "/admin/credentials", icon: Award },
  { title: "Policies", url: "/admin/policies", icon: BookLock },
  { title: "Audit Logs", url: "/admin/audit", icon: Activity },
  { title: "Fraud Detection", url: "/admin/fraud", icon: AlertTriangle },
  { title: "Compliance", url: "/admin/compliance", icon: BarChart3 },
  { title: "Federation", url: "/admin/federation", icon: Globe },
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

  const role: "patient" | "staff" | "admin" | null = pathname.startsWith("/patient")
    ? "patient"
    : pathname.startsWith("/staff")
      ? "staff"
      : pathname.startsWith("/admin")
        ? "admin"
        : null;

  const canSeePatient = user?.role === "admin" || user?.role === "patient";
  const canSeeStaff = user?.role === "admin" || user?.role === "staff";
  const canSeeAdmin = user?.role === "admin";

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
        {canSeePatient && role === "patient" && <NavGroup label="Patient App" items={patientNav} />}
        {canSeeStaff && role === "staff" && <NavGroup label="Staff Portal" items={staffNav} />}
        {canSeeAdmin && role === "admin" && <NavGroup label="Admin Console" items={adminNav} />}

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
