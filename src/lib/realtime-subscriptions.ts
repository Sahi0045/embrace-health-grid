/**
 * Supabase Realtime subscriptions — Embrace Health Grid
 *
 * Replaces the WebSocket client in realtime-store.ts, which connected to
 * ws://localhost:3001 and handled five event types:
 *   vitals:update, staff:location, appointment:booked,
 *   payment:recorded, did:updated
 *
 * Why this is safe to run directly from the browser
 * ------------------------------------------------
 * Realtime enforces RLS on the subscription: the server only sends change
 * events for rows the subscriber's SELECT policies would return. A patient
 * subscribed to medical_records therefore cannot observe another patient's
 * records being created — the events never reach them.
 *
 * That is a genuine improvement on the old design, where the Express server
 * broadcast every event to every connected socket and the client filtered
 * locally. Anyone with devtools could read other patients' vitals off the wire.
 *
 * Auth note: the browser client holds no session (see supabase.browser.ts), so
 * these subscriptions run with anon privileges. Tables whose policies require
 * an authenticated user will simply deliver nothing — which is why
 * subscribeWithSession() below accepts a short-lived token minted server-side
 * for the socket only.
 */

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve the browser Supabase client on first use.
 *
 * A static import would pull supabase.browser.ts into the server bundle, which
 * TanStack's import protection correctly rejects. Every function here runs only
 * in the browser, so a dynamic import keeps the boundary genuine rather than
 * suppressing the warning.
 */
let _cached: SupabaseClient | null = null;
async function browserClient(): Promise<SupabaseClient> {
  if (typeof window === "undefined") {
    throw new Error("Realtime subscriptions are browser-only");
  }
  if (!_cached) {
    const { getSupabaseBrowserClient } = await import("./supabase.browser");
    _cached = getSupabaseBrowserClient() as unknown as SupabaseClient;
  }
  return _cached;
}

export type ChangeEvent = "INSERT" | "UPDATE" | "DELETE";

export interface ChangePayload<T = Record<string, unknown>> {
  eventType: ChangeEvent;
  table: string;
  new: T | null;
  old: T | null;
}

/** Track open channels so unsubscribeAll() can tear everything down on logout. */
const _channels = new Map<string, RealtimeChannel>();

/**
 * Subscribe to changes on a table.
 *
 * @param table   table name in the public schema
 * @param onChange invoked for each change event the subscriber is permitted to see
 * @param filter  optional PostgREST filter, e.g. "patient_did=eq.did:hosp:0x1"
 * @returns an unsubscribe function
 */
export function subscribeToTable<T = Record<string, unknown>>(
  table: string,
  onChange: (payload: ChangePayload<T>) => void,
  filter?: string,
): () => void {
  const key = filter ? `${table}:${filter}` : table;
  let cancelled = false;

  void (async () => {
    const supabase = await browserClient();
    if (cancelled) return;

    // Reuse an existing channel rather than opening duplicates for the same key.
    const existing = _channels.get(key);
    if (existing) {
      void supabase.removeChannel(existing);
      _channels.delete(key);
    }

    const channel = supabase
      .channel(`realtime:${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        (payload) => {
          onChange({
            eventType: payload.eventType as ChangeEvent,
            table,
            new: (payload.new ?? null) as T | null,
            old: (payload.old ?? null) as T | null,
          });
        },
      )
      .subscribe();

    if (cancelled) {
      void supabase.removeChannel(channel);
      return;
    }
    _channels.set(key, channel);
  })();

  // Synchronous unsubscribe so callers can return it straight from useEffect.
  return () => {
    cancelled = true;
    const channel = _channels.get(key);
    if (channel) {
      _channels.delete(key);
      void browserClient().then((sb) => sb.removeChannel(channel));
    }
  };
}

/**
 * Give the Realtime socket the caller's identity.
 *
 * The browser client stores no session, so it is anonymous by default and
 * RLS-protected tables would deliver no events. The server mints the access
 * token (it holds the httpOnly cookie) and it is handed to the socket only —
 * never written to localStorage, sessionStorage, or a JS-readable cookie.
 */
export async function authenticateRealtime(accessToken: string): Promise<void> {
  const supabase = await browserClient();
  await supabase.realtime.setAuth(accessToken);
}

/** Close every open channel. Call on sign-out. */
export function unsubscribeAll(): void {
  const channels = [..._channels.values()];
  _channels.clear();
  if (!channels.length) return;
  void browserClient().then((supabase) => {
    for (const channel of channels) void supabase.removeChannel(channel);
  });
}

/** Open channel keys, for diagnostics. */
export function activeSubscriptions(): string[] {
  return [..._channels.keys()];
}

// ─── Domain-specific helpers ────────────────────────────────────────────────
// Thin wrappers so components do not hardcode table names or filter syntax.

/** Live vitals for one patient. Replaces the `vitals:update` WS event. */
export function subscribeToVitals(
  patientDid: string,
  onVitals: (vitals: {
    patient_did: string;
    heart_rate: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    spo2: number | null;
    temperature: number | null;
    resp_rate: number | null;
    recorded_at: string;
  }) => void,
): () => void {
  return subscribeToTable(
    "vitals",
    (p) => {
      if (p.eventType === "INSERT" && p.new) onVitals(p.new as never);
    },
    `patient_did=eq.${patientDid}`,
  );
}

/**
 * Anchor status transitions. Replaces polling for confirmation.
 * Only fires when the status actually changed, so a metadata update on an
 * already-confirmed row does not re-notify.
 */
export function subscribeToAnchorStatus(
  onStatusChange: (anchor: {
    anchor_id: string;
    status: string;
    signature: string | null;
    slot: number | null;
  }) => void,
): () => void {
  return subscribeToTable("solana_anchors", (p) => {
    if (p.eventType !== "UPDATE" || !p.new) return;
    const before = p.old as { status?: string } | null;
    const after = p.new as { status?: string };
    if (before?.status !== after.status) onStatusChange(p.new as never);
  });
}

/** Appointment changes for either party. Replaces `appointment:booked`. */
export function subscribeToAppointments(onChange: (payload: ChangePayload) => void): () => void {
  return subscribeToTable("appointments", onChange);
}

/** New clinical records as they are authored. */
export function subscribeToMedicalRecords(onChange: (payload: ChangePayload) => void): () => void {
  return subscribeToTable("medical_records", onChange);
}

/** Lab results arriving — the canonical push case. */
export function subscribeToLabResults(onChange: (payload: ChangePayload) => void): () => void {
  return subscribeToTable("lab_results", onChange);
}

/** Admission state changes (admit / discharge / transfer). */
export function subscribeToAdmissions(onChange: (payload: ChangePayload) => void): () => void {
  return subscribeToTable("admissions", onChange);
}

/** Admission event log — fires after every lifecycle transition. */
export function subscribeToAdmissionEvents(onChange: (payload: ChangePayload) => void): () => void {
  return subscribeToTable("admission_events", onChange);
}

/** Billing account updates — fires when outstanding balance changes. */
export function subscribeToBilling(
  patientDid: string | null | undefined,
  onChange: (payload: ChangePayload) => void,
): () => void {
  if (!patientDid) return () => {};
  return subscribeToTable("billing_accounts", onChange, `patient_did=eq.${patientDid}`);
}
