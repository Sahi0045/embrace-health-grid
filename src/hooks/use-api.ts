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
  getBeds,
  getTracker,
  getFraudAlerts,
  getAllPrescriptions,
  getVitals,
  isOnline,
  getAllLabs,
} from "@/lib/api";
import {
  getLivePatients,
  getLiveStaff,
  getLiveAppointments,
  storeEvents,
  initializeStore,
  getWorkerConnected,
} from "@/lib/realtime-store";

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
      const serverOnline = await isOnline();
      if (serverOnline) {
        const res = await fetchFn();
        if (mountedRef.current) {
          setData(res);
          setOnline(true);
        }
      } else {
        throw new Error("Server offline");
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
      blockHeight: 1,
      txCount: 0,
      peerCount: 3,
      worldStateSize: 0,
      throughputTps: 0,
      lastBlockTime: new Date().toISOString(),
    }),
    "bed:updated",
  );
}

// ─── Ledger blocks (Mocked to return empty array) ─────────────────────────────
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
  return useApiData(getAllDIDs, () => ({ dids: [] as any[], total: 0 }), "did:created");
}

// ─── Credentials ──────────────────────────────────────────────────────────────
export function useCredentials() {
  return useApiData(
    getCredentials,
    () => ({ credentials: [] as any[], total: 0 }),
    "credential:issued",
  );
}

// ─── Consent ──────────────────────────────────────────────────────────────────
export function useConsents() {
  return useApiData(getConsents, () => ({ consents: [] as any[], total: 0 }), "consent:granted");
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
  );
}

// ─── Beds ─────────────────────────────────────────────────────────────────────
export function useBeds() {
  return useApiData(getBeds, () => ({ beds: [] as any[], total: 0 }), "bed:updated");
}

// ─── Staff Tracker ────────────────────────────────────────────────────────────
export function useTracker() {
  return useApiData(
    getTracker,
    () => {
      const staff = getLiveStaff();
      return {
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
  );
}

// ─── Fraud Alerts ────────────────────────────────────────────────────────────────
export function useFraudAlerts() {
  return useApiData(getFraudAlerts, () => ({ alerts: [] as any[], total: 0 }), "fraud:detected");
}

// ─── Prescriptions (staff overview) ─────────────────────────────────────────────
export function usePrescriptions() {
  return useApiData(
    getAllPrescriptions,
    () => ({ prescriptions: [] as any[], total: 0 }),
    "prescription:signed",
  );
}

// ─── Labs (staff overview) ──────────────────────────────────────────────────────
export function useLabs() {
  return useApiData(getAllLabs, () => ({ labs: [] as any[], total: 0 }), "lab:ordered");
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

  return { patients, loading };
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

// ─── Real-time block stream (Mocked to return empty array) ───────────────────
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
