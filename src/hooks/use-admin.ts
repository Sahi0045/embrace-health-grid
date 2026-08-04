/**
 * Admin data hooks for the main app.
 *
 * These back the admin console pages that were previously only available in the
 * standalone admin-portal SPA (localhost:3002, never deployed).
 *
 * Unlike the portal's version, these go through server functions, so:
 *   - the session stays in an httpOnly cookie, unreadable by JavaScript
 *   - the role is read from Postgres on every request, never from client state
 *   - RLS decides what each query returns
 *
 * That matters most for admin screens: an admin session is the most valuable one
 * to steal, and the portal had to keep its token in browser storage because a
 * SPA cannot set httpOnly cookies.
 */

import { useCallback, useEffect, useState } from "react";
import {
  getAllDIDs,
  getCredentials,
  getAuditEvents,
  getFraudAlerts,
  getPolicies,
  getUsers,
  getNamespace,
  getBilling,
  getAmbulances,
  getEquipment,
  getStats,
  getAllPrescriptions,
  getBeds,
} from "@/lib/api";

export interface AdminQuery<T> {
  data: T;
  loading: boolean;
  error: string | null;
  /** True when the last load succeeded — screens render a status pill from this. */
  online: boolean;
  /** Accepts and ignores arguments; some call sites pass a page number. */
  refetch: (...args: unknown[]) => void;
}

/** Fetch on mount, with a manual refetch. */
function useAdminQuery<T>(loader: () => Promise<T>, fallback: T): AdminQuery<T> {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loader()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => {
        // Surface the failure rather than rendering an empty table, which would
        // read as "no records" instead of "could not load".
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loader, nonce]);

  return {
    data,
    loading,
    error,
    online: error === null,
    refetch: () => setNonce((n) => n + 1),
  };
}

export function useAdminDIDs() {
  const loader = useCallback(() => getAllDIDs(), []);
  return useAdminQuery(loader, { dids: [] as any[], total: 0 });
}

export function useAdminCredentials() {
  const loader = useCallback(() => getCredentials(), []);
  return useAdminQuery(loader, { credentials: [] as any[], total: 0 });
}

export function useAdminAudit(_page?: number) {
  const loader = useCallback(() => getAuditEvents(), []);
  return useAdminQuery(loader, { events: [] as any[], total: 0, page: 1, size: 0 });
}

export function useAdminFraudAlerts() {
  const loader = useCallback(() => getFraudAlerts(), []);
  return useAdminQuery(loader, { alerts: [] as any[], total: 0 });
}

export function useAdminPolicies() {
  const loader = useCallback(() => getPolicies(), []);
  return useAdminQuery(loader, { policies: [] as any[], total: 0 });
}

export function useAdminUsers() {
  const loader = useCallback(() => getUsers(), []);
  return useAdminQuery(loader, { users: [] as any[], total: 0 });
}

export function useAdminNfcCards() {
  const loader = useCallback(() => getNamespace("nfc-cards"), []);
  return useAdminQuery(loader, { entries: [] as any[] });
}

export function useAdminBilling() {
  const loader = useCallback(() => getBilling(), []);
  return useAdminQuery(loader, {
    outstanding: 0,
    totalBilled: 0,
    totalPaid: 0,
    bills: [] as any[],
    payments: [] as any[],
    billSummary: { outstanding: 0, totalBilled: 0, totalPaid: 0, totalCharges: 0, balanceDue: 0 },
  });
}

export function useAdminAmbulances() {
  const loader = useCallback(() => getAmbulances(), []);
  return useAdminQuery(loader, { ambulances: [] as any[], total: 0 });
}

export function useAdminEquipment() {
  const loader = useCallback(() => getEquipment(), []);
  return useAdminQuery(loader, { equipment: [] as any[], total: 0 });
}

export function useAdminStats() {
  const loader = useCallback(() => getStats(), []);
  return useAdminQuery(loader, {
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
    lastBlockTime: "",
    latencyMs: 0,
    complianceScore: 0,
  });
}

export function useAdminPrescriptions() {
  const loader = useCallback(() => getAllPrescriptions(), []);
  return useAdminQuery(loader, { prescriptions: [] as any[] });
}

export function useAdminBeds() {
  const loader = useCallback(() => getBeds(), []);
  return useAdminQuery(loader, { beds: [] as any[], total: 0 });
}

// ─── Roster views ───────────────────────────────────────────────────────────
// Built from the DID registry rather than PHI tables: admins deliberately have
// no blanket clinical read, so these are directories, not medical records.

export interface RosterPerson {
  did: string;
  name: string;
  role?: string;
  status?: string;
  mrn?: string;
  age?: number;
  gender?: string;
  phone?: string;
  email?: string;
  ward?: string;
  bed?: string;
  allergies?: string[];
  conditions?: string[];
  insuranceProvider?: string;
  insurancePolicyNo?: string;
  outstandingBills?: number;
  id?: string;
  isOnChain?: boolean;
  activeCredentials?: Array<{ id: string; type?: string }>;
  currentLocation?: string;
  lastSignal?: string;
  beaconStrength?: string;
  specialty?: string;
  department?: string;
  employeeId?: string;
  onDuty?: boolean;
  shift?: string;
  /** Count of credentials held. */
  credentials?: number;
  joinedDate?: string;
  totalVisits?: number;
  bloodGroup?: string;
  admitDate?: string;
  didDocument?: { did?: string; [key: string]: unknown };
  primaryDoctor?: string;
  vitals?: {
    pulse?: number;
    heartRate?: number;
    spo2?: number;
    bp?: string;
    temp?: number;
  };
}

export function useLivePatients() {
  const loader = useCallback(async () => {
    const res = await getAllDIDs();
    const patients: RosterPerson[] = (res.dids ?? [])
      .filter((d: any) => d.ownerType === "patient")
      .map((d: any) => ({ did: d.did, name: d.owner, status: d.status, id: d.did }));
    return { patients, total: patients.length };
  }, []);

  const q = useAdminQuery(loader, { patients: [] as RosterPerson[], total: 0 });
  // Screens destructure `patients` straight off the hook.
  return { ...q, patients: q.data.patients };
}

export function useLiveStaff() {
  const loader = useCallback(async () => {
    const res = await getAllDIDs();
    const staff: RosterPerson[] = (res.dids ?? [])
      .filter((d: any) => d.ownerType === "doctor" || d.ownerType === "staff")
      .map((d: any) => ({
        did: d.did,
        name: d.owner,
        role: d.ownerType,
        status: d.status,
        id: d.did,
      }));
    return { staff, total: staff.length };
  }, []);

  const q = useAdminQuery(loader, { staff: [] as RosterPerson[], total: 0 });
  return { ...q, staff: q.data.staff };
}
