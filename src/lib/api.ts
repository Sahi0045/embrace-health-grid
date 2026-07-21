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

let _serverOnline: boolean | null = null;
let _lastCheck = 0;

export async function isBackendOnline(): Promise<boolean> {
  const now = Date.now();
  if (_serverOnline !== null && now - _lastCheck < 10000) return _serverOnline;
  try {
    const r = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(1000) });
    _serverOnline = r.ok;
  } catch {
    _serverOnline = false;
  }
  _lastCheck = now;
  return _serverOnline;
}

export function resetBackendCache() {
  _serverOnline = null;
  _lastCheck = 0;
}

export const getStats = () => apiFetch<{
  blockHeight: number;
  txCount: number;
  peerCount: number;
  nodesCountUp: number;
  nodesCountTotal: number;
  worldStateSize: number;
  throughputTps: number;
  lastBlockTime: string;
  latencyMs: number;
  complianceScore: number;
}>("/stats");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Import token from auth module — reads sessionStorage (not raw localStorage)
  const { getToken } = await import("./auth");
  const token = getToken();

  const clientKey =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_CLIENT_KEY) ||
    "apollo-consortium-client-secret-2026";

  const authHeaders: Record<string, string> = {};
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
export const getAllDIDs = () => apiFetch<{ dids: any[]; total: number }>(`/did`);

export const resolveDID = (did: string) => apiFetch<any>(`/did/${encodeURIComponent(did)}`);

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

export const getCredentials = () => apiFetch<{ credentials: any[]; total: number }>(`/credentials`);

// ─── Consent ──────────────────────────────────────────────────────────────────
export const getConsents = () => apiFetch<{ consents: any[]; total: number }>(`/consent`);

export const grantConsent = (
  patientDid: string,
  doctorDid: string,
  resource: string,
  expiry?: string,
) =>
  apiFetch<any>(`/consent/grant`, {
    method: "POST",
    body: JSON.stringify({ patientDid, doctorDid, resource, expiry }),
  });

export const revokeConsent = (id: string) =>
  apiFetch<{ success: boolean }>(`/consent/${encodeURIComponent(id)}/revoke`, {
    method: "PATCH",
  });

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

export const getConsentRequests = (patientDid: string) =>
  apiFetch<{ requests: any[]; total: number }>(
    `/consent/requests/${encodeURIComponent(patientDid)}`,
  );

export const denyConsentRequest = (id: string) =>
  apiFetch<{ success: boolean }>(`/consent/requests/${encodeURIComponent(id)}/deny`, {
    method: "PATCH",
  });

// ─── Audit Events ─────────────────────────────────────────────────────────────
export const getAuditEvents = (page = 0, size = 50) =>
  apiFetch<{ events: any[]; total: number }>(`/audit?page=${page}&size=${size}`);

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
export const getMedicalRecords = (patientDid: string) =>
  apiFetch<{ records: any[]; total: number }>(`/medical-records/${encodeURIComponent(patientDid)}`);

export const createMedicalRecord = (
  patientDid: string,
  data: { title: string; type: string; content: string; doctorDid?: string; doctorName?: string },
) =>
  apiFetch<{ record: any; anchor: any }>(`/medical-records/${encodeURIComponent(patientDid)}`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateMedicalRecord = (recordId: string, data: Record<string, any>) =>
  apiFetch<{ record: any }>(`/medical-records/${encodeURIComponent(recordId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const getHealthMetrics = (patientDid: string) =>
  apiFetch<{ metrics: any[] }>(`/medical-records/${encodeURIComponent(patientDid)}/metrics`);

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

export const verifyNFCCard = (data: { cardId?: string; payload?: string }) =>
  apiFetch<{ verified: boolean; card: any }>(`/nfc/verify`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getNFCCardStatus = (patientDid: string) =>
  apiFetch<{ hasCard: boolean; card: any }>(`/nfc/status/${encodeURIComponent(patientDid)}`);

// ─── Visitors ─────────────────────────────────────────────────────────────────
export const getVisitors = (patientDid: string) =>
  apiFetch<{ visitors: any[]; total: number }>(`/visitors/${encodeURIComponent(patientDid)}`);

export const createVisitorRequest = (data: {
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

export const approveVisitorRequest = (id: string, approved: boolean) =>
  apiFetch<{ visitor: any }>(`/visitors/${encodeURIComponent(id)}/approve`, {
    method: "PATCH",
    body: JSON.stringify({ approved }),
  });

// ─── Attendance ───────────────────────────────────────────────────────────────
export const getAttendance = (staffEmail: string) =>
  apiFetch<{ records: any[]; total: number }>(`/attendance/${encodeURIComponent(staffEmail)}`);

export const clockAttendance = (data: {
  action: "in" | "out";
  nfcCardId?: string;
  location?: string;
}) =>
  apiFetch<{ record: any }>(`/attendance/clock`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// ─── Staff Requests (Leave / Shift) ───────────────────────────────────────────
export const getStaffRequests = (staffEmail: string) =>
  apiFetch<{ requests: any[]; total: number }>(`/staff-requests/${encodeURIComponent(staffEmail)}`);

export const createStaffRequest = (data: {
  requestType: string;
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  reason?: string;
  shiftDate?: string;
  shiftType?: string;
  unit?: string;
}) =>
  apiFetch<{ success: boolean; record: any }>(`/staff-requests`, {
    method: "POST",
    body: JSON.stringify(data),
  });


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
  doctorDid?: string;
  drugs?: any[];
  diagnosis?: string;
  notes?: string;
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

export const getPrescriptions = (patientDid: string) =>
  apiFetch<{ prescriptions: any[] }>(`/prescriptions/${encodeURIComponent(patientDid)}`);

export const getAllPrescriptions = () =>
  apiFetch<{ prescriptions: any[]; total: number }>(`/prescriptions`);

export const getSurgeries = () =>
  apiFetch<{ surgeries: any[]; total: number }>(`/surgeries`);

// ─── Labs ─────────────────────────────────────────────────────────────────────
export const orderLab = (
  patientDid: string,
  orderedBy: string,
  tests: string[],
  priority = "routine",
) =>
  apiFetch<any>(`/labs`, {
    method: "POST",
    body: JSON.stringify({ patientDid, orderedBy, tests, priority }),
  });

export const getLabs = (patientDid: string) =>
  apiFetch<{ labs: any[] }>(`/labs/${encodeURIComponent(patientDid)}`);

export const getAllLabs = () => apiFetch<{ labs: any[]; total: number }>(`/labs`);

// ─── Appointments ─────────────────────────────────────────────────────────────
export const getAppointments = () =>
  apiFetch<{ appointments: any[]; total: number }>(`/appointments`);

export const bookAppointment = (data: {
  patientDid: string;
  patientName: string;
  doctorDid: string;
  doctorName: string;
  slot: string;
  mode: string;
  specialty: string;
  consentGranted?: boolean;
}) =>
  apiFetch<any>(`/appointments`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// ─── Beds ─────────────────────────────────────────────────────────────────────
export const getBeds = () => apiFetch<{ beds: any[]; total: number }>(`/beds`);

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

export const getVitals = (id: string) =>
  apiFetch<{ heartRate: number; bp: string; spo2: number; temp: number; respRate: number }>(
    `/vitals/${id}`,
  );

// ─── Tracker ──────────────────────────────────────────────────────────────────
export const seedTracker = (staff: Array<{ id: string; location?: string }>) =>
  apiFetch<{ seeded: number }>(`/tracker/seed`, {
    method: "POST",
    body: JSON.stringify({ staff }),
  });

export const getTracker = () => apiFetch<{ staff: any[] }>(`/tracker`);

// ─── World State ──────────────────────────────────────────────────────────────
export const getWorldState = () => apiFetch<Record<string, unknown>>(`/worldstate`);

export const getNamespace = (namespace: string) => apiFetch<any[]>(`/worldstate/${namespace}`);

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

export const login = (data: { email: string; password?: string }) =>
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
      mrn?: string | null;
      employeeId?: string | null;
    };
  }>(`/auth/link-wallet`, {
    method: "POST",
    body: JSON.stringify({ walletAddress }),
  });

export const updateProfile = (data: {
  name?: string;
  phone?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  allergies?: string[] | string;
  department?: string;
  role?: string;
  specializations?: string[] | string;
}) =>
  apiFetch<{
    success: boolean;
    user: any;
  }>(`/auth/update-profile`, {
    method: "POST",
    body: JSON.stringify(data),
  });


export const getUsers = () =>
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
  const role  = localStorage.getItem("userRole");
  const email = localStorage.getItem("userEmail");
  const name  = localStorage.getItem("userName") ?? undefined;
  const did   = localStorage.getItem("userDID") ?? undefined;
  // Gate on sessionStorage token existing (logged-out after tab close)
  if (!sessionStorage.getItem("authToken")) return null;
  if (!role || !email) return null;
  return { name: name ?? "Guest", email, role, did };
};

export const getMe = () =>
  apiFetch<{ user: { name: string; email: string; role: string; did?: string } }>(`/auth/me`);

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
  apiFetch<{ success: boolean; message: string }>(
    `/auth/revoke/${encodeURIComponent(email)}`,
    { method: "POST", body: "{}" },
  );

/** Bootstrap: create first admin (only works when no admin exists). */
export const bootstrapSetup = (data: {
  name: string;
  email: string;
  password: string;
  setupKey?: string;
}) =>
  apiFetch<{ success: boolean; token: string; refreshToken: string; user: any }>(
    `/auth/setup`,
    { method: "POST", body: JSON.stringify(data) },
  );


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
export const getInsuranceClaims = (patientDid?: string) =>
  apiFetch<{ claims: any[]; total: number }>(
    `/insurance/claims${patientDid ? `?patientDid=${encodeURIComponent(patientDid)}` : ""}`,
  );

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
export const getDoctors = () =>
  apiFetch<{ doctors: any[]; total: number }>(`/doctors`);

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
  apiFetch<{ policies: any[]; total: number }>(`/insurance/policies/${encodeURIComponent(patientDid)}`);

export const getPreferences = (patientDid: string) =>
  apiFetch<{ preferences: any }>(`/preferences/${encodeURIComponent(patientDid)}`);

export const updatePreferences = (patientDid: string, data: any) =>
  apiFetch<{ preferences: any }>(`/preferences/${encodeURIComponent(patientDid)}`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getStaffSchedule = (staffEmail: string) =>
  apiFetch<{ schedule: any[] }>(`/staff/schedule/${encodeURIComponent(staffEmail)}`);

export const getPolicies = () =>
  apiFetch<{ policies: any[]; total: number }>("/policies");

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

export const payBill = (data: { patientDid: string; patientName: string; amount: number; category: string; reference?: string }) =>
  apiFetch<any>("/billing/payment", {
    method: "POST",
    body: JSON.stringify(data),
  });
