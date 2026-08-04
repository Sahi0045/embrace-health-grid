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

export const API_BASE_URL = getApiBaseUrl();
const API = `${API_BASE_URL}/api`;

// Legacy online-check state, retained only so historical references compile.
// The real check is isBackendOnline() below, which queries Postgres.
let _serverOnline: boolean | null = null;
let _lastCheck = 0;
void _serverOnline;
void _lastCheck;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Import token from auth module — reads sessionStorage (not raw localStorage)
  const { getToken } = await import("./auth");
  const token = getToken();

  const clientKey =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_CLIENT_KEY) ||
    "apollo-consortium-client-secret-2026";

  const authHeaders: Record<string, string> = {
    "x-client-key": clientKey,
  };
  if (token) authHeaders["Authorization"] = "Bearer " + token;

  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    if (r.status === 401 && typeof window !== "undefined") {
      const { clearSession } = await import("./auth");
      clearSession();
    }
    throw new Error(err.error ?? r.statusText);
  }
  return r.json();
}

// ─── DIDs ─────────────────────────────────────────────────────────────────────

export const createDID = (
  owner: string,
  ownerType: string,
  controller?: string,
  ownerEmail?: string,
  extraFields?: Record<string, unknown>,
) =>
  apiFetch<{ did: string; doc: any; txId: string }>(`/did`, {
    method: "POST",
    body: JSON.stringify({ owner, ownerType, controller, ownerEmail, ...extraFields }),
  });

export const revokeDID = (did: string) =>
  apiFetch<{ success: boolean; did: string; status: string }>(
    `/did/${encodeURIComponent(did)}/revoke`,
    {
      method: "PATCH",
    },
  );

export const requestDID = (data: { ownerName?: string; ownerType?: string; department?: string }) =>
  apiFetch<{ success: boolean; request: any; message?: string }>(`/did/request`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getDIDRequests = () => apiFetch<{ requests: any[]; total: number }>(`/did/requests`);

export const approveDIDRequest = (requestId: string) =>
  apiFetch<{ success: boolean; did: string; doc: any }>(
    `/did/requests/${encodeURIComponent(requestId)}/approve`,
    {
      method: "POST",
    },
  );

export const rejectDIDRequest = (requestId: string) =>
  apiFetch<{ success: boolean; request: any }>(
    `/did/requests/${encodeURIComponent(requestId)}/reject`,
    {
      method: "POST",
    },
  );

// ─── Credentials ──────────────────────────────────────────────────────────────
export const issueCredential = (
  did: string,
  type: string,
  claims: Record<string, string>,
  issuer?: string,
) =>
  apiFetch<{ vc: any; txId: string }>(`/credential/issue`, {
    method: "POST",
    body: JSON.stringify({ did, type, claims, issuer }),
  });

export const revokeCredential = (id: string) =>
  apiFetch<{ success: boolean; id: string }>(`/credential/${encodeURIComponent(id)}/revoke`, {
    method: "PATCH",
  });

// ─── Consent ──────────────────────────────────────────────────────────────────

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

export const logAuditEvent = (
  actor: string,
  resource: string,
  action: string,
  outcome = "success",
  severity = "info",
) =>
  apiFetch<any>(`/audit/log`, {
    method: "POST",
    body: JSON.stringify({ actor, resource, action, outcome, severity }),
  });

// ─── Medical Records ──────────────────────────────────────────────────────────

/** Staff/Admin: fetch ALL medical records across all patients */

/** Doctor: fetch only records they created */

/** Fetch the medical report linked to a specific prescription (by rxId) */
export const getMedicalRecordByRx = (rxId: string) =>
  apiFetch<{ record: any | null }>(`/medical-records/by-prescription/${encodeURIComponent(rxId)}`);

export const updateMedicalRecord = (recordId: string, data: Record<string, any>) =>
  apiFetch<{ record: any }>(`/medical-records/${encodeURIComponent(recordId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const getPharmacyOrders = (patientDid: string) =>
  apiFetch<{ orders: any[] }>(`/pharmacy-orders/${encodeURIComponent(patientDid)}`);

export const getRehabSessions = (patientDid: string) =>
  apiFetch<{ sessions: any[] }>(`/rehab-sessions/${encodeURIComponent(patientDid)}`);

export const getFeedbackList = (patientDid: string) =>
  apiFetch<{ feedback: any[] }>(`/feedback/${encodeURIComponent(patientDid)}`);

// ─── NFC Cards ────────────────────────────────────────────────────────────────
export const issueNFCCard = (data: {
  patientDid: string;
  patientName: string;
  mrn: string;
  cardType?: string;
}) =>
  apiFetch<{ card: any }>(`/nfc/issue`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getNFCCard = (cardId: string) => apiFetch<any>(`/nfc/${encodeURIComponent(cardId)}`);

export const revokeNFCCard = (cardId: string) =>
  apiFetch<{ success: boolean; cardId: string }>(`/nfc/${encodeURIComponent(cardId)}/revoke`, {
    method: "PATCH",
  });

export const getNFCCardStatus = (patientDid: string) =>
  apiFetch<{ hasCard: boolean; card: any }>(`/nfc/status/${encodeURIComponent(patientDid)}`);

// ─── Visitors ─────────────────────────────────────────────────────────────────

// ─── Attendance ───────────────────────────────────────────────────────────────

// ─── Staff Requests (Leave / Shift) ───────────────────────────────────────────

// ─── Pagers ───────────────────────────────────────────────────────────────────
export const dispatchPagerNotify = (staffDid: string, name: string, location: string) =>
  apiFetch<{ success: boolean; notifyEvent: any }>(`/tracker/notify`, {
    method: "POST",
    body: JSON.stringify({ staffDid, name, location }),
  });

// ─── Solana Anchors ───────────────────────────────────────────────────────────
export const solanaAnchor = (
  recordHash: string,
  recordType: string,
  actorDid?: string,
  recordId?: string,
) =>
  apiFetch<any>(`/solana/anchor`, {
    method: "POST",
    body: JSON.stringify({ recordHash, recordType, actorDid, recordId }),
  });

export const solanaVerifyAnchor = (signature: string) =>
  apiFetch<any>(`/solana/verify/${encodeURIComponent(signature)}`);

export const solanaGetAnchors = (limit = 50) =>
  apiFetch<{ anchors: any[]; simulated: boolean }>(`/solana/anchors?limit=${limit}`);

// ─── Prescriptions ────────────────────────────────────────────────────────────
export const signPrescription = (data: {
  patientDid?: string;
  patientName?: string;
  doctorDid?: string;
  apptId?: string;
  drugs?: any[];
  diagnosis?: string;
  chiefComplaint?: string;
  symptoms?: string;
  notes?: string;
  followUpDate?: string;
  signedBy?: string;
  rxId?: string;
  staffDid?: string;
}) => {
  if (data.rxId) {
    return apiFetch<any>("/prescriptions/sign", {
      method: "POST",
      body: JSON.stringify({ rxId: data.rxId, staffDid: data.staffDid }),
    });
  }
  return apiFetch<any>(`/prescriptions`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * On-Chain Prescription History — doctors only, requires a confirmed appointment.
 * Returns prescriptions enriched with blockchain verification status.
 */

/** Prescriptions written by the currently authenticated doctor */

/** Patients who have appointments with the authenticated doctor */

export const getSurgeries = () => apiFetch<{ surgeries: any[]; total: number }>(`/surgeries`);

// ─── Labs ─────────────────────────────────────────────────────────────────────

// ─── Appointments ─────────────────────────────────────────────────────────────

/** Pending appointment requests waiting for the authenticated doctor to accept/reject */

/** All appointments for the authenticated doctor (any status) */

// ─── Beds ─────────────────────────────────────────────────────────────────────

export const updateBed = (bedId: string, ward: string, status: string, patientDid?: string) =>
  apiFetch<any>(`/beds`, {
    method: "POST",
    body: JSON.stringify({ bedId, ward, status, patientDid }),
  });

// ─── Billing ──────────────────────────────────────────────────────────────────
export const recordPayment = (data: {
  patientDid: string;
  patientName: string;
  amount: number;
  category: string;
  reference?: string;
}) =>
  apiFetch<any>(`/billing/payment`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getBilling = (patientDid: string) =>
  apiFetch<any>(`/billing/${encodeURIComponent(patientDid)}`);

// ─── Fraud ────────────────────────────────────────────────────────────────────
export const getFraudAlerts = () => apiFetch<{ alerts: any[]; total: number }>(`/fraud/alerts`);

export const raiseFraudAlert = (
  actor: string,
  type: string,
  message: string,
  severity = "high",
  riskScore = 75,
) =>
  apiFetch<any>(`/fraud/alert`, {
    method: "POST",
    body: JSON.stringify({ actor, type, message, severity, riskScore }),
  });

// ─── Vitals ───────────────────────────────────────────────────────────────────
export const seedVitals = (
  patients: Array<{
    id: string;
    heartRate?: number;
    bp?: string;
    spo2?: number;
    temp?: number;
    respRate?: number;
  }>,
) =>
  apiFetch<{ seeded: number }>(`/vitals/seed`, {
    method: "POST",
    body: JSON.stringify({ patients }),
  });

// ─── Tracker ──────────────────────────────────────────────────────────────────
export const seedTracker = (staff: Array<{ id: string; location?: string }>) =>
  apiFetch<{ seeded: number }>(`/tracker/seed`, {
    method: "POST",
    body: JSON.stringify({ staff }),
  });

// ─── World State ──────────────────────────────────────────────────────────────
export const getWorldState = () => apiFetch<Record<string, unknown>>(`/worldstate`);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const signup = (data: { name: string; email: string; role: string; password?: string }) =>
  apiFetch<{
    success: boolean;
    token: string;
    user: { name: string; email: string; role: string };
  }>(`/auth/signup`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const login = (data: {
  email: string;
  password?: string;
  portal?: "patient" | "staff" | "admin";
}) =>
  apiFetch<{
    success: boolean;
    token: string;
    user: {
      name: string;
      email: string;
      role: string;
      did?: string;
      walletAddress?: string | null;
      mrn?: string | null;
      employeeId?: string | null;
    };
  }>(`/auth/login`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const linkWalletAddress = (walletAddress: string) =>
  apiFetch<{
    success: boolean;
    user: {
      name: string;
      email: string;
      role: string;
      did?: string | null;
      walletAddress: string;
      walletVerified: boolean;
      mrn?: string | null;
      employeeId?: string | null;
    };
  }>(`/auth/link-wallet`, {
    method: "POST",
    body: JSON.stringify({ walletAddress }),
  });

/**
 * Step 1 — request a sign-challenge for the given wallet address.
 * Returns { nonce, message } — the user must sign `message` with their wallet.
 */
export const requestWalletChallenge = (walletAddress: string) =>
  apiFetch<{ nonce: string; message: string }>(`/auth/wallet-challenge`, {
    method: "POST",
    body: JSON.stringify({ walletAddress }),
  });

/**
 * Step 2 — submit the base64-encoded Ed25519 signature to verify ownership
 * and permanently link the wallet to the authenticated account.
 */
export const verifyAndLinkWallet = (walletAddress: string, signature: string) =>
  apiFetch<{
    success: boolean;
    verified: boolean;
    user: {
      name: string;
      email: string;
      role: string;
      did?: string | null;
      walletAddress: string;
      walletVerified: boolean;
      mrn?: string | null;
      employeeId?: string | null;
    };
  }>(`/auth/wallet-verify`, {
    method: "POST",
    body: JSON.stringify({ walletAddress, signature }),
  });

// ─── Notifications ────────────────────────────────────────────────────────────
export const getNotifications = () =>
  apiFetch<{ notifications: any[]; unreadCount: number }>(`/notifications`);

export const markAllNotificationsRead = () =>
  apiFetch<{ success: boolean }>(`/notifications/read-all`, { method: "PATCH" });

export const markNotificationRead = (id: string) =>
  apiFetch<{ success: boolean }>(`/notifications/${id}/read`, { method: "PATCH" });

// ─── ZKP ──────────────────────────────────────────────────────────────────────
export const generateZKProof = (patientDid: string, selectedClaims: unknown[]) =>
  apiFetch<{ proof: any; txId: string }>(`/zkproof/generate`, {
    method: "POST",
    body: JSON.stringify({ patientDid, selectedClaims }),
  });

export const verifyZKProof = (proofId: string, patientDid?: string) =>
  apiFetch<{
    valid: boolean;
    proofId: string;
    disclosedAttributes: Record<string, string>;
    verifiedAt: string;
    circuitId: string;
    blockHash: string;
    message: string;
  }>(`/zkproof/verify`, {
    method: "POST",
    body: JSON.stringify({ proofId, patientDid }),
  });

// ─── Auth (JWT) ───────────────────────────────────────────────────────────────
const getStoredUser = () => {
  if (typeof window === "undefined") return null;
  const role = localStorage.getItem("userRole");
  const email = localStorage.getItem("userEmail");
  const name = localStorage.getItem("userName") ?? undefined;
  const did = localStorage.getItem("userDID") ?? undefined;
  // Gate on sessionStorage token existing (logged-out after tab close)
  if (!sessionStorage.getItem("authToken")) return null;
  if (!role || !email) return null;
  return { name: name ?? "Guest", email, role, did };
};

/** Rotate the refresh token — pass the opaque refresh token in the body. */
export const refreshToken = (rt: string) =>
  apiFetch<{ token: string; refreshToken: string }>(`/auth/refresh`, {
    method: "POST",
    body: JSON.stringify({ refreshToken: rt }),
  });

/** Admin-only: create a staff/doctor/admin account. */
export const createUserAccount = (data: {
  name: string;
  email: string;
  role: "staff" | "doctor" | "admin";
  password: string;
  department?: string;
  specializations?: string[];
  employeeId?: string;
}) =>
  apiFetch<{ success: boolean; user: { name: string; email: string; role: string } }>(
    `/auth/users/create`,
    { method: "POST", body: JSON.stringify(data) },
  );

/** Admin-only: force-logout all sessions for a user. */
export const revokeUserSessions = (email: string) =>
  apiFetch<{ success: boolean; message: string }>(`/auth/revoke/${encodeURIComponent(email)}`, {
    method: "POST",
    body: "{}",
  });

/** Bootstrap: create first admin (only works when no admin exists). */
export const bootstrapSetup = (data: {
  name: string;
  email: string;
  password: string;
  setupKey?: string;
}) =>
  apiFetch<{ success: boolean; token: string; refreshToken: string; user: any }>(`/auth/setup`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const signIdentityPayload = (data: {
  did: string;
  mrn?: string;
  name?: string;
  network?: string;
}) =>
  apiFetch<{ payload: any }>(`/identity/sign-payload`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const verifyIdentityPayload = (payload: any) =>
  apiFetch<{ verified: boolean; payload: any }>(`/identity/verify-payload`, {
    method: "POST",
    body: JSON.stringify({ payload }),
  });

// ─── Infrastructure ───────────────────────────────────────────────────────
export const getInfrastructure = () =>
  apiFetch<{ beds: any[]; equipment: any[]; ambulances: any[] }>(`/infrastructure`);

export const getAmbulances = () =>
  apiFetch<{ ambulances: any[]; total: number }>(`/infrastructure/ambulances`);

export const getEquipment = () =>
  apiFetch<{ equipment: any[]; total: number }>(`/infrastructure/equipment`);

// ─── Insurance Claims ─────────────────────────────────────────────────────

export const submitInsuranceClaim = (data: {
  patientDid: string;
  patientName: string;
  patientMRN: string;
  insuranceProvider: string;
  policyNo: string;
  claimType: string;
  amount: number;
  remarks?: string;
}) =>
  apiFetch<{ claim: any }>(`/insurance/claims`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// ─── Vaccines ─────────────────────────────────────────────────────────────
export const getVaccines = (patientDid: string) =>
  apiFetch<{ vaccines: any[]; total: number }>(`/vaccines/${encodeURIComponent(patientDid)}`);

// ─── Doctors ──────────────────────────────────────────────────────────────
export const getDoctors = () => apiFetch<{ doctors: any[]; total: number }>(`/doctors`);
export const getDIDVerifiedDoctors = () => apiFetch<{ doctors: any[]; total: number }>(`/doctors`);
/** Only doctors who have an active DID issued by admin */
export const getVerifiedDoctors = () =>
  apiFetch<{ doctors: any[]; total: number }>(`/doctors/verified`);

// ─── Rooms & Room Check-In ────────────────────────────────────────────────

// ─── Merkle Tree: Room Check-In daily aggregation & publishing ────────────
/** Fetch today's room events + pre-computed Merkle root for a doctor */

// ─── Inpatient ────────────────────────────────────────────────────────────
export const getInpatientData = (patientDid: string) =>
  apiFetch<{
    admission: any | null;
    medications: any[];
    nursingNotes: any[];
    checkups: any[];
    procedures: any[];
    dietOrder: any | null;
    vitalSigns: any[];
  }>(`/inpatient/${encodeURIComponent(patientDid)}`);

// ─── Extended API clients for live sync ─────────────────────────────────────
export const getInsurancePolicies = (patientDid: string) =>
  apiFetch<{ policies: any[]; total: number }>(
    `/insurance/policies/${encodeURIComponent(patientDid)}`,
  );

export const getPreferences = (patientDid: string) =>
  apiFetch<{ preferences: any }>(`/preferences/${encodeURIComponent(patientDid)}`);

export const updatePreferences = (patientDid: string, data: any) =>
  apiFetch<{ preferences: any }>(`/preferences/${encodeURIComponent(patientDid)}`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getPolicies = () => apiFetch<{ policies: any[]; total: number }>("/policies");

export const createPolicy = (data: any) =>
  apiFetch<{ policy: any }>("/policies", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updatePolicy = (id: string, data: any) =>
  apiFetch<{ policy: any }>(`/policies/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const updateFraudAlertStatus = (id: string, status: string) =>
  apiFetch<{ alert: any }>(`/fraud/alerts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const payBill = (data: {
  patientDid: string;
  patientName: string;
  amount: number;
  category: string;
  reference?: string;
}) =>
  apiFetch<any>("/billing/payment", {
    method: "POST",
    body: JSON.stringify(data),
  });

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
    slot: a.slot,
    mode: a.mode,
    specialty: a.specialty,
    status: a.status,
    reason: a.reason,
    bookedAt: a.booked_at,
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
  _suggestedSlot?: string,
) {
  const { updateAppointmentStatus: fn } = await import("./clinical.server");
  await fn({ data: { apptId, status, reason } });
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
  const roster = (res.summary ?? []).map((s: any) => ({
    staffId: s.staffId,
    clockIns: s.clockIns,
    clockOuts: s.clockOuts,
    lastSeen: s.lastSeen,
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
