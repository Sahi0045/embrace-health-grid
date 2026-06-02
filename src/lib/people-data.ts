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

// Mock Patient Data
export const patients: PatientDetails[] = [
  {
    id: "pat_001",
    did: "did:hosp:0x4a91…b7d2",
    mrn: "MRN-204871",
    name: "Anika Sharma",
    age: 34,
    dateOfBirth: "1992-03-15",
    gender: "F",
    bloodGroup: "O+",
    phone: "+91 98765 43210",
    email: "anika.sharma@email.com",
    address: "Flat 402, Green Valley Apartments, Banjara Hills, Hyderabad - 500034",
    emergencyContact: {
      name: "Rajesh Sharma",
      relationship: "Husband",
      phone: "+91 98765 43211",
    },
    allergies: ["Penicillin", "Sulfa drugs"],
    chronicConditions: ["Hypertension", "Type 2 Diabetes"],
    status: "admitted",
    registrationDate: "2020-05-12",
    lastVisit: "2026-05-27",
    currentAdmission: {
      admissionId: "ADM-2026-001234",
      ward: "Cardiology Ward",
      room: "C-402",
      bed: "B2",
      admittedOn: "2026-05-27",
    },
    insuranceInfo: {
      provider: "Star Health Insurance",
      policyNumber: "SH-2024-789456",
      validUntil: "2027-04-30",
    },
    totalVisits: 23,
    outstandingBills: 7062,
  },
  {
    id: "pat_002",
    did: "did:hosp:0x91c2…ee04",
    mrn: "MRN-204902",
    name: "Rohan Iyer",
    age: 58,
    dateOfBirth: "1968-07-22",
    gender: "M",
    bloodGroup: "B+",
    phone: "+91 90123 45678",
    email: "rohan.iyer@email.com",
    address: "Plot 15, Lotus Villas, Gachibowli, Hyderabad - 500032",
    emergencyContact: {
      name: "Lakshmi Iyer",
      relationship: "Wife",
      phone: "+91 90123 45679",
    },
    allergies: ["Aspirin"],
    chronicConditions: ["Coronary Artery Disease"],
    status: "admitted",
    registrationDate: "2019-08-20",
    lastVisit: "2026-05-28",
    totalVisits: 45,
    outstandingBills: 0,
  },
  {
    id: "pat_003",
    did: "did:hosp:0x77a3…12fa",
    mrn: "MRN-205110",
    name: "Meera Pillai",
    age: 27,
    dateOfBirth: "1999-11-08",
    gender: "F",
    bloodGroup: "A-",
    phone: "+91 70456 78901",
    email: "meera.pillai@email.com",
    address: "House 8, Sunrise Colony, Kondapur, Hyderabad - 500084",
    emergencyContact: {
      name: "Suresh Pillai",
      relationship: "Father",
      phone: "+91 70456 78902",
    },
    allergies: [],
    chronicConditions: [],
    status: "outpatient",
    registrationDate: "2022-03-10",
    lastVisit: "2026-05-20",
    totalVisits: 12,
    outstandingBills: 2500,
  },
  {
    id: "pat_004",
    did: "did:hosp:0xbe49…3c20",
    mrn: "MRN-205288",
    name: "Karthik Rao",
    age: 41,
    dateOfBirth: "1985-01-30",
    gender: "M",
    bloodGroup: "AB+",
    phone: "+91 88901 23456",
    email: "karthik.rao@email.com",
    address: "Apartment 701, Tech Park Residency, Madhapur, Hyderabad - 500081",
    emergencyContact: {
      name: "Divya Rao",
      relationship: "Wife",
      phone: "+91 88901 23457",
    },
    allergies: ["Latex"],
    chronicConditions: ["Asthma"],
    status: "active",
    registrationDate: "2021-06-15",
    lastVisit: "2026-04-15",
    totalVisits: 18,
    outstandingBills: 0,
  },
  {
    id: "pat_005",
    did: "did:hosp:0x2f88…a9b3",
    mrn: "MRN-205789",
    name: "Priya Reddy",
    age: 45,
    dateOfBirth: "1981-09-12",
    gender: "F",
    bloodGroup: "O-",
    phone: "+91 91234 56789",
    email: "priya.reddy@email.com",
    address: "Villa 12, Palm Grove, Jubilee Hills, Hyderabad - 500033",
    emergencyContact: {
      name: "Vikram Reddy",
      relationship: "Husband",
      phone: "+91 91234 56790",
    },
    allergies: ["Nuts", "Shellfish"],
    chronicConditions: ["Hypothyroidism"],
    status: "active",
    registrationDate: "2018-11-05",
    lastVisit: "2026-05-22",
    totalVisits: 67,
    outstandingBills: 1200,
  },
];

// Mock Doctor Data
export const doctors: DoctorDetails[] = [
  {
    id: "doc_001",
    did: "did:hosp:0xd103…99aa",
    employeeId: "EMP-2847",
    name: "Dr. Ravi Menon",
    specialty: "Cardiology",
    subSpecialties: ["Interventional Cardiology", "Echocardiography", "Heart Failure Management"],
    qualification: ["MBBS", "MD (Cardiology)", "DM (Cardiology)", "FESC"],
    experience: 15,
    department: "Cardiology",
    designation: "Senior Consultant",
    age: 42,
    gender: "M",
    phone: "+91 98765 11111",
    email: "ravi.menon@apollohospitals.com",
    consultationFee: 1500,
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    consultationTiming: "09:00 AM - 05:00 PM",
    languages: ["English", "Hindi", "Malayalam", "Tamil"],
    rating: 4.8,
    totalPatientsTreated: 3500,
    activeCases: 45,
    todayAppointments: 12,
    status: "active",
    joinDate: "2018-03-15",
    licenseNumber: "KMC-12345-2010",
    chamberLocation: "OPD-3, 4th Floor, Main Building",
  },
  {
    id: "doc_002",
    did: "did:hosp:0x55ef…7711",
    employeeId: "EMP-3012",
    name: "Dr. Aanya Verma",
    specialty: "Radiology",
    subSpecialties: ["Interventional Radiology", "CT/MRI Imaging", "Mammography"],
    qualification: ["MBBS", "MD (Radiology)", "FRCR"],
    experience: 12,
    department: "Radiology",
    designation: "Consultant Radiologist",
    age: 38,
    gender: "F",
    phone: "+91 98765 22222",
    email: "aanya.verma@apollohospitals.com",
    consultationFee: 1200,
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    consultationTiming: "10:00 AM - 04:00 PM",
    languages: ["English", "Hindi", "Punjabi"],
    rating: 4.7,
    totalPatientsTreated: 4200,
    activeCases: 28,
    todayAppointments: 15,
    status: "active",
    joinDate: "2019-01-30",
    licenseNumber: "DMC-98765-2012",
    chamberLocation: "Radiology Department, Ground Floor",
  },
  {
    id: "doc_003",
    did: "did:hosp:0xc7a2…4d81",
    employeeId: "EMP-2156",
    name: "Dr. Sameer Khan",
    specialty: "General Medicine",
    subSpecialties: ["Endocrinology", "Diabetes Management", "Internal Medicine"],
    qualification: ["MBBS", "MD (Medicine)", "DM (Endocrinology)"],
    experience: 18,
    department: "General Medicine",
    designation: "Senior Consultant",
    age: 45,
    gender: "M",
    phone: "+91 98765 33333",
    email: "sameer.khan@apollohospitals.com",
    consultationFee: 1000,
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    consultationTiming: "08:00 AM - 06:00 PM",
    languages: ["English", "Hindi", "Urdu"],
    rating: 4.9,
    totalPatientsTreated: 5600,
    activeCases: 62,
    todayAppointments: 18,
    status: "active",
    joinDate: "2016-07-10",
    licenseNumber: "MMC-54321-2008",
    chamberLocation: "OPD-1, 2nd Floor, Main Building",
  },
  {
    id: "doc_004",
    did: "did:hosp:0x8f23…b6c4",
    employeeId: "EMP-3456",
    name: "Dr. Meera Sharma",
    specialty: "Pediatrics",
    subSpecialties: ["Neonatology", "Child Development", "Pediatric Emergency"],
    qualification: ["MBBS", "MD (Pediatrics)", "Fellowship in Neonatology"],
    experience: 10,
    department: "Pediatrics",
    designation: "Consultant Pediatrician",
    age: 36,
    gender: "F",
    phone: "+91 98765 44444",
    email: "meera.sharma@apollohospitals.com",
    consultationFee: 900,
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    consultationTiming: "09:00 AM - 05:00 PM",
    languages: ["English", "Hindi", "Bengali"],
    rating: 4.9,
    totalPatientsTreated: 2800,
    activeCases: 38,
    todayAppointments: 16,
    status: "active",
    joinDate: "2020-02-15",
    licenseNumber: "WBC-11223-2015",
    chamberLocation: "Children's Wing, 2nd Floor",
  },
  {
    id: "doc_005",
    did: "did:hosp:0x3d91…e8a2",
    employeeId: "EMP-2789",
    name: "Dr. Vikram Patel",
    specialty: "Neurology",
    subSpecialties: ["Stroke Management", "Epilepsy", "Movement Disorders"],
    qualification: ["MBBS", "MD (Medicine)", "DM (Neurology)", "FAAN"],
    experience: 16,
    department: "Neurology",
    designation: "Senior Consultant Neurologist",
    age: 44,
    gender: "M",
    phone: "+91 98765 55555",
    email: "vikram.patel@apollohospitals.com",
    consultationFee: 1800,
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    consultationTiming: "10:00 AM - 06:00 PM",
    languages: ["English", "Hindi", "Gujarati"],
    rating: 4.8,
    totalPatientsTreated: 4100,
    activeCases: 52,
    todayAppointments: 10,
    status: "active",
    joinDate: "2017-09-01",
    licenseNumber: "GMC-67890-2009",
    chamberLocation: "Neurology Wing, 5th Floor",
  },
];

// Mock Nurse Data
export const nurses: NurseDetails[] = [
  {
    id: "nurse_001",
    employeeId: "NUR-1234",
    name: "Nurse Priya K.",
    age: 32,
    gender: "F",
    phone: "+91 97654 11111",
    email: "priya.k@apollohospitals.com",
    qualification: "BSc Nursing",
    experience: 8,
    department: "Cardiology",
    ward: "Cardiology Ward A",
    shift: "morning",
    nursingStation: "NS-4A",
    specialization: ["Cardiac Care", "ICU", "Emergency Response"],
    status: "active",
    joinDate: "2018-06-15",
    assignedPatients: 8,
    licenseNumber: "NUR-TG-2016-12345",
  },
  {
    id: "nurse_002",
    employeeId: "NUR-1567",
    name: "Nurse Anjali M.",
    age: 28,
    gender: "F",
    phone: "+91 97654 22222",
    email: "anjali.m@apollohospitals.com",
    qualification: "BSc Nursing, Critical Care Certification",
    experience: 6,
    department: "ICU",
    ward: "ICU - Critical Care",
    shift: "evening",
    nursingStation: "NS-ICU",
    specialization: ["Critical Care", "Ventilator Management", "Life Support"],
    status: "active",
    joinDate: "2020-03-20",
    assignedPatients: 6,
    licenseNumber: "NUR-TG-2018-67890",
  },
  {
    id: "nurse_003",
    employeeId: "NUR-1892",
    name: "Nurse Lakshmi R.",
    age: 35,
    gender: "F",
    phone: "+91 97654 33333",
    email: "lakshmi.r@apollohospitals.com",
    qualification: "GNM, MSc Nursing",
    experience: 12,
    department: "Pediatrics",
    ward: "Children's Ward",
    shift: "morning",
    nursingStation: "NS-PED",
    specialization: ["Pediatric Care", "Neonatal Care", "Child Psychology"],
    status: "active",
    joinDate: "2014-08-10",
    assignedPatients: 10,
    licenseNumber: "NUR-TG-2012-34567",
  },
  {
    id: "nurse_004",
    employeeId: "NUR-2145",
    name: "Nurse Rahul Singh",
    age: 30,
    gender: "M",
    phone: "+91 97654 44444",
    email: "rahul.singh@apollohospitals.com",
    qualification: "BSc Nursing",
    experience: 7,
    department: "Emergency",
    ward: "Emergency Department",
    shift: "night",
    nursingStation: "NS-ER",
    specialization: ["Emergency Care", "Trauma Care", "Triage"],
    status: "active",
    joinDate: "2019-11-01",
    assignedPatients: 12,
    licenseNumber: "NUR-TG-2017-89012",
  },
];

// Mock Support Staff Data
export const supportStaff: SupportStaff[] = [
  {
    id: "staff_001",
    employeeId: "SUP-2341",
    name: "Rajesh Kumar",
    age: 38,
    gender: "M",
    phone: "+91 96543 11111",
    email: "rajesh.kumar@apollohospitals.com",
    role: "Paramedic",
    department: "Emergency Services",
    shift: "morning",
    status: "active",
    joinDate: "2017-04-12",
    supervisor: "Dr. Anjali Reddy",
  },
  {
    id: "staff_002",
    employeeId: "SUP-2678",
    name: "Sunita Devi",
    age: 42,
    gender: "F",
    phone: "+91 96543 22222",
    email: "sunita.devi@apollohospitals.com",
    role: "Ward Attendant",
    department: "General Wards",
    shift: "general",
    status: "active",
    joinDate: "2015-09-20",
    supervisor: "Nurse Supervisor - Ward Management",
  },
  {
    id: "staff_003",
    employeeId: "SUP-2890",
    name: "Mohammed Aziz",
    age: 35,
    gender: "M",
    phone: "+91 96543 33333",
    email: "aziz.m@apollohospitals.com",
    role: "Lab Technician",
    department: "Central Laboratory",
    shift: "morning",
    status: "active",
    joinDate: "2018-02-15",
    supervisor: "Dr. Pathology Head",
  },
  {
    id: "staff_004",
    employeeId: "SUP-3012",
    name: "Kavita Nair",
    age: 29,
    gender: "F",
    phone: "+91 96543 44444",
    email: "kavita.nair@apollohospitals.com",
    role: "Pharmacist",
    department: "Main Pharmacy",
    shift: "evening",
    status: "active",
    joinDate: "2020-07-01",
    supervisor: "Chief Pharmacist",
  },
];

// Summary Statistics
export const peopleStats = {
  totalPatients: 12847,
  admittedPatients: 687,
  outpatients: 11842,
  newRegistrationsToday: 45,
  totalDoctors: 145,
  doctorsOnDuty: 62,
  totalNurses: 420,
  nursesOnDuty: 156,
  totalSupportStaff: 680,
  supportStaffOnDuty: 245,
  todayAppointments: 287,
  todayEmergencies: 23,
  staffVacancies: 12,
};
