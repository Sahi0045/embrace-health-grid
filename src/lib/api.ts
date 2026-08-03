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

export const getStats = () =>
  apiFetch<{
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

export const requestDID = (data: { ownerName?: string; ownerType?: string; department?: string }) =>
  apiFetch<{ success: boolean; request: any; message?: string }>(`/did/request`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getDIDRequests = () =>
  apiFetch<{ requests: any[]; total: number }>(`/did/requests`);

export const approveDIDRequest = (requestId: string) =>
  apiFetch<{ success: boolean; did: string; doc: any }>(`/did/requests/${encodeURIComponent(requestId)}/approve`, {
    method: "POST",
  });

export const rejectDIDRequest = (requestId: string) =>
  apiFetch<{ success: boolean; request: any }>(`/did/requests/${encodeURIComponent(requestId)}/reject`, {
    method: "POST",
  });

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

/** Staff/Admin: fetch ALL medical records across all patients */
export const getAllMedicalRecords = () =>
  apiFetch<{ records: any[]; total: number }>(`/medical-records`);

/** Doctor: fetch only records they created */
export const getMyMedicalRecords = () =>
  apiFetch<{ records: any[]; total: number }>(`/medical-records/my`);

/** Fetch the medical report linked to a specific prescription (by rxId) */
export const getMedicalRecordByRx = (rxId: string) =>
  apiFetch<{ record: any | null }>(`/medical-records/by-prescription/${encodeURIComponent(rxId)}`);

export const createMedicalRecord = (
  patientDid: string,
  data: {
    title: string;
    type: string;
    content: string;
    doctorDid?: string;
    doctorName?: string;
    /** Link this report to a prescription */
    rxId?: string;
    apptId?: string;
    consultationSummary?: string;
    clinicalNotes?: string;
    testResults?: string;
    recommendedFollowUp?: string;
  },
) =>
  apiFetch<{ record: any; txId: string }>(`/medical-records/${encodeURIComponent(patientDid)}`, {
    method: "POST",
    body: JSON.stringify(data),
  });

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

export const updateEmergencyProfile = (data: {
  emergencyContact?: { name: string; relation: string; phone: string };
  bloodGroup?: string;
  allergies?: string[];
  conditions?: string[];
  organDonor?: boolean;
}) =>
  apiFetch<{ success: boolean; patient: any }>(`/patient/emergency-profile`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });


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

export const getAdminAttendanceSummary = () =>
  apiFetch<{
    summary: {
      totalEligibleStaff: number;
      presentToday: number;
      checkedInCount: number;
      checkedOutCount: number;
      absentToday: number;
      date: string;
    };
    roster: any[];
    allRecords: any[];
  }>(`/attendance/admin/summary`);


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
export const getPatientOnChainHistory = (patientDid: string) =>
  apiFetch<{
    prescriptions: Array<{
      rxId: string;
      patientDid: string;
      patientName: string;
      doctorDid: string;
      doctorName: string;
      apptId: string | null;
      signedAt: string | null;
      signedBy: string;
      status: string;
      diagnosis: string;
      chiefComplaint: string;
      symptoms: string;
      drugs: any[];
      notes: string;
      followUpDate: string | null;
      hash: string;
      txId: string | null;
      blockchainMeta: any | null;
      verification: {
        hashVerified: boolean;
        hashAlgorithm: string;
        anchorRecord: {
          anchorId: string;
          signature: string;
          network: string;
          anchoredAt: string;
          slot: number;
        } | null;
        blockchainTx: {
          txHash: string;
          rootId: string;
          publishedAt: string;
          onChain: boolean;
        } | null;
        signatureStatus: "verified" | "hash_mismatch" | "no_signature";
        verifiedAt: string;
      };
    }>;
    total: number;
    patientDid: string;
    retrievedBy: string;
    retrievedAt: string;
    message?: string;
  }>(`/prescriptions/${encodeURIComponent(patientDid)}/onchain`);

export const getAllPrescriptions = () =>
  apiFetch<{ prescriptions: any[]; total: number }>(`/prescriptions`);

/** Prescriptions written by the currently authenticated doctor */
export const getMyPrescriptions = () =>
  apiFetch<{ prescriptions: any[]; total: number }>(`/prescriptions/my`);

/** Patients who have appointments with the authenticated doctor */
export const getMyPatients = () =>
  apiFetch<{ patients: any[]; total: number }>(`/appointments/my-patients`);

export const getSurgeries = () => apiFetch<{ surgeries: any[]; total: number }>(`/surgeries`);

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


export const getAllLabs = () => apiFetch<{ labs: any[]; total: number }>(`/labs`);

// ─── Appointments ─────────────────────────────────────────────────────────────
export const getAppointments = () =>
  apiFetch<{ appointments: any[]; total: number }>(`/appointments`);

export const getAppointmentsByPatient = (patientDid: string) =>
  apiFetch<{ appointments: any[]; total: number }>(`/appointments?patientDid=${encodeURIComponent(patientDid)}`);

export const getAppointmentsByDoctor = (doctorDid: string) =>
  apiFetch<{ appointments: any[]; total: number }>(`/appointments?doctorDid=${encodeURIComponent(doctorDid)}`);

/** Pending appointment requests waiting for the authenticated doctor to accept/reject */
export const getDoctorAppointmentRequests = () =>
  apiFetch<{ requests: any[]; total: number }>(`/appointments/requests`);

/** All appointments for the authenticated doctor (any status) */
export const getDoctorAppointments = () =>
  apiFetch<{ appointments: any[]; total: number }>(`/appointments/my`);

export const bookAppointment = (data: {
  patientDid: string;
  patientName: string;
  doctorDid: string;
  doctorName: string;
  slot: string;
  date: string;
  mode: string;
  specialty: string;
  reason?: string;
  consentGranted?: boolean;
}) =>
  apiFetch<any>(`/appointments`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateAppointmentStatus = (id: string, status: string, notes?: string, suggestedSlot?: string) =>
  apiFetch<any>(`/appointments/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes, suggestedSlot }),
  });

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

export const getDoctorLocationHistory = (doctorDid: string) =>
  apiFetch<{ logs: any[] }>(`/doctor/location-history/${encodeURIComponent(doctorDid)}`);

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

export const login = (data: { email: string; password?: string; portal?: "patient" | "staff" | "admin" }) =>
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
  const role = localStorage.getItem("userRole");
  const email = localStorage.getItem("userEmail");
  const name = localStorage.getItem("userName") ?? undefined;
  const did = localStorage.getItem("userDID") ?? undefined;
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

export const roomCheckInMulti = (roomIds: string[], action: "checkin" | "checkout") =>
  apiFetch<{ success: boolean; results: any[]; activeRooms: string[]; hasActiveRoom: boolean }>(
    `/room-checkin/multi`,
    { method: "POST", body: JSON.stringify({ roomIds, action }) },
  );


export const getRoomCheckinHistory = (doctorDid: string) =>
  apiFetch<{ logs: any[]; total: number }>(
    `/room-checkin/history/${encodeURIComponent(doctorDid)}`,
  );

// ─── Merkle Tree: Room Check-In daily aggregation & publishing ────────────
/** Fetch today's room events + pre-computed Merkle root for a doctor */

/** Publish today's Merkle root to blockchain — doctors only.
 *  Pass txSignature (base58 Solana tx sig) and walletAddress when publishing on-chain. */
export const publishMerkleRoot = (
  doctorDid: string,
  txSignature?: string,
  walletAddress?: string,
) =>
  apiFetch<{
    success: boolean; merkleRoot: string; txHash: string;
    rootId: string; eventCount: number; publishedAt: string; onChain: boolean;
  }>(
    `/merkle-root/publish`,
    { method: "POST", body: JSON.stringify({ doctorDid, txSignature, walletAddress }) },
  );

/** Fetch history of all published Merkle roots for a doctor */
export const getMerkleRootHistory = (doctorDid: string) =>
  apiFetch<{ roots: any[]; total: number }>(
    `/merkle-root/${encodeURIComponent(doctorDid)}/history`,
  );

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
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
    visitor: row
      ? { id: row.visitor_id, visitorName: row.visitor_name, status: row.status }
      : null,
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

  if (!cardId) return { valid: false as const, verified: false as const, reason: "No card id supplied" };

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
    claim: { claimId: res.claimId, amount: payload.amount, description: payload.description, status: "submitted" },
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
