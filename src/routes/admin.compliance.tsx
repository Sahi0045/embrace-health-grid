import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, Download, AlertCircle, Clock, Shield, FileText,
  TrendingUp, RefreshCw, ExternalLink, ChevronDown, ChevronRight,
  Lock, Eye, Trash2, Share2, Users, Database
} from "lucide-react";
import { stagger, fadeUp } from "@/components/Motion";

export const Route = createFileRoute("/admin/compliance")({
  head: () => ({ meta: [{ title: "Admin · Compliance — DID Hospital" }] }),
  component: CompliancePage,
});

type ControlStatus = "compliant" | "partial" | "non-compliant" | "not-applicable";

interface Control {
  id: string;
  name: string;
  status: ControlStatus;
  description: string;
  lastChecked: string;
  evidence?: string;
}

interface Framework {
  name: string;
  fullName: string;
  score: number;
  status: "compliant" | "partial" | "at-risk";
  lastAudit: string;
  nextReview: string;
  certBody: string;
  controls: Control[];
  color: string;
  bgColor: string;
}

const frameworks: Framework[] = [
  {
    name: "HIPAA", fullName: "Health Insurance Portability & Accountability Act",
    score: 98, status: "compliant", lastAudit: "2026-05-01", nextReview: "2026-11-01",
    certBody: "KPMG Healthcare Assurance", color: "text-success", bgColor: "bg-success/10",
    controls: [
      { id: "h1", name: "Encryption at Rest (AES-256)", status: "compliant", description: "All PHI stored with AES-256 encryption", lastChecked: "2026-06-01", evidence: "Encryption audit report Q2-2026" },
      { id: "h2", name: "Access Controls & RBAC", status: "compliant", description: "Role-based access enforced via DID credentials", lastChecked: "2026-06-01", evidence: "DID RBAC attestation" },
      { id: "h3", name: "Audit Logging", status: "compliant", description: "Immutable audit logs on Hyperledger Fabric", lastChecked: "2026-06-01", evidence: "Blockchain audit trail" },
      { id: "h4", name: "Breach Notification (72h)", status: "compliant", description: "Automated breach detection and notification workflow", lastChecked: "2026-05-15", evidence: "Incident response test #IR-22" },
      { id: "h5", name: "Business Associate Agreements", status: "compliant", description: "All third-party BAAs signed and current", lastChecked: "2026-04-20" },
      { id: "h6", name: "Minimum Necessary Standard", status: "partial", description: "Data access scope review in progress for lab module", lastChecked: "2026-05-28" },
    ]
  },
  {
    name: "GDPR", fullName: "General Data Protection Regulation (EU 2016/679)",
    score: 95, status: "compliant", lastAudit: "2026-04-15", nextReview: "2026-10-15",
    certBody: "BSI Group", color: "text-primary", bgColor: "bg-primary/10",
    controls: [
      { id: "g1", name: "Lawful Basis for Processing", status: "compliant", description: "Consent captured via verifiable credentials", lastChecked: "2026-06-01" },
      { id: "g2", name: "Right to Erasure (Article 17)", status: "compliant", description: "Data deletion workflow with credential revocation", lastChecked: "2026-05-20" },
      { id: "g3", name: "Data Portability (Article 20)", status: "compliant", description: "Patient DID wallet enables portable health records", lastChecked: "2026-05-20" },
      { id: "g4", name: "DPO Appointment", status: "compliant", description: "DPO: Ms. Ananya Reddy · dpo@didhospital.in", lastChecked: "2026-01-01" },
      { id: "g5", name: "Cross-Border Transfer Safeguards", status: "partial", description: "SCCs under review for federation with EU hospitals", lastChecked: "2026-05-01" },
      { id: "g6", name: "Privacy by Design", status: "compliant", description: "DID architecture ensures minimal data disclosure", lastChecked: "2026-04-15" },
    ]
  },
  {
    name: "DPDP", fullName: "Digital Personal Data Protection Act 2023 (India)",
    score: 97, status: "compliant", lastAudit: "2026-03-10", nextReview: "2026-09-10",
    certBody: "Deloitte India", color: "text-chart-4", bgColor: "bg-chart-4/10",
    controls: [
      { id: "d1", name: "Purpose Limitation", status: "compliant", description: "Consent credentials specify exact data processing purpose", lastChecked: "2026-06-01" },
      { id: "d2", name: "Consent Receipts", status: "compliant", description: "Machine-readable consent VCs issued to patients", lastChecked: "2026-06-01" },
      { id: "d3", name: "Grievance Officer Appointment", status: "compliant", description: "GO: Mr. Sandeep Iyer · grievance@didhospital.in", lastChecked: "2026-01-15" },
      { id: "d4", name: "Data Localisation", status: "compliant", description: "All patient data stored on India-region servers", lastChecked: "2026-05-10" },
      { id: "d5", name: "Children's Data Protections", status: "compliant", description: "Guardian consent mandatory for minor patients", lastChecked: "2026-04-20" },
      { id: "d6", name: "Data Fiduciary Registration", status: "compliant", description: "Registered as Significant Data Fiduciary with MeitY", lastChecked: "2026-02-01" },
    ]
  },
  {
    name: "ISO 27001", fullName: "Information Security Management System",
    score: 91, status: "partial", lastAudit: "2026-02-20", nextReview: "2026-08-20",
    certBody: "Bureau Veritas", color: "text-chart-2", bgColor: "bg-chart-2/10",
    controls: [
      { id: "i1", name: "Risk Assessment (Annex A.6)", status: "compliant", description: "Annual risk assessment completed Feb 2026", lastChecked: "2026-02-20" },
      { id: "i2", name: "Incident Response (Annex A.16)", status: "compliant", description: "SOC with 24/7 monitoring and playbooks defined", lastChecked: "2026-03-01" },
      { id: "i3", name: "Supplier Security (Annex A.15)", status: "partial", description: "3 of 12 suppliers pending security questionnaire", lastChecked: "2026-05-15" },
      { id: "i4", name: "Physical Security (Annex A.11)", status: "compliant", description: "Server rooms with biometric access and CCTV", lastChecked: "2026-04-10" },
      { id: "i5", name: "Cryptography Policy (Annex A.10)", status: "compliant", description: "Ed25519 for DID, AES-256 for storage, TLS 1.3", lastChecked: "2026-05-01" },
      { id: "i6", name: "Business Continuity (Annex A.17)", status: "partial", description: "DR plan tested — RTO target of 4h not yet achieved (current: 6.5h)", lastChecked: "2026-04-30" },
    ]
  },
];

const statusConfig: Record<ControlStatus, { icon: React.ComponentType<{className?: string}>; color: string; label: string }> = {
  "compliant":       { icon: CheckCircle2, color: "text-success", label: "Compliant" },
  "partial":         { icon: AlertCircle,  color: "text-warning-foreground", label: "Partial" },
  "non-compliant":   { icon: AlertCircle,  color: "text-destructive", label: "Non-Compliant" },
  "not-applicable":  { icon: Clock,        color: "text-muted-foreground", label: "N/A" },
};

function FrameworkCard({ fw }: { fw: Framework }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div variants={fadeUp} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${fw.bgColor} ${fw.color}`}>
            {fw.name}
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{fw.fullName}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Certified by {fw.certBody}</div>
            <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Last audit: {fw.lastAudit}</span>
              <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />Review: {fw.nextReview}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`text-3xl font-bold ${fw.color}`}>{fw.score}<span className="text-base font-normal text-muted-foreground">/100</span></div>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${fw.status === "compliant" ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground"}`}>
            {fw.status}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="px-5 pb-3">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <motion.div
            className={`h-full rounded-full ${fw.score >= 95 ? "bg-success" : fw.score >= 80 ? "bg-primary" : "bg-warning"}`}
            initial={{ width: 0 }} animate={{ width: `${fw.score}%` }} transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Control summary */}
      <div className="border-t border-border/60 px-5 py-3 flex items-center justify-between">
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1 text-success">
            <CheckCircle2 className="h-3 w-3" />
            {fw.controls.filter(c => c.status === "compliant").length} compliant
          </span>
          <span className="flex items-center gap-1 text-warning-foreground">
            <AlertCircle className="h-3 w-3" />
            {fw.controls.filter(c => c.status === "partial").length} partial
          </span>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-primary hover:underline">
          {expanded ? "Hide" : "View"} controls
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      </div>

      {/* Controls detail */}
      {expanded && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-border/60">
          {fw.controls.map((ctrl, idx) => {
            const cfg = statusConfig[ctrl.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={ctrl.id} className={`flex items-start gap-3 px-5 py-3 ${idx % 2 === 0 ? "bg-muted/20" : ""}`}>
                <StatusIcon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{ctrl.name}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cfg.color} bg-current/10`}>{cfg.label}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{ctrl.description}</div>
                  {ctrl.evidence && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-primary">
                      <FileText className="h-3 w-3" />{ctrl.evidence}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">{ctrl.lastChecked}</div>
              </div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}

const overallScore = Math.round(frameworks.reduce((s, f) => s + f.score, 0) / frameworks.length);

const quickStats = [
  { label: "Overall Score", value: `${overallScore}/100`, icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
  { label: "Frameworks", value: `${frameworks.length} Active`, icon: Shield, color: "text-primary", bg: "bg-primary/10" },
  { label: "Controls Passing", value: `${frameworks.flatMap(f => f.controls).filter(c => c.status === "compliant").length}/${frameworks.flatMap(f => f.controls).length}`, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  { label: "Open Findings", value: `${frameworks.flatMap(f => f.controls).filter(c => c.status === "partial").length}`, icon: AlertCircle, color: "text-warning-foreground", bg: "bg-warning/10" },
];

function CompliancePage() {
  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Regulatory Readiness"
        description="Live compliance scoring against HIPAA, GDPR, India DPDP Act, and ISO 27001. All controls verified via DID audit trail."
        actions={
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
              <ExternalLink className="h-4 w-4" /> Share Report
            </button>
            <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Download className="h-4 w-4" /> Download PDF
            </button>
          </div>
        }
      />

      <div className="space-y-6 p-6 sm:p-8">
        {/* Stats */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickStats.map(s => {
            const Icon = s.icon;
            return (
              <motion.div key={s.label} variants={fadeUp} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</span>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.bg}`}>
                    <Icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                </div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Data practices summary */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Lock, label: "Encryption", val: "AES-256 + TLS 1.3 + Ed25519 DID", color: "text-primary" },
            { icon: Eye, label: "Access Audit", val: "100% of accesses logged on Hyperledger", color: "text-chart-2" },
            { icon: Users, label: "Consent", val: "Verifiable Credentials — machine-readable", color: "text-success" },
            { icon: Database, label: "Data Residency", val: "India region only (Mumbai AZ)", color: "text-chart-4" },
            { icon: Trash2, label: "Data Deletion", val: "Right-to-erasure within 72 hours", color: "text-destructive" },
            { icon: Share2, label: "Federation", val: "Cross-hospital sharing with SCCs", color: "text-chart-3" },
          ].map(p => {
            const Icon = p.icon;
            return (
              <div key={p.label} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted ${p.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{p.label}</div>
                  <div className="mt-0.5 text-sm text-foreground">{p.val}</div>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Frameworks */}
        <div>
          <div className="mb-4 text-sm font-semibold text-foreground">Compliance Frameworks</div>
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
            {frameworks.map(fw => <FrameworkCard key={fw.name} fw={fw} />)}
          </motion.div>
        </div>
      </div>
    </>
  );
}
