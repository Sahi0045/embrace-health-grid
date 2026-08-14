import { useState } from "react";
import { FileText, Calendar, User, Shield, Hash, Check, Copy } from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

interface MedicalHistoryTabProps {
  records: any[];
}

function truncateMiddle(str: string, start = 10, end = 8): string {
  if (!str || str.length <= start + end) return str;
  return `${str.slice(0, start)}...${str.slice(-end)}`;
}

export function MedicalHistoryTab({ records }: MedicalHistoryTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyHash = (hash: string, recordId: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedId(recordId);
    toast.success("Content hash copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!records || records.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No Medical Records Found"
        description="This patient has no recorded clinical notes or medical history files."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Clinical Notes & History ({records.length})
      </div>

      <div className="space-y-3">
        {records.map((record) => (
          <GlowCard key={record.record_id} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                  <FileText className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                    {record.title || "Clinical Summary"}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase">
                      {record.record_type || "General"}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {record.created_at
                        ? new Date(record.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {record.content_hash && (
                <div className="flex items-center gap-1 text-[10px] font-extrabold text-success bg-success/10 border border-success/30 px-2 py-1 rounded-lg">
                  <Shield className="h-3 w-3" />
                  Anchored On-Chain
                </div>
              )}
            </div>

            <p className="text-xs font-medium text-muted-foreground leading-relaxed bg-background/60 p-3.5 rounded-xl border border-border/60">
              {record.content || "No detailed notes provided."}
            </p>

            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground pt-2 border-t border-border/40">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" />
                <span>
                  Author:{" "}
                  <strong className="text-foreground">
                    {record.author_name || "Staff Clinician"}
                  </strong>
                </span>
              </div>
              {record.content_hash && (
                <div className="flex items-center gap-1.5 font-mono text-[11px] bg-background/50 px-2 py-0.5 rounded-md border border-border/40 text-muted-foreground">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  <span className="text-foreground/80 font-medium">
                    {truncateMiddle(record.content_hash, 10, 8)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyHash(record.content_hash, record.record_id)}
                    className="p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors"
                    title="Copy Content Hash"
                  >
                    {copiedId === record.record_id ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </GlowCard>
        ))}
      </div>
    </div>
  );
}
