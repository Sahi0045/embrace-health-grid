/**
 * Solana Anchor client — Embrace Health Grid
 *
 * Replaces the raw-byte instruction builder in lib/solana.js, which could never
 * have worked against this program.
 *
 * Why the old code failed
 * ----------------------
 * lib/solana.js built a TransactionInstruction whose `data` was the raw 32-byte
 * record hash. The on-chain program is an ANCHOR program, and Anchor decodes
 * instruction data as:
 *
 *     [8-byte discriminator][Borsh-serialised arguments]
 *
 * where the discriminator is sha256("global:<snake_case_instruction>")[0..8].
 * Raw hash bytes match no discriminator, so every transaction would have been
 * rejected with InstructionFallbackNotFound — even after deployment. The old
 * code only ever "worked" because SIMULATED mode short-circuited it.
 *
 * Program: FuL2Ko8zMdej7QU8VtxoyTdmpuF1MsWLECCTVTztQ2iR (devnet)
 *
 * PDA layout (must match the #[account(seeds = ...)] in lib.rs):
 *   patient-root     : ["patient-root",     patient_did]
 *   doctor-location  : ["doctor-location",  doctor_did]
 *   consent          : ["consent", patient_did, doctor_pubkey]
 */

import { createHash } from "crypto";

/** Anchor discriminator: first 8 bytes of sha256("global:<name>"). */
export function discriminator(instructionName) {
  return createHash("sha256").update(`global:${instructionName}`).digest().subarray(0, 8);
}

/**
 * Borsh encoding for the argument types this program uses.
 * Strings are length-prefixed with a u32 little-endian byte count.
 */
export function borshString(value) {
  const bytes = Buffer.from(value, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

/** Fixed 32-byte array — encoded inline with no length prefix. */
export function borshFixed32(hexOrBuffer) {
  const buf = Buffer.isBuffer(hexOrBuffer)
    ? hexOrBuffer
    : Buffer.from(String(hexOrBuffer).replace(/^0x/, ""), "hex");

  if (buf.length !== 32) {
    throw new Error(`Expected exactly 32 bytes for [u8; 32], received ${buf.length}`);
  }
  return buf;
}

/** i64 little-endian, for Anchor's `expiry: i64`. */
export function borshI64(value) {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(value), 0);
  return buf;
}

/**
 * Build instruction data for update_patient_root(patient_did: String, new_root: [u8; 32]).
 * This is the instruction used to anchor a patient's merkle root.
 */
export function encodeUpdatePatientRoot(patientDid, rootHashHex) {
  return Buffer.concat([
    discriminator("update_patient_root"),
    borshString(patientDid),
    borshFixed32(rootHashHex),
  ]);
}

/** register_patient_root(patient_did: String, initial_root: [u8; 32]) */
export function encodeRegisterPatientRoot(patientDid, rootHashHex) {
  return Buffer.concat([
    discriminator("register_patient_root"),
    borshString(patientDid),
    borshFixed32(rootHashHex),
  ]);
}

/** register_doctor_location(doctor_did: String, initial_root: [u8; 32]) */
export function encodeRegisterDoctorLocation(doctorDid, rootHashHex) {
  return Buffer.concat([
    discriminator("register_doctor_location"),
    borshString(doctorDid),
    borshFixed32(rootHashHex),
  ]);
}

/** update_doctor_location(doctor_did: String, new_root: [u8; 32]) */
export function encodeUpdateDoctorLocation(doctorDid, rootHashHex) {
  return Buffer.concat([
    discriminator("update_doctor_location"),
    borshString(doctorDid),
    borshFixed32(rootHashHex),
  ]);
}

/**
 * Derive the PDA for a patient's merkle root account.
 * Seeds must match the program exactly or the account constraint fails.
 */
export async function patientRootPda(programId, patientDid) {
  const { PublicKey } = await import("@solana/web3.js");
  return PublicKey.findProgramAddressSync(
    [Buffer.from("patient-root"), Buffer.from(patientDid, "utf8")],
    new PublicKey(programId),
  );
}

/** Derive the PDA for a doctor's location-root account. */
export async function doctorLocationPda(programId, doctorDid) {
  const { PublicKey } = await import("@solana/web3.js");
  return PublicKey.findProgramAddressSync(
    [Buffer.from("doctor-location"), Buffer.from(doctorDid, "utf8")],
    new PublicKey(programId),
  );
}

/**
 * Anchor a merkle root on-chain.
 *
 * Chooses register vs update by checking whether the PDA already exists —
 * register_patient_root uses `init`, which fails if the account is present.
 *
 * Returns { signature, slot, pda } on success and throws on failure. It does
 * NOT swallow errors into a fake success, which is what the legacy
 * implementation did (writing network:'devnet-error' plus a fabricated
 * 'err_<base36>' signature, making failures indistinguishable from successes).
 */
export async function anchorPatientRoot({
  connection,
  wallet,
  programId,
  patientDid,
  rootHashHex,
}) {
  const { PublicKey, Transaction, TransactionInstruction, SystemProgram } = await import(
    "@solana/web3.js"
  );

  const [pda] = await patientRootPda(programId, patientDid);
  const existing = await connection.getAccountInfo(pda);

  const data = existing
    ? encodeUpdatePatientRoot(patientDid, rootHashHex)
    : encodeRegisterPatientRoot(patientDid, rootHashHex);

  // Account order and mutability must match the #[derive(Accounts)] struct.
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

  const ix = new TransactionInstruction({
    keys,
    programId: new PublicKey(programId),
    data,
  });

  const tx = new Transaction().add(ix);
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
    throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
  }

  // Capture the real slot — the legacy code hardcoded slot: 0.
  const txInfo = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  return {
    signature,
    slot: txInfo?.slot ?? null,
    pda: pda.toBase58(),
    instruction: existing ? "update_patient_root" : "register_patient_root",
  };
}
