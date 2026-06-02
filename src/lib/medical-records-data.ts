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
  dispensedBy?: st