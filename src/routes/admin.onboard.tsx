import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Fingerprint, Award, CreditCard, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/auth-context";
import { onboardUser } from "@/lib/clinical.server";

export const Route = createFileRoute("/admin/onboard")({
  head: () => ({ meta: [{ title: "Admin · Onboard User — Embrace Health Grid" }] }),
  component: OnboardPageGuarded,
});

type Role = "patient" | "doctor" | "staff" | "admin";

interface OnboardResult {
  userId: string;
  email: string;
  role: string;
  did: string;
  credentialId: string;
  cardId: string | null;
  signature: string;
}

function OnboardPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("patient");
  const [mrn, setMrn] = useState("");
  const [department, setDepartment] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [issueNfcCard, setIssueNfcCard] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OnboardResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Non-admins may only create patients; the server enforces this too.
  const availableRoles: Role[] = isAdmin ? ["patient", "doctor", "staff", "admin"] : ["patient"];

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const reset = () => {
    setEmail("");
    setFullName("");
    setPassword("");
    setMrn("");
    setDepartment("");
    setSpecialty("");
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !fullName.trim() || password.length < 8) {
      toast.error("Name, email and a password of at least 8 characters are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = (await onboardUser({
        data: {
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          role,
          issueNfcCard,
          mrn: mrn.trim() || undefined,
          department: department.trim() || undefined,
          specialty: specialty.trim() || undefined,
        },
      })) as unknown as OnboardResult;

      setResult(res);
      toast.success(`${fullName} onboarded`, {
        description: `DID ${res.did} issued with a signed identity credential.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Onboarding failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <PageHeader
        eyebrow="Identity"
        title="Onboard user"
        description="Creates the account, issues a DID, signs an identity credential, and optionally issues an NFC card — in one step."
      />

      {result ? (
        <Card className="mt-6 border-success/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Check className="h-4 w-4 text-success" />
              {result.email} is ready
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              The account can sign in immediately. Share the password over a secure channel — it is
              not recoverable from here.
            </p>

            {[
              { icon: Fingerprint, label: "DID", value: result.did },
              { icon: Award, label: "Credential", value: result.credentialId },
              ...(result.cardId
                ? [{ icon: CreditCard, label: "NFC card", value: result.cardId }]
                : []),
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </div>
                    <div className="truncate font-mono text-xs">{value}</div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copy(label, value)}
                >
                  {copied === label ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            ))}

            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Credential signature (Ed25519)
              </div>
              <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                {result.signature}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={reset}>Onboard another</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr Sara Smith"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sara.smith@hospital.org"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Initial password</Label>
                <Input
                  id="password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Shown as plain text so you can pass it on. The user should change it after first
                  sign-in.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <div className="flex flex-wrap gap-2">
                  {availableRoles.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`rounded-lg border px-3 py-1.5 text-sm capitalize transition ${
                        role === r
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {!isAdmin && (
                  <p className="text-xs text-muted-foreground">
                    Only an administrator may create staff, doctor or admin accounts.
                  </p>
                )}
              </div>

              {role === "patient" ? (
                <div className="space-y-2">
                  <Label htmlFor="mrn">Medical record number (optional)</Label>
                  <Input
                    id="mrn"
                    value={mrn}
                    onChange={(e) => setMrn(e.target.value)}
                    placeholder="MRN-204871"
                  />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department (optional)</Label>
                    <Input
                      id="department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Cardiology"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="specialty">Specialty (optional)</Label>
                    <Input
                      id="specialty"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      placeholder="Interventional Cardiology"
                    />
                  </div>
                </div>
              )}

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={issueNfcCard}
                  onChange={(e) => setIssueNfcCard(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Also issue an NFC card
              </label>

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="mb-1 font-semibold text-foreground">This will create</div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">Sign-in account</Badge>
                  <Badge variant="outline">Decentralized identifier</Badge>
                  <Badge variant="outline">Signed identity credential</Badge>
                  {issueNfcCard && <Badge variant="outline">NFC card</Badge>}
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                <UserPlus className="mr-2 h-4 w-4" />
                {submitting ? "Onboarding…" : "Onboard user"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Onboarding creates accounts and issues identity, so it is staff-gated. The
 * Edge Function re-checks the role and further restricts which roles each caller
 * may create — the UI cannot be trusted to enforce that.
 */
function OnboardPageGuarded() {
  return (
    <RouteGuard requiredRole="staff">
      <OnboardPage />
    </RouteGuard>
  );
}
