/**
 * API client — the boundary between route components and the server functions
 * in `*.server.ts`.
 *
 * (The old header said this "connects directly to the REST server on :3001".
 * That Express backend was decommissioned; everything here reaches Postgres
 * through TanStack server functions with RLS applied.)
 *
 * Response shapes live in `./types/api`. DECLARE the return type on a function
 * rather than letting it infer — inference widens to whatever the mapper
 * happens to produce, which is precisely how the field-name drift that broke
 * consent revoke, the vaccines page and the Rehab tab went unnoticed.
 */

import type {
  BillingResponse,
  ConsentsResponse,
  InsuranceClaimsResponse,
  InsurancePolicyResponse,
  RehabSessionsResponse,
  VaccinesResponse,
} from "./types/api";

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

// The apiFetch() helper that used to live here is gone. It was the last path to
// the decommissioned Express backend, kept alive by three consent helpers; the
// comment above already claimed nothing issued HTTP requests to Express, which
// only became true once those were ported. Removed so it cannot be reused.

// ─── DIDs ─────────────────────────────────────────────────────────────────────

// ─── Credentials ──────────────────────────────────────────────────────────────

// ─── Consent ──────────────────────────────────────────────────────────────────
// Note: getConsents, grantConsent, revokeConsent, getConsentRequests,
// denyConsentRequest are implemented as Supabase-native async functions
// further down in this file. Only the doctor-portal-specific helpers live here.

/**
 * Doctor/Staff: consent grants and requests involving the authenticated clinician.
 *
 * These three helpers were the last Express holdouts in the app: they issued HTTP
 * calls to `${API_BASE_URL}/consent/*`, defaulting to http://localhost:3001, a
 * server decommissioned during the Supabase migration. The fetches failed with
 * ERR_CONNECTION_REFUSED, and because /staff/consent swallowed the error the page
 * rendered "0 Active Consent" instead of reporting anything wrong.
 *
 * consents_select_involved already lets a clinician see rows where doctor_did is
 * one of theirs, so the read needs no new privileges — only the right transport.
 */
export async function getMyConsents() {
  const { getConsents: fn } = await import("./clinical.server");
  const res = await fn();
  const rows = res.consents ?? [];

  const map = (c: any) => ({
    grantId: c.grant_id,
    patientDid: c.patient_did,
    doctorDid: c.doctor_did,
    resource: c.resource,
    status: c.status,
    grantedAt: c.granted_at,
    expiry: c.expires_at,
    expiresAt: c.expires_at,
    revokedAt: c.revoked_at,
  });

  // RLS returns rows where the caller is either party. A clinician's own DIDs are
  // not exposed to the client, so split on status rather than trying to guess
  // which side the caller is: an active row is a grant they hold, a pending row is
  // a request awaiting the patient.
  const grants = rows.filter((c: any) => c.status === "active").map(map);
  const requests = rows.filter((c: any) => c.status === "pending").map(map);
  const all = rows.map(map);

  // "Active" must mean the same thing here as it does in the database, where
  // private.has_active_consent() requires status = 'active' AND (expires_at is
  // null OR expires_at > now()). Counting status alone reported grants that no
  // longer open any records — the KPI said 5 while the tab listing them said 3.
  // A null expiry means the grant does not expire.
  const stillValid = (c: { expiry?: string | null }) =>
    !c.expiry || new Date(c.expiry).getTime() > Date.now();
  const activeGrants = grants.filter(stillValid);

  return {
    grants,
    requests,
    consents: all,
    totalGrants: grants.length,
    totalRequests: requests.length,
    active: activeGrants.length,
    pending: requests.length,
  };
}

/** Doctor/Staff: only the pending requests awaiting a patient decision. */
export async function getMyConsentRequests() {
  const { requests } = await getMyConsents();
  return { requests, total: requests.length };
}

/**
 * Doctor/Staff: ask a patient for access.
 *
 * `doctorDid` is accepted for call-site compatibility but ignored — the server
 * takes the requesting DID from the session, so a clinician cannot raise a
 * request in someone else's name.
 */
export async function requestConsent(data: {
  doctorDid?: string;
  doctorName?: string;
  patientDid: string;
  resource: string;
  reason?: string;
  expiry?: string;
  expiresAt?: string;
}) {
  const { requestConsentAccess } = await import("./clinical.server");
  const res = await requestConsentAccess({
    data: {
      patientDid: data.patientDid,
      resource: data.resource,
      expiresAt: data.expiresAt ?? data.expiry,
    },
  });
  return { success: true as const, requestId: res.grantId, request: null, txId: "" };
}

/** Patient: approve a pending request in place, keeping one row per decision. */
export async function approveConsentRequest(grantId: string, expiresAt?: string) {
  const { approveConsentRequest: fn } = await import("./clinical.server");
  await fn({ data: { grantId, expiresAt } });
  return { success: true as const };
}

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

export async function getPrescriptions(did?: string) {
  const { getPrescriptions: fn, getPrescriptionsForPatient } = await import("./clinical.server");
  // The DID was named `_did` and dropped, so the unfiltered query ran and every
  // consumer got every prescription RLS allowed the caller to see. RLS lets a
  // clinician see all their consented patients, so opening ONE patient's chart
  // listed OTHER patients' prescriptions under that patient's name — verified
  // as dr.smith: 4 rows across 2 distinct patients.
  //
  // Callers who pass no DID (the ledger and admin views) still get the full
  // RLS-scoped set, which is what they want.
  const res = did ? await getPrescriptionsForPatient({ data: { patientDid: did } }) : await fn();
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
      signedBy: p.signed_by ?? null,
      signedAt: p.signed_at,
      hash: p.content_hash,
      apptId: p.appointment_id ?? null,
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
  },
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
  },
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

export async function getAdmissionEvents(
  opts: {
    admissionId?: string;
    patientDid?: string;
    limit?: number;
  } = {},
) {
  const { getAdmissionEvents: fn } = await import("./admissions.server");
  return await fn({ data: opts });
}

export async function getWardOccupancy() {
  const { getWardOccupancy: fn } = await import("./admissions.server");
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
      // The ordering clinician's urgency. Carried through so the queue can show
      // a STAT order as STAT; it used to be dropped and re-invented as routine.
      priority: l.priority,
      resultedAt: l.resulted_at,
    })),
  };
}

/**
 * Pending consent requests awaiting the patient's decision.
 *
 * Two things were wrong here. It returned EVERY consent row rather than only the
 * pending ones, so active grants and revoked history showed up in the patient's
 * "Requests" tab. And it exposed the row's identity as `grantId` while the
 * consumer read `r.id ?? r.requestId`, so every request fell through to
 * `String(Math.random())` — approve and deny then addressed a grant_id that does
 * not exist and always failed.
 *
 * Doctor names are resolved from the DID registry, the same way appointment names
 * are: `consents` stores DIDs only, and the UI previously substituted a
 * hardcoded "Dr. Specialist" for every requester.
 */
export async function getConsentRequests(_did?: string) {
  const { getConsents: fn, getAllDIDs: didsFn } = await import("./clinical.server");
  const res = await fn();

  const pending = (res.consents ?? []).filter((c: any) => c.status === "pending");
  if (pending.length === 0) return { requests: [], total: 0 };

  let nameByDid: Record<string, string> = {};
  try {
    const didRes = await didsFn();
    nameByDid = Object.fromEntries(
      (didRes.dids ?? []).map((d: any) => [d.did, d.owner_name]).filter(([, n]) => Boolean(n)),
    );
  } catch {
    // Name resolution is cosmetic; the request itself must still be actionable.
  }

  const requests = pending.map((c: any) => ({
    // Both keys point at the real primary key so either consumer spelling works.
    id: c.grant_id,
    grantId: c.grant_id,
    requestId: c.grant_id,
    patientDid: c.patient_did,
    doctorDid: c.doctor_did,
    doctorName: nameByDid[c.doctor_did] ?? c.doctor_did,
    resource: c.resource,
    status: c.status,
    requestedAt: c.granted_at,
    grantedAt: c.granted_at,
    expiry: c.expires_at,
    expiresAt: c.expires_at,
    revokedAt: c.revoked_at,
  }));

  return { requests, total: requests.length };
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
    // The bed label staff actually use at the bedside ("C204-A"). It was dropped
    // here, so every consumer fell back to the opaque bed_id or invented one.
    bedNumber: b.bed_number ?? null,
    bedType: b.bed_type ?? null,
    ward: b.ward,
    wardId: b.ward_id ?? null,
    roomId: b.room_id ?? null,
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
    checkedInRooms: rows.filter((c: any) => c.lastAction === "checkin"),
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
      events.map((e: any) =>
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

export async function getInsuranceClaims(_did?: string): Promise<InsuranceClaimsResponse> {
  const { getInsuranceClaims: fn } = await import("./operations.server");
  const res = await fn();
  return {
    /**
     * ClaimsCard reads claimNo / claimType / insuranceProvider / submittedDate /
     * processedDate / remarks / approvedAmount. insurance_claims has none of
     * those columns (claim_id, patient_did, amount, description, status,
     * submitted_at, resolved_at), so every claim rendered with blank fields and
     * an undefined React key. Aliased to what exists; the rest are explicitly
     * null so the card can omit them rather than render empty labels.
     */
    claims: (res.claims ?? []).map((c: any) => ({
      claimId: c.claim_id,
      id: c.claim_id,
      claimNo: c.claim_id,
      patientDid: c.patient_did,
      amount: c.amount,
      description: c.description,
      remarks: c.description ?? null,
      status: c.status,
      submittedAt: c.submitted_at,
      submittedDate: c.submitted_at,
      processedDate: c.resolved_at ?? null,
      claimType: null as string | null,
      insuranceProvider: null as string | null,
      approvedAmount: null as number | null,
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
  /**
   * insurance_claims stores only amount and description, so the form's Claim
   * Category, Diagnosis, Provider and Policy No have nowhere to go. Rather than
   * discard them silently — the form collected four fields that vanished — fold
   * them into the description so the information survives.
   */
  const extras = [
    payload.claimType ? `Type: ${payload.claimType}` : null,
    payload.claimDiagnosis ? `Diagnosis: ${payload.claimDiagnosis}` : null,
    payload.provider ? `Provider: ${payload.provider}` : null,
    payload.policyNo ? `Policy: ${payload.policyNo}` : null,
  ].filter(Boolean);

  const description = [payload.description, ...extras].filter(Boolean).join(" · ");

  const res = await fn({ data: { amount: payload.amount, description } });
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

/**
 * The patient's real insurance policy.
 *
 * insurance_policies is scoped by RLS to the caller. The insurance page never
 * called this — it displayed hardcoded fallbacks instead ("Star Health & Allied
 * Insurance", "POL-2026-STAR-9942", ₹10,00,000 sum insured), identical for every
 * patient, including patients with no policy at all.
 */
export async function getInsurancePolicy(): Promise<InsurancePolicyResponse> {
  const { getInsurancePolicy: fn } = await import("./operations.server");
  const { policy } = await fn();
  if (!policy) return { policy: null };
  const p = policy as any;
  return {
    policy: {
      provider: p.provider ?? null,
      policyNumber: p.policy_number ?? null,
      groupNumber: p.group_number ?? null,
      coverageType: p.coverage_type ?? null,
      copay: p.copay ?? null,
      deductible: p.deductible ?? null,
      coveragePercentage: p.coverage_percentage ?? null,
      validFrom: p.valid_from ?? null,
      validTo: p.valid_to ?? null,
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

export async function getConsents(_did?: string): Promise<ConsentsResponse> {
  const { getConsents: fn } = await import("./clinical.server");
  const res = await fn();
  const consents: any[] = (res.consents ?? []).map((c: any) => ({
    grantId: c.grant_id,
    patientDid: c.patient_did,
    doctorDid: c.doctor_did,
    resource: c.resource,
    status: c.status,
    reason: c.reason ?? null,
    grantedAt: c.granted_at,
    expiry: c.expires_at,
    expiresAt: c.expires_at,
    requestedAt: c.requested_at ?? null,
    approvedAt: c.approved_at ?? null,
    revokedAt: c.revoked_at ?? null,
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
  const { getHospitalDirectory } = await import("./inpatient.server");
  const res = await fn();

  // Resolve which hospital each appointment is at. The UI previously printed a
  // constant "Embrace Health Grid" for every row, so a patient attending two
  // different hospitals saw the same label on both.
  let hospitalName: Record<string, string> = {};
  try {
    const hRes = await getHospitalDirectory();
    hospitalName = Object.fromEntries(
      (hRes.hospitals ?? []).map((h: any) => [h.hospital_id, h.name]),
    );
  } catch {
    // Presentational only.
  }

  const appointments: any[] = (res.appointments ?? []).map((a: any) => ({
    hospitalId: a.hospital_id ?? null,
    hospitalName: a.hospital_id ? (hospitalName[a.hospital_id] ?? null) : null,
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
  /** Patient's stated symptoms. Persists to appointments.reason. */
  reason?: string;
  [key: string]: unknown;
}) {
  const { bookAppointment: fn } = await import("./clinical.server");
  // Forward an explicit shape rather than the whole payload: the route also
  // sends `date` and `consentGranted`, neither of which has a column, and
  // passing them through implied they were being stored.
  const res = await fn({
    data: {
      doctorDid: payload.doctorDid,
      slot: payload.slot,
      specialty: payload.specialty,
      mode: payload.mode,
      reason: payload.reason,
    },
  });
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
    // Real values, previously unselected and substituted with constants or
    // string manipulations of the tx id in the UI.
    actorName: e.who_name ?? null,
    actorRole: e.who_role ?? null,
    entityId: e.what_entity_id ?? null,
    entityType: e.what_entity_type ?? null,
    recordHash: e.record_hash ?? null,
    anchorStatus: e.anchor_status ?? null,
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
  priority?: string,
) {
  const { orderLabTest } = await import("./clinical.server");
  // Call sites pass either a single test name or a list.
  const name = Array.isArray(testName)
    ? testName.join(", ") || "Unspecified panel"
    : (testName ?? "Unspecified panel");
  // `priority` was named `_priority` and dropped here, so a STAT order was
  // filed as routine and then displayed back as routine.
  const res = await orderLabTest({
    data: { patientDid, testName: name, priority: priority ?? "routine" },
  });
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

/**
 * Update the signed-in user's profile.
 *
 * Only `name` used to be forwarded; every other field the edit dialog collected
 * was dropped on the floor here, which is why an edit reported success and then
 * appeared to change nothing.
 */
/**
 * This wrapper forwards an explicit field list, so anything not named here is
 * dropped on the floor. That is what made the staff profile dialog report
 * success while silently discarding Department, Role and Specializations —
 * three of its five fields never reached the server function at all.
 *
 * `role` stays unforwarded on purpose: it is the authorization role, and RLS
 * (profiles_update_own) rejects a self-change to it. Job title goes to `title`.
 */
export async function updateProfile(data: {
  name?: string;
  fullName?: string;
  phone?: string;
  age?: number | string;
  gender?: string;
  bloodGroup?: string;
  allergies?: string[] | string;
  department?: string;
  title?: string;
  specializations?: string[] | string;
  employeeId?: string;
  [key: string]: unknown;
}) {
  const { updateOwnProfile } = await import("./clinical.server");
  await updateOwnProfile({
    data: {
      fullName: data.fullName ?? data.name,
      phone: data.phone,
      age: data.age,
      gender: data.gender,
      bloodGroup: data.bloodGroup,
      allergies: data.allergies,
      department: data.department,
      title: data.title,
      specializations: data.specializations,
      employeeId: data.employeeId,
    },
  });
  const { getCurrentUser } = await import("./auth.server");
  const user = await getCurrentUser();
  return { success: true as const, user, patient: user };
}

/**
 * Emergency card fields: blood group and allergies.
 *
 * These are real columns on profiles now, so this persists. It previously
 * accepted the write, discarded it with `void data`, and returned success — the
 * emergency card silently never changed.
 */
export async function updateEmergencyProfile(data: {
  bloodGroup?: string;
  blood_group?: string;
  allergies?: string[] | string;
  emergencyContact?: { name?: string; relation?: string; phone?: string } | null;
  organDonor?: boolean | null;
  conditions?: string[] | string;
  [key: string]: unknown;
}) {
  const { updateOwnProfile } = await import("./clinical.server");
  // Forwards all five fields now that 20260825020000 gives the other three
  // columns. Previously only blood group and allergies could persist.
  await updateOwnProfile({
    data: {
      bloodGroup: (data.bloodGroup ?? data.blood_group) as string | undefined,
      allergies: data.allergies,
      emergencyContact: data.emergencyContact as
        | { name?: string; relation?: string; phone?: string }
        | null
        | undefined,
      organDonor: data.organDonor as boolean | null | undefined,
      conditions: data.conditions as string[] | string | undefined,
    },
  });
  const { getCurrentUser } = await import("./auth.server");
  const user = await getCurrentUser();
  return { success: true as const, patient: user, user };
}

/**
 * Check that a consent decision still matches what the patient signed.
 *
 * Returns { signed, valid, reason } — `signed:false` for decisions recorded
 * before consent signing existed, which is not the same as an invalid one.
 */
/**
 * The signed-in user's own DID keypair — public and private.
 *
 * Owner-only: the server resolves which DIDs belong to auth.uid() and refuses
 * anything else. The base58 secret imports into any Solana wallet, so the
 * subject can hold the identity themselves rather than only through this app.
 */
export async function getMyKeypair(did?: string) {
  const { getMyKeypair: fn } = await import("./wallets.server");
  return await fn({ data: did ? { did } : {} });
}

export async function verifyConsentRecord(grantId: string) {
  const { verifyConsent } = await import("./wallets.server");
  return await verifyConsent({ data: { grantId } });
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

export async function getRehabSessions(_did?: string): Promise<RehabSessionsResponse> {
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

export async function getVaccines(_did?: string): Promise<VaccinesResponse> {
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

export async function getInpatientData(did?: string) {
  const { getInpatientData: fn } = await import("./inpatient.server");
  const d = await fn();

  // Same defect as getPrescriptions above: the DID was named `_did` and
  // discarded, and inpatient.server does an unfiltered selectAll. A clinician
  // opening one patient's chart therefore saw every consented patient's
  // medications, procedures, checkups and notes under that patient's name.
  //
  // Filtered here rather than server-side because the same server fn also backs
  // ward-wide views that legitimately want everything; those pass no DID.
  const onlyForPatient = <T extends { patient_did?: string | null }>(
    rows: T[] | null | undefined,
  ) => (did ? (rows ?? []).filter((r) => r.patient_did === did) : (rows ?? []));

  d.procedures = onlyForPatient(d.procedures as any);
  d.medications = onlyForPatient(d.medications as any);
  d.dailyCheckups = onlyForPatient(d.dailyCheckups as any);
  d.dietOrders = onlyForPatient(d.dietOrders as any);
  d.rehabSessions = onlyForPatient(d.rehabSessions as any);
  d.nursingNotes = onlyForPatient(d.nursingNotes as any);
  /**
   * Map snake_case rows to the camelCase the screens read.
   *
   * selectAll() does `select("*")` and returned raw Postgres rows, while the
   * inpatient page read camelCase — so `proc.scheduledDate` rendered "Invalid
   * Date", `med.prescribedBy` rendered "Prescribed by: undefined",
   * `note.nurse` rendered "undefined • Wound care", `checkup.date` never
   * matched so "Today's Checkups" was always blank, and every React `key`
   * (`.id`) was undefined. Mapping once here fixes all of them, and keeps the
   * boundary honest for any future consumer.
   */
  const procedures = (d.procedures ?? []).map((r: any) => ({
    ...r,
    id: r.procedure_id,
    scheduledDate: r.scheduled_for,
    scheduledTime: r.scheduled_for,
    completedAt: r.completed_at,
    performedBy: r.performed_by,
  }));

  const medications = (d.medications ?? []).map((r: any) => ({
    ...r,
    id: r.medication_id,
    startedOn: r.started_on,
    prescribedBy: r.prescribed_by,
    nextDose: r.next_dose_at,
  }));

  const nursingNotes = (d.nursingNotes ?? []).map((r: any) => ({
    ...r,
    id: r.note_id,
    nurse: r.nurse_name,
    timestamp: r.recorded_at,
  }));

  const dailyCheckups = (d.dailyCheckups ?? []).map((r: any) => ({
    ...r,
    id: r.checkup_id,
    checkupType: r.checkup_type,
    timestamp: r.checkup_at,
    // The page compares against an ISO date string.
    date: r.checkup_at ? String(r.checkup_at).split("T")[0] : null,
    time: r.checkup_at
      ? new Date(r.checkup_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null,
  }));

  const dietOrders = (d.dietOrders ?? []).map((r: any) => ({
    ...r,
    id: r.diet_id,
    type: r.diet_type,
    startedOn: r.started_on,
    orderedBy: r.ordered_by,
    specialInstructions: r.special_instructions,
  }));

  const rehabSessions = (d.rehabSessions ?? []).map((r: any) => ({
    ...r,
    id: r.session_id,
    sessionType: r.session_type,
    date: r.session_date,
  }));

  return {
    admission: d.admission,
    procedures,
    medications,
    nursingNotes,
    dailyCheckups,
    dietOrders,
    rehabSessions,
    // Legacy aliases the inpatient screens still read.
    checkups: dailyCheckups,
    dietOrder: dietOrders[0] ?? null,
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
  // These `|| "plausible constant"` fallbacks lived BELOW the route layer, so a
  // route's own `?? "Unknown"` guard could never fire — api.ts had already
  // substituted a real-looking value. Each one was a dispatch-relevant lie:
  // an unknown location read as "Base Station" (a real place to send a crew to),
  // an unset status read as "available" (dispatchable), an unclassified vehicle
  // read as "als" (Advanced Life Support), and every single ambulance in the
  // fleet reported the same crew, "EMT On-Duty", because `ambulances` has no
  // paramedic column at all.
  const ambulances = (res.ambulances ?? []).map((a: any) => ({
    id: a.ambulance_id,
    vehicleNo: a.registration ?? null,
    registration: a.registration ?? null,
    type: a.vehicle_type ?? null,
    status: a.status ?? null,
    location: a.current_location ?? null,
    driver: a.driver_name ?? null,
    paramedic: null,
    did: `did:hosp:ambulance:${a.ambulance_id}`,
    updatedAt: a.updated_at,
  }));
  return { ambulances, total: ambulances.length };
}

export async function updateAmbulanceStatus(params: {
  ambulanceId: string;
  status: string;
  location?: string;
  driverName?: string;
}) {
  const { updateAmbulanceStatus: fn } = await import("./inpatient.server");
  return fn({ data: params });
}

export async function getEquipment() {
  const { getEquipment: fn } = await import("./inpatient.server");
  const res = await fn();
  const equipment = (res.equipment ?? []).map((e: any) => ({
    id: e.equipment_id,
    name: e.name,
    // Same class of fabrication. `floor: Number(e.floor_number ?? 1)` sent a
    // biomedical engineer to floor 1 for a device whose floor is unknown, and
    // `status: e.status || "operational"` reported an unset device as working.
    // The status fallback also asserted a value outside the asset_status enum
    // ('available','in-use','maintenance','retired'), which is why the equipment
    // KPI tiles matched nothing.
    type: e.equipment_type ?? null,
    category: e.category ?? null,
    manufacturer: e.manufacturer ?? null,
    model: e.model ?? null,
    serial: e.serial_number ?? null,
    department: e.department ?? null,
    floor: e.floor_number ?? null,
    status: e.status ?? null,
    lastMaintenance: e.last_serviced_on ?? null,
    nextMaintenance: e.next_service_on ?? null,
    warrantyExpiry: e.warranty_expiry,
    purchaseDate: e.purchase_date,
    utilization: Number(e.utilization_pct ?? 0),
    calibrationDate: e.calibration_date,
    nextCalibration: e.next_calibration,
    assignedWard: e.assigned_ward ?? null,
    location: e.location || "Facility Depot",
    did: e.did || `did:hosp:equipment:${e.equipment_id}`,
    updatedAt: e.updated_at,
  }));
  return { equipment, total: equipment.length };
}

export async function getEquipmentMaintenanceLog(equipmentId?: string) {
  const { getEquipmentMaintenanceLog: fn } = await import("./inpatient.server");
  const res = await fn({ data: { equipmentId } });
  const logs = (res.logs ?? []).map((l: any) => ({
    logId: l.log_id,
    equipmentId: l.equipment_id,
    maintenanceType: l.maintenance_type,
    description: l.description,
    performedBy: l.performed_by,
    performedAt: l.performed_at,
    nextDue: l.next_due,
    cost: Number(l.cost ?? 0),
    status: l.status,
    notes: l.notes,
    createdAt: l.created_at,
  }));
  return { logs, total: logs.length };
}

export async function updateEquipmentStatus(params: {
  equipmentId: string;
  status: string;
  location?: string;
  assignedWard?: string;
  utilizationPct?: number;
}) {
  const { updateEquipmentStatus: fn } = await import("./inpatient.server");
  return fn({ data: params });
}

export async function recordEquipmentMaintenance(params: {
  equipmentId: string;
  maintenanceType: "preventive" | "corrective" | "calibration" | "routine_check" | string;
  description: string;
  performedBy: string;
  nextDue?: string;
  cost?: number;
  status?: string;
  notes?: string;
}) {
  const { recordEquipmentMaintenance: fn } = await import("./inpatient.server");
  return fn({ data: params });
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

export async function getBilling(_did?: string): Promise<BillingResponse> {
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
      /**
       * The billing page reads `amountPaid`, not `totalPaid`, so "Amount Paid"
       * displayed ₹0 even though the real figure was already being returned
       * right above. Aliased rather than renamed, because the inpatient
       * dashboard reads totalPaid.
       */
      amountPaid: Number(acct.total_paid ?? 0),
      /**
       * These are read by the page and have no source: billing_accounts has no
       * insurance split, no bill number, no period and no status column. They
       * were rendering as "Bill #" with nothing after it, an empty status badge,
       * "Invalid Date – Invalid Date", and ₹0 figures presented as real splits.
       * Returned as null so the UI can say "not available" instead of ₹0.
       */
      billNumber: null as string | null,
      status: null as string | null,
      fromDate: null as string | null,
      toDate: null as string | null,
      insuranceClaimed: null as number | null,
      insurancePending: null as number | null,
      patientResponsibility: null as number | null,
      categoryTotals: null as Record<string, number> | null,
    },
    /**
     * The page reads `billItems`, `dailyCharges` and `paymentRecords`; the
     * server returns `bills` and `payments`. Every one of the Daily, Itemized
     * and Payment History tabs therefore rendered blank. `paymentRecords` is a
     * real alias; the other two have no source and stay empty so the tabs can
     * show an empty state rather than nothing at all.
     */
    paymentRecords: (res.payments ?? []).map((p: any) => ({
      id: p.payment_id,
      amount: Number(p.amount),
      method: p.method,
      status: p.status,
      reference: p.reference,
      date: p.created_at,
    })),
    billItems: [] as any[],
    dailyCharges: [] as any[],
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

/**
 * Clinician directory, derived from dids rather than a duplicate table.
 *
 * Each clinician is returned with the hospital they practise at, resolved to a
 * name. The directory is cross-hospital by design so referrals work, which means
 * a patient choosing a doctor was previously given no way to tell which hospital
 * they were about to book.
 */
export async function getDoctors() {
  const { getDoctors: fn, getHospitalDirectory } = await import("./inpatient.server");
  const res = await fn();

  let hospitalName: Record<string, string> = {};
  try {
    const hRes = await getHospitalDirectory();
    hospitalName = Object.fromEntries(
      (hRes.hospitals ?? []).map((h: any) => [h.hospital_id, h.name]),
    );
  } catch {
    // Names are presentational; the directory must still list clinicians.
  }

  const doctors = (res.doctors ?? []).map((d: any) => ({
    did: d.did,
    name: d.owner_name,
    role: d.owner_type,
    status: d.status,
    hospitalId: d.hospital_id ?? null,
    hospitalName: d.hospital_id ? (hospitalName[d.hospital_id] ?? null) : null,
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

/**
 * The booking directory: clinicians at the patient's OWN hospital.
 *
 * Distinct from getDoctors(), which is the cross-hospital referral directory and
 * must stay that way. The patient appointments screen used getDoctors() and so
 * offered every clinician on the platform regardless of tenant.
 */
export async function getBookableDoctors() {
  const { getBookableDoctors: fn, getHospitalDirectory } = await import("./inpatient.server");
  const res = await fn();

  let hospitalName: Record<string, string> = {};
  try {
    const hRes = await getHospitalDirectory();
    hospitalName = Object.fromEntries(
      (hRes.hospitals ?? []).map((h: any) => [h.hospital_id, h.name]),
    );
  } catch {
    // Names are presentational; the list must still render.
  }

  const doctors = (res.doctors ?? []).map((d: any) => ({
    did: d.did,
    name: d.owner_name,
    role: d.owner_type,
    status: d.status,
    hospitalId: d.hospital_id ?? null,
    hospitalName: d.hospital_id ? (hospitalName[d.hospital_id] ?? null) : null,
  }));

  return {
    doctors,
    total: doctors.length,
    // null means the patient is not registered at any hospital, which the UI
    // must distinguish from "your hospital has no clinicians yet".
    hospitalId: res.hospitalId ?? null,
    hospitalName: res.hospitalId ? (hospitalName[res.hospitalId] ?? null) : null,
  };
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

  let res;
  try {
    res = await identity("wallet-link", payload as Record<string, unknown>);
  } catch (err: any) {
    // One wallet, one account — enforced by profiles_wallet_address_key. The
    // constraint is right, but the raw Postgres text ("duplicate key value
    // violates unique constraint …") tells a user nothing, and it surfaced on
    // every page that links a wallet. Translated here, at the one place both
    // the patient and staff profiles call, so neither has to know the
    // constraint's name.
    const msg = String(err?.message ?? "");
    if (msg.includes("profiles_wallet_address_key") || msg.includes("duplicate key value")) {
      const conflict = new Error(
        "That wallet is already linked to another account. Each wallet may belong to only one account — connect a different wallet in Phantom, or unlink it from the other account first.",
      );
      (conflict as any).code = "WALLET_ALREADY_LINKED";
      throw conflict;
    }
    throw err;
  }

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
  publicKey?: string,
  _email?: string,
  extraFields?: { mrn?: string; employeeId?: string; ownerId?: string } | null,
) {
  // Legacy positional form: createDID(ownerName, ownerType).
  const ownerName = typeof arg1 === "string" ? arg1 : String(arg1.ownerName ?? arg1.owner ?? "");
  const ownerType =
    typeof arg1 === "string"
      ? (ownerTypeArg ?? "patient")
      : String(arg1.ownerType ?? arg1.role ?? "patient");

  // `extraFields` was named `_extraFields` and discarded. /admin/people fills it
  // with the MRN (patients) or employee id (staff) shown in the "Issue DID"
  // dialog, so the administrator confirmed a number that was then stored
  // nowhere. Both are real columns on profiles; identity-ops writes them.
  const obj = typeof arg1 === "string" ? {} : arg1;
  const extras = extraFields ?? {};
  const ownerId = extras.ownerId ?? (obj.ownerId as string | undefined);

  const res = await identity("create-did", {
    ownerName,
    ownerType,
    ownerId,
    publicKey,
    mrn: extras.mrn,
    employeeId: extras.employeeId,
  });

  // Give the new DID a real signing key. identity-ops issues it with a
  // `pk_<uuid>` placeholder because it runs in Deno and cannot reach the Node
  // key service, so the key is provisioned here immediately afterwards.
  //
  // Non-fatal: the DID is already created and usable. A failure here leaves it on
  // the placeholder, which `backend/scripts/provision-did-wallets.js` will pick
  // up on its next run — better than failing an issuance that already succeeded.
  let publicKeyIssued: string | null = null;
  try {
    const { provisionDidWallet } = await import("./wallets.server");
    const w = await provisionDidWallet({ data: { did: res.did } });
    publicKeyIssued = w.publicKey;
  } catch (err) {
    console.warn(`DID ${res.did} created without a signing key:`, (err as Error).message);
  }

  return { success: true as const, did: res.did, publicKey: publicKeyIssued };
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
/**
 * Sign a prescription and record it.
 *
 * This used to mint a PrescriptionVC and stop there, so nothing reached
 * public.prescriptions and the patient portal — which reads that table — showed
 * nothing after a successful signing. It also derived rxId from the caller's
 * argument, and the sign form does not send one, so the id was the empty string
 * and the linked medical report was written with rxId "".
 *
 * Now: mint the credential, then persist the prescription with the id the server
 * generates. The credential is the proof; the row is the record.
 */
export async function signPrescription(
  arg1: string | { rxId?: string; patientDid?: string; [key: string]: unknown },
  patientDidArg?: string,
) {
  const { signCredential, createPrescription } = await import("./clinical.server");

  // Callers pass either (rxId, patientDid) or the whole prescription object.
  const rxIdIn = typeof arg1 === "string" ? arg1 : String(arg1.rxId ?? "");
  const patientDid =
    typeof arg1 === "string" ? (patientDidArg ?? "") : String(arg1.patientDid ?? "");
  const claims = typeof arg1 === "string" ? { rxId: rxIdIn } : { ...arg1 };

  const obj = typeof arg1 === "string" ? {} : arg1;
  const drugs = Array.isArray(obj.drugs) ? (obj.drugs as unknown[]) : [];

  const res: any = await signCredential({
    data: { subjectDid: patientDid, credentialType: "PrescriptionVC", claims },
  });

  const signature: string | undefined = res.credential?.signature;

  // Persist the prescription itself. Only possible when the caller supplied the
  // drug list — the (rxId, patientDid) form is a re-sign of something that already
  // exists, so there is nothing new to insert.
  let rxId = rxIdIn;
  if (drugs.length > 0) {
    const saved = await createPrescription({
      data: {
        patientDid,
        drugs,
        diagnosis: typeof obj.diagnosis === "string" ? obj.diagnosis : undefined,
        notes: typeof obj.notes === "string" ? obj.notes : undefined,
        signedBy: typeof obj.signedBy === "string" ? obj.signedBy : undefined,
        contentHash: signature,
        rxId: rxIdIn || undefined,
      },
    });
    rxId = saved.rxId;
  }

  return {
    success: true as const,
    rxId,
    credential: res.credential,
    signature,
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

export async function getPatientFullProfile(patientDid: string) {
  const { getPatientFullProfile: fn } = await import("./patient-profile.server");
  return fn({ data: { patientDid } });
}

export async function getInventoryData() {
  const { getInventoryData: fn } = await import("./operations.server");
  return fn();
}

export async function getStockMovements(itemId: string) {
  const { getStockMovements: fn } = await import("./operations.server");
  return fn({ data: { itemId } });
}

export async function recordStockMovement(params: {
  itemId: string;
  movementType: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  reason?: string;
}) {
  const { recordStockMovement: fn } = await import("./operations.server");
  return fn({ data: params });
}

export async function updateItemReorderSettings(params: {
  itemId: string;
  reorderLevel?: number;
  reorderQty?: number;
  storageLocation?: string;
  supplier?: string;
  unitCost?: number;
}) {
  const { updateItemReorderSettings: fn } = await import("./operations.server");
  return fn({ data: params });
}

export async function acknowledgeInventoryAlert(alertId: string) {
  const { acknowledgeInventoryAlert: fn } = await import("./operations.server");
  return fn({ data: { alertId } });
}

// ─── Patient Master (Centralized patient data access) ─────────────────────────

export async function getPatientMaster(data: { patientDid: string }) {
  const { getPatientMaster: fn } = await import("./patient-master.server");
  return fn({ data });
}

export async function getPatientCurrentLocation(data: { patientDid: string }) {
  const { getPatientCurrentLocation: fn } = await import("./patient-master.server");
  return fn({ data });
}

export async function getPatientAdmissionHistory(data: { patientDid: string; limit?: number }) {
  const { getPatientAdmissionHistory: fn } = await import("./patient-master.server");
  return fn({ data });
}

export async function getPatientTransferHistory(data: { patientDid: string; limit?: number }) {
  const { getPatientTransferHistory: fn } = await import("./patient-master.server");
  return fn({ data });
}

export async function getPatientMedicalRecords(data: {
  patientDid: string;
  recordType?: string;
  limit?: number;
}) {
  const { getPatientMedicalRecords: fn } = await import("./patient-master.server");
  return fn({ data });
}

export async function getPatientMedications(data: { patientDid: string; status?: string }) {
  const { getPatientMedications: fn } = await import("./patient-master.server");
  return fn({ data });
}

export async function getPatientProcedures(data: { patientDid: string; status?: string }) {
  const { getPatientProcedures: fn } = await import("./patient-master.server");
  return fn({ data });
}

export async function getPatientLabResults(data: { patientDid: string; limit?: number }) {
  const { getPatientLabResults: fn } = await import("./patient-master.server");
  return fn({ data });
}

export async function getPatientBilling(data: { patientDid: string }) {
  const { getPatientBilling: fn } = await import("./patient-master.server");
  return fn({ data });
}

export async function getPatientDischargeInfo(data: { patientDid: string }) {
  const { getPatientDischargeInfo: fn } = await import("./patient-master.server");
  return fn({ data });
}

// ─── Central Alerts API (Sprint 8) ──────────────────────────────────────────

export async function getCentralAlerts(params?: {
  category?: string;
  severity?: string;
  status?: string;
  search?: string;
}) {
  const { getCentralAlerts: fn } = await import("./operations.server");
  return fn({ data: params || {} });
}

export async function acknowledgeCentralAlert(data: { alertId: string; sourceTable: string }) {
  const { acknowledgeCentralAlert: fn } = await import("./operations.server");
  return fn({ data });
}

export async function resolveCentralAlert(data: { alertId: string; sourceTable: string }) {
  const { resolveCentralAlert: fn } = await import("./operations.server");
  return fn({ data });
}

export async function broadcastEmergencyAlert(data: {
  broadcastCode: import("./types").EmergencyBroadcastCode;
  title: string;
  message: string;
  location: string;
  severity?: import("./types").AlertSeverity;
}) {
  const { broadcastEmergencyAlert: fn } = await import("./operations.server");
  return fn({ data });
}

export async function getCentralAlertStats() {
  const { getCentralAlertStats: fn } = await import("./operations.server");
  return fn();
}

// ─── Laboratory & Diagnostics API (Sprint 9) ────────────────────────────────

export async function getLaboratoryData() {
  const { getLaboratoryData: fn } = await import("./operations.server");
  return fn();
}

export async function updateLabOrderStatus(data: {
  orderId: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
}) {
  const { updateLabOrderStatus: fn } = await import("./operations.server");
  return fn({ data });
}

export async function updateSampleStatus(data: {
  sampleId: string;
  status: "collected" | "lab_received" | "processing" | "resulted" | "reported";
  notes?: string;
}) {
  const { updateSampleStatus: fn } = await import("./operations.server");
  return fn({ data });
}

export async function updateRadiologyOrderStatus(data: {
  orderId: string;
  status: "scheduled" | "in_progress" | "completed" | "reported" | "cancelled";
  reportText?: string;
  reportedBy?: string;
}) {
  const { updateRadiologyOrderStatus: fn } = await import("./operations.server");
  return fn({ data });
}

export async function orderLabTestDirect(data: {
  patientDid: string;
  patientName?: string;
  patientMrn?: string;
  testName: string;
  testCategory: string;
  priority: "stat" | "urgent" | "routine";
  clinicalNotes?: string;
  specimenType?: string;
}) {
  const { orderLabTestDirect: fn } = await import("./operations.server");
  return fn({ data });
}

export async function recordLabResult(data: {
  labId?: string;
  orderId?: string;
  patientDid: string;
  patientName?: string;
  patientMrn?: string;
  testName: string;
  category?: string;
  resultValue: string;
  unit: string;
  referenceRange: string;
  isCritical?: boolean;
  criticalFlag?: "high" | "low" | "critical_high" | "critical_low" | "panic" | null;
}) {
  const { recordLabResult: fn } = await import("./operations.server");
  return fn({ data });
}

// ─── Cafeteria & Food Service API ──────────────────────────────────────────

export async function getCafeteriaData() {
  const { getCafeteriaData: fn } = await import("./operations.server");
  return fn();
}

export async function createMenuItem(data: {
  name: string;
  category: "breakfast" | "lunch" | "dinner" | "snack" | "beverage";
  dietaryTags: string[];
  availableFor: "patient" | "staff" | "both";
  price: number;
  calories: number;
  description?: string;
  allergens?: string[];
}) {
  const { createMenuItem: fn } = await import("./operations.server");
  return fn({ data });
}

export async function updateMenuItemStatus(data: {
  menuItemId: string;
  status: "active" | "inactive" | "sold_out";
}) {
  const { updateMenuItemStatus: fn } = await import("./operations.server");
  return fn({ data });
}

export async function updateDeliveryStatus(data: {
  deliveryId: string;
  status: "preparing" | "dispatched" | "delivered" | "cancelled";
}) {
  const { updateDeliveryStatus: fn } = await import("./operations.server");
  return fn({ data });
}

export async function addKitchenStockItem(data: {
  itemName: string;
  category: "produce" | "dairy" | "meat" | "dry_goods" | "beverages" | "bakery" | "frozen" | string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  unitCost: number;
  expiryDate?: string;
  supplier?: string;
  storageLocation?: string;
}) {
  const { addKitchenStockItem: fn } = await import("./operations.server");
  return fn({ data });
}

export async function createCafeteriaVendor(data: {
  name: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  suppliedCategories: string[];
  contractExpiry?: string;
  address?: string;
}) {
  const { createCafeteriaVendor: fn } = await import("./operations.server");
  return fn({ data });
}

export async function updateVendorContract(data: {
  vendorId: string;
  status: "active" | "expired" | "pending" | "terminated";
}) {
  const { updateVendorContract: fn } = await import("./operations.server");
  return fn({ data });
}

export async function logFoodWastage(data: {
  date?: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack" | "prep_waste" | string;
  itemName: string;
  quantityWasted: number;
  unit?: string;
  costImpact?: number;
  reason: "overproduction" | "spoilage" | "unconsumed_tray" | "expired_stock" | "damaged";
}) {
  const { logFoodWastage: fn } = await import("./operations.server");
  return fn({ data });
}

export async function updateDietaryRequirementStatus(data: {
  requirementId: string;
  status: "active" | "pending" | "review" | "suspended";
}) {
  const { updateDietaryRequirementStatus: fn } = await import("./operations.server");
  return fn({ data });
}
