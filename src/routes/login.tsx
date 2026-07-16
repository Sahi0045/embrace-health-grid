import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { User, Stethoscope, ShieldCheck, ArrowRight, Hospital } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { login, signup } from "@/lib/api";
import { setSession } from "@/lib/auth";
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
    label: "Patient",
    icon: User,
    description: "Access your health records and appointments",
    color: "from-primary/10",
  },
  {
    id: "staff" as Role,
    label: "Staff",
    icon: Stethoscope,
    description: "Clinician portal for patient care",
    color: "from-chart-2/15",
  },
  {
    id: "admin" as Role,
    label: "Admin",
    icon: ShieldCheck,
    description: "System administration and oversight",
    color: "from-chart-4/15",
  },
];

function LoginPage() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    setIsLoading(true);

    try {
      if (isSignup) {
        if (!name.trim()) {
          toast.error("Name is required for registration");
          setIsLoading(false);
          return;
        }
        if (password.length < 8) {
          toast.error("Password must be at least 8 characters long");
          setIsLoading(false);
          return;
        }
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        if (!hasNumber || !hasSpecial) {
          toast.error("Password must contain at least one number and one special character");
          setIsLoading(false);
          return;
        }
        const signupRes = await signup({ name, email, role: selectedRole, password });
        if (signupRes.success && signupRes.user) {
          setSession(signupRes.token, signupRes.user);
          toast.success(`Welcome, ${signupRes.user.name}! Account created.`);
          navigate({ to: `/${signupRes.user.role}` });
        }
      } else {
        const res = await login({ email, password });
        if (res.success && res.user) {
          setSession(res.token, res.user);
          toast.success(`Welcome back, ${res.user.name}!`);
          navigate({ to: `/${res.user.role}` });
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
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
                    <p className="text-muted-foreground">
                      Don't have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setIsSignup(true)}
                        className="text-primary hover:underline font-medium"
                      >
                        Sign up
                      </button>
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
