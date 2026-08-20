import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { useState, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  Building2,
  Award,
  Shield,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
  FileText,
  ExternalLink,
  Briefcase,
  MapPin,
  IdCard,
} from "lucide-react";
import { toast } from "sonner";
import { getCertificationsByStaffDid } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { useTableRefresh } from "@/hooks/use-realtime";

export const Route = createFileRoute("/staff/profile")({
  head: () => ({ meta: [{ title: "My Profile — Staff Portal" }] }),
  component: StaffProfilePage,
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

const STATUS_CONFIG = {
  active: { label: "Active", color: "text-success", bg: "bg-success/10", icon: CheckCircle2 },
  expired: { label: "Expired", color: "text-muted-foreground", bg: "bg-muted", icon: Clock },
  revoked: { label: "Revoked", color: "text-destructive", bg: "bg-destructive/10", icon: X },
  pending: {
    label: "Pending Verification",
    color: "text-warning",
    bg: "bg-warning/10",
    icon: AlertTriangle,
  },
};

function StaffProfilePage() {
  const { user: currentUser } = useCurrentUser();
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    verified: 0,
    expiringSoon: 0,
  });

  const userDid = currentUser?.did || currentUser?.primaryDid || "";
  const userName = currentUser?.name || "Staff Member";
  const userEmail = currentUser?.email || "";
  const userRole = currentUser?.role || "staff";
  const userPhone = currentUser?.phone || "+91 11-2345-6789";

  const loadCertifications = async () => {
    if (!userDid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getCertificationsByStaffDid(userDid);
      const certs = res.certifications || [];
      setCertifications(certs);

      // Calculate stats
      const now = new Date();
      const twoMonthsFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      setStats({
        total: certs.length,
        active: certs.filter((c: Certification) => c.status === "active").length,
        verified: certs.filter((c: Certification) => c.verified_by_admin).length,
        expiringSoon: certs.filter(
          (c: Certification) =>
            c.expiry_date && new Date(c.expiry_date) < twoMonthsFromNow && c.status === "active",
        ).length,
      });
    } catch (err: any) {
      toast.error("Failed to load certifications", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertifications();
  }, [userDid]);

  // Real-time updates
  useTableRefresh("staff_certifications", loadCertifications);

  return (
    <RouteGuard requiredRole="staff">
      <PageHeader
        eyebrow="Staff Portal"
        title="My Profile"
        description="Your professional profile, credentials, and verified certifications"
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <StaggerList className="space-y-6">
          {/* Profile Card */}
          <StaggerItem>
            <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/50 p-6 shadow-clinical-md">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                {/* Avatar */}
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <User className="h-12 w-12" />
                </div>

                {/* Info */}
                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">{userName}</h2>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      <span className="capitalize font-medium">{userRole}</span>
                      {currentUser?.department && (
                        <>
                          <span>·</span>
                          <span>{currentUser.department}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Email</div>
                        <div className="font-medium text-foreground">{userEmail}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Phone className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Phone</div>
                        <div className="font-medium text-foreground">{userPhone}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Hospital</div>
                        <div className="font-medium text-foreground">
                          {currentUser?.hospitalName || "Embrace Health Grid"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <IdCard className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">DID</div>
                        <div className="font-mono text-xs font-medium text-foreground">
                          {userDid.slice(0, 20)}...
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* Certification Stats */}
          <StaggerItem>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Total Certifications",
                  value: stats.total,
                  icon: Award,
                  color: "text-primary",
                  bg: "bg-primary/10",
                },
                {
                  label: "Active",
                  value: stats.active,
                  icon: CheckCircle2,
                  color: "text-success",
                  bg: "bg-success/10",
                },
                {
                  label: "Admin Verified",
                  value: stats.verified,
                  icon: Shield,
                  color: "text-chart-2",
                  bg: "bg-chart-2/10",
                },
                {
                  label: "Expiring Soon",
                  value: stats.expiringSoon,
                  icon: AlertTriangle,
                  color: "text-warning",
                  bg: "bg-warning/10",
                },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {stat.label}
                      </span>
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${stat.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${stat.color}`} />
                      </div>
                    </div>
                    <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                  </div>
                );
              })}
            </div>
          </StaggerItem>

          {/* Certifications Section */}
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-6 shadow-clinical">
              <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                    <Award className="h-5 w-5 text-primary" />
                    My Certifications & Qualifications
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Professional credentials verified by hospital administration
                  </p>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {stats.total} Total
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Loading certifications...
                </div>
              ) : certifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
                  <Award className="mb-3 h-12 w-12 text-muted-foreground/30" />
                  <div className="text-sm font-semibold text-foreground">
                    No certifications yet
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Contact your administrator to add your professional certifications
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {certifications.map((cert) => {
                    const statusConfig =
                      STATUS_CONFIG[cert.status as keyof typeof STATUS_CONFIG] ||
                      STATUS_CONFIG.active;
                    const StatusIcon = statusConfig.icon;
                    const isExpiringSoon =
                      cert.expiry_date &&
                      new Date(cert.expiry_date) <
                        new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

                    return (
                      <motion.div
                        key={cert.cert_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
                      >
                        {/* Header */}
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                              <Award className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-foreground">
                                {cert.cert_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {cert.issuing_body}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="mb-3 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusConfig.color} ${statusConfig.bg}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </span>
                          {cert.verified_by_admin && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Admin Verified
                            </span>
                          )}
                          {cert.cert_type && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {cert.cert_type}
                            </span>
                          )}
                        </div>

                        {/* Certificate Number */}
                        {cert.cert_number && (
                          <div className="mb-3 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                            <div className="text-[9px] font-bold uppercase text-muted-foreground">
                              Certificate Number
                            </div>
                            <div className="font-mono font-medium text-foreground">
                              {cert.cert_number}
                            </div>
                          </div>
                        )}

                        {/* Dates */}
                        {(cert.issue_date || cert.expiry_date) && (
                          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
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

                        {/* Notes */}
                        {cert.notes && (
                          <div className="mb-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs">
                            <div className="text-[9px] font-bold uppercase text-muted-foreground mb-1">
                              Notes
                            </div>
                            <div className="text-muted-foreground">{cert.notes}</div>
                          </div>
                        )}

                        {/* Links */}
                        {(cert.document_url || cert.verification_url) && (
                          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                            {cert.document_url && (
                              <a
                                href={cert.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                View Document
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                            {cert.verification_url && (
                              <a
                                href={cert.verification_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
                              >
                                <Shield className="h-3.5 w-3.5" />
                                Verify Online
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </StaggerItem>

          {/* Contact Admin Notice */}
          {!loading && certifications.length === 0 && (
            <StaggerItem>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <div className="font-semibold text-foreground">
                      Need to add your certifications?
                    </div>
                    <div className="text-muted-foreground">
                      Contact your hospital administrator to upload and verify your professional
                      credentials. Once verified, they will appear here linked to your DID.
                    </div>
                  </div>
                </div>
              </div>
            </StaggerItem>
          )}
        </StaggerList>
      </div>
    </RouteGuard>
  );
}
