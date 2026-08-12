import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Hospital,
  Lock,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resetPassword } from "@/lib/auth.server";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface SearchParams {
  code?: string;
}

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    code: (search.code as string) || "",
  }),
  head: () => ({
    meta: [
      { title: "Set New Password — Embrace Health Grid" },
      { name: "description", content: "Set a new password for Embrace Health Grid Platform" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { code } = Route.useSearch();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isMinLength = newPassword.length >= 8;
  const isMatching = newPassword !== "" && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code) {
      toast.error("Invalid or missing password reset token");
      return;
    }

    if (!isMinLength) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    if (!isMatching) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const res = await resetPassword({ data: { code, newPassword } });
      if (res.ok) {
        setIsSuccess(true);
        toast.success("Password reset successfully");
        setTimeout(() => {
          navigate({ to: "/login" });
        }, 2000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reset password";
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
            <span>Enhanced Account Protection</span>
          </div>
          <h2 className="font-display text-4xl lg:text-5xl font-extrabold leading-[1.15] tracking-[-0.03em]">
            New Password.
            <br />
            Enhanced Security
            <br />
            Guaranteed.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed opacity-85">
            Set a new password to secure your medical credentials, patient records, and hospital
            portal profile.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 max-w-md">
            <div className="rounded-xl bg-white/10 p-3.5 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Lock className="h-4 w-4 text-emerald-300" />
                <span>Zero-Knowledge</span>
              </div>
              <p className="mt-1 text-[11px] opacity-70">Salted & hashed via Supabase Auth</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3.5 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span>Immediate Invalidation</span>
              </div>
              <p className="mt-1 text-[11px] opacity-70">Old tokens automatically revoked</p>
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
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
                Set New Password
              </h1>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Enter your new account password below to finish recovery.
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
                    <CardTitle className="text-base font-semibold">Password Verification</CardTitle>
                    <CardDescription className="text-xs">
                      Minimum 8 characters with instant match validation
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-6">
                {!code ? (
                  <div className="space-y-4 py-3 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-sm">
                      <AlertCircle className="h-7 w-7" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-semibold text-foreground">
                        Invalid Reset Link
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed px-2">
                        This password reset link is missing a valid security code or has expired.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Link to="/forgot-password">
                        <Button className="w-full text-xs font-semibold shadow-clinical">
                          Request New Reset Link
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : isSuccess ? (
                  <div className="space-y-5 py-3 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-semibold text-foreground">
                        Password Reset Complete
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed px-2">
                        Your password has been updated successfully. Redirecting you to sign in...
                      </p>
                    </div>
                    <div className="pt-2">
                      <Link to="/login">
                        <Button variant="outline" className="w-full text-xs gap-1.5">
                          Go to Sign In
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword" className="text-xs font-medium text-foreground">
                        New Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="newPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder="At least 8 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-10 pr-10 h-11 bg-background/60 border-border/70 focus-visible:ring-primary/30 text-sm"
                          required
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="confirmPassword"
                        className="text-xs font-medium text-foreground"
                      >
                        Confirm New Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder="Re-enter new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10 h-11 bg-background/60 border-border/70 focus-visible:ring-primary/30 text-sm"
                          required
                        />
                      </div>
                    </div>

                    {/* Requirements & Validation pill list */}
                    <div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-xs space-y-2">
                      <div className="flex items-center gap-2 text-[11px]">
                        {isMinLength ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        )}
                        <span
                          className={
                            isMinLength ? "text-foreground font-medium" : "text-muted-foreground"
                          }
                        >
                          At least 8 characters long
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        {isMatching ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        )}
                        <span
                          className={
                            isMatching ? "text-foreground font-medium" : "text-muted-foreground"
                          }
                        >
                          Passwords match
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={isLoading || !isMinLength || !isMatching}
                        className="w-full h-11 text-sm font-semibold shadow-clinical transition-all duration-300 hover:shadow-clinical-md"
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Updating Password...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            Update Password
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
