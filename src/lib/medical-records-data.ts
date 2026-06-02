// ─── Medical Records, Prescriptions, Health Metrics, Pharmacy ────────────────

export interface Prescription {
  id: string;
  date: string;
  doctor: string;
  specialty: string;
  diagnosis: string;
  medicines: {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }[];
  status: "active" | "completed" | "cancelled";
  nextReviewDate?: string;
}

export interface MedicalDocument {
  id: string;
  type: "lab-report" | "imaging" | "discharge-summary" | "prescription" | "referral" | "procedure-report" | "vaccination";
  title: string;
  date: string;
  issuedBy: string;
  department: string;
  fileSize?: string;
  isNew?: boolean;
  summary?: string;
}

export interface HealthMetric {
  date: string;
  weight?: number;       // kg
  height?: number;       // cm
  bmi?: number;
  bloodSugar?: { fasting: number; postMeal?: number };
  cholesterol?: { total: number; hdl: number; ldl: number };
  bloodPressure?: { systolic: number; diastolic: number };
  hba1c?: number;        // %
}

export interface PharmacyOrder {
  id: string;
  orderedOn: string;
  medicines: { name: string; qty: number; unit: string; instructions: string }[];
  status: "pending" | "dispensed" | "out-of-stock" | "cancelled";
  dispensedAt?: string;
  dispensedBy?: string;
  totalCost: number;
  prescriptionId: string;
}

export interface RehabSession {
  id: string;
  type: "physiotherapy" | "occupational" | "speech" | "cardiac-rehab" | "pulmonary-rehab";
  therapist: string;
  date: string;
  time: string;
  duration: number; // minutes
  status: "completed" | "scheduled" | "cancelled";
  notes?: string;
  progress?: number; // 0-100
}

export interface Feedback {
  id: string;
  date: string;
  category: "doctor" | "nurse" | "food" | "cleanliness" | "facilities" | "overall";
  rating: number;   // 1-5
  comment?: string;
  department?: string;
  staffName?: string;
  status: "submitted" | "acknowledged" | "resolved";
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const prescriptions: Prescription[] = [
  {
    id: "rx_001",
    date: "2026-05-28",
    doctor: "Dr. Ravi Menon",
    specialty: "Cardiology",
    diagnosis: "Acute Decompensated Heart Failure",
    status: "active",
    nextReviewDate: "2026-06-04",
    medicines: [
      { name: "Furosemide",     dosage: "40mg",  frequency: "Once daily",   duration: "7 days",  instructions: "Take in the morning with water" },
      { name: "Atorvastatin",   dosage: "20mg",  frequency: "Once at night",duration: "30 days", instructions: "Take at bedtime" },
      { name: "Aspirin",        dosage: "75mg",  frequency: "Once daily",   duration: "30 days", instructions: "After food" },
      { name: "Metoprolol",     dosage: "25mg",  frequency: "Twice daily",  duration: "30 days", instructions: "Morning and night with food" },
    ],
  },
  {
    id: "rx_002",
    date: "2026-05-18",
    doctor: "Dr. Sameer Khan",
    specialty: "General Medicine",
    diagnosis: "Hypertension – medication review",
    status: "completed",
    medicines: [
      { name: "Amlodipine",     dosage: "5mg",   frequency: "Once daily",   duration: "30 days", instructions: "Morning with or without food" },
      { name: "Metformin",      dosage: "500mg", frequency: "Twice daily",  duration: "30 days", instructions: "With meals to reduce GI side effects" },
    ],
  },
];

export const medicalDocuments: MedicalDocument[] = [
  { id: "doc_001", type: "lab-report",       title: "Complete Blood Count (CBC)",        date: "2026-06-01", issuedBy: "Central Lab",      department: "Laboratory",       fileSize: "128 KB", isNew: true,  summary: "WBC slightly elevated. Platelets normal. Haemoglobin low-normal." },
  { id: "doc_002", type: "imaging",          title: "CT Angiography – Coronary",         date: "2026-06-01", issuedBy: "Dr. Aanya Verma",  department: "Radiology",        fileSize: "45.2 MB", isNew: true, summary: "Mild stenosis in LAD. No acute occlusion detected." },
  { id: "doc_003", type: "lab-report",       title: "Lipid Profile",                     date: "2026-05-29", issuedBy: "Central Lab",      department: "Laboratory",       fileSize: "96 KB",  isNew: false, summary: "LDL elevated at 142 mg/dL. HDL borderline low." },
  { id: "doc_004", type: "lab-report",       title: "HbA1c + Fasting Blood Sugar",       date: "2026-05-28", issuedBy: "Central Lab",      department: "Laboratory",       fileSize: "102 KB", isNew: false, summary: "HbA1c 7.2% — borderline. FBS 118 mg/dL." },
  { id: "doc_005", type: "imaging",          title: "Echocardiogram Report",             date: "2026-05-27", issuedBy: "Dr. Ravi Menon",   department: "Cardiology",       fileSize: "12.8 MB", isNew: false, summary: "EF 45%. Mild mitral regurgitation." },
  { id: "doc_006", type: "prescription",    title: "Prescription #RX-2026-001",         date: "2026-05-28", issuedBy: "Dr. Ravi Menon",   department: "Cardiology",       fileSize: "48 KB",  isNew: false },
  { id: "doc_007", type: "discharge-summary", title: "Discharge Summary – Apr 2025",    date: "2025-04-18", issuedBy: "Dr. Ravi Menon",   department: "Cardiology",       fileSize: "220 KB", isNew: false, summary: "Discharged post cardiac monitoring. Stable on medications." },
  { id: "doc_008", type: "vaccination",     title: "COVID-19 Vaccination Certificate",  date: "2024-09-18", issuedBy: "Govt. of India",   department: "Immunisation",     fileSize: "64 KB",  isNew: false },
];

export const healthMetrics: HealthMetric[] = [
  { date: "2026-06-01", weight: 68.5, bmi: 25.2, bloodSugar: { fasting: 112, postMeal: 148 }, bloodPressure: { systolic: 138, diastolic: 88 }, cholesterol: { total: 210, hdl: 42, ldl: 142 }, hba1c: 7.2 },
  { date: "2026-05-01", weight: 69.2, bmi: 25.4, bloodSugar: { fasting: 118, postMeal: 155 }, bloodPressure: { systolic: 142, diastolic: 90 }, cholesterol: { total: 218, hdl: 40, ldl: 148 } },
  { date: "2026-04-01", weight: 70.1, bmi: 25.7, bloodSugar: { fasting: 124, postMeal: 162 }, bloodPressure: { systolic: 145, diastolic: 92 }, cholesterol: { total: 224, hdl: 39, ldl: 155 } },
  { date: "2026-03-01", weight: 71.0, bmi: 26.0, bloodSugar: { fasting: 128, postMeal: 170 }, bloodPressure: { systolic: 148, diastolic: 95 } },
  { date: "2026-02-01", weight: 71.8, bmi: 26.3, bloodSugar: { fasting: 132 }, bloodPressure: { systolic: 150, diastolic: 96 } },
];

export const pharmacyOrders: PharmacyOrder[] = [
  {
    id: "pho_001",
    orderedOn: "2026-05-28",
    prescriptionId: "rx_001",
    status: "dispensed",
    dispensedAt: "2026-05-28 14:30",
    dispensedBy: "Kavita Nair",
    totalCost: 1240,
    medicines: [
      { name: "Furosemide 40mg",   qty: 7,  unit: "Tablets", instructions: "1 tab every morning" },
      { name: "Atorvastatin 20mg", qty: 30, unit: "Tablets", instructions: "1 tab at bedtime" },
      { name: "Aspirin 75mg",      qty: 30, unit: "Tablets", instructions: "1 tab after breakfast" },
      { name: "Metoprolol 25mg",   qty: 60, unit: "Tablets", instructions: "1 tab morning and night" },
    ],
  },
  {
    id: "pho_002",
    orderedOn: "2026-06-02",
    prescriptionId: "rx_001",
    status: "pending",
    totalCost: 860,
    medicines: [
      { name: "Furosemide 40mg",   qty: 7,  unit: "Tablets", instructions: "Refill" },
      { name: "Metoprolol 25mg",   qty: 30, unit: "Tablets", instructions: "Refill" },
    ],
  },
];

export const rehabSessions: RehabSession[] = [
  { id: "rehab_001", type: "cardiac-rehab",  therapist: "Physio. Anita Rao",    date: "2026-06-02", time: "08:00", duration: 45, status: "scheduled", progress: 40 },
  { id: "rehab_002", type: "cardiac-rehab",  therapist: "Physio. Anita Rao",    date: "2026-06-01", time: "08:00", duration: 45, status: "completed", notes: "Walked 200m on treadmill. Tolerated well.",   progress: 35 },
  { id: "rehab_003", type: "physiotherapy",  therapist: "Physio. Suresh Kumar", date: "2026-05-30", time: "10:00", duration: 30, status: "completed", notes: "Breathing exercises and range-of-motion work.", progress: 25 },
  { id: "rehab_004", type: "physiotherapy",  therapist: "Physio. Suresh Kumar", date: "2026-05-28", time: "10:00", duration: 30, status: "completed", notes: "Initial assessment completed.",                 progress: 10 },
];

export const feedbackList: Feedback[] = [
  { id: "fb_001", date: "2026-05-30", category: "doctor",     rating: 5, comment: "Dr. Menon is very thorough and explains everything clearly.",   staffName: "Dr. Ravi Menon",  department: "Cardiology",  status: "acknowledged" },
  { id: "fb_002", date: "2026-05-29", category: "nurse",      rating: 4, comment: "Nurse Priya is very attentive and kind.",                        staffName: "Nurse Priya K.", department: "Cardiology",  status: "acknowledged" },
  { id: "fb_003", date: "2026-05-28", category: "food",       rating: 3, comment: "Diet food was bland. Could use more variety.",                   department: "Dietary",       status: "submitted" },
  { id: "fb_004", date: "2026-05-28", category: "cleanliness",rating: 5, comment: "Room was very clean and well maintained.",                       department: "Housekeeping",  status: "resolved" },
];
