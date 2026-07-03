export type ChargeCategory = 
  | "room" 
  | "consultation" 
  | "procedure" 
  | "medication" 
  | "lab" 
  | "imaging" 
  | "nursing" 
  | "supplies" 
  | "therapy"
  | "other";

export type PaymentStatus = "pending" | "partial" | "paid" | "insurance-processing";

export interface BillItem {
  id: string;
  date: string;
  category: ChargeCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  coveredByInsurance: boolean;
  insuranceCoverage?: number; // percentage or amount
  patientResponsibility: number;
}

export interface DailyCharge {
  date: string;
  roomCharge: number;
  nursingCare: number;
  meals: number;
  supplies: number;
  total: number;
}

export interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  groupNumber: string;
  coverageType: string;
  copay: number;
  deductible: number;
  deductibleMet: number;
  outOfPocketMax: number;
  outOfPocketMet: number;
  coveragePercentage: number; // e.g., 80% after deductible
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: "cash" | "card" | "insurance" | "online" | "check";
  reference?: string;
  paidBy: string; // patient, insurance company name, etc.
}

export interface BillSummary {
  admissionId: string;
  patientId: string;
  billNumber: string;
  generatedDate: string;
  fromDate: string;
  toDate: string;
  status: PaymentStatus;
  
  // Totals
  totalCharges: number;
  insuranceClaimed: number;
  insurancePaid: number;
  insurancePending: number;
  patientResponsibility: number;
  amountPaid: number;
  balanceDue: number;
  
  // Breakdown by category
  categoryTotals: {
    category: ChargeCategory;
    amount: number;
  }[];
}

// Insurance Configuration
export const insuranceInfo: InsuranceInfo = {
  provider: "Star Health Insurance",
  policyNumber: "SH-2024-789456",
  groupNumber: "GRP-45678",
  coverageType: "Premium Health Plan",
  copay: 500, // ₹500 per visit
  deductible: 25000, // ₹25,000 annual deductible
  deductibleMet: 18000, // ₹18,000 already met
  outOfPocketMax: 100000, // ₹1,00,000 max out of pocket
  outOfPocketMet: 32000, // ₹32,000 already paid
  coveragePercentage: 80, // 80% coverage after deductible
};

// Itemized Bill Charges
export const billItems: BillItem[] = [
  // Room Charges
  {
    id: "bi1",
    date: "2026-05-27",
    category: "room",
    description: "Private Room - Cardiology Ward (C-402)",
    quantity: 1,
    unitPrice: 5000,
    totalPrice: 5000,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 1000,
  },
  {
    id: "bi2",
    date: "2026-05-28",
    category: "room",
    description: "Private Room - Cardiology Ward (C-402)",
    quantity: 1,
    unitPrice: 5000,
    totalPrice: 5000,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 1000,
  },
  {
    id: "bi3",
    date: "2026-05-29",
    category: "room",
    description: "Private Room - Cardiology Ward (C-402)",
    quantity: 1,
    unitPrice: 5000,
    totalPrice: 5000,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 1000,
  },
  {
    id: "bi4",
    date: "2026-05-30",
    category: "room",
    description: "Private Room - Cardiology Ward (C-402)",
    quantity: 1,
    unitPrice: 5000,
    totalPrice: 5000,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 1000,
  },
  
  // Consultations
  {
    id: "bi5",
    date: "2026-05-27",
    category: "consultation",
    description: "Emergency Consultation - Dr. Ravi Menon (Cardiologist)",
    quantity: 1,
    unitPrice: 2500,
    totalPrice: 2500,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 500,
  },
  {
    id: "bi6",
    date: "2026-05-28",
    category: "consultation",
    description: "Daily Round - Dr. Ravi Menon",
    quantity: 1,
    unitPrice: 1000,
    totalPrice: 1000,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 200,
  },
  {
    id: "bi7",
    date: "2026-05-29",
    category: "consultation",
    description: "Specialist Consultation - Dr. Sameer Khan (Endocrinologist)",
    quantity: 1,
    unitPrice: 1500,
    totalPrice: 1500,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 300,
  },
  {
    id: "bi8",
    date: "2026-05-30",
    category: "consultation",
    description: "Daily Round - Dr. Ravi Menon",
    quantity: 1,
    unitPrice: 1000,
    totalPrice: 1000,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 200,
  },
  
  // Procedures
  {
    id: "bi9",
    date: "2026-05-28",
    category: "procedure",
    description: "Coronary Angiography with Stent Placement",
    quantity: 1,
    unitPrice: 185000,
    totalPrice: 185000,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 37000,
  },
  {
    id: "bi10",
    date: "2026-05-28",
    category: "procedure",
    description: "Drug-Eluting Stent (DES)",
    quantity: 1,
    unitPrice: 95000,
    totalPrice: 95000,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 19000,
  },
  
  // Lab Tests
  {
    id: "bi11",
    date: "2026-05-27",
    category: "lab",
    description: "Troponin I Test (Emergency)",
    quantity: 1,
    unitPrice: 1200,
    totalPrice: 1200,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 240,
  },
  {
    id: "bi12",
    date: "2026-05-27",
    category: "lab",
    description: "ECG (12-Lead)",
    quantity: 2,
    unitPrice: 500,
    totalPrice: 1000,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 200,
  },
  {
    id: "bi13",
    date: "2026-05-28",
    category: "lab",
    description: "Complete Blood Count (CBC)",
    quantity: 1,
    unitPrice: 600,
    totalPrice: 600,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 120,
  },
  {
    id: "bi14",
    date: "2026-05-29",
    category: "lab",
    description: "HbA1c Test",
    quantity: 1,
    unitPrice: 800,
    totalPrice: 800,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 160,
  },
  {
    id: "bi15",
    date: "2026-05-29",
    category: "lab",
    description: "Lipid Profile",
    quantity: 1,
    unitPrice: 900,
    totalPrice: 900,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 180,
  },
  
  // Medications
  {
    id: "bi16",
    date: "2026-05-27",
    category: "medication",
    description: "Aspirin 75mg (30 tablets)",
    quantity: 1,
    unitPrice: 120,
    totalPrice: 120,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 24,
  },
  {
    id: "bi17",
    date: "2026-05-27",
    category: "medication",
    description: "Atorvastatin 40mg (30 tablets)",
    quantity: 1,
    unitPrice: 450,
    totalPrice: 450,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 90,
  },
  {
    id: "bi18",
    date: "2026-05-27",
    category: "medication",
    description: "Metoprolol 50mg (60 tablets)",
    quantity: 1,
    unitPrice: 280,
    totalPrice: 280,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 56,
  },
  {
    id: "bi19",
    date: "2026-05-27",
    category: "medication",
    description: "Insulin (Rapid-acting) 10ml vial",
    quantity: 2,
    unitPrice: 850,
    totalPrice: 1700,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 340,
  },
  {
    id: "bi20",
    date: "2026-05-27",
    category: "medication",
    description: "Enoxaparin 40mg injection (3 doses)",
    quantity: 3,
    unitPrice: 320,
    totalPrice: 960,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 192,
  },
  
  // Nursing Care
  {
    id: "bi21",
    date: "2026-05-27",
    category: "nursing",
    description: "ICU Nursing Care (24 hours)",
    quantity: 1,
    unitPrice: 3000,
    totalPrice: 3000,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 600,
  },
  {
    id: "bi22",
    date: "2026-05-28",
    category: "nursing",
    description: "General Ward Nursing Care",
    quantity: 1,
    unitPrice: 1500,
    totalPrice: 1500,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 300,
  },
  {
    id: "bi23",
    date: "2026-05-29",
    category: "nursing",
    description: "General Ward Nursing Care",
    quantity: 1,
    unitPrice: 1500,
    totalPrice: 1500,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 300,
  },
  {
    id: "bi24",
    date: "2026-05-30",
    category: "nursing",
    description: "General Ward Nursing Care",
    quantity: 1,
    unitPrice: 1500,
    totalPrice: 1500,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 300,
  },
  
  // Supplies
  {
    id: "bi25",
    date: "2026-05-27",
    category: "supplies",
    description: "IV Fluids and Administration Set",
    quantity: 1,
    unitPrice: 800,
    totalPrice: 800,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 160,
  },
  {
    id: "bi26",
    date: "2026-05-28",
    category: "supplies",
    description: "Surgical Supplies (Cath Lab)",
    quantity: 1,
    unitPrice: 12000,
    totalPrice: 12000,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 2400,
  },
  {
    id: "bi27",
    date: "2026-05-27",
    category: "supplies",
    description: "Oxygen Supply (24 hours)",
    quantity: 1,
    unitPrice: 1200,
    totalPrice: 1200,
    coveredByInsurance: true,
    insuranceCoverage: 80,
    patientResponsibility: 240,
  },
];

// Daily Charges Summary
export const dailyCharges: DailyCharge[] = [
  {
    date: "2026-05-27",
    roomCharge: 5000,
    nursingCare: 3000,
    meals: 600,
    supplies: 2000,
    total: 10600,
  },
  {
    date: "2026-05-28",
    roomCharge: 5000,
    nursingCare: 1500,
    meals: 600,
    supplies: 12800,
    total: 19900,
  },
  {
    date: "2026-05-29",
    roomCharge: 5000,
    nursingCare: 1500,
    meals: 600,
    supplies: 400,
    total: 7500,
  },
  {
    date: "2026-05-30",
    roomCharge: 5000,
    nursingCare: 1500,
    meals: 600,
    supplies: 300,
    total: 7400,
  },
];

// Payment Records
export const paymentRecords: PaymentRecord[] = [
  {
    id: "pay1",
    date: "2026-05-27",
    amount: 10000,
    method: "card",
    reference: "TXN-2026-05-27-001",
    paidBy: "Patient (Advance)",
  },
  {
    id: "pay2",
    date: "2026-05-29",
    amount: 50000,
    method: "insurance",
    reference: "CLM-SH-2026-05-29-456",
    paidBy: "Star Health Insurance (Partial)",
  },
];

// Calculate Bill Summary
const totalCharges = billItems.reduce((sum, item) => sum + item.totalPrice, 0);
const patientResponsibility = billItems.reduce((sum, item) => sum + item.patientResponsibility, 0);
const insuranceClaimed = totalCharges - patientResponsibility;
const amountPaid = paymentRecords.reduce((sum, payment) => sum + payment.amount, 0);
const balanceDue = patientResponsibility - amountPaid;

// Category totals
const categoryTotals = billItems.reduce((acc, item) => {
  const existing = acc.find(c => c.category === item.category);
  if (existing) {
    existing.amount += item.totalPrice;
  } else {
    acc.push({ category: item.category, amount: item.totalPrice });
  }
  return acc;
}, [] as { category: ChargeCategory; amount: number }[]);

export const billSummary: BillSummary = {
  admissionId: "ADM-2026-001234",
  patientId: "pat_001",
  billNumber: "BILL-2026-05-30-001234",
  generatedDate: "2026-05-30",
  fromDate: "2026-05-27",
  toDate: "2026-05-30",
  status: "partial",
  
  totalCharges,
  insuranceClaimed,
  insurancePaid: 50000,
  insurancePending: insuranceClaimed - 50000,
  patientResponsibility,
  amountPaid,
  balanceDue,
  
  categoryTotals: categoryTotals.sort((a, b) => b.amount - a.amount),
};
