import { createHash } from "crypto";

/** SHA-256 hash of canonical JSON record — used for Solana anchoring (no PHI) */
export function computeRecordHash(record) {
  const canonical = JSON.stringify(record, Object.keys(record).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

/** Strip PHI fields; keep hash reference for on-ledger storage */
export function toAnchorPayload(record, recordType) {
  const hash = computeRecordHash(record);
  return {
    recordHash: hash,
    recordType,
    recordId: record.rxId || record.labId || record.grantId || record.recordId || record.id,
    timestamp: new Date().toISOString(),
  };
}

/** Off-chain storage wrapper */
export function splitRecord(record, recordType) {
  const hash = computeRecordHash(record);
  return {
    anchor: { recordHash: hash, recordType, timestamp: new Date().toISOString() },
    offChain: { ...record, contentHash: hash },
  };
}
