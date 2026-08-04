/**
 * Realtime React hooks — Embrace Health Grid
 *
 * Wraps src/lib/realtime.ts so components get authenticated subscriptions
 * without each one having to fetch a socket token.
 *
 * Replaces the WebSocket plumbing in realtime-store.ts (ws://localhost:3001).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChangePayload } from "@/lib/realtime-subscriptions";
import { getRealtimeToken } from "@/lib/clinical.server";
import { useCurrentUser } from "@/lib/auth-context";

/**
 * Load the Realtime module lazily.
 *
 * Routes are server-rendered, so a static import of a `.client.ts` module is
 * rejected by TanStack's import-protection plugin. Importing inside an effect
 * keeps the browser-only Supabase client out of the server bundle entirely,
 * rather than papering over it.
 */
async function realtimeModule() {
  return await import("@/lib/realtime-subscriptions");
}

/**
 * Authenticate the Realtime socket once the user is known.
 *
 * Without this, subscriptions are anonymous and RLS-protected tables deliver
 * nothing. Returns whether the socket is ready so dependent hooks can wait.
 */
export function useRealtimeAuth(): { ready: boolean } {
  const { user } = useCurrentUser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setReady(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { token } = await getRealtimeToken();
        if (cancelled || !token) return;
        const { authenticateRealtime } = await realtimeModule();
        await authenticateRealtime(token);
        if (!cancelled) setReady(true);
      } catch {
        // Leave ready false: subscriptions simply deliver nothing rather than
        // silently falling back to an unauthenticated stream.
        if (!cancelled) setReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Tear down every channel on sign-out so a subsequent user cannot inherit
  // another session's subscriptions.
  useEffect(() => {
    if (!user) void realtimeModule().then((m) => m.unsubscribeAll());
  }, [user]);

  return { ready };
}

export interface LiveVitals {
  heartRate: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  spo2: number | null;
  temperature: number | null;
  respRate: number | null;
  recordedAt: string;
}

/**
 * Live vitals for one patient. Replaces the `vitals:update` WebSocket event.
 * RLS ensures only the patient themselves or a consented clinician receives
 * these events.
 */
export function useLiveVitals(patientDid: string | null | undefined): LiveVitals | null {
  const { ready } = useRealtimeAuth();
  const [vitals, setVitals] = useState<LiveVitals | null>(null);

  useEffect(() => {
    if (!ready || !patientDid) return;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void realtimeModule().then(({ subscribeToVitals }) => {
      if (cancelled) return;
      unsubscribe = subscribeToVitals(patientDid, (row) => {
        setVitals({
          heartRate: row.heart_rate,
          bpSystolic: row.bp_systolic,
          bpDiastolic: row.bp_diastolic,
          spo2: row.spo2,
          temperature: row.temperature,
          respRate: row.resp_rate,
          recordedAt: row.recorded_at,
        });
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [ready, patientDid]);

  return vitals;
}

/**
 * Anchor confirmation status. Replaces polling after submitting an anchor:
 * the row transitions pending -> confirmed (or failed) and the event arrives.
 */
export function useAnchorStatus(): {
  lastAnchor: {
    anchorId: string;
    status: string;
    signature: string | null;
    slot: number | null;
  } | null;
} {
  const { ready } = useRealtimeAuth();
  const [lastAnchor, setLastAnchor] = useState<{
    anchorId: string;
    status: string;
    signature: string | null;
    slot: number | null;
  } | null>(null);

  useEffect(() => {
    if (!ready) return;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void realtimeModule().then(({ subscribeToAnchorStatus }) => {
      if (cancelled) return;
      unsubscribe = subscribeToAnchorStatus((a) => {
        setLastAnchor({
          anchorId: a.anchor_id,
          status: a.status,
          signature: a.signature,
          slot: a.slot,
        });
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [ready]);

  return { lastAnchor };
}

/**
 * Re-run a loader when a table changes.
 *
 * Replaces the pattern of a WebSocket message triggering a manual refetch —
 * the common case in the old store.
 */
export function useTableRefresh(
  table: string,
  onRefresh: () => void | Promise<void>,
  filter?: string,
): void {
  const { ready } = useRealtimeAuth();

  // Keep the latest callback without re-subscribing on every render.
  const cb = useRef(onRefresh);
  cb.current = onRefresh;

  const stable = useCallback((_payload: ChangePayload) => {
    void cb.current();
  }, []);

  useEffect(() => {
    if (!ready) return;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void realtimeModule().then(({ subscribeToTable }) => {
      if (cancelled) return;
      unsubscribe = subscribeToTable(table, stable, filter);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [ready, table, filter, stable]);
}
