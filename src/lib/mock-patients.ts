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
};

const firstNames = ["Anika","Rohan","Meera","Karthik","Priya","Arjun","Divya","Suresh","Lakshmi","Vikram","Anjali","Ravi","Nisha","Deepak","Sunita","Mohit","Kavya","Rajesh","Pooja","Aman","Sneha","Harsh","Rekha","Vivek","Neha","Sanjay","Tanya","Arun","Geeta","Nikhil","Swati","Rahul","Usha","Pratik","Manisha","Gaurav","Shruti","Vinod","Pallavi","Rohit","Kavita","Siddharth","Lata","Amit","Seema","Kunal","Ananya","Vijay","Radha","Akash"];
const lastNames = ["Sharma","Iyer","Pillai","Rao","Verma","Mehta","Gupta","Singh","Patel","Kumar","Nair","Reddy","Joshi","Agarwal","Malhotra","Kapoor","Bose","Chandra","Das","Pandey","Saxena","Tiwari","Mishra","Sinha","Shah","Jain","Chopra","Trivedi","Menon","Khanna","Gill","Nanda","Batra","Arora","Sethi","Lal","Choudhary","Bajaj","Anand","Bedi"];
const bloodGroups = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];
const allergyPool = ["Penicillin","Sulfa drugs","Aspirin","Latex","Ibuprofen","Codeine","Morphine","Amoxicillin","Cephalosporins","NSAIDs","None"];
const conditionPool = ["Type 2 Diabetes","Hypertension","Coronary Artery Disease","Asthma","COPD","Hypothyroidism","Osteoarthritis","Chronic Kidney Disease","Atrial Fibrillation","Heart Failure","Migraine","Epilepsy","Depression","Anxiety Disorder","GERD","Peptic Ulcer","Anemia"];
const wardOptions = ["Cardiology Ward 4A","ICU Block B","General Ward 2C","Orthopedics 3D","Neurology 5A","Pediatrics 1B","Oncology 6C","Emergency Ward","Post-Op Recovery"];
const doctorPool = ["Dr. Ravi Menon","Dr. Aanya Verma","Dr. Sameer Khan","Dr. Priya Nair","Dr. Deepak Joshi","Dr. Sunita Kapoor","Dr. Kiran Bose","Dr. Alok Sharma","Dr. Reena Pillai","Dr. Sanjay Gupta"];
const insurers = ["Star Health","HDFC Ergo","Bajaj Allianz","New India Assurance","United India","ICICI Lombard","Care Health","Niva Bupa","Aditya Birla Health","SBI Health"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}
function pad(n: number) { return String(n).padStart(2, "0"); }
function hashInt(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return Math.abs(h); }

export function generatePatients(count = 500): PatientFull[] {
  return [];
}

export const mockPatients: PatientFull[] = [];
export const mockPatient: PatientFull | null = null;
