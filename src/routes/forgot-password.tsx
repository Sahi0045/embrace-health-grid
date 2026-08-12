import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Hospital,
  Lock,
  ShieldCheck,
  Mail,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestPasswordReset } from "@/lib/auth.server";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password — Embrace Health Grid" },
      { name: "description", content: "Reset your password for Embrace Health Grid Platform" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);

    try {
      await requestPasswordReset({ data: { email } });
      setIsSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to request password reset";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background relative overflow-hidden selection:bg-primary/20 selection:text-primary">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute top-0 left-1/4 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px] dark:bg-primary/20" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 translate-y-1/2 h-[450px] w-[450px] rounded-full bg-chart-2/10 blur-[120px] dark:bg-chart-2/20" />

      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-gradient-to-br from-primary via-primary/95 to-primary/80 p-12 text-primary-foreground relative overflow-hidden shadow-2xl">
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md border border-white/20 shadow-inner">
              <Hospital className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">Embrace Health Grid</div>
              <div className="text-xs font-medium uppercase tracking-widest opacity-80">
                Healthcare Identity Infrastructure
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium backdrop-blur-md border border-white/15 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Secure Credential Recovery</span>
          </div>
          <h2 className="font-display text-4xl lg:text-5xl font-extrabold leading-[1.15] tracking-[-0.03em]">
            Identity Safety.
            <br />
            Seamless Account
            <br />
            Recovery.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed opacity-85">
            Request a password reset link issued directly to your registered healthcare identity
            email address.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 max-w-md">
            <div className="rounded-xl bg-white/10 p-3.5 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Lock className="h-4 w-4 text-emerald-300" />
                <span>256-Bit Token</span>
              </div>
              <p className="mt-1 text-[11px] opacity-70">
                Single-use cryptographically signed link
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-3.5 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span>HIPAA Compliant</span>
              </div>
              <p className="mt-1 text-[11px] opacity-70">Strict zero-leak identity verification</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs opacity-60 flex items-center justify-between">
          <span>&copy; 2026 Embrace Health Grid.</span>
          <span>v2.4 Multi-Tenant Active</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-6 text-center lg:text-left">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors group mb-4"
              >
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                Back to Sign In
              </Link>
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
                Forgot Password?
              </h1>
              <p className="mt-1.5 text-xs text-muted-foreground">
                No worries. Enter your registered email address below to receive recovery
                instructions.
              </p>
            </div>

            <Card className="border-border/60 shadow-clinical-xl bg-card/85 backdrop-blur-xl relative overflow-hidden rounded-2xl">
              <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

              <CardHeader className="pb-4 pt-6">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Account Recovery</CardTitle>
                    <CardDescription className="text-xs">
                      Instant single-use password reset dispatch
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-6">
                <AnimatePresence mode="wait">
                  {isSubmitted ? (
                    <motion.div
                      key="success-state"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-5 py-3 text-center"
                    >
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
                        <CheckCircle2 className="h-7 w-7" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-base font-semibold text-foreground">
                          Check Your Inbox
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed px-2">
                          If an account registered to{" "}
                          <strong className="text-foreground">{email}</strong> exists, a
                          cryptographically signed recovery link has been dispatched.
                        </p>
                      </div>

                      <div className="rounded-xl border border-border/50 bg-muted/40 p-3.5 text-left text-xs space-y-1.5">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
                          <span>Didn&apos;t receive the email?</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-normal pl-6">
                          Check your spam or junk folder, or verify if the email entered matches
                          your hospital account profile.
                        </p>
                      </div>

                      <div className="pt-2 flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsSubmitted(false)}
                          className="flex-1 text-xs"
                        >
                          Try Another Email
                        </Button>
                        <Link to="/login" className="flex-1">
                          <Button className="w-full text-xs gap-1.5 shadow-clinical">
                            Return to Login
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form-state"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleSubmit}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-medium text-foreground">
                          Registered Email Address
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="e.g. dr.smith@seed.test"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 h-11 bg-background/60 border-border/70 focus-visible:ring-primary/30 text-sm"
                            required
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="pt-2 space-y-3">
                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="w-full h-11 text-sm font-semibold shadow-clinical transition-all duration-300 hover:shadow-clinical-md"
                        >
                          {isLoading ? (
                            <span className="flex items-center gap-2">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              Generating Link...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              Send Recovery Link
                              <ArrowRight className="h-4 w-4" />
                            </span>
                          )}
                        </Button>
                      </div>

                      <div className="pt-2 text-center">
                        <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                          <Lock className="h-3 w-3 text-muted-foreground/70" />
                          Single-use cryptographically signed token valid for 60 minutes
                        </p>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
