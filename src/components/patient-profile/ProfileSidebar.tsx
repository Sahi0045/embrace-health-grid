import { useState } from "react";
import {
  User,
  Shield,
  Phone,
  Mail,
  FileText,
  Activity,
  LogOut,
  ExternalLink,
  Calendar,
  MapPin,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProfileSidebarProps {
  did: any;
  profile: any;
  admissions: any[];
  billing: any;
  insurancePolicy: any;
  onOpenDischarge: () => void;
}

export function ProfileSidebar({
  did,
  profile,
  admissions,
  billing,
  insurancePolicy,
  onOpenDischarge,
}: ProfileSidebarProps) {
  const [copiedDid, setCopiedDid] = useState(false);

  const activeAdmission = admissions?.find((a) => a.status === "admitted");
  const name = did?.owner_name || profile?.full_name || "Patient Profile";
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const patientDid = did?.did || "N/A";
  const mrn = did?.claims?.mrn || `MRN-${patientDid.slice(-6).toUpperCase()}`;

  const handleCopyDid = () => {
    if (!patientDid || patientDid === "N/A") return;
    navigator.clipboard.writeText(patientDid);
    setCopiedDid(true);
    toast.success("Patient DID copied to clipboard");
    setTimeout(() => setCopiedDid(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Main Profile Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-clinical space-y-6">
        {/* Header Avatar & Name */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-blue-600/10 text-primary font-display font-extrabold text-2xl shadow-inner border border-primary/20">
              {initials}
            </div>
            <span
              className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card ${
                activeAdmission ? "bg-success animate-pulse" : "bg-muted-foreground/40"
              }`}
            />
          </div>

          <div>
            <h2 className="font-display font-extrabold text-xl text-foreground tracking-tight">
              {name}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase">
                {mrn}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                  activeAdmission
                    ? "bg-success/10 text-success border-success/30"
                    : "bg-muted/40 text-muted-foreground border-border/80"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    activeAdmission ? "bg-success" : "bg-muted-foreground"
                  }`}
                />
                {activeAdmission ? "Inpatient (Admitted)" : "Outpatient / Inactive"}
              </span>
            </div>
          </div>
        </div>

        {/* DID Box with Copy Icon */}
        <div className="space-y-1.5">
          <div className="border-l-2 border-primary/30 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Decentralized ID (DID)
          </div>
          <div className="font-mono text-[11px] font-bold text-foreground bg-background p-2.5 rounded-xl border border-border/60 shadow-xs flex items-center justify-between gap-2">
            <span className="break-all flex-1">{patientDid}</span>
            <button
              type="button"
              onClick={handleCopyDid}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Copy DID"
            >
              {copiedDid ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Quick Stats Metric Group */}
        <div className="flex items-center divide-x divide-border/60 rounded-xl border border-border/70 bg-background/80 py-2.5 px-1 shadow-xs">
          <div className="px-3 text-center flex-1">
            <div className="text-lg font-extrabold font-display text-foreground">34</div>
            <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mt-0.5">
              Age
            </div>
          </div>
          <div className="px-3 text-center flex-1">
            <div className="text-lg font-extrabold font-display text-foreground">O+</div>
            <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mt-0.5">
              Blood
            </div>
          </div>
          <div className="px-3 text-center flex-1">
            <div className="text-lg font-extrabold font-display text-primary">
              ${billing?.outstanding ? Number(billing.outstanding).toLocaleString() : "0"}
            </div>
            <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mt-0.5">
              Due
            </div>
          </div>
        </div>

        {/* Active Admission Details (if any) */}
        {activeAdmission && (
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-foreground">Current Room / Bed</span>
              </div>
              <span className="text-[10px] font-extrabold uppercase bg-primary text-primary-foreground px-2 py-0.5 rounded-md">
                Active
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                  Ward
                </span>
                <span className="font-extrabold text-foreground">
                  {activeAdmission.ward || "General"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                  Bed
                </span>
                <span className="font-extrabold text-primary">
                  {activeAdmission.bed || "B-101"}
                </span>
              </div>
            </div>
            {activeAdmission.admitting_doctor && (
              <div className="text-xs pt-1 border-t border-primary/20">
                <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                  Attending Doctor
                </span>
                <span className="font-bold text-foreground">
                  {activeAdmission.admitting_doctor}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-border/60">
          {activeAdmission && (
            <Button
              onClick={onOpenDischarge}
              className="w-full bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold rounded-xl shadow-clinical-md shadow-primary/25 h-10 text-xs"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Process Patient Checkout / Discharge
            </Button>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl text-xs font-bold shadow-xs hover:bg-accent h-9"
              onClick={() =>
                window.open(`/did-explorer?did=${encodeURIComponent(patientDid)}`, "_blank")
              }
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              DID Explorer
            </Button>
          </div>
        </div>
      </div>

      {/* Insurance Quick Summary Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-clinical space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="font-display font-extrabold text-sm text-foreground tracking-tight">
            Insurance Coverage
          </h3>
        </div>
        {insurancePolicy ? (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Provider:</span>
              <span className="font-bold text-foreground">{insurancePolicy.provider || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Policy #:</span>
              <span className="font-mono font-bold text-foreground">
                {insurancePolicy.policy_number || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Coverage:</span>
              <span className="font-extrabold text-success">
                {insurancePolicy.coverage_percentage || 80}%
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground font-medium italic">
            No primary insurance policy registered on file.
          </p>
        )}
      </div>
    </div>
  );
}
