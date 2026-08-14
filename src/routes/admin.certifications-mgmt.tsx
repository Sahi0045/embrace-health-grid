import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { useState, useEffect, useCallback } from "react";
import {
  Award,
  Search,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Calendar,
  Building2,
  User,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Eye,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCertifications,
  getCertificationsByStaffDid,
  createCertification,
  updateCertification,
  deleteCertification,
  getCertificationStats,
  getCertificationAuditLog,
} from "@/lib/api";
import { getAllDIDs } from "@/lib/clinical.server";
import { useTableRefresh } from "@/hooks/use-realtime";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/certifications-mgmt")({
  head: () => ({
    meta: [{ title: "Admin · Certifications Management — Embrace Health Grid" }],
  }),
  component: AdminCertificationsManagementPageGuarded,
});

interface Certification {
  cert_id: string;
  staff_did: string;
  hospital_id: string;
  cert_name: string;
  cert_type: string | null;
  issuing_body: string;
  issue_date: string | null;
  expiry_date: string | null;
  cert_number: string | null;
  status: string;
  document_url: string | null;
  verification_url: string | null;
  verified_by_admin: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface StaffDID {
  did: string;
  owner_name: string;
  owner_type: string;
  status: string;
}

const STATUS_CONFIG = {
  active: { label: "Active", color: "text-success", bg: "bg-success/10", icon: CheckCircle2 },
  expired: { label: "Expired", color: "text-muted-foreground", bg: "bg-muted", icon: Clock },
  revoked: { label: "Revoked", color: "text-destructive", bg: "bg-destructive/10", icon: X },
  pending: { label: "Pending", color: "text-warning", bg: "bg-warning/10", icon: AlertTriangle },
};

function AdminCertificationsManagementPage() {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [staffDIDs, setStaffDIDs] = useState<StaffDID[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [staffFilter, setStaffFilter] = useState("All");

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    staffDid: "",
    certName: "",
    certType: "",
    issuingBody: "",
    issueDate: "",
    expiryDate: "",
    certNumber: "",
    status: "active",
    documentUrl: "",
    verificationUrl: "",
    verifiedByAdmin: false,
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [certsRes, didsRes, statsRes] = await Promise.all([
        getCertifications(),
        getAllDIDs(),
        getCertificationStats().catch(() => ({ stats: null, expiringSoon: [] })),
      ]);

      setCertifications(certsRes.certifications || []);

      // Filter to staff/doctor DIDs only
      const staffDids = (didsRes.dids || []).filter(
        (d: any) => d.owner_type === "doctor" || d.owner_type === "staff",
      );
      setStaffDIDs(staffDids);
      setStats(statsRes.stats);
    } catch (err: any) {
      toast.error("Could not load certifications", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time updates
  useTableRefresh("staff_certifications", load);

  // Get staff name from DID
  const getStaffName = (did: string) => {
    const staff = staffDIDs.find((s) => s.did === did);
    return staff?.owner_name || did;
  };

  // Filter certifications
  const filteredCerts = certifications.filter((cert) => {
    const q = searchQ.toLowerCase();
    const matchQ =
      !q ||
      cert.cert_name.toLowerCase().includes(q) ||
      cert.issuing_body.toLowerCase().includes(q) ||
      getStaffName(cert.staff_did).toLowerCase().includes(q) ||
      cert.cert_number?.toLowerCase().includes(q);

    const matchStatus = statusFilter === "All" || cert.status === statusFilter.toLowerCase();
    const matchStaff = staffFilter === "All" || cert.staff_did === staffFilter;

    return matchQ && matchStatus && matchStaff;
  });

  // Reset form
  const resetForm = () => {
    setForm({
      staffDid: "",
      certName: "",
      certType: "",
      issuingBody: "",
      issueDate: "",
      expiryDate: "",
      certNumber: "",
      status: "active",
      documentUrl: "",
      verificationUrl: "",
      verifiedByAdmin: false,
      notes: "",
    });
  };

  // Open add modal
  const handleAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  // Open edit modal
  const handleEdit = (cert: Certification) => {
    setEditingCert(cert);
    setForm({
      staffDid: cert.staff_did,
      certName: cert.cert_name,
      certType: cert.cert_type || "",
      issuingBody: cert.issuing_body,
      issueDate: cert.issue_date || "",
      expiryDate: cert.expiry_date || "",
      certNumber: cert.cert_number || "",
      status: cert.status,
      documentUrl: cert.document_url || "",
      verificationUrl: cert.verification_url || "",
      verifiedByAdmin: cert.verified_by_admin,
      notes: cert.notes || "",
    });
    setIsEditOpen(true);
  };

  // Save new certification
  const handleSaveNew = async () => {
    if (!form.staffDid || !form.certName || !form.issuingBody) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      await createCertification({
        staffDid: form.staffDid,
        certName: form.certName,
        certType: form.certType || undefined,
        issuingBody: form.issuingBody,
        issueDate: form.issueDate || undefined,
        expiryDate: form.expiryDate || undefined,
        certNumber: form.certNumber || undefined,
        status: form.status || undefined,
        documentUrl: form.documentUrl || undefined,
        verificationUrl: form.verificationUrl || undefined,
        verifiedByAdmin: form.verifiedByAdmin,
        notes: form.notes || undefined,
      });

      toast.success("Certification created successfully", {
        description: `Added ${form.certName} for ${getStaffName(form.staffDid)}`,
      });

      setIsAddOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      toast.error("Failed to create certification", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Save certification updates
  const handleSaveEdit = async () => {
    if (!editingCert) return;

    setIsSaving(true);
    try {
      await updateCertification(editingCert.cert_id, {
        certName: form.certName,
        certType: form.certType || undefined,
        issuingBody: form.issuingBody,
        issueDate: form.issueDate || undefined,
        expiryDate: form.expiryDate || undefined,
        certNumber: form.certNumber || undefined,
        status: form.status,
        documentUrl: form.documentUrl || undefined,
        verificationUrl: form.verificationUrl || undefined,
        verifiedByAdmin: form.verifiedByAdmin,
        notes: form.notes || undefined,
      });

      toast.success("Certification updated successfully");
      setIsEditOpen(false);
      setEditingCert(null);
      load();
    } catch (err: any) {
      toast.error("Failed to update certification", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete certification
  const handleDelete = async (cert: Certification) => {
    if (
      !confirm(`Are you sure you want to delete "${cert.cert_name}"? This action cannot be undone.`)
    ) {
      return;
    }

    try {
      await deleteCertification(cert.cert_id);
      toast.success("Certification deleted successfully");
      load();
    } catch (err: any) {
      toast.error("Failed to delete certification", { description: err.message });
    }
  };

  // View audit log
  const handleViewAudit = async (cert: Certification) => {
    try {
      const res = await getCertificationAuditLog(cert.cert_id);
      setAuditLogs(res.auditLogs || []);
      setEditingCert(cert);
      setIsAuditOpen(true);
    } catch (err: any) {
      toast.error("Failed to load audit log", { description: err.message });
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between border-b border-border pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
            Admin Console
          </div>
          <h1 className="text-2xl font-bold text-foreground">Certifications & Qualifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage staff certifications linked to verified DIDs with comprehensive audit trails.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Certification
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-3 text-center">
          {[
            { label: "Total", value: stats.total, cls: "text-primary" },
            { label: "Active", value: stats.active, cls: "text-success" },
            { label: "Expired", value: stats.expired, cls: "text-muted-foreground" },
            { label: "Revoked", value: stats.revoked, cls: "text-destructive" },
            { label: "Pending", value: stats.pending, cls: "text-warning" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card p-3 shadow-clinical"
            >
              <div className={`text-2xl font-black ${s.cls}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search certifications, staff, issuer..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold outline-none"
        >
          {["All", "Active", "Expired", "Revoked", "Pending"].map((s) => (
            <option key={s} value={s}>
              Status: {s}
            </option>
          ))}
        </select>
        <select
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold outline-none max-w-[200px]"
        >
          <option value="All">Staff: All</option>
          {staffDIDs.map((s) => (
            <option key={s.did} value={s.did}>
              {s.owner_name}
            </option>
          ))}
        </select>
      </div>

      {/* Certifications List */}
      {loading ? (
        <div className="flex justify-center py-12 text-sm text-muted-foreground gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading certifications...
        </div>
      ) : filteredCerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Award className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <div className="text-sm font-semibold text-foreground">No certifications found</div>
          <div className="text-xs text-muted-foreground mt-1">
            {searchQ || statusFilter !== "All" || staffFilter !== "All"
              ? "No results match your filters."
              : "Click 'Add Certification' to create the first one."}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredCerts.map((cert) => {
            const statusConfig =
              STATUS_CONFIG[cert.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.active;
            const StatusIcon = statusConfig.icon;
            const isExpiringSoon =
              cert.expiry_date &&
              new Date(cert.expiry_date) < new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

            return (
              <div
                key={cert.cert_id}
                className="rounded-xl border border-border bg-card shadow-clinical overflow-hidden"
              >
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Award className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                          {cert.cert_name}
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusConfig.color} ${statusConfig.bg}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </span>
                          {cert.verified_by_admin && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-medium">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {cert.issuing_body}
                          {cert.cert_number && ` · ${cert.cert_number}`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Staff Info */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="font-medium text-foreground">
                      {getStaffName(cert.staff_did)}
                    </span>
                    <span className="font-mono text-[10px]">{cert.staff_did.slice(0, 20)}...</span>
                  </div>

                  {/* Dates */}
                  {(cert.issue_date || cert.expiry_date) && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {cert.issue_date && (
                        <div className="rounded-lg bg-muted/50 px-3 py-2">
                          <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">
                            Issued
                          </div>
                          <div className="font-medium text-foreground">
                            {new Date(cert.issue_date).toLocaleDateString("en-IN")}
                          </div>
                        </div>
                      )}
                      {cert.expiry_date && (
                        <div
                          className={`rounded-lg px-3 py-2 ${isExpiringSoon ? "bg-warning/10 border border-warning/30" : "bg-muted/50"}`}
                        >
                          <div
                            className={`text-[9px] font-bold uppercase mb-0.5 ${isExpiringSoon ? "text-warning" : "text-muted-foreground"}`}
                          >
                            {isExpiringSoon ? "⚠️ Expires Soon" : "Expires"}
                          </div>
                          <div
                            className={`font-medium ${isExpiringSoon ? "text-warning" : "text-foreground"}`}
                          >
                            {new Date(cert.expiry_date).toLocaleDateString("en-IN")}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Links */}
                  {(cert.document_url || cert.verification_url) && (
                    <div className="flex gap-2 text-xs">
                      {cert.document_url && (
                        <a
                          href={cert.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          Document
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {cert.verification_url && (
                        <a
                          href={cert.verification_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Shield className="h-3 w-3" />
                          Verify
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <button
                      onClick={() => handleEdit(cert)}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-primary/30 bg-primary/10 py-2 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleViewAudit(cert)}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-card py-2 text-xs font-medium hover:bg-muted"
                    >
                      <Eye className="h-3 w-3" />
                      Audit Log
                    </button>
                    <button
                      onClick={() => handleDelete(cert)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={isAddOpen || isEditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setIsEditOpen(false);
            setEditingCert(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isAddOpen ? "Add New Certification" : "Edit Certification"}</DialogTitle>
            <DialogDescription>
              {isAddOpen
                ? "Create a new certification for a staff member. It will be linked to their verified DID."
                : "Update certification details. All changes are logged in the audit trail."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Staff DID Selection (only for new) */}
            {isAddOpen && (
              <div className="space-y-2">
                <Label htmlFor="staffDid" className="text-sm font-semibold">
                  Staff Member *
                </Label>
                <select
                  id="staffDid"
                  value={form.staffDid}
                  onChange={(e) => setForm({ ...form, staffDid: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none"
                  required
                >
                  <option value="">Select staff member...</option>
                  {staffDIDs.map((s) => (
                    <option key={s.did} value={s.did}>
                      {s.owner_name} ({s.owner_type}) - {s.did}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Certification Name */}
            <div className="space-y-2">
              <Label htmlFor="certName" className="text-sm font-semibold">
                Certification Name *
              </Label>
              <Input
                id="certName"
                value={form.certName}
                onChange={(e) => setForm({ ...form, certName: e.target.value })}
                placeholder="e.g., MD Cardiology, MBBS, Medical License"
                required
              />
            </div>

            {/* Type and Issuer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="certType" className="text-sm font-semibold">
                  Type
                </Label>
                <Input
                  id="certType"
                  value={form.certType}
                  onChange={(e) => setForm({ ...form, certType: e.target.value })}
                  placeholder="e.g., Degree, License, Training"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuingBody" className="text-sm font-semibold">
                  Issuing Body *
                </Label>
                <Input
                  id="issuingBody"
                  value={form.issuingBody}
                  onChange={(e) => setForm({ ...form, issuingBody: e.target.value })}
                  placeholder="e.g., AIIMS Delhi"
                  required
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issueDate" className="text-sm font-semibold">
                  Issue Date
                </Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiryDate" className="text-sm font-semibold">
                  Expiry Date
                </Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                />
              </div>
            </div>

            {/* Certificate Number and Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="certNumber" className="text-sm font-semibold">
                  Certificate Number
                </Label>
                <Input
                  id="certNumber"
                  value={form.certNumber}
                  onChange={(e) => setForm({ ...form, certNumber: e.target.value })}
                  placeholder="License/Certificate ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-semibold">
                  Status
                </Label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none"
                >
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="revoked">Revoked</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            {/* URLs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="documentUrl" className="text-sm font-semibold">
                  Document URL
                </Label>
                <Input
                  id="documentUrl"
                  type="url"
                  value={form.documentUrl}
                  onChange={(e) => setForm({ ...form, documentUrl: e.target.value })}
                  placeholder="Link to certificate document"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="verificationUrl" className="text-sm font-semibold">
                  Verification URL
                </Label>
                <Input
                  id="verificationUrl"
                  type="url"
                  value={form.verificationUrl}
                  onChange={(e) => setForm({ ...form, verificationUrl: e.target.value })}
                  placeholder="External verification link"
                />
              </div>
            </div>

            {/* Verified checkbox */}
            <div className="flex items-center gap-2">
              <input
                id="verifiedByAdmin"
                type="checkbox"
                checked={form.verifiedByAdmin}
                onChange={(e) => setForm({ ...form, verifiedByAdmin: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="verifiedByAdmin" className="text-sm cursor-pointer">
                Mark as verified by admin
              </Label>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-semibold">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes or comments..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddOpen(false);
                setIsEditOpen(false);
                setEditingCert(null);
              }}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={isAddOpen ? handleSaveNew : handleSaveEdit}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? "Saving..." : isAddOpen ? "Create Certification" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Log Dialog */}
      <Dialog open={isAuditOpen} onOpenChange={setIsAuditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Trail</DialogTitle>
            <DialogDescription>
              Complete history of changes for {editingCert?.cert_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No audit logs found
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.audit_id}
                  className="rounded-lg border border-border bg-card p-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-foreground capitalize">
                        {log.action.replace(/_/g, " ")}
                        {log.field_changed && ` - ${log.field_changed}`}
                      </div>
                      {log.old_value && log.new_value && (
                        <div className="mt-1 text-muted-foreground">
                          <span className="line-through">{log.old_value}</span>
                          {" → "}
                          <span className="text-foreground font-medium">{log.new_value}</span>
                        </div>
                      )}
                      <div className="mt-1 text-muted-foreground">
                        By: {log.performed_by_name} ({log.performed_by_role})
                      </div>
                    </div>
                    <div className="text-right text-muted-foreground">
                      {new Date(log.logged_at).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAuditOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminCertificationsManagementPageGuarded() {
  return (
    <RouteGuard requiredRole="admin">
      <AdminCertificationsManagementPage />
    </RouteGuard>
  );
}
