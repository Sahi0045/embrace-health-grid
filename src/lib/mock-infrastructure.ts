// Extended infrastructure mock data for advanced resource tracking and digital twin

export type BedStatus = "available" | "occupied" | "maintenance" | "reserved";
export type EquipmentStatus = "operational" | "in-use" | "maintenance" | "offline";
export type AmbulanceStatus = "available" | "en-route" | "at-scene" | "returning" | "maintenance";

export type BedRecord = {
  id: string;
  bedNo: string;
  ward: string;
  wardCode: string;
  floor: number;
  building: string;
  type: "general" | "icu" | "hdu" | "isolation" | "pediatric" | "maternity" | "post-op";
  status: BedStatus;
  patientMRN?: string;
  patientName?: string;
  admitDate?: string;
  doctor?: string;
  did: string;
};

export type EquipmentRecord = {
  id: string;
  name: string;
  type: "mri" | "ct" | "xray" | "ventilator" | "ecg" | "ultrasound" | "dialysis" | "defibrillator" | "infusion" | "wheelchair" | "oxygen-cylinder";
  manufacturer: string;
  model: string;
  serial: string;
  department: string;
  floor: number;
  status: EquipmentStatus;
  lastMaintenance: string;
  nextMaintenance: string;
  did: string;
};

export type AmbulanceRecord = {
  id: string;
  vehicleNo: string;
  type: "als" | "bls" | "neonatal" | "air";
  driver: string;
  paramedic: string;
  status: AmbulanceStatus;
  location: string;
  lastDeployment: string;
  did: string;
};

// 250 Beds
const wards = [
  { name: "Cardiology Ward 4A", code: "CARD-4A", floor: 4, building: "Main Block", type: "general" as const },
  { name: "ICU Block B", code: "ICU-B", floor: 3, building: "Critical Care Block", type: "icu" as const },
  { name: "General Ward 2C", code: "GEN-2C", floor: 2, building: "Main Block", type: "general" as const },
  { name: "Orthopedics 3D", code: "ORTH-3D", floor: 3, building: "Main Block", type: "general" as const },
  { name: "Neurology 5A", code: "NEURO-5A", floor: 5, building: "Tower B", type: "hdu" as const },
  { name: "Pediatrics 1B", code: "PED-1B", floor: 1, building: "Children's Wing", type: "pediatric" as const },
  { name: "Oncology 6C", code: "ONCO-6C", floor: 6, building: "Tower B", type: "isolation" as const },
  { name: "Emergency Ward", code: "EMRG", floor: 0, building: "Emergency Block", type: "general" as const },
  { name: "Post-Op Recovery", code: "POST-OP", floor: 2, building: "Surgical Block", type: "post-op" as const },
  { name: "Maternity Ward", code: "MAT-3A", floor: 3, building: "Women's Block", type: "maternity" as const },
];

const statuses: BedStatus[] = ["available", "occupied", "occupied", "occupied", "maintenance", "reserved"];
const doctors = ["Dr. Ravi Menon","Dr. Aanya Verma","Dr. Sameer Khan","Dr. Priya Nair","Dr. Deepak Joshi"];
const patientNames = ["Anika Sharma","Rohan Iyer","Meera Pillai","Karthik Rao","Priya Verma","Arjun Mehta","Divya Singh","Suresh Patel","Lakshmi Kumar","Vikram Nair"];

function hashInt(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return Math.abs(h); }
function pad(n: number) { return String(n).padStart(2, "0"); }

export function generateBeds(count = 250): BedRecord[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `bed_${String(i + 1).padStart(4, "0")}`;
    const seed = hashInt(id);
    const ward = wards[seed % wards.length];
    const status = statuses[seed % statuses.length];
    const letters = ["A","B","C","D","E"];
    const bedNo = `${letters[seed % letters.length]}${1 + (seed % 25)}`;
    const isOccupied = status === "occupied";
    const admitYear = 2025 + (seed % 2);
    const admitMonth = pad(1 + (seed % 12));
    const admitDay = pad(1 + (seed % 28));

    return {
      id,
      bedNo,
      ward: ward.name,
      wardCode: ward.code,
      floor: ward.floor,
      building: ward.building,
      type: ward.type,
      status,
      patientMRN: isOccupied ? `MRN-${200000 + i * 7}` : undefined,
      patientName: isOccupied ? patientNames[seed % patientNames.length] : undefined,
      admitDate: isOccupied ? `${admitYear}-${admitMonth}-${admitDay}` : undefined,
      doctor: isOccupied ? doctors[seed % doctors.length] : undefined,
      did: `did:hosp:bed:${id}`,
    };
  });
}

// Equipment pool
const equipmentTemplates = [
  { name: "SIEMENS MAGNETOM 3T MRI", type: "mri" as const, mfr: "Siemens Healthineers", model: "MAGNETOM Vida" },
  { name: "GE Revolution CT Scanner", type: "ct" as const, mfr: "GE Healthcare", model: "Revolution Apex" },
  { name: "Philips Digital X-Ray", type: "xray" as const, mfr: "Philips", model: "DigitalDiagnost C90" },
  { name: "Draeger Savina Ventilator", type: "ventilator" as const, mfr: "Draeger", model: "Savina 300" },
  { name: "GE MAC 5500 ECG", type: "ecg" as const, mfr: "GE Healthcare", model: "MAC 5500 HD" },
  { name: "Philips EPIQ Ultrasound", type: "ultrasound" as const, mfr: "Philips", model: "EPIQ Elite" },
  { name: "Fresenius 5008 Dialysis", type: "dialysis" as const, mfr: "Fresenius Medical", model: "5008 CorDiax" },
  { name: "Philips HeartStart Defibrillator", type: "defibrillator" as const, mfr: "Philips", model: "HeartStart XL+" },
  { name: "B.Braun Infusion Pump", type: "infusion" as const, mfr: "B.Braun", model: "Infusomat Space" },
  { name: "Standard Wheelchair", type: "wheelchair" as const, mfr: "Karma Medical", model: "S-115" },
  { name: "Oxygen Cylinder 10L", type: "oxygen-cylinder" as const, mfr: "Inox Air Products", model: "Type-D" },
];

const depts = ["Radiology","ICU","Emergency","Cardiology","Orthopedics","Neurology","General Medicine","Surgery","Pediatrics","Oncology"];
const equipStatuses: EquipmentStatus[] = ["operational", "operational", "in-use", "maintenance", "offline"];

export function generateEquipment(count = 100): EquipmentRecord[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `equip_${String(i + 1).padStart(4, "0")}`;
    const seed = hashInt(id);
    const tmpl = equipmentTemplates[seed % equipmentTemplates.length];
    const status = equipStatuses[seed % equipStatuses.length];
    const lastYear = 2024 + (seed % 2);
    const lastMonth = pad(1 + (seed % 12));
    const lastDay = pad(1 + (seed % 28));
    const nextYear = lastYear + 1;
    const nextMonth = pad(1 + ((seed >> 2) % 12));

    return {
      id,
      name: `${tmpl.name} #${String(i + 1).padStart(3, "0")}`,
      type: tmpl.type,
      manufacturer: tmpl.mfr,
      model: tmpl.model,
      serial: `SN-${seed.toString(16).toUpperCase().padStart(8, "0")}`,
      department: depts[seed % depts.length],
      floor: seed % 7,
      status,
      lastMaintenance: `${lastYear}-${lastMonth}-${lastDay}`,
      nextMaintenance: `${nextYear}-${nextMonth}-${lastDay}`,
      did: `did:hosp:equipment:${id}`,
    };
  });
}

// 20 Ambulances
const ambulanceTypes: AmbulanceRecord["type"][] = ["als", "bls", "als", "bls", "neonatal"];
const ambulanceStatuses: AmbulanceStatus[] = ["available", "en-route", "at-scene", "returning", "maintenance"];
const locations = [
  "Apollo Hospital Bay 1","En route to Andheri East","At scene: Marine Lines","Returning from Bandra","Hospital Bay 3","Neonatal NICU dock","Central Mumbai","Worli Bridge",
  "Hospital Bay 2","Dharavi Colony","Emergency Bay","BKC","Parel","Kurla","Dadar",
  "Hospital Bay 4","Mahalaxmi","Lower Parel","Grant Road","Colaba",
];
const drivers = ["Ramesh K.","Sunil V.","Arun M.","Deepak R.","Mahesh P.","Santosh K.","Raju S.","Bharat N.","Vijay T.","Lakshman D.","Prakash A.","Sanjay G.","Mohan P.","Naresh B.","Arvind S.","Kishore M.","Dinesh K.","Umesh J.","Suresh R.","Ganesh V."];
const paramedics = ["Priya T.","Sunita K.","Anjali M.","Kavita S.","Rekha P.","Neha B.","Pooja R.","Anita D.","Meena G.","Shilpa N.","Suman V.","Usha K.","Lata M.","Seema T.","Asha J.","Gita R.","Mala S.","Radha K.","Puja M.","Sarla T."];

export function generateAmbulances(count = 20): AmbulanceRecord[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `amb_${String(i + 1).padStart(3, "0")}`;
    const seed = hashInt(id);
    const lastYear = 2025 + (seed % 2);
    const lastMonth = pad(1 + (seed % 12));
    const lastDay = pad(1 + (seed % 28));

    return {
      id,
      vehicleNo: `MH-01-AM-${String(1000 + i).padStart(4, "0")}`,
      type: ambulanceTypes[seed % ambulanceTypes.length],
      driver: drivers[i],
      paramedic: paramedics[i],
      status: ambulanceStatuses[seed % ambulanceStatuses.length],
      location: locations[i],
      lastDeployment: `${lastYear}-${lastMonth}-${lastDay} ${pad(seed % 24)}:${pad((seed >> 1) % 60)}`,
      did: `did:hosp:ambulance:${id}`,
    };
  });
}

// Insurance claims
export type InsuranceClaim = {
  id: string;
  claimNo: string;
  patientName: string;
  patientMRN: string;
  insuranceProvider: string;
  policyNo: string;
  claimType: "hospitalization" | "outpatient" | "surgery" | "pharmacy" | "lab";
  amount: number;
  approvedAmount?: number;
  status: "pending" | "approved" | "rejected" | "under-review" | "paid";
  submittedDate: string;
  processedDate?: string;
  remarks: string;
};

const claimTypes: InsuranceClaim["claimType"][] = ["hospitalization", "outpatient", "surgery", "pharmacy", "lab"];
const claimStatuses: InsuranceClaim["status"][] = ["pending", "approved", "rejected", "under-review", "paid"];
const insurerPool = ["Star Health","HDFC Ergo","Bajaj Allianz","New India Assurance","ICICI Lombard","Care Health","Niva Bupa","Aditya Birla Health"];
const claimRemarks = [
  "Documents verified, processing in 3-5 business days",
  "Awaiting pre-authorization from underwriter",
  "Claim approved, payment processed via NEFT",
  "Rejected: pre-existing condition exclusion",
  "Under review: supporting documents required",
  "Payment remitted to hospital account",
  "Approved with 80% coverage deduction",
  "Claim settled with cashless facility",
];

export function generateInsuranceClaims(count = 50): InsuranceClaim[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `claim_${String(i + 1).padStart(4, "0")}`;
    const seed = hashInt(id);
    const status = claimStatuses[seed % claimStatuses.length];
    const amount = (5000 + (seed % 195000));
    const year = 2025 + (seed % 2);
    const month = pad(1 + (seed % 12));
    const day = pad(1 + (seed % 28));
    const procYear = year + (seed % 2 === 0 ? 0 : 0);
    const procMonth = pad(1 + ((seed >> 1) % 12));
    const procDay = pad(1 + ((seed >> 2) % 28));
    const patNames = ["Anika Sharma","Rohan Iyer","Meera Pillai","Karthik Rao","Priya Verma","Arjun Mehta","Divya Singh","Suresh Patel"];

    return {
      id,
      claimNo: `CLM-${year}-${String(1000 + i).padStart(6, "0")}`,
      patientName: patNames[seed % patNames.length],
      patientMRN: `MRN-${200000 + i * 7}`,
      insuranceProvider: insurerPool[seed % insurerPool.length],
      policyNo: `POL-${year}-${seed.toString(16).padStart(8, "0")}`,
      claimType: claimTypes[seed % claimTypes.length],
      amount,
      approvedAmount: status === "approved" || status === "paid" ? Math.round(amount * 0.8) : undefined,
      status,
      submittedDate: `${year}-${month}-${day}`,
      processedDate: status !== "pending" && status !== "under-review" ? `${procYear}-${procMonth}-${procDay}` : undefined,
      remarks: claimRemarks[seed % claimRemarks.length],
    };
  });
}

export const mockBeds: BedRecord[] = [];
export const mockEquipment: EquipmentRecord[] = [];
export const mockAmbulances: AmbulanceRecord[] = [];
export const mockInsuranceClaims: InsuranceClaim[] = [];

// Summary stats
export const infraStats = {
  totalBeds: 0,
  occupiedBeds: 0,
  availableBeds: 0,
  maintenanceBeds: 0,
  totalEquipment: 0,
  operationalEquipment: 0,
  maintenanceEquipment: 0,
  offlineEquipment: 0,
  totalAmbulances: 0,
  availableAmbulances: 0,
  deployedAmbulances: 0,
  ventilators: 0,
  mriScanners: 0,
  ctScanners: 0,
  oxygenCylinders: 0,
};
