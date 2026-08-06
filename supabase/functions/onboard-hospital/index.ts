/**
 * Edge Function: onboard-hospital
 *
 * Admits a hospital to the consortium. Super admin only.
 *
 * Performs the whole chain as one operation:
 *   1. hospitals row                (the tenant)
 *   2. hospital DID                 (did:hosp:org:<slug>)
 *   3. signed HospitalCredential    (platform vouches for the hospital)
 *   4. on-chain registration        (Solana: register_hospital)
 *   5. first hospital admin account (so the tenant is usable immediately)
 *
 * Why one function rather than five calls
 * ---------------------------------------
 * A hospital that exists in Postgres but has no DID cannot issue credentials to
 * its staff; one with a DID but no admin cannot be operated. Either state is
 * worse than no hospital at all, so a failure rolls back what was created.
 *
 * The on-chain step is the deliberate exception: if Postgres succeeds and the
 * anchor fails, the hospital is kept and onchain_tx stays null. The chain is a
 * proof layer, not the source of truth, and a failed anchor is visible and
 * retryable — whereas discarding a working tenant because devnet was
 * unreachable would be worse.
 */

import {
  requireCaller,
  serviceClient,
  audit,
  json,
  errorResponse,
  HttpError,
} from "../_shared/deps.ts";

/** Load the platform issuer signing key (PKCS#8 PEM) from the function secret. */
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

/** Deterministic serialisation so verification is order-independent. */
function canonicalise(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * URL-safe slug used in the hospital DID, so the DID is human-readable.
 *
 * Capped at 19 characters: the on-chain PDA is seeded on the full DID and a
 * Solana seed cannot exceed 32 bytes. "did:hosp:org:" is 13, leaving 19. A
 * longer slug fails on chain with "Max seed length exceeded", so the limit is
 * enforced here rather than discovered at anchor time.
 */
const DID_PREFIX = "did:hosp:org:";
const MAX_SLUG_LENGTH = 32 - DID_PREFIX.length;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = serviceClient();
  let caller;

  let createdHospitalId: string | null = null;
  let createdDid: string | null = null;
  let createdCredentialId: string | null = null;
  let createdUserId: string | null = null;

  try {
    caller = await requireCaller(req);

    // Only the platform may admit a tenant. A hospital admin must not be able to
    // create a peer hospital, which would let them mint a tenant they control.
    if (caller.role !== "super_admin") {
      throw new HttpError(403, "Only a super administrator may onboard a hospital");
    }

    const body = await req.json();
    const { name, city, country, contactEmail, adminEmail, adminPassword, adminFullName } =
      body ?? {};

    if (!name || !adminEmail || !adminPassword || !adminFullName) {
      throw new HttpError(400, "name, adminEmail, adminPassword and adminFullName are required");
    }
    if (String(adminPassword).length < 8) {
      throw new HttpError(400, "The admin password must be at least 8 characters");
    }

    const slug = slugify(name);
    if (!slug) throw new HttpError(400, "The hospital name must contain letters or digits");

    const hospitalDid = `${DID_PREFIX}${slug}`;

    // ── 1. hospital ─────────────────────────────────────────────────────────
    const { data: hospital, error: hErr } = await db
      .from("hospitals")
      .insert({
        hospital_did: hospitalDid,
        name,
        slug,
        city: city ?? null,
        country: country ?? null,
        contact_email: contactEmail ?? null,
        status: "active",
        created_by: caller.userId,
      })
      .select("hospital_id")
      .single();

    if (hErr) {
      if (/duplicate|unique/i.test(hErr.message)) {
        throw new HttpError(409, `A hospital named "${name}" already exists`);
      }
      throw new HttpError(500, `Could not create the hospital: ${hErr.message}`);
    }
    createdHospitalId = hospital.hospital_id;

    // ── 2. hospital DID ─────────────────────────────────────────────────────
    // owner_id is null: the DID belongs to the organisation, not to a person.
    const { error: didErr } = await db.from("dids").insert({
      did: hospitalDid,
      owner_id: null,
      owner_name: name,
      // user_role has no organisation member, so owner_type stays 'staff' and the
      // distinction is carried by is_organisation. Person-level queries filter on
      // that flag; without it a hospital appeared in the clinician roster.
      owner_type: "staff",
      is_organisation: true,
      public_key: `pk_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
      controller: "did:hosp:consortium:authority",
      status: "active",
      hospital_id: createdHospitalId,
    });
    if (didErr) throw new HttpError(500, `Hospital DID issuance failed: ${didErr.message}`);
    createdDid = hospitalDid;

    // ── 3. HospitalCredential ───────────────────────────────────────────────
    // The platform vouching for the hospital. Its staff credentials then chain
    // to this one, so a clinician's credential is traceable to a hospital the
    // platform admitted.
    const credentialId = `vc_${crypto.randomUUID()}`;
    const issuedAt = new Date().toISOString();

    const claims: Record<string, unknown> = { name, slug, hospitalDid };
    if (city) claims.city = city;
    if (country) claims.country = country;

    const vcPayload = {
      id: credentialId,
      type: "HospitalCredential",
      issuer: "did:hosp:consortium:authority",
      subject: hospitalDid,
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
      credential_type: "HospitalCredential",
      issuer: vcPayload.issuer,
      subject_did: hospitalDid,
      claims,
      signature,
      status: "valid",
      issued_at: issuedAt,
    });
    if (credErr) throw new HttpError(500, `Credential issuance failed: ${credErr.message}`);
    createdCredentialId = credentialId;

    // ── 4. first hospital admin ─────────────────────────────────────────────
    const { data: created, error: authErr } = await db.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminFullName, onboarded_by: caller.userId },
    });
    if (authErr) {
      if (/already registered|already exists|been registered/i.test(authErr.message)) {
        throw new HttpError(409, `An account already exists for ${adminEmail}`);
      }
      throw new HttpError(500, `Could not create the hospital admin: ${authErr.message}`);
    }
    createdUserId = created.user.id;

    // profiles must precede dids: dids.owner_id references profiles(id).
    const { error: profErr } = await db.from("profiles").insert({
      id: createdUserId,
      email: adminEmail,
      full_name: adminFullName,
      role: "admin",
      hospital_id: createdHospitalId,
    });
    if (profErr) throw new HttpError(500, `Admin profile creation failed: ${profErr.message}`);

    const adminDid = `did:hosp:0x${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const { error: adminDidErr } = await db.from("dids").insert({
      did: adminDid,
      owner_id: createdUserId,
      owner_name: adminFullName,
      // Must match the profile role. Hardcoding 'staff' meant the hospital admin
      // appeared twice in the roster — once as ADMIN from their profile and once
      // as STAFF from their DID.
      owner_type: "admin",
      public_key: `pk_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
      // Issued by the hospital, not the platform: this is the whole point of
      // giving each hospital its own DID.
      controller: hospitalDid,
      status: "active",
      hospital_id: createdHospitalId,
    });
    if (adminDidErr) throw new HttpError(500, `Admin DID issuance failed: ${adminDidErr.message}`);

    await db.from("profiles").update({ primary_did: adminDid }).eq("id", createdUserId);

    // ── 5. on-chain registration ────────────────────────────────────────────
    // Best effort by design. A hospital whose anchor failed is still usable and
    // the null onchain_tx makes the gap visible; throwing here would discard a
    // working tenant because devnet was briefly unreachable.
    let onchain: { signature: string; slot: number } | null = null;
    let anchorError: string | null = null;

    try {
      const nameHash = await sha256Hex(canonicalise({ name, slug }));
      const credentialHash = await sha256Hex(signature);

      const anchorRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/anchor-record`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.get("Authorization") ?? "",
          apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        },
        body: JSON.stringify({
          kind: "hospital",
          hospitalDid,
          nameHash,
          credentialHash,
        }),
      });

      if (anchorRes.ok) {
        const anchorJson = await anchorRes.json();
        if (anchorJson?.signature) {
          onchain = { signature: anchorJson.signature, slot: anchorJson.slot ?? 0 };
          await db
            .from("hospitals")
            .update({ onchain_tx: onchain.signature, onchain_slot: onchain.slot })
            .eq("hospital_id", createdHospitalId);
        }
      } else {
        anchorError = `anchor returned ${anchorRes.status}`;
      }
    } catch (err) {
      anchorError = err instanceof Error ? err.message : String(err);
    }

    await audit(db, {
      actor_id: caller.userId,
      resource: hospitalDid,
      action: "HOSPITAL_ONBOARDED",
      outcome: "success",
      metadata: {
        hospitalId: createdHospitalId,
        hospitalDid,
        name,
        slug,
        credentialId,
        adminEmail,
        adminDid,
        keyFingerprint: fingerprint,
        onchainTx: onchain?.signature ?? null,
        anchorError,
      },
    });

    return json({
      ok: true,
      hospitalId: createdHospitalId,
      hospitalDid,
      name,
      slug,
      credentialId,
      signature,
      admin: { userId: createdUserId, email: adminEmail, did: adminDid },
      onchain,
      // Surfaced rather than hidden: the caller should know the anchor is pending.
      anchorError,
    });
  } catch (err) {
    // ── Roll back Postgres state ────────────────────────────────────────────
    if (createdUserId) {
      // Deleting the auth user cascades its profile row.
      await db.auth.admin.deleteUser(createdUserId).then(
        () => {},
        () => {},
      );
    }
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
    if (createdHospitalId) {
      // Remove any DID that referenced this hospital before the hospital itself,
      // or the foreign key blocks the delete.
      await db
        .from("dids")
        .delete()
        .eq("hospital_id", createdHospitalId)
        .then(
          () => {},
          () => {},
        );
      await db
        .from("hospitals")
        .delete()
        .eq("hospital_id", createdHospitalId)
        .then(
          () => {},
          () => {},
        );
    }

    if (caller) {
      await audit(db, {
        actor_id: caller.userId,
        action: "HOSPITAL_ONBOARD_FAILED",
        outcome: "failure",
        severity: "warning",
        metadata: { reason: err instanceof Error ? err.message : String(err) },
      });
    }

    return errorResponse(err);
  }
});
