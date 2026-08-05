/**
 * Edge Function: anchor-record
 *
 * Anchors a SHA-256 hash on Solana devnet and records the receipt.
 *
 * Runs server-side because it signs with the platform wallet
 * (SOLANA_WALLET_SECRET). That key can never reach a browser, and
 * solana_anchors has no client INSERT policy — so a client cannot forge an
 * anchor even if it knew the hash.
 *
 * Only hashes go on-chain. No PHI ever leaves Postgres.
 *
 * NO SIMULATION: this submits real devnet transactions. If anchoring fails the
 * row is written with status='failed' and signature=NULL, enforced by the
 * anchors_failed_has_no_signature CHECK constraint. The legacy implementation
 * instead wrote network='devnet-error' plus a fabricated 'err_<base36>'
 * signature, making failures look like successes.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "npm:@solana/web3.js@1.98.4";
import {
  requireCaller,
  serviceClient,
  audit,
  json,
  errorResponse,
  HttpError,
} from "../_shared/deps.ts";
import {
  encodeRegisterPatientRoot,
  encodeUpdatePatientRoot,
  encodeRegisterHospital,
  HOSPITAL_SEED,
} from "../_shared/anchor-encoding.ts";

const PROGRAM_ID = Deno.env.get("SOLANA_PROGRAM_ID") ?? "";
const RPC_URL = Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com";

/** Load the platform signing wallet from the function secret. */
function loadWallet(): Keypair {
  const raw = Deno.env.get("SOLANA_WALLET_SECRET");
  if (!raw) throw new HttpError(500, "SOLANA_WALLET_SECRET is not configured");
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  } catch {
    throw new HttpError(500, "SOLANA_WALLET_SECRET is malformed (expected a JSON byte array)");
  }
}

/** PDA for a subject's root account — seeds must match the on-chain program. */
function patientRootPda(subjectDid: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("patient-root"), new TextEncoder().encode(subjectDid)],
    new PublicKey(PROGRAM_ID),
  );
}

/** PDA for a hospital registration — seeds must match the on-chain program. */
function hospitalPda(hospitalDid: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(HOSPITAL_SEED), new TextEncoder().encode(hospitalDid)],
    new PublicKey(PROGRAM_ID),
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = serviceClient();
  let caller;
  let anchorId = `anchor_${crypto.randomUUID().slice(0, 8)}`;

  try {
    caller = await requireCaller(req);

    // super_admin is included for the hospital-registration branch below; the
    // patient path still checks DID ownership separately.
    if (!["doctor", "staff", "admin", "super_admin"].includes(caller.role)) {
      throw new HttpError(403, "Only clinical staff may anchor records");
    }
    if (!PROGRAM_ID) throw new HttpError(500, "SOLANA_PROGRAM_ID is not configured");

    const body = await req.json();

    // ── Hospital registration ───────────────────────────────────────────────
    // A separate instruction with its own PDA, so it is handled before the
    // patient-root path rather than bent to fit it.
    if (body?.kind === "hospital") {
      if (caller.role !== "super_admin") {
        throw new HttpError(403, "Only a super administrator may register a hospital on chain");
      }
      if (!PROGRAM_ID) throw new HttpError(500, "SOLANA_PROGRAM_ID is not configured");

      const { hospitalDid, nameHash, credentialHash } = body;
      if (!hospitalDid || !nameHash || !credentialHash) {
        throw new HttpError(400, "hospitalDid, nameHash and credentialHash are required");
      }
      for (const [label, value] of [
        ["nameHash", nameHash],
        ["credentialHash", credentialHash],
      ] as const) {
        if (!/^[0-9a-f]{64}$/i.test(String(value).replace(/^0x/, ""))) {
          throw new HttpError(400, `${label} must be a 64-character SHA-256 hex digest`);
        }
      }

      const { error: pendErr } = await db.from("solana_anchors").insert({
        anchor_id: anchorId,
        record_hash: credentialHash,
        record_type: "hospital_registration",
        record_id: hospitalDid,
        actor_did: hospitalDid,
        status: "pending",
        signature: null,
        network: "devnet",
      });
      if (pendErr) throw new HttpError(500, `Could not record anchor attempt: ${pendErr.message}`);

      const wallet = loadWallet();
      const connection = new Connection(RPC_URL, "confirmed");
      const [pda] = hospitalPda(hospitalDid);

      // register_hospital uses `init`, so a repeat registration would fail. Treat
      // an existing account as already registered rather than an error.
      const existing = await connection.getAccountInfo(pda);
      if (existing) {
        await db
          .from("solana_anchors")
          .update({ status: "confirmed", signature: null, confirmed_at: new Date().toISOString() })
          .eq("anchor_id", anchorId);
        return json({
          ok: true,
          anchorId,
          alreadyRegistered: true,
          pda: pda.toBase58(),
          instruction: "register_hospital",
        });
      }

      const data = await encodeRegisterHospital(hospitalDid, nameHash, credentialHash);
      const tx = new Transaction().add(
        new TransactionInstruction({
          keys: [
            { pubkey: pda, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId: new PublicKey(PROGRAM_ID),
          data,
        }),
      );
      tx.feePayer = wallet.publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.sign(wallet);

      const signature = await connection.sendRawTransaction(tx.serialize());
      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      if (confirmation.value.err) {
        throw new Error(`On-chain failure: ${JSON.stringify(confirmation.value.err)}`);
      }

      const txInfo = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      await db
        .from("solana_anchors")
        .update({
          status: "confirmed",
          signature,
          slot: txInfo?.slot ?? null,
          confirmed_at: new Date().toISOString(),
        })
        .eq("anchor_id", anchorId);

      await audit(db, {
        actor_id: caller.userId,
        actor_did: hospitalDid,
        resource: anchorId,
        action: "HOSPITAL_REGISTERED_ONCHAIN",
        outcome: "success",
        metadata: { signature, slot: txInfo?.slot ?? null, pda: pda.toBase58() },
      });

      return json({
        ok: true,
        anchorId,
        signature,
        slot: txInfo?.slot ?? null,
        pda: pda.toBase58(),
        instruction: "register_hospital",
        explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      });
    }

    // ── Patient record anchoring ────────────────────────────────────────────
    const { subjectDid, recordHash, recordType, recordId } = body ?? {};

    if (!subjectDid || !recordHash || !recordType) {
      throw new HttpError(400, "subjectDid, recordHash and recordType are required");
    }
    if (!/^[0-9a-f]{64}$/i.test(String(recordHash).replace(/^0x/, ""))) {
      throw new HttpError(400, "recordHash must be a 64-character SHA-256 hex digest");
    }

    // A clinician may only anchor for a DID they own; admins may anchor for any.
    if (caller.role !== "admin" && !caller.dids.includes(subjectDid)) {
      throw new HttpError(403, "Cannot anchor for a DID you do not own");
    }

    // Record the attempt as pending BEFORE submitting, so a crash mid-flight
    // leaves a visible pending row rather than no trace at all.
    const { error: pendErr } = await db.from("solana_anchors").insert({
      anchor_id: anchorId,
      record_hash: recordHash,
      record_type: recordType,
      record_id: recordId ?? null,
      actor_did: subjectDid,
      status: "pending",
      signature: null,
      network: "devnet",
    });
    if (pendErr) throw new HttpError(500, `Could not record anchor attempt: ${pendErr.message}`);

    const wallet = loadWallet();
    const connection = new Connection(RPC_URL, "confirmed");
    const [pda] = patientRootPda(subjectDid);

    // register_* uses `init` and fails if the account exists, so branch on presence.
    const existing = await connection.getAccountInfo(pda);
    const data = existing
      ? await encodeUpdatePatientRoot(subjectDid, recordHash)
      : await encodeRegisterPatientRoot(subjectDid, recordHash);

    // Account order and mutability must match #[derive(Accounts)] in the program.
    const keys = existing
      ? [
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        ]
      : [
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ];

    const tx = new Transaction().add(
      new TransactionInstruction({ keys, programId: new PublicKey(PROGRAM_ID), data }),
    );
    tx.feePayer = wallet.publicKey;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.sign(wallet);

    const signature = await connection.sendRawTransaction(tx.serialize());
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    if (confirmation.value.err) {
      throw new Error(`On-chain failure: ${JSON.stringify(confirmation.value.err)}`);
    }

    const txInfo = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    // Promote to confirmed. The CHECK constraint requires a signature here.
    const { error: upErr } = await db
      .from("solana_anchors")
      .update({
        status: "confirmed",
        signature,
        slot: txInfo?.slot ?? null,
        confirmed_at: new Date().toISOString(),
      })
      .eq("anchor_id", anchorId);
    if (upErr)
      throw new HttpError(500, `Anchored on-chain but could not update row: ${upErr.message}`);

    await audit(db, {
      actor_id: caller.userId,
      actor_did: subjectDid,
      resource: anchorId,
      action: "RECORD_ANCHORED",
      outcome: "success",
      metadata: { signature, slot: txInfo?.slot ?? null, recordType, pda: pda.toBase58() },
    });

    return json({
      ok: true,
      anchorId,
      signature,
      slot: txInfo?.slot ?? null,
      pda: pda.toBase58(),
      instruction: existing ? "update_patient_root" : "register_patient_root",
      explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    });
  } catch (err) {
    // Mark the attempt failed. signature stays NULL so the CHECK constraint
    // guarantees a failed anchor can never carry a fake signature.
    await db
      .from("solana_anchors")
      .update({
        status: "failed",
        signature: null,
        error: err instanceof Error ? err.message : String(err),
      })
      .eq("anchor_id", anchorId)
      .then(
        () => {},
        () => {},
      );

    if (caller) {
      await audit(db, {
        actor_id: caller.userId,
        resource: anchorId,
        action: "RECORD_ANCHOR_FAILED",
        outcome: "failure",
        severity: "warning",
        metadata: { reason: err instanceof Error ? err.message : String(err) },
      });
    }
    return errorResponse(err);
  }
});
