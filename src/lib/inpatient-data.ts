export type AdmissionStatus = "admitted" | "discharged" | "scheduled";

export type VitalSigns = {
  id: string;
  timestamp: string;
  temperature: number; // Celsius
  bloodPressure: { systolic: number; diastolic: number };
  heartRate: number; // bpm
  respiratoryRate: number; // breaths per minute
  oxygenSaturation: number; // percentage
  recordedBy: string;
};

export type Medication = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string; // oral, IV, injection
  startDate: string;
  endDate?: string;
  prescribedBy: string;
  status: "active" | "completed" | "discontinued";
  nextDose?: string;
};

export type DailyCheckup = {
  id: string;
  date: string;
  time: string;
  type: "routine" | "specialist" | "emergency";
  doctor: string;
  specialty: string;
  notes: string;
  findings: string[];
  status: "completed" | "scheduled" | "in-progress";
};

export type LabTest = {
  id: string;
  testName: string;
  orderedDate: string;
  scheduledDate?: string;
  completedDate?: string;
  status: "ordered" | "in-progress" | "completed" | "cancelled";
  orderedBy: string;
  results?: {
    parameter: string;
    value: string;
    unit: string;
    normalRange: string;
    flag?: "high" | "low" | "critical";
  }[];
};

export type Procedure = {
  id: string;
  name: string;
  scheduledDate: string;
  scheduledTime: string;
  completedDate?: string;
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
  performedBy?: string;
  location: string;
  notes?: string;
  requiresFasting?: boolean;
};

export type NursingNote = {
  id: string;
  timestamp: string;
  nurse: string;
  category: "general" | "medication" | "vitals" | "incident" | "care";
  note: string;
  priority: "routine" | "important" | "urgent";
};

export type DietOrder = {
  id: string;
  type: string; // Regular, Diabetic, Low-sodium, NPO, etc.
  restrictions: string[];
  startDate: string;
  orderedBy: string;
  specialInstructions?: string;
};

export type Admission = {
  id: string;
  patientId: string;
  admissionDate: string;
  admissionTime: string;
  expectedDischargeDate?: string;
  actualDischargeDate?: string;
  status: AdmissionStatus;
  ward: string;
  room: string;
  bed: string;
  admittingDoctor: string;
  primaryDiagnosis: string;
  secondaryDiagnoses?: string[];
  admissionType: "emergency" | "elective" | "transfer";
  chiefComplaint: string;
};

// Mock data for current admission
export const currentAdmission: Admission = {
  id: "ADM-2026-001234",
  patientId: "pat_001",
  admissionDate: "2026-05-27",
  admissionTime: "14:30",
  expectedDischargeDate: "2026-06-02",
  status: "admitted",
  ward: "Cardiology Ward",
  room: "C-402",
  bed: "B2",
  admittingDoctor: "Dr. Ravi Menon",
  primaryDiagnosis: "Acute Coronary Syndrome",
  secondaryDiagnoses: ["Hypertension", "Type 2 Diabetes"],
  admissionType: "emergency",
  chiefComplaint: "Chest pain and shortness of breath",
};

export const vitalSigns: VitalSigns[] = [
  {
    id: "v1",
    timestamp: "2026-05-30 06:00",
    temperature: 37.2,
    bloodPressure: { systolic: 128, diastolic: 82 },
    heartRate: 76,
    respiratoryRate: 16,
    oxygenSaturation: 98,
    recordedBy: "Nurse Priya K.",
  },
  {
    id: "v2",
    timestamp: "2026-05-30 12:00",
    temperature: 37.4,
    bloodPressure: { systolic: 132, diastolic: 84 },
    heartRate: 78,
    respiratoryRate: 17,
    oxygenSaturation: 97,
    recordedBy: "Nurse Priya K.",
  },
  {
    id: "v3",
    timestamp: "2026-05-29 18:00",
    temperature: 37.1,
    bloodPressure: { systolic: 125, diastolic: 80 },
    heartRate: 74,
    respiratoryRate: 16,
    oxygenSaturation: 98,
    recordedBy: "Nurse Anjali M.",
  },
  {
    id: "v4",
    timestamp: "2026-05-29 12:00",
    temperature: 37.3,
    bloodPressure: { systolic: 130, diastolic: 85 },
    heartRate: 80,
    respiratoryRate: 18,
    oxygenSaturation: 96,
    recordedBy: "Nurse Priya K.",
  },
];

export const medications: Medication[] = [
  {
    id: "med1",
    name: "Aspirin",
    dosage: "75 mg",
    frequency: "Once daily",
    route: "Oral",
    startDate: "2026-05-27",
    prescribedBy: "Dr. Ravi Menon",
    status: "active",
    nextDose: "2026-05-30 08:00",
  },
  {
    id: "med2",
    name: "Atorvastatin",
    dosage: "40 mg",
    frequency: "Once daily (evening)",
    route: "Oral",
    startDate: "2026-05-27",
    prescribedBy: "Dr. Ravi Menon",
    status: "active",
    nextDose: "2026-05-30 20:00",
  },
  {
    id: "med3",
    name: "Metoprolol",
    dosage: "50 mg",
    frequency: "Twice daily",
    route: "Oral",
    startDate: "2026-05-27",
    prescribedBy: "Dr. Ravi Menon",
    status: "active",
    nextDose: "2026-05-30 08:00",
  },
  {
    id: "med4",
    name: "Insulin (Rapid-acting)",
    dosage: "8 units",
    frequency: "Before meals",
    route: "Subcutaneous injection",
    startDate: "2026-05-27",
    prescribedBy: "Dr. Sameer Khan",
    status: "active",
    nextDose: "2026-05-30 12:00",
  },
  {
    id: "med5",
    name: "Enoxaparin",
    dosage: "40 mg",
    frequency: "Once daily",
    route: "Subcutaneous injection",
    startDate: "2026-05-27",
    endDate: "2026-05-29",
    prescribedBy: "Dr. Ravi Menon",
    status: "completed",
  },
];

export const dailyCheckups: DailyCheckup[] = [
  {
    id: "dc1",
    date: "2026-05-30",
    time: "08:00",
    type: "routine",
    doctor: "Dr. Ravi Menon",
    specialty: "Cardiology",
    notes: "Patient stable, chest pain resolved. Continue current medications.",
    findings: ["Heart sounds normal", "No respiratory distress", "Wound healing well"],
    status: "completed",
  },
  {
    id: "dc2",
    date: "2026-05-30",
    time: "14:00",
    type: "specialist",
    doctor: "Dr. Sameer Khan",
    specialty: "Endocrinology",
    notes: "Blood sugar levels improving with insulin therapy.",
    findings: ["HbA1c trending down", "No hypoglycemic episodes"],
    status: "scheduled",
  },
  {
    id: "dc3",
    date: "2026-05-29",
    time: "08:30",
    type: "routine",
    doctor: "Dr. Ravi Menon",
    specialty: "Cardiology",
    notes: "Post-procedure check. Patient recovering well.",
    findings: ["Vital signs stable", "No complications", "Pain managed"],
    status: "completed",
  },
];

export const labTests: LabTest[] = [
  {
    id: "lab1",
    testName: "Troponin I",
    orderedDate: "2026-05-27",
    completedDate: "2026-05-27",
    status: "completed",
    orderedBy: "Dr. Ravi Menon",
    results: [
      { parameter: "Troponin I", value: "0.8", unit: "ng/mL", normalRange: "< 0.04", flag: "high" },
    ],
  },
  {
    id: "lab2",
    testName: "Complete Blood Count",
    orderedDate: "2026-05-28",
    completedDate: "2026-05-28",
    status: "completed",
    orderedBy: "Dr. Ravi Menon",
    results: [
      { parameter: "Hemoglobin", value: "13.5", unit: "g/dL", normalRange: "13.5-17.5" },
      { parameter: "WBC", value: "8.2", unit: "10³/μL", normalRange: "4.5-11.0" },
      { parameter: "Platelets", value: "245", unit: "10³/μL", normalRange: "150-400" },
    ],
  },
  {
    id: "lab3",
    testName: "Lipid Panel",
    orderedDate: "2026-05-29",
    scheduledDate: "2026-05-31",
    status: "ordered",
    orderedBy: "Dr. Ravi Menon",
  },
  {
    id: "lab4",
    testName: "HbA1c",
    orderedDate: "2026-05-28",
    completedDate: "2026-05-29",
    status: "completed",
    orderedBy: "Dr. Sameer Khan",
    results: [
      { parameter: "HbA1c", value: "7.8", unit: "%", normalRange: "< 5.7", flag: "high" },
    ],
  },
];

export const procedures: Procedure[] = [
  {
    id: "proc1",
    name: "Coronary Angiography",
    scheduledDate: "2026-05-28",
    scheduledTime: "10:00",
    completedDate: "2026-05-28",
    status: "completed",
    performedBy: "Dr. Ravi Menon",
    location: "Cath Lab 2",
    notes: "Procedure successful. 70% stenosis in LAD, stent placed.",
    requiresFasting: true,
  },
  {
    id: "proc2",
    name: "Echocardiogram",
    scheduledDate: "2026-05-31",
    scheduledTime: "09:30",
    status: "scheduled",
    location: "Cardiology Imaging",
    requiresFasting: false,
  },
  {
    id: "proc3",
    name: "Stress Test",
    scheduledDate: "2026-06-01",
    scheduledTime: "11:00",
    status: "scheduled",
    location: "Cardiac Rehab Center",
    notes: "Pre-discharge evaluation",
    requiresFasting: false,
  },
];

export const nursingNotes: NursingNote[] = [
  {
    id: "nn1",
    timestamp: "2026-05-30 07:30",
    nurse: "Nurse Priya K.",
    category: "vitals",
    note: "Morning vitals recorded. Patient resting comfortably. No complaints.",
    priority: "routine",
  },
  {
    id: "nn2",
    timestamp: "2026-05-30 08:15",
    nurse: "Nurse Priya K.",
    category: "medication",
    note: "Morning medications administered. Patient tolerated well.",
    priority: "routine",
  },
  {
    id: "nn3",
    timestamp: "2026-05-29 22:00",
    nurse: "Nurse Anjali M.",
    category: "general",
    note: "Patient reports mild chest discomfort. Dr. Menon notified. ECG performed - no acute changes.",
    priority: "important",
  },
  {
    id: "nn4",
    timestamp: "2026-05-29 14:30",
    nurse: "Nurse Priya K.",
    category: "care",
    note: "Assisted patient with ambulation. Walked 50 meters in corridor without difficulty.",
    priority: "routine",
  },
];

export const dietOrder: DietOrder = {
  id: "diet1",
  type: "Cardiac Diet (Low-sodium, Diabetic)",
  restrictions: ["Low sodium (< 2g/day)", "Low saturated fat", "Controlled carbohydrates"],
  startDate: "2026-05-27",
  orderedBy: "Dr. Ravi Menon",
  specialInstructions: "Small frequent meals. Monitor blood sugar before meals.",
};
