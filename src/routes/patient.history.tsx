import { createFileRoute } from "@tanstack/react-router";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { accessHistory } from "@/lib/mock-data";
import { Eye, FileSignature, Download, PencilLine, History as HistoryIcon } from "lucide-react";

export const Route = createFileRoute("/patient/history")({
  head: () => ({ meta: [{ title: "Patient · Access history — DID Hospital" }] }),
  component: History,
});

const iconFor = {
  viewed: Eye,
  signed: FileSignature,
  exported: Download,
  updated: PencilLine,
} as const;

function History() {
  return (
    <RouteGuard requiredRole="patient">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Patient app"
          title="Access History"
          description="Recent activity on your health records — last 7 days"
        />

        <div className="mt-6">
          {accessHistory.length === 0 ? (
            <EmptyState icon={HistoryIcon} title="Nothing here yet" description="Activity will appear when clinicians access your records." />
          ) : (
            <StaggerList>
              <ol className="relative space-y-4 border-l border-border pl-6">
                {accessHistory.map((e) => {
                  const Icon = iconFor[e.action];
                  return (
                    <StaggerItem key={e.id}>
                      <li className="relative">
                        <span className="absolute -left-[30px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-primary">
                          <Icon className="h-3 w-3" />
                        </span>
                        <div className="font-medium text-foreground">
                          {e.actor} <span className="font-normal text-muted-foreground">{e.action}</span>
                        </div>
                        <div className="text-sm text-foreground">{e.resource}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {e.actorRole} · {e.at}
                        </div>
                      </li>
                    </StaggerItem>
                  );
                })}
              </ol>
            </StaggerList>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
