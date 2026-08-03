/**
 * Edge Function: break-glass
 *
 * Emergency admin access to a patient's records.
 *
 * Why this exists as a function rather than an RLS policy
 * ------------------------------------------------------
 * The schema deliberately gives admins NO blanket SELECT policy on
 * medical_records. An RLS policy would be an invisible, unlogged path to every
 * patient record — an admin could browse PHI with no trace.
 *
 * Routing that access through this function makes each use:
 *   - explicit    (the caller must state a reason)
 *   - audited     (an audit_events row is written BEFORE data is returned)
 *   - attributable (tied to a verified auth.uid())
 *
 * That is what HIPAA § 164.312(b) expects of access to ePHI: not that it never
 * happens, but that it is recorded and reviewable.
 */

import { requireCaller, serviceClient, audit, json, errorResponse, HttpError } from "../_shared/deps.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = serviceClient();
  let caller;

  try {
    caller = await requireCaller(req);

    if (caller.role !== "admin") {
      // Log the attempt: a non-admin probing break-glass is a signal worth keeping.
      await audit(db, {
        actor_id: caller.userId,
        action: "BREAK_GLASS_DENIED",
        outcome: "failure",
        severity: "warning",
        metadata: { role: caller.role },
      });
      throw new HttpError(403, "Break-glass access is restricted to administrators");
    }

    const body = await req.json();
    const { patientDid, reason } = body ?? {};

    if (!patientDid) throw new HttpError(400, "patientDid is required");
    if (!reason || String(reason).trim().length < 20) {
      // A meaningful justification is mandatory — "test" is not an audit trail.
      throw new HttpError(400, "A reason of at least 20 characters is required");
    }

    // Audit BEFORE reading. If the read fails we still have a record of the
    // attempt; if we logged afterwards a crash could hide the access.
    await audit(db, {
      actor_id: caller.userId,
      actor_did: caller.dids[0] ?? null,
      resource: patientDid,
      action: "BREAK_GLASS_ACCESS",
      outcome: "success",
      severity: "critical",
      metadata: { reason, requestedAt: new Date().toISOString() },
    });

    const [records, prescriptions, labs] = await Promise.all([
      db.from("medical_records").select("*").eq("patient_did", patientDid),
      db.from("prescriptions").select("*").eq("patient_did", patientDid),
      db.from("lab_results").select("*").eq("patient_did", patientDid),
    ]);

    return json({
      ok: true,
      warning: "This access has been permanently recorded in the audit trail.",
      patientDid,
      medicalRecords: records.data ?? [],
      prescriptions: prescriptions.data ?? [],
      labResults: labs.data ?? [],
    });
  } catch (err) {
    return errorResponse(err);
  }
});
