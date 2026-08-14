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

export type PatientFull = {
  id: string;
  did: string;
  name: string;
  mrn: string;
  age: number;
  gender: "M" | "F";
  bloodGroup: string;
  allergies: string[];
  phone: string;
  email: string;
  address: string;
  dob: string;
  ward: string;
  bed: string;
  admitDate: string;
  status: "inpatient" | "outpatient" | "discharged";
  primaryDoctor: string;
  conditions: string[];
  insuranceProvider: string;
  insurancePolicyNo: string;
  emergencyContact: { name: string; relation: string; phone: string };
  organDonor: boolean;
  nationality: string;
  totalVisits?: number;
  outstandingBills?: number;
};

export type StaffRole =
  | "Doctor"
  | "Nurse"
  | "Technician"
  | "Pharmacist"
  | "Admin"
  | "Radiologist"
  | "Anesthesiologist"
  | "Surgeon";

export type StaffMember = {
  id: string;
  did: string;
  name: string;
  employeeId: string;
  role: StaffRole;
  department: string;
  specialty?: string;
  email: string;
  phone: string;
  shift: "morning" | "evening" | "night" | "on-call";
  onDuty: boolean;
  joinedDate: string;
  status:
    | "active"
    | "on-leave"
    | "inactive"
    | "In Surgery"
    | "Emergency Response"
    | "In Consultation";
  credentials: number;
  patientsToday: number;
};

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
};

export type AuditEventCategory =
  | "access"
  | "consent"
  | "credential"
  | "infrastructure"
  | "auth"
  | "prescription"
  | "emergency";

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
  type:
    | "mri"
    | "ct"
    | "xray"
    | "ventilator"
    | "ecg"
    | "ultrasound"
    | "dialysis"
    | "defibrillator"
    | "infusion"
    | "wheelchair"
    | "oxygen-cylinder"
    | string;
  category?: string;
  manufacturer: string;
  model: string;
  serial: string;
  department: string;
  floor: number;
  status: EquipmentStatus;
  lastMaintenance: string;
  nextMaintenance: string;
  warrantyExpiry?: string;
  purchaseDate?: string;
  utilization: number;
  calibrationDate?: string;
  nextCalibration?: string;
  assignedWard?: string;
  location?: string;
  did: string;
  updatedAt?: string;
};

export type MaintenanceLogEntry = {
  logId: string;
  equipmentId: string;
  maintenanceType: "preventive" | "corrective" | "calibration" | "routine_check" | string;
  description: string;
  performedBy: string;
  performedAt: string;
  nextDue?: string;
  cost: number;
  status: "completed" | "scheduled" | "overdue" | "in_progress" | string;
  notes?: string;
  createdAt?: string;
};

export type AmbulanceRecord = {
  id: string;
  vehicleNo: string;
  registration?: string;
  type: "als" | "bls" | "neonatal" | "air" | string;
  driver: string;
  paramedic?: string;
  status: AmbulanceStatus;
  location: string;
  destination?: string;
  patientName?: string;
  etaMinutes?: number;
  fuelLevel?: number;
  batteryLevel?: number;
  lastDeployment?: string;
  did?: string;
  updatedAt?: string;
};

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

export type InventoryStatus = "normal" | "low_stock" | "critical" | "expired";

export type InventoryCategory = {
  category_id: string;
  name: string;
  description?: string;
  color_code: string;
  created_at?: string;
};

export type InventoryItem = {
  item_id: string;
  hospital_id?: string;
  name: string;
  sku: string;
  category_id: string;
  current_stock: number;
  reserved_stock: number;
  unit: string;
  reorder_level: number;
  reorder_qty: number;
  unit_cost: number;
  expiry_date?: string;
  storage_location?: string;
  supplier?: string;
  status: InventoryStatus;
  last_movement_at?: string;
  created_at?: string;
  updated_at?: string;
  category?: InventoryCategory;
};

export type StockMovementType = "IN" | "OUT" | "ADJUSTMENT" | "RESERVATION" | "RELEASE";

export type StockMovement = {
  movement_id: string;
  item_id: string;
  hospital_id?: string;
  movement_type: StockMovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason?: string;
  performed_by?: string;
  performed_by_name?: string;
  recorded_at: string;
};

export type InventoryAlert = {
  alert_id: string;
  item_id: string;
  hospital_id?: string;
  alert_type: "low_stock" | "critical" | "near_expiry" | "expired";
  severity: "warning" | "critical";
  message: string;
  current_level?: number;
  threshold?: number;
  acknowledged: boolean;
  created_at: string;
  item?: InventoryItem;
};

