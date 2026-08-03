/**
 * Clinical data server functions — Embrace Health Grid
 *
 * Replaces the Express REST calls in src/lib/api.ts for clinical domains.
 *
 * Why these are server functions rather than direct browser queries
 * ----------------------------------------------------------------
 * The browser Supabase client deliberately stores no session (see
 * supabase.browser.ts) so that an XSS payload cannot read the access token.
 * The trade-off is that the browser client is not authenticated on its own, so
 * any user-scoped read has to run server-side where the httpOnly cookie is
 * available.
 *
 * These functions use the ANON key with the caller's session, so **RLS still
 * applies**. They are not a privilege escalation: a patient calling
 * getMedicalRecords receives only their own rows, enforced by Postgres, not by
 * the code here. The RLS test suite proves that directly.
 */

import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";

/** Reject unauthenticated callers before touching the database. */
async function requireSession() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ─── Medical records ────────────────────────────────────────────────────────

export const getMedicalRecords = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  // No patient filter needed: RLS returns own records, plus any the caller has
  // an active consent for. Adding a client-supplied DID filter here would be
  // redundant at best and a bug magnet at worst.
  const { data, error } = await supabase
    .from("medical_records")
    .select("record_id, patient_did, title, record_type, content, author_name, content_hash, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { records: data ?? [] };
});

export const getMedicalRecordsForPatient = createServerFn({ method: "GET" })
  .validator((data: { patientDid: string }) => {
    if (!data?.patientDid) throw new Error("patientDid is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // A clinician viewing a specific patient. If no consent exists RLS returns
    // an empty set rather than an error — absence of rows IS the denial.
    const { data: records, error } = await supabase
      .from("medical_records")
      .select("record_id, patient_did, title, record_type, content, author_name, content_hash, created_at")
      .eq("patient_did", data.patientDid)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { records: records ?? [] };
  });

// ─── Prescriptions ──────────────────────────────────────────────────────────

export const getPrescriptions = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("prescriptions")
    .select("rx_id, patient_did, doctor_did, drugs, diagnosis, notes, status, signed, signed_at, content_hash, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { prescriptions: data ?? [] };
});

export const getPrescriptionsForPatient = createServerFn({ method: "GET" })
  .validator((data: { patientDid: string }) => {
    if (!data?.patientDid) throw new Error("patientDid is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: rows, error } = await supabase
      .from("prescriptions")
      .select("rx_id, patient_did, doctor_did, drugs, diagnosis, notes, status, signed, signed_at, content_hash, created_at")
      .eq("patient_did", data.patientDid)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { prescriptions: rows ?? [] };
  });

// ─── Lab results ────────────────────────────────────────────────────────────

export const getLabResults = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("lab_results")
    .select("lab_id, patient_did, test_name, result_value, unit, reference_range, status, resulted_at, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { labResults: data ?? [] };
});

// ─── Appointments ───────────────────────────────────────────────────────────

export const getAppointments = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("appt_id, patient_did, doctor_did, slot, mode, specialty, status, reason, booked_at")
    .order("booked_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { appointments: data ?? [] };
});

export const bookAppointment = createServerFn({ method: "POST" })
  .validator((data: { doctorDid: string; slot: string; specialty?: string; mode?: string }) => {
    if (!data?.doctorDid || !data?.slot) throw new Error("doctorDid and slot are required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // The caller's own DID, so a patient cannot book on someone else's behalf.
    // appointments_insert_patient enforces this in RLS regardless.
    const { data: profile } = await supabase
      .from("profiles")
      .select("primary_did")
      .single();

    if (!profile?.primary_did) throw new Error("No DID associated with this account");

    const apptId = `appt_${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from("appointments").insert({
      appt_id: apptId,
      patient_did: profile.primary_did,
      doctor_did: data.doctorDid,
      slot: data.slot,
      mode: data.mode ?? "in-person",
      specialty: data.specialty ?? null,
      status: "pending",
    });

    if (error) throw new Error(error.message);
    return { ok: true as const, apptId };
  });

// ─── Consents ───────────────────────────────────────────────────────────────

export const getConsents = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("consents")
    .select("grant_id, patient_did, doctor_did, resource, status, granted_at, expires_at, revoked_at")
    .order("granted_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { consents: data ?? [] };
});

export const grantConsent = createServerFn({ method: "POST" })
  .validator((data: { doctorDid: string; resource: string; expiresAt?: string }) => {
    if (!data?.doctorDid || !data?.resource) throw new Error("doctorDid and resource are required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: profile } = await supabase.from("profiles").select("primary_did").single();
    if (!profile?.primary_did) throw new Error("No DID associated with this account");

    const grantId = `consent_${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from("consents").insert({
      grant_id: grantId,
      patient_did: profile.primary_did,
      doctor_did: data.doctorDid,
      resource: data.resource,
      status: "active",
      expires_at: data.expiresAt ?? null,
    });

    if (error) throw new Error(error.message);
    return { ok: true as const, grantId };
  });

export const revokeConsent = createServerFn({ method: "POST" })
  .validator((data: { grantId: string }) => {
    if (!data?.grantId) throw new Error("grantId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // consents_update_patient restricts this to grants the caller issued.
    const { data: updated, error } = await supabase
      .from("consents")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("grant_id", data.grantId)
      .select("grant_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Consent not found, or you are not the grantor");

    return { ok: true as const };
  });

// ─── DIDs and credentials ───────────────────────────────────────────────────

export const getAllDIDs = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("dids")
    .select("did, owner_name, owner_type, public_key, controller, status, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { dids: data ?? [], total: data?.length ?? 0 };
});

export const getCredentials = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("credentials")
    .select("id, credential_type, issuer, subject_did, claims, signature, status, issued_at, expires_at")
    .order("issued_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { credentials: data ?? [] };
});

// ─── Blockchain verification data ───────────────────────────────────────────

/**
 * Anchors and merkle roots are readable by any authenticated user because
 * verification must not require trusting a server: the client recomputes
 * SHA-256 over public data and compares. These are hashes, never PHI.
 */
export const getAnchors = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("solana_anchors")
    .select("anchor_id, record_hash, record_type, record_id, status, signature, slot, network, anchored_at, confirmed_at")
    .order("anchored_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return { anchors: data ?? [] };
});

export const getMerkleRoots = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("merkle_roots")
    .select("publish_id, subject_did, root_hash, event_count, event_ids, period_date, anchor_id, published_at")
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return { roots: data ?? [] };
});

// ─── Audit trail ────────────────────────────────────────────────────────────

export const getAuditEvents = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  // RLS: own trail, or everything for an admin.
  const { data, error } = await supabase
    .from("audit_events")
    .select("tx_id, actor_did, resource, action, outcome, severity, logged_at")
    .order("logged_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return { events: data ?? [] };
});

// ─── Realtime socket token ──────────────────────────────────────────────────

/**
 * Mint the access token used to authenticate the Realtime WebSocket.
 *
 * The browser client deliberately holds no session, so subscriptions would
 * otherwise be anonymous and RLS-protected tables would deliver no events.
 * Only the server can read the httpOnly cookie, so it hands the token over
 * explicitly.
 *
 * The token is passed to supabase.realtime.setAuth() and never persisted to
 * localStorage, sessionStorage, or any JS-readable cookie. It is short-lived
 * and refreshed by calling this again.
 */
export const getRealtimeToken = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getVerifiedUser();
  if (!user) return { token: null as string | null };

  const supabase = getSupabaseServerClient();
  const { data } = await supabase.auth.getSession();

  return { token: data.session?.access_token ?? null };
});

// ─── Writes that must go through Edge Functions ─────────────────────────────

/**
 * Invoke a deployed Edge Function on the caller's behalf.
 *
 * Some operations cannot be plain table writes because they need a secret the
 * browser must never hold — the Solana wallet key, the VC issuer key. Those run
 * as Edge Functions; this forwards the caller's verified session so the function
 * can authorise them.
 */
async function invokeEdgeFunction(name: string, payload: unknown) {
  const supabase = getSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `${name} failed with status ${res.status}`);
  }
  return body;
}

/**
 * Anchor a record hash on Solana devnet.
 * Real on-chain transaction — the wallet key lives only in the Edge Function.
 */
export const anchorRecord = createServerFn({ method: "POST" })
  .validator((data: { subjectDid: string; recordHash: string; recordType: string; recordId?: string }) => {
    if (!data?.subjectDid || !data?.recordHash || !data?.recordType) {
      throw new Error("subjectDid, recordHash and recordType are required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    return await invokeEdgeFunction("anchor-record", data);
  });

/** Publish a merkle root for a subject/day. */
export const publishMerkleRoot = createServerFn({ method: "POST" })
  .validator((data: { subjectDid: string; periodDate: string; events: unknown[] }) => {
    if (!data?.subjectDid || !data?.periodDate || !Array.isArray(data?.events)) {
      throw new Error("subjectDid, periodDate and events[] are required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    return await invokeEdgeFunction("publish-merkle-root", data);
  });

/** Issue a signed Verifiable Credential (issuer key stays server-side). */
export const signCredential = createServerFn({ method: "POST" })
  .validator((data: { subjectDid: string; credentialType: string; claims?: Record<string, unknown> }) => {
    if (!data?.subjectDid || !data?.credentialType) {
      throw new Error("subjectDid and credentialType are required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    return await invokeEdgeFunction("sign-credential", data);
  });

/**
 * Build an UNSIGNED anchoring transaction for the patient to sign themselves.
 *
 * Distinct from the anchor-record Edge Function, which signs with the platform
 * wallet. Here the patient is the on-chain authority: they connect Phantom and
 * sign, so their records are anchored under a key only they control. The server
 * never holds the patient's key — it only assembles the instruction.
 *
 * Returns a base64 serialised transaction plus the merkle root it commits to.
 */
export const buildPatientAnchorTx = createServerFn({ method: "POST" })
  .validator((data: { authorityPubkey: string }) => {
    if (!data?.authorityPubkey) throw new Error("authorityPubkey is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: profile } = await supabase.from("profiles").select("primary_did").single();
    if (!profile?.primary_did) throw new Error("No DID associated with this account");
    const patientDid = profile.primary_did;

    // Records visible to the caller — RLS guarantees these are their own.
    const { data: records, error } = await supabase
      .from("medical_records")
      .select("record_id, content_hash")
      .eq("patient_did", patientDid)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    if (!records?.length) throw new Error("No records to anchor");

    // Merkle root over record hashes, matching lib/merkle-tree.js semantics
    // (pairwise SHA-256, last node duplicated on an odd count).
    const sha256Hex = async (input: string) => {
      const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
      return Array.from(new Uint8Array(d))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    };

    let level = await Promise.all(
      records.map((r) => sha256Hex(r.content_hash ?? r.record_id)),
    );
    while (level.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        next.push(await sha256Hex(level[i] + (level[i + 1] ?? level[i])));
      }
      level = next;
    }
    const merkleRoot = level[0];

    // Assemble the Anchor instruction. Imported lazily so @solana/web3.js is
    // not pulled into unrelated server bundles.
    const { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } =
      await import("@solana/web3.js");
    const { encodeRegisterPatientRoot, encodeUpdatePatientRoot } = await import(
      "./anchor-encoding"
    );

    const programId = process.env.VITE_SOLANA_PROGRAM_ID ?? process.env.SOLANA_PROGRAM_ID ?? "";
    if (!programId) throw new Error("SOLANA_PROGRAM_ID is not configured");

    const rpcUrl = process.env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    const authority = new PublicKey(data.authorityPubkey);

    const [pda] = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode("patient-root"), new TextEncoder().encode(patientDid)],
      new PublicKey(programId),
    );

    // register_* uses `init` and fails if the account exists.
    const existing = await connection.getAccountInfo(pda);
    const ixData = existing
      ? await encodeUpdatePatientRoot(patientDid, merkleRoot)
      : await encodeRegisterPatientRoot(patientDid, merkleRoot);

    const keys = existing
      ? [
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: authority, isSigner: true, isWritable: false },
        ]
      : [
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: authority, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ];

    const tx = new Transaction().add(
      new TransactionInstruction({ keys, programId: new PublicKey(programId), data: Buffer.from(ixData) }),
    );
    tx.feePayer = authority;
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    // requireAllSignatures: false — the patient's wallet signs client-side.
    const serialised = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

    return {
      ok: true as const,
      transactionPayload: Buffer.from(serialised).toString("base64"),
      merkleRoot,
      pda: pda.toBase58(),
      recordCount: records.length,
      instruction: existing ? "update_patient_root" : "register_patient_root",
    };
  });
/**
 * Create a medical record.
 *
 * Permitted directly because medical_records_insert_clinician requires the
 * caller to be a doctor/staff member WITH an active consent — RLS rejects the
 * insert otherwise, so no server-side role check is duplicated here.
 */
export const createMedicalRecord = createServerFn({ method: "POST" })
  .validator((data: {
    patientDid: string;
    title: string;
    recordType: string;
    content?: string;
  }) => {
    if (!data?.patientDid || !data?.title || !data?.recordType) {
      throw new Error("patientDid, title and recordType are required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: profile } = await supabase.from("profiles").select("primary_did, full_name").single();

    const recordId = `REC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // Hash the clinical content so it can be anchored on-chain without
    // exposing PHI. Only the digest ever leaves Postgres.
    const encoded = new TextEncoder().encode(
      JSON.stringify({ recordId, patientDid: data.patientDid, title: data.title, content: data.content ?? "" }),
    );
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    const contentHash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { error } = await supabase.from("medical_records").insert({
      record_id: recordId,
      patient_did: data.patientDid,
      title: data.title,
      record_type: data.recordType,
      content: data.content ?? null,
      author_did: profile?.primary_did ?? null,
      author_name: profile?.full_name ?? null,
      content_hash: contentHash,
    });

    if (error) {
      // An RLS rejection here means no active consent — surface that plainly.
      if (/row-level security/i.test(error.message)) {
        throw new Error("Cannot create a record for this patient: no active consent");
      }
      throw new Error(error.message);
    }

    return { ok: true as const, recordId, contentHash };
  });
