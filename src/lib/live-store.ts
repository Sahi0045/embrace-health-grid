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

let _staff: LiveStaff[] = [];
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

  try {
    await loadStaff();
  } catch {
    _staff = [];
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
