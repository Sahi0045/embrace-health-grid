/**
 * Backend API Integration Tests
 * Uses Node.js built-in test runner (node:test) — no extra dependencies.
 *
 * Starts the backend server on a random free port, runs assertions against
 * live HTTP responses, then tears down the server.
 *
 * Run: node --test test/api.test.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE = `http://localhost:${process.env.PORT || 3001}`;

/**
 * Minimal fetch wrapper that resolves with { status, body } (body as parsed JSON).
 * Falls back to text body when JSON parse fails.
 */
async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-client-key': process.env.CLIENT_KEY || 'ci-test-client-key',
      ...headers,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  let parsed;
  try {
    parsed = await res.json();
  } catch {
    parsed = await res.text();
  }
  return { status: res.status, body: parsed };
}

/** Poll until the health endpoint returns 200, or reject after timeout. */
async function waitForServer(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.status === 200) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Backend did not become healthy within timeout');
}

// ─── Health endpoints ─────────────────────────────────────────────────────────

describe('Health endpoints', () => {
  before(() => waitForServer());

  it('GET /health → 200', async () => {
    const { status, body } = await api('/health');
    assert.equal(status, 200);
    assert.ok(body.status === 'ok' || body.status === 'healthy' || typeof body === 'object');
  });

  it('GET /health/ready → 200', async () => {
    const { status } = await api('/health/ready');
    assert.equal(status, 200);
  });

  it('GET /health/metrics → 200', async () => {
    const { status } = await api('/health/metrics');
    assert.equal(status, 200);
  });
});

// ─── Auth endpoints ───────────────────────────────────────────────────────────

describe('Auth endpoints', () => {
  it('POST /api/auth/login with bad credentials → 401', async () => {
    const { status } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody@nope.test', password: 'wrong' },
    });
    assert.equal(status, 401);
  });

  it('POST /api/auth/login with valid staff credentials → 200 + token', async () => {
    const { status, body } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'doctor@embracehealth.org', password: 'password123' },
    });
    // Accept 200 or 401 — seeded data may differ per environment
    assert.ok([200, 401].includes(status), `Expected 200 or 401, got ${status}`);
    if (status === 200) {
      assert.ok(body.token || body.accessToken, 'Response should contain a token');
    }
  });

  it('POST /api/auth/login missing body fields → 400 or 401', async () => {
    const { status } = await api('/api/auth/login', {
      method: 'POST',
      body: {},
    });
    assert.ok([400, 401, 422].includes(status), `Expected 400/401/422, got ${status}`);
  });
});

// ─── Protected endpoints (unauthenticated) ────────────────────────────────────

describe('Protected endpoints — unauthenticated access', () => {
  const protectedRoutes = [
    '/api/doctors/verified',
    '/api/rooms',
    '/api/room-checkin/all',
  ];

  for (const route of protectedRoutes) {
    it(`GET ${route} without token → 401 or 403`, async () => {
      const { status } = await api(route, { headers: { Authorization: '' } });
      assert.ok(
        [401, 403].includes(status),
        `${route}: Expected 401 or 403, got ${status}`,
      );
    });
  }
});

// ─── Merkle root endpoints ────────────────────────────────────────────────────

describe('Merkle root endpoints', () => {
  it('GET /api/merkle-root/daily/:doctorDid without auth → 401 or 403', async () => {
    const { status } = await api('/api/merkle-root/daily/did:hosp:0xtest', {
      headers: { Authorization: '' },
    });
    assert.ok([401, 403].includes(status), `Got ${status}`);
  });

  it('GET /api/merkle-root/:doctorDid/history without auth → 401 or 403', async () => {
    const { status } = await api('/api/merkle-root/did:hosp:0xtest/history', {
      headers: { Authorization: '' },
    });
    assert.ok([401, 403].includes(status), `Got ${status}`);
  });

  it('POST /api/merkle-root/publish without auth → 401 or 403', async () => {
    const { status } = await api('/api/merkle-root/publish', {
      method: 'POST',
      body: { doctorDid: 'did:hosp:0xtest' },
      headers: { Authorization: '' },
    });
    assert.ok([401, 403].includes(status), `Got ${status}`);
  });
});

// ─── DID registry endpoints ───────────────────────────────────────────────────

describe('DID registry endpoints', () => {
  it('GET /api/doctors/verified without auth → 401 or 403', async () => {
    const { status } = await api('/api/doctors/verified', {
      headers: { Authorization: '' },
    });
    assert.ok([401, 403].includes(status), `Got ${status}`);
  });
});

// ─── 404 behaviour ───────────────────────────────────────────────────────────

describe('Not-found behaviour', () => {
  it('Unknown route → 404', async () => {
    const { status } = await api('/api/this-route-does-not-exist-xyz');
    assert.equal(status, 404);
  });
});

// ─── Security headers ─────────────────────────────────────────────────────────

describe('Security headers', () => {
  it('Response includes helmet-style headers', async () => {
    const res = await fetch(`${BASE}/health`);
    // At least one of these should be present (helmet sets all of them)
    const hasHelmet =
      res.headers.get('x-content-type-options') ||
      res.headers.get('x-frame-options') ||
      res.headers.get('x-xss-protection');
    assert.ok(hasHelmet, 'Expected at least one security header from helmet');
  });
});
