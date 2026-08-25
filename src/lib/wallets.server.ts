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
