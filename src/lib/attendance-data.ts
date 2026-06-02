// ─── Attendance & Visitor Management Data ───────────────────────────────────

export type AttendanceStatus = "present" | "absent" | "late" | "half-day" | "on-leave";
export type PersonCategory = "staff" | "patient" | "visitor";

export interface AttendanceRecord {
  id: string;
  personId: string;
  personName: string;
  category: PersonCategory;
  role?: string;          // Doctor, Nurse, Admin, etc.
  department?: string;
  date: string;           // ISO date
  checkIn?: string;       // "HH:MM"
  checkOut?: string;
  status: AttendanceStatus;
  notes?: string;
  verifiedBy?: string;
}

export interface VisitorRecord {
  id: string;
  visitorName: string;
  visitorPhone: string;
  visitingPatient: string;
  patientMRN: string;
  ward: string;
  purpose: string;
  relationship: string;
  checkIn: string;        // "HH:MM"
  checkOut?: string;
  date: string;
  badge: string;
  approvedBy: string;
  status: "inside" | "checked-out" | "denied";
}

export interface PatientMovement {
  id: string;
  patientName: string;
  mrn: string;
  ward: string;
  room: string;
  event: "admission" | "discharge" | "transfer" | "procedure-out" | "procedure-in" | "leave" | "return";
  time: string;
  date: string;
  handledBy: string;
  notes?: string;
}

export interface StaffAttendanceSummary {
  employeeId: string;
  name: string;
  role: string;
  department: string;
  shift: string;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
  workHours?: string;
  overtimeHours?: string;
}

// ─── Today's Staff Attendance (2026-06-02) ───────────────────────────────────
export const todayStaffAttendance: StaffAttendanceSummary[] = [
  { employeeId: "EMP-2847", name: "Dr. Ravi Menon",       role: "Senior Consultant",     department: "Cardiology",         shift: "08:00–16:00", checkIn: "07:52", checkOut: undefined,  status: "present",  workHours: "8h 14m", overtimeHours: "0h 14m" },
  { employeeId: "EMP-3012", name: "Dr. Aanya Verma",      role: "Consultant Radiologist", department: "Radiology",          shift: "10:00–18:00", checkIn: "10:05", checkOut: undefined,  status: "present",  workHours: "–",      overtimeHours: "–" },
  { employeeId: "EMP-2156", name: "Dr. Sameer Khan",      role: "Senior Consultant",     department: "General Medicine",   shift: "08:00–16:00", checkIn: "08:22", checkOut: undefined,  status: "late",     workHours: "–",      overtimeHours: "–" },
  { employeeId: "EMP-3456", name: "Dr. Meera Sharma",     role: "Consultant Pediatric",  department: "Pediatrics",         shift: "09:00–17:00", checkIn: "08:58", checkOut: undefined,  status: "present",  workHours: "–",      overtimeHours: "–" },
  { employeeId: "EMP-2789", name: "Dr. Vikram Patel",     role: "Senior Neurologist",    department: "Neurology",          shift: "10:00–18:00", checkIn: undefined, checkOut: undefined, status: "absent",  workHours: "–",      overtimeHours: "–" },
  { employeeId: "NUR-1234", name: "Nurse Priya K.",       role: "Nursing",               department: "Cardiology",         shift: "07:00–15:00", checkIn: "06:58", checkOut: undefined,  status: "present",  workHours: "–",      overtimeHours: "–" },
  { employeeId: "NUR-1567", name: "Nurse Anjali M.",      role: "ICU Nursing",           department: "ICU",                shift: "15:00–23:00", checkIn: undefined, checkOut: undefined, status: "present", workHours: "–",      overtimeHours: "–" },
  { employeeId: "NUR-1892", name: "Nurse Lakshmi R.",     role: "Pediatric Nursing",     department: "Pediatrics",         shift: "07:00–15:00", checkIn: "07:10", checkOut: undefined,  status: "present",  workHours: "–",      overtimeHours: "–" },
  { employeeId: "NUR-2145", name: "Nurse Rahul Singh",    role: "Emergency Nursing",     department: "Emergency",          shift: "23:00–07:00", checkIn: "22:55", checkOut: "07:03",   status: "present",  workHours: "8h 08m", overtimeHours: "0h 08m" },
  { employeeId: "SUP-2341", name: "Rajesh Kumar",         role: "Paramedic",             department: "Emergency Services", shift: "08:00–16:00", checkIn: "08:00", checkOut: undefined,  status: "present",  workHours: "–",      overtimeHours: "–" },
  { employeeId: "SUP-2678", name: "Sunita Devi",          role: "Ward Attendant",        department: "General Wards",      shift: "06:00–14:00", checkIn: "06:02", checkOut: "14:05",   status: "present",  workHours: "8h 03m", overtimeHours: "0h 03m" },
  { employeeId: "SUP-2890", name: "Mohammed Aziz",        role: "Lab Technician",        department: "Laboratory",         shift: "08:00–16:00", checkIn: "08:00", checkOut: undefined,  status: "present",  workHours: "–",      overtimeHours: "–" },
  { employeeId: "SUP-3012", name: "Kavita Nair",          role: "Pharmacist",            department: "Pharmacy",           shift: "14:00–22:00", checkIn: undefined, checkOut: undefined, status: "present", workHours: "–",      overtimeHours: "–" },
];

// ─── Today's Visitor Log ──────────────────────────────────────────────────────
export const visitorLog: VisitorRecord[] = [
  { id: "vis_001", visitorName: "Rajesh Sharma",   visitorPhone: "+91 98765 43211", visitingPatient: "Anika Sharma",   patientMRN: "MRN-204871", ward: "Cardiology Ward",    purpose: "Family visit",       relationship: "Husband",  checkIn: "09:30", checkOut: "11:00", date: "2026-06-02", badge: "VIS-0401", approvedBy: "Desk-A", status: "checked-out" },
  { id: "vis_002", visitorName: "Lakshmi Iyer",    visitorPhone: "+91 90123 45679", visitingPatient: "Rohan Iyer",     patientMRN: "MRN-204902", ward: "Cardiology Ward",    purpose: "Family visit",       relationship: "Wife",     checkIn: "10:15", checkOut: undefined, date: "2026-06-02", badge: "VIS-0402", approvedBy: "Desk-A", status: "inside" },
  { id: "vis_003", visitorName: "Suresh Pillai",   visitorPhone: "+91 70456 78902", visitingPatient: "Meera Pillai",   patientMRN: "MRN-205110", ward: "General Ward",       purpose: "Routine check-in",   relationship: "Father",   checkIn: "11:00", checkOut: "12:30", date: "2026-06-02", badge: "VIS-0403", approvedBy: "Desk-B", status: "checked-out" },
  { id: "vis_004", visitorName: "Divya Rao",       visitorPhone: "+91 88901 23457", visitingPatient: "Karthik Rao",    patientMRN: "MRN-205288", ward: "Pulmonology Ward",   purpose: "Document handover",  relationship: "Wife",     checkIn: "13:45", checkOut: undefined, date: "2026-06-02", badge: "VIS-0404", approvedBy: "Desk-A", status: "inside" },
  { id: "vis_005", visitorName: "Priya Nair",      visitorPhone: "+91 99887 76655", visitingPatient: "Rohan Iyer",     patientMRN: "MRN-204902", ward: "Cardiology Ward",    purpose: "Bring medicine",     relationship: "Daughter", checkIn: "14:00", checkOut: undefined, date: "2026-06-02", badge: "VIS-0405", approvedBy: "Desk-B", status: "inside" },
  { id: "vis_006", visitorName: "Vikram Reddy",    visitorPhone: "+91 91234 56790", visitingPatient: "Priya Reddy",    patientMRN: "MRN-205789", ward: "Endocrinology Ward", purpose: "Family visit",       relationship: "Husband",  checkIn: "15:10", checkOut: undefined, date: "2026-06-02", badge: "VIS-0406", approvedBy: "Desk-C", status: "inside" },
  { id: "vis_007", visitorName: "Anand Kumar",     visitorPhone: "+91 88776 54321", visitingPatient: "Anika Sharma",   patientMRN: "MRN-204871", ward: "Cardiology Ward",    purpose: "Emotional support",  relationship: "Brother",  checkIn: "16:00", checkOut: undefined, date: "2026-06-02", badge: "VIS-0407", approvedBy: "Desk-A", status: "inside" },
  { id: "vis_008", visitorName: "Sanjay Verma",    visitorPhone: "+91 77665 44332", visitingPatient: "Anika Sharma",   patientMRN: "MRN-204871", ward: "Cardiology Ward",    purpose: "Personal visit",     relationship: "Colleague",checkIn: "09:00", checkOut: "09:45", date: "2026-06-02", badge: "VIS-0408", approvedBy: "Desk-A", status: "denied"  },
];

// ─── Patient Movement Log (In/Out) ────────────────────────────────────────────
export const patientMovements: PatientMovement[] = [
  { id: "pm_001", patientName: "Anika Sharma",   mrn: "MRN-204871", ward: "Cardiology Ward",    room: "C-402", event: "admission",       time: "08:30", date: "2026-05-27", handledBy: "Dr. Ravi Menon",    notes: "Elective admission for cardiac evaluation" },
  { id: "pm_002", patientName: "Rohan Iyer",     mrn: "MRN-204902", ward: "Cardiology Ward",    room: "C-405", event: "admission",       time: "09:15", date: "2026-05-28", handledBy: "Dr. Ravi Menon",    notes: "Emergency admission – chest pain" },
  { id: "pm_003", patientName: "Anika Sharma",   mrn: "MRN-204871", ward: "Radiology",          room: "CT-2",  event: "procedure-out",   time: "11:00", date: "2026-06-01", handledBy: "Ward Attendant",    notes: "CT angiography" },
  { id: "pm_004", patientName: "Anika Sharma",   mrn: "MRN-204871", ward: "Cardiology Ward",    room: "C-402", event: "procedure-in",    time: "12:45", date: "2026-06-01", handledBy: "Ward Attendant",    notes: "Returned from radiology" },
  { id: "pm_005", patientName: "Meera Pillai",   mrn: "MRN-205110", ward: "General Ward",       room: "G-204", event: "admission",       time: "14:00", date: "2026-05-29", handledBy: "Dr. Sameer Khan",   notes: "Outpatient converted to inpatient" },
  { id: "pm_006", patientName: "Karthik Rao",    mrn: "MRN-205288", ward: "Pulmonology",        room: "P-301", event: "admission",       time: "16:30", date: "2026-06-01", handledBy: "Dr. Vikram Patel",  notes: "Asthma exacerbation" },
  { id: "pm_007", patientName: "Meera Pillai",   mrn: "MRN-205110", ward: "General Ward",       room: "G-204", event: "discharge",       time: "10:00", date: "2026-06-02", handledBy: "Dr. Sameer Khan",   notes: "Discharged – recovery satisfactory" },
  { id: "pm_008", patientName: "Rohan Iyer",     mrn: "MRN-204902", ward: "ICU",                room: "ICU-3", event: "transfer",        time: "03:20", date: "2026-06-02", handledBy: "Nurse Anjali M.",   notes: "Transferred to ICU – deteriorating condition" },
];

// ─── Staff Attendance History (last 7 days for logged-in staff) ───────────────
export const myAttendanceHistory = [
  { date: "2026-06-02", day: "Tue", checkIn: "07:52", checkOut: undefined,  status: "present" as AttendanceStatus, shift: "08:00–16:00", hours: "–" },
  { date: "2026-06-01", day: "Mon", checkIn: "07:58", checkOut: "16:14",   status: "present" as AttendanceStatus, shift: "08:00–16:00", hours: "8h 16m" },
  { date: "2026-05-31", day: "Sun", checkIn: undefined, checkOut: undefined, status: "absent"  as AttendanceStatus, shift: "–",           hours: "–" },
  { date: "2026-05-30", day: "Sat", checkIn: "08:05", checkOut: "16:02",   status: "present" as AttendanceStatus, shift: "08:00–16:00", hours: "7h 57m" },
  { date: "2026-05-29", day: "Fri", checkIn: "08:10", checkOut: "19:22",   status: "present" as AttendanceStatus, shift: "08:00–16:00", hours: "11h 12m" },
  { date: "2026-05-28", day: "Thu", checkIn: "07:45", checkOut: "16:00",   status: "present" as AttendanceStatus, shift: "08:00–16:00", hours: "8h 15m" },
  { date: "2026-05-27", day: "Wed", checkIn: undefined, checkOut: undefined, status: "on-leave" as AttendanceStatus, shift: "08:00–16:00", hours: "–" },
];

// ─── Summary stats ────────────────────────────────────────────────────────────
export const attendanceStats = {
  date: "2026-06-02",
  totalStaff: 13,
  present: 10,
  absent: 1,
  late: 1,
  onLeave: 1,
  visitorsToday: 8,
  visitorsInside: 5,
  patientsAdmitted: 4,
  patientsDischargedToday: 1,
  patientMovementsToday: 3,
};
