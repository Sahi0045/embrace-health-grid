/**
 * Real-Time Hospital Data Store
 *
 * - Single source of truth for ALL live data
 * - Backed by Hyperledger Fabric simulation (localStorage persistence)
 * - Emits real-time events via custom EventTarget
 * - Auto-seeds patient/staff registry into blockchain on first load
 * - Generates cryptographically-valid DID cards for every entity
 */

import {
  seedInitialDIDs,
  submitHyperledgerTransaction,
  getDIDRegistry,
  queryWorldState,
  type DIDDocument,
  type VerifiableCredential,
} from "./hyperledger";
import { generatePatients, type PatientFull } from "./mock-patients";
import { generateStaff, type StaffMember } from "./mock-staff";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface LivePatient extends PatientFull {
  didDocument: DIDDocument | null;
  activeCredentials: VerifiableCredential[];
  isOnChain: boolean;
  lastActivity: string;
  vitals: {
    heartRate: number;
    bp: string;
    spo2: number;
    temp: number;
    respRate: number;
  };
}

export interface LiveStaff extends StaffMember {
  didDocument: DIDDocument | null;
  activeCredentials: VerifiableCredential[];
  isOnChain: boolean;
  currentLocation: string;
  lastSignal: string;
  beaconStrength: string;
}

export interface LiveAppointment {
  id: string;
  patientDid: string;
  patientName: string;
  doctorDid: string;
  doctorName: string;
  specialty: string;
  slot: string;
  mode: "in-person" | "telemedicine";
  status: "confirmed" | "pending" | "cancelled" | "completed";
  bookedAt: string;
  blockTxId?: string;
  blockNumber?: number;
}

export interface LiveTransaction {
  id: string;
  patientDid: string;
  patientName: string;
  amount: number;
  category: "consultation" | "pharmacy" | "lab" | "room" | "surgery";
  status: "paid" | "outstanding" | "refunded";
  date: string;
  reference: string;
  blockTxId?: string;
}

// ---------------------------------------------------------------------------
// Store Event Bus
// ---------------------------------------------------------------------------
export const storeEvents = new EventTarget();

export function emitStoreEvent(event: string, detail?: unknown) {
  storeEvents.dispatchEvent(new CustomEvent(event, { detail }));
}

// ---------------------------------------------------------------------------
// Base data (deterministic generation — same across all refreshes)
// ---------------------------------------------------------------------------
const _allPatients: PatientFull[] = generatePatients(500);
const _allStaff: StaffMember[] = generateStaff(100);

// ---------------------------------------------------------------------------
// Real-time vital sign simulator
// ---------------------------------------------------------------------------
function generateVitals(seed: number) {
  const base = seed % 100;
  return {
    heartRate: 60 + (base % 40),
    bp: `${110 + (base % 30)}/${70 + (base % 15)}`,
    spo2: 95 + (base % 5),
    temp: parseFloat((36.5 + (base % 2) * 0.1).toFixed(1)),
    respRate: 14 + (base % 6),
  };
}

// Vitals fluctuate every 5 seconds
const _vitals: Map<string, LivePatient["vitals"]> = new Map();
let _vitalsTimer: ReturnType<typeof setInterval> | null = null;

function startVitalsSimulation(patients: LivePatient[]) {
  if (_vitalsTimer) clearInterval(_vitalsTimer);
  // Seed initial vitals
  patients.forEach((p) => {
    const seed = p.id.split("_")[1] ? parseInt(p.id.split("_")[1]) : 0;
    _vitals.set(p.id, generateVitals(seed));
  });

  _vitalsTimer = setInterval(() => {
    // Fluctuate vitals for ~20 random patients
    const inpatients = patients.filter((p) => p.status === "inpatient").slice(0, 20);
    inpatients.forEach((p) => {
      const current = _vitals.get(p.id)!;
      _vitals.set(p.id, {
        heartRate: Math.max(40, Math.min(160, current.heartRate + Math.round((Math.random() - 0.5) * 6))),
        bp: `${Math.max(80, Math.min(180, parseInt(current.bp.split("/")[0]) + Math.round((Math.random() - 0.5) * 4)))}/${Math.max(50, Math.min(120, parseInt(current.bp.split("/")[1]) + Math.round((Math.random() - 0.5) * 3)))}`,
        spo2: Math.max(88, Math.min(100, current.spo2 + Math.round((Math.random() - 0.5) * 2))),
        temp: parseFloat(Math.max(35.0, Math.min(40.0, current.temp + (Math.random() - 0.5) * 0.2)).toFixed(1)),
        respRate: Math.max(8, Math.min(30, current.respRate + Math.round((Math.random() - 0.5) * 2))),
      });
    });
    emitStoreEvent("vitals:update");
  }, 5000);
}

// ---------------------------------------------------------------------------
// Staff Location Simulator
// ---------------------------------------------------------------------------
const LOCATIONS = [
  "OPD Room 3", "ICU Block B", "Emergency Ward", "Operation Theatre 2",
  "Consultation Room 5", "Radiology Block", "Pharmacy Desk", "Nursing Station",
  "Conference Room 1", "Lab Wing A", "Cafeteria", "Admin Block",
];

const _staffLocations: Map<string, { location: string; status: string; lastSignal: string; beacon: string }> = new Map();

function initStaffLocations(staff: StaffMember[]) {
  staff.forEach((s, i) => {
    _staffLocations.set(s.id, {
      location: s.onDuty ? LOCATIONS[i % LOCATIONS.length] : "Off Duty",
      status: s.onDuty ? (i % 5 === 0 ? "In Surgery" : i % 4 === 0 ? "Emergency Response" : i % 3 === 0 ? "In Consultation" : "Available") : "Off Duty",
      lastSignal: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      beacon: `${70 + (i % 30)}%`,
    });
  });
}

let _staffLocationTimer: ReturnType<typeof setInterval> | null = null;

function startStaffSimulation(staff: StaffMember[]) {
  if (_staffLocationTimer) clearInterval(_staffLocationTimer);

  _staffLocationTimer = setInterval(async () => {
    const onDuty = staff.filter((s) => s.onDuty);
    const idx = Math.floor(Math.random() * onDuty.length);
    const member = onDuty[idx];
    if (!member) return;

    const current = _staffLocations.get(member.id);
    const newLoc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    if (current?.location === newLoc) return;

    const newStatus = newLoc === "Operation Theatre 2" ? "In Surgery"
      : newLoc === "Emergency Ward" ? "Emergency Response"
      : newLoc === "ICU Block B" ? "In Consultation"
      : "Available";

    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    _staffLocations.set(member.id, {
      location: newLoc,
      status: newStatus,
      lastSignal: now,
      beacon: `${70 + Math.floor(Math.random() * 30)}%`,
    });

    // Record on chain (silently)
    await submitHyperledgerTransaction(
      "tracker-chaincode",
      "reportTelemetry",
      [member.did, member.name, newLoc, newStatus],
      { silent: true }
    );

    emitStoreEvent("staff:location:update", { memberId: member.id, location: newLoc, status: newStatus });
  }, 8000);
}

// ---------------------------------------------------------------------------
// Live Appointments Store
// ---------------------------------------------------------------------------
const _appointments: Map<string, LiveAppointment> = new Map();

function seedAppointments() {
  if (_appointments.size > 0) return;
  const doctors = _allStaff.filter((s) => s.role === "Doctor").slice(0, 10);
  const patientsToBook = _allPatients.slice(0, 25);
  const modes: LiveAppointment["mode"][] = ["in-person", "telemedicine"];
  const statuses: LiveAppointment["status"][] = ["confirmed", "confirmed", "pending", "completed", "cancelled"];

  patientsToBook.forEach((p, i) => {
    const doc = doctors[i % doctors.length];
    const apptId = `appt_${p.id}_${i}`;
    const slotDate = new Date(Date.now() - (i * 86400000 / 3)).toLocaleDateString("en-IN");
    const slotTime = `${9 + (i % 8)}:${ i % 2 === 0 ? "00" : "30"} ${i < 12 ? "AM" : "PM"}`;
    _appointments.set(apptId, {
      id: apptId,
      patientDid: p.did,
      patientName: p.name,
      doctorDid: doc.did,
      doctorName: doc.name,
      specialty: doc.specialty || "General Medicine",
      slot: `${slotDate}, ${slotTime}`,
      mode: modes[i % 2],
      status: statuses[i % statuses.length],
      bookedAt: new Date(Date.now() - i * 3600000).toLocaleString("en-IN"),
    });
  });
}

// ---------------------------------------------------------------------------
// Live Transactions Store
// ---------------------------------------------------------------------------
const _transactions: Map<string, LiveTransaction> = new Map();

const TX_CATEGORIES: LiveTransaction["category"][] = ["consultation", "pharmacy", "lab", "room", "surgery"];
const TX_STATUSES: LiveTransaction["status"][] = ["paid", "paid", "paid", "outstanding", "refunded"];

function seedTransactions() {
  if (_transactions.size > 0) return;
  _allPatients.slice(0, 60).forEach((p, i) => {
    const txId = `tx_seed_${p.id}_${i}`;
    const amounts = [1500, 4820, 15000, 3500, 85000, 7200, 12000, 900, 45000, 2800];
    _transactions.set(txId, {
      id: txId,
      patientDid: p.did,
      patientName: p.name,
      amount: amounts[i % amounts.length],
      category: TX_CATEGORIES[i % TX_CATEGORIES.length],
      status: TX_STATUSES[i % TX_STATUSES.length],
      date: new Date(Date.now() - i * 86400000 / 2).toLocaleDateString("en-IN"),
      reference: `REF-${(100000 + i * 7).toString(36).toUpperCase()}`,
    });
  });
}

// ---------------------------------------------------------------------------
// Store initialization
// ---------------------------------------------------------------------------
let _initialized = false;
let _livePatients: LivePatient[] = [];
let _liveStaff: LiveStaff[] = [];

export async function initializeStore(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  console.log("[Store] Initializing real-time hospital data store…");

  // Seed DIDs into blockchain (only on first run)
  await seedInitialDIDs(
    _allPatients.slice(0, 50).map((p) => ({ id: p.id, name: p.name, did: p.did })),
    _allStaff.slice(0, 30).map((s) => ({ id: s.id, name: s.name, did: s.did, role: s.role }))
  );

  const registry = getDIDRegistry();

  // Build live patient records
  _livePatients = _allPatients.map((p) => {
    const seed = parseInt(p.id.split("_")[1] || "1");
    const doc = registry[p.did] ?? null;
    return {
      ...p,
      didDocument: doc,
      activeCredentials: doc?.credentials.filter((c) => c.status === "active") ?? [],
      isOnChain: !!doc,
      lastActivity: new Date(Date.now() - seed * 600000).toLocaleString("en-IN"),
      vitals: generateVitals(seed),
    };
  });

  // Build live staff records
  _liveStaff = _allStaff.map((s, i) => {
    const doc = registry[s.did] ?? null;
    return {
      ...s,
      didDocument: doc,
      activeCredentials: doc?.credentials.filter((c) => c.status === "active") ?? [],
      isOnChain: !!doc,
      currentLocation: LOCATIONS[i % LOCATIONS.length],
      lastSignal: new Date(Date.now() - i * 180000).toLocaleTimeString("en-IN"),
      beaconStrength: `${70 + (i % 30)}%`,
    };
  });

  // Initialize sub-systems
  initStaffLocations(_allStaff);
  seedAppointments();
  seedTransactions();
  startVitalsSimulation(_livePatients);
  startStaffSimulation(_allStaff);

  emitStoreEvent("store:ready");
  console.log("[Store] Ready ✓");
}

// ---------------------------------------------------------------------------
// Public Accessors
// ---------------------------------------------------------------------------
export function getLivePatients(): LivePatient[] {
  const registry = getDIDRegistry();
  return _livePatients.map((p) => ({
    ...p,
    vitals: _vitals.get(p.id) ?? p.vitals,
    didDocument: registry[p.did] ?? p.didDocument,
    activeCredentials: (registry[p.did]?.credentials ?? p.activeCredentials).filter((c) => c.status === "active"),
    isOnChain: !!registry[p.did],
  }));
}

export function getLiveStaff(): LiveStaff[] {
  return _liveStaff.map((s) => {
    const loc = _staffLocations.get(s.id);
    return {
      ...s,
      currentLocation: loc?.location ?? s.currentLocation,
      lastSignal: loc?.lastSignal ?? s.lastSignal,
      beaconStrength: loc?.beacon ?? s.beaconStrength,
    };
  });
}

export function getLiveAppointments(): LiveAppointment[] {
  return Array.from(_appointments.values());
}

export function getLiveTransactions(): LiveTransaction[] {
  return Array.from(_transactions.values());
}

export function getPatientByDID(did: string): LivePatient | null {
  return getLivePatients().find((p) => p.did === did) ?? null;
}

export function getPatientByMRN(mrn: string): LivePatient | null {
  return getLivePatients().find((p) => p.mrn === mrn) ?? null;
}

// ---------------------------------------------------------------------------
// Appointment booking (records on blockchain)
// ---------------------------------------------------------------------------
export async function bookAppointment(
  patient: LivePatient,
  doctorDid: string,
  doctorName: string,
  specialty: string,
  slot: string,
  mode: "in-person" | "telemedicine"
): Promise<LiveAppointment> {
  const apptId = `appt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const proposal = await submitHyperledgerTransaction(
    "appointments-chaincode",
    "createAppointment",
    [apptId, patient.did, doctorDid, slot, mode]
  );

  const appt: LiveAppointment = {
    id: apptId,
    patientDid: patient.did,
    patientName: patient.name,
    doctorDid,
    doctorName,
    specialty,
    slot,
    mode,
    status: "confirmed",
    bookedAt: new Date().toLocaleString("en-IN"),
    blockTxId: proposal.txId,
  };

  _appointments.set(apptId, appt);
  emitStoreEvent("appointment:booked", appt);
  return appt;
}

// ---------------------------------------------------------------------------
// Payment recording (records on blockchain)
// ---------------------------------------------------------------------------
export async function recordPayment(
  patient: LivePatient,
  amount: number,
  category: LiveTransaction["category"]
): Promise<LiveTransaction> {
  const ref = `REF-${Date.now().toString(36).toUpperCase()}`;

  const proposal = await submitHyperledgerTransaction(
    "billing-chaincode",
    "recordPayment",
    [patient.did, patient.name, String(amount), category, ref]
  );

  const tx: LiveTransaction = {
    id: proposal.txId,
    patientDid: patient.did,
    patientName: patient.name,
    amount,
    category,
    status: "paid",
    date: new Date().toLocaleDateString("en-IN"),
    reference: ref,
    blockTxId: proposal.txId,
  };

  _transactions.set(tx.id, tx);
  emitStoreEvent("payment:recorded", tx);
  return tx;
}
