import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { credentials } from "@/lib/mock-data";
import { BadgeCheck, CircleAlert } from "lucide-react";

export const Route = createFileRoute("/patient/wallet")({
  head: () => ({ meta: [{ title: "Patient · Credentials Wallet — DID Hospital" }] }),
  component: Wallet,
});

function Wallet() {
  return (
    <PhoneFrame title="Wallet">
      <div className="space-y-3 p-5">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Verifiable credentials</div>
          <div className="text-lg font-semibold text-foreground">{credentials.length} stored</div>
        </div>

        {credentials.map((c) => {
          const expired = c.status === "expired";
          return (
            <div
              key={c.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-clinical"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">{c.type}</div>
                  <div className="text-xs text-muted-foreground">Issued by {c.issuer}</div>
                </div>
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    expired
                      ? "bg-destructive/10 text-destructive"
                      : "bg-success/15 text-success",
                  ].join(" ")}
                >
                  {expired ? <CircleAlert className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
                  {expired ? "Expired" : "Active"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-muted-foreground">Issued</div>
                  <div className="font-medium text-foreground">{c.issuedAt}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Expires</div>
                  <div className="font-medium text-foreground">{c.expiresAt}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PhoneFrame>
  );
}
