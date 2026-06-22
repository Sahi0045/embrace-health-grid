/**
 * useFabric — React hooks for real-time Hyperledger Fabric integration
 *
 * Each hook:
 *  1. Tries the REST API (fabric-backend port 3001)
 *  2. Falls back to the localStorage simulation (hyperledger.ts)
 *  3. Subscribes to WebSocket events for live updates
 *  4. Returns { data, loading, error, online, refetch }
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  isFabricOnline,
  FABRIC_BASE,
  fabricGetStats,
  fabricGetLedger,
  fabricGetAuditEvents,
  fabricGetAllDIDs,
  fabricGetCredentials,
  fabricGetConsents,
  fabricGetAppointments,
  fabricGetBeds,
  fabricGetTracker,
  fabricGetFraudAlerts,
  fabricGetAllPrescriptions,
} from "@/lib/fabric-api";
import { registerLedgerListener, unregisterLedgerListener } from "@/lib/hyperledger";
import {
  getLedger,
  getNetworkStats,
  getDIDRegistry,
  queryWorldState,
  getWorldState,
} from "@/lib/hyperledger";
import {
  getLivePatients,
  getLiveStaff,
  getLiveAppointments,
  getLiveTransactions,
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

      // Also fire wildcard listeners
      _wsListeners.get("*")?.forEach((cb) => cb({ event, data }));
    } catch (err) {
      console.error("[useFabric] Error dispatching ws event message:", err);
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
interface FabricResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  online: boolean;
  refetch: () => void;
}

function useFabricData<T>(
  fetchFn: () => Promise<T>,
  fallbackFn: () => T,
  wsEvent?: string,
  deps: unknown[] = [],
): FabricResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const serverUp = await isFabricOnline();
    setOnline(serverUp);
    try {
      if (serverUp) {
        const result = await fetchFn();
        if (mountedRef.current) setData(result);
      } else {
        const fallback = fallbackFn();
        if (mountedRef.current) setData(fallback);
      }
    } catch (err) {
      const fallback = fallbackFn();
      if (mountedRef.current) {
        setData(fallback);
        setError(err instanceof Error ? err.message : "Fetch failed — using local data");
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
export function useFabricStats() {
  return useFabricData(fabricGetStats, () => getNetworkStats(), "block:committed");
}

// ─── Ledger blocks ────────────────────────────────────────────────────────────
export function useFabricLedger(page = 0) {
  return useFabricData(
    () => fabricGetLedger(page, 20),
    () => ({
      blocks: [...getLedger()].reverse().slice(0, 20),
      total: getLedger().length,
      blockHeight: getLedger().length,
    }),
    "block:committed",
    [page],
  );
}

// ─── DID Registry ─────────────────────────────────────────────────────────────
export function useFabricDIDs() {
  return useFabricData(
    fabricGetAllDIDs,
    () => {
      const reg = getDIDRegistry();
      const dids = Object.values(reg);
      return { dids, total: dids.length };
    },
    "did:created",
  );
}

// ─── Credentials ──────────────────────────────────────────────────────────────
export function useFabricCredentials() {
  return useFabricData(
    fabricGetCredentials,
    () => {
      const ws = queryWorldState("credential-issuer");
      return { credentials: ws.map((e) => e.value), total: ws.length };
    },
    "credential:issued",
  );
}

// ─── Consent ──────────────────────────────────────────────────────────────────
export function useFabricConsents() {
  return useFabricData(
    fabricGetConsents,
    () => {
      const ws = queryWorldState("consent-manager");
      return { consents: ws.map((e) => e.value), total: ws.length };
    },
    "consent:granted",
  );
}

// ─── Audit Events ─────────────────────────────────────────────────────────────
export function useFabricAudit(page = 0) {
  return useFabricData(
    () => fabricGetAuditEvents(page, 50),
    () => {
      const ws = queryWorldState("audit");
      return { events: ws.map((e) => e.value), total: ws.length };
    },
    "audit:logged",
    [page],
  );
}

// ─── Appointments ─────────────────────────────────────────────────────────────
export function useFabricAppointments() {
  return useFabricData(
    fabricGetAppointments,
    () => {
      const appts = getLiveAppointments();
      return { appointments: appts, total: appts.length };
    },
    "appointment:booked",
  );
}

// ─── Beds ─────────────────────────────────────────────────────────────────────
export function useFabricBeds() {
  return useFabricData(
    fabricGetBeds,
    () => {
      const ws = queryWorldState("beds");
      return { beds: ws.map((e) => e.value), total: ws.length };
    },
    "bed:updated",
  );
}

// ─── Staff Tracker ────────────────────────────────────────────────────────────
export function useFabricTracker() {
  return useFabricData(
    fabricGetTracker,
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
export function useFabricFraudAlerts() {
  return useFabricData(fabricGetFraudAlerts, () => ({ alerts: [], total: 0 }), "fraud:detected");
}

// ─── Prescriptions (staff overview) ─────────────────────────────────────────────
export function useFabricPrescriptions() {
  return useFabricData(
    fabricGetAllPrescriptions,
    () => {
      const ws = queryWorldState("prescription");
      return { prescriptions: ws.map((e) => e.value), total: ws.length };
    },
    "prescription:signed",
  );
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

    // WS vitals updates
    const unsub = subscribeWS("vitals:update", (updates) => {
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

    const unsub = subscribeWS("staff:location", (d: unknown) => {
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

// ─── WebSocket connection status ──────────────────────────────────────────────
export function useFabricConnection() {
  const [online, setOnline] = useState(false);
  const [wsConnected, setWsConnected] = useState(getWorkerConnected);
  const [blockHeight, setBlockHeight] = useState(0);
  const [latestBlock, setLatestBlock] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;
    isFabricOnline().then((up) => {
      if (mounted) setOnline(up);
    });

    const onStatusChange = (e: Event) => {
      const connected = (e as CustomEvent<boolean>).detail;
      if (mounted) setWsConnected(connected);
    };

    storeEvents.addEventListener("ws:status", onStatusChange);

    const unsub = subscribeWS("block:committed", (block: unknown) => {
      if (!mounted) return;
      setLatestBlock(block);
      setBlockHeight((b) => b + 1);
    });

    return () => {
      mounted = false;
      storeEvents.removeEventListener("ws:status", onStatusChange);
      unsub();
    };
  }, []);

  return { online, wsConnected, blockHeight, latestBlock };
}

// ─── Real-time block stream (for Hyperledger Console) ─────────────────────────
export function useLiveBlocks(limit = 20) {
  const [blocks, setBlocks] = useState<unknown[]>(() => [...getLedger()].reverse().slice(0, limit));

  useEffect(() => {
    const unsub = subscribeWS("block:committed", (block: unknown) => {
      setBlocks((prev) => [block, ...prev].slice(0, limit));
    });

    const onBlock = (b: unknown) => setBlocks((prev) => [b, ...prev].slice(0, limit));
    registerLedgerListener(onBlock as Parameters<typeof registerLedgerListener>[0]);

    return () => {
      unsub();
      unregisterLedgerListener(onBlock as Parameters<typeof unregisterLedgerListener>[0]);
    };
  }, [limit]);

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
      const up = await isFabricOnline();
      if (up) {
        try {
          const { fabricGetVitals } = await import("@/lib/fabric-api");
          const v = await fabricGetVitals(patientId);
          if (mounted) {
            setVitals(v);
            setSource("api");
          }
          return;
        } catch {}
      }
      // Fallback: pull from live store
      const p = getLivePatients().find((pt) => pt.id === patientId);
      if (p && mounted) {
        setVitals(p.vitals);
        setSource("local");
      }
    };

    fetchVitals();

    // Subscribe to WS vitals
    const unsub = subscribeWS("vitals:update", (updates: unknown) => {
      if (!mounted || !Array.isArray(updates)) return;
      const mine = updates.find((u: { id: string }) => u.id === patientId);
      if (mine) setVitals(mine);
    });

    // Subscribe to local store vitals
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
