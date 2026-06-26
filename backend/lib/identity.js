import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_MS = 60_000;

export function signIdentityPayload(payload, secret) {
  const body = { ...payload, exp: payload.exp || Date.now() + DEFAULT_TTL_MS };
  const data = JSON.stringify({
    did: body.did,
    mrn: body.mrn,
    name: body.name,
    exp: body.exp,
    network: body.network,
  });
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return { ...body, sig };
}

export function verifyIdentityPayload(payload, secret) {
  if (!payload?.sig) return { valid: false, error: "Missing signature" };
  if (payload.exp <= Date.now()) return { valid: false, error: "Payload expired" };

  const data = JSON.stringify({
    did: payload.did,
    mrn: payload.mrn,
    name: payload.name,
    exp: payload.exp,
    network: payload.network,
  });
  const expected = createHmac("sha256", secret).update(data).digest("base64url");

  try {
    const a = Buffer.from(payload.sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, error: "Invalid signature" };
    }
  } catch {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true, payload };
}
