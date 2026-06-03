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
  return Array.from({ length: count }, (_, i) => {
    const id = `pat_${String(i + 1).padStart(4, "0")}`;
    const seed = hashInt(id);
    const firstName = firstNames[seed % firstNames.length];
    const lastName = lastNames[(seed >> 4) % lastNames.length];
    const name = `${firstName} ${lastName}`;
    const age = 18 + (seed % 70);
    const gender: "M" | "F" = seed % 2 === 0 ? "M" : "F";
    const year = 2020 + (seed % 6);
    const month = pad(1 + (seed % 12));
    const day = pad(1 + (seed % 28));
    const admitYear = 2025 + (seed % 2);
    const admitMonth = pad(1 + ((seed >> 2) % 12));
    const admitDay = pad(1 + ((seed >> 3) % 28));
    const allergies = seed % 5 === 0 ? [] : pickN(allergyPool.filter(a => a !== "None"), 1 + (seed % 3));
    const numConditions = 1 + (seed % 4);
    const conditions = pickN(conditionPool, numConditions);
    const statuses: PatientFull["status"][] = ["inpatient", "outpatient", "discharged"];
    const status = statuses[seed % 3];

    return {
      id,
      did: `did:hosp:0x${seed.toString(16).padStart(4, "0")}…${(seed * 7).toString(16).padStart(4, "0")}`,
      name,
      mrn: `MRN-${200000 + i * 7}`,
      age,
      gender,
      bloodGroup: bloodGroups[seed % bloodGroups.length],
      allergies,
      phone: `+91 ${9 + (seed % 1)}${String(seed).slice(0, 9).padEnd(9, "0")}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
      address: `${100 + (seed % 900)}, ${lastName} Lane, Mumbai - ${400000 + (seed % 100)}`,
      dob: `${1950 + (age - 18)}-${month}-${day}`,
      ward: wardOptions[seed % wardOptions.length],
      bed: `${["A","B","C","D","E"][seed % 5]}${1 + (seed % 20)}`,
      admitDate: `${admitYear}-${admitMonth}-${admitDay}`,
      status,
      primaryDoctor: doctorPool[seed % doctorPool.length],
      conditions,
      insuranceProvider: insurers[seed % insurers.length],
      insurancePolicyNo: `POL-${2024 + (seed % 3)}-${String(seed).slice(0, 8).padEnd(8, "0")}`,
      emergencyContact: {
        name: `${firstNames[(seed + 3) % firstNames.length]} ${lastName}`,
        relation: ["Spouse","Parent","Sibling","Child","Guardian"][seed % 5],
        phone: `+91 ${8 + (seed % 2)}${String(seed * 3).slice(0, 9).padEnd(9, "0")}`,
      },
      organDonor: seed % 4 === 0,
      nationality: "Indian",
    };
  });
}

export const mockPatients = generatePatients(500);
export const mockPatient = mockPatients[0];
