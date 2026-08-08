/**
 * Admin portal data layer.
 *
 * WHY THIS EXISTS SEPARATELY FROM src/lib/api.ts
 * ----------------------------------------------
 * The main app's api.ts now delegates to TanStack Start server functions
 * (createServerFn). Those require an SSR runtime. The admin portal is a plain
 * Vite SPA, so importing api.ts drags @tanstack/start-server-core into a browser
 * bundle and the build fails on a missing "#tanstack-router-entry" specifier.
 *
 * This module therefore queries Supabase directly with the anon key. That is
 * safe with respect to DATA — RLS governs every row, and the same 100+ policies
 * the main app relies on apply here unchanged. An admin sees what an admin's
 * policies permit, nothing more, and PHI break-glass remains an audited Edge
 * Function.
 *
 * The accepted weakness is SESSION STORAGE, documented in ./supabase.ts: a SPA
 * cannot hold an httpOnly cookie. This portal is not deployed (nothing in
 * vercel.json or the production CD builds it), so that exposure is confined to
 * local development. Before deploying, fold these routes into the main app or
 * convert this portal to TanStack Start.
 */

import { getAdminSupabase } from "./supabase";

/** Generic ordered read. Table names come from this module, never from a caller. */
async function readAll<T = Record<string, unknown>>(
  table: string,
  orderColumn: string,
  ascending = false,
  limit = 300,
): Promise<T[]> {
  const { data, error } = await getAdminSupabase()
    .from(table)
    .select("*")
    .order(orderColumn, { ascending })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

// ─── Identity ───────────────────────────────────────────────────────────────

export async function adminGetDIDs() {
  const rows = await readAll<Record<string, any>>("dids", "created_at");
  const dids = rows.map((d) => ({
    did: d.did,
    owner: d.owner_name,
    ownerType: d.owner_type,
    publicKey: d.public_key,
    controller: d.controller,
    status: d.status,
    createdAt: d.created_at,
  }));
  return { dids, total: dids.length };
}

export async function adminGetCredentials() {
  const rows = await readAll<Record<string, any>>("credentials", "issued_at");
  const credentials = rows.map((c) => ({
    id: c.id,
    type: c.credential_type,
    issuer: c.issuer,
    subject: c.subject_did,
    claims: c.claims,
    signature: c.signature,
    status: c.status,
    issuedAt: c.issued_at,
    expiresAt: c.expires_at,
  }));
  return { credentials, total: credentials.length };
}

export async function adminGetProfiles() {
  const rows = await readAll<Record<string, any>>("profiles", "created_at");
  const users = rows.map((p) => ({
    id: p.id,
    email: p.email,
    name: p.full_name,
    role: p.role,
    did: p.primary_did,
    createdAt: p.created_at,
  }));
  return { users, total: users.length };
}

// ─── Audit and fraud ────────────────────────────────────────────────────────

export async function adminGetAudit() {
  const rows = await readAll<Record<string, any>>("audit_events", "logged_at");
  const events = rows.map((e) => ({
    txId: e.tx_id,
    actor: e.actor_did,
    resource: e.resource,
    action: e.action,
    outcome: e.outcome,
    severity: e.severity,
    loggedAt: e.logged_at,
  }));
  return { events, total: events.length };
}

export async function adminGetFraudAlerts() {
  const rows = await readAll<Record<string, any>>("fraud_alerts", "detected_at");
  const alerts = rows.map((a) => ({
    alertId: a.alert_id,
    severity: a.severity,
    status: a.status,
    type: a.alert_type,
    message: a.message,
    actor: a.actor,
    riskScore: a.risk_score,
    detectedAt: a.detected_at,
    details: a.details,
  }));
  return { alerts, total: alerts.length };
}

export async function adminUpdateFraudAlertStatus(alertId: string, status: string) {
  const patch: Record<string, unknown> = { status };
  if (status === "resolved" || status === "dismissed") {
    patch.resolved_at = new Date().toISOString();
  }

  const { data, error } = await getAdminSupabase()
    .from("fraud_alerts")
    .update(patch as never)
    .eq("alert_id", alertId)
    .select("alert_id");

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Alert not found, or administrators only");
  return { success: true as const };
}

// ─── Governance policies ────────────────────────────────────────────────────

export async function adminGetPolicies() {
  const rows = await readAll<Record<string, any>>("governance_policies", "updated_at");
  const policies = rows.map((p) => ({
    id: p.policy_id,
    policyId: p.policy_id,
    name: p.name,
    category: p.category,
    status: p.status,
    description: p.description,
    updatedAt: p.updated_at,
  }));
  return { policies, total: policies.length };
}

export async function adminCreatePolicy(data: {
  name: string;
  category?: string;
  description?: string;
  status?: string;
}) {
  const policyId = `POL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const { error } = await getAdminSupabase()
    .from("governance_policies")
    .insert({
      policy_id: policyId,
      name: data.name,
      category: data.category ?? null,
      description: data.description ?? null,
      status: data.status ?? "draft",
    } as never);

  if (error) {
    // RLS restricts writes to admins; report that plainly.
    if (/row-level security/i.test(error.message)) {
      throw new Error("Only administrators may create a policy");
    }
    throw new Error(error.message);
  }
  return { success: true as const, policyId };
}

export async function adminUpdatePolicy(policyId: string, patch: Record<string, unknown>) {
  const { data, error } = await getAdminSupabase()
    .from("governance_policies")
    .update(patch as never)
    .eq("policy_id", policyId)
    .select("policy_id");

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Policy not found, or administrators only");
  return { success: true as const };
}

// ─── Clinical (RLS-scoped; an admin has no blanket PHI read) ────────────────

export async function adminGetPrescriptions() {
  const rows = await readAll<Record<string, any>>("prescriptions", "created_at");
  return { prescriptions: rows, total: rows.length };
}

export async function adminGetNfcCards() {
  const rows = await readAll<Record<string, any>>("nfc_cards", "issued_at");
  // Legacy `entries` shape the existing screens expect.
  return {
    entries: rows.map((c) => ({
      key: c.card_id,
      value: { ...c, cardId: c.card_id, patientDid: c.patient_did },
    })),
    cards: rows,
  };
}

export async function adminGetPayments() {
  const rows = await readAll<Record<string, any>>("payments", "created_at");
  return { entries: rows.map((p) => ({ key: p.payment_id, value: p })), payments: rows };
}

export async function adminGetVisitors() {
  const rows = await readAll<Record<string, any>>("visitors", "requested_at");
  const visitors = rows.map((v) => ({
    id: v.visitor_id,
    patientDid: v.patient_did,
    visitorName: v.visitor_name,
    relation: v.relation,
    visitDate: v.visit_date,
    purpose: v.purpose,
    status: v.status,
    requestedAt: v.requested_at,
    resolvedAt: v.resolved_at,
  }));
  return { visitors, entries: visitors.map((v) => ({ key: v.id, value: v })) };
}

// ─── Facility assets ────────────────────────────────────────────────────────

export async function adminGetEquipment() {
  const rows = await readAll<Record<string, any>>("equipment", "updated_at");
  const equipment = rows.map((e) => ({
    id: e.equipment_id,
    name: e.name,
    category: e.category,
    status: e.status,
    location: e.location,
    lastServicedOn: e.last_serviced_on,
  }));
  return { equipment, total: equipment.length };
}

export async function adminGetAmbulances() {
  const rows = await readAll<Record<string, any>>("ambulances", "updated_at");
  const ambulances = rows.map((a) => ({
    id: a.ambulance_id,
    registration: a.registration,
    type: a.vehicle_type,
    status: a.status,
    location: a.current_location,
    driver: a.driver_name,
  }));
  return { ambulances, total: ambulances.length };
}

// ─── Financial view helpers ─────────────────────────────────────────────────

/**
 * Patient view model for the financial screen.
 *
 * Clinical and demographic fields are optional because this data comes from the
 * DID registry, not from PHI tables — admins have no blanket PHI read by design.
 * They render as blank rather than crashing the page.
 */
export interface LivePatient {
  did: string;
  name: string;
  status?: string;
  outstandingBills?: number;
  mrn?: string;
  age?: number;
  gender?: string;
  phone?: string;
  email?: string;
  ward?: string;
  bed?: string;
  insuranceProvider?: string;
  insurancePolicyNo?: string;
  outstanding?: number;
  admitDate?: string;
  bloodGroup?: string;
  id?: string;
  isOnChain?: boolean;
  /** Credentials held by this patient, used by the financial statement view. */
  activeCredentials?: Array<{ id: string; type?: string }>;
}

export interface LiveTransaction {
  id: string;
  patientDid: string;
  amount: number;
  status: string;
  /** Billing category — mapped from the payment method. */
  category: string;
  reference?: string;
  method?: string;
  date?: string;
  patientName?: string;
  blockTxId?: string;
}

export async function adminGetLivePatients(): Promise<LivePatient[]> {
  const { data, error } = await getAdminSupabase()
    .from("dids")
    .select("did, owner_name, status")
    .eq("owner_type", "patient");
  if (error) throw new Error(error.message);
  return (data ?? []).map((d: Record<string, any>) => ({
    did: d.did,
    name: d.owner_name,
    status: d.status,
  }));
}

export async function adminGetTransactions(): Promise<LiveTransaction[]> {
  const rows = await readAll<Record<string, any>>("payments", "created_at");
  return rows.map((p) => ({
    id: p.payment_id,
    patientDid: p.patient_did,
    amount: Number(p.amount),
    status: p.status,
    // `method` doubles as the billing category in this view.
    category: p.method ?? "other",
    reference: p.reference ?? undefined,
    method: p.method,
    date: p.created_at,
  }));
}

/**
 * Record a payment. RLS forbids inserting anything other than 'pending', so a
 * client cannot mark a payment settled.
 */
export async function adminRecordPayment(
  patient: string | { did: string },
  amount: number,
  method?: string,
) {
  // Callers pass either a DID or the whole patient object.
  const patientDid = typeof patient === "string" ? patient : patient.did;
  const paymentId = `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const { error } = await getAdminSupabase()
    .from("payments")
    .insert({
      payment_id: paymentId,
      patient_did: patientDid,
      amount,
      method: method ?? "card",
      status: "pending",
    } as never);

  if (error) throw new Error(error.message);
  return { success: true as const, paymentId, status: "pending" as const };
}

// ─── Privileged operations go through Edge Functions ────────────────────────

/**
 * Invoke an Edge Function as the signed-in admin.
 *
 * DID issuance, NFC card lifecycle and audit writes have no client INSERT
 * policy, so they must run server-side where the privileged key lives.
 */
async function invokeEdge(name: string, payload: Record<string, unknown>) {
  const supabase = getAdminSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `${name} failed (${res.status})`);
  return body;
}

export async function adminCreateDID(
  arg1: string | { ownerName?: string; ownerType?: string; [key: string]: unknown },
  ownerTypeArg?: string,
  _publicKey?: string,
  _email?: string,
  _extraFields?: unknown,
) {
  const ownerName = typeof arg1 === "string" ? arg1 : String(arg1.ownerName ?? "");
  const ownerType =
    typeof arg1 === "string" ? (ownerTypeArg ?? "patient") : String(arg1.ownerType ?? "patient");
  const res = await invokeEdge("identity-ops", { op: "create-did", ownerName, ownerType });
  return { success: true as const, did: res.did };
}

export async function adminIssueNFCCard(
  arg1: string | { patientDid: string; patientName?: string; mrn?: string; cardType?: string },
  cardTypeArg?: string,
) {
  const patientDid = typeof arg1 === "string" ? arg1 : arg1.patientDid;
  const cardType = typeof arg1 === "string" ? cardTypeArg : (arg1.cardType ?? cardTypeArg);
  const res = await invokeEdge("identity-ops", { op: "issue-nfc", patientDid, cardType });
  return {
    success: true as const,
    cardId: res.cardId,
    card: { cardId: res.cardId, patientDid },
  };
}

export async function adminRevokeNFCCard(cardId: string) {
  await invokeEdge("identity-ops", { op: "revoke-nfc", cardId });
  return { success: true as const };
}

export async function adminGetDIDRequests() {
  const res = await invokeEdge("identity-ops", { op: "list-did-requests" });
  const requests = (res.requests ?? []).map((r: Record<string, any>) => ({
    id: r.request_id,
    requestId: r.request_id,
    staffId: r.staff_id,
    reason: r.details,
    status: r.status,
    createdAt: r.created_at,
  }));
  return { requests, total: requests.length };
}

export async function adminResolveDIDRequest(requestId: string, approve: boolean) {
  const res = await invokeEdge("identity-ops", { op: "resolve-did-request", requestId, approve });
  return { success: true as const, did: res.did ?? null };
}

export async function adminLogAudit(
  arg1:
    | string
    | {
        action: string;
        resource?: string;
        outcome?: string;
        severity?: string;
        metadata?: Record<string, unknown>;
      },
  resource?: string,
  action?: string,
  outcome?: string,
  severity?: string,
) {
  // Legacy positional form: (actor, resource, action, outcome, severity). The
  // actor argument is ignored — attribution comes from the verified session.
  const data =
    typeof arg1 === "string" ? { action: action ?? arg1, resource, outcome, severity } : arg1;
  try {
    await invokeEdge("identity-ops", { op: "audit", ...data });
    return { success: true as const };
  } catch {
    // An audit failure must not break the action that triggered it.
    return { success: false as const };
  }
}
