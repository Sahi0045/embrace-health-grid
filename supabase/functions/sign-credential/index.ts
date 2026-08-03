/**
 * Edge Function: sign-credential
 *
 * Issues a signed Verifiable Credential. Runs server-side because the issuer
 * private key must never reach a browser.
 *
 * Fixes a critical bug in the legacy implementation
 * ------------------------------------------------
 * backend/lib/vc-sign.js called generateKeyPairSync("ed25519") lazily and kept
 * the result in a module variable. That means a NEW issuer key was generated on
 * every process start, so every credential signed before a restart became
 * permanently unverifiable. Verified by observing the fingerprint change
 * between two runs (2392cddc... then 5a5ace5b...).
 *
 * Here the key is loaded from the ISSUER_PRIVATE_KEY secret, so it is stable
 * across restarts and deploys, and signatures remain verifiable.
 *
 * Authorization: only doctors, staff and admins may issue credentials.
 */

import { requireCaller, serviceClient, audit, json, errorResponse, HttpError } from "../_shared/deps.ts";

/** Load the issuer signing key from the environment (PKCS#8 PEM). */
async function getIssuerKey(): Promise<{ key: CryptoKey; fingerprint: string }> {
  const pem = Deno.env.get("ISSUER_PRIVATE_KEY");
  if (!pem) {
    throw new HttpError(
      500,
      "ISSUER_PRIVATE_KEY is not configured. Credentials cannot be signed without a stable issuer key.",
    );
  }

  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);

  const fingerprint = Deno.env.get("ISSUER_KEY_FINGERPRINT") ?? "unknown";
  return { key, fingerprint };
}

/**
 * Deterministic serialisation. Signing a canonical form means verification does
 * not depend on JSON key ordering.
 */
function canonicalise(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = serviceClient();
  let caller;

  try {
    caller = await requireCaller(req);

    if (!["doctor", "staff", "admin"].includes(caller.role)) {
      throw new HttpError(403, "Only clinical staff may issue credentials");
    }

    const body = await req.json();
    const { subjectDid, credentialType, claims, expiresAt } = body ?? {};

    if (!subjectDid || !credentialType) {
      throw new HttpError(400, "subjectDid and credentialType are required");
    }

    // The subject DID must exist — otherwise we would sign a credential
    // referencing nothing, which no verifier could resolve.
    const { data: subject, error: sErr } = await db
      .from("dids")
      .select("did, status")
      .eq("did", subjectDid)
      .single();

    if (sErr || !subject) throw new HttpError(404, `Unknown subject DID: ${subjectDid}`);
    if (subject.status !== "active") {
      throw new HttpError(409, `Subject DID is ${subject.status}; refusing to issue`);
    }

    const issuedAt = new Date().toISOString();
    const credentialId = `vc_${crypto.randomUUID()}`;

    const vcPayload = {
      id: credentialId,
      type: credentialType,
      issuer: "did:hosp:consortium:authority",
      subject: subjectDid,
      claims: claims ?? {},
      issuedAt,
      expiresAt: expiresAt ?? null,
    };

    const { key, fingerprint } = await getIssuerKey();
    const signatureBytes = await crypto.subtle.sign(
      { name: "Ed25519" },
      key,
      new TextEncoder().encode(canonicalise(vcPayload)),
    );
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    // credentials has no client INSERT policy — service_role only.
    const { error: iErr } = await db.from("credentials").insert({
      id: credentialId,
      credential_type: credentialType,
      issuer: vcPayload.issuer,
      subject_did: subjectDid,
      claims: vcPayload.claims,
      signature,
      status: "valid",
      issued_at: issuedAt,
      expires_at: expiresAt ?? null,
    });

    if (iErr) throw new HttpError(500, `Could not persist credential: ${iErr.message}`);

    await audit(db, {
      actor_id: caller.userId,
      actor_did: caller.dids[0] ?? null,
      resource: credentialId,
      action: "CREDENTIAL_ISSUED",
      outcome: "success",
      metadata: { subjectDid, credentialType, keyFingerprint: fingerprint },
    });

    return json({
      ok: true,
      credential: { ...vcPayload, signature, proofType: "Ed25519Signature2020", keyFingerprint: fingerprint },
    });
  } catch (err) {
    if (caller) {
      await audit(db, {
        actor_id: caller.userId,
        action: "CREDENTIAL_ISSUE_FAILED",
        outcome: "failure",
        severity: "warning",
        metadata: { reason: err instanceof Error ? err.message : String(err) },
      });
    }
    return errorResponse(err);
  }
});
