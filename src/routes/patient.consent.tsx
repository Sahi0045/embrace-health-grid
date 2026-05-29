import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { consents as initial } from "@/lib/mock-data";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Check, X, Clock } from "lucide-react";

export const Route = createFileRoute("/patient/consent")({
  head: () => ({ meta: [{ title: "Patient · Consent — DID Hospital" }] }),
  component: Consent,
});

function Consent() {
  const [list, setList] = useState(initial);

  const toggle = (id: string) => {
    setList((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: c.status === "active" ? "revoked" : "active" }
          : c,
      ),
    );
    const c = list.find((x) => x.id === id);
    toast(c?.status === "active" ? `Access revoked from ${c.requester}` : `Access granted to ${c?.requester}`);
  };

  const decide = (id: string, approve: boolean) => {
    setList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: approve ? "active" : "revoked" } : c)),
    );
    toast(approve ? "Consent approved" : "Consent denied");
  };

  return (
    <PhoneFrame title="Consent">
      <div className="space-y-4 p-5">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Who can access my records</div>
          <div className="text-lg font-semibold text-foreground">You're in control</div>
        </div>

        {list.map((c) => {
          const status = c.status;
          return (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-clinical">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">{c.requester}</div>
                  <div className="text-xs text-muted-foreground">{c.requesterRole}</div>
                </div>
                <StatusPill status={status} />
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                <span className="text-foreground">Reason:</span> {c.reason}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Granted {c.grantedAt} · expires {c.expiresAt}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                {status === "pending" ? (
                  <div className="flex w-full gap-2">
                    <button
                      onClick={() => decide(c.id, false)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" /> Deny
                    </button>
                    <button
                      onClick={() => decide(c.id, true)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {status === "active" ? "Access enabled" : "Access blocked"}
                    </span>
                    <Switch checked={status === "active"} onCheckedChange={() => toggle(c.id)} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PhoneFrame>
  );
}

function StatusPill({ status }: { status: "active" | "pending" | "revoked" }) {
  if (status === "active")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
        <Check className="h-3 w-3" /> Active
      </span>
    );
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-medium text-warning-foreground">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <X className="h-3 w-3" /> Revoked
    </span>
  );
}
