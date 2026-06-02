import { createFileRoute } from "@tanstack/react-router";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { credentials } from "@/lib/mock-data";
import { BadgeCheck, CircleAlert, Wallet as WalletIcon } from "lucide-react";
import { RouteGuard } from "@/components/RouteGuard";

export const Route = createFileRoute("/patient/wallet")({
  head: () => ({ meta: [{ title: "Patient · Credentials Wallet — DID Hospital" }] }),
  component: Wallet,
});

function Wallet() {
  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Patient app"
          title="Credentials Wallet"
          description={`${credentials.length} verifiable credentials stored`}
        />

        <div className="mt-6">
          {credentials.length === 0 ? (
            <EmptyState icon={WalletIcon} title="No credentials yet" description="Your hospital will issue verifiable credentials here." />
          ) : (
            <StaggerList className="grid gap-3 sm:grid-cols-2">
              {credentials.map((c) => {
                const expired = c.status === "expired";
                return (
                  <StaggerItem key={c.id}>
                    <div className="rounded-2xl border border-border bg-card p-4 shadow-clinical transition-shadow hover:shadow-clinical-md">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-foreground">{c.type}</div>
                          <div className="text-sm text-muted-foreground">Issued by {c.issuer}</div>
                        </div>
                        <span className={[
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          expired ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success",
                        ].join(" ")}>
                          {expired ? <CircleAlert className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
                          {expired ? "Expired" : "Active"}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs">Issued</div>
                          <div className="font-medium">{c.issuedAt}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Expires</div>
                          <div className="font-medium">{c.expiresAt}</div>
                        </div>
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
