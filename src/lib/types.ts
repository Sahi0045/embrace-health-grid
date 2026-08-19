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

export type AlertCategory =
  | "emergency"
  | "critical_patient"
  | "bed_shortage"
  | "low_stock"
  | "near_expiry"
  | "equipment_failure"
  | "staff_shortage"
  | "security"
  | "maintenance"
  | "ambulance";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus = "active" | "acknowledged" | "resolved" | "dismissed";

export type EmergencyBroadcastCode =
  | "code_blue"
  | "code_red"
  | "trauma_alpha"
  | "mass_casualty"
  | "cyber_incident"
  | "lockdown"
  | "disaster";

export type EmergencyBroadcastRecord = {
  broadcast_id: string;
  hospital_id?: string;
  broadcast_code: EmergencyBroadcastCode;
  title: string;
  severity: AlertSeverity;
  message: string;
  location: string;
  initiator_did: string;
  initiator_name: string;
  status: "active" | "acknowledged" | "resolved" | "cancelled";
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
};

export type CentralAlert = {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  source_table:
    | "emergency_broadcasts"
    | "inventory_alerts"
    | "fraud_alerts"
    | "equipment_maintenance_log"
    | "equipment"
    | "beds"
    | "vitals"
    | "ambulances"
    | "admissions";
  source_id: string;
  target_url?: string;
  highlight_id?: string;
  actor?: string;
  department?: string;
  location?: string;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  metadata?: Record<string, any>;
};

export type CentralAlertStats = {
  total: number;
  active: number;
  critical: number;
  warning: number;
  info: number;
  acknowledged: number;
  resolvedToday: number;
};

export type LabOrderPriority = "stat" | "urgent" | "routine";
export type LabOrderStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type SampleCollectionStatus =
  | "collected"
  | "lab_received"
  | "processing"
  | "resulted"
  | "reported";

export type LabOrderRecord = {
  order_id: string;
  patient_did: string;
  patient_name?: string;
  patient_mrn?: string;
  ordered_by: string;
  doctor_name?: string;
  hospital_id?: string;
  test_name: string;
  test_category?:
    | "hematology"
    | "biochemistry"
    | "microbiology"
    | "immunology"
    | "pathology"
    | "genetics"
    | string;
  priority: LabOrderPriority;
  clinical_notes?: string;
  specimen_type?: string;
  status: LabOrderStatus;
  lab_id?: string;
  ordered_at: string;
  completed_at?: string;
  created_at: string;
};

export type LabSampleRecord = {
  sample_id: string;
  order_id?: string;
  lab_id?: string;
  patient_did: string;
  patient_name?: string;
  patient_mrn?: string;
  hospital_id?: string;
  sample_type: "blood" | "urine" | "tissue" | "swab" | "csf" | "sputum" | string;
  barcode?: string;
  collection_status: SampleCollectionStatus;
  collected_by?: string;
  collected_at?: string;
  received_at?: string;
  processed_at?: string;
  reported_at?: string;
  temperature_c?: number;
  container_type?: string;
  notes?: string;
  created_at: string;
};

export type LabResultRecord = {
  lab_id: string;
  order_id?: string;
  patient_did: string;
  patient_name?: string;
  patient_mrn?: string;
  ordered_by?: string;
  doctor_name?: string;
  test_name: string;
  category?: string;
  result_value?: string;
  unit?: string;
  reference_range?: string;
  status: "pending" | "in-progress" | "completed" | "critical" | "abnormal" | "normal" | string;
  is_critical?: boolean;
  critical_flag?: "high" | "low" | "critical_high" | "critical_low" | "panic" | null;
  content_hash?: string;
  verified_by?: string;
  resulted_at?: string;
  created_at: string;
};

export type RadiologyModality =
  | "mri"
  | "ct"
  | "xray"
  | "ultrasound"
  | "fluoroscopy"
  | "pet"
  | string;
export type RadiologyOrderStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "reported"
  | "cancelled";

export type RadiologyOrderRecord = {
  order_id: string;
  patient_did: string;
  patient_name?: string;
  patient_mrn?: string;
  ordered_by: string;
  doctor_name?: string;
  hospital_id?: string;
  modality: RadiologyModality;
  body_part: string;
  clinical_indication: string;
  priority: LabOrderPriority;
  status: RadiologyOrderStatus;
  scheduled_at: string;
  completed_at?: string;
  equipment_id?: string;
  equipment_name?: string;
  equipment_room?: string;
  report_text?: string;
  reported_by?: string;
  reported_at?: string;
  pacs_image_url?: string;
  created_at: string;
};

export type LabDashboardStats = {
  pendingTests: number;
  inProgress: number;
  completedToday: number;
  criticalResults: number;
  avgTurnaroundTime: string;
  totalSamplesCollected: number;
  radiologyScansToday: number;
};

// ─── Cafeteria & Food Service Domain Types ─────────────────────────────────

export type MealCategory = "breakfast" | "lunch" | "dinner" | "snack" | "beverage";
export type DietaryTag =
  | "vegan"
  | "halal"
  | "gluten_free"
  | "kosher"
  | "diabetic"
  | "low_sodium"
  | "vegetarian"
  | string;
export type MealAvailability = "patient" | "staff" | "both";
export type DeliveryStatus = "preparing" | "dispatched" | "delivered" | "cancelled";
export type ContractStatus = "active" | "expired" | "pending" | "terminated";
export type MealPlanStatus = "active" | "pending" | "review" | "suspended";
export type KitchenStockStatus = "normal" | "low_stock" | "expired";
export type FoodWastageReason =
  | "overproduction"
  | "spoilage"
  | "unconsumed_tray"
  | "expired_stock"
  | "damaged";

export type CafeteriaMenuItem = {
  menu_item_id: string;
  hospital_id?: string;
  name: string;
  category: MealCategory;
  dietary_tags: string[];
  available_for: MealAvailability;
  price: number;
  calories: number;
  status: "active" | "inactive" | "sold_out";
  description?: string;
  allergens?: string[];
  created_at: string;
  updated_at?: string;
};

export type KitchenStockItem = {
  stock_id: string;
  hospital_id?: string;
  item_name: string;
  category: "produce" | "dairy" | "meat" | "dry_goods" | "beverages" | "bakery" | "frozen" | string;
  quantity: number;
  unit: string;
  reorder_level: number;
  unit_cost: number;
  expiry_date?: string;
  supplier?: string;
  storage_location?: string;
  status: KitchenStockStatus;
  last_restocked_at?: string;
  created_at: string;
  updated_at?: string;
};

export type DietaryRequirement = {
  requirement_id: string;
  hospital_id?: string;
  patient_did: string;
  patient_name: string;
  patient_mrn?: string;
  room_number?: string;
  requirements: string[];
  allergies: string[];
  meal_plan_status: MealPlanStatus;
  prescribed_by?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
};

export type MealDeliveryRecord = {
  delivery_id: string;
  hospital_id?: string;
  patient_did: string;
  patient_name: string;
  room_number: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  menu_item_name: string;
  delivery_status: DeliveryStatus;
  scheduled_at: string;
  delivered_at?: string;
  dietary_notes?: string;
  assigned_runner?: string;
  created_at: string;
  updated_at?: string;
};

export type CafeteriaVendor = {
  vendor_id: string;
  hospital_id?: string;
  name: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  contract_status: ContractStatus;
  supplied_categories: string[];
  last_delivery_at?: string;
  contract_expiry?: string;
  rating?: number;
  address?: string;
  created_at: string;
  updated_at?: string;
};

export type FoodWastageLog = {
  log_id: string;
  hospital_id?: string;
  date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack" | "prep_waste" | string;
  item_name: string;
  quantity_wasted: number;
  unit: string;
  cost_impact: number;
  reason: FoodWastageReason;
  logged_by: string;
  created_at: string;
};

export type CafeteriaDashboardStats = {
  activeMenuItems: number;
  pendingDeliveries: number;
  deliveredToday: number;
  activeDietaryPlans: number;
  lowKitchenStockCount: number;
  todayWastageKg: number;
  activeVendorsCount: number;
  averageMealRating: number;
};
