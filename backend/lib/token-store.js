/**
 * Token Store — Embrace Health Grid
 *
 * Provides two capabilities:
 *
 * 1. Refresh Token Registry
 *    - Opaque random refresh tokens (never a JWT) stored server-side.
 *    - Each refresh token is single-use (rotation: old token revoked on use).
 *    - Bound to a specific user email + user-agent + IP fingerprint.
 *    - 7-day TTL; expired tokens are purged lazily.
 *
 * 2. Access Token Blocklist (JTI-based revocation)
 *    - Each access JWT carries a `jti` (JWT ID) claim.
 *    - On logout or forced revocation the JTI is added to the blocklist.
 *    - Blocklist entries expire automatically after the JWT's remaining TTL.
 *    - Checked in the auth middleware before accepting any token.
 *
 * Storage: in-memory Map (restarts clear state — acceptable because
 * refresh tokens are invalidated on restart and users must re-login,
 * which is a safe failure mode for a healthcare system).
 *
 * For production at scale: swap the Maps for Redis with TTL-keyed entries.
 */

import { randomBytes } from "crypto";

// ─── Refresh Token Store ───────────────────────────────────────────────────────

/** @type {Map<string, {email: string, fingerprint: string, expiresAt: number, used: boolean}>} */
const _refreshTokens = new Map();

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate a new opaque refresh token and register it.
 * @param {string} email
 * @param {string} fingerprint - e.g. hash of user-agent + IP
 * @returns {string} The opaque refresh token
 */
export function createRefreshToken(email, fingerprint) {
  _purgExpiredRefreshTokens();
  const token = randomBytes(48).toString("hex");
  _refreshTokens.set(token, {
    email,
    fingerprint,
    expiresAt: Date.now() + REFRESH_TTL_MS,
    used: false,
  });
  return token;
}

/**
 * Validate a refresh token and return its email if valid.
 * Marks the token as used (single-use; caller must issue a new one).
 *
 * @param {string} token
 * @param {string} fingerprint
 * @returns {{ email: string } | null}
 */
export function consumeRefreshToken(token, fingerprint) {
  const record = _refreshTokens.get(token);
  if (!record) return null;
  if (record.used) return null;
  if (record.expiresAt < Date.now()) {
    _refreshTokens.delete(token);
    return null;
  }
  if (record.fingerprint !== fingerprint) return null;

  // Single-use: mark consumed, will be deleted after rotation
  record.used = true;
  _refreshTokens.delete(token);

  return { email: record.email };
}

/**
 * Revoke all refresh tokens belonging to a user (called on logout / password change).
 * @param {string} email
 */
export function revokeAllRefreshTokens(email) {
  for (const [token, record] of _refreshTokens) {
    if (record.email === email) _refreshTokens.delete(token);
  }
}

function _purgExpiredRefreshTokens() {
  const now = Date.now();
  for (const [token, record] of _refreshTokens) {
    if (record.expiresAt < now || record.used) _refreshTokens.delete(token);
  }
}

// ─── Access Token Blocklist (JTI-based) ───────────────────────────────────────

/**
 * JTI → expiry timestamp (ms). Entries are removed once their JWT would
 * have expired anyway, so the set stays small.
 * @type {Map<string, number>}
 */
const _blocklist = new Map();

/**
 * Add a JWT's jti to the blocklist.
 * @param {string} jti
 * @param {number} expMs - Unix timestamp (ms) when the JWT expires
 */
export function blockToken(jti, expMs) {
  _purgeExpiredBlocklistEntries();
  _blocklist.set(jti, expMs);
}

/**
 * Check whether a JTI is currently blocked.
 * @param {string} jti
 * @returns {boolean}
 */
export function isTokenBlocked(jti) {
  const expMs = _blocklist.get(jti);
  if (expMs === undefined) return false;
  if (expMs < Date.now()) {
    _blocklist.delete(jti);
    return false;
  }
  return true;
}

/**
 * Revoke all access tokens for a user — only possible if jtis are stored
 * per-user. Here we use a prefix approach: store `email:jti` as key.
 * The middleware must pass both.
 */
export function blockAllTokensForUser(email) {
  for (const [jti] of _blocklist) {
    if (jti.startsWith(`${email}:`)) {
      // already blocked
    }
  }
  // Add a user-level revocation sentinel that expires in 8h (access token max TTL)
  const sentinel = `__user__:${email}`;
  _blocklist.set(sentinel, Date.now() + 8 * 60 * 60 * 1000);
}

/**
 * Check if a user-level revocation sentinel exists (forces re-login for all devices).
 */
export function isUserRevoked(email) {
  const sentinel = `__user__:${email}`;
  const expMs = _blocklist.get(sentinel);
  if (expMs === undefined) return false;
  if (expMs < Date.now()) {
    _blocklist.delete(sentinel);
    return false;
  }
  return true;
}

function _purgeExpiredBlocklistEntries() {
  const now = Date.now();
  for (const [jti, expMs] of _blocklist) {
    if (expMs < now) _blocklist.delete(jti);
  }
}

// ─── Account Lockout Protection ───────────────────────────────────────────────
/** @type {Map<string, {count: number, lockUntil: number}>} */
const _loginFailures = new Map();

/**
 * Record a failed login attempt for an email. Locks account after 5 consecutive failures.
 * @param {string} email
 * @returns {{ count: number, isLocked: boolean, remainingSeconds?: number }}
 */
export function recordFailedLogin(email) {
  const record = _loginFailures.get(email) || { count: 0, lockUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockUntil = Date.now() + 15 * 60 * 1000; // 15-minute lock
  }
  _loginFailures.set(email, record);
  return {
    count: record.count,
    isLocked: record.count >= 5,
    remainingSeconds: record.count >= 5 ? 15 * 60 : undefined,
  };
}

/**
 * Check if an email account is locked out.
 * @param {string} email
 * @returns {{ isLocked: boolean, remainingSeconds?: number }}
 */
export function checkAccountLockout(email) {
  const record = _loginFailures.get(email);
  if (!record) return { isLocked: false };
  if (record.lockUntil > Date.now()) {
    const remainingSeconds = Math.ceil((record.lockUntil - Date.now()) / 1000);
    return { isLocked: true, remainingSeconds };
  }
  if (record.lockUntil > 0 && record.lockUntil <= Date.now()) {
    _loginFailures.delete(email);
  }
  return { isLocked: false };
}

/**
 * Reset failed login count on successful authentication.
 * @param {string} email
 */
export function resetFailedLogins(email) {
  _loginFailures.delete(email);
}

// ─── RFC 6238 TOTP Multi-Factor Authentication (MFA) ─────────────────────────
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Generate a random Base32 secret key for TOTP 2FA setup.
 * @param {number} length
 * @returns {string} Base32 TOTP secret
 */
export function generateTotpSecret(length = 20) {
  const bytes = randomBytes(length);
  let secret = "";
  for (let i = 0; i < bytes.length; i++) {
    secret += BASE32_CHARS[bytes[i] % 32];
  }
  return secret;
}

function base32ToBuffer(base32Str) {
  const str = base32Str.toUpperCase().replace(/=+$/, "");
  const bytes = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < str.length; i++) {
    const idx = BASE32_CHARS.indexOf(str[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Generate a 6-digit TOTP code for a secret and time step.
 * @param {string} secret
 * @param {number} timeStep
 * @returns {string} 6-digit TOTP string
 */
export function generateTotpCode(secret, timeStep = Math.floor(Date.now() / 1000 / 30)) {
  const key = base32ToBuffer(secret);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = createHmac("sha1", key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, "0");
}

/**
 * Verify a user's 6-digit TOTP token against their secret.
 * Supports +/- 1 time step window for clock drift tolerance.
 * @param {string} secret
 * @param {string} token
 * @returns {boolean}
 */
export function verifyTotpToken(secret, token) {
  if (!secret || !token) return false;
  const cleanToken = String(token).trim();
  if (cleanToken.length !== 6) return false;
  const currentStep = Math.floor(Date.now() / 1000 / 30);

  for (let stepOffset = -1; stepOffset <= 1; stepOffset++) {
    const code = generateTotpCode(secret, currentStep + stepOffset);
    if (code === cleanToken) return true;
  }
  return false;
}

// ─── Diagnostic (admin use only) ──────────────────────────────────────────────
export function getTokenStoreStats() {
  _purgExpiredRefreshTokens();
  _purgeExpiredBlocklistEntries();
  return {
    activeRefreshTokens: _refreshTokens.size,
    blockedJtis: _blocklist.size,
    lockedAccounts: _loginFailures.size,
  };
}

