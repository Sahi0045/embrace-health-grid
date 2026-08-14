import { useState } from "react";
import { FileText, Shield, Award, Hash, ExternalLink, Calendar, Copy, Check } from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

interface DocumentsTabProps {
  credentials: any[];
  medicalRecords: any[];
  vaccines: any[];
}

function truncateMiddle(str: string, start = 10, end = 8): string {
  if (!str || str.length <= start + end) return str;
  return `${str.slice(0, start)}...${str.slice(-end)}`;
}

export function DocumentsTab({ credentials, medicalRecords, vaccines }: DocumentsTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopySig = (sig: string, docId: string) => {
    navigator.clipboard.writeText(sig);
    setCopiedId(docId);
    toast.success("Signature copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const docs = [
    ...(credentials || []).map((c) => ({
      id: c.id,
      title: c.credential_type || "Verifiable Credential",
      category: "Credential",
      issuer: c.issuer,
      date: c.issued_at,
      hash: c.signature,
    })),
    ...(vaccines || []).map((v) => ({
      id: v.vaccine_id,
      title: `Vaccine Cert: ${v.vaccine_name}`,
      category: "Immunization",
      issuer: v.administered_by || "Health Department",
      date: v.administered_on,
      hash: v.batch_number,
    })),
  ];

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={Award}
        title="No Verifiable Documents"
        description="No on-chain credentials, digital certificates, or signed documents found."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Signed Digital Credentials & Documents ({docs.length})
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {docs.map((doc) => (
          <GlowCard key={doc.id} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                  <Award className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm text-foreground tracking-tight line-clamp-1">
                    {doc.title}
                  </h3>
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase mt-1">
                    {doc.category}
                  </span>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/30 px-2 py-0.5 text-[10px] font-extrabold text-success uppercase shrink-0">
                <Shield className="h-2.5 w-2.5" />
                Signed VC
              </span>
            </div>

            <div className="text-xs space-y-1 bg-background/60 p-3 rounded-xl border border-border/60">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Issuer:</span>
                <span className="font-bold text-foreground truncate max-w-[150px]">
                  {doc.issuer || "Hospital Grid"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium text-foreground">
                  {doc.date ? new Date(doc.date).toLocaleDateString() : "N/A"}
                </span>
              </div>
            </div>

            {doc.hash && (
              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground bg-background/50 px-2.5 py-1.5 rounded-lg border border-border/40">
                <span className="font-medium text-muted-foreground flex-1 mr-2 truncate">
                  Sig: <span className="text-foreground/80">{truncateMiddle(doc.hash, 10, 8)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopySig(doc.hash, doc.id)}
                  className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors shrink-0"
                  title="Copy Signature"
                >
                  {copiedId === doc.id ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </GlowCard>
        ))}
      </div>
    </div>
  );
}
