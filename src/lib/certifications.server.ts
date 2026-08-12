/**
 * Staff Certifications & Qualifications Server Functions
 *
 * Provides database-driven certification management with:
 * - DID association and verification
 * - Hospital scoping for multi-tenancy
 * - Admin-only write operations
 * - Automatic audit logging via database triggers
 * - Real-time updates via Supabase Realtime
 */

import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";
import { resolveCallerForAudit, tryWriteAudit, buildCertificationAudit } from "./audit.server";

/** Reject unauthenticated callers */
async function requireSession() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/** Get the caller's hospital ID for scoping */
async function callerHospitalId(): Promise<string> {
  const user = await requireSession();
  const supabase = getSupabaseServerClient();

  const { data } = await supabase
    .from("profiles")
    .select("hospital_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!data?.hospital_id) {
    throw new Error("User is not associated with a hospital");
  }

  return data.hospital_id;
}

// ─── Read Operations ─────────────────────────────────────────────────────────

/**
 * Get all certifications for the current user's hospital.
 * Staff see all in their hospital, admin gets full access.
 */
export const getCertifications = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("staff_certifications")
    .select(
      `
      cert_id,
      staff_did,
      hospital_id,
      cert_name,
      cert_type,
      issuing_body,
      issue_date,
      expiry_date,
      cert_number,
      status,
      document_url,
      verification_url,
      verified_by_admin,
      notes,
      created_at,
      updated_at
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { certifications: data ?? [] };
});

/**
 * Get certifications for a specific staff member by DID.
 * Respects RLS: only callable for same-hospital staff.
 */
export const getCertificationsByStaffDid = createServerFn({ method: "GET" })
  .validator((data: { staffDid: string }) => {
    if (!data?.staffDid) throw new Error("staffDid is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: certifications, error } = await supabase
      .from("staff_certifications")
      .select(
        `
        cert_id,
        staff_did,
        hospital_id,
        cert_name,
        cert_type,
        issuing_body,
        issue_date,
        expiry_date,
        cert_number,
        status,
        document_url,
        verification_url,
        verified_by_admin,
        notes,
        created_at,
        updated_at
      `
      )
      .eq("staff_did", data.staffDid)
      .order("issue_date", { ascending: false });

    if (error) throw new Error(error.message);
    return { certifications: certifications ?? [] };
  });

/**
 * Get audit log for a specific certification.
 * Admin can view all, staff can view their own.
 */
export const getCertificationAuditLog = createServerFn({ method: "GET" })
  .validator((data: { certId: string }) => {
    if (!data?.certId) throw new Error("certId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: auditLogs, error } = await supabase
      .from("certification_audit_log")
      .select(
        `
        audit_id,
        cert_id,
        staff_did,
        action,
        field_changed,
        old_value,
        new_value,
        performed_by_name,
        performed_by_role,
        hospital_id,
        reason,
        logged_at
      `
      )
      .eq("cert_id", data.certId)
      .order("logged_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { auditLogs: auditLogs ?? [] };
  });

// ─── Write Operations (Admin Only) ───────────────────────────────────────────

/**
 * Create a new certification for a staff member.
 * Admin-only operation with automatic audit logging.
 */
export const createCertification = createServerFn({ method: "POST" })
  .validator(
    (data: {
      staffDid: string;
      certName: string;
      certType?: string;
      issuingBody: string;
      issueDate?: string;
      expiryDate?: string;
      certNumber?: string;
      status?: string;
      documentUrl?: string;
      verificationUrl?: string;
      verifiedByAdmin?: boolean;
      notes?: string;
    }) => {
      if (!data?.staffDid || !data?.certName || !data?.issuingBody) {
        throw new Error("staffDid, certName, and issuingBody are required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const hospitalId = await callerHospitalId();
    const supabase = getSupabaseServerClient();

    // Verify the staff DID exists and belongs to this hospital
    const { data: didData, error: didError } = await supabase
      .from("dids")
      .select("did, hospital_id")
      .eq("did", data.staffDid)
      .maybeSingle();

    if (didError || !didData) {
      throw new Error("Staff DID not found");
    }

    if (didData.hospital_id !== hospitalId) {
      throw new Error("Cannot create certification for staff from another hospital");
    }

    const { data: certification, error } = await supabase
      .from("staff_certifications")
      .insert({
        staff_did: data.staffDid,
        hospital_id: hospitalId,
        cert_name: data.certName,
        cert_type: data.certType || null,
        issuing_body: data.issuingBody,
        issue_date: data.issueDate || null,
        expiry_date: data.expiryDate || null,
        cert_number: data.certNumber || null,
        status: data.status || "active",
        document_url: data.documentUrl || null,
        verification_url: data.verificationUrl || null,
        verified_by_admin: data.verifiedByAdmin || false,
        notes: data.notes || null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("cert_id")
      .single();

    if (error) {
      if (/row-level security/i.test(error.message)) {
        throw new Error("Only administrators can create certifications");
      }
      throw new Error(error.message);
    }

    // ── Rich audit record ─────────────────────────────────────────────────────
    const caller = await resolveCallerForAudit();
    tryWriteAudit(buildCertificationAudit(
      caller,
      "CERTIFICATION_CREATED",
      certification.cert_id,
      data.staffDid,
      null,
      { certName: data.certName, issuingBody: data.issuingBody, status: data.status ?? "active" },
    ));

    return { ok: true as const, certId: certification.cert_id };
  });

/**
 * Update an existing certification.
 * Admin-only operation with automatic field-level audit logging.
 */
export const updateCertification = createServerFn({ method: "POST" })
  .validator(
    (data: {
      certId: string;
      certName?: string;
      certType?: string;
      issuingBody?: string;
      issueDate?: string;
      expiryDate?: string;
      certNumber?: string;
      status?: string;
      documentUrl?: string;
      verificationUrl?: string;
      verifiedByAdmin?: boolean;
      notes?: string;
    }) => {
      if (!data?.certId) throw new Error("certId is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const supabase = getSupabaseServerClient();

    // Fetch previous state before updating
    const { data: prevRow } = await supabase
      .from("staff_certifications")
      .select("cert_name, issuing_body, status, expiry_date, staff_did")
      .eq("cert_id", data.certId)
      .maybeSingle();

    // Build update patch
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    if (data.certName !== undefined) patch.cert_name = data.certName;
    if (data.certType !== undefined) patch.cert_type = data.certType;
    if (data.issuingBody !== undefined) patch.issuing_body = data.issuingBody;
    if (data.issueDate !== undefined) patch.issue_date = data.issueDate;
    if (data.expiryDate !== undefined) patch.expiry_date = data.expiryDate;
    if (data.certNumber !== undefined) patch.cert_number = data.certNumber;
    if (data.status !== undefined) {
      // Validate status
      const validStatuses = ["active", "expired", "revoked", "pending"];
      if (!validStatuses.includes(data.status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
      }
      patch.status = data.status;
    }
    if (data.documentUrl !== undefined) patch.document_url = data.documentUrl;
    if (data.verificationUrl !== undefined) patch.verification_url = data.verificationUrl;
    if (data.verifiedByAdmin !== undefined) patch.verified_by_admin = data.verifiedByAdmin;
    if (data.notes !== undefined) patch.notes = data.notes;

    if (Object.keys(patch).length === 2) {
      // Only updated_at and updated_by
      throw new Error("No fields to update");
    }

    const { data: updated, error } = await supabase
      .from("staff_certifications")
      .update(patch)
      .eq("cert_id", data.certId)
      .select("cert_id");

    if (error) {
      if (/row-level security/i.test(error.message)) {
        throw new Error("Only administrators can update certifications");
      }
      throw new Error(error.message);
    }

    if (!updated?.length) {
      throw new Error("Certification not found or you do not have permission to update it");
    }

    // ── Rich audit record ─────────────────────────────────────────────────────
    const caller = await resolveCallerForAudit();
    tryWriteAudit(buildCertificationAudit(
      caller,
      "CERTIFICATION_UPDATED",
      data.certId,
      prevRow?.staff_did ?? data.certId,
      prevRow ? { certName: prevRow.cert_name, status: prevRow.status, expiryDate: prevRow.expiry_date } : null,
      { certName: data.certName, status: data.status, expiryDate: data.expiryDate },
    ));

    return { ok: true as const, certId: data.certId };
  });

/**
 * Delete a certification.
 * Admin-only operation with audit logging.
 * Note: Consider soft delete (status = 'revoked') instead for audit trail.
 */
export const deleteCertification = createServerFn({ method: "POST" })
  .validator((data: { certId: string }) => {
    if (!data?.certId) throw new Error("certId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // Fetch before deletion for audit snapshot
    const { data: prevRow } = await supabase
      .from("staff_certifications")
      .select("cert_name, issuing_body, status, staff_did")
      .eq("cert_id", data.certId)
      .maybeSingle();

    const { data: deleted, error } = await supabase
      .from("staff_certifications")
      .delete()
      .eq("cert_id", data.certId)
      .select("cert_id");

    if (error) {
      if (/row-level security/i.test(error.message)) {
        throw new Error("Only administrators can delete certifications");
      }
      throw new Error(error.message);
    }

    if (!deleted?.length) {
      throw new Error("Certification not found or you do not have permission to delete it");
    }

    // ── Rich audit record ─────────────────────────────────────────────────────
    const caller = await resolveCallerForAudit();
    tryWriteAudit(buildCertificationAudit(
      caller,
      "CERTIFICATION_DELETED",
      data.certId,
      prevRow?.staff_did ?? data.certId,
      prevRow ? { certName: prevRow.cert_name, issuingBody: prevRow.issuing_body, status: prevRow.status } : null,
      null,
    ));

    return { ok: true as const, certId: data.certId };
  });

/**
 * Get statistics about certifications in the hospital.
 * Useful for admin dashboard.
 */
export const getCertificationStats = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  // Get counts by status
  const { data, error } = await supabase
    .from("staff_certifications")
    .select("status, cert_id")
    .order("status");

  if (error) throw new Error(error.message);

  const stats = {
    total: data?.length || 0,
    active: data?.filter((c) => c.status === "active").length || 0,
    expired: data?.filter((c) => c.status === "expired").length || 0,
    revoked: data?.filter((c) => c.status === "revoked").length || 0,
    pending: data?.filter((c) => c.status === "pending").length || 0,
  };

  // Get certifications expiring soon (within 60 days)
  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

  const { data: expiringSoon } = await supabase
    .from("staff_certifications")
    .select("cert_id, staff_did, cert_name, expiry_date")
    .eq("status", "active")
    .not("expiry_date", "is", null)
    .lte("expiry_date", sixtyDaysFromNow.toISOString().split("T")[0]);

  return {
    stats,
    expiringSoon: expiringSoon || [],
  };
});
