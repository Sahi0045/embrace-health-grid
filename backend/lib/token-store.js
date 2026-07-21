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

// ─── Diagnostic (admin use only) ──────────────────────────────────────────────
export function getTokenStoreStats() {
  _purgExpiredRefreshTokens();
  _purgeExpiredBlocklistEntries();
  return {
    activeRefreshTokens: _refreshTokens.size,
    blockedJtis: _blocklist.size,
  };
}
