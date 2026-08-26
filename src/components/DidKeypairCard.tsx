import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

/**
 * The signed-in user's DID keypair — public and private.
 *
 * One component for every role that holds an embedded key: patient, doctor,
 * staff and admin. Super-admins deliberately have none — they are the platform
 * operator, a small technical population, and use an external wallet, so this
 * renders an explanatory empty state for them rather than an error.
 *
 * Nothing here decides who may see what. `getMyKeypair` resolves which DIDs
 * belong to auth.uid() on the server and refuses anything else, so a component
 * dropped on the wrong page still cannot leak another person's key.
 */
export function DidKeypairCard({ did }: { did?: string }) {
  const [keypair, setKeypair] = useState<{
    did: string;
    publicKey: string;
    secretKeyBase58: string;
    secretKeyArray: number[];
  } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getMyKeypair } = await import("@/lib/api");
        const kp = await getMyKeypair(did);
        if (!cancelled) setKeypair(kp);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load your key");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [did]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <CardTitle>Signing Key</CardTitle>
        </div>
        <CardDescription>
          The keypair for your DID. You hold both halves — import the private key into any Solana
          wallet to use this identity outside this app.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          // Most often this is a super-admin, who has no embedded key by design.
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : keypair ? (
          <>
            <div>
              <div className="text-sm text-muted-foreground">Public key</div>
              <div className="mt-1 break-all font-mono text-xs font-medium">
                {keypair.publicKey}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">Private key</div>
              <Button
                size="sm"
                variant={showSecret ? "outline" : "default"}
                onClick={() => setShowSecret((v) => !v)}
              >
                {showSecret ? "Hide" : "Reveal"}
              </Button>
            </div>

            {showSecret && (
              <div className="space-y-2">
                <div className="break-all rounded-md border border-destructive/30 bg-destructive/5 p-2 font-mono text-xs">
                  {keypair.secretKeyBase58}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(keypair.secretKeyBase58);
                      toast.success("Private key copied");
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Byte-array form is what solana-keygen and the CLI read;
                      // the base58 string above is what Phantom imports.
                      const blob = new Blob([JSON.stringify(keypair.secretKeyArray)], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${keypair.did.replace(/:/g, "_")}-keypair.json`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download keypair.json
                  </Button>
                </div>
                <p className="text-[11px] text-destructive">
                  Anyone holding this key can act as you. Store it somewhere only you can reach, and
                  never paste it into a site or message.
                </p>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
