/**
 * Real-Time Hospital Data Store
 *
 * - Single source of truth for ALL live data
 * - Backed by Convex database & WebSocket synchronization
 * - Emits real-time events via custom EventTarget
 * - Handles local fallback when backend is offline
 *
 * ## Convex Integration
 *
 * This store now uses Convex as the primary data source instead of localStorage.
 *
 * ### Data Flow:
 * 1. **Initialization**: Fetches all patient/staff data from Convex on startup
 * 2. **Real-time Updates**: WebSocket events update local cache instantly
 * 3. **Persistence**: WebSocket updates can be synced back to Convex (see TODO comments)
 * 4. **Queries**: Uses ConvexHttpClient for direct database queries
 *
 * ### Key Changes:
 * - `getDIDRegistry()` → `fetchDIDsFromConvex()`: Fetch DIDs from Convex
 * - `rebuildLiveListsFromRegistry()` → `rebuildLiveListsFromConvex()`: Load from Convex
 * - `getLivePatients()`: Returns cached data (refresh from Convex as needed)
 * - `getLiveStaff()`: Returns cached data with real-time location updates
 * - New: `refreshFromConvex()`: Manually refresh all data
 * - New: `getPatientFromConvex()`: Fetch single patient directly from Convex
 * - New: `getStaffFromConvex()`: Fetch single staff directly from Convex
 *
 * ### TODO:
 * - Set NEXT_PUBLIC_CONVEX_URL in your .env.local
 * - Uncomment Convex sync code in handleStoreWebSocketMessage()
 * - Optionally add periodic refresh from Convex in getLivePatients/Staff
 */

import type { PatientFull } from "./types";
import type { StaffMember } from "./types";
import { isBackendOnline } from "./api";
import { ConvexHttpClient } from "convex/browser";

// TODO: Generate Convex API types by running: npx convex dev
// This will create convex/_generated/api.ts
// @ts-expect-error - Convex API will be generated
import { api } from "../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface DIDDocument {
  did: string;
  publicKey: string;
  controller: string;
  owner: string;
  ownerType: "patient" | "staff" | "device" | "org";
  status: "active" | "revoked" | "suspended";
  credentials: VerifiableCredential[];
  createdAt: string;
  updatedAt: string;
  serviceEndpoint?: string;
  ownerEmail?: string | null;
  // Extended metadata populated from backend DID registration
  name?: string;
  mrn?: string;
  age?: number;
  gender?: "M" | "F";
  bloodGroup?: string;
  allergies?: string[];
  phone?: string;
  employeeId?: string;
  role?: string;
  department?: string;
  specialty?: string;
}

export interface VerifiableCredential {
  id: string;
  type: "IdentityVC" | "InsuranceVC" | "VaccinationVC" | "ProfessionalVC" | "AccessVC";
  issuer: string;
  subject: string;
  issuedAt: string;
  expiresAt: string;
  claims: Record<string, string>;
  signature: string;
  status: "active" | "expired" | "revoked";
}

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

// Convex HTTP client for queries (since this is not a React component)
let _convexClient: ConvexHttpClient | null = null;

// Initialize Convex client
function getConvexClient(): ConvexHttpClient | null {
  if (!_convexClient) {
    const CONVEX_URL =
      process.env.NEXT_PUBLIC_CONVEX_URL ||
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_CONVEX_URL) ||
      "";
    if (!CONVEX_URL || (!CONVEX_URL.startsWith("http://") && !CONVEX_URL.startsWith("https://"))) {
      return null;
    }
    _convexClient = new ConvexHttpClient(CONVEX_URL);
  }
  return _convexClient;
}

// Base data — initialized empty, populated from Convex
const _allPatients: PatientFull[] = [];
const _allStaff: StaffMember[] = [];

// ---------------------------------------------------------------------------
// Real-time vital sign simulator (local fallback)
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

const _vitals: Map<string, LivePatient["vitals"]> = new Map();

function seedInitialVitals(patients: LivePatient[]) {
  patients.forEach((p) => {
    const seed = p.id.split("_")[1] ? parseInt(p.id.split("_")[1]) : 0;
    const initialVitals = generateVitals(seed);
    _vitals.set(p.id, initialVitals);
    _vitals.set(p.did, initialVitals);
  });
}

function runVitalsTick() {
  if (_wsConnected) return; // Use live WebSocket vitals when connected
  const inpatients = _livePatients.filter((p) => p.status === "inpatient").slice(0, 20);
  inpatients.forEach((p) => {
    const current = _vitals.get(p.id) ?? _vitals.get(p.did) ?? generateVitals(0);
    const updated = {
      heartRate: Math.max(
        40,
        Math.min(160, current.heartRate + Math.round((Math.random() - 0.5) * 6)),
      ),
      bp: `${Math.max(80, Math.min(180, parseInt(current.bp.split("/")[0]) + Math.round((Math.random() - 0.5) * 4)))}/${Math.max(50, Math.min(120, parseInt(current.bp.split("/")[1]) + Math.round((Math.random() - 0.5) * 3)))}`,
      spo2: Math.max(88, Math.min(100, current.spo2 + Math.round((Math.random() - 0.5) * 2))),
      temp: parseFloat(
        Math.max(35.0, Math.min(40.0, current.temp + (Math.random() - 0.5) * 0.2)).toFixed(1),
      ),
      respRate: Math.max(8, Math.min(30, current.respRate + Math.round((Math.random() - 0.5) * 2))),
    };
    _vitals.set(p.id, updated);
    _vitals.set(p.did, updated);
  });
  emitStoreEvent("vitals:update");
}

// ---------------------------------------------------------------------------
// Staff Location Simulator (local fallback)
// ---------------------------------------------------------------------------
const LOCATIONS = [
  "OPD Room 3",
  "ICU Block B",
  "Emergency Ward",
  "Operation Theatre 2",
  "Consultation Room 5",
  "Radiology Block",
  "Pharmacy Desk",
  "Nursing Station",
  "Conference Room 1",
  "Lab Wing A",
  "Cafeteria",
  "Admin Block",
];

const _staffLocations: Map<
  string,
  { location: string; status: string; lastSignal: string; beacon: string }
> = new Map();

function initStaffLocations(staff: StaffMember[]) {
  staff.forEach((s, i) => {
    _staffLocations.set(s.id, {
      location: s.onDuty ? LOCATIONS[i % LOCATIONS.length] : "Off Duty",
      status: s.onDuty
        ? i % 5 === 0
          ? "In Surgery"
          : i % 4 === 0
            ? "Emergency Response"
            : i % 3 === 0
              ? "In Consultation"
              : "Available"
        : "Off Duty",
      lastSignal: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      beacon: `${70 + (i % 30)}%`,
    });
  });
}

function runStaffTick() {
  // Disabled random tick overrides to keep room check-in locations persistent and accurate
  return;
}

// ---------------------------------------------------------------------------
// Live Appointments Store
// ---------------------------------------------------------------------------
const _appointments: Map<string, LiveAppointment> = new Map();

function seedAppointments() {
  // Appointments are fetched from backend API — no local seeding
  // Kept as no-op for initialization compatibility
}

// ---------------------------------------------------------------------------
// Live Transactions Store
// ---------------------------------------------------------------------------
const _transactions: Map<string, LiveTransaction> = new Map();

const TX_CATEGORIES: LiveTransaction["category"][] = [
  "consultation",
  "pharmacy",
  "lab",
  "room",
  "surgery",
];
const TX_STATUSES: LiveTransaction["status"][] = [
  "paid",
  "paid",
  "paid",
  "outstanding",
  "refunded",
];

function seedTransactions() {
  // Transactions are fetched from backend API — no local seeding
  // Kept as no-op for initialization compatibility
}

// ---------------------------------------------------------------------------
// Store initialization & WebSocket sync
// ---------------------------------------------------------------------------
let _initialized = false;
let _livePatients: LivePatient[] = [];
export const DEFAULT_FALLBACK_STAFF: LiveStaff[] = [
  {
    id: "doc_1",
    name: "Dr. Sarah Jenkins",
    role: "Doctor",
    department: "Cardiology",
    specialty: "Interventional Cardiology",
    did: "did:hosp:0x7a3f91b2c4e5d6a7",
    employeeId: "EMP-1001",
    currentLocation: "Room 101 - OPD",
    status: "In Consultation",
    beaconStrength: "96%",
    lastSignal: new Date().toLocaleTimeString(),
    onDuty: true,
    isOnChain: true,
    activeCredentials: [
      { id: "vc_1_1", type: "ProfessionalVC" },
      { id: "vc_1_2", type: "AccessVC" },
    ],
  },
  {
    id: "doc_2",
    name: "Dr. Rajesh Sharma",
    role: "Doctor",
    department: "Neurology",
    specialty: "Neuro-oncology",
    did: "did:hosp:0x8b2e41a3f5c6d7e8",
    employeeId: "EMP-1002",
    currentLocation: "Room 202 - Cardiology",
    status: "Available",
    beaconStrength: "91%",
    lastSignal: new Date().toLocaleTimeString(),
    onDuty: true,
    isOnChain: true,
    activeCredentials: [
      { id: "vc_2_1", type: "ProfessionalVC" },
      { id: "vc_2_2", type: "AccessVC" },
    ],
  },
  {
    id: "doc_3",
    name: "Dr. Priya Patel",
    role: "Doctor",
    department: "Pediatrics",
    specialty: "Pediatric Critical Care",
    did: "did:hosp:0x9c1d52b4e6f7a8b9",
    employeeId: "EMP-1003",
    currentLocation: "Room 303 - Operation Theatre",
    status: "In Surgery",
    beaconStrength: "88%",
    lastSignal: new Date().toLocaleTimeString(),
    onDuty: true,
    isOnChain: true,
    activeCredentials: [
      { id: "vc_3_1", type: "ProfessionalVC" },
      { id: "vc_3_2", type: "AccessVC" },
    ],
  },
  {
    id: "doc_4",
    name: "Dr. Amit Varma",
    role: "Doctor",
    department: "Orthopedics",
    specialty: "Joint Replacement Surgery",
    did: "did:hosp:0x4d5e63c7f8a9b0c1",
    employeeId: "EMP-1004",
    currentLocation: "Room 404 - Emergency Room",
    status: "Emergency Response",
    beaconStrength: "94%",
    lastSignal: new Date().toLocaleTimeString(),
    onDuty: true,
    isOnChain: true,
    activeCredentials: [
      { id: "vc_4_1", type: "ProfessionalVC" },
      { id: "vc_4_2", type: "AccessVC" },
    ],
  },
  {
    id: "doc_5",
    name: "Dr. Ananya Iyer",
    role: "Doctor",
    department: "Oncology",
    specialty: "Medical Oncology",
    did: "did:hosp:0x6f7a81b2c3d4e5f6",
    employeeId: "EMP-1005",
    currentLocation: "Room 505 - ICU Desk",
    status: "In Consultation",
    beaconStrength: "92%",
    lastSignal: new Date().toLocaleTimeString(),
    onDuty: true,
    isOnChain: true,
    activeCredentials: [
      { id: "vc_5_1", type: "ProfessionalVC" },
      { id: "vc_5_2", type: "AccessVC" },
    ],
  },
  {
    id: "doc_6",
    name: "Dr. Marcus Vance",
    role: "Doctor",
    department: "Emergency Medicine",
    specialty: "Trauma Care",
    did: "did:hosp:0x1b2c3d4e5f6a7b8c",
    employeeId: "EMP-1006",
    currentLocation: "Emergency Bay 1",
    status: "Emergency Response",
    beaconStrength: "97%",
    lastSignal: new Date().toLocaleTimeString(),
    onDuty: true,
    isOnChain: true,
    activeCredentials: [
      { id: "vc_6_1", type: "ProfessionalVC" },
      { id: "vc_6_2", type: "AccessVC" },
    ],
  },
  {
    id: "doc_7",
    name: "Dr. Elena Rostova",
    role: "Doctor",
    department: "Anesthesiology",
    specialty: "Surgical Anesthesia",
    did: "did:hosp:0x3d4e5f6a7b8c9d0e",
    employeeId: "EMP-1007",
    currentLocation: "OT Suite 2",
    status: "In Surgery",
    beaconStrength: "89%",
    lastSignal: new Date().toLocaleTimeString(),
    onDuty: true,
    isOnChain: true,
    activeCredentials: [
      { id: "vc_7_1", type: "ProfessionalVC" },
      { id: "vc_7_2", type: "AccessVC" },
    ],
  },
];

let _liveStaff: LiveStaff[] = [...DEFAULT_FALLBACK_STAFF];
let _wsConnected = false;
let _socket: WebSocket | null = null;

/**
 * Fetch DIDs from Convex database
 * Replaces the old getDIDRegistry() that used localStorage
 */
async function fetchDIDsFromConvex(): Promise<Record<string, DIDDocument>> {
  // TODO: Implement Convex query to fetch DIDs
  try {
    const client = getConvexClient();
    const dids = await client.query(api.records.getDIDs);
    const credentials = await client.query(api.records.getCredentials);

    // Build registry mapping DID -> DIDDocument
    const registry: Record<string, DIDDocument> = {};

    for (const did of dids) {
      const relatedCredentials = credentials.filter((c: any) => c.subject === did.did);
      registry[did.did] = {
        did: did.did,
        publicKey: did.publicKey,
        controller: did.controller,
        owner: did.owner,
        ownerType: did.ownerType as "patient" | "staff" | "device" | "org",
        status: did.status as "active" | "revoked" | "suspended",
        credentials: relatedCredentials.map((c: any) => ({
          id: c.id,
          type: c.type as any,
          issuer: c.issuer,
          subject: c.subject,
          issuedAt: c.issuedAt,
          expiresAt: c.expiresAt,
          claims: c.claims || {},
          signature: c.signature,
          status: c.status as "active" | "expired" | "revoked",
        })),
        createdAt: did.createdAt,
        updatedAt: did.updatedAt,
        serviceEndpoint: did.serviceEndpoint,
      };
    }

    return registry;
  } catch (error) {
    console.error("[Store] Error fetching DIDs from Convex:", error);
    return {};
  }
}

function hashInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Rebuild live lists from Convex database
 * Replaces the old rebuildLiveListsFromRegistry() that used localStorage
 */
export async function rebuildLiveListsFromConvex() {
  try {
    const client = getConvexClient();
    if (!client) return;

    // Fetch patients and staff from Convex
    const patientsData = await client.query(api.records.getPatients, {});
    const staffData = await client.query(api.records.getStaff, {});
    const didsData = await client.query(api.records.getDIDs);
    const credentialsData = await client.query(api.records.getCredentials);

    // Build DID registry for quick lookups
    const registry: Record<string, DIDDocument> = {};
    for (const did of didsData) {
      const relatedCredentials = credentialsData.filter((c: any) => c.subject === did.did);
      registry[did.did] = {
        did: did.did,
        publicKey: did.publicKey,
        controller: did.controller,
        owner: did.owner,
        ownerType: did.ownerType as "patient" | "staff" | "device" | "org",
        status: did.status as "active" | "revoked" | "suspended",
        credentials: relatedCredentials.map((c: any) => ({
          id: c.id,
          type: c.type as any,
          issuer: c.issuer,
          subject: c.subject,
          issuedAt: c.issuedAt,
          expiresAt: c.expiresAt,
          claims: c.claims || {},
          signature: c.signature,
          status: c.status as "active" | "expired" | "revoked",
        })),
        createdAt: did.createdAt,
        updatedAt: did.updatedAt,
        serviceEndpoint: did.serviceEndpoint,
      };
    }

    const patientsTemp: LivePatient[] = [];
    const staffTemp: LiveStaff[] = [];

    // Build LivePatient objects from Convex data
    for (const patient of patientsData) {
      const doc = registry[patient.did];
      patientsTemp.push({
        id: patient.patientId,
        did: patient.did,
        name: patient.name,
        mrn: patient.mrn,
        age: patient.age,
        gender: patient.gender as "M" | "F",
        bloodGroup: patient.bloodGroup,
        allergies: patient.allergies,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        dob: patient.dob,
        ward: patient.ward,
        bed: patient.bed,
        admitDate: patient.admitDate,
        status: patient.status as any,
        primaryDoctor: patient.primaryDoctor,
        conditions: patient.conditions,
        insuranceProvider: patient.insuranceProvider,
        insurancePolicyNo: patient.insurancePolicyNo,
        emergencyContact: patient.emergencyContact,
        organDonor: patient.organDonor,
        nationality: patient.nationality,
        totalVisits: patient.totalVisits,
        outstandingBills: patient.outstandingBills,
        didDocument: doc || null,
        activeCredentials: doc?.credentials?.filter((c) => c.status === "active") ?? [],
        isOnChain: !!doc,
        lastActivity: patient.updatedAt || new Date().toLocaleString("en-IN"),
        vitals: _vitals.get(patient.did) ?? {
          heartRate: 72,
          bp: "120/80",
          spo2: 98,
          temp: 36.6,
          respRate: 16,
        },
      });
    }

    // Build LiveStaff objects from Convex data
    for (const staff of staffData) {
      const doc = registry[staff.did];
      staffTemp.push({
        id: staff.staffId,
        did: staff.did,
        name: staff.name,
        employeeId: staff.employeeId,
        role: staff.role as any,
        department: staff.department,
        specialty: staff.specialty,
        email: staff.email,
        phone: staff.phone,
        shift: staff.shift as any,
        onDuty: staff.onDuty,
        joinedDate: staff.joinedDate,
        status: staff.status as any,
        credentials: staff.credentials,
        patientsToday: staff.patientsToday,
        didDocument: doc || null,
        activeCredentials: doc?.credentials?.filter((c) => c.status === "active") ?? [],
        isOnChain: !!doc,
        currentLocation:
          (staff.currentLocation || _staffLocations.get(staff.did)?.location) ?? "Nursing Station",
        lastSignal:
          (staff.lastSignal || _staffLocations.get(staff.did)?.lastSignal) ??
          new Date().toLocaleTimeString("en-IN"),
        beaconStrength: (staff.beaconStrength || _staffLocations.get(staff.did)?.beacon) ?? "90%",
      });
    }

    _livePatients = patientsTemp;
    _liveStaff = staffTemp;

    console.debug(
      `[Store] Loaded ${_livePatients.length} patients and ${_liveStaff.length} staff from Convex`,
    );
  } catch (error) {
    console.error("[Store] Error rebuilding lists from Convex:", error);
    // Fallback to empty lists if Convex fetch fails
    _livePatients = [];
    _liveStaff = _liveStaff.length > 0 ? _liveStaff : [...DEFAULT_FALLBACK_STAFF];
  }
}

/**
 * Handle WebSocket messages and sync with Convex
 * Updates local cache and persists to Convex database
 */
function handleStoreWebSocketMessage(event: string, data: any) {
  if (event === "vitals:update") {
    if (Array.isArray(data)) {
      data.forEach(async (update) => {
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

            try {
              const client = getConvexClient();
              await client.mutation(api.records.updatePatientVitals, {
                patientDid: patient.did,
                vitals: {
                  heartRate: mappedVitals.heartRate,
                  bloodPressure: {
                    systolic: parseInt(mappedVitals.bp.split("/")[0]),
                    diastolic: parseInt(mappedVitals.bp.split("/")[1]),
                  },
                  temperature: mappedVitals.temp,
                  respiratoryRate: mappedVitals.respRate,
                  oxygenSaturation: mappedVitals.spo2,
                },
                txId: `ws_${Date.now()}`,
                version: "1.0",
                recordedAt: new Date().toISOString(),
              });
            } catch (error) {
              console.error("[Store] Error syncing vitals to Convex:", error);
            }
          }
        }
      });
      emitStoreEvent("vitals:update");
    }
  } else if (event === "staff:location") {
    const { id, location, lastSignal } = data;
    const staffMember = _liveStaff.find((s) => s.did === id || s.id === id);
    if (staffMember) {
      const newStatus =
        location === "Operation Theatre 2" || location === "OR Suite 2"
          ? "In Surgery"
          : location === "Emergency Ward"
            ? "Emergency Response"
            : location === "ICU Block B"
              ? "In Consultation"
              : "Available";
      const now = lastSignal
        ? new Date(lastSignal).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        : new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
      const beaconStrength = `${70 + Math.floor(Math.random() * 30)}%`;
      _staffLocations.set(staffMember.id, {
        location,
        status: newStatus,
        lastSignal: now,
        beacon: beaconStrength,
      });

      (async () => {
        try {
          const client = getConvexClient();
          await client.mutation(api.records.updateStaffLocation, {
            did: staffMember.did,
            location,
            beaconStrength,
            txId: `ws_${Date.now()}`,
            version: "1.0",
          });
        } catch (error) {
          console.error("[Store] Error syncing staff location to Convex:", error);
        }
      })();

      emitStoreEvent("staff:location:update", {
        memberId: staffMember.id,
        location,
        status: newStatus,
      });
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
        bookedAt: appt.bookedAt
          ? new Date(appt.bookedAt).toLocaleString("en-IN")
          : new Date().toLocaleString("en-IN"),
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
        date: tx.settledAt
          ? new Date(tx.settledAt).toLocaleDateString("en-IN")
          : new Date().toLocaleDateString("en-IN"),
        reference: tx.ref,
      });
      emitStoreEvent("store:ready");
    }
  } else if (event === "did:created" || event === "did:updated") {
    const doc = data;
    if (doc && doc.did) {
      (async () => {
        try {
          await rebuildLiveListsFromConvex();
          emitStoreEvent("store:ready");
        } catch (error) {
          console.error("[Store] Error syncing DID to Convex:", error);
        }
      })();
    }
  }
}

function setupWebSocket() {
  if (typeof window === "undefined") return;
  if (_socket && _socket.readyState < 2) return;

  const wsUrl = "ws://localhost:3001";
  try {
    const socket = new WebSocket(wsUrl);
    _socket = socket;

    socket.onopen = async () => {
      _wsConnected = true;
      storeEvents.dispatchEvent(new CustomEvent("ws:status", { detail: true }));
      // TODO: Sync with Convex on WebSocket connection
      // Rebuild lists from Convex when connection is established
      try {
        await rebuildLiveListsFromConvex();
        emitStoreEvent("store:ready");
      } catch (error) {
        console.error("[Store] Error syncing with Convex on WebSocket connect:", error);
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        storeEvents.dispatchEvent(new CustomEvent("ws:message", { detail: msg }));
        handleStoreWebSocketMessage(msg.event, msg.data);
      } catch (err) {
        // Silently capture parsing errors
      }
    };

    socket.onclose = () => {
      _wsConnected = false;
      storeEvents.dispatchEvent(new CustomEvent("ws:status", { detail: false }));
      _socket = null;
      setTimeout(setupWebSocket, 5000); // Reconnect after 5 seconds
    };
  } catch (err) {
    _socket = null;
    _wsConnected = false;
    setTimeout(setupWebSocket, 5000);
  }
}

export function getWorkerConnected(): boolean {
  return _wsConnected;
}

export async function initializeStore(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  console.debug("[Store] Initializing real-time hospital data store…");

  // TODO: Rebuild lists from Convex instead of localStorage
  await rebuildLiveListsFromConvex();

  // Initialize sub-systems
  initStaffLocations(_liveStaff);
  seedAppointments();
  seedTransactions();
  seedInitialVitals(_livePatients);

  // Setup WS connection
  setupWebSocket();

  // Run local backup simulators when WebSocket is disconnected
  setInterval(runVitalsTick, 5000);
  setInterval(runStaffTick, 8000);

  emitStoreEvent("store:ready");
  console.debug("[Store] Ready ✓");
}

// ---------------------------------------------------------------------------
// Public Accessors
// ---------------------------------------------------------------------------
/**
 * Get live patients with real-time vitals
 * Now returns data from Convex + local real-time updates
 */
export function getLivePatients(): LivePatient[] {
  // TODO: Optionally refresh from Convex periodically
  return _livePatients.map((p) => {
    return {
      ...p,
      vitals: _vitals.get(p.id) ?? _vitals.get(p.did) ?? p.vitals,
    };
  });
}

/**
 * Get live staff with real-time location tracking
 * Now returns data from Convex + local real-time updates
 */
export function getLiveStaff(): LiveStaff[] {
  // TODO: Optionally refresh from Convex periodically
  return _liveStaff.map((s) => {
    const loc = _staffLocations.get(s.id) ?? _staffLocations.get(s.did);
    return {
      ...s,
      currentLocation: loc?.location ?? s.currentLocation,
      lastSignal: loc?.lastSignal ?? s.lastSignal,
      beaconStrength: loc?.beacon ?? s.beaconStrength,
    };
  });
}

export function updateStaffLocation(idOrDid: string, location: string, status?: string) {
  const staffMember = _liveStaff.find(
    (s) => s.did === idOrDid || s.id === idOrDid || s.email === idOrDid || s.name === idOrDid
  );
  const targetId = staffMember ? staffMember.id : idOrDid;
  const locLower = location.toLowerCase();
  const newStatus =
    status ??
    (locLower.includes("surgery") || locLower.includes("ot")
      ? "In Surgery"
      : locLower.includes("emergency") || locLower.includes("er")
        ? "Emergency Response"
        : locLower.includes("off duty") || locLower.includes("exited")
          ? "Off Duty"
          : "In Consultation");

  const now = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  _staffLocations.set(targetId, {
    location,
    status: newStatus,
    lastSignal: now,
    beacon: `${80 + Math.floor(Math.random() * 20)}%`,
  });

  if (staffMember) {
    staffMember.currentLocation = location;
    staffMember.status = newStatus as any;
    staffMember.lastSignal = now;
    _staffLocations.set(staffMember.did, {
      location,
      status: newStatus,
      lastSignal: now,
      beacon: `${80 + Math.floor(Math.random() * 20)}%`,
    });
  }

  emitStoreEvent("staff:location:update", {
    memberId: targetId,
    location,
    status: newStatus,
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

/**
 * Manually refresh all data from Convex
 * Useful for forcing a sync when needed
 */
export async function refreshFromConvex(): Promise<void> {
  try {
    console.debug("[Store] Manually refreshing data from Convex...");
    await rebuildLiveListsFromConvex();
    emitStoreEvent("store:refreshed");
    console.debug("[Store] Refresh complete");
  } catch (error) {
    console.error("[Store] Error refreshing from Convex:", error);
    throw error;
  }
}

/**
 * Get a specific patient from Convex by DID
 * Bypasses local cache and fetches directly from Convex
 */
export async function getPatientFromConvex(did: string): Promise<LivePatient | null> {
  try {
    const client = getConvexClient();
    const patient = await client.query(api.records.getPatientByDID, { did });
    if (!patient) return null;

    const didDoc = await client.query(api.records.getDIDByURI, { did });
    const credentials = await client.query(api.records.getCredentials);
    const relatedCredentials = credentials.filter((c: any) => c.subject === did);

    const doc: DIDDocument | null = didDoc
      ? {
          did: didDoc.did,
          publicKey: didDoc.publicKey,
          controller: didDoc.controller,
          owner: didDoc.owner,
          ownerType: didDoc.ownerType as "patient" | "staff" | "device" | "org",
          status: didDoc.status as "active" | "revoked" | "suspended",
          credentials: relatedCredentials.map((c: any) => ({
            id: c.id,
            type: c.type as any,
            issuer: c.issuer,
            subject: c.subject,
            issuedAt: c.issuedAt,
            expiresAt: c.expiresAt,
            claims: c.claims || {},
            signature: c.signature,
            status: c.status as "active" | "expired" | "revoked",
          })),
          createdAt: didDoc.createdAt,
          updatedAt: didDoc.updatedAt,
          serviceEndpoint: didDoc.serviceEndpoint,
        }
      : null;

    return {
      id: patient.patientId,
      did: patient.did,
      name: patient.name,
      mrn: patient.mrn,
      age: patient.age,
      gender: patient.gender as "M" | "F",
      bloodGroup: patient.bloodGroup,
      allergies: patient.allergies,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      dob: patient.dob,
      ward: patient.ward,
      bed: patient.bed,
      admitDate: patient.admitDate,
      status: patient.status as any,
      primaryDoctor: patient.primaryDoctor,
      conditions: patient.conditions,
      insuranceProvider: patient.insuranceProvider,
      insurancePolicyNo: patient.insurancePolicyNo,
      emergencyContact: patient.emergencyContact,
      organDonor: patient.organDonor,
      nationality: patient.nationality,
      totalVisits: patient.totalVisits,
      outstandingBills: patient.outstandingBills,
      didDocument: doc,
      activeCredentials: doc?.credentials?.filter((c) => c.status === "active") ?? [],
      isOnChain: !!doc,
      lastActivity: patient.updatedAt || new Date().toLocaleString("en-IN"),
      vitals: _vitals.get(patient.did) ?? {
        heartRate: 72,
        bp: "120/80",
        spo2: 98,
        temp: 36.6,
        respRate: 16,
      },
    };
  } catch (error) {
    console.error("[Store] Error fetching patient from Convex:", error);
    return null;
  }
}

/**
 * Get a specific staff member from Convex by DID
 * Bypasses local cache and fetches directly from Convex
 */
export async function getStaffFromConvex(did: string): Promise<LiveStaff | null> {
  try {
    const client = getConvexClient();
    const staff = await client.query(api.records.getStaffByDID, { did });
    if (!staff) return null;

    const didDoc = await client.query(api.records.getDIDByURI, { did });
    const credentials = await client.query(api.records.getCredentials);
    const relatedCredentials = credentials.filter((c: any) => c.subject === did);

    const doc: DIDDocument | null = didDoc
      ? {
          did: didDoc.did,
          publicKey: didDoc.publicKey,
          controller: didDoc.controller,
          owner: didDoc.owner,
          ownerType: didDoc.ownerType as "patient" | "staff" | "device" | "org",
          status: didDoc.status as "active" | "revoked" | "suspended",
          credentials: relatedCredentials.map((c: any) => ({
            id: c.id,
            type: c.type as any,
            issuer: c.issuer,
            subject: c.subject,
            issuedAt: c.issuedAt,
            expiresAt: c.expiresAt,
            claims: c.claims || {},
            signature: c.signature,
            status: c.status as "active" | "expired" | "revoked",
          })),
          createdAt: didDoc.createdAt,
          updatedAt: didDoc.updatedAt,
          serviceEndpoint: didDoc.serviceEndpoint,
        }
      : null;

    return {
      id: staff.staffId,
      did: staff.did,
      name: staff.name,
      employeeId: staff.employeeId,
      role: staff.role as any,
      department: staff.department,
      specialty: staff.specialty,
      email: staff.email,
      phone: staff.phone,
      shift: staff.shift as any,
      onDuty: staff.onDuty,
      joinedDate: staff.joinedDate,
      status: staff.status as any,
      credentials: staff.credentials,
      patientsToday: staff.patientsToday,
      didDocument: doc,
      activeCredentials: doc?.credentials?.filter((c) => c.status === "active") ?? [],
      isOnChain: !!doc,
      currentLocation: staff.currentLocation || "Unknown",
      lastSignal: staff.lastSignal || new Date().toLocaleTimeString("en-IN"),
      beaconStrength: staff.beaconStrength || "0%",
    };
  } catch (error) {
    console.error("[Store] Error fetching staff from Convex:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Appointment booking
// ---------------------------------------------------------------------------
export async function bookAppointment(
  patient: LivePatient,
  doctorDid: string,
  doctorName: string,
  specialty: string,
  slot: string,
  mode: "in-person" | "telemedicine",
): Promise<LiveAppointment> {
  const apptId = `appt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const online = await isBackendOnline();
  if (online) {
    try {
      const { bookAppointment } = await import("./api");
      await bookAppointment({
        patientDid: patient.did,
        patientName: patient.name,
        doctorDid,
        doctorName,
        slot,
        mode,
        specialty,
      });
    } catch (err) {
      console.warn("Backend book appointment failed:", err);
    }
  }

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
  };

  _appointments.set(apptId, appt);
  emitStoreEvent("appointment:booked", appt);
  return appt;
}

// ---------------------------------------------------------------------------
// Payment recording
// ---------------------------------------------------------------------------
export async function recordPayment(
  patient: LivePatient,
  amount: number,
  category: LiveTransaction["category"],
): Promise<LiveTransaction> {
  const ref = `REF-${Date.now().toString(36).toUpperCase()}`;

  const online = await isBackendOnline();
  let txId = `tx_${Date.now()}_local`;
  if (online) {
    try {
      const { recordPayment } = await import("./api");
      const res = (await recordPayment({
        patientDid: patient.did,
        patientName: patient.name,
        amount,
        category,
      })) as any;
      if (res && res.txId) txId = res.txId;
    } catch (err) {
      console.warn("Backend payment failed:", err);
    }
  }

  const tx: LiveTransaction = {
    id: txId,
    patientDid: patient.did,
    patientName: patient.name,
    amount,
    category,
    status: "paid",
    date: new Date().toLocaleDateString("en-IN"),
    reference: ref,
  };

  _transactions.set(tx.id, tx);
  emitStoreEvent("payment:recorded", tx);
  return tx;
}
