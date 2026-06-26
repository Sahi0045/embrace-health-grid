import { createHash, createSign, generateKeyPairSync } from "crypto";

let _keyPair = null;

function getKeyPair() {
  if (!_keyPair) {
    _keyPair = generateKeyPairSync("ed25519");
  }
  return _keyPair;
}

/** Ed25519 VC signature (replaces simulated MEQCIBas strings) */
export function signCredential(vcPayload) {
  const { privateKey, publicKey } = getKeyPair();
  const canonical = JSON.stringify(vcPayload, Object.keys(vcPayload).sort());
  const sign = createSign("ed25519");
  sign.update(canonical);
  sign.end();
  const signature = sign.sign(privateKey).toString("base64");
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });
  return {
    signature,
    proofType: "Ed25519Signature2020",
    verificationMethod: createHash("sha256").update(publicKeyDer).digest("hex").slice(0, 16),
  };
}

export function getPublicKeyFingerprint() {
  const { publicKey } = getKeyPair();
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(publicKeyDer).digest("hex").slice(0, 16);
}
