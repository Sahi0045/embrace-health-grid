// Type definitions only - all data now comes from Convex database

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

export type Shift = {
  id: string;
  day: string;
  date: string;
  start: string;
  end: string;
  unit: string;
  role: "On-call" | "OPD" | "Ward rounds" | "Surgery" | "Off";
};

export type Policy = {
  id: string;
  name: string;
  category: "Consent" | "Retention" | "Access control" | "Audit";
  status: "active" | "draft" | "archived";
  updatedAt: string;
  description: string;
};

// All data is now fetched from Convex - use the hooks in use-convex-api.ts
