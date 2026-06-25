/**
 * API Client for embrace-health-grid backend
 * Connects directly to the REST server (http://localhost:3001)
 */

const getFabricBaseUrl = (): string => {
  const envUrl = typeof process !== "undefined" && process?.env ? process.env.VITE_FABRIC_BASE : undefined;
  const viteEnvUrl = typeof import.meta !== "undefined" && (import.meta as any).env ? (import.meta as any).env.VITE_FABRIC_BASE : undefined;
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

export const FABRIC_BASE = getFabricBaseUrl();
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

export function resetFabricCache() {
  _serverOnline = null;
  _lastCheck = 0;
}

export const fabricGetStats = async () => ({
  blockHeight: 1,
  txCount: 0,
  peerCount: 3,
  worldStateSize: 0,
  throughputTps: 0,
  lastBlockTime: new Date().toISOString(),
});

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const role = typeof window !== "undefined" ? localStorage.getItem("userRole") : null;
  const email = typeof window !== "undefined" ? localStorage.getItem("userEmail") : null;
  const token = typeof window !== "undefined" ? localStorage.getItem("fabricAuthToken") : null;
  const clientKey = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_CLIENT_KEY) || "apollo-consortium-client-secret-2026";
  
  const authHeaders: Record<string, string> = {};
  if (role) authHeaders["x-user-role"] = role;
  if (email) authHeaders["x-user-email"] = email;
  if (token) authHeaders["Authorization"] = "Bearer " + token;
  if (clientKey) authHeaders["x-client-key"] = clientKey;

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

// ─── DIDs ─────────────────────────────────────────────────────────────────────
export const fabricGetAllDIDs = () =>
  apiFetch<{ dids: any[]; total: number }>(`/did`);

export const fabricResolveDID = (did: string) =>
  apiFetch<any>(`/did/${encodeURIComponent(did)}`);

export const fabricCreateDID = (
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

export const fabricRevokeDID = (did: string) =>
  apiFetch<{ success: boolean; did: string; status: string }>(`/did/${encodeURIComponent(did)}/revoke`, {
    method: "PATCH",
  });

// ─── Credentials ──────────────────────────────────────────────────────────────
export const fabricIssueCredential = (
  did: string,
  type: string,
  claims: Record<string, string>,
  issuer?: string,
) =>
  apiFetch<{ vc: any; txId: string }>(`/credential/issue`, {
    method: "POST",
    body: JSON.stringify({ did, type, claims, issuer }),
  });

export const fabricRevokeCredential = (id: string) =>
  apiFetch<{ success: boolean; id: string }>(`/credential/${encodeURIComponent(id)}/revoke`, {
    method: "PATCH",
  });

export const fabricGetCredentials = () =>
  apiFetch<{ credentials: any[]; total: number }>(`/credentials`);

// ─── Consent ──────────────────────────────────────────────────────────────────
export const fabricGetConsents = () =>
  apiFetch<{ consents: any[]; total: number }>(`/consent`);

export const fabricGrantConsent = (
  patientDid: string,
  doctorDid: string,
  resource: string,
  expiry?: string,
) =>
  apiFetch<any>(`/consent/grant`, {
    method: "POST",
    body: JSON.stringify({ patientDid, doctorDid, resource, expiry }),
  });

export const fabricRevokeConsent = (id: string) =>
  apiFetch<{ success: boolean }>(`/consent/${encodeURIComponent(id)}/revoke`, {
    method: "PATCH",
  });

export const fabricRequestConsent = (data: {
  doctorDid: string;
  doctorName?: string;
  patientDid: string;
  resource: string;
  reason?: string;
  expiry?: string;
}) =>
  apiFetch<{ success: boolean; requestId: string; request: any; txId: string }>(`/consent/request`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fabricGetConsentRequests = (patientDid: string) =>
  apiFetch<{ requests: any[]; total: number }>(`/consent/requests/${encodeURIComponent(patientDid)}`);

export const fabricDenyConsentRequest = (id: string) =>
  apiFetch<{ success: boolean }>(`/consent/requests/${encodeURIComponent(id)}/deny`, {
    method: "PATCH",
  });

// ─── Audit Events ─────────────────────────────────────────────────────────────
export const fabricGetAuditEvents = (page = 0, size = 50) =>
  apiFetch<{ events: any[]; total: number }>(`/audit?page=${page}&size=${size}`);

export const fabricLogAuditEvent = (
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
export const fabricGetMedicalRecords = (patientDid: string) =>
  apiFetch<{ records: any[]; total: number }>(`/medical-records/${encodeURIComponent(patientDid)}`);

export const fabricCreateMedicalRecord = (
  patientDid: string,
  data: { title: string; type: string; content: string; doctorDid?: string; doctorName?: string }
) =>
  apiFetch<{ record: any; anchor: any }>(`/medical-records/${encodeURIComponent(patientDid)}`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fabricUpdateMedicalRecord = (
  recordId: string,
  data: Record<string, any>
) =>
  apiFetch<{ record: any }>(`/medical-records/${encodeURIComponent(recordId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

// ─── NFC Cards ────────────────────────────────────────────────────────────────
export const fabricIssueNFCCard = (data: {
  patientDid: string;
  patientName: string;
  mrn: string;
  cardType?: string;
}) =>
  apiFetch<{ card: any }>(`/nfc/issue`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fabricGetNFCCard = (cardId: string) =>
  apiFetch<any>(`/nfc/${encodeURIComponent(cardId)}`);

export const fabricRevokeNFCCard = (cardId: string) =>
  apiFetch<{ success: boolean; cardId: string }>(`/nfc/${encodeURIComponent(cardId)}/revoke`, {
    method: "PATCH",
  });

export const fabricVerifyNFCCard = (data: { cardId?: string; payload?: string }) =>
  apiFetch<{ verified: boolean; card: any }>(`/nfc/verify`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// ─── Visitors ─────────────────────────────────────────────────────────────────
export const fabricGetVisitors = (patientDid: string) =>
  apiFetch<{ visitors: any[]; total: number }>(`/visitors/${encodeURIComponent(patientDid)}`);

export const fabricCreateVisitorRequest = (data: {
  patientDid: string;
  visitorName: string;
  relation: string;
  visitDate: string;
  purpose: string;
}) =>
  apiFetch<{ request: any }>(`/visitors/request`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fabricApproveVisitorRequest = (id: string, approved: boolean) =>
  apiFetch<{ visitor: any }>(`/visitors/${encodeURIComponent(id)}/approve`, {
    method: "PATCH",
    body: JSON.stringify({ approved }),
  });

// ─── Attendance ───────────────────────────────────────────────────────────────
export const fabricGetAttendance = (staffEmail: string) =>
  apiFetch<{ records: any[]; total: number }>(`/attendance/${encodeURIComponent(staffEmail)}`);

export const fabricClockAttendance = (data: {
  action: "in" | "out";
  nfcCardId?: string;
  location?: string;
}) =>
  apiFetch<{ record: any }>(`/attendance/clock`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// ─── Pagers ───────────────────────────────────────────────────────────────────
export const fabricDispatchPagerNotify = (staffDid: string, name: string, location: string) =>
  apiFetch<{ success: boolean; notifyEvent: any }>(`/tracker/notify`, {
    method: "POST",
    body: JSON.stringify({ staffDid, name, location }),
  });

// ─── Solana Anchors ───────────────────────────────────────────────────────────
export const solanaAnchor = (recordHash: string, recordType: string, actorDid?: string, recordId?: string) =>
  apiFetch<any>(`/solana/anchor`, {
    method: "POST",
    body: JSON.stringify({ recordHash, recordType, actorDid, recordId }),
  });

export const solanaVerifyAnchor = (signature: string) =>
  apiFetch<any>(`/solana/verify/${encodeURIComponent(signature)}`);

export const solanaGetAnchors = (limit = 50) =>
  apiFetch<{ anchors: any[]; simulated: boolean }>(`/solana/anchors?limit=${limit}`);

// ─── Prescriptions ────────────────────────────────────────────────────────────
export const fabricSignPrescription = (data: {
  patientDid: string;
  doctorDid: string;
  drugs: any[];
  diagnosis: string;
  notes: string;
  signedBy: string;
}) =>
  apiFetch<{ rxId: string; rx: any; txId: string }>(`/prescriptions`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fabricGetPrescriptions = (patientDid: string) =>
  apiFetch<{ prescriptions: any[] }>(`/prescriptions/${encodeURIComponent(patientDid)}`);

export const fabricGetAllPrescriptions = () =>
  apiFetch<{ prescriptions: any[]; total: number }>(`/prescriptions`);

// ─── Labs ─────────────────────────────────────────────────────────────────────
export const fabricOrderLab = (
  patientDid: string,
  orderedBy: string,
  tests: string[],
  priority = "routine",
) =>
  apiFetch<any>(`/labs`, {
    method: "POST",
    body: JSON.stringify({ patientDid, orderedBy, tests, priority }),
  });

export const fabricGetLabs = (patientDid: string) =>
  apiFetch<{ labs: any[] }>(`/labs/${encodeURIComponent(patientDid)}`);

export const fabricGetAllLabs = () =>
  apiFetch<{ labs: any[]; total: number }>(`/labs`);

// ─── Appointments ─────────────────────────────────────────────────────────────
export const fabricGetAppointments = () =>
  apiFetch<{ appointments: any[]; total: number }>(`/appointments`);

export const fabricBookAppointment = (data: {
  patientDid: string;
  patientName: string;
  doctorDid: string;
  doctorName: string;
  slot: string;
  mode: string;
  specialty: string;
}) =>
  apiFetch<any>(`/appointments`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// ─── Beds ─────────────────────────────────────────────────────────────────────
export const fabricGetBeds = () =>
  apiFetch<{ beds: any[]; total: number }>(`/beds`);

export const fabricUpdateBed = (bedId: string, ward: string, status: string, patientDid?: string) =>
  apiFetch<any>(`/beds`, {
    method: "POST",
    body: JSON.stringify({ bedId, ward, status, patientDid }),
  });

// ─── Billing ──────────────────────────────────────────────────────────────────
export const fabricRecordPayment = (data: {
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

export const fabricGetBilling = (patientDid: string) =>
  apiFetch<{ payments: any[] }>(`/billing/${encodeURIComponent(patientDid)}`);

// ─── Fraud ────────────────────────────────────────────────────────────────────
export const fabricGetFraudAlerts = () =>
  apiFetch<{ alerts: any[]; total: number }>(`/fraud/alerts`);

export const fabricRaiseFraudAlert = (
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

export const fabricGetTracker = () =>
  apiFetch<{ staff: any[] }>(`/tracker`);

// ─── World State ──────────────────────────────────────────────────────────────
export const fabricGetWorldState = () =>
  apiFetch<Record<string, unknown>>(`/worldstate`);

export const fabricGetNamespace = (namespace: string) =>
  apiFetch<any[]>(`/worldstate/${namespace}`);

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

// ─── Notifications ────────────────────────────────────────────────────────────
export const fabricGetNotifications = () =>
  apiFetch<{ notifications: any[]; unreadCount: number }>(`/notifications`);

export const fabricMarkAllNotificationsRead = () =>
  apiFetch<{ success: boolean }>(`/notifications/read-all`, { method: "PATCH" });

export const fabricMarkNotificationRead = (id: string) =>
  apiFetch<{ success: boolean }>(`/notifications/${id}/read`, { method: "PATCH" });

// ─── ZKP ──────────────────────────────────────────────────────────────────────
export const fabricGenerateZKProof = (patientDid: string, selectedClaims: unknown[]) =>
  apiFetch<{ proof: any; txId: string }>(`/zkproof/generate`, {
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

// ─── Auth (JWT) ───────────────────────────────────────────────────────────────
const getStoredUser = () => {
  if (typeof window === "undefined") return null;
  const role = localStorage.getItem("userRole");
  const email = localStorage.getItem("userEmail");
  const name = localStorage.getItem("userName") ?? undefined;
  const did = localStorage.getItem("userDID") ?? undefined;
  if (!role || !email) return null;
  return { name: name ?? "Guest", email, role, did };
};

export const fabricGetMe = () =>
  apiFetch<{ user: { name: string; email: string; role: string; did?: string } }>(`/auth/me`);

export const fabricRefreshToken = () =>
  apiFetch<{ token: string }>(`/auth/refresh`, { method: "POST", body: "{}" });
