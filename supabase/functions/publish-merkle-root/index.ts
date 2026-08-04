/**
 * Edge Function: publish-merkle-root
 *
 * Builds a Merkle root over a subject's events for a given day and records it.
 *
 * Server-side because clients must not be able to forge or backdate a root —
 * merkle_roots has no client INSERT policy. If a patient could publish their
 * own root they could rewrite history and still "verify" successfully.
 *
 * The hashing here mirrors backend/lib/merkle-tree.js exactly (SHA-256 of a
 * canonical leaf, pairwise concatenation, last node duplicated on an odd
 * count) so the existing 36 passing merkle tests remain the specification and
 * client-side proof verification stays compatible.
 */

import {
  requireCaller,
  serviceClient,
  audit,
  json,
  errorResponse,
  HttpError,
} from "../_shared/deps.ts";

/** SHA-256 hex digest of a string. */
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hash a leaf. Field order is fixed to match lib/merkle-tree.js hashLeaf(),
 * otherwise roots computed here would not match roots verified in the browser.
 */
function canonicalLeaf(leaf: Record<string, unknown>): string {
  return JSON.stringify({
    doctorDid: leaf.doctorDid ?? null,
    roomId: leaf.roomId ?? null,
    roomName: leaf.roomName ?? null,
    action: leaf.action ?? null,
    timestamp: leaf.timestamp ?? null,
  });
}

/** Build a Merkle root bottom-up, duplicating the last node when odd. */
async function buildRoot(leaves: Record<string, unknown>[]): Promise<string> {
  if (leaves.length === 0) throw new HttpError(400, "Cannot publish a root over zero events");

  let level: string[] = [];
  for (const leaf of leaves) {
    level.push(await sha256Hex(canonicalLeaf(leaf)));
  }

  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left; // duplicate last on odd count
      next.push(await sha256Hex(left + right));
    }
    level = next;
  }
  return level[0];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = serviceClient();
  let caller;

  try {
    caller = await requireCaller(req);

    if (!["doctor", "staff", "admin"].includes(caller.role)) {
      throw new HttpError(403, "Only clinical staff may publish merkle roots");
    }

    const body = await req.json();
    const { subjectDid, periodDate, events } = body ?? {};

    if (!subjectDid || !periodDate || !Array.isArray(events)) {
      throw new HttpError(400, "subjectDid, periodDate and events[] are required");
    }

    // A clinician may only publish for a DID they own; admins may publish for any.
    if (caller.role !== "admin" && !caller.dids.includes(subjectDid)) {
      throw new HttpError(403, "Cannot publish a root for a DID you do not own");
    }

    const rootHash = await buildRoot(events);
    const publishId = `MRP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // The unique (subject_did, period_date) constraint prevents two roots for
    // the same day, which would make verification ambiguous.
    const { error: insErr } = await db.from("merkle_roots").insert({
      publish_id: publishId,
      subject_did: subjectDid,
      root_hash: rootHash,
      event_count: events.length,
      event_ids: events.map((e: Record<string, unknown>) => e.id ?? e.eventId ?? null),
      period_date: periodDate,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        throw new HttpError(409, `A root for ${subjectDid} on ${periodDate} already exists`);
      }
      throw new HttpError(500, `Could not persist root: ${insErr.message}`);
    }

    await audit(db, {
      actor_id: caller.userId,
      actor_did: subjectDid,
      resource: publishId,
      action: "MERKLE_ROOT_PUBLISHED",
      outcome: "success",
      metadata: { rootHash, eventCount: events.length, periodDate },
    });

    return json({
      ok: true,
      publishId,
      rootHash,
      eventCount: events.length,
      // Anchoring on-chain is a separate step: the Solana program is not yet
      // deployed and lib/solana.js cannot encode Anchor instructions.
      anchored: false,
      note: "Root recorded. On-chain anchoring pending Solana program deployment.",
    });
  } catch (err) {
    return errorResponse(err);
  }
});
