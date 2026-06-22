/**
 * Hyperledger Fabric API Client
 * Connects to fabric-backend/server.js (http://localhost:3001)
 * Falls back silently to localStorage simulation when server is offline
 */

export const FABRIC_BASE = "http://localhost:3001";
const API = `${FABRIC_BASE}/api`;

let _serverOnline: boolean | null = null;
let _lastCheck = 0;

export async function isFabricOnline(): Promise<boolean> {
  const now = Date.now();
  if (_serverOnline !== null && now - _lastCheck < 10000) return _serverOnline;
  try {
    const r = await fetch(`${FABRIC_BASE}/health`, { signal: AbortSignal.timeout(1000) });
    _serverOnline = r.ok;
  } catch {
    _serverOnline = false;
  }
  _lastCheck = now;
  return _serverOnline;
}

// Reset cache (call when server status changes)
export function resetFabricCache() {
  _serverOnline = null;
  _lastCheck = 0;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const role = typeof window !== "undefined" ? localStorage.getItem("userRole") : null;
  const email = typeof window !== "undefined" ? localStorage.getItem("userEmail") : null;
  const token = typeof window !== "undefined" ? localStorage.getItem("fabricAuthToken") : null;
  const authHeaders: Record<string, string> = {};
  if (role) authHeaders["x-user-role"] = role;
  if (email) authHeaders["x-user-email"] = email;
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
    throw new Error(err.error ?? r.statusText);
  }
  return r.json();
}

// ─── Ledger ───────────────────────────────────────────────────────────────────
export const fabricGetLedger = (page = 0, size = 20) =>
  apiFetch<{ blocks: unknown[]; total: number; blockHeight: number }>(
    `/ledger?page=${page}&size=${size}`,
  );

export const fabricGetStats = () =>
  apiFetch<{
    blockHeight: number;
    txCount: number;
    peerCount: number;
    worldStateSize: number;
    throughputTps: number;
    lastBlockTime: string;
  }>(`/ledger/stats`);

// ─── Transactions ─────────────────────────────────────────────────────────────
export const fabricSubmitTx = (chaincode: string, fcn: string, args: string[], creator?: string) =>
  apiFetch<{ txId: string; blockNumber: number; status: string; timestamp?: string }>(
    `/transaction`,
    {
      method: "POST",
      body: JSON.stringify({ chaincode, fcn, args, creator }),
    },
  );

// ─── DID ──────────────────────────────────────────────────────────────────────
export const fabricGetAllDIDs = () => apiFetch<{ dids: unknown[]; total: number }>(`/did`);

export const fabricResolveDID = (did: string) =>
  apiFetch<unknown>(`/did/${encodeURIComponent(did)}`);

export const fabricCreateDID = (
  owner: string,
  ownerType: string,
  controller?: string,
  ownerEmail?: string,
  extraFields?: Record<string, unknown>,
) =>
  apiFetch<{ did: string; doc: unknown; blockNumber: number; txId: string }>(`/did`, {
    method: "POST",
    body: JSON.stringify({ owner, ownerType, controller, ownerEmail, ...extraFields }),
  });

export const fabricRevokeDID = (did: string) =>
  apiFetch<{ success: boolean }>(`/did/${encodeURIComponent(did)}/revoke`, { method: "PATCH" });

// ─── Credentials ──────────────────────────────────────────────────────────────
export const fabricIssueCredential = (
  did: string,
  type: string,
  claims: Record<string, string>,
  issuer?: string,
) =>
  apiFetch<{ vc: unknown; blockNumber: number; txId: string }>(`/credential/issue`, {
    method: "POST",
    body: JSON.stringify({ did, type, claims, issuer }),
  });

export const fabricRevokeCredential = (id: string) =>
  apiFetch<{ success: boolean }>(`/credential/${id}/revoke`, { method: "PATCH" });

export const fabricGetCredentials = () =>
  apiFetch<{ credentials: unknown[]; total: number }>(`/credentials`);

// ─── Consent ──────────────────────────────────────────────────────────────────
export const fabricGetConsents = () => apiFetch<{ consents: unknown[]; total: number }>(`/consent`);

export const fabricGrantConsent = (
  patientDid: string,
  doctorDid: string,
  resource: string,
  expiry?: string,
) =>
  apiFetch<unknown>(`/consent/grant`, {
    method: "POST",
    body: JSON.stringify({ patientDid, doctorDid, resource, expiry }),
  });

export const fabricRevokeConsent = (id: string) =>
  apiFetch<{ success: boolean }>(`/consent/${id}/revoke`, { method: "PATCH" });

/** Fetch pending consent requests directed at a specific patient DID */
export const fabricGetConsentRequests = (patientDid: string) =>
  apiFetch<{ requests: unknown[]; total: number }>(
    `/consent/requests/${encodeURIComponent(patientDid)}`,
  );

/** Staff submits a data-access request to a patient */
export const fabricRequestConsent = (data: {
  doctorDid: string;
  doctorName: string;
  patientDid: string;
  resource: string;
  reason?: string;
  expiry?: string;
}) =>
  apiFetch<{ success: boolean; requestId: string; request: unknown; txId: string }>(
    `/consent/request`,
    { method: "POST", body: JSON.stringify(data) },
  );

// ─── Audit ────────────────────────────────────────────────────────────────────
export const fabricGetAuditEvents = (page = 0, size = 50) =>
  apiFetch<{ events: unknown[]; total: number }>(`/audit?page=${page}&size=${size}`);

export const fabricLogAuditEvent = (
  actor: string,
  resource: string,
  action: string,
  outcome = "success",
  severity = "info",
) =>
  apiFetch<unknown>(`/audit/log`, {
    method: "POST",
    body: JSON.stringify({ actor, resource, action, outcome, severity }),
  });

// ─── Prescriptions ────────────────────────────────────────────────────────────
export const fabricSignPrescription = (data: {
  patientDid: string;
  doctorDid: string;
  drugs: unknown[];
  diagnosis: string;
  notes: string;
  signedBy: string;
}) =>
  apiFetch<{ rxId: string; rx: unknown; blockNumber: number; txId: string }>(`/prescriptions`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fabricGetPrescriptions = (patientDid: string) =>
  apiFetch<{ prescriptions: unknown[] }>(`/prescriptions/${encodeURIComponent(patientDid)}`);

/** Get all prescriptions for staff overview (no patient filter) */
export const fabricGetAllPrescriptions = () =>
  apiFetch<{ prescriptions: unknown[]; total: number }>(`/prescriptions`);

// ─── Labs ─────────────────────────────────────────────────────────────────────
export const fabricOrderLab = (
  patientDid: string,
  orderedBy: string,
  tests: string[],
  priority = "routine",
) =>
  apiFetch<unknown>(`/labs`, {
    method: "POST",
    body: JSON.stringify({ patientDid, orderedBy, tests, priority }),
  });

export const fabricGetLabs = (patientDid: string) =>
  apiFetch<{ labs: unknown[] }>(`/labs/${encodeURIComponent(patientDid)}`);

// ─── Appointments ─────────────────────────────────────────────────────────────
export const fabricGetAppointments = () =>
  apiFetch<{ appointments: unknown[]; total: number }>(`/appointments`);

export const fabricBookAppointment = (data: {
  patientDid: string;
  patientName: string;
  doctorDid: string;
  doctorName: string;
  slot: string;
  mode: string;
  specialty: string;
}) => apiFetch<unknown>(`/appointments`, { method: "POST", body: JSON.stringify(data) });

// ─── Beds ─────────────────────────────────────────────────────────────────────
export const fabricGetBeds = () => apiFetch<{ beds: unknown[]; total: number }>(`/beds`);

export const fabricUpdateBed = (bedId: string, ward: string, status: string, patientDid?: string) =>
  apiFetch<unknown>(`/beds`, {
    method: "POST",
    body: JSON.stringify({ bedId, ward, status, patientDid }),
  });

// ─── Billing ──────────────────────────────────────────────────────────────────
export const fabricRecordPayment = (
  patientDid: string,
  patientName: string,
  amount: number,
  category: string,
) =>
  apiFetch<unknown>(`/billing/payment`, {
    method: "POST",
    body: JSON.stringify({ patientDid, patientName, amount, category }),
  });

export const fabricGetBilling = (patientDid: string) =>
  apiFetch<{ payments: unknown[] }>(`/billing/${encodeURIComponent(patientDid)}`);

// ─── Fraud ────────────────────────────────────────────────────────────────────
export const fabricGetFraudAlerts = () =>
  apiFetch<{ alerts: unknown[]; total: number }>(`/fraud/alerts`);

export const fabricRaiseFraudAlert = (
  actor: string,
  type: string,
  message: string,
  severity = "high",
  riskScore = 75,
) =>
  apiFetch<unknown>(`/fraud/alert`, {
    method: "POST",
    body: JSON.stringify({ actor, type, message, severity, riskScore }),
  });

// ─── Vitals (seed + get) ──────────────────────────────────────────────────────
export const fabricSeedVitals = (
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

export const fabricGetVitals = (id: string) =>
  apiFetch<{ heartRate: number; bp: string; spo2: number; temp: number; respRate: number }>(
    `/vitals/${id}`,
  );

// ─── Tracker ──────────────────────────────────────────────────────────────────
export const fabricSeedTracker = (staff: Array<{ id: string; location?: string }>) =>
  apiFetch<{ seeded: number }>(`/tracker/seed`, {
    method: "POST",
    body: JSON.stringify({ staff }),
  });

export const fabricGetTracker = () => apiFetch<{ staff: unknown[] }>(`/tracker`);

// ─── World State ──────────────────────────────────────────────────────────────
export const fabricGetWorldState = () => apiFetch<Record<string, unknown>>(`/worldstate`);

export const fabricGetNamespace = (namespace: string) =>
  apiFetch<unknown[]>(`/worldstate/${namespace}`);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const fabricSignup = (data: {
  name: string;
  email: string;
  role: string;
  password?: string;
}) =>
  apiFetch<{
    success: boolean;
    token: string;
    user: { name: string; email: string; role: string };
  }>(`/auth/signup`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fabricLogin = (data: { email: string; password?: string }) =>
  apiFetch<{
    success: boolean;
    token: string;
    user: { name: string; email: string; role: string; did?: string };
  }>(`/auth/login`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fabricGetUsers = () =>
  apiFetch<{
    users: Array<{
      name: string;
      email: string;
      role: string;
      did?: string | null;
      createdAt: string;
    }>;
  }>(`/auth/users`);

// ─── Notifications ────────────────────────────────────────────────────────────────────
export const fabricGetNotifications = () =>
  apiFetch<{ notifications: unknown[]; unreadCount: number }>(`/notifications`);

export const fabricMarkAllNotificationsRead = () =>
  apiFetch<{ success: boolean }>(`/notifications/read-all`, { method: "PATCH" });

export const fabricMarkNotificationRead = (id: string) =>
  apiFetch<{ success: boolean }>(`/notifications/${id}/read`, { method: "PATCH" });

// ─── ZKP ───────────────────────────────────────────────────────────────────────────
export const fabricGenerateZKProof = (patientDid: string, selectedClaims: unknown[]) =>
  apiFetch<{ proof: unknown; txId: string; blockNumber: number }>(`/zkproof/generate`, {
    method: "POST",
    body: JSON.stringify({ patientDid, selectedClaims }),
  });

export const fabricVerifyZKProof = (proofId: string, patientDid?: string) =>
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

// ─── Chaincode ────────────────────────────────────────────────────────────────────────
export const fabricGetChaincodes = () =>
  apiFetch<{ chaincodes: unknown[]; total: number }>(`/chaincode/list`);

export const fabricInvokeChaincode = (chaincode: string, fcn: string, args: string[]) =>
  apiFetch<{ txId: string; blockNumber: number; status: string; timestamp: string }>(
    `/chaincode/invoke`,
    {
      method: "POST",
      body: JSON.stringify({ chaincode, fcn, args }),
    },
  );

export const fabricGetChaincodeInvocations = () =>
  apiFetch<{ invocations: unknown[]; total: number }>(`/chaincode/invocations`);

// ─── Auth (JWT) ───────────────────────────────────────────────────────────────
export const fabricGetMe = () =>
  apiFetch<{ user: { name: string; email: string; role: string; did?: string } }>(`/auth/me`);

export const fabricRefreshToken = () =>
  apiFetch<{ token: string }>(`/auth/refresh`, { method: "POST", body: "{}" });


