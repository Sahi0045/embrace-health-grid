/**
 * useApi — React hooks for real-time API integrations
 *
 * Each hook:
 *  1. Tries the REST API (backend port 3001)
 *  2. Falls back to local live store / state when offline
 *  3. Subscribes to WebSocket events for live updates
 *  4. Returns { data, loading, error, online, refetch }
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getStats,
  getAuditEvents,
  getAllDIDs,
  getCredentials,
  getConsents,
  getAppointments,
  getAppointmentsByPatient,
  getAppointmentsByDoctor,
  getDIDVerifiedDoctors,
  getVerifiedDoctors,
  getDoctorAppointmentRequests,
  getDoctorAppointments,
  getBeds,
  getTracker,
  getFraudAlerts,
  getAllPrescriptions,
  getVitals,
  isBackendOnline as isOnline,
  getAllLabs,
  getNamespace,
  getInsuranceClaims,
  getVaccines,
  getDoctors,
  getInpatientData as fetchInpatientData,
  getAmbulances,
  getEquipment,
  getAttendance,
  getAdminAttendanceSummary,
  getStaffRequests,
} from "@/lib/api";

import { getLiveStaff, storeEvents, initializeStore } from "@/lib/live-store";

// The old store cached patients/appointments locally from a WebSocket feed.
// Those now come from Supabase via the primary loaders, so the local caches are
// empty and these exist only to satisfy fallback signatures.
const getLivePatients = (): any[] => [];
const getLiveAppointments = (): any[] => [];
const getWorkerConnected = (): boolean => false;

// ─── WebSocket singleton ──────────────────────────────────────────────────────
const _wsListeners: Map<string, Set<(data: unknown) => void>> = new Map();
let _globalWsListenerInitialized = false;

function initGlobalWsListener() {
  if (_globalWsListenerInitialized || typeof window === "undefined") return;
  _globalWsListenerInitialized = true;

  storeEvents.addEventListener("ws:message", (e: Event) => {
    try {
      const customEvent = e as CustomEvent<{ event: string; data: unknown }>;
      const { event, data } = customEvent.detail;

      const listeners = _wsListeners.get(event);
      listeners?.forEach((cb) => cb(data));

      // Wildcard listeners
      _wsListeners.get("*")?.forEach((cb) => cb({ event, data }));
    } catch (err) {
      console.error("[useApi] Error dispatching ws event message:", err);
    }
  });
}

function subscribeWS(event: string, cb: (data: unknown) => void): () => void {
  initGlobalWsListener();
  if (!_wsListeners.has(event)) _wsListeners.set(event, new Set());
  _wsListeners.get(event)!.add(cb);
  return () => _wsListeners.get(event)?.delete(cb);
}

// ─── Base hook factory ────────────────────────────────────────────────────────
interface ApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  online: boolean;
  refetch: () => void;
}

function useApiData<T>(
  fetchFn: () => Promise<T>,
  fallbackFn: () => T,
  wsEvent?: string,
  deps: unknown[] = [],
  /**
   * Retained so the ~16 existing call sites still compile. Convex has been
   * removed; the primary loader now queries Supabase, so this is ignored.
   */
  _legacyConvexQuery?: { query?: unknown; args?: unknown; mapFn?: (data: unknown) => T },
): ApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Supabase is the only backend now: no reachability pre-check, and no
      // Convex fallback. A query either succeeds or the fallback data renders.
      const res = await fetchFn();
      if (mountedRef.current) {
        setData(res);
        setOnline(true);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Fetch failed");
        setOnline(false);
        try {
          const fallback = fallbackFn();
          setData(fallback);
        } catch {
          // ignore
        }
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  // Subscribe to WebSocket events for live refresh
  useEffect(() => {
    if (!wsEvent) return;
    return subscribeWS(wsEvent, () => {
      if (mountedRef.current) load();
    });
  }, [wsEvent, load]);

  return { data, loading, error, online, refetch: load };
}

// ─── Network stats ────────────────────────────────────────────────────────────
export function useStats() {
  return useApiData(
    getStats,
    () => ({
      didCount: 0,
      credentialCount: 0,
      anchorCount: 0,
      merkleRootCount: 0,
      recordCount: 0,
      auditCount: 0,
      latestSlot: null as number | null,
      lastAnchoredAt: null as string | null,
      blockHeight: 0,
      txCount: 0,
      peerCount: 0,
      nodesCountUp: 0,
      nodesCountTotal: 0,
      worldStateSize: 0,
      throughputTps: 0,
      lastBlockTime: new Date().toISOString(),
      latencyMs: 0,
      complianceScore: 0,
    }),
    "*",
  );
}

// ─── Ledger blocks ────────────────────────────────────────────────────────────
export function useLedger(page = 0) {
  return useApiData(
    async () => ({ blocks: [] as any[], total: 0, blockHeight: 1 }),
    () => ({
      blocks: [] as any[],
      total: 0,
      blockHeight: 1,
    }),
    undefined,
    [page],
  );
}

// ─── DID Registry ─────────────────────────────────────────────────────────────
export function useDIDs() {
  return useApiData(getAllDIDs, () => ({ dids: [] as any[], total: 0 }), "did:created", [], {
    mapFn: (raw: any) => ({ dids: raw, total: raw.length }),
  });
}

export function useNFCCards() {
  return useApiData(
    () => getNamespace("nfc-cards"),
    () => ({ entries: [] as any[] }),
    "nfc:updated",
    [],
  );
}

// ─── Credentials ──────────────────────────────────────────────────────────────
export function useCredentials() {
  return useApiData(
    getCredentials,
    () => ({ credentials: [] as any[], total: 0 }),
    "credential:issued",
    [],
  );
}

// ─── Consent ──────────────────────────────────────────────────────────────────
export function useConsents() {
  return useApiData(
    getConsents,
    () => ({ consents: [] as any[], total: 0 }),
    "consent:granted",
    [],
  );
}

// ─── Audit Events ─────────────────────────────────────────────────────────────
export function useAudit(page = 0) {
  return useApiData(
    () => getAuditEvents(page, 50),
    () => ({ events: [] as any[], total: 0 }),
    "audit:logged",
    [page],
  );
}

// ─── Appointments ─────────────────────────────────────────────────────────────
export function useAppointments() {
  return useApiData(
    getAppointments,
    () => {
      const appts = getLiveAppointments();
      return { appointments: appts, total: appts.length };
    },
    "appointment:booked",
    [],
  );
}

export function useAppointmentsByPatient(patientDid: string) {
  return useApiData(
    () => getAppointmentsByPatient(patientDid),
    () => ({ appointments: [] as any[], total: 0 }),
    "appointment:updated",
    [patientDid],
  );
}

export function useAppointmentsByDoctor(doctorDid: string) {
  return useApiData(
    () => getAppointmentsByDoctor(doctorDid),
    () => ({ appointments: [] as any[], total: 0 }),
    "appointment:updated",
    [doctorDid],
  );
}

export function useDIDVerifiedDoctors() {
  return useApiData(
    getDIDVerifiedDoctors,
    () => ({ doctors: [] as any[], total: 0 }),
    "did:created",
    [],
  );
}

/** Hook: only doctors with an active DID — used in patient portal booking */
export function useVerifiedDoctors() {
  return useApiData(
    getVerifiedDoctors,
    () => ({ doctors: [] as any[], total: 0 }),
    "did:created",
    [],
  );
}

/** Hook: pending appointment requests for the logged-in doctor */
export function useDoctorAppointmentRequests() {
  return useApiData(
    getDoctorAppointmentRequests,
    () => ({ requests: [] as any[], total: 0 }),
    "appointment:booked",
    [],
  );
}

/** Hook: all appointments (any status) for the logged-in doctor */
export function useDoctorAppointments() {
  return useApiData(
    getDoctorAppointments,
    () => ({ appointments: [] as any[], total: 0 }),
    "appointment:updated",
    [],
  );
}

// ─── Beds ─────────────────────────────────────────────────────────────────────
export function useBeds() {
  return useApiData(getBeds, () => ({ beds: [] as any[], total: 0 }), "bed:updated", [], {
    mapFn: (raw: any) => ({ beds: raw, total: raw.length }),
  });
}

// ─── Staff Tracker ────────────────────────────────────────────────────────────
export function useTracker() {
  return useApiData(
    getTracker,
    () => {
      const staff = getLiveStaff();
      return {
        tracker: [] as any[],
        entries: [] as any[],
        staff: staff.map((s) => ({
          staffId: s.id,
          name: s.name,
          location: s.currentLocation,
          lastPing: s.lastSignal,
          beacon: s.beaconStrength,
        })),
      };
    },
    "staff:location",
    [],
  );
}

// ─── Fraud Alerts ────────────────────────────────────────────────────────────────
export function useFraudAlerts() {
  return useApiData(
    getFraudAlerts,
    () => ({ alerts: [] as any[], total: 0 }),
    "fraud:detected",
    [],
  );
}

// ─── Prescriptions (staff overview) ─────────────────────────────────────────────
export function usePrescriptions() {
  return useApiData(
    getAllPrescriptions,
    () => ({ prescriptions: [] as any[], total: 0 }),
    "prescription:signed",
    [],
  );
}

// ─── Labs (staff overview) ──────────────────────────────────────────────────────
export function useLabs() {
  return useApiData(getAllLabs, () => ({ labs: [] as any[], total: 0 }), "lab:ordered", [], {
    args: { namespace: "labs" },
    mapFn: (raw: any) => ({ labs: raw.map((e: any) => e.value), total: raw.length }),
  });
}

// ─── Live Patients (store-driven + WS vitals) ─────────────────────────────────
export function useLivePatients() {
  const [patients, setPatients] = useState(getLivePatients);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    initializeStore().then(() => {
      if (mounted) {
        setPatients(getLivePatients());
        setLoading(false);
      }
    });

    const onVitals = () => {
      if (mounted) setPatients(getLivePatients());
    };
    storeEvents.addEventListener("vitals:update", onVitals);
    storeEvents.addEventListener("store:ready", onVitals);

    const unsub = subscribeWS("vitals:update", () => {
      if (!mounted) return;
      setPatients(getLivePatients());
    });

    return () => {
      mounted = false;
      storeEvents.removeEventListener("vitals:update", onVitals);
      storeEvents.removeEventListener("store:ready", onVitals);
      unsub();
    };
  }, []);

  const refetch = useCallback(() => {
    setPatients(getLivePatients());
  }, []);

  return { patients, loading, refetch };
}

// ─── Live Staff (store-driven + WS location) ──────────────────────────────────
export function useLiveStaff() {
  const [staff, setStaff] = useState(getLiveStaff);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    initializeStore().then(() => {
      if (mounted) {
        setStaff(getLiveStaff());
        setLoading(false);
      }
    });

    const onLocation = () => {
      if (mounted) setStaff(getLiveStaff());
    };
    storeEvents.addEventListener("staff:location:update", onLocation);
    storeEvents.addEventListener("store:ready", onLocation);

    const unsub = subscribeWS("staff:location", () => {
      if (!mounted) return;
      setStaff(getLiveStaff());
    });

    return () => {
      mounted = false;
      storeEvents.removeEventListener("staff:location:update", onLocation);
      storeEvents.removeEventListener("store:ready", onLocation);
      unsub();
    };
  }, []);

  return { staff, loading };
}

// ─── Connection status ────────────────────────────────────────────────────────
export function useConnection() {
  const [online, setOnline] = useState(false);
  const [wsConnected, setWsConnected] = useState(getWorkerConnected);
  const [blockHeight] = useState(1);
  const [latestBlock] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;

    // Check REST API online status
    const checkOnline = async () => {
      const apiOnline = await isOnline();
      if (mounted) setOnline(apiOnline);
    };

    checkOnline();
    const interval = setInterval(checkOnline, 10000);

    const onStatusChange = (e: Event) => {
      const connected = (e as CustomEvent<boolean>).detail;
      if (mounted) setWsConnected(connected);
    };

    storeEvents.addEventListener("ws:status", onStatusChange);

    return () => {
      mounted = false;
      clearInterval(interval);
      storeEvents.removeEventListener("ws:status", onStatusChange);
    };
  }, []);

  return { online, wsConnected, blockHeight, latestBlock };
}

// ─── Real-time block stream ───────────────────────────────────────────────────
export function useLiveBlocks(limit = 20) {
  const [blocks] = useState<unknown[]>([]);
  return blocks;
}

// ─── Single-patient vitals (live) ─────────────────────────────────────────────
export function usePatientVitals(patientId: string) {
  const [vitals, setVitals] = useState<{
    heartRate: number;
    bp: string;
    spo2: number;
    temp: number;
    respRate: number;
  } | null>(null);
  const [source, setSource] = useState<"api" | "local">("local");

  useEffect(() => {
    if (!patientId) return;
    let mounted = true;

    const fetchVitals = async () => {
      const p = getLivePatients().find((pt) => pt.id === patientId);
      if (p && mounted) {
        setVitals(p.vitals);
        setSource("local");
      }
    };

    fetchVitals();

    const unsub = subscribeWS("vitals:update", (updates: unknown) => {
      if (!mounted || !Array.isArray(updates)) return;
      const mine = updates.find((u: { id: string }) => u.id === patientId);
      if (mine) setVitals(mine);
    });

    const onLocal = () => {
      if (!mounted) return;
      const p = getLivePatients().find((pt) => pt.id === patientId);
      if (p) setVitals(p.vitals);
    };
    storeEvents.addEventListener("vitals:update", onLocal);

    return () => {
      mounted = false;
      unsub();
      storeEvents.removeEventListener("vitals:update", onLocal);
    };
  }, [patientId]);

  return { vitals, source };
}

// ─── Insurance Claims ─────────────────────────────────────────────────────
export function useInsuranceClaims(patientDid?: string) {
  return useApiData(
    () => getInsuranceClaims(patientDid),
    () => ({ claims: [] as any[], total: 0 }),
    "insurance:claimed",
    [patientDid],
  );
}

// ─── Vaccine Records ──────────────────────────────────────────────────────
export function useVaccineRecords(patientDid: string) {
  return useApiData(
    () => getVaccines(patientDid),
    () => ({ vaccines: [] as any[], total: 0 }),
    "vaccine:recorded",
    [patientDid],
  );
}

// ─── Doctors ──────────────────────────────────────────────────────────────
export function useDoctors() {
  return useApiData(getDoctors, () => ({ doctors: [] as any[], total: 0 }), "did:created", [], {
    mapFn: (raw: any) => {
      const docs = raw.filter((s: any) => s.role === "doctor" || s.role === "staff");
      return { doctors: docs, total: docs.length };
    },
  });
}

// ─── Inpatient Data ───────────────────────────────────────────────────────
export function useInpatientData(patientDid: string) {
  return useApiData(
    () => fetchInpatientData(patientDid),
    () => ({
      admission: null,
      procedures: [] as any[],
      medications: [] as any[],
      nursingNotes: [] as any[],
      dailyCheckups: [] as any[],
      dietOrders: [] as any[],
      rehabSessions: [] as any[],
      checkups: [] as any[],
      dietOrder: null,
      vitalSigns: [] as any[],
    }),
    undefined,
    [patientDid],
  );
}

// ─── Ambulances ───────────────────────────────────────────────────────────
export function useAmbulances() {
  return useApiData(
    getAmbulances,
    () => ({ ambulances: [] as any[], total: 0 }),
    "ambulance:updated",
    [],
  );
}

// ─── Equipment ────────────────────────────────────────────────────────────
export function useEquipment() {
  return useApiData(getEquipment, () => ({ equipment: [] as any[], total: 0 }), undefined, [], {
    args: { namespace: "equipment" },
    mapFn: (raw: any) => ({ equipment: raw.map((e: any) => e.value), total: raw.length }),
  });
}

// ─── Attendance ───────────────────────────────────────────────────────────
export function useAttendance(staffEmail: string) {
  return useApiData(
    () => getAttendance(staffEmail),
    () => ({ attendance: [] as any[], records: [] as any[], total: 0 }),
    "attendance:clocked",
    [staffEmail],
  );
}

export function useAdminAttendance() {
  return useApiData(
    getAdminAttendanceSummary,
    () => ({
      summary: {
        totalEligibleStaff: 0,
        presentToday: 0,
        checkedInCount: 0,
        checkedOutCount: 0,
        absentToday: 0,
        date: new Date().toISOString().split("T")[0],
      },
      roster: [] as any[],
      allRecords: [] as any[],
    }),
    "attendance:clocked",
  );
}

// ─── Staff Requests (Leave / Shift) ───────────────────────────────────────
export function useStaffRequests(staffEmail: string) {
  return useApiData(
    () => getStaffRequests(staffEmail),
    () => ({ requests: [] as any[], total: 0 }),
    "staff-request:created",
    [staffEmail],
  );
}
