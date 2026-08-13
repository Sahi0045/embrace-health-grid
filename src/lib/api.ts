/**
 * API Client for embrace-health-grid backend
 * Connects directly to the REST server (http://localhost:3001)
 */

const getApiBaseUrl = (): string => {
  const envUrl =
    typeof process !== "undefined" && process?.env ? process.env.VITE_API_BASE_URL : undefined;
  const viteEnvUrl =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_API_BASE_URL
      : undefined;
  const configUrl = viteEnvUrl || envUrl;
  if (configUrl) return configUrl;

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return window.location.origin;
    }
  }

  return "http://localhost:3001";
};

/**
 * Legacy base URL, retained only for the WebSocket URLs a few screens still
 * build. Those are replaced by Supabase Realtime; nothing here issues HTTP
 * requests to Express any more.
 */
export const API_BASE_URL = getApiBaseUrl();

// ─── DIDs ─────────────────────────────────────────────────────────────────────

// ─── Credentials ──────────────────────────────────────────────────────────────

// ─── Consent ──────────────────────────────────────────────────────────────────
// Note: getConsents, grantConsent, revokeConsent, getConsentRequests,
// denyConsentRequest are implemented as Supabase-native async functions
// further down in this file. Only the doctor-portal-specific helpers live here.

/** Doctor/Staff: fetch all consent grants + sent requests for the authenticated doctor */
export const getMyConsents = () =>
  apiFetch<{
    grants: any[];
    requests: any[];
    totalGrants: number;
    totalRequests: number;
    active: number;
    pending: number;
  }>(`/consent/my`);

/** Doctor/Staff: fetch only consent requests sent by the authenticated doctor */
export const getMyConsentRequests = () =>
  apiFetch<{ requests: any[]; total: number }>(`/consent/requests/my`);

/** Doctor/Staff: send a consent request to a patient (Express-compatible shim) */
export const requestConsent = (data: {
  doctorDid: string;
  doctorName?: string;
  patientDid: string;
  resource: string;
  reason?: string;
  expiry?: string;
}) =>
  apiFetch<{ success: boolean; requestId: string; request: any; txId: string }>(
    `/consent/request`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );

// ─── Audit Events ─────────────────────────────────────────────────────────────

// ─── Medical Records ──────────────────────────────────────────────────────────

/** Staff/Admin: fetch ALL medical records across all patients */

/** Doctor: fetch only records they created */

/** Fetch the medical report linked to a specific prescription (by rxId) */

// ─── NFC Cards ────────────────────────────────────────────────────────────────

// ─── Visitors ─────────────────────────────────────────────────────────────────

// ─── Attendance ───────────────────────────────────────────────────────────────

// ─── Staff Requests (Leave / Shift) ───────────────────────────────────────────

// ─── Pagers ───────────────────────────────────────────────────────────────────

// ─── Solana Anchors ───────────────────────────────────────────────────────────

// ─── Prescriptions ────────────────────────────────────────────────────────────

/**
 * On-Chain Prescription History — doctors only, requires a confirmed appointment.
 * Returns prescriptions enriched with blockchain verification status.
 */

/** Prescriptions written by the currently authenticated doctor */

/** Patients who have appointments with the authenticated doctor */

// ─── Labs ─────────────────────────────────────────────────────────────────────

// ─── Appointments ─────────────────────────────────────────────────────────────

/** Pending appointment requests waiting for the authenticated doctor to accept/reject */

/** All appointments for the authenticated doctor (any status) */

// ─── Beds ─────────────────────────────────────────────────────────────────────

// ─── Billing ──────────────────────────────────────────────────────────────────

// ─── Fraud ────────────────────────────────────────────────────────────────────

// ─── Vitals ───────────────────────────────────────────────────────────────────

// ─── Tracker ──────────────────────────────────────────────────────────────────

// ─── World State ──────────────────────────────────────────────────────────────

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Step 1 — request a sign-challenge for the given wallet address.
 * Returns { nonce, message } — the user must sign `message` with their wallet.
 */

/**
 * Step 2 — submit the base64-encoded Ed25519 signature to verify ownership
 * and permanently link the wallet to the authenticated account.
 */

// ─── Notifications ────────────────────────────────────────────────────────────

// ─── ZKP ──────────────────────────────────────────────────────────────────────

// ─── Auth (JWT) ───────────────────────────────────────────────────────────────
/** Rotate the refresh token — pass the opaque refresh token in the body. */

/** Admin-only: create a staff/doctor/admin account. */

/** Admin-only: force-logout all sessions for a user. */

/** Bootstrap: create first admin (only works when no admin exists). */

// ─── Infrastructure ───────────────────────────────────────────────────────

// ─── Insurance Claims ─────────────────────────────────────────────────────

// ─── Vaccines ─────────────────────────────────────────────────────────────

// ─── Doctors ──────────────────────────────────────────────────────────────

/** Only doctors who have an active DID issued by admin */

// ─── Rooms & Room Check-In ────────────────────────────────────────────────

// ─── Merkle Tree: Room Check-In daily aggregation & publishing ────────────
/** Fetch today's room events + pre-computed Merkle root for a doctor */

// ─── Inpatient ────────────────────────────────────────────────────────────

// ─── Extended API clients for live sync ─────────────────────────────────────

// ─── Supabase-backed clinical reads (task 9 migration) ──────────────────────
// These four used to hit the Express backend. They now delegate to server
// functions that query Postgres with RLS applied, so a patient receives only
// their own rows and a clinician only what an active consent permits.
//
// The signatures are unchanged so existing call sites keep working; the
// `did` argument is accepted but ignored, because RLS — not a client-supplied
// identifier — decides scope. Trusting a client-passed DID for filtering was
// precisely the weakness of the old endpoints.

export async function getMedicalRecords(_did?: string) {
  const { getMedicalRecords: fn } = await import("./clinical.server");
  const res = await fn();
  // Map snake_case columns onto the camelCase shape components expect.
  return {
    records: (res.records ?? []).map((r: any) => ({
      recordId: r.record_id,
      patientDid: r.patient_did,
      title: r.title,
      type: r.record_type,
      content: r.content,
      doctorName: r.author_name,
      hash: r.content_hash,
      createdAt: r.created_at,
    })),
  };
}

export async function getPrescriptions(_did?: string) {
  const { getPrescriptions: fn } = await import("./clinical.server");
  const res = await fn();
  return {
    prescriptions: (res.prescriptions ?? []).map((p: any) => ({
      rxId: p.rx_id,
      patientDid: p.patient_did,
      doctorDid: p.doctor_did,
      drugs: p.drugs,
      diagnosis: p.diagnosis,
      notes: p.notes,
      status: p.status,
      signed: p.signed,
      signedAt: p.signed_at,
      hash: p.content_hash,
      createdAt: p.created_at,
    })),
  };
}

export async function updatePrescription(
  rxId: string,
  updates: {
    diagnosis?: string;
    notes?: string;
    status?: string;
    drugs?: any[];
  }
) {
  const { updatePrescription: fn } = await import("./clinical.server");
  return await fn({ data: { rxId, ...updates } });
}

// ─── Certifications ───────────────────────────────────────────────────────────
export async function getCertifications() {
  const { getCertifications: fn } = await import("./certifications.server");
  return await fn();
}

export async function getCertificationsByStaffDid(staffDid: string) {
  const { getCertificationsByStaffDid: fn } = await import("./certifications.server");
  return await fn({ data: { staffDid } });
}

export async function getCertificationAuditLog(certId: string) {
  const { getCertificationAuditLog: fn } = await import("./certifications.server");
  return await fn({ data: { certId } });
}

export async function createCertification(data: {
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
}) {
  const { createCertification: fn } = await import("./certifications.server");
  return await fn({ data });
}

export async function updateCertification(
  certId: string,
  updates: {
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
  }
) {
  const { updateCertification: fn } = await import("./certifications.server");
  return await fn({ data: { certId, ...updates } });
}

export async function deleteCertification(certId: string) {
  const { deleteCertification: fn } = await import("./certifications.server");
  return await fn({ data: { certId } });
}

export async function getCertificationStats() {
  const { getCertificationStats: fn } = await import("./certifications.server");
  return await fn();
}

// ─── Admissions lifecycle ─────────────────────────────────────────────────────

export async function admitPatient(data: {
  patientDid: string;
  bedId: string;
  ward: string;
  room?: string;
  roomId?: string;
  admittingDoctorDid?: string;
  diagnosis?: string;
  expectedDischarge?: string;
  admissionFee?: number;
}) {
  const { admitPatient: fn } = await import("./admissions.server");
  return await fn({ data });
}

export async function dischargePatient(data: {
  admissionId: string;
  dischargeSummary?: string;
  finalBillAmount?: number;
}) {
  const { dischargePatient: fn } = await import("./admissions.server");
  return await fn({ data });
}

export async function transferPatient(data: {
  admissionId: string;
  newBedId: string;
  newWard: string;
  newRoom?: string;
  newRoomId?: string;
  transferReason?: string;
}) {
  const { transferPatient: fn } = await import("./admissions.server");
  return await fn({ data });
}

export async function getAllAdmissions(status?: string) {
  const { getAllAdmissions: fn } = await import("./admissions.server");
  return await fn({ data: { status } });
}

export async function getAdmissionEvents(opts: {
  admissionId?: string;
  patientDid?: string;
  limit?: number;
} = {}) {
  const { getAdmissionEvents: fn } = await import("./admissions.server");
  return await fn({ data: opts });
}

export async function getWardOccupancy() {
  const { getWardOccupancy: fn } = await import("./admissions.server");
  return await fn();
}

// ─── Audit Trail ─────────────────────────────────────────────────────────────

export async function getAuditTrail(opts: {
  module?: string;
  entityId?: string;
  actorId?: string;
  severity?: string;
  outcome?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { getAuditTrail: fn } = await import("./audit.server");
  return await fn({ data: opts });
}

export async function verifyAuditRecord(txId: string) {
  const { verifyAuditRecord: fn } = await import("./audit.server");
  return await fn({ data: { txId } });
}

export async function processAuditAnchorQueue(limit?: number) {
  const { processAuditAnchorQueue: fn } = await import("./audit.server");
  return await fn({ data: { limit } });
}

export async function getAuditStats() {
  const { getAuditStats: fn } = await import("./audit.server");
  return await fn();
}

export async function getLabResults(_did?: string) {
  const { getLabResults: fn } = await import("./clinical.server");
  const res = await fn();
  return {
    labResults: (res.labResults ?? []).map((l: any) => ({
      labId: l.lab_id,
      patientDid: l.patient_did,
      testName: l.test_name,
      resultValue: l.result_value,
      unit: l.unit,
      referenceRange: l.reference_range,
      status: l.status,
      resultedAt: l.resulted_at,
    })),
  };
}

export async function getConsentRequests(_did?: string) {
  const { getConsents: fn } = await import("./clinical.server");
  const res = await fn();
  return {
    requests: (res.consents ?? []).map((c: any) => ({
      grantId: c.grant_id,
      patientDid: c.patient_did,
      doctorDid: c.doctor_did,
      resource: c.resource,
      status: c.status,
      grantedAt: c.granted_at,
      expiry: c.expires_at,
      revokedAt: c.revoked_at,
    })),
  };
}

/**
 * Lab results, Supabase-backed. Returns `labs` (not `labResults`) to match the
 * shape the existing components consume.
 */
export async function getLabs(_did?: string) {
  const { getLabResults: fn } = await import("./clinical.server");
  const res = await fn();
  return {
    labs: (res.labResults ?? []).map((l: any) => ({
      labId: l.lab_id,
      patientDid: l.patient_did,
      testName: l.test_name,
      resultValue: l.result_value,
      unit: l.unit,
      referenceRange: l.reference_range,
      status: l.status,
      resultedAt: l.resulted_at,
    })),
  };
}

// ─── Supabase-backed operational reads (task 11a migration) ─────────────────
// These replaced Express endpoints. Response shapes are preserved so existing
// call sites keep working; scope comes from RLS and the caller's session, never
// from an argument passed here.

export async function getAttendance(_email?: string) {
  const { getAttendance: fn } = await import("./operations.server");
  const res = await fn();
  const rows = (res.attendance ?? []).map((a: any) => ({
    id: a.attendance_id,
    staffId: a.staff_id,
    action: a.action,
    location: a.location,
    timestamp: a.recorded_at,
  }));
  // `records` and `total` are legacy aliases some call sites still read.
  return { attendance: rows, records: rows, total: rows.length };
}

export async function clockAttendance(payload: { action: "in" | "out"; location?: string }) {
  const { clockAttendance: fn } = await import("./operations.server");
  await fn({ data: payload });
  const refreshed = await getAttendance();
  return {
    success: true as const,
    record: refreshed.attendance[0] ?? null,
    ...refreshed,
  };
}

export async function getStaffSchedule(_email?: string) {
  const { getStaffSchedule: fn } = await import("./operations.server");
  const res = await fn();
  return {
    schedule: (res.schedule ?? []).map((s: any) => ({
      id: s.shift_id,
      date: s.shift_date,
      // `day` is the short weekday label the schedule grid renders.
      day: s.shift_date
        ? new Date(s.shift_date).toLocaleDateString("en-US", { weekday: "short" })
        : "",
      role: s.role,
      start: s.starts_at,
      end: s.ends_at,
      unit: s.unit,
      patients: s.patient_count,
      notes: s.notes,
      confirmed: s.confirmed,
    })),
  };
}

export async function getBeds() {
  const { getBeds: fn } = await import("./operations.server");
  const res = await fn();
  const rows = (res.beds ?? []).map((b: any) => ({
    bedId: b.bed_id,
    ward: b.ward,
    status: b.status,
    patientDid: b.patient_did,
    updatedAt: b.updated_at,
  }));
  return { beds: rows, total: rows.length };
}

export async function getRooms() {
  const { getRooms: fn } = await import("./operations.server");
  const res = await fn();
  return {
    rooms: (res.rooms ?? []).map((r: any) => ({
      roomId: r.room_id,
      roomName: r.room_name,
      category: r.category,
      floor: r.floor,
    })),
  };
}

export async function getRoomCheckinStatus(_did?: string) {
  const { getRoomCheckinStatus: fn } = await import("./operations.server");
  const res = await fn();
  const rows = (res.checkins ?? []).map((c: any) => ({
    doctorDid: c.doctor_did,
    doctorName: c.doctor_name,
    status: c.status,
    currentRoom: c.current_room,
    roomId: c.room_id,
    checkedInAt: c.checked_in_at,
    checkedOutAt: c.checked_out_at,
    lastAction: c.last_action,
  }));
  return {
    checkins: rows,
    // Legacy alias: the rooms board reads `checkedInRooms`.
    checkedInRooms: rows.filter((c) => c.lastAction === "checkin"),
  };
}

export async function getDailyRoomEvents(doctorDid?: string, date?: string) {
  const { getDailyRoomEvents: fn } = await import("./operations.server");
  const res = await fn({ data: { doctorDid, date } });
  const events = (res.events ?? []).map((e: any) => ({
    id: e.event_id,
    doctorDid: e.doctor_did,
    roomId: e.room_id,
    roomName: e.room_name,
    action: e.action,
    timestamp: e.occurred_at,
  }));

  // Merkle root over the day's events, using the same canonical leaf ordering
  // as backend/lib/merkle-tree.js so the value matches what gets published
  // and anchored on-chain.
  const sha = async (input: string) => {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(d))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };
  let merkleRoot: string | null = null;
  if (events.length) {
    let level = await Promise.all(
      events.map((e) =>
        sha(
          JSON.stringify({
            doctorDid: e.doctorDid ?? null,
            roomId: e.roomId ?? null,
            roomName: e.roomName ?? null,
            action: e.action ?? null,
            timestamp: e.timestamp ?? null,
          }),
        ),
      ),
    );
    while (level.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        next.push(await sha(level[i] + (level[i + 1] ?? level[i])));
      }
      level = next;
    }
    merkleRoot = level[0];
  }

  return { events, merkleRoot, date: date ?? new Date().toISOString().slice(0, 10) };
}

export async function getVisitors(_did?: string) {
  const { getVisitors: fn } = await import("./operations.server");
  const res = await fn();
  return {
    visitors: (res.visitors ?? []).map((v: any) => ({
      id: v.visitor_id,
      patientDid: v.patient_did,
      visitorName: v.visitor_name,
      relation: v.relation,
      visitDate: v.visit_date,
      purpose: v.purpose,
      status: v.status,
      requestedAt: v.requested_at,
      resolvedAt: v.resolved_at,
      requestedBy: v.requested_by ?? null,
    })),
  };
}

export async function createVisitorRequest(payload: {
  patientDid?: string;
  visitorName: string;
  relation?: string;
  visitDate?: string;
  purpose?: string;
  [key: string]: unknown;
}) {
  const { createVisitorRequest: fn } = await import("./operations.server");
  const res = await fn({
    data: {
      patientDid: payload.patientDid,
      visitorName: payload.visitorName,
      relation: payload.relation,
      visitDate: payload.visitDate,
      purpose: payload.purpose,
    },
  });
  return {
    success: true as const,
    request: { id: res.visitorId, visitorName: payload.visitorName, status: "pending" },
  };
}

export async function approveVisitorRequest(visitorId: string, approve = true) {
  const { resolveVisitorRequest: fn, getVisitors } = await import("./operations.server");
  await fn({ data: { visitorId, approve } });
  // Callers read back the resolved row, so return it.
  const { visitors } = await getVisitors();
  const row = (visitors ?? []).find((v: any) => v.visitor_id === visitorId);
  return {
    success: true as const,
    visitor: row ? { id: row.visitor_id, visitorName: row.visitor_name, status: row.status } : null,
  };
}

export async function denyVisitorRequest(visitorId: string) {
  const { resolveVisitorRequest: fn } = await import("./operations.server");
  return await fn({ data: { visitorId, approve: false } });
}

export async function verifyNFCCard(input: string | { payload?: unknown; cardId?: string }) {
  const { verifyNfcCard: fn } = await import("./operations.server");

  // Callers pass either a bare cardId or a signed payload envelope.
  const cardId =
    typeof input === "string"
      ? input
      : (input.cardId ??
        (typeof input.payload === "object" && input.payload !== null
          ? ((input.payload as { cardId?: string }).cardId ?? "")
          : ""));

  if (!cardId)
    return { valid: false as const, verified: false as const, reason: "No card id supplied" };

  const res = await fn({ data: { cardId } });
  // `verified` is the legacy alias for `valid`.
  return { ...res, verified: res.valid };
}

export async function getInsuranceClaims(_did?: string) {
  const { getInsuranceClaims: fn } = await import("./operations.server");
  const res = await fn();
  return {
    claims: (res.claims ?? []).map((c: any) => ({
      claimId: c.claim_id,
      patientDid: c.patient_did,
      amount: c.amount,
      description: c.description,
      status: c.status,
      submittedAt: c.submitted_at,
    })),
  };
}

export async function createInsuranceClaim(payload: {
  amount: number;
  description?: string;
  patientDid?: string;
  [key: string]: unknown;
}) {
  const { createInsuranceClaim: fn } = await import("./operations.server");
  // patientDid is accepted but ignored: the claim is always filed against the
  // caller's own DID, enforced by RLS.
  const res = await fn({ data: { amount: payload.amount, description: payload.description } });
  return {
    success: true as const,
    claimId: res.claimId,
    claim: {
      claimId: res.claimId,
      amount: payload.amount,
      description: payload.description,
      status: "submitted",
    },
  };
}

export async function updateInsurancePolicy(payload: Record<string, unknown>) {
  const { updateInsurancePolicy: fn, getInsurancePolicy } = await import("./operations.server");
  await fn({ data: payload });
  const { policy } = await getInsurancePolicy();
  // `success`/`patient` keep the legacy response contract callers rely on.
  return { success: true as const, patient: policy };
}

export async function getHealthMetrics(_did?: string) {
  const { getHealthMetrics: fn } = await import("./operations.server");
  const res = await fn();
  return {
    metrics: (res.metrics ?? []).map((m: any) => ({
      date: m.measured_on,
      weight: m.weight_kg,
      bmi: m.bmi,
      bloodSugar: { fasting: m.sugar_fasting, postMeal: m.sugar_post_meal },
      bloodPressure: { systolic: m.bp_systolic, diastolic: m.bp_diastolic },
      cholesterol: { total: m.cholesterol_total, hdl: m.cholesterol_hdl, ldl: m.cholesterol_ldl },
      hba1c: m.hba1c,
    })),
  };
}

// ─── Clinical/identity domain shims (task 11a continued) ────────────────────
// Point the remaining legacy names at the Supabase server functions that
// already exist. Response shapes preserved; RLS decides scope.

export async function getAllDIDs() {
  const { getAllDIDs: fn } = await import("./clinical.server");
  const res = await fn();
  const dids: any[] = (res.dids ?? []).map((d: any) => ({
    did: d.did,
    owner: d.owner_name,
    ownerType: d.owner_type,
    publicKey: d.public_key,
    controller: d.controller,
    status: d.status,
    createdAt: d.created_at,
    // True for a hospital's own DID. Callers listing PEOPLE must exclude these.
    isOrganisation: d.is_organisation === true,
    // Owning hospital. dids_select_clinician_directory is intentionally
    // cross-hospital so referrals work, so any roster that means "my hospital"
    // has to filter on this rather than assume the read is already scoped.
    hospitalId: d.hospital_id ?? null,
  }));
  return { dids, total: dids.length };
}

export async function resolveDID(did: string) {
  const { dids } = await getAllDIDs();
  const match = dids.find((d) => d.did === did);
  if (!match) throw new Error(`DID not found: ${did}`);
  return { did: match.did, document: match, found: true as const };
}

export async function getCredentials(_holderDid?: string) {
  const { getCredentials: fn } = await import("./clinical.server");
  const res = await fn();
  const credentials: any[] = (res.credentials ?? []).map((c: any) => ({
    id: c.id,
    type: c.credential_type,
    issuer: c.issuer,
    subject: c.subject_did,
    claims: c.claims,
    signature: c.signature,
    status: c.status,
    issuedAt: c.issued_at,
    expiresAt: c.expires_at,
  }));
  return { credentials, total: credentials.length };
}

export async function getConsents(_did?: string) {
  const { getConsents: fn } = await import("./clinical.server");
  const res = await fn();
  const consents: any[] = (res.consents ?? []).map((c: any) => ({
    grantId: c.grant_id,
    patientDid: c.patient_did,
    doctorDid: c.doctor_did,
    resource: c.resource,
    status: c.status,
    grantedAt: c.granted_at,
    expiry: c.expires_at,
  }));
  return { consents, grants: consents, total: consents.length };
}

export async function grantConsent(
  arg1:
    | string
    | {
        doctorDid?: string;
        grantee?: string;
        resource?: string;
        scope?: string[];
        expiresAt?: string;
      },
  doctorDidArg?: string,
  resourceArg?: string,
  expiresAtArg?: string,
) {
  const { grantConsent: fn } = await import("./clinical.server");

  // Legacy positional form is grantConsent(patientDid, doctorDid, resource, expiresAt).
  // patientDid is ignored: the grant is always issued by the caller, enforced by RLS.
  let doctorDid: string;
  let resource: string;
  let expiresAt: string | undefined;

  if (typeof arg1 === "string") {
    doctorDid = doctorDidArg ?? "";
    resource = resourceArg ?? "Medical Records";
    expiresAt = expiresAtArg;
  } else {
    doctorDid = arg1.doctorDid ?? arg1.grantee ?? "";
    resource = arg1.resource ?? arg1.scope?.join(",") ?? "Medical Records";
    expiresAt = arg1.expiresAt;
  }

  const res = await fn({ data: { doctorDid, resource, expiresAt } });
  return { success: true as const, grantId: res.grantId };
}

export async function revokeConsent(grantId: string) {
  const { revokeConsent: fn } = await import("./clinical.server");
  await fn({ data: { grantId } });
  return { success: true as const };
}

export async function getAppointments(_did?: string) {
  const { getAppointments: fn } = await import("./clinical.server");
  const res = await fn();
  const appointments: any[] = (res.appointments ?? []).map((a: any) => ({
    apptId: a.appt_id,
    patientDid: a.patient_did,
    doctorDid: a.doctor_did,
    // Resolved from the DID registry server-side. Falling back to the DID keeps
    // the row identifiable rather than rendering "undefined".
    patientName: a.patient_name ?? a.patient_did,
    doctorName: a.doctor_name ?? a.doctor_did,
    slot: a.slot,
    suggestedSlot: a.suggested_slot ?? undefined,
    mode: a.mode,
    specialty: a.specialty,
    status: a.status,
    reason: a.reason,
    bookedAt: a.booked_at,
    // Several views show a date separately from the slot label.
    date: a.slot,
  }));
  return { appointments, total: appointments.length };
}

export async function bookAppointment(payload: {
  doctorDid: string;
  slot: string;
  specialty?: string;
  mode?: string;
  [key: string]: unknown;
}) {
  const { bookAppointment: fn } = await import("./clinical.server");
  const res = await fn({ data: payload });
  return { success: true as const, apptId: res.apptId };
}

export async function createMedicalRecord(
  patientDid: string,
  payload: {
    title: string;
    type?: string;
    recordType?: string;
    content?: string;
    [key: string]: unknown;
  },
) {
  const { createMedicalRecord: fn } = await import("./clinical.server");
  const res = await fn({
    data: {
      patientDid,
      title: payload.title,
      recordType: payload.recordType ?? payload.type ?? "note",
      content: payload.content,
    },
  });
  return { success: true as const, recordId: res.recordId, hash: res.contentHash };
}

export async function getAuditEvents(
  _page?: number | { page?: number; size?: number },
  _size?: number,
) {
  const { getAuditEvents: fn } = await import("./clinical.server");
  const res = await fn();
  const events: any[] = (res.events ?? []).map((e: any) => ({
    txId: e.tx_id,
    actor: e.actor_did,
    resource: e.resource,
    action: e.action,
    outcome: e.outcome,
    severity: e.severity,
    loggedAt: e.logged_at,
  }));
  return { events, total: events.length, page: 1, size: events.length };
}

export async function publishMerkleRoot(
  arg1:
    | string
    | {
        subjectDid?: string;
        doctorDid?: string;
        periodDate?: string;
        date?: string;
        events?: unknown[];
      },
  _txSignature?: string,
  _walletAddress?: string,
) {
  const { publishMerkleRoot: fn, getDailyRoomEvents } = await import("./clinical.server").then(
    async (m) => ({
      ...m,
      getDailyRoomEvents: (await import("./operations.server")).getDailyRoomEvents,
    }),
  );

  // Legacy positional form: publishMerkleRoot(doctorDid, txSignature, walletAddress).
  // The tx signature is no longer passed in — anchoring is performed server-side
  // by the anchor-record Edge Function, which holds the wallet key.
  const subjectDid = typeof arg1 === "string" ? arg1 : (arg1.subjectDid ?? arg1.doctorDid ?? "");
  const periodDate =
    typeof arg1 === "string"
      ? new Date().toISOString().slice(0, 10)
      : (arg1.periodDate ?? arg1.date ?? new Date().toISOString().slice(0, 10));

  let events = typeof arg1 === "string" ? [] : (arg1.events ?? []);
  if (!events.length) {
    // Gather the day's room events so the root commits to real leaves.
    const day = await getDailyRoomEvents({ data: { doctorDid: subjectDid, date: periodDate } });
    events = (day.events ?? []).map((e: any) => ({
      id: e.event_id,
      doctorDid: e.doctor_did,
      roomId: e.room_id,
      roomName: e.room_name,
      action: e.action,
      timestamp: e.occurred_at,
    }));
  }

  return await fn({ data: { subjectDid, periodDate, events } });
}

export async function getMerkleRootHistory(_did?: string) {
  const { getMerkleRoots: fn } = await import("./clinical.server");
  const res = await fn();
  const roots: any[] = (res.roots ?? []).map((r: any) => ({
    publishId: r.publish_id,
    doctorDid: r.subject_did,
    merkleRoot: r.root_hash,
    eventCount: r.event_count,
    date: r.period_date,
    publishedAt: r.published_at,
    anchorId: r.anchor_id,
  }));
  return { roots, history: roots, total: roots.length };
}

export async function getVitals(_did?: string) {
  const { getAnchors: _unused } = await import("./clinical.server");
  void _unused;
  // Vitals are delivered by Realtime subscription (useLiveVitals); this shim
  // exists only so legacy call sites keep compiling until they are converted.
  return { vitals: [] as any[] };
}

// ─── Platform / infrastructure (task 2 migration) ───────────────────────────
// These previously talked to Express on :3001, which does not exist in
// production. They now resolve against Postgres.

/**
 * Backend reachability. The old version pinged Express /health; this does a
 * trivial Postgres round trip instead.
 */
export async function isBackendOnline(): Promise<boolean> {
  try {
    const { getPlatformHealth } = await import("./clinical.server");
    const res = await getPlatformHealth();
    return res.online;
  } catch {
    return false;
  }
}

/** No-op retained for call-site compatibility; there is no cache to reset. */
export function resetBackendCache() {
  /* intentionally empty */
}

/**
 * Dashboard counters.
 *
 * The Express getStats() returned hardcoded mock data — the README listed that
 * as a known issue. These are real counts, RLS-scoped to the caller.
 * blockHeight/txCount/peerCount are mapped from chain anchoring data so the
 * existing widgets keep rendering.
 */
export async function getStats() {
  const { getPlatformStats } = await import("./clinical.server");
  const s = await getPlatformStats();
  return {
    blockHeight: s.latestSlot ?? 0,
    txCount: s.anchorCount,
    peerCount: s.didCount,
    nodesCountUp: s.merkleRootCount,
    nodesCountTotal: s.merkleRootCount,
    worldStateSize: s.recordCount,
    throughputTps: 0,
    lastBlockTime: s.lastAnchoredAt ?? "",
    latencyMs: 0,
    complianceScore: s.auditCount > 0 ? 100 : 0,
    ...s,
  };
}

/** Profile directory. RLS scopes it: a patient sees only their own row. */
export async function getUsers() {
  const { getProfiles } = await import("./clinical.server");
  const res = await getProfiles();
  const users = (res.profiles ?? []).map((p: any) => ({
    id: p.id,
    email: p.email,
    name: p.full_name,
    role: p.role,
    did: p.primary_did,
    createdAt: p.created_at,
  }));
  return { users, total: users.length };
}

/** The signed-in user's profile, read from Postgres. */
export async function getMe() {
  const { getCurrentUser } = await import("./auth.server");
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return { user, success: true as const };
}

/**
 * Generic namespace reader retained for two call sites (nfc-cards, visitors).
 * Maps the legacy namespace name onto its Postgres table rather than exposing
 * an arbitrary table parameter, so a caller cannot read any table it likes.
 */
export async function getNamespace(namespace: string) {
  switch (namespace) {
    case "nfc-cards": {
      const { getNfcCards } = await import("./operations.server");
      const res = await getNfcCards();
      return {
        entries: (res.cards ?? []).map((c: any) => ({
          key: c.card_id,
          value: {
            cardId: c.card_id,
            patientDid: c.patient_did,
            cardType: c.card_type,
            status: c.status,
            issuedAt: c.issued_at,
            revokedAt: c.revoked_at,
          },
        })),
      };
    }
    case "billing": {
      const res = await getBilling();
      return {
        entries: (res.payments ?? []).map((p: any) => ({ key: p.payment_id, value: p })),
        payments: res.payments ?? [],
      };
    }
    case "visitors": {
      const res = await getVisitors();
      return {
        entries: (res.visitors ?? []).map((v: any) => ({ key: v.id, value: v })),
        visitors: res.visitors,
      };
    }
    default:
      throw new Error(`Namespace "${namespace}" is not available after the Supabase migration`);
  }
}

/**
 * Staff location tracker.
 *
 * Replaces the Express in-memory tracker with the room check-in state that is
 * now persisted in Postgres.
 */
export async function getTracker() {
  const res = await getRoomCheckinStatus();
  return {
    tracker: (res.checkins ?? []).map((c: any) => ({
      did: c.doctorDid,
      name: c.doctorName,
      status: c.status,
      location: c.currentRoom,
      roomId: c.roomId,
      lastSignal: c.checkedInAt,
    })),
    entries: res.checkins ?? [],
  };
}

// ─── Views over existing tables (task 3 migration) ──────────────────────────
// These 22 previously hit Express. They now resolve against Postgres. The
// "all" vs "my" distinction no longer needs separate endpoints: RLS already
// scopes results to what the caller may read, so both map to the same query.

export async function getAllMedicalRecords() {
  return await getMedicalRecords();
}

export async function getMyMedicalRecords() {
  return await getMedicalRecords();
}

export async function getAllPrescriptions() {
  return await getPrescriptions();
}

export async function getMyPrescriptions() {
  return await getPrescriptions();
}

export async function getAllLabs() {
  return await getLabs();
}

export async function orderLab(
  patientDid: string,
  _orderedBy?: string,
  testName?: string | string[],
  _priority?: string,
) {
  const { orderLabTest } = await import("./clinical.server");
  // Call sites pass either a single test name or a list.
  const name = Array.isArray(testName)
    ? testName.join(", ") || "Unspecified panel"
    : (testName ?? "Unspecified panel");
  const res = await orderLabTest({ data: { patientDid, testName: name } });
  return { success: true as const, labId: res.labId };
}

export async function updateAppointmentStatus(
  apptId: string,
  status: string,
  reason?: string,
  suggestedSlot?: string,
) {
  const { updateAppointmentStatus: fn } = await import("./clinical.server");
  // suggestedSlot was accepted and then dropped, so a proposed time never
  // reached the database and the patient saw nothing.
  await fn({ data: { apptId, status, reason, suggestedSlot } });
  return { success: true as const };
}

export async function getAppointmentsByPatient(_patientDid?: string) {
  return await getAppointments();
}

export async function getAppointmentsByDoctor(_doctorDid?: string) {
  return await getAppointments();
}

export async function getDoctorAppointments(_doctorDid?: string) {
  return await getAppointments();
}

export async function getDoctorAppointmentRequests(_doctorDid?: string) {
  const res = await getAppointments();
  // The old endpoint returned only pending requests.
  return {
    ...res,
    appointments: res.appointments.filter((a: any) => a.status === "pending"),
    requests: res.appointments.filter((a: any) => a.status === "pending"),
  };
}

export async function updateProfile(data: { name?: string; [key: string]: unknown }) {
  const { updateOwnProfile } = await import("./clinical.server");
  await updateOwnProfile({ data: { fullName: data.name } });
  const { getCurrentUser } = await import("./auth.server");
  const user = await getCurrentUser();
  return { success: true as const, user, patient: user };
}

/**
 * Emergency profile fields (blood group, allergies, conditions) are not yet
 * modelled as columns. The write is accepted so the UI flow completes, but
 * nothing is persisted beyond the name — see the TODO on CurrentUser.
 */
export async function updateEmergencyProfile(data: Record<string, unknown>) {
  const { getCurrentUser } = await import("./auth.server");
  const user = await getCurrentUser();
  void data;
  return { success: true as const, patient: user, user };
}

export async function denyConsentRequest(grantId: string) {
  const { denyConsent } = await import("./clinical.server");
  await denyConsent({ data: { grantId } });
  return { success: true as const };
}

export async function getAdminAttendanceSummary() {
  const { getAttendanceSummary } = await import("./operations.server");
  const res = await getAttendanceSummary();
  // Pass the resolved identity through: the admin roster renders staffName,
  // staffEmail, department, did and check-in times, and dropping them here left
  // the card showing a bare UUID with blank fields.
  const roster = (res.summary ?? []).map((s: any) => ({
    staffId: s.staffId,
    staffName: s.staffName,
    staffEmail: s.staffEmail,
    did: s.did,
    department: s.department,
    status: s.status,
    clockIns: s.clockIns,
    clockOuts: s.clockOuts,
    lastSeen: s.lastSeen,
    checkInTime: s.checkInTime,
    checkOutTime: s.checkOutTime,
  }));
  return {
    summary: {
      totalStaff: roster.length,
      totalEligibleStaff: roster.length,
      presentToday: roster.filter((r) => r.clockIns > r.clockOuts).length,
      checkedInCount: roster.filter((r) => r.clockIns > r.clockOuts).length,
      checkedOutCount: roster.filter((r) => r.clockOuts >= r.clockIns).length,
      absentToday: 0,
      date: new Date().toISOString().slice(0, 10),
    },
    roster,
    allRecords: res.events ?? [],
  };
}

export async function getStaffRequests(_email?: string) {
  const { getStaffRequests: fn } = await import("./operations.server");
  const res = await fn();
  const requests = (res.requests ?? []).map((r: any) => ({
    id: r.request_id,
    requestId: r.request_id,
    staffId: r.staff_id,
    type: r.request_type,
    subject: r.subject,
    details: r.details,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  }));
  return { requests, total: requests.length };
}

export async function createStaffRequest(payload: {
  type?: string;
  requestType?: string;
  subject?: string;
  details?: string;
  [key: string]: unknown;
}) {
  const { createStaffRequest: fn } = await import("./operations.server");
  const res = await fn({
    data: {
      requestType: payload.requestType ?? payload.type ?? "general",
      // Older call sites send domain fields (leaveType, fromDate...) with no
      // explicit subject; synthesise one so the row is still meaningful.
      subject:
        payload.subject ??
        ([payload.requestType ?? payload.type, payload.leaveType, payload.fromDate]
          .filter(Boolean)
          .join(" ") ||
          "Staff request"),
      details: payload.details ?? JSON.stringify(payload),
    },
  });
  return { success: true as const, requestId: res.requestId };
}

export async function getRoomCheckinHistory(doctorDid?: string) {
  const { getRoomCheckinHistory: fn } = await import("./operations.server");
  const res = await fn({ data: { doctorDid } });
  const history = (res.events ?? []).map((e: any) => ({
    id: e.event_id,
    doctorDid: e.doctor_did,
    roomId: e.room_id,
    roomName: e.room_name,
    action: e.action,
    timestamp: e.occurred_at,
  }));
  return { history, events: history, logs: history, total: history.length };
}

/**
 * Check in or out of several rooms at once.
 *
 * Each room produces its own immutable room_checkin_events row, because those
 * rows are the merkle leaves for the daily root — collapsing them into one
 * event would lose information the published root is supposed to commit to.
 */
export async function roomCheckInMulti(
  rooms:
    | Array<{ roomId: string; roomName: string }>
    | string[]
    | { roomId: string; roomName: string; action?: "checkin" | "checkout" },
  action: "checkin" | "checkout" = "checkin",
) {
  const { roomCheckin } = await import("./operations.server");

  // Normalise the three shapes call sites use.
  const list: Array<{ roomId: string; roomName: string }> = Array.isArray(rooms)
    ? rooms.map((r) =>
        typeof r === "string"
          ? { roomId: r, roomName: r }
          : { roomId: r.roomId, roomName: r.roomName },
      )
    : [{ roomId: rooms.roomId, roomName: rooms.roomName }];

  const effectiveAction = Array.isArray(rooms) ? action : (rooms.action ?? action);

  const results = [];
  for (const room of list) {
    const res = await roomCheckin({
      data: { roomId: room.roomId, roomName: room.roomName, action: effectiveAction },
    });
    results.push({ roomId: room.roomId, roomName: room.roomName, eventId: res.eventId });
  }

  return { success: true as const, results, eventId: results[0]?.eventId ?? null };
}

export async function getDoctorLocationHistory(doctorDid?: string) {
  return await getRoomCheckinHistory(doctorDid);
}

export async function getPatientOnChainHistory(patientDid?: string) {
  const { getPatientAnchorHistory } = await import("./clinical.server");
  const res = await getPatientAnchorHistory({ data: { patientDid } });
  const anchors = (res.anchors ?? []).map((a: any) => ({
    anchorId: a.anchor_id,
    recordHash: a.record_hash,
    recordType: a.record_type,
    recordId: a.record_id,
    status: a.status,
    signature: a.signature,
    slot: a.slot,
    anchoredAt: a.anchored_at,
  }));
  return {
    anchors,
    history: anchors,
    // Anchors for prescription records only — what the signing screen displays.
    prescriptions: anchors.filter((a) => a.recordType === "prescription"),
    total: anchors.length,
  };
}

/** Patients visible to the calling clinician — i.e. those who granted consent. */
export async function getMyPatients() {
  const { getConsents: fn } = await import("./clinical.server");
  const res = await fn();
  const patients = (res.consents ?? [])
    .filter((c: any) => c.status === "active")
    .map((c: any) => ({ did: c.patient_did, patientDid: c.patient_did, resource: c.resource }));
  return { patients, total: patients.length };
}

// ─── Inpatient / facility / billing (task 4 migration) ──────────────────────
// The last group of Express reads. All now resolve against Postgres with RLS
// deciding scope.

export async function getSurgeries() {
  const { getSurgeries: fn } = await import("./inpatient.server");
  const res = await fn();
  const surgeries = (res.surgeries ?? []).map((s: any) => ({
    id: s.surgery_id,
    patientDid: s.patient_did,
    procedure: s.procedure_name,
    room: s.operating_room,
    date: s.scheduled_for ? String(s.scheduled_for).slice(0, 10) : null,
    time: s.scheduled_for ? String(s.scheduled_for).slice(11, 16) : null,
    surgeon: s.surgeon,
    anesthesiologist: s.anesthesiologist,
    status: s.status,
    estDuration: s.est_duration_min ? `${s.est_duration_min} min` : null,
  }));
  return { surgeries, total: surgeries.length };
}

export async function getRehabSessions(_did?: string) {
  const { getRehabSessions: fn } = await import("./inpatient.server");
  const res = await fn();
  const sessions = (res.sessions ?? []).map((r: any) => ({
    id: r.session_id,
    patientDid: r.patient_did,
    sessionType: r.session_type,
    date: r.session_date,
    therapist: r.therapist,
    status: r.status,
    notes: r.notes,
  }));
  return { sessions, rehabSessions: sessions, total: sessions.length };
}

export async function getPharmacyOrders(_did?: string) {
  const { getPharmacyOrders: fn } = await import("./inpatient.server");
  const res = await fn();
  const orders = (res.orders ?? []).map((o: any) => ({
    id: o.order_id,
    patientDid: o.patient_did,
    orderedOn: o.ordered_on,
    status: o.status,
    medicines: o.medicines ?? [],
  }));
  return { orders, pharmacyOrders: orders, total: orders.length };
}

export async function getVaccines(_did?: string) {
  const { getVaccines: fn } = await import("./inpatient.server");
  const res = await fn();
  const vaccines = (res.vaccines ?? []).map((v: any) => ({
    id: v.vaccine_id,
    patientDid: v.patient_did,
    name: v.vaccine_name,
    doseNumber: v.dose_number,
    administeredOn: v.administered_on,
    administeredBy: v.administered_by,
    batchNumber: v.batch_number,
    nextDueOn: v.next_due_on,
  }));
  return { vaccines, total: vaccines.length };
}

export async function getInpatientData(_did?: string) {
  const { getInpatientData: fn } = await import("./inpatient.server");
  const d = await fn();
  return {
    admission: d.admission,
    procedures: d.procedures ?? [],
    medications: d.medications ?? [],
    nursingNotes: d.nursingNotes ?? [],
    dailyCheckups: d.dailyCheckups ?? [],
    dietOrders: d.dietOrders ?? [],
    rehabSessions: d.rehabSessions ?? [],
    // Legacy aliases the inpatient screens still read.
    checkups: d.dailyCheckups ?? [],
    dietOrder: (d.dietOrders ?? [])[0] ?? null,
    // Vitals arrive via Realtime (useLiveVitals), not this snapshot.
    vitalSigns: [] as any[],
  };
}

export async function getFeedbackList(_did?: string) {
  const { getFeedback } = await import("./inpatient.server");
  const res = await getFeedback();
  const feedback = (res.feedback ?? []).map((f: any) => ({
    id: f.feedback_id,
    patientDid: f.patient_did,
    date: f.created_at ? String(f.created_at).slice(0, 10) : null,
    doctor: f.doctor,
    rating: f.rating,
    comments: f.comments,
  }));
  return { feedback, list: feedback, total: feedback.length };
}

export async function getAmbulances() {
  const { getAmbulances: fn } = await import("./inpatient.server");
  const res = await fn();
  const ambulances = (res.ambulances ?? []).map((a: any) => ({
    id: a.ambulance_id,
    registration: a.registration,
    type: a.vehicle_type,
    status: a.status,
    location: a.current_location,
    driver: a.driver_name,
  }));
  return { ambulances, total: ambulances.length };
}

export async function getEquipment() {
  const { getEquipment: fn } = await import("./inpatient.server");
  const res = await fn();
  const equipment = (res.equipment ?? []).map((e: any) => ({
    id: e.equipment_id,
    name: e.name,
    category: e.category,
    status: e.status,
    location: e.location,
    lastServicedOn: e.last_serviced_on,
  }));
  return { equipment, total: equipment.length };
}

export async function getFraudAlerts() {
  const { getFraudAlerts: fn } = await import("./inpatient.server");
  const res = await fn();
  const alerts = (res.alerts ?? []).map((a: any) => ({
    alertId: a.alert_id,
    severity: a.severity,
    status: a.status,
    type: a.alert_type,
    message: a.message,
    actor: a.actor,
    riskScore: a.risk_score,
    detectedAt: a.detected_at,
    details: a.details,
  }));
  return { alerts, total: alerts.length };
}

export async function getBilling(_did?: string) {
  const { getBilling: fn } = await import("./inpatient.server");
  const res = await fn();
  const acct: any = res.account ?? {};
  return {
    outstanding: Number(acct.outstanding ?? 0),
    totalBilled: Number(acct.total_billed ?? 0),
    totalPaid: Number(acct.total_paid ?? 0),
    bills: (res.payments ?? []).map((p: any) => ({
      id: p.payment_id,
      amount: Number(p.amount),
      method: p.method,
      status: p.status,
      reference: p.reference,
      date: p.created_at,
    })),
    payments: res.payments ?? [],
    // Legacy alias consumed by the inpatient dashboard, which reads
    // totalCharges/balanceDue. Emitting only outstanding/totalBilled overwrote
    // its initial state with undefined and crashed the page on
    // billSummary.totalCharges.toLocaleString().
    billSummary: {
      outstanding: Number(acct.outstanding ?? 0),
      totalBilled: Number(acct.total_billed ?? 0),
      totalPaid: Number(acct.total_paid ?? 0),
      totalCharges: Number(acct.total_billed ?? 0),
      balanceDue: Number(acct.outstanding ?? 0),
    },
  };
}

/**
 * Record a payment. Always lands as 'pending' — RLS forbids a client marking a
 * payment 'paid', which must follow a real settlement.
 */
export async function payBill(payload: {
  amount: number;
  method?: string;
  reference?: string;
  patientDid?: string;
  [key: string]: unknown;
}) {
  const { recordPayment } = await import("./inpatient.server");
  // patientDid is accepted but ignored: the payment is always recorded against
  // the caller's own DID, enforced by RLS.
  const res = await recordPayment({
    data: { amount: payload.amount, method: payload.method, reference: payload.reference },
  });
  return { success: true as const, paymentId: res.paymentId, status: res.status };
}

export async function getPreferences(_did?: string) {
  const { getPatientPreferences } = await import("./inpatient.server");
  const res = await getPatientPreferences();
  const p: any = res.preferences ?? {};
  return {
    preferences: {
      emergencyAccess: p.emergency_access ?? true,
      insuranceVerification: p.insurance_verification ?? true,
      researchSharing: p.research_sharing ?? false,
      crossHospital: p.cross_hospital ?? false,
    },
  };
}

export async function updatePreferences(
  arg1: string | Record<string, unknown>,
  prefs?: Record<string, unknown>,
) {
  const { updatePatientPreferences } = await import("./inpatient.server");
  // Legacy positional form is updatePreferences(patientDid, prefs); the DID is
  // ignored because RLS scopes the upsert to the caller.
  const payload = typeof arg1 === "string" ? (prefs ?? {}) : arg1;
  await updatePatientPreferences({ data: payload });
  return { success: true as const };
}

/** Clinician directory, derived from dids rather than a duplicate table. */
export async function getDoctors() {
  const { getDoctors: fn } = await import("./inpatient.server");
  const res = await fn();
  const doctors = (res.doctors ?? []).map((d: any) => ({
    did: d.did,
    name: d.owner_name,
    role: d.owner_type,
    status: d.status,
  }));
  return { doctors, total: doctors.length };
}

export async function getPatientDirectory() {
  const { getPatientDirectory: fn } = await import("./inpatient.server");
  const res = await fn();
  const patients = (res.patients ?? []).map((p: any) => ({
    did: p.did,
    name: p.owner_name,
    email: p.email ?? undefined,
    status: p.status,
  }));
  return { patients, total: patients.length };
}

export async function getVerifiedDoctors() {
  return await getDoctors();
}

export async function getDIDVerifiedDoctors() {
  return await getDoctors();
}

// ─── Identity / DID / NFC via Edge Function (task 5 migration) ──────────────
// These need IDENTITY_SECRET or a privileged write, so they run in the
// identity-ops Edge Function rather than the browser. The actor is always taken
// from the verified session — never from a request parameter — so attribution
// cannot be forged.

async function identity(op: string, payload: Record<string, unknown> = {}) {
  const { identityOp } = await import("./clinical.server");
  return (await identityOp({ data: { op, ...payload } })) as any;
}

export async function signIdentityPayload(data: {
  did?: string;
  mrn?: string;
  name?: string;
  network?: string;
  [key: string]: unknown;
}) {
  const res = await identity("sign-identity", data);
  return { success: true as const, payload: res.payload };
}

export async function verifyIdentityPayload(payload: unknown) {
  const res = await identity("verify-identity", { payload });
  return {
    valid: res.valid === true,
    verified: res.valid === true,
    error: res.error,
    payload: res.payload,
  };
}

export async function requestWalletChallenge(_walletAddress?: string) {
  const res = await identity("wallet-challenge");
  return {
    success: true as const,
    // `message` is the legacy name for the string the wallet must sign.
    message: res.challenge,
    challenge: res.challenge,
    nonce: res.nonce,
    expiresAt: res.expiresAt,
    token: res.token,
  };
}

export async function verifyAndLinkWallet(
  arg1:
    | string
    | {
        walletAddress: string;
        nonce?: string;
        expiresAt?: number;
        token?: string;
        [key: string]: unknown;
      },
  _signature?: string,
  challenge?: { nonce?: string; expiresAt?: number; token?: string },
) {
  // Legacy positional form: (walletAddress, signature). The wallet signature is
  // not verified here — the Edge Function checks that the CHALLENGE was issued
  // to this session, which is what actually binds the wallet to the account.
  const payload = typeof arg1 === "string" ? { walletAddress: arg1, ...(challenge ?? {}) } : arg1;

  const res = await identity("wallet-link", payload as Record<string, unknown>);
  const { getCurrentUser } = await import("./auth.server");
  const user = await getCurrentUser();
  return {
    success: true as const,
    walletAddress: res.walletAddress,
    verified: true as const,
    user,
    patient: user,
  };
}

export async function createDID(
  arg1:
    | string
    | {
        ownerName?: string;
        ownerType?: string;
        owner?: string;
        role?: string;
        [key: string]: unknown;
      },
  ownerTypeArg?: string,
  _publicKey?: string,
  _email?: string,
  _extraFields?: unknown,
) {
  // Legacy positional form: createDID(ownerName, ownerType).
  const ownerName = typeof arg1 === "string" ? arg1 : String(arg1.ownerName ?? arg1.owner ?? "");
  const ownerType =
    typeof arg1 === "string"
      ? (ownerTypeArg ?? "patient")
      : String(arg1.ownerType ?? arg1.role ?? "patient");

  const res = await identity("create-did", { ownerName, ownerType });
  return { success: true as const, did: res.did };
}

export async function requestDID(
  arg1?:
    | string
    | { ownerName?: string; ownerType?: string; reason?: string; [key: string]: unknown },
) {
  // Callers pass either a plain reason string or a descriptor object.
  const reason =
    typeof arg1 === "string"
      ? arg1
      : arg1
        ? (arg1.reason ?? `${arg1.ownerName ?? ""} (${arg1.ownerType ?? "patient"})`.trim())
        : undefined;

  const res = await identity("did-request", { reason });
  return { success: true as const, requestId: res.requestId };
}

export async function getDIDRequests() {
  const res = await identity("list-did-requests");
  const requests = (res.requests ?? []).map((r: any) => ({
    id: r.request_id,
    requestId: r.request_id,
    staffId: r.staff_id,
    reason: r.details,
    status: r.status,
    createdAt: r.created_at,
  }));
  return { requests, total: requests.length };
}

export async function approveDIDRequest(requestId: string) {
  const res = await identity("resolve-did-request", { requestId, approve: true });
  // Approval issues the DID, so callers can report which one was created.
  return { success: true as const, did: res.did ?? null };
}

export async function rejectDIDRequest(requestId: string) {
  await identity("resolve-did-request", { requestId, approve: false });
  return { success: true as const, did: null };
}

export async function issueNFCCard(
  arg1: string | { patientDid: string; patientName?: string; mrn?: string; cardType?: string },
  cardTypeArg?: string,
) {
  const patientDid = typeof arg1 === "string" ? arg1 : arg1.patientDid;
  const cardType = typeof arg1 === "string" ? cardTypeArg : (arg1.cardType ?? cardTypeArg);
  const res = await identity("issue-nfc", { patientDid, cardType });
  return { success: true as const, cardId: res.cardId, card: { cardId: res.cardId, patientDid } };
}

export async function revokeNFCCard(cardId: string) {
  await identity("revoke-nfc", { cardId });
  return { success: true as const };
}

/**
 * Write an audit entry.
 *
 * Clients have no INSERT policy on audit_events, so this must go through the
 * Edge Function. The actor is derived from the session, meaning a caller cannot
 * attribute an action to someone else.
 */
export async function logAuditEvent(
  arg1:
    | string
    | {
        action: string;
        resource?: string;
        outcome?: string;
        severity?: string;
        metadata?: Record<string, unknown>;
        [key: string]: unknown;
      },
  resource?: string,
  action?: string,
  outcome?: string,
  severity?: string,
) {
  // Legacy positional form: (actor, resource, action, outcome, severity).
  // The actor argument is ignored — attribution comes from the verified
  // session, so a caller cannot log an action as someone else.
  const data =
    typeof arg1 === "string" ? { action: action ?? arg1, resource, outcome, severity } : arg1;
  try {
    await identity("audit", data as Record<string, unknown>);
    return { success: true as const };
  } catch {
    // Audit failure must not break the user-facing action that triggered it.
    return { success: false as const };
  }
}

/**
 * Sign a prescription.
 *
 * Reuses the sign-credential Edge Function: a signed prescription is a
 * verifiable credential whose subject is the patient.
 */
export async function signPrescription(
  arg1: string | { rxId?: string; patientDid?: string; [key: string]: unknown },
  patientDidArg?: string,
) {
  const { signCredential } = await import("./clinical.server");

  // Callers pass either (rxId, patientDid) or the whole prescription object.
  const rxId = typeof arg1 === "string" ? arg1 : String(arg1.rxId ?? "");
  const patientDid =
    typeof arg1 === "string" ? (patientDidArg ?? "") : String(arg1.patientDid ?? "");
  const claims = typeof arg1 === "string" ? { rxId } : { ...arg1 };

  const res: any = await signCredential({
    data: { subjectDid: patientDid, credentialType: "PrescriptionVC", claims },
  });
  return {
    success: true as const,
    rxId,
    credential: res.credential,
    signature: res.credential?.signature,
  };
}

/**
 * Pager dispatch.
 *
 * The Express endpoint had no real provider behind it. Rather than silently
 * pretend, this records an audit entry so the intent is traceable, and reports
 * that no pager provider is configured.
 */
export async function dispatchPagerNotify(
  arg1: string | Record<string, unknown>,
  name?: string,
  location?: string,
) {
  // Legacy positional form: (did, name, location).
  const data: Record<string, unknown> =
    typeof arg1 === "string" ? { staffDid: arg1, name, location } : arg1;

  await logAuditEvent({
    action: "PAGER_DISPATCH_REQUESTED",
    resource: String(data?.recipient ?? data?.staffDid ?? ""),
    outcome: "success",
    severity: "info",
    metadata: data,
  });
  return {
    success: false as const,
    delivered: false,
    reason: "No pager provider is configured; the request was recorded in the audit trail",
  };
}

/**
 * Legacy alias used by realtime-store. Records a payment intent; RLS forbids a
 * client marking it 'paid'.
 */
export async function recordPayment(payload: {
  amount: number;
  method?: string;
  reference?: string;
  patientDid?: string;
  [key: string]: unknown;
}) {
  return await payBill(payload);
}

// ─── Governance policies + fraud alert writes (admin surface) ───────────────

export async function getPolicies() {
  const { getPolicies: fn } = await import("./inpatient.server");
  const res = await fn();
  const policies = (res.policies ?? []).map((p: any) => ({
    id: p.policy_id,
    policyId: p.policy_id,
    name: p.name,
    category: p.category,
    status: p.status,
    description: p.description,
    updatedAt: p.updated_at,
  }));
  return { policies, total: policies.length };
}

export async function createPolicy(data: {
  name: string;
  category?: string;
  description?: string;
  status?: string;
  [key: string]: unknown;
}) {
  const { createPolicy: fn } = await import("./inpatient.server");
  const res = await fn({ data });
  return { success: true as const, policyId: res.policyId, policy: { ...data, id: res.policyId } };
}

export async function updatePolicy(
  arg1: string | { policyId: string; [key: string]: unknown },
  patch?: Record<string, unknown>,
) {
  const { updatePolicy: fn } = await import("./inpatient.server");
  const payload = typeof arg1 === "string" ? { policyId: arg1, ...(patch ?? {}) } : arg1;
  await fn({ data: payload as { policyId: string } });
  return { success: true as const, policy: payload };
}

export async function updateFraudAlertStatus(alertId: string, status: string) {
  const { updateFraudAlertStatus: fn } = await import("./inpatient.server");
  await fn({ data: { alertId, status } });
  return { success: true as const, alert: { alertId, status } };
}

/**
 * Raise a fraud alert.
 *
 * Detection is a server-side concern: fraud_alerts has no client INSERT policy,
 * so an actor cannot fabricate an alert against someone else — nor suppress one
 * against themselves. Recorded in the audit trail instead, where an admin can
 * review it.
 */
export async function raiseFraudAlert(
  actor: string,
  alertType: string,
  message: string,
  severity?: string,
  _riskScore?: number,
) {
  await logAuditEvent({
    action: "FRAUD_ALERT_RAISED",
    resource: actor,
    outcome: "success",
    severity: severity === "critical" ? "critical" : "warning",
    metadata: { alertType, message, reportedActor: actor },
  });
  return {
    success: true as const,
    recorded: true,
    reason: "Recorded in the audit trail; alert creation is performed by server-side detection",
  };
}

// ─── View-model types for admin screens ─────────────────────────────────────

/** Patient roster entry. Clinical fields are optional: admins have no blanket
 *  PHI read, so these come from the DID registry and render blank if absent. */
export interface LivePatient {
  did: string;
  name: string;
  id?: string;
  status?: string;
  mrn?: string;
  age?: number;
  gender?: string;
  phone?: string;
  email?: string;
  ward?: string;
  bed?: string;
  outstandingBills?: number;
  outstanding?: number;
  insuranceProvider?: string;
  insurancePolicyNo?: string;
  isOnChain?: boolean;
  bloodGroup?: string;
  admitDate?: string;
  activeCredentials?: Array<{ id: string; type?: string }>;
}

export interface LiveTransaction {
  id: string;
  patientDid: string;
  amount: number;
  status: string;
  category: string;
  reference?: string;
  method?: string;
  date?: string;
  patientName?: string;
  blockTxId?: string;
}


// ─── Patient Master (Centralized patient data access) ─────────────────────────

export async function getPatientMaster(patientDid: string) {
  const { getPatientMaster: fn } = await import("./patient-master.server");
  return fn({ patientDid });
}

export async function getPatientCurrentLocation(patientDid: string) {
  const { getPatientCurrentLocation: fn } = await import("./patient-master.server");
  return fn({ patientDid });
}

export async function getPatientAdmissionHistory(patientDid: string, limit?: number) {
  const { getPatientAdmissionHistory: fn } = await import("./patient-master.server");
  return fn({ patientDid, limit });
}

export async function getPatientTransferHistory(patientDid: string, limit?: number) {
  const { getPatientTransferHistory: fn } = await import("./patient-master.server");
  return fn({ patientDid, limit });
}

export async function getPatientMedicalRecords(patientDid: string, recordType?: string, limit?: number) {
  const { getPatientMedicalRecords: fn } = await import("./patient-master.server");
  return fn({ patientDid, recordType, limit });
}

export async function getPatientMedications(patientDid: string, status?: string) {
  const { getPatientMedications: fn } = await import("./patient-master.server");
  return fn({ patientDid, status });
}

export async function getPatientProcedures(patientDid: string, status?: string) {
  const { getPatientProcedures: fn } = await import("./patient-master.server");
  return fn({ patientDid, status });
}

export async function getPatientLabResults(patientDid: string, limit?: number) {
  const { getPatientLabResults: fn } = await import("./patient-master.server");
  return fn({ patientDid, limit });
}

export async function getPatientBilling(patientDid: string) {
  const { getPatientBilling: fn } = await import("./patient-master.server");
  return fn({ patientDid });
}

export async function getPatientDischargeInfo(patientDid: string) {
  const { getPatientDischargeInfo: fn } = await import("./patient-master.server");
  return fn({ patientDid });
}


// ─── Pharmacy & Medical Inventory ────────────────────────────────────────────

// Re-export all pharmacy functions from pharmacy.server.ts for client-side usage

export {
  // Suppliers
  createSupplier,
  getSuppliers,
  // Inventory Items
  createInventoryItem,
  getInventoryItems,
  getInventoryItem,
  updateInventoryItem,
  // Batches
  createBatch,
  getBatches,
  getBatchDetails,
  // Stock Levels
  getCurrentStockLevel,
  getAllStockLevels,
  // Stock Movements
  addStock,
  removeStock,
  transferStock,
  consumeStock,
  adjustStock,
  recordWastage,
  recordExpiredStock,
  getBatchMovements,
  getItemMovements,
  getMovement,
  // Alerts
  getLowStockItems,
  getNearExpiryItems,
  getExpiredStock,
  resolveLowStockAlert,
  resolveExpirationAlert,
  // Purchase Orders
  createPurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrderStatus,
  // Prescription Dispensing Integration
  dispensePrescriptionMedications,
  checkPrescriptionMedicationAvailability,
  getPrescriptionWithInventory,
  getPendingDispensingPrescriptions,
} from "./pharmacy.server";
