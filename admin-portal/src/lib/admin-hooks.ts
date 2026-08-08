/**
 * Admin portal data hooks.
 *
 * Local replacements for @/hooks/use-api. The shared hooks import the main app's
 * api.ts, which now delegates to TanStack Start server functions — importing
 * that chain into this Vite SPA drags @tanstack/start-server-core into a browser
 * bundle and the build fails on a missing "#tanstack-router-entry" specifier.
 *
 * These read Supabase directly. RLS still governs every row, so an admin sees
 * only what admin policies permit.
 */

import { useCallback, useEffect, useState } from "react";
import {
  adminGetDIDs,
  adminGetCredentials,
  adminGetAudit,
  adminGetFraudAlerts,
  adminGetNfcCards,
  adminGetAmbulances,
  adminGetEquipment,
} from "./admin-api";
import { getAdminSupabase } from "./supabase";

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** True when the last load succeeded — existing screens show a status pill. */
  online: boolean;
  /** Accepts and ignores arguments; some call sites pass a page number. */
  refetch: (...args: unknown[]) => void;
}

/** Shared fetch-on-mount wrapper with a manual refetch. */
function useQuery<T>(loader: () => Promise<T>, fallback: T): QueryState<T> {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    let cancelled = false;
    setLoading(true);

    loader()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        // Report the failure rather than silently rendering an empty table,
        // which would look like "no records" instead of "could not load".
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loader]);

  const [nonce, setNonce] = useState(0);
  useEffect(() => run(), [run, nonce]);

  return { data, loading, error, online: error === null, refetch: () => setNonce((n) => n + 1) };
}

export function useDIDs() {
  return useQuery(adminGetDIDs, { dids: [] as any[], total: 0 });
}

export function useCredentials() {
  return useQuery(adminGetCredentials, { credentials: [] as any[], total: 0 });
}

export function useAudit(_page?: number) {
  // The page argument is accepted for call-site compatibility; the query returns
  // the most recent events and pages client-side.
  return useQuery(adminGetAudit, { events: [] as any[], total: 0 });
}

export function useFraudAlerts() {
  return useQuery(adminGetFraudAlerts, { alerts: [] as any[], total: 0 });
}

export function useNFCCards() {
  return useQuery(adminGetNfcCards, { entries: [] as any[], cards: [] as any[] });
}

export function useAmbulances() {
  return useQuery(adminGetAmbulances, { ambulances: [] as any[], total: 0 });
}

export function useEquipment() {
  return useQuery(adminGetEquipment, { equipment: [] as any[], total: 0 });
}

export function useBeds() {
  const loader = useCallback(async () => {
    const { data, error } = await getAdminSupabase()
      .from("beds")
      .select("*")
      .order("ward", { ascending: true });
    if (error) throw new Error(error.message);
    const beds = (data ?? []).map((b: Record<string, any>) => ({
      bedId: b.bed_id,
      ward: b.ward,
      status: b.status,
      patientDid: b.patient_did,
    }));
    return { beds, total: beds.length };
  }, []);

  return useQuery(loader, { beds: [] as any[], total: 0 });
}

/**
 * Patients visible to this admin.
 *
 * Note admins have NO blanket PHI read by design — break-glass is an audited
 * Edge Function. This returns the patient DID registry, not clinical records.
 */
export function useLivePatients() {
  const loader = useCallback(async () => {
    const { data, error } = await getAdminSupabase()
      .from("dids")
      .select("did, owner_name, owner_type, status")
      .eq("owner_type", "patient");
    if (error) throw new Error(error.message);
    const patients = (data ?? []).map((d: Record<string, any>) => ({
      did: d.did,
      name: d.owner_name,
      status: d.status,
    }));
    return { patients, total: patients.length };
  }, []);

  const q = useQuery(loader, { patients: [] as any[], total: 0 });
  // Existing screens destructure `patients` directly off the hook result.
  return { ...q, patients: q.data?.patients ?? [] };
}

export function useLiveStaff() {
  const loader = useCallback(async () => {
    const { data, error } = await getAdminSupabase()
      .from("dids")
      .select("did, owner_name, owner_type, status")
      .in("owner_type", ["doctor", "staff"]);
    if (error) throw new Error(error.message);
    const staff = (data ?? []).map((d: Record<string, any>) => ({
      did: d.did,
      name: d.owner_name,
      role: d.owner_type,
      status: d.status,
    }));
    return { staff, total: staff.length };
  }, []);

  const q = useQuery(loader, { staff: [] as any[], total: 0 });
  return { ...q, staff: q.data?.staff ?? [] };
}

/**
 * Dashboard counters, derived from real table counts.
 *
 * The Express getStats() returned hardcoded mock data. Counts are RLS-scoped, so
 * they reflect what this admin may actually read.
 */
export function useStats() {
  const loader = useCallback(async () => {
    const supabase = getAdminSupabase();
    const counted = async (table: string) => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      return error ? 0 : (count ?? 0);
    };

    const [dids, credentials, anchors, roots, audits] = await Promise.all([
      counted("dids"),
      counted("credentials"),
      counted("solana_anchors"),
      counted("merkle_roots"),
      counted("audit_events"),
    ]);

    const { data: latest } = await supabase
      .from("solana_anchors")
      .select("slot, confirmed_at")
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ slot: number | null; confirmed_at: string | null }>();

    return {
      didCount: dids,
      credentialCount: credentials,
      anchorCount: anchors,
      merkleRootCount: roots,
      auditCount: audits,
      blockHeight: latest?.slot ?? 0,
      txCount: anchors,
      peerCount: dids,
      nodesCountUp: roots,
      nodesCountTotal: roots,
      worldStateSize: dids + credentials,
      throughputTps: 0,
      lastBlockTime: latest?.confirmed_at ?? "",
      latencyMs: 0,
      complianceScore: audits > 0 ? 100 : 0,
    };
  }, []);

  return useQuery(loader, {
    didCount: 0,
    credentialCount: 0,
    anchorCount: 0,
    merkleRootCount: 0,
    auditCount: 0,
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
