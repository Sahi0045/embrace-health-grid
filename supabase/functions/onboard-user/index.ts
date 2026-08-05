/**
 * Edge Function: onboard-user
 *
 * Creates a person and everything that makes them usable, as one operation:
 *
 *   1. an auth.users row (so they can sign in)
 *   2. a profiles row (role, name — what RLS keys off)
 *   3. a DID (their identity in the registry)
 *   4. a signed identity credential (Ed25519, issued by the platform)
 *   5. optionally an NFC card (patients)
 *
 * Why this is a single Edge Function rather than four client calls
 * ---------------------------------------------------------------
 * Every one of those tables has NO client INSERT policy: auth.users needs
 * service_role, and dids / credentials / nfc_cards are deliberately writable
 * only by the server so a client cannot mint an identity for itself.
 *
 * Doing it in one place also means partial failure is handled. If the DID
 * insert succeeds but the credential signing fails, we roll back the rows we
 * created rather than leaving an account that can sign in but has no usable
 * identity — which is worse than no account at all.
 *
 * Authorisation: a hospital admin may onboard anyone into THEIR OWN hospital.
 * Staff and doctors may onboard patients only, because letting a receptionist
 * mint a doctor account would be privilege escalation. A super_admin may target
 * any hospital.
 *
 * The hospital is read from the caller's profile, not the request body, so a
 * hospital admin cannot create staff inside a hospital they do not belong to.
 * The credential is issued under that hospital's DID, so it proves which
 * hospital vouched for the person.
 */

import {
  requireCaller,
  serviceClient,
  audit,
  json,
  errorResponse,
  HttpError,
} from "../_shared/deps.ts";

type Role = "patient" | "doctor" | "staff" | "admin";

/** Load the issuer signing key (PKCS#8 PEM) from the function secret. */
async function getIssuerKey(): Promise<{ key: CryptoKey; fingerprint: string }> {
  const pem = Deno.env.get("ISSUER_PRIVATE_KEY");
  if (!pem) throw new HttpError(500, "ISSUER_PRIVATE_KEY is not configured");

  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0));

  const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);
  return { key, fingerprint: Deno.env.get("ISSUER_KEY_FINGERPRINT") ?? "unknown" };
}

/** Deterministic serialisation so verification is independent of key order. */
function canonicalise(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = serviceClient();
  let caller;

  // Track what we created so a later failure can be undone.
  let createdUserId: string | null = null;
  let createdDid: string | null = null;
  let createdCredentialId: string | null = null;

  try {
    caller = await requireCaller(req);

    const body = await req.json();
    const {
      email,
      password,
      fullName,
      role,
      issueNfcCard = false,
      mrn,
      department,
      specialty,
    } = body ?? {};

    if (!email || !password || !fullName || !role) {
      throw new HttpError(400, "email, password, fullName and role are required");
    }
    if (!["patient", "doctor", "staff", "admin"].includes(role)) {
      throw new HttpError(400, `Unknown role: ${role}`);
    }
    if (String(password).length < 8) {
      throw new HttpError(400, "Password must be at least 8 characters");
    }

    // ── Authorisation ───────────────────────────────────────────────────────
    // A hospital admin may create any role, but only inside their own hospital.
    // Staff and doctors may create patients only, so a clinician cannot mint
    // colleagues or an admin. A super_admin may target any hospital, which is
    // why it is the only role permitted to pass hospitalId.
    if (caller.role === "super_admin" || caller.role === "admin") {
      // may create any role
    } else if (caller.role === "staff" || caller.role === "doctor") {
      if (role !== "patient") {
        throw new HttpError(
          403,
          "Only an administrator may create staff, doctor or admin accounts",
        );
      }
    } else {
      throw new HttpError(403, "You are not permitted to onboard users");
    }

    // ── Which hospital does this person belong to? ───────────────────────────
    // Taken from the caller's own profile, never from the request body, so a
    // hospital admin cannot create staff inside another hospital by passing a
    // different id. Only a super_admin may nominate one.
    let targetHospitalId: string | null;

    if (caller.role === "super_admin") {
      targetHospitalId = body?.hospitalId ?? null;
      if (role !== "patient" && !targetHospitalId) {
        throw new HttpError(
          400,
          "hospitalId is required when a super administrator creates a staff account",
        );
      }
    } else {
      targetHospitalId = caller.hospitalId;
      if (!targetHospitalId) {
        throw new HttpError(403, "Your account is not associated with a hospital");
      }
    }

    // Resolve the hospital's DID: it becomes the issuing authority for this
    // person's credential, replacing the single hardcoded consortium DID. That is
    // what lets a credential prove WHICH hospital vouched for a clinician.
    let issuerDid = "did:hosp:consortium:authority";
    if (targetHospitalId) {
      const { data: hospital, error: hErr } = await db
        .from("hospitals")
        .select("hospital_did, status")
        .eq("hospital_id", targetHospitalId)
        .maybeSingle();

      if (hErr || !hospital) throw new HttpError(400, "Unknown hospital");
      if (hospital.status !== "active") {
        throw new HttpError(403, "That hospital is suspended and cannot onboard users");
      }
      issuerDid = hospital.hospital_did;
    }

    // ── 1. auth user ────────────────────────────────────────────────────────
    const { data: created, error: authErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // no confirmation flow for staff-provisioned accounts
      user_metadata: { full_name: fullName, onboarded_by: caller.userId },
    });

    if (authErr) {
      // Surface the common case plainly rather than leaking the raw message.
      // Supabase phrases this several ways depending on version.
      if (/already registered|already exists|duplicate|been registered/i.test(authErr.message)) {
        throw new HttpError(409, `An account already exists for ${email}`);
      }
      throw new HttpError(500, `Could not create the account: ${authErr.message}`);
    }
    createdUserId = created.user.id;

    // ── 2. profile ──────────────────────────────────────────────────────────
    // Must precede the DID: dids.owner_id references profiles(id), so inserting
    // the DID first violates that foreign key.
    const { error: profErr } = await db.from("profiles").insert({
      id: createdUserId,
      email,
      full_name: fullName,
      role: role as Role,
      hospital_id: targetHospitalId,
    });
    if (profErr) throw new HttpError(500, `Profile creation failed: ${profErr.message}`);

    // ── 3. DID ──────────────────────────────────────────────────────────────
    const did = `did:hosp:0x${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const { error: didErr } = await db.from("dids").insert({
      did,
      owner_id: createdUserId,
      owner_name: fullName,
      owner_type: role as Role,
      public_key: `pk_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
      // Controlled by the hospital that issued it, not the platform.
      controller: issuerDid,
      status: "active",
      hospital_id: targetHospitalId,
    });
    if (didErr) throw new HttpError(500, `DID issuance failed: ${didErr.message}`);
    createdDid = did;

    // Link the profile to its primary DID now that the DID row exists.
    const { error: linkErr } = await db
      .from("profiles")
      .update({ primary_did: did })
      .eq("id", createdUserId);
    if (linkErr)
      throw new HttpError(500, `Could not link the DID to the profile: ${linkErr.message}`);

    // ── 4. identity credential ──────────────────────────────────────────────
    const credentialId = `vc_${crypto.randomUUID()}`;
    const issuedAt = new Date().toISOString();

    const claims: Record<string, unknown> = { name: fullName, role };
    if (mrn) claims.mrn = mrn;
    if (department) claims.department = department;
    if (specialty) claims.specialty = specialty;

    const vcPayload = {
      id: credentialId,
      type: role === "patient" ? "IdentityVC" : "ProfessionalVC",
      issuer: issuerDid,
      subject: did,
      claims,
      issuedAt,
      expiresAt: null,
    };

    const { key, fingerprint } = await getIssuerKey();
    const sigBytes = await crypto.subtle.sign(
      { name: "Ed25519" },
      key,
      new TextEncoder().encode(canonicalise(vcPayload)),
    );
    const signature = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));

    const { error: credErr } = await db.from("credentials").insert({
      id: credentialId,
      credential_type: vcPayload.type,
      issuer: vcPayload.issuer,
      subject_did: did,
      claims,
      signature,
      status: "valid",
      issued_at: issuedAt,
    });
    if (credErr) throw new HttpError(500, `Credential issuance failed: ${credErr.message}`);
    createdCredentialId = credentialId;

    // ── 5. NFC card (optional) ──────────────────────────────────────────────
    let cardId: string | null = null;
    if (issueNfcCard) {
      cardId = `NFC-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
      const { error: cardErr } = await db.from("nfc_cards").insert({
        card_id: cardId,
        patient_did: did,
        card_type: role === "patient" ? "patient" : "staff",
        status: "active",
        issued_by: caller.userId,
      });
      // A failed card must not undo a valid account — report it instead.
      if (cardErr) cardId = null;
    }

    await audit(db, {
      actor_id: caller.userId,
      actor_did: caller.dids[0] ?? null,
      resource: did,
      action: "USER_ONBOARDED",
      outcome: "success",
      metadata: {
        email,
        role,
        did,
        credentialId,
        cardId,
        keyFingerprint: fingerprint,
        hospitalId: targetHospitalId,
        issuerDid,
      },
    });

    return json({
      ok: true,
      userId: createdUserId,
      email,
      role,
      did,
      credentialId,
      cardId,
      signature,
      hospitalId: targetHospitalId,
      issuerDid,
    });
  } catch (err) {
    // ── Roll back partial state ─────────────────────────────────────────────
    // An account that can sign in but has no DID or credential is worse than no
    // account: the user gets a broken session and an admin sees a phantom row.
    if (createdCredentialId) {
      await db
        .from("credentials")
        .delete()
        .eq("id", createdCredentialId)
        .then(
          () => {},
          () => {},
        );
    }
    if (createdDid) {
      await db
        .from("dids")
        .delete()
        .eq("did", createdDid)
        .then(
          () => {},
          () => {},
        );
    }
    if (createdUserId) {
      // Deleting the auth user cascades the profile row.
      await db.auth.admin.deleteUser(createdUserId).then(
        () => {},
        () => {},
      );
    }

    if (caller) {
      await audit(db, {
        actor_id: caller.userId,
        action: "USER_ONBOARD_FAILED",
        outcome: "failure",
        severity: "warning",
        metadata: { reason: err instanceof Error ? err.message : String(err) },
      });
    }

    return errorResponse(err);
  }
});
