export type AuditEventCategory = "access" | "consent" | "credential" | "infrastructure" | "auth" | "prescription" | "emergency";

export type AuditEvent = {
  id: string;
  category: AuditEventCategory;
  action: string;
  actor: string;
  actorRole: string;
  actorDID: string;
  target: string;
  targetDID?: string;
  ip: string;
  result: "success" | "denied" | "error";
  severity: "info" | "warning" | "critical";
  at: string;
  details: string;
  hash: string;
};

const actors = [
  { name: "Dr. Ravi Menon", role: "Cardiologist", did: "did:hosp:0xd103…99aa" },
  { name: "Dr. Aanya Verma", role: "Radiologist", did: "did:hosp:0x55ef…7711" },
  { name: "Nurse Priya K.", role: "ICU Nursing", did: "did:hosp:0x22bd…44c1" },
  { name: "Admin Sanjay Kapoor", role: "System Admin", did: "did:hosp:admin:0x77a3" },
  { name: "Dr. Sameer Khan", role: "General Physician", did: "did:hosp:0x44bc…ee12" },
  { name: "Star Health Claims", role: "Insurance Verifier", did: "did:hosp:ins:0xabc1" },
  { name: "Pharmacy Dispense Bot", role: "Pharmacy System", did: "did:hosp:sys:0x0011" },
  { name: "Lab Technician Ram", role: "Pathology", did: "did:hosp:0x99cd…1122" },
];

const actions: { cat: AuditEventCategory; action: string; details: string; severity: AuditEvent["severity"]; result: AuditEvent["result"] }[] = [
  { cat: "access", action: "Viewed patient record", details: "Patient chart accessed via authorized consent token", severity: "info", result: "success" },
  { cat: "access", action: "Exported discharge summary", details: "PDF export of discharge summary signed and delivered to insurer", severity: "info", result: "success" },
  { cat: "access", action: "Unauthorized access attempt", details: "Access attempted without valid consent — blocked by policy engine", severity: "critical", result: "denied" },
  { cat: "consent", action: "Consent granted", details: "Patient granted 30-day access to cardiology records", severity: "info", result: "success" },
  { cat: "consent", action: "Consent revoked", details: "Patient manually revoked access for pharmacy dispense", severity: "warning", result: "success" },
  { cat: "consent", action: "Consent expired", details: "Auto-expiry triggered on consent token — system revoked", severity: "info", result: "success" },
  { cat: "credential", action: "Credential issued", details: "Vaccination credential issued via NHA schema v1.2", severity: "info", result: "success" },
  { cat: "credential", action: "Credential verified", details: "Insurance policy credential verified by claims portal", severity: "info", result: "success" },
  { cat: "credential", action: "Credential revoked", details: "Expired prescription credential revoked by issuer", severity: "warning", result: "success" },
  { cat: "infrastructure", action: "Bed status updated", details: "Bed C-14 marked occupied, patient MRN-204871 assigned", severity: "info", result: "success" },
  { cat: "infrastructure", action: "Equipment maintenance", details: "MRI Scanner SIEMENS-003 flagged for scheduled maintenance", severity: "warning", result: "success" },
  { cat: "auth", action: "Login success", details: "Staff DID authenticated via biometric MFA", severity: "info", result: "success" },
  { cat: "auth", action: "Login failed", details: "Three consecutive MFA failures — account temporarily locked", severity: "critical", result: "error" },
  { cat: "prescription", action: "Prescription signed", details: "E-prescription digitally signed with doctor DID credentials", severity: "info", result: "success" },
  { cat: "emergency", action: "Break glass access", details: "Emergency override used — patient unconscious in ICU, no prior consent", severity: "critical", result: "success" },
  { cat: "emergency", action: "Emergency profile accessed", details: "Blood group and allergy data accessed during trauma response", severity: "warning", result: "success" },
];

const targets = [
  "Patient Record MRN-204871",
  "Credential VCI-2310-COVA-001",
  "Consent Token CT-8821",
  "Bed C-14 (Ward 4A)",
  "Lab Report LAB-2026-0441",
  "Prescription RX-9821",
  "DID did:hosp:0x4a91…b7d2",
  "ICU Monitor BED-ICU-07",
  "Discharge Summary DS-2026-114",
  "Vaccination Record VR-001",
];

const ips = ["10.0.1.44","10.0.2.112","192.168.1.8","10.0.5.7","172.16.4.22","10.1.0.55","192.168.10.3"];

function hashInt(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return Math.abs(h); }
function pad(n: number) { return String(n).padStart(2, "0"); }

export function generateAuditEvents(count = 5000): AuditEvent[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `evt_${String(i + 1).padStart(6, "0")}`;
    const seed = hashInt(id);
    const actor = actors[seed % actors.length];
    const ev = actions[(seed >> 2) % actions.length];
    const target = targets[(seed >> 3) % targets.length];
    const daysAgo = seed % 180;
    const d = new Date(2026, 4, 29);
    d.setDate(d.getDate() - daysAgo);
    const hour = pad(seed % 24);
    const min = pad((seed >> 1) % 60);
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hour}:${min}`;
    const hashVal = ((seed * 0xdeadbeef) >>> 0).toString(16).padStart(8, "0");

    return {
      id,
      category: ev.cat,
      action: ev.action,
      actor: actor.name,
      actorRole: actor.role,
      actorDID: actor.did,
      target,
      targetDID: seed % 3 === 0 ? `did:hosp:0x${(seed * 2).toString(16).padStart(4, "0")}…` : undefined,
      ip: ips[seed % ips.length],
      result: ev.result,
      severity: ev.severity,
      at: dateStr,
      details: ev.details,
      hash: `sha256:${hashVal}${((seed * 0xcafebabe) >>> 0).toString(16).padStart(8, "0")}`,
    };
  });
}

export const mockAuditEvents = generateAuditEvents(5000);
