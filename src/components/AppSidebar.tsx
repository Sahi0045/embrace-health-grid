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
  LogOut,
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
  UserPlus,
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
import { useCurrentUser } from "@/lib/auth-context";
import { signOut } from "@/lib/auth.server";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

/**
 * Patient portal, grouped by what the patient is trying to do.
 *
 * Was a flat list of 16 items in no discernible order — Billing above Medical
 * Records, ZK Proof next to Telemedicine — which made the important things
 * (records, consent, who accessed my data) hard to find.
 *
 * Four groups, ordered by how often they are needed:
 *   My Health   the clinical record
 *   Care        appointments and treatment
 *   Identity    DID, credentials, proofs — the part that makes this platform
 *               different, so it is grouped rather than scattered
 *   Account     admin and money
 */
const patientHealthNav: Item[] = [
  { title: "Home", url: "/patient", icon: Home },
  { title: "Medical Records", url: "/patient/records", icon: ClipboardList },
  { title: "Vaccines", url: "/patient/vaccines", icon: Syringe },
  { title: "Emergency Info", url: "/patient/emergency", icon: Heart },
];

const patientCareNav: Item[] = [
  { title: "Appointments", url: "/patient/appointments", icon: CalendarDays },
  { title: "Telemedicine", url: "/patient/telemedicine", icon: Video },
  { title: "Inpatient Care", url: "/patient/inpatient", icon: Activity },
];

const patientIdentityNav: Item[] = [
  { title: "My Credentials", url: "/patient/wallet", icon: Wallet },
  { title: "Consent", url: "/patient/consent", icon: ShieldCheck },
  { title: "Access History", url: "/patient/history", icon: History },
  { title: "My QR Code", url: "/patient/qr", icon: QrCode },
  { title: "Private Proofs", url: "/patient/zkproof", icon: Fingerprint },
];

const patientAccountNav: Item[] = [
  { title: "My Profile", url: "/patient/profile", icon: User },
  { title: "Billing", url: "/patient/billing", icon: Receipt },
  { title: "Insurance", url: "/patient/insurance", icon: CreditCard },
  { title: "Family Access", url: "/patient/family", icon: Users2 },
];

const staffNav: Item[] = [
  { title: "Dashboard", url: "/staff", icon: LayoutDashboard },
  { title: "Command Center", url: "/staff/command", icon: Command },
  { title: "Appointments", url: "/staff/appointments", icon: CalendarDays },
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

/**
 * Platform operations. Separate from adminNav because a hospital admin must not
 * see these at all: admitting or suspending a tenant is not a hospital's
 * business. RouteGuard and RLS enforce it; this only avoids offering the link.
 */
const superNav: Item[] = [{ title: "Hospitals", url: "/super/hospitals", icon: Hospital }];

const adminNav: Item[] = [
  { title: "Admin Portal Hub", url: "/admin", icon: LayoutDashboard },
  // Admin console pages, previously only in the standalone portal on :3002.
  // Every one is wrapped in RouteGuard requiredRole="admin"; hiding a link is
  // not access control, so the guard and RLS do the real work.
  { title: "Onboard User", url: "/admin/onboard", icon: UserPlus },
  { title: "DID Management", url: "/admin/dids", icon: Fingerprint },
  { title: "People", url: "/admin/people", icon: Users },
  { title: "Prescriptions", url: "/admin/prescriptions", icon: Pill },
  { title: "NFC Cards", url: "/admin/nfc-cards", icon: CreditCard },
  { title: "Policies", url: "/admin/policies", icon: FileText },
  { title: "Fraud Detection", url: "/admin/fraud", icon: ShieldAlert },
  { title: "Audit Logs", url: "/admin/audit", icon: GitBranch },
  { title: "Financials", url: "/admin/financial", icon: Wallet },
  { title: "Digital Twin", url: "/admin/digital-twin", icon: Activity },
  { title: "Command Center", url: "/admin/command", icon: Command },
  { title: "My Profile", url: "/admin/profile", icon: KeyRound },
  { title: "DID Registry", url: "/did-explorer", icon: Search },
  { title: "Security & Audit Trail", url: "/audit-timeline", icon: GitBranch },
];

/**
 * Registry and oversight tools.
 *
 * NOT shown to patients. These list DIDs, credentials and audit activity across
 * the hospital, which is a staff concern — a patient's own equivalents are
 * Credentials, Consent and Access History in the patient portal.
 *
 * Previously rendered unconditionally, so every patient was offered all three.
 * They also duplicate entries already present in adminNav and superNav.
 */
const networkNav: Item[] = [
  { title: "DID Explorer", url: "/did-explorer", icon: Search },
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

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const { user, loading } = useCurrentUser();
  useEffect(() => {}, [pathname]);

  const currentPortal: "patient" | "staff" | "admin" | "super" = pathname.startsWith("/super")
    ? "super"
    : pathname.startsWith("/patient")
      ? "patient"
      : pathname.startsWith("/staff")
        ? "staff"
        : pathname.startsWith("/admin") ||
            pathname === "/did-explorer" ||
            pathname === "/audit-timeline"
          ? "admin"
          : // A super_admin has no portal of its own to fall back to, so send it to
            // the platform view rather than the patient one.
            user?.role === "super_admin"
            ? "super"
            : (user?.role as any) || "patient";

  // Render nothing until the session is known, and nothing at all when there is
  // no user. currentPortal falls back to "patient" for an absent role, which is
  // why the login page showed a complete patient sidebar to a visitor who had not
  // signed in — every patient route linked, and the role switcher offered.
  //
  // The links were dead ends (RouteGuard redirects), but advertising the whole
  // application surface to an anonymous visitor is not something to leave.
  if (loading || !user) return null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-clinical-sm">
            <Hospital className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Embrace Health Grid</div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
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
        {/*
          Show the nav for the portal actually being viewed, not every portal the
          role could reach. Keying these off isAdminUser meant an admin saw
          "Doctor & Staff Portal" and "Admin Portal" stacked together, which reads
          as one account holding two roles.

          currentPortal is derived from the path and falls back to the user's own
          role, so a clinician still lands on the staff nav.
        */}
        {currentPortal === "patient" && (
          <>
            <NavGroup label="My Health" items={patientHealthNav} />
            <NavGroup label="Care" items={patientCareNav} />
            <NavGroup label="Identity & Privacy" items={patientIdentityNav} />
            <NavGroup label="Account" items={patientAccountNav} />
          </>
        )}
        {currentPortal === "staff" && <NavGroup label="Doctor & Staff Portal" items={staffNav} />}
        {currentPortal === "admin" && <NavGroup label="Admin Portal" items={adminNav} />}
        {currentPortal === "super" && <NavGroup label="Platform" items={superNav} />}

        {/* Staff and above only — see networkNav. */}
        {currentPortal !== "patient" && <NavGroup label="Network" items={networkNav} />}

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
              System
            </SidebarGroupLabel>
          )}
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

              {/*
                Sign out lives here so it exists on every page for every role.
                It previously appeared only on a few profile and dashboard pages,
                so the platform console and most admin pages had no way to end a
                session at all — the only recourse was clearing cookies.

                The session is an httpOnly cookie, so only the server can clear
                it: signOut() must be awaited before navigating, or the cookie
                survives and returning to a portal resumes the session.
              */}
              {user && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      void signOut().finally(() => {
                        window.location.href = "/login";
                      });
                    }}
                    className="flex w-full items-center gap-2 text-destructive hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Sign out</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
