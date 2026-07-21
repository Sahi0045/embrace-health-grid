/**
 * Solana devnet adapter — anchors SHA-256 hashes only (no PHI).
 * Uses simulated anchoring when SOLANA_RPC_URL / SOLANA_PROGRAM_ID not configured.
 */

import { randomUUID } from "crypto";
import { putState, getAllState } from "../world-state-db.js";

const SIMULATED = !process.env.SOLANA_RPC_URL || !process.env.SOLANA_PROGRAM_ID;

export function isSimulatedMode() {
  return SIMULATED;
}

export async function anchorHash({ recordHash, recordType, actorDid, recordId }) {
  const anchorId = `anchor_${randomUUID().slice(0, 8)}`;
  const timestamp = new Date().toISOString();

  if (SIMULATED) {
    const signature = `sim_${recordHash.slice(0, 16)}_${Date.now().toString(36)}`;
    const slot = Math.floor(Date.now() / 400);
    const entry = {
      anchorId,
      recordHash,
      recordType,
      actorDid: actorDid || "system",
      recordId: recordId || null,
      signature,
      slot,
      network: "devnet-simulated",
      anchoredAt: timestamp,
    };
    putState("solana-anchors", anchorId, entry, anchorId);
    return entry;
  }

  // Real devnet integration point — submit tx via @solana/web3.js when configured
  throw new Error("Real Solana RPC not yet wired — set SOLANA_RPC_URL and SOLANA_PROGRAM_ID");
}

export function verifyAnchor(signature) {
  const all = getAllState("solana-anchors");
  const match = all.find((e) => e.value?.signature === signature);
  if (!match) return { found: false, error: "Anchor not found" };
  return { found: true, anchor: match.value };
}

export function listRecentAnchors(limit = 50) {
  const all = getAllState("solana-anchors")
    .map((e) => e.value)
    .sort((a, b) => (b.anchoredAt || "").localeCompare(a.anchoredAt || ""));
  return all.slice(0, limit);
}

/** Non-blocking anchor after record mutation */
export function scheduleAnchor(deps, record, recordType, actorDid) {
  const { computeRecordHash } = deps;
  const hash = typeof record === "string" ? record : computeRecordHash(record);
  const recordId =
    record?.rxId || record?.labId || record?.grantId || record?.recordId || record?.id;

  anchorHash({
    recordHash: hash,
    recordType,
    actorDid,
    recordId,
  }).catch((err) => console.error("⚠️ Solana anchor failed:", err.message));
}
