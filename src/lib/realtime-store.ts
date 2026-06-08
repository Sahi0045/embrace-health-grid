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
import { isFabricOnline, FABRIC_BASE } from "./fabric-api";

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
// Store initialization & WebSockets
// ---------------------------------------------------------------------------
let _initialized = false;
let _livePatients: LivePatient[] = [];
let _liveStaff: LiveStaff[] = [];
let _storeWs: WebSocket | null = null;

function hashInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function rebuildLiveListsFromRegistry() {
  const registry = getDIDRegistry();
  const patientsTemp: LivePatient[] = [];
  const staffTemp: LiveStaff[] = [];

  Object.keys(registry).forEach((did) => {
    const doc = registry[did];
    if (!doc) return;
    const name = doc.owner || doc.subject || "Unknown";
    const type = doc.ownerType || doc.type || "patient";

    if (type === "patient") {
      const seed = Math.abs(hashInt(did));
      patientsTemp.push({
        id: `pat_${seed.toString().slice(0, 4)}`,
        did: did,
        name: name,
        mrn: doc.credentials?.find((c: any) => c.type === "IdentityVC" || c.claims?.mrn)?.claims?.mrn || `MRN-${200000 + (seed % 100000)}`,
        age: 18 + (seed % 70),
        gender: seed % 2 === 0 ? "M" : "F",
        bloodGroup: (doc.credentials?.find((c: any) => c.type === "IdentityVC" || c.claims?.bloodGroup)?.claims?.bloodGroup || "O+") as any,
        allergies: [],
        phone: `+91 9${seed.toString().slice(0, 9).padEnd(9, "0")}`,
        email: `${name.toLowerCase().replace(/\s+/g, ".")}@email.com`,
        address: `${100 + (seed % 900)}, Landmark Street, Mumbai`,
        dob: `${1950 + (18 + (seed % 70))}-01-01`,
        ward: "General Ward",
        bed: `B-${seed % 100}`,
        admitDate: new Date().toISOString().slice(0, 10),
        status: "outpatient",
        primaryDoctor: "Dr. Ravi Menon",
        conditions: [],
        insuranceProvider: "None",
        insurancePolicyNo: "",
        emergencyContact: { name: "Guardian", relation: "Spouse", phone: "" },
        organDonor: false,
        nationality: "Indian",
        didDocument: doc,
        activeCredentials: doc.credentials?.filter((c: any) => c.status === "active") ?? [],
        isOnChain: true,
        lastActivity: new Date().toLocaleString("en-IN"),
        vitals: _vitals.get(did) ?? { heartRate: 72, bp: "120/80", spo2: 98, temp: 36.6, respRate: 16 }
      });
    } else {
      const seed = Math.abs(hashInt(did));
      staffTemp.push({
        id: `staff_${seed.toString().slice(0, 4)}`,
        did: did,
        name: name,
        employeeId: `EMP-${1000 + (seed % 10000)}`,
        role: (doc.ownerType === "staff" || doc.type === "staff" ? "Nurse" : (doc.ownerType || doc.type)) as any,
        department: "General Medicine",
        specialty: "General Medicine",
        email: `${name.toLowerCase().replace(/\s+/g, ".")}@apollohospitals.in`,
        phone: `+91 9${seed.toString().slice(0, 9).padEnd(9, "0")}`,
        shift: "morning",
        onDuty: true,
        joinedDate: new Date().toISOString().slice(0, 10),
        status: "active",
        credentials: doc.credentials?.length || 0,
        patientsToday: 0,
        didDocument: doc,
        activeCredentials: doc.credentials?.filter((c: any) => c.status === "active") ?? [],
        isOnChain: true,
        currentLocation: _staffLocations.get(did)?.location ?? "Nursing Station",
        lastSignal: _staffLocations.get(did)?.lastSignal ?? new Date().toLocaleTimeString("en-IN"),
        beaconStrength: _staffLocations.get(did)?.beacon ?? "90%",
      });
    }
  });

  _livePatients = patientsTemp;
  _liveStaff = staffTemp;
}

function handleStoreWebSocketMessage(event: string, data: any) {
  if (event === "vitals:update") {
    if (Array.isArray(data)) {
      data.forEach((update) => {
        if (update && update.id) {
          const mappedVitals = {
            heartRate: update.heartRate,
            bp: update.bp,
            spo2: update.spo2,
            temp: update.temp,
            respRate: update.respRate,
          };
          _vitals.set(update.id, mappedVitals);
          const patient = _livePatients.find((p) => p.did === update.id || p.id === update.id);
          if (patient) {
            _vitals.set(patient.id, mappedVitals);
          }
        }
      });
      emitStoreEvent("vitals:update");
    }
  } else if (event === "staff:location") {
    const { id, location, lastSignal } = data;
    const staffMember = _liveStaff.find((s) => s.did === id || s.id === id);
    if (staffMember) {
      const newStatus = location === "Operation Theatre 2" || location === "OR Suite 2" ? "In Surgery"
        : location === "Emergency Ward" ? "Emergency Response"
        : location === "ICU Block B" ? "In Consultation"
        : "Available";
      const now = lastSignal ? new Date(lastSignal).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      _staffLocations.set(staffMember.id, {
        location,
        status: newStatus,
        lastSignal: now,
        beacon: `${70 + Math.floor(Math.random() * 30)}%`
      });
      emitStoreEvent("staff:location:update", { memberId: staffMember.id, location, status: newStatus });
    }
  } else if (event === "appointment:booked") {
    const appt = data;
    if (appt && appt.apptId) {
      _appointments.set(appt.apptId, {
        id: appt.apptId,
        patientDid: appt.patientDid,
        patientName: appt.patientName,
        doctorDid: appt.doctorDid,
        doctorName: appt.doctorName,
        specialty: appt.specialty || "General Medicine",
        slot: appt.slot,
        mode: appt.mode,
        status: appt.status || "confirmed",
        bookedAt: appt.bookedAt ? new Date(appt.bookedAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN"),
      });
      emitStoreEvent("store:ready");
    }
  } else if (event === "payment:recorded") {
    const tx = data;
    if (tx && tx.ref) {
      _transactions.set(tx.txId || tx.ref, {
        id: tx.txId || tx.ref,
        patientDid: tx.patientDid,
        patientName: tx.patientName,
        amount: tx.amount,
        category: tx.category,
        status: tx.status === "settled" ? "paid" : "outstanding",
        date: tx.settledAt ? new Date(tx.settledAt).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"),
        reference: tx.ref,
      });
      emitStoreEvent("store:ready");
    }
  } else if (event === "did:created" || event === "did:updated") {
    const doc = data;
    if (doc && doc.did) {
      const registry = getDIDRegistry();
      registry[doc.did] = doc;
      localStorage.setItem("hl:didregistry", JSON.stringify(registry));
      rebuildLiveListsFromRegistry();
      emitStoreEvent("store:ready");
    }
  }
}

function connectStoreWebSocket() {
  if (typeof window === "undefined") return;
  if (_storeWs && _storeWs.readyState < 2) return;

  try {
    const wsUrl = FABRIC_BASE.replace("http", "ws");
    _storeWs = new WebSocket(wsUrl);
    _storeWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { event: string; data: any };
        handleStoreWebSocketMessage(msg.event, msg.data);
      } catch {}
    };
    _storeWs.onerror = () => {};
    _storeWs.onclose = () => {
      setTimeout(connectStoreWebSocket, 5000);
    };
  } catch {
    _storeWs = null;
    setTimeout(connectStoreWebSocket, 5000);
  }
}

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

  // Sync from server if online
  const online = await isFabricOnline();
  if (online) {
    try {
      const { fabricGetAllDIDs, fabricGetAppointments, fabricGetNamespace } = await import("./fabric-api");
      
      // 1. Sync DIDs
      const { dids } = await fabricGetAllDIDs();
      dids.forEach((d: any) => {
        if (d && d.did) registry[d.did] = d;
      });
      localStorage.setItem("hl:didregistry", JSON.stringify(registry));

      // 2. Sync Appointments
      const { appointments } = await fabricGetAppointments();
      appointments.forEach((appt: any) => {
        if (appt && appt.apptId) {
          _appointments.set(appt.apptId, {
            id: appt.apptId,
            patientDid: appt.patientDid,
            patientName: appt.patientName,
            doctorDid: appt.doctorDid,
            doctorName: appt.doctorName,
            specialty: appt.specialty || "General Medicine",
            slot: appt.slot,
            mode: appt.mode,
            status: appt.status || "confirmed",
            bookedAt: appt.bookedAt ? new Date(appt.bookedAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN"),
          });
        }
      });

      // 3. Sync Billing transactions
      const payments = await fabricGetNamespace("billing");
      payments.forEach((p: any) => {
        const tx = p.value;
        if (tx && tx.ref) {
          _transactions.set(tx.txId || tx.ref, {
            id: tx.txId || tx.ref,
            patientDid: tx.patientDid,
            patientName: tx.patientName,
            amount: tx.amount,
            category: tx.category,
            status: tx.status === "settled" ? "paid" : "outstanding",
            date: tx.settledAt ? new Date(tx.settledAt).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"),
            reference: tx.ref,
          });
        }
      });
    } catch (err) {
      console.warn("⚠️ Failed to sync live store state from Fabric server:", err);
    }
  }

  // Build live records dynamically from DID Registry
  rebuildLiveListsFromRegistry();

  // Initialize sub-systems
  initStaffLocations(_liveStaff);
  seedAppointments();
  seedTransactions();
  startVitalsSimulation(_livePatients);
  startStaffSimulation(_liveStaff);

  // Connect WebSocket to stay updated in real time
  connectStoreWebSocket();

  emitStoreEvent("store:ready");
  console.log("[Store] Ready ✓");
}

// ---------------------------------------------------------------------------
// Public Accessors
// ---------------------------------------------------------------------------
export function getLivePatients(): LivePatient[] {
  const registry = getDIDRegistry();
  return _livePatients.map((p) => {
    const doc = registry[p.did] ?? p.didDocument;
    return {
      ...p,
      vitals: _vitals.get(p.id) ?? _vitals.get(p.did) ?? p.vitals,
      didDocument: doc,
      activeCredentials: (doc?.credentials ?? p.activeCredentials).filter((c) => c.status === "active"),
      isOnChain: !!doc,
    };
  });
}

export function getLiveStaff(): LiveStaff[] {
  const registry = getDIDRegistry();
  return _liveStaff.map((s) => {
    const loc = _staffLocations.get(s.id) ?? _staffLocations.get(s.did);
    const doc = registry[s.did] ?? s.didDocument;
    return {
      ...s,
      currentLocation: loc?.location ?? s.currentLocation,
      lastSignal: loc?.lastSignal ?? s.lastSignal,
      beaconStrength: loc?.beacon ?? s.beaconStrength,
      didDocument: doc,
      activeCredentials: (doc?.credentials ?? s.activeCredentials).filter((c) => c.status === "active"),
      isOnChain: !!doc,
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
