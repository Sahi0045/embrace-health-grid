import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { EmptyState } from "@/components/EmptyState";
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
    <PhoneFrame title="Access history">
      <div className="p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Recent activity</div>
        <div className="text-lg font-semibold text-foreground">Last 7 days</div>

        {accessHistory.length === 0 ? (
          <div className="mt-6">
            <EmptyState icon={HistoryIcon} title="Nothing here yet" description="Activity will appear when clinicians access your records." />
          </div>
        ) : (
          <StaggerList>
            <ol className="relative mt-5 space-y-4 border-l border-border pl-5">
              {accessHistory.map((e) => {
                const Icon = iconFor[e.action];
                return (
                  <StaggerItem key={e.id}>
                    <li className="relative">
                      <span className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-primary">
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="text-sm font-medium text-foreground">
                        {e.actor} <span className="font-normal text-muted-foreground">{e.action}</span>
                      </div>
                      <div className="text-xs text-foreground">{e.resource}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
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
    </PhoneFrame>
  );
}
