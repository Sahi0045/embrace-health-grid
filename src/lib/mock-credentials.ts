export type CredentialType =
  | "PatientIdentity"
  | "VaccinationRecord"
  | "LabReport"
  | "Prescription"
  | "InsurancePolicy"
  | "SurgeryRecord"
  | "DischargeNote"
  | "ConsentRecord"
  | "BloodGroupVerification"
  | "OrganDonorCard"
  | "TeleconsultRecord"
  | "EmergencyProfile";

export type CredentialFull = {
  id: string;
  type: CredentialType;
  typeLabel: string;
  issuer: string;
  issuerDID: string;
  holder: string;
  holderDID: string;
  issuedAt: string;
  expiresAt: string;
  status: "active" | "expired" | "revoked" | "suspended";
  schema: string;
  verificationCount: number;
  lastVerified?: string;
  metadata: Record<string, string>;
};

const credTypeLabels: Record<CredentialType, string> = {
  PatientIdentity: "Patient Identity",
  VaccinationRecord: "Vaccination Record",
  LabReport: "Lab Report",
  Prescription: "Prescription",
  InsurancePolicy: "Insurance Policy",
  SurgeryRecord: "Surgery Record",
  DischargeNote: "Discharge Summary",
  ConsentRecord: "Consent Credential",
  BloodGroupVerification: "Blood Group Verification",
  OrganDonorCard: "Organ Donor Card",
  TeleconsultRecord: "Teleconsult Record",
  EmergencyProfile: "Emergency Profile",
};

const issuers = [
  "Apollo Hospitals",
  "Govt. of India — NHA",
  "Star Health Insurance",
  "Apollo Diagnostics",
  "ICMR",
  "Max Healthcare",
  "Fortis Hospitals",
  "Manipal Hospitals",
  "Narayana Health",
  "Aster Hospitals",
];

const credTypes: CredentialType[] = Object.keys(credTypeLabels) as CredentialType[];

function hashInt(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return Math.abs(h); }
function pad(n: number) { return String(n).padStart(2, "0"); }

export function generateCredentials(count = 1000): CredentialFull[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `cred_${String(i + 1).padStart(5, "0")}`;
    const seed = hashInt(id);
    const type = credTypes[seed % credTypes.length];
    const issuer = issuers[(seed >> 2) % issuers.length];
    const year = 2023 + (seed % 3);
    const month = pad(1 + (seed % 12));
    const day = pad(1 + (seed % 28));
    const expYear = year + 1 + (seed % 5);
    const expMonth = pad(1 + ((seed >> 3) % 12));
    const expDay = pad(1 + ((seed >> 4) % 28));
    const statusPool: CredentialFull["status"][] = ["active", "active", "active", "expired", "revoked"];
    const status = statusPool[seed % statusPool.length];
    const patIdx = (seed % 500) + 1;
    const holderName = `Patient ${String(patIdx).padStart(4, "0")}`;
    const lastVerYear = 2025 + (seed % 2);
    const lastVerMonth = pad(1 + ((seed >> 1) % 12));
    const lastVerDay = pad(1 + ((seed >> 2) % 28));

    return {
      id,
      type,
      typeLabel: credTypeLabels[type],
      issuer,
      issuerDID: `did:hosp:issuer:${seed.toString(16).padStart(8, "0")}`,
      holder: holderName,
      holderDID: `did:hosp:0x${(seed * 3).toString(16).padStart(4, "0")}…${(seed * 7).toString(16).padStart(4, "0")}`,
      issuedAt: `${year}-${month}-${day}`,
      expiresAt: `${expYear}-${expMonth}-${expDay}`,
      status,
      schema: `https://schema.did-hospital.in/v1/${type.toLowerCase()}`,
      verificationCount: seed % 50,
      lastVerified: status !== "revoked" ? `${lastVerYear}-${lastVerMonth}-${lastVerDay}` : undefined,
      metadata: {
        issuanceCountry: "India",
        credentialVersion: "1.2",
        encryptionAlgo: "Ed25519",
      },
    };
  });
}

export const mockCredentials = generateCredentials(1000);

// Sample vaccine credentials for patient portal
export const vaccineCredentials = [
  {
    id: "vax_001",
    vaccine: "COVID-19 (Covishield)",
    doses: 3,
    lastDose: "2023-10-15",
    nextDue: "N/A",
    manufacturer: "Serum Institute of India",
    batchNo: "CVSLD-2310A",
    issuer: "Govt. of India — CoWIN",
    status: "complete" as const,
    credential: "VCI-2310-COVA-001",
  },
  {
    id: "vax_002",
    vaccine: "Hepatitis B",
    doses: 3,
    lastDose: "2022-08-22",
    nextDue: "2032-08-22",
    manufacturer: "Biological E",
    batchNo: "HEPB-2208C",
    issuer: "Apollo Hospitals",
    status: "complete" as const,
    credential: "VCI-2208-HEPB-002",
  },
  {
    id: "vax_003",
    vaccine: "Tetanus (Td)",
    doses: 1,
    lastDose: "2024-03-10",
    nextDue: "2034-03-10",
    manufacturer: "Serum Institute of India",
    batchNo: "TD-2403B",
    issuer: "Govt. of India — NHM",
    status: "complete" as const,
    credential: "VCI-2403-TD-003",
  },
  {
    id: "vax_004",
    vaccine: "Influenza (Seasonal)",
    doses: 1,
    lastDose: "2025-11-05",
    nextDue: "2026-11-05",
    manufacturer: "Sanofi Pasteur",
    batchNo: "FLU-2511D",
    issuer: "Apollo Hospitals",
    status: "due-soon" as const,
    credential: "VCI-2511-FLU-004",
  },
  {
    id: "vax_005",
    vaccine: "Polio (OPV)",
    doses: 5,
    lastDose: "2000-06-01",
    nextDue: "N/A",
    manufacturer: "Biological E",
    batchNo: "OPV-0006A",
    issuer: "Govt. of India — UIP",
    status: "complete" as const,
    credential: "VCI-0006-OPV-005",
  },
];
