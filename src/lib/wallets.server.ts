/**
 * Server functions for embedded wallets.
 *
 * Separate from embedded-wallet.server.ts ON PURPOSE. TanStack rewrites a
 * `.server.ts` module for the browser by replacing each createServerFn export
 * with an RPC stub and dropping the module body — but only when EVERY export is
 * a serverFn. embedded-wallet.server.ts exports classes and singletons, so
 * putting a serverFn beside them would keep its body (and its `crypto` and
 * supabase.server imports) in the client graph and trip the import-protection
 * plugin, exactly as audit.server.ts did before 20260826 split it.
 *
 * So: only createServerFn exports belong in this file.
 */

import { createServerFn } from "@tanstack/react-start";
import {
  getSupabaseServiceRoleClient,
  getSupabaseServerClient,
  getVerifiedUser,
} from "./supabase.server";
import { didWalletService } from "./embedded-wallet.server";

/**
 * Ensure the given DID has a signing key, and return its public key.
 *
 * Idempotent, so it is safe to call after every DID issuance and from the
 * backfill. Restricted to staff and admins: issuing key material is an
 * administrative act, and the caller must belong to the DID's hospital.
 */
export const provisionDidWallet = createServerFn({ method: "POST" })
  .inputValidator((data: { did: string }) => {
    if (!data?.did) throw new Error("did is required");
    return data;
  })
  .handler(async ({ data }) => {
    const user = await getVerifiedUser();
    if (!user) throw new Error("Not authenticated");

    const supabase = getSupabaseServerClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, hospital_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !["staff", "doctor", "admin", "super_admin"].includes(profile.role)) {
      throw new Error("Only clinical staff and administrators may issue signing keys");
    }

    // Tenant check: this runs on the service-role client below, so RLS will not
    // bound it. A hospital admin must not be able to mint key material for
    // another hospital's DID.
    const db = getSupabaseServiceRoleClient();
    const { data: didRow } = await db
      .from("dids")
      .select("did, hospital_id")
      .eq("did", data.did)
      .maybeSingle();

    if (!didRow) throw new Error("Unknown DID");
    if (profile.role !== "super_admin" && didRow.hospital_id !== profile.hospital_id) {
      throw new Error("That DID belongs to another hospital");
    }

    const wallet = await didWalletService.getOrCreateWalletForDid(data.did);
    return { ok: true as const, did: data.did, publicKey: wallet.publicKey };
  });

/**
 * Verify the signature on one consent decision.
 *
 * Readable by either party to the consent — the patient whose key signed it and
 * the clinician it grants access to both have a legitimate need to check that
 * the record has not been altered.
 */
export const verifyConsent = createServerFn({ method: "GET" })
  .inputValidator((data: { grantId: string }) => {
    if (!data?.grantId) throw new Error("grantId is required");
    return data;
  })
  .handler(async ({ data }) => {
    const user = await getVerifiedUser();
    if (!user) throw new Error("Not authenticated");

    // RLS on consents already limits the caller to grants they are party to, so
    // reading through the request-scoped client IS the authorization check.
    const supabase = getSupabaseServerClient();
    const { data: visible } = await supabase
      .from("consents")
      .select("grant_id")
      .eq("grant_id", data.grantId)
      .maybeSingle();

    if (!visible) throw new Error("Consent not found, or you are not a party to it");

    const { verifyConsentSignature } = await import("./consent-signing.server");
    return await verifyConsentSignature(data.grantId);
  });

/**
 * Return the signed-in user's OWN keypair — both halves.
 *
 * The DID is the person's identity, so they hold its key. That is the premise of
 * the whole model, not a convenience: a record the patient cannot sign for is
 * not a record they own.
 *
 * Authorization is ownership, deliberately NOT role. `profiles_select_staff`
 * lets any doctor read most profile rows, so anything keyed on role would hand a
 * clinician a patient's private key. The DID must be one of the caller's own,
 * resolved from auth.uid() and never from the request.
 *
 * Every export is audited: it is the one operation that puts the private half in
 * front of a human, so it needs to be visible in the trail afterwards.
 */
export const getMyKeypair = createServerFn({ method: "POST" })
  .inputValidator((data?: { did?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const user = await getVerifiedUser();
    if (!user) throw new Error("Not authenticated");

    const db = getSupabaseServiceRoleClient();

    // Every DID this user controls. `owner_id` is the link, and it comes from
    // the verified session — a `did` in the request body is only ever used to
    // PICK from this list, never to widen it.
    const { data: owned, error } = await db
      .from("dids")
      .select("did, owner_name, owner_type, hospital_id")
      .eq("owner_id", user.id)
      .eq("status", "active");

    if (error) throw new Error(error.message);
    if (!owned?.length) {
      throw new Error("No DID is issued to this account yet");
    }

    const target = data?.did ? owned.find((d) => d.did === data.did) : owned[0];
    if (!target) throw new Error("That DID does not belong to you");

    const keypair = await didWalletService.exportKeypairForDid(target.did);
    if (!keypair) {
      throw new Error("No signing key has been provisioned for this DID yet");
    }

    const { tryWriteAudit, resolveCallerForAudit } = await import("./audit-helpers.server");
    const caller = await resolveCallerForAudit();
    // Mapped field by field: resolveCallerForAudit returns userId/email while
    // AuditEntry wants actorId/actorEmail, so a spread would silently leave the
    // actor unattributed on the one record that most needs an actor.
    await tryWriteAudit({
      actorId: caller.userId,
      actorDid: caller.actorDid,
      actorName: caller.actorName,
      actorRole: caller.actorRole,
      actorHospital: caller.hospital,
      actorEmail: caller.email,
      action: "PRIVATE_KEY_EXPORTED",
      outcome: "success",
      severity: "warning",
      module: "identity",
      entityId: target.did,
      entityType: "did",
      resource: `Signing key for ${target.did}`,
      hospital: caller.hospital,
      location: null,
      prevValue: null,
      newValue: null,
      authStatus: "authorized",
      authPolicy: "owner_only",
      metadata: { did: target.did },
    });

    return {
      did: target.did,
      publicKey: keypair.publicKey,
      secretKeyBase58: keypair.secretKeyBase58,
      secretKeyArray: keypair.secretKeyArray,
    };
  });
