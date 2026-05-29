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
  id: "pat_001",
  did: "did:hosp:0x4a91…b7d2",
  name: "Anika Sharma",
  mrn: "MRN-204871",
  age: 34,
  gender: "F",
  bloodGroup: "O+",
  allergies: ["Penicillin", "Sulfa drugs"],
  phone: "+91 98••• ••432",
};

export const credentials: Credential[] = [
  { id: "c1", type: "Patient Identity", issuer: "Apollo Hospitals", issuedAt: "2025-01-12", expiresAt: "2027-01-12", status: "active" },
  { id: "c2", type: "Health Insurance", issuer: "Star Health", issuedAt: "2025-04-02", expiresAt: "2026-04-02", status: "active" },
  { id: "c3", type: "Vaccination Record", issuer: "Govt. of India", issuedAt: "2024-09-18", expiresAt: "2034-09-18", status: "active" },
  { id: "c4", type: "Lab Report Access", issuer: "Apollo Diagnostics", issuedAt: "2025-03-21", expiresAt: "2025-09-21", status: "expired" },
];

export const consents: ConsentGrant[] = [
  { id: "g1", requester: "Dr. Ravi Menon", requesterRole: "Cardiologist", reason: "Follow-up consultation", grantedAt: "2026-05-22", expiresAt: "2026-06-22", status: "active" },
  { id: "g2", requester: "Nurse Priya K.", requesterRole: "ICU Nursing", reason: "Vitals monitoring", grantedAt: "2026-05-28", expiresAt: "2026-05-30", status: "active" },
  { id: "g3", requester: "Dr. Aanya Verma", requesterRole: "Radiologist", reason: "Review chest X-ray", grantedAt: "2026-05-29", expiresAt: "2026-05-31", status: "pending" },
  { id: "g4", requester: "Apollo Pharmacy", requesterRole: "Pharmacy", reason: "Prescription dispense", grantedAt: "2026-04-11", expiresAt: "2026-04-12", status: "revoked" },
];

export const accessHistory: AccessEvent[] = [
  { id: "a1", actor: "Dr. Ravi Menon", actorRole: "Cardiologist", resource: "ECG Report 2026-05-22", action: "viewed", at: "2026-05-29 10:42" },
  { id: "a2", actor: "Nurse Priya K.", actorRole: "ICU Nursing", resource: "Vitals chart", action: "updated", at: "2026-05-29 09:15" },
  { id: "a3", actor: "Dr. Ravi Menon", actorRole: "Cardiologist", resource: "Prescription #PR-9821", action: "signed", at: "2026-05-28 17:03" },
  { id: "a4", actor: "Star Health Claims", actorRole: "Insurer", resource: "Discharge summary", action: "exported", at: "2026-05-27 14:21" },
  { id: "a5", actor: "Dr. Aanya Verma", actorRole: "Radiologist", resource: "Chest X-ray DICOM", action: "viewed", at: "2026-05-27 11:08" },
];

export const staffPatients: Patient[] = [
  currentPatient,
  { id: "pat_002", did: "did:hosp:0x91c2…ee04", name: "Rohan Iyer", mrn: "MRN-204902", age: 58, gender: "M", bloodGroup: "B+", allergies: ["Aspirin"], phone: "+91 90••• ••118" },
  { id: "pat_003", did: "did:hosp:0x77a3…12fa", name: "Meera Pillai", mrn: "MRN-205110", age: 27, gender: "F", bloodGroup: "A-", allergies: [], phone: "+91 70••• ••907" },
  { id: "pat_004", did: "did:hosp:0xbe49…3c20", name: "Karthik Rao", mrn: "MRN-205288", age: 41, gender: "M", bloodGroup: "AB+", allergies: ["Latex"], phone: "+91 88••• ••504" },
];

export const dids: DIDRecord[] = [
  { did: "did:hosp:0x4a91…b7d2", subject: "Anika Sharma", type: "patient", issuedAt: "2025-01-12", status: "active" },
  { did: "did:hosp:0x91c2…ee04", subject: "Rohan Iyer", type: "patient", issuedAt: "2025-02-04", status: "active" },
  { did: "did:hosp:0x77a3…12fa", subject: "Meera Pillai", type: "patient", issuedAt: "2025-03-19", status: "active" },
  { did: "did:hosp:0xbe49…3c20", subject: "Karthik Rao", type: "patient", issuedAt: "2025-04-22", status: "active" },
  { did: "did:hosp:0xd103…99aa", subject: "Dr. Ravi Menon", type: "doctor", issuedAt: "2024-11-08", status: "active" },
  { did: "did:hosp:0x55ef…7711", subject: "Dr. Aanya Verma", type: "doctor", issuedAt: "2025-01-30", status: "active" },
  { did: "did:hosp:0x22bd…44c1", subject: "Nurse Priya K.", type: "nurse", issuedAt: "2024-08-14", status: "active" },
  { did: "did:hosp:0x019a…ff32", subject: "Old Test Account", type: "patient", issuedAt: "2024-02-01", status: "revoked" },
];

export const fraudAlerts: FraudAlert[] = [
  { id: "f1", severity: "high", message: "Unusual access pattern: 17 patient records viewed in 4 minutes", actor: "Dr. Ravi Menon", at: "2026-05-29 11:02" },
  { id: "f2", severity: "medium", message: "Access attempt outside shift hours", actor: "Nurse Priya K.", at: "2026-05-28 02:14" },
  { id: "f3", severity: "low", message: "Failed MFA challenge (3 attempts)", actor: "did:hosp:0x019a…ff32", at: "2026-05-27 22:48" },
];

export const systemStats = {
  totalDIDs: 12_847,
  activeUsers: 1_204,
  consentsToday: 312,
  avgCheckInSec: 18,
  complianceScore: 96,
  blockchainNodes: { up: 7, total: 7 },
  apiLatencyMs: 84,
};

export type Appointment = {
  id: string;
  doctor: string;
  specialty: string;
  hospital: string;
  date: string; // ISO date
  time: string; // human
  status: "upcoming" | "completed" | "cancelled";
  mode: "in-person" | "tele";
};

export const appointments: Appointment[] = [
  { id: "ap1", doctor: "Dr. Ravi Menon", specialty: "Cardiology", hospital: "Apollo Hospitals · OPD-3", date: "2026-06-04", time: "Thu · 10:30 AM", status: "upcoming", mode: "in-person" },
  { id: "ap2", doctor: "Dr. Aanya Verma", specialty: "Radiology follow-up", hospital: "Telehealth", date: "2026-06-09", time: "Tue · 4:15 PM", status: "upcoming", mode: "tele" },
  { id: "ap3", doctor: "Dr. Sameer Khan", specialty: "General physician", hospital: "Apollo Hospitals · OPD-1", date: "2026-05-18", time: "Mon · 9:00 AM", status: "completed", mode: "in-person" },
];

export const availableSlots = [
  { id: "s1", date: "2026-06-02", day: "Tue", times: ["09:00", "09:30", "11:00", "14:30"] },
  { id: "s2", date: "2026-06-03", day: "Wed", times: ["10:00", "10:30", "13:00", "15:30", "16:00"] },
  { id: "s3", date: "2026-06-04", day: "Thu", times: ["09:30", "11:30", "14:00"] },
  { id: "s4", date: "2026-06-05", day: "Fri", times: ["08:30", "10:00", "12:30", "15:00"] },
];

export type Shift = {
  id: string;
  day: string;          // "Mon"
  date: string;         // "2026-06-01"
  start: string;        // "08:00"
  end: string;          // "16:00"
  unit: string;
  role: "On-call" | "OPD" | "Ward rounds" | "Surgery" | "Off";
};

export const staffSchedule: Shift[] = [
  { id: "sh1", day: "Mon", date: "2026-06-01", start: "08:00", end: "16:00", unit: "Cardiology OPD", role: "OPD" },
  { id: "sh2", day: "Tue", date: "2026-06-02", start: "08:00", end: "12:00", unit: "Ward 4B", role: "Ward rounds" },
  { id: "sh3", day: "Tue", date: "2026-06-02", start: "13:00", end: "17:00", unit: "Cath Lab", role: "Surgery" },
  { id: "sh4", day: "Wed", date: "2026-06-03", start: "—", end: "—", unit: "—", role: "Off" },
  { id: "sh5", day: "Thu", date: "2026-06-04", start: "08:00", end: "16:00", unit: "Cardiology OPD", role: "OPD" },
  { id: "sh6", day: "Fri", date: "2026-06-05", start: "20:00", end: "08:00", unit: "Emergency", role: "On-call" },
];

export type Policy = {
  id: string;
  name: string;
  category: "Consent" | "Retention" | "Access control" | "Audit";
  status: "active" | "draft" | "archived";
  updatedAt: string;
  description: string;
};

export const policies: Policy[] = [
  { id: "p1", name: "Default consent expiry", category: "Consent", status: "active", updatedAt: "2026-04-12", description: "Patient consents auto-expire after 30 days unless renewed." },
  { id: "p2", name: "Emergency override (break-glass)", category: "Access control", status: "active", updatedAt: "2026-03-02", description: "Clinicians may access records without consent in flagged emergencies; auto-audited." },
  { id: "p3", name: "Record retention — minors", category: "Retention", status: "active", updatedAt: "2026-02-18", description: "Pediatric records retained until age 25 or 7 years post-discharge, whichever is later." },
  { id: "p4", name: "Cross-hospital DID resolution", category: "Access control", status: "draft", updatedAt: "2026-05-20", description: "Allow verified partner hospitals to resolve DIDs via shared ledger." },
  { id: "p5", name: "Audit log immutability window", category: "Audit", status: "active", updatedAt: "2025-12-08", description: "All audit events sealed to blockchain within 5 minutes; no in-place edits." },
  { id: "p6", name: "Legacy CSV export endpoint", category: "Audit", status: "archived", updatedAt: "2025-08-01", description: "Deprecated in favor of signed JSON-LD bundles." },
];

