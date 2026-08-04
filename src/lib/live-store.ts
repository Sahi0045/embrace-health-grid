/**
 * Live store — Supabase-backed replacement for realtime-store.ts
 *
 * The original was 1,423 lines wrapping an Express WebSocket plus a Convex
 * mirror, with fallback simulators for when the socket was down. Consumers only
 * ever used three things from it:
 *
 *   initializeStore()  bootstrap on app start
 *   getLiveStaff()     current staff roster
 *   storeEvents        an EventTarget components subscribe to
 *
 * Everything else was internal machinery for a transport that no longer exists.
 * Live updates now arrive through Supabase Realtime (see hooks/use-realtime.ts),
 * which filters events per subscriber via RLS — the old socket broadcast every
 * event to every client and filtered on the client.
 */

export interface LiveStaff {
  id: string;
  did: string;
  name: string;
  role: string;
  status: string;
  currentLocation?: string;
  lastSignal?: string;
  /** Signal strength from the location beacon, when available. */
  beaconStrength?: string;
  /**
   * Directory details. Optional because the roster is built from the DID
   * registry, not from staff PHI — they render blank rather than crashing.
   */
  phone?: string;
  specialty?: string;
  department?: string;
  email?: string;
  employeeId?: string;
  joinDate?: string;
  specializations?: string[];
}

/**
 * Event bus retained for API compatibility.
 *
 * Components dispatch and listen for names like "staff:location" or
 * "nfc:updated" to trigger a refetch. Supabase Realtime subscriptions can
 * dispatch onto the same bus, so existing listeners keep working.
 */
export const storeEvents = new EventTarget();

export function emitStoreEvent(event: string, detail?: unknown) {
  storeEvents.dispatchEvent(new CustomEvent(event, { detail }));
}

export interface LivePatient {
  id: string;
  did: string;
  name: string;
  email?: string;
  status: string;
  /**
   * Directory details. Optional because the roster comes from the DID registry
   * rather than patient PHI — they render blank rather than crashing.
   */
  mrn?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  allergies?: string[];
  phone?: string;

  /**
   * Clinical and admission detail some views render. Not part of the directory —
   * it lives in PHI tables behind consent — so these are optional and undefined
   * here. Pages show blanks rather than crashing, and fetch real values through
   * the clinical loaders when the caller is entitled to them.
   */
  vitals?: Record<string, unknown>;
  conditions?: string[];
  admitDate?: string;
  primaryDoctor?: string;
  organDonor?: boolean;
  emergencyContact?: { name?: string; phone?: string; relation?: string };
}

let _staff: LiveStaff[] = [];
let _patients: LivePatient[] = [];
let _initialised = false;

/** Current staff roster. Synchronous by design: callers render from cache. */
export function getLiveStaff(): LiveStaff[] {
  return _staff;
}

/**
 * Load the staff roster from Postgres.
 *
 * Reads the DID registry rather than a PHI table: this is a directory, and RLS
 * scopes it to what the caller may see.
 */
async function loadStaff(): Promise<void> {
  // Imported lazily so this module stays usable from a SPA bundle, where the
  // SSR-only server-function chain cannot be resolved.
  const { getDoctors } = await import("./api");
  const res = await getDoctors();

  _staff = (res.doctors ?? []).map(
    (d: { did: string; name: string; role: string; status: string }) => ({
      id: d.did,
      did: d.did,
      name: d.name,
      role: d.role,
      status: d.status,
    }),
  );

  emitStoreEvent("staff:location", _staff);
}

/**
 * Bootstrap the store. Safe to call more than once.
 *
 * Failures are swallowed deliberately: a roster that cannot load should not
 * prevent the app from starting, and the UI renders an empty list.
 */
export async function initializeStore(): Promise<void> {
  if (_initialised) return;
  _initialised = true;

  // Settled, not all: a failure loading one roster must not blank the other.
  const results = await Promise.allSettled([loadStaff(), loadPatients()]);
  if (results[0].status === "rejected") _staff = [];
  if (results[1].status === "rejected") _patients = [];
}

/** Current patient directory. Synchronous by design: callers render from cache. */
export function getLivePatients(): LivePatient[] {
  return _patients;
}

/**
 * Load the patient directory from Postgres.
 *
 * Name and DID come from the DID registry, so this is a directory rather than a
 * PHI read; RLS still scopes what the caller sees.
 */
async function loadPatients(): Promise<void> {
  const { getPatientDirectory } = await import("./api");
  const res = await getPatientDirectory();

  _patients = (res.patients ?? []).map(
    (p: { did: string; name: string; email?: string | null; status: string }) => ({
      id: p.did,
      did: p.did,
      name: p.name,
      email: p.email ?? undefined,
      status: p.status,
    }),
  );

  emitStoreEvent("patients:updated", _patients);
}

/** Force a patient directory refresh. */
export async function refreshLivePatients(): Promise<void> {
  try {
    await loadPatients();
  } catch {
    /* keep the previous list rather than blanking the UI */
  }
}

/** Force a roster refresh — used after a check-in or location change. */
export async function refreshLiveStaff(): Promise<void> {
  try {
    await loadStaff();
  } catch {
    /* keep the previous roster rather than blanking the UI */
  }
}
