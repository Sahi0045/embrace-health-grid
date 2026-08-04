import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { User, Stethoscope, ShieldCheck, ArrowRight, Hospital } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn } from "@/lib/auth.server";
import { useCurrentUser } from "@/lib/auth-context";
import { toast } from "sonner";

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
    color: "from-primary/10",
  },
  {
    id: "staff" as Role,
    label: "Doctor & Staff Portal",
    icon: Stethoscope,
    description: "Room check-in, live doctor locator, e-prescriptions, labs & surgeries",
    color: "from-chart-2/15",
  },
  {
    id: "admin" as Role,
    label: "Admin Portal",
    icon: ShieldCheck,
    description: "Consortium governance, DID approval queue, credentials & audit trail",
    color: "from-chart-4/15",
  },
];

function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useCurrentUser();
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
    admin: ["admin"],
  };

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

      const allowed = PORTAL_ALLOWED_ROLES[selectedRole] ?? [];
      if (!allowed.includes(res.user.role)) {
        // Signed in successfully but chose the wrong portal.
        toast.error(`This account is not a ${selectedRole} account.`);
        return;
      }

      // Populate the auth context from the server-verified session.
      await refresh();

      toast.success(`Welcome back, ${res.user.fullName}!`);

      const dest = res.user.role === "doctor" ? "staff" : res.user.role;
      navigate({ to: `/${dest}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4">
      <div className="w-full max-w-5xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Hospital className="h-4 w-4" />
            Embrace Health Grid
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Welcome Back
          </h1>
          <p className="mt-2 text-muted-foreground">Select your role and sign in to continue</p>
        </div>

        {!selectedRole ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-left shadow-clinical transition-all hover:-translate-y-1 hover:shadow-clinical-md"
                >
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${role.color} to-transparent opacity-60`}
                  />
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-foreground">{role.label}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{role.description}</p>
                    <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Continue{" "}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <Card className="mx-auto max-w-md">
            <CardHeader>
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
                        <CardTitle>
                          {isSignup ? "Sign up as" : "Sign in as"} {role?.label}
                        </CardTitle>
                        <CardDescription>{role?.description}</CardDescription>
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
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {!isSignup && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1.5 border">
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
                            Email: <strong className="text-foreground">dr.smith@seed.test</strong>
                          </span>
                          <span>
                            Pass: <strong className="text-foreground">SeedPassw0rd!dev</strong>
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-full text-xs mt-1 bg-background"
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
                            <strong className="text-foreground">alice.patient@seed.test</strong>
                          </span>
                          <span>
                            Pass: <strong className="text-foreground">SeedPassw0rd!dev</strong>
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-full text-xs mt-1 bg-background"
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
                            Email: <strong className="text-foreground">admin@seed.test</strong>
                          </span>
                          <span>
                            Pass: <strong className="text-foreground">SeedPassw0rd!dev</strong>
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-full text-xs mt-1 bg-background"
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
                  <Button type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? "Processing..." : isSignup ? "Register" : "Sign in"}
                  </Button>
                </div>
                <div className="text-center mt-4 text-sm">
                  {isSignup ? (
                    <p className="text-muted-foreground">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setIsSignup(false)}
                        className="text-primary hover:underline font-medium"
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
        )}
      </div>
    </div>
  );
}
