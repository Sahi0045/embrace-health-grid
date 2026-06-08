export type Gender = "M" | "F" | "Other";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type PatientStatus = "active" | "discharged" | "admitted" | "outpatient";
export type StaffStatus = "active" | "on-leave" | "inactive";
export type DoctorSpecialty = 
  | "Cardiology" 
  | "Neurology" 
  | "Orthopedics" 
  | "Pediatrics" 
  | "Oncology"
  | "General Medicine"
  | "Surgery"
  | "Emergency Medicine"
  | "Radiology"
  | "Anesthesiology";

// Patient Data Structures
export interface PatientDetails {
  id: string;
  did: string;
  mrn: string;
  name: string;
  age: number;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: BloodGroup;
  phone: string;
  email: string;
  address: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  allergies: string[];
  chronicConditions: string[];
  status: PatientStatus;
  registrationDate: string;
  lastVisit?: string;
  currentAdmission?: {
    admissionId: string;
    ward: string;
    room: string;
    bed: string;
    admittedOn: string;
  };
  insuranceInfo?: {
    provider: string;
    policyNumber: string;
    validUntil: string;
  };
  totalVisits: number;
  outstandingBills: number;
}

// Doctor Data Structures
export interface DoctorDetails {
  id: string;
  did: string;
  employeeId: string;
  name: string;
  specialty: DoctorSpecialty;
  subSpecialties: string[];
  qualification: string[];
  experience: number; // years
  department: string;
  designation: string;
  age: number;
  gender: Gender;
  phone: string;
  email: string;
  consultationFee: number;
  availableDays: string[];
  consultationTiming: string;
  languages: string[];
  rating: number; // out of 5
  totalPatientsTreated: number;
  activeCases: number;
  todayAppointments: number;
  status: StaffStatus;
  joinDate: string;
  licenseNumber: string;
  chamberLocation: string;
}

// Nurse Data Structures
export interface NurseDetails {
  id: string;
  employeeId: string;
  name: string;
  age: number;
  gender: Gender;
  phone: string;
  email: string;
  qualification: string;
  experience: number; // years
  department: string;
  ward: string;
  shift: "morning" | "evening" | "night";
  nursingStation: string;
  specialization: string[];
  status: StaffStatus;
  joinDate: string;
  assignedPatients: number;
  licenseNumber: string;
}

// Support Staff Data Structures
export interface SupportStaff {
  id: string;
  employeeId: string;
  name: string;
  age: number;
  gender: Gender;
  phone: string;
  email: string;
  role: string;
  department: string;
  shift: "morning" | "evening" | "night" | "general";
  status: StaffStatus;
  joinDate: string;
  supervisor: string;
}

export const patients: PatientDetails[] = [];
export const doctors: DoctorDetails[] = [];
export const nurses: NurseDetails[] = [];
export const supportStaff: SupportStaff[] = [];

// Summary Statistics
export const peopleStats = {
  totalPatients: 0,
  admittedPatients: 0,
  outpatients: 0,
  newRegistrationsToday: 0,
  totalDoctors: 0,
  doctorsOnDuty: 0,
  totalNurses: 0,
  nursesOnDuty: 0,
  totalSupportStaff: 0,
  supportStaffOnDuty: 0,
  todayAppointments: 0,
  todayEmergencies: 0,
  staffVacancies: 0,
};
