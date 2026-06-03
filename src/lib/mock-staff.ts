export type StaffRole = "Doctor" | "Nurse" | "Technician" | "Pharmacist" | "Admin" | "Radiologist" | "Anesthesiologist" | "Surgeon";

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
  status: "active" | "on-leave" | "inactive";
  credentials: number;
  patientsToday: number;
};

const firstNames = ["Ravi","Aanya","Sameer","Priya","Deepak","Sunita","Kiran","Alok","Reena","Sanjay","Ananya","Vikram","Meena","Gaurav","Divya","Suresh","Kavita","Rajesh","Nisha","Mohan","Anjali","Rohit","Seema","Akash","Geeta","Nikhil","Pooja","Arjun","Shilpa","Dinesh","Usha","Vivek","Radha","Prakash","Lata","Kishore","Puja","Sunil","Mala","Girish","Sarla","Bharat","Asha","Naresh","Gita","Umesh","Rekha","Santosh","Kavya","Raju","Mahesh","Vijay","Lakshman","Suman","Ramesh","Jyoti","Arun","Meera","Ganesh","Arvind","Vinita","Sriram","Padma","Krishnan","Uma","Balaji","Nandini","Venkat","Revati","Shankar","Hemant","Shruti","Yashwant","Vasant","Shobha","Ramana","Sumati","Chandan","Mridula","Rajendra","Vidya","Harish","Kamala","Suresh","Sarita","Pramod","Nalini","Ashok","Sudha","Lalit","Madhuri","Dilip","Rukmini","Govind","Sharda","Mahendra","Jagdish","Tarabai","Kedar","Savita"]; 
const lastNames = ["Menon","Verma","Khan","Nair","Joshi","Kapoor","Bose","Sharma","Gupta","Singh","Patel","Kumar","Reddy","Pillai","Rao","Iyer","Mehta","Chopra","Trivedi","Anand","Bedi","Nanda","Sethi","Lal","Bajaj","Shah","Jain","Das","Pandey","Saxena","Tiwari","Mishra","Sinha","Agarwal","Malhotra","Gill","Batra","Arora","Choudhary","Chandra"];

const specialties: Partial<Record<StaffRole, string[]>> = {
  Doctor: ["Cardiology","Radiology","General Medicine","Orthopedics","Neurology","Oncology","Pediatrics","Emergency Medicine","Gastroenterology","Nephrology","Pulmonology","Dermatology","Psychiatry","Ophthalmology","ENT"],
  Surgeon: ["Cardiac Surgery","General Surgery","Orthopedic Surgery","Neurosurgery","Laparoscopic Surgery","Vascular Surgery"],
  Anesthesiologist: ["General Anesthesia","Regional Anesthesia","Critical Care"],
  Radiologist: ["MRI","CT","Interventional Radiology","Nuclear Medicine"],
  Nurse: ["ICU Nursing","ER Nursing","Ward Nursing","OT Nursing","Pediatric Nursing"],
};

const departments = ["Cardiology","Emergency","ICU","Radiology","General Medicine","Orthopedics","Neurology","Surgery","Pediatrics","Oncology","Pharmacy","Administration","Pathology","Anesthesiology"];

function hashInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pad(n: number) { return String(n).padStart(2, "0"); }

const roles: StaffRole[] = ["Doctor","Nurse","Technician","Pharmacist","Admin","Radiologist","Anesthesiologist","Surgeon"];
const shifts: StaffMember["shift"][] = ["morning","evening","night","on-call"];
const statuses: StaffMember["status"][] = ["active","active","active","on-leave","inactive"];

export function generateStaff(count = 100): StaffMember[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `staff_${String(i + 1).padStart(4, "0")}`;
    const seed = hashInt(id);
    const fn = firstNames[seed % firstNames.length];
    const ln = lastNames[(seed >> 4) % lastNames.length];
    const name = `${fn} ${ln}`;
    const role = roles[seed % roles.length];
    const isDoctor = role === "Doctor" || role === "Surgeon" || role === "Radiologist" || role === "Anesthesiologist";
    const dept = departments[seed % departments.length];
    const specList = specialties[role];
    const specialty = specList ? specList[(seed >> 2) % specList.length] : undefined;
    const year = 2018 + (seed % 8);
    const month = pad(1 + (seed % 12));
    const day = pad(1 + (seed % 28));

    return {
      id,
      did: `did:hosp:${isDoctor ? "doctor" : "staff"}:${seed.toString(16).padStart(8, "0")}`,
      name: isDoctor ? `Dr. ${name}` : name,
      employeeId: `EMP-${String(1000 + i).padStart(6, "0")}`,
      role,
      department: dept,
      specialty,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@apollohospitals.in`,
      phone: `+91 ${9 + (seed % 1)}${String(seed).slice(0, 9).padEnd(9, "0")}`,
      shift: shifts[seed % shifts.length],
      onDuty: seed % 3 !== 0,
      joinedDate: `${year}-${month}-${day}`,
      status: statuses[seed % statuses.length],
      credentials: 2 + (seed % 8),
      patientsToday: isDoctor ? seed % 15 : 0,
    };
  });
}

export const mockStaff = generateStaff(100);
