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

  try {
    const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } = await import("@solana/web3.js");
    const connection = new Connection(process.env.SOLANA_RPC_URL, "confirmed");
    const programPubkey = new PublicKey(process.env.SOLANA_PROGRAM_ID);

    let walletKeypair;
    try {
      const secretKey = JSON.parse(process.env.SOLANA_WALLET_SECRET || "[]");
      walletKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    } catch {
      const simEntry = {
        anchorId,
        recordHash,
        recordType,
        actorDid: actorDid || "system",
        recordId: recordId || null,
        signature: `sim_${recordHash.slice(0, 16)}_${Date.now().toString(36)}`,
        slot: Math.floor(Date.now() / 400),
        network: "devnet-simulated",
        anchoredAt: timestamp,
        note: "wallet not configured",
      };
      putState("solana-anchors", anchorId, simEntry, anchorId);
      return simEntry;
    }

    const hashBytes = Buffer.from(recordHash.replace(/^0x/, "").slice(0, 64), "hex");
    const ix = new TransactionInstruction({
      keys: [
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: programPubkey,
      data: hashBytes,
    });

    const tx = new Transaction().add(ix);
    tx.feePayer = walletKeypair.publicKey;
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.sign(walletKeypair);

    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature, "confirmed");

    const realEntry = {
      anchorId,
      recordHash,
      recordType,
      actorDid: actorDid || "system",
      recordId: recordId || null,
      signature,
      slot: 0,
      network: "devnet",
      anchoredAt: timestamp,
    };
    putState("solana-anchors", anchorId, realEntry, anchorId);
    return realEntry;
  } catch (err) {
    const errorEntry = {
      anchorId,
      recordHash,
      recordType,
      actorDid: actorDid || "system",
      recordId: recordId || null,
      signature: `err_${Date.now().toString(36)}`,
      slot: 0,
      network: "devnet-error",
      anchoredAt: timestamp,
      error: err.message,
    };
    putState("solana-anchors", anchorId, errorEntry, anchorId);
    return errorEntry;
  }
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
