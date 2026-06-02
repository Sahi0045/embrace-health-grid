export type DepartmentType = 
  | "emergency"
  | "cardiology"
  | "neurology"
  | "orthopedics"
  | "pediatrics"
  | "obstetrics"
  | "oncology"
  | "radiology"
  | "laboratory"
  | "pharmacy"
  | "icu"
  | "surgery"
  | "general";

export type FacilityStatus = "operational" | "maintenance" | "offline" | "scheduled";
export type EquipmentStatus = "available" | "in-use" | "maintenance" | "out-of-service";

export interface Department {
  id: string;
  name: string;
  type: DepartmentType;
  floor: number;
  building: string;
  headOfDepartment: string;
  contactExtension: string;
  totalBeds: number;
  occupiedBeds: number;
  totalStaff: number;
  onDutyStaff: number;
  specialties: string[];
  operatingHours: string;
  emergencyCapable: boolean;
}

export interface Ward {
  id: string;
  name: string;
  department: string;
  floor: number;
  building: string;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  wardType: "general" | "private" | "semi-private" | "icu" | "emergency";
  nursingStation: string;
}

export interface Room {
  id: string;
  roomNumber: string;
  ward: string;
  floor: number;
  building: string;
  roomType: "private" | "semi-private" | "general" | "icu" | "emergency";
  totalBeds: number;
  occupiedBeds: number;
  dailyRate: number;
  amenities: string[];
  status: "available" | "occupied" | "cleaning" | "maintenance";
  currentPatients?: string[];
}

export interface MedicalEquipment {
  id: string;
  name: string;
  type: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  location: string;
  department: string;
  purchaseDate: string;
  warrantyExpiry?: string;
  lastMaintenance: string;
  nextMaintenance: string;
  status: EquipmentStatus;
  assignedTo?: string;
  utilizationRate: number; // percentage
}

export interface OperatingTheater {
  id: string;
  name: string;
  floor: number;
  building: string;
  type: "major" | "minor" | "emergency" | "specialized";
  specializations: string[];
  status: FacilityStatus;
  currentProcedure?: string;
  todaySchedule: {
    time: string;
    procedure: string;
    surgeon: string;
    patient: string;
  }[];
}

export interface DiagnosticFacility {
  id: string;
  name: string;
  type: "imaging" | "lab" | "cardiology" | "pathology";
  equipment: string[];
  floor: number;
  building: string;
  operatingHours: string;
  status: FacilityStatus;
  dailyCapacity: number;
  todayCount: number;
  averageWaitTime: number; // minutes
}

export interface Building {
  id: string;
  name: string;
  address: string;
  totalFloors: number;
  totalArea: number; // sq meters
  yearBuilt: number;
  departments: string[];
  totalBeds: number;
  occupiedBeds: number;
  parkingSpaces: number;
  emergencyAccess: boolean;
  helipadAvailable: boolean;
}

export interface AmbulanceFleet {
  id: string;
  vehicleNumber: string;
  type: "basic" | "advanced" | "critical-care" | "neonatal";
  status: "available" | "on-duty" | "maintenance" | "emergency";
  currentLocation?: string;
  assignedParamedics?: string[];
  lastMaintenance: string;
  nextMaintenance: string;
  equipmentOnboard: string[];
}

export interface Pharmacy {
  id: string;
  name: string;
  type: "inpatient" | "outpatient" | "emergency";
  location: string;
  operatingHours: string;
  totalMedicines: number;
  lowStockItems: number;
  expiringWithin30Days: number;
  prescriptionsToday: number;
}

export interface BloodBank {
  bloodType: string;
  unitsAvailable: number;
  unitsMinimum: number;
  expiringWithin7Days: number;
  status: "adequate" | "low" | "critical";
}

// Mock Data
export const departments: Department[] = [
  {
    id: "dept1",
    name: "Emergency Department",
    type: "emergency",
    floor: 1,
    building: "Main Building",
    headOfDepartment: "Dr. Anjali Reddy",
    contactExtension: "1100",
    totalBeds: 25,
    occupiedBeds: 18,
    totalStaff: 45,
    onDutyStaff: 12,
    specialties: ["Trauma", "Critical Care", "Emergency Medicine"],
    operatingHours: "24/7",
    emergencyCapable: true,
  },
  {
    id: "dept2",
    name: "Cardiology Department",
    type: "cardiology",
    floor: 4,
    building: "Main Building",
    headOfDepartment: "Dr. Ravi Menon",
    contactExtension: "1400",
    totalBeds: 40,
    occupiedBeds: 32,
    totalStaff: 35,
    onDutyStaff: 8,
    specialties: ["Interventional Cardiology", "Electrophysiology", "Heart Failure"],
    operatingHours: "24/7",
    emergencyCapable: true,
  },
  {
    id: "dept3",
    name: "Neurology Department",
    type: "neurology",
    floor: 5,
    building: "Main Building",
    headOfDepartment: "Dr. Vikram Patel",
    contactExtension: "1500",
    totalBeds: 30,
    occupiedBeds: 24,
    totalStaff: 28,
    onDutyStaff: 7,
    specialties: ["Stroke", "Epilepsy", "Movement Disorders"],
    operatingHours: "24/7",
    emergencyCapable: true,
  },
  {
    id: "dept4",
    name: "Orthopedics Department",
    type: "orthopedics",
    floor: 3,
    building: "Surgical Wing",
    headOfDepartment: "Dr. Suresh Kumar",
    contactExtension: "1300",
    totalBeds: 35,
    occupiedBeds: 28,
    totalStaff: 32,
    onDutyStaff: 8,
    specialties: ["Joint Replacement", "Spine Surgery", "Sports Medicine"],
    operatingHours: "24/7",
    emergencyCapable: true,
  },
  {
    id: "dept5",
    name: "Pediatrics Department",
    type: "pediatrics",
    floor: 2,
    building: "Children's Wing",
    headOfDepartment: "Dr. Meera Sharma",
    contactExtension: "1200",
    totalBeds: 50,
    occupiedBeds: 38,
    totalStaff: 42,
    onDutyStaff: 11,
    specialties: ["Neonatology", "Pediatric Surgery", "Child Development"],
    operatingHours: "24/7",
    emergencyCapable: true,
  },
  {
    id: "dept6",
    name: "Oncology Department",
    type: "oncology",
    floor: 6,
    building: "Cancer Care Center",
    headOfDepartment: "Dr. Priya Nair",
    contactExtension: "1600",
    totalBeds: 45,
    occupiedBeds: 41,
    totalStaff: 38,
    onDutyStaff: 9,
    specialties: ["Medical Oncology", "Radiation Oncology", "Surgical Oncology"],
    operatingHours: "24/7",
    emergencyCapable: false,
  },
];

export const wards: Ward[] = [
  {
    id: "ward1",
    name: "Cardiology Ward A",
    department: "Cardiology",
    floor: 4,
    building: "Main Building",
    totalRooms: 20,
    totalBeds: 40,
    occupiedBeds: 32,
    availableBeds: 8,
    wardType: "general",
    nursingStation: "NS-4A",
  },
  {
    id: "ward2",
    name: "ICU - Critical Care",
    department: "Emergency",
    floor: 2,
    building: "Main Building",
    totalRooms: 15,
    totalBeds: 20,
    occupiedBeds: 18,
    availableBeds: 2,
    wardType: "icu",
    nursingStation: "NS-ICU",
  },
  {
    id: "ward3",
    name: "Private Ward - Premium",
    department: "General",
    floor: 7,
    building: "Main Building",
    totalRooms: 25,
    totalBeds: 25,
    occupiedBeds: 22,
    availableBeds: 3,
    wardType: "private",
    nursingStation: "NS-7A",
  },
];

export const medicalEquipment: MedicalEquipment[] = [
  {
    id: "eq1",
    name: "MRI Scanner",
    type: "Imaging",
    model: "Siemens MAGNETOM Vida",
    manufacturer: "Siemens Healthineers",
    serialNumber: "MRI-2023-001",
    location: "Radiology - Ground Floor",
    department: "Radiology",
    purchaseDate: "2023-01-15",
    warrantyExpiry: "2028-01-15",
    lastMaintenance: "2026-04-15",
    nextMaintenance: "2026-07-15",
    status: "available",
    utilizationRate: 85,
  },
  {
    id: "eq2",
    name: "CT Scanner",
    type: "Imaging",
    model: "GE Revolution CT",
    manufacturer: "GE Healthcare",
    serialNumber: "CT-2023-002",
    location: "Radiology - Ground Floor",
    department: "Radiology",
    purchaseDate: "2023-03-20",
    warrantyExpiry: "2028-03-20",
    lastMaintenance: "2026-05-10",
    nextMaintenance: "2026-08-10",
    status: "in-use",
    utilizationRate: 92,
  },
  {
    id: "eq3",
    name: "Ventilator",
    type: "Life Support",
    model: "Dräger Evita V800",
    manufacturer: "Drägerwerk",
    serialNumber: "VENT-2024-015",
    location: "ICU - 2nd Floor",
    department: "Critical Care",
    purchaseDate: "2024-01-10",
    warrantyExpiry: "2029-01-10",
    lastMaintenance: "2026-05-20",
    nextMaintenance: "2026-06-20",
    status: "in-use",
    assignedTo: "Bed ICU-12",
    utilizationRate: 78,
  },
  {
    id: "eq4",
    name: "Cardiac Catheterization Lab",
    type: "Cardiology",
    model: "Philips Azurion",
    manufacturer: "Philips Healthcare",
    serialNumber: "CATH-2022-001",
    location: "Cath Lab 2 - 4th Floor",
    department: "Cardiology",
    purchaseDate: "2022-06-15",
    warrantyExpiry: "2027-06-15",
    lastMaintenance: "2026-05-05",
    nextMaintenance: "2026-08-05",
    status: "available",
    utilizationRate: 68,
  },
];

export const operatingTheaters: OperatingTheater[] = [
  {
    id: "ot1",
    name: "OT-1 (Major Surgery)",
    floor: 3,
    building: "Surgical Wing",
    type: "major",
    specializations: ["Cardiac Surgery", "Neurosurgery"],
    status: "operational",
    currentProcedure: "CABG Surgery",
    todaySchedule: [
      { time: "08:00", procedure: "CABG Surgery", surgeon: "Dr. Ravi Menon", patient: "Rohan Iyer" },
      { time: "14:00", procedure: "Valve Replacement", surgeon: "Dr. Ravi Menon", patient: "Meera Pillai" },
    ],
  },
  {
    id: "ot2",
    name: "OT-2 (Orthopedic)",
    floor: 3,
    building: "Surgical Wing",
    type: "major",
    specializations: ["Orthopedics", "Joint Replacement"],
    status: "operational",
    todaySchedule: [
      { time: "09:00", procedure: "Hip Replacement", surgeon: "Dr. Suresh Kumar", patient: "Karthik Rao" },
      { time: "15:00", procedure: "Knee Arthroscopy", surgeon: "Dr. Suresh Kumar", patient: "Anjali Verma" },
    ],
  },
  {
    id: "ot3",
    name: "OT-3 (Emergency)",
    floor: 1,
    building: "Main Building",
    type: "emergency",
    specializations: ["Trauma", "Emergency Surgery"],
    status: "operational",
    todaySchedule: [],
  },
];

export const diagnosticFacilities: DiagnosticFacility[] = [
  {
    id: "diag1",
    name: "Radiology Department",
    type: "imaging",
    equipment: ["MRI Scanner", "CT Scanner (2)", "X-Ray (4)", "Ultrasound (3)"],
    floor: 0,
    building: "Main Building",
    operatingHours: "24/7",
    status: "operational",
    dailyCapacity: 150,
    todayCount: 87,
    averageWaitTime: 25,
  },
  {
    id: "diag2",
    name: "Central Laboratory",
    type: "lab",
    equipment: ["Biochemistry Analyzer", "Hematology Analyzer", "Microbiology Lab"],
    floor: 0,
    building: "Main Building",
    operatingHours: "24/7",
    status: "operational",
    dailyCapacity: 500,
    todayCount: 342,
    averageWaitTime: 45,
  },
  {
    id: "diag3",
    name: "Cardiac Diagnostic Center",
    type: "cardiology",
    equipment: ["Echo Machine (3)", "TMT", "Holter Monitor", "ECG (8)"],
    floor: 4,
    building: "Main Building",
    operatingHours: "06:00 - 22:00",
    status: "operational",
    dailyCapacity: 100,
    todayCount: 68,
    averageWaitTime: 15,
  },
];

export const buildings: Building[] = [
  {
    id: "bld1",
    name: "Main Building",
    address: "Apollo Hospitals Campus, Jubilee Hills, Hyderabad",
    totalFloors: 10,
    totalArea: 45000,
    yearBuilt: 2015,
    departments: ["Emergency", "Cardiology", "Neurology", "ICU", "Radiology"],
    totalBeds: 350,
    occupiedBeds: 287,
    parkingSpaces: 500,
    emergencyAccess: true,
    helipadAvailable: true,
  },
  {
    id: "bld2",
    name: "Surgical Wing",
    address: "Apollo Hospitals Campus, Jubilee Hills, Hyderabad",
    totalFloors: 5,
    totalArea: 25000,
    yearBuilt: 2018,
    departments: ["Orthopedics", "General Surgery", "Operating Theaters"],
    totalBeds: 120,
    occupiedBeds: 98,
    parkingSpaces: 200,
    emergencyAccess: true,
    helipadAvailable: false,
  },
  {
    id: "bld3",
    name: "Cancer Care Center",
    address: "Apollo Hospitals Campus, Jubilee Hills, Hyderabad",
    totalFloors: 8,
    totalArea: 30000,
    yearBuilt: 2020,
    departments: ["Oncology", "Radiation Therapy", "Chemotherapy"],
    totalBeds: 180,
    occupiedBeds: 162,
    parkingSpaces: 300,
    emergencyAccess: false,
    helipadAvailable: false,
  },
];

export const ambulanceFleet: AmbulanceFleet[] = [
  {
    id: "amb1",
    vehicleNumber: "TS-09-HA-1234",
    type: "advanced",
    status: "available",
    currentLocation: "Hospital Parking Bay 1",
    lastMaintenance: "2026-05-15",
    nextMaintenance: "2026-06-15",
    equipmentOnboard: ["Defibrillator", "Oxygen", "Ventilator", "Emergency Drugs"],
  },
  {
    id: "amb2",
    vehicleNumber: "TS-09-HA-1235",
    type: "critical-care",
    status: "on-duty",
    currentLocation: "En route to Banjara Hills",
    assignedParamedics: ["Rajesh Kumar", "Priya Singh"],
    lastMaintenance: "2026-05-10",
    nextMaintenance: "2026-06-10",
    equipmentOnboard: ["Portable Ventilator", "Cardiac Monitor", "Advanced Airway Kit"],
  },
  {
    id: "amb3",
    vehicleNumber: "TS-09-HA-1236",
    type: "basic",
    status: "available",
    currentLocation: "Hospital Parking Bay 2",
    lastMaintenance: "2026-05-20",
    nextMaintenance: "2026-06-20",
    equipmentOnboard: ["First Aid Kit", "Oxygen", "Stretcher"],
  },
];

export const pharmacies: Pharmacy[] = [
  {
    id: "pharm1",
    name: "Main Pharmacy",
    type: "inpatient",
    location: "Ground Floor - Main Building",
    operatingHours: "24/7",
    totalMedicines: 2500,
    lowStockItems: 45,
    expiringWithin30Days: 23,
    prescriptionsToday: 487,
  },
  {
    id: "pharm2",
    name: "Emergency Pharmacy",
    type: "emergency",
    location: "Emergency Department",
    operatingHours: "24/7",
    totalMedicines: 800,
    lowStockItems: 12,
    expiringWithin30Days: 8,
    prescriptionsToday: 156,
  },
];

export const bloodBank: BloodBank[] = [
  { bloodType: "A+", unitsAvailable: 45, unitsMinimum: 30, expiringWithin7Days: 3, status: "adequate" },
  { bloodType: "A-", unitsAvailable: 18, unitsMinimum: 15, expiringWithin7Days: 1, status: "adequate" },
  { bloodType: "B+", unitsAvailable: 38, unitsMinimum: 30, expiringWithin7Days: 2, status: "adequate" },
  { bloodType: "B-", unitsAvailable: 12, unitsMinimum: 15, expiringWithin7Days: 0, status: "low" },
  { bloodType: "AB+", unitsAvailable: 22, unitsMinimum: 20, expiringWithin7Days: 1, status: "adequate" },
  { bloodType: "AB-", unitsAvailable: 6, unitsMinimum: 10, expiringWithin7Days: 0, status: "critical" },
  { bloodType: "O+", unitsAvailable: 52, unitsMinimum: 40, expiringWithin7Days: 4, status: "adequate" },
  { bloodType: "O-", unitsAvailable: 25, unitsMinimum: 25, expiringWithin7Days: 2, status: "adequate" },
];

export const infrastructureStats = {
  totalBuildings: 5,
  totalFloors: 35,
  totalArea: 125000, // sq meters
  totalBeds: 850,
  occupiedBeds: 687,
  occupancyRate: 81,
  totalDepartments: 24,
  totalOperatingTheaters: 12,
  operationalOTs: 11,
  totalAmbulances: 15,
  availableAmbulances: 8,
  totalStaff: 2840,
  onDutyStaff: 842,
  totalEquipment: 1250,
  equipmentInUse: 687,
  parkingSpaces: 1200,
  occupiedParking: 856,
};
