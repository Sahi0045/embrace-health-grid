export type Patient = {
  id: string;
  did: string;
  name: string;
  mrn: string;
  age: number;
  gender: "M" | "F";
  bloodGroup: string;
  allergies: string[];
  phone: string;
};

export type Credential = {
  id: string;
  type: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  status: "active" | "expired";
};

export type ConsentGrant = {
  id: string;
  requester: string;
  requesterRole: string;
  reason: string;
  grantedAt: string;
  expiresAt: string;
  status: "active" | "pending" | "revoked";
};

export type AccessEvent = {
  id: string;
  actor: string;
  actorRole: string;
  resource: string;
  action: "viewed" | "signed" | "exported" | "updated";
  at: string;
};

export type DIDRecord = {
  did: string;
  subject: string;
  type: "patient" | "doctor" | "nurse" | "admin";
  issuedAt: string;
  status: "active" | "revoked";
};

export type FraudAlert = {
  id: string;
  severity: "low" | "medium" | "high";
  message: string;
  actor: string;
  at: string;
};

export const currentPatient: Patient = {
  id: "",
  did: "",
  name: "",
  mrn: "",
  age: 0,
  gender: "F",
  bloodGroup: "",
  allergies: [],
  phone: "",
};

export const credentials: Credential[] = [];
export const consents: ConsentGrant[] = [];
export const accessHistory: AccessEvent[] = [];
export const staffPatients: Patient[] = [];
export const dids: DIDRecord[] = [];
export const fraudAlerts: FraudAlert[] = [];

export const systemStats = {
  totalDIDs: 0,
  activeUsers: 0,
  consentsToday: 0,
  avgCheckInSec: 0,
  complianceScore: 100,
  blockchainNodes: { up: 7, total: 7 },
  apiLatencyMs: 0,
};

export type Appointment = {
  id: string;
  doctor: string;
  specialty: string;
  hospital: string;
  date: string;
  time: string;
  status: "upcoming" | "completed" | "cancelled";
  mode: "in-person" | "tele";
};

export const appointments: Appointment[] = [];
export const availableSlots: { id: string; date: string; day: string; times: string[] }[] = [];

export type Shift = {
  id: string;
  day: string;
  date: string;
  start: string;
  end: string;
  unit: string;
  role: "On-call" | "OPD" | "Ward rounds" | "Surgery" | "Off";
};

export const staffSchedule: Shift[] = [];

export type Policy = {
  id: string;
  name: string;
  category: "Consent" | "Retention" | "Access control" | "Audit";
  status: "active" | "draft" | "archived";
  updatedAt: string;
  description: string;
};

export const policies: Policy[] = [];

