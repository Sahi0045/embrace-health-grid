/**
 * Edge Function: identity-ops
 *
 * Operations that require a server-held secret or a privileged write, and so
 * cannot run in a browser:
 *
 *   sign-identity    HMAC-sign a short-lived identity payload (NFC / QR)
 *   verify-identity  verify such a payload in constant time
 *   wallet-challenge issue a nonce for wallet ownership proof
 *   wallet-link      verify an Ed25519 signature and link the wallet
 *   create-did       issue a DID (privileged: dids has no client INSERT policy)
 *   did-request      patient-initiated DID request
 *   resolve-request  approve or reject a DID request (admin)
 *   issue-nfc        issue an NFC card (privileged)
 *   revoke-nfc       revoke an NFC card (privileged)
 *   audit            write an audit entry (clients cannot insert audit rows)
 *
 * Dispatch is by an `op` field rather than ten separate functions, because they
 * share the same secret material and authorisation logic. Every branch
 * re-checks the caller's role — being reachable is not authorisation.
 */

import {
  requireCaller,
  serviceClient,
  audit,
  json,
  errorResponse,
  HttpError,
} from "../_shared/deps.ts";

/** HMAC-SHA256 over a canonical payload, using IDENTITY_SECRET. */
async function hmacSign(canonical: string): Promise<string> {
  const secret = Deno.env.get("IDENTITY_SECRET");
  if (!secret) throw new HttpError(500, "IDENTITY_SECRET is not configured");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical));
  // base64url so the value is safe in a QR code or URL.
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Fixed field order so verification cannot be tricked by re-ordered JSON keys.
 * Mirrors backend/lib/identity.js.
 */
function canonicalIdentity(p: Record<string, unknown>): string {
  return JSON.stringify({
    did: p.did ?? null,
    mrn: p.mrn ?? null,
    name: p.name ?? null,
    exp: p.exp ?? null,
    network: p.network ?? null,
  });
}

/** Constant-time comparison — a length-independent early return leaks bytes. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const DEFAULT_TTL_MS = 60_000;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = serviceClient();
  let caller;

  try {
    caller = await requireCaller(req);
    const body = await req.json();
    const op = String(body?.op ?? "");

    switch (op) {
      // ─── Identity payload signing ──────────────────────────────────────────
      case "sign-identity": {
        const { did, mrn, name, network } = body;
        if (!did) throw new HttpError(400, "did is required");

        // A clinician must not mint a payload for a DID they do not own.
        if (caller.role !== "admin" && !caller.dids.includes(did)) {
          throw new HttpError(403, "Cannot sign an identity payload for another DID");
        }

        // Short expiry: these are presented in person, not stored.
        const payload = {
          did,
          mrn: mrn ?? null,
          name: name ?? null,
          network: network ?? "devnet",
          exp: Date.now() + DEFAULT_TTL_MS,
        };
        const sig = await hmacSign(canonicalIdentity(payload));

        return json({ ok: true, payload: { ...payload, sig } });
      }

      case "verify-identity": {
        const payload = body?.payload;
        if (!payload?.sig) return json({ valid: false, error: "Missing signature" });
        if (!payload.exp || payload.exp <= Date.now()) {
          return json({ valid: false, error: "Payload expired" });
        }

        const expected = await hmacSign(canonicalIdentity(payload));
        if (!timingSafeEqual(String(payload.sig), expected)) {
          await audit(db, {
            actor_id: caller.userId,
            resource: String(payload.did ?? ""),
            action: "IDENTITY_VERIFY_FAILED",
            outcome: "failure",
            severity: "warning",
          });
          return json({ valid: false, error: "Invalid signature" });
        }

        return json({ valid: true, payload });
      }

      // ─── Wallet linking ────────────────────────────────────────────────────
      case "wallet-challenge": {
        // A random nonce the wallet must sign, proving key possession.
        const nonce = crypto.randomUUID();
        const expiresAt = Date.now() + 5 * 60_000;
        const challenge = { nonce, expiresAt, userId: caller.userId };
        const sig = await hmacSign(JSON.stringify(challenge));

        return json({
          ok: true,
          // Signing our own challenge lets us verify it later without storing it.
          challenge: `Link this wallet to Embrace Health Grid. Nonce: ${nonce}`,
          nonce,
          expiresAt,
          token: sig,
        });
      }

      case "wallet-link": {
        const { walletAddress, nonce, expiresAt, token } = body;
        if (!walletAddress || !nonce || !token) {
          throw new HttpError(400, "walletAddress, nonce and token are required");
        }
        if (!expiresAt || expiresAt <= Date.now()) {
          throw new HttpError(400, "Challenge has expired");
        }

        // Confirm the challenge is one we issued to THIS caller.
        const expected = await hmacSign(
          JSON.stringify({ nonce, expiresAt, userId: caller.userId }),
        );
        if (!timingSafeEqual(String(token), expected)) {
          throw new HttpError(403, "Challenge does not belong to this session");
        }

        // Wallet address is stored on the profile, not treated as an auth factor.
        const { error } = await db
          .from("profiles")
          .update({ wallet_address: walletAddress })
          .eq("id", caller.userId);

        // wallet_address may not exist yet; report clearly rather than silently.
        if (error && /column .* does not exist/i.test(error.message)) {
          throw new HttpError(501, "Wallet linking requires a profiles.wallet_address column");
        }
        if (error) throw new HttpError(500, error.message);

        await audit(db, {
          actor_id: caller.userId,
          resource: walletAddress,
          action: "WALLET_LINKED",
          outcome: "success",
        });

        return json({ ok: true, walletAddress });
      }

      // ─── DID lifecycle ─────────────────────────────────────────────────────
      case "create-did": {
        if (!["staff", "admin"].includes(caller.role)) {
          throw new HttpError(403, "Only staff may issue DIDs");
        }
        const { ownerName, ownerType, ownerId, publicKey } = body;
        if (!ownerName || !ownerType) {
          throw new HttpError(400, "ownerName and ownerType are required");
        }

        // Deterministic-looking but random suffix, matching the legacy format.
        const did = `did:hosp:0x${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
        const { error } = await db.from("dids").insert({
          did,
          owner_id: ownerId ?? null,
          owner_name: ownerName,
          owner_type: ownerType,
          public_key: publicKey ?? `pk_${crypto.randomUUID().slice(0, 12)}`,
          controller: "did:hosp:consortium:authority",
          status: "active",
        });
        if (error) throw new HttpError(500, error.message);

        await audit(db, {
          actor_id: caller.userId,
          resource: did,
          action: "DID_CREATED",
          outcome: "success",
          metadata: { ownerType },
        });

        return json({ ok: true, did });
      }

      case "did-request": {
        const { reason } = body;
        const requestId = `DIDREQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

        const { error } = await db.from("staff_requests").insert({
          request_id: requestId,
          staff_id: caller.userId,
          request_type: "did-issuance",
          subject: "DID issuance request",
          details: reason ?? null,
          status: "pending",
        });
        if (error) throw new HttpError(500, error.message);

        return json({ ok: true, requestId });
      }

      case "list-did-requests": {
        if (caller.role !== "admin") throw new HttpError(403, "Administrators only");

        const { data, error } = await db
          .from("staff_requests")
          .select("*")
          .eq("request_type", "did-issuance")
          .order("created_at", { ascending: false });
        if (error) throw new HttpError(500, error.message);

        return json({ ok: true, requests: data ?? [] });
      }

      case "resolve-did-request": {
        if (caller.role !== "admin") throw new HttpError(403, "Administrators only");
        const { requestId, approve } = body;
        if (!requestId) throw new HttpError(400, "requestId is required");

        const { data, error } = await db
          .from("staff_requests")
          .update({
            status: approve ? "approved" : "rejected",
            resolved_at: new Date().toISOString(),
            resolved_by: caller.userId,
          })
          .eq("request_id", requestId)
          .select("request_id");
        if (error) throw new HttpError(500, error.message);
        if (!data?.length) throw new HttpError(404, "Request not found");

        // Approving a request is what actually issues the DID — otherwise the
        // request would be marked approved with nothing created, which the
        // admin UI (and the requester) would reasonably read as a failure.
        let issuedDid: string | null = null;
        if (approve) {
          const { data: reqRow } = await db
            .from("staff_requests")
            .select("staff_id, details")
            .eq("request_id", requestId)
            .maybeSingle();

          const { data: profile } = await db
            .from("profiles")
            .select("full_name, role")
            .eq("id", reqRow?.staff_id ?? "")
            .maybeSingle();

          issuedDid = `did:hosp:0x${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
          const { error: didErr } = await db.from("dids").insert({
            did: issuedDid,
            owner_id: reqRow?.staff_id ?? null,
            owner_name: profile?.full_name ?? "Unknown",
            owner_type: profile?.role ?? "patient",
            public_key: `pk_${crypto.randomUUID().slice(0, 12)}`,
            controller: "did:hosp:consortium:authority",
            status: "active",
          });
          if (didErr)
            throw new HttpError(500, `Request approved but DID issuance failed: ${didErr.message}`);
        }

        await audit(db, {
          actor_id: caller.userId,
          resource: requestId,
          action: approve ? "DID_REQUEST_APPROVED" : "DID_REQUEST_REJECTED",
          outcome: "success",
          metadata: issuedDid ? { issuedDid } : {},
        });

        return json({ ok: true, did: issuedDid });
      }

      // ─── NFC card lifecycle ────────────────────────────────────────────────
      case "issue-nfc": {
        if (!["staff", "admin"].includes(caller.role)) {
          throw new HttpError(403, "Only staff may issue cards");
        }
        const { patientDid, cardType } = body;
        if (!patientDid) throw new HttpError(400, "patientDid is required");

        const cardId = `NFC-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
        const { error } = await db.from("nfc_cards").insert({
          card_id: cardId,
          patient_did: patientDid,
          card_type: cardType ?? "patient",
          status: "active",
          issued_by: caller.userId,
        });
        if (error) throw new HttpError(500, error.message);

        await audit(db, {
          actor_id: caller.userId,
          resource: cardId,
          action: "NFC_CARD_ISSUED",
          outcome: "success",
          metadata: { patientDid },
        });

        return json({ ok: true, cardId });
      }

      case "revoke-nfc": {
        if (!["staff", "admin"].includes(caller.role)) {
          throw new HttpError(403, "Only staff may revoke cards");
        }
        const { cardId } = body;
        if (!cardId) throw new HttpError(400, "cardId is required");

        const { data, error } = await db
          .from("nfc_cards")
          .update({ status: "revoked", revoked_at: new Date().toISOString() })
          .eq("card_id", cardId)
          .select("card_id");
        if (error) throw new HttpError(500, error.message);
        if (!data?.length) throw new HttpError(404, "Card not found");

        await audit(db, {
          actor_id: caller.userId,
          resource: cardId,
          action: "NFC_CARD_REVOKED",
          outcome: "success",
        });

        return json({ ok: true });
      }

      // ─── Audit ─────────────────────────────────────────────────────────────
      case "audit": {
        // Clients have no INSERT policy on audit_events by design, so this is
        // the only path. The actor is taken from the verified session, never
        // from the request body — otherwise an actor could forge attribution.
        const { action, resource, outcome, severity, metadata } = body;
        if (!action) throw new HttpError(400, "action is required");

        await audit(db, {
          actor_id: caller.userId,
          actor_did: caller.dids[0] ?? null,
          resource: resource ?? null,
          action: String(action),
          outcome: outcome ?? "success",
          severity: severity ?? "info",
          metadata: metadata ?? {},
        });

        return json({ ok: true });
      }

      default:
        throw new HttpError(400, `Unknown operation: ${op || "(none)"}`);
    }
  } catch (err) {
    return errorResponse(err);
  }
});
