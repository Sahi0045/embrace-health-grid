import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User, Stethoscope, ShieldCheck, ArrowRight, Hospital, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn } from "@/lib/auth.server";
import { useCurrentUser } from "@/lib/auth-context";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Whether to show the seeded demo logins on the sign-in form.
 *
 * These are real, working credentials for a live deployment, so they must be
 * switched off before the app holds real PHI. Defaults to VISIBLE so the demo
 * keeps working, and is disabled by setting VITE_HIDE_DEMO_CREDENTIALS=true —
 * an opt-out rather than gating on import.meta.env.DEV, which would silently
 * break the deployed demo.
 */
const SHOW_DEMO_CREDENTIALS = import.meta.env.VITE_HIDE_DEMO_CREDENTIALS !== "true";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Embrace Health Grid" },
      { name: "description", content: "Login to Embrace Health Grid Platform" },
    ],
  }),
  component: LoginPage,
});

type Role = "patient" | "staff" | "admin";

const roles = [
  {
    id: "patient" as Role,
    label: "Patient Portal",
    icon: User,
    description: "Access personal health records, appointments, QR identity & telemedicine",
    color: "from-primary/20",
  },
  {
    id: "staff" as Role,
    label: "Doctor & Staff Portal",
    icon: Stethoscope,
    description: "Room check-in, live doctor locator, e-prescriptions, labs & surgeries",
    color: "from-chart-2/20",
  },
  {
    id: "admin" as Role,
    label: "Admin Portal",
    icon: ShieldCheck,
    description: "Consortium governance, DID approval queue, credentials & audit trail",
    color: "from-chart-4/20",
  },
];

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, refresh } = useCurrentUser();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Which roles may enter each portal. The database is the authority on a
   * user's role — this check only stops someone landing in the wrong UI, and
   * RLS still governs what data they can actually read.
   */
  const PORTAL_ALLOWED_ROLES: Record<string, string[]> = {
    patient: ["patient"],
    staff: ["staff", "doctor"],
    // super_admin signs in through the admin portal: there is no separate
    // platform login, and omitting it here authenticated the account and then
    // rejected it with "This account is not a admin account."
    admin: ["admin", "super_admin"],
  };

  /**
   * Send an already-authenticated visitor to their portal.
   *
   * /login previously rendered the form regardless of session, so anyone with a
   * valid cookie who navigated or refreshed here saw a sign-in prompt while
   * already signed in — and had to pick a portal tile again to get anywhere.
   */
  useEffect(() => {
    if (loading || !user) return;
    const LANDING: Record<string, string> = {
      patient: "/patient",
      doctor: "/staff",
      staff: "/staff",
      admin: "/admin",
      super_admin: "/super",
    };
    navigate({ to: LANDING[user.role] ?? "/patient" });
  }, [loading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    setIsLoading(true);

    try {
      if (isSignup) {
        // Self-service signup is disabled: accounts are provisioned by an
        // administrator so that role, DID and credentials are issued together.
        toast.error("Registration is handled by your administrator. Please sign in.");
        setIsSignup(false);
        return;
      }

      const res = await signIn({ data: { email, password } });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      // Where each role belongs. A super_admin has no /super_admin page — the
      // platform console is /super — so this must be a map rather than `/${role}`.
      const LANDING: Record<string, string> = {
        patient: "/patient",
        doctor: "/staff",
        staff: "/staff",
        admin: "/admin",
        super_admin: "/super",
      };

      const destination = LANDING[res.user.role] ?? "/patient";

      // The credentials were valid but the wrong portal tile was chosen.
      //
      // Do NOT bail here. signIn() has already set the session cookie, so
      // returning early left the user authenticated while showing an error —
      // which is why refreshing the page appeared to "fix" it and dropped them
      // into a portal they had not chosen.
      //
      // Since we know who they are and where they belong, send them there and say
      // so. Rejecting a correct password because of a mis-clicked tile is a
      // pointless obstacle: the tile is a convenience, and RouteGuard plus RLS
      // are what actually enforce access.
      const allowed = PORTAL_ALLOWED_ROLES[selectedRole] ?? [];
      const wrongPortal = !allowed.includes(res.user.role);

      // Populate the auth context from the server-verified session.
      await refresh();

      if (wrongPortal) {
        toast.success(`Welcome back, ${res.user.fullName}`, {
          description: `Signed in as ${res.user.role.replace("_", " ")} — taking you to your portal.`,
        });
      } else {
        toast.success(`Welcome back, ${res.user.fullName}!`);
      }

      navigate({ to: destination });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-12 text-primary-foreground relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Hospital className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">Embrace Health Grid</div>
              <div className="text-xs font-medium uppercase tracking-widest opacity-70">
                Healthcare Identity Infrastructure
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <h2 className="font-display text-4xl font-bold leading-tight tracking-[-0.02em]">
            One identity.
            <br />
            Every healthcare
            <br />
            touchpoint.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed opacity-80">
            Secure, verifiable, and decentralized healthcare identity management for patients,
            doctors, and administrators.
          </p>
          <div className="mt-8 flex items-center gap-4 text-xs opacity-60">
            <div className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              End-to-end encrypted
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              HIPAA compliant
            </div>
          </div>
        </div>

        <div className="relative text-xs opacity-50">
          &copy; 2026 Embrace Health Grid. All rights reserved.
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {!selectedRole ? (
              <motion.div
                key="role-picker"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="mb-8 text-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass-bg px-4 py-2 text-sm font-medium text-primary backdrop-blur">
                    <Hospital className="h-4 w-4" />
                    Embrace Health Grid
                  </div>
                  <h1 className="mt-4 font-display text-3xl font-bold tracking-[-0.02em] text-foreground">
                    Welcome Back
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Select your role and sign in to continue
                  </p>
                </div>

                <div className="space-y-3">
                  {roles.map((role, i) => {
                    const Icon = role.icon;
                    return (
                      <motion.button
                        key={role.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.1 + i * 0.06,
                          duration: 0.4,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        onClick={() => setSelectedRole(role.id)}
                        className="group relative flex w-full items-center gap-4 overflow-hidden rounded-xl border border-border bg-card p-4 text-left shadow-clinical transition-all duration-300 hover:-translate-y-0.5 hover:shadow-clinical-md hover:border-primary/30"
                      >
                        <div
                          className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${role.color} to-transparent opacity-40`}
                        />
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="relative flex-1">
                          <div className="text-sm font-semibold text-foreground">{role.label}</div>
                          <div className="text-xs text-muted-foreground">{role.description}</div>
                        </div>
                        <ArrowRight className="relative h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="sign-in"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card className="border-border/50 shadow-clinical-lg">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const role = roles.find((r) => r.id === selectedRole);
                        const Icon = role?.icon || User;
                        return (
                          <>
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">
                                {isSignup ? "Sign up as" : "Sign in as"} {role?.label}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                {role?.description}
                              </CardDescription>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {isSignup && (
                        <div className="space-y-2">
                          <Label htmlFor="name">Full Name</Label>
                          <Input
                            id="name"
                            type="text"
                            placeholder="Enter your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">Password</Label>
                          {!isSignup && (
                            <Link
                              to="/forgot-password"
                              className="text-xs text-muted-foreground hover:text-primary transition-colors"
                            >
                              Forgot your password?
                            </Link>
                          )}
                        </div>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      {!isSignup && SHOW_DEMO_CREDENTIALS && (
                        <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs space-y-1.5">
                          <div className="font-semibold text-foreground flex items-center justify-between">
                            <span>Demo Credentials</span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              Click to auto-fill
                            </span>
                          </div>
                          {selectedRole === "staff" && (
                            <>
                              <div className="flex justify-between text-muted-foreground">
                                <span>
                                  Email:{" "}
                                  <strong className="text-foreground">dr.smith@seed.test</strong>
                                </span>
                                <span>
                                  Pass:{" "}
                                  <strong className="text-foreground">SeedPassw0rd!dev</strong>
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 w-full text-xs mt-1"
                                onClick={() => {
                                  setEmail("dr.smith@seed.test");
                                  setPassword("SeedPassw0rd!dev");
                                }}
                              >
                                Auto-fill Doctor Credentials
                              </Button>
                            </>
                          )}
                          {selectedRole === "patient" && (
                            <>
                              <div className="flex justify-between text-muted-foreground">
                                <span>
                                  Email:{" "}
                                  <strong className="text-foreground">
                                    alice.patient@seed.test
                                  </strong>
                                </span>
                                <span>
                                  Pass:{" "}
                                  <strong className="text-foreground">SeedPassw0rd!dev</strong>
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 w-full text-xs mt-1"
                                onClick={() => {
                                  setEmail("alice.patient@seed.test");
                                  setPassword("SeedPassw0rd!dev");
                                }}
                              >
                                Auto-fill Patient Credentials
                              </Button>
                            </>
                          )}
                          {selectedRole === "admin" && (
                            <>
                              <div className="flex justify-between text-muted-foreground">
                                <span>
                                  Email:{" "}
                                  <strong className="text-foreground">admin@seed.test</strong>
                                </span>
                                <span>
                                  Pass:{" "}
                                  <strong className="text-foreground">SeedPassw0rd!dev</strong>
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 w-full text-xs mt-1"
                                onClick={() => {
                                  setEmail("admin@seed.test");
                                  setPassword("SeedPassw0rd!dev");
                                }}
                              >
                                Auto-fill Admin Credentials
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setSelectedRole(null);
                            setIsSignup(false);
                          }}
                          className="flex-1"
                        >
                          Back
                        </Button>
                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="flex-1 shadow-clinical"
                        >
                          {isLoading ? "Processing..." : isSignup ? "Register" : "Sign in"}
                        </Button>
                      </div>
                      <div className="text-center text-sm">
                        {isSignup ? (
                          <p className="text-muted-foreground">
                            Already have an account?{" "}
                            <button
                              type="button"
                              onClick={() => setIsSignup(false)}
                              className="font-medium text-primary hover:underline"
                            >
                              Sign in
                            </button>
                          </p>
                        ) : (
                          // Self-service registration is intentionally unavailable:
                          // an account needs a role, a DID and issued credentials
                          // provisioned together, so an administrator creates it.
                          <p className="text-muted-foreground">
                            Need an account? Contact your administrator.
                          </p>
                        )}
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
