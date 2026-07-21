# Task Specification: Backend Monolith Refactor & Hardening

**Project:** Embrace Health Grid (DID Hospital Simulation)  
**Target Directory:** `/backend`
**Current Tech Stack:** Node.js (ESM), Express, `ws` (WebSockets), JSON Flat Files (`/data`), JWT / bcryptjs  
**Assignee:** Backend Engineering Team

---

## 🎯 Objective

Refactor the monolithic backend (`server.js` ~1,550 lines) into a structured, modular, and production-ready architecture. The target system must maintain complete API compatibility with the current frontend (defined in `src/lib/api.ts`), while introducing a clean database abstraction layer for future scalability.

---

## 🛠️ Required Refactoring Tasks

### 1. Monolith Breakdown (MVC Pattern)

Deconstruct `server.js` into a structured, modular folder layout:

```
backend/
├── config/              # Environment & security config (dotenv, cors, rate-limits)
├── controllers/         # Request handling logic (Auth, DIDs, VCs, Consent, Vitals)
├── data/                # Current JSON flat-file storage (to be abstracted)
├── middleware/          # JWT verification, RBAC check, request logging
├── models/              # Data schemas/interfaces
├── routes/              # Express Router modules (split by domain)
├── services/            # Cryptography, simulated ledger engine, third-party sync (Solana/Convex)
├── server.js            # App entry point (initializes DB, middleware, route mounting, WS)
└── ws-handler.js        # Decoupled WebSocket connection & broadcast manager
```

#### Acceptance Criteria:

- `server.js` contains fewer than 150 lines of code, focusing purely on bootstrapping.
- Domain-specific logic is routed via separate route modules:
  - `/routes/auth.js`
  - `/routes/did.js`
  - `/routes/credential.js`
  - `/routes/consent.js`
  - `/routes/clinical.js` (prescriptions, labs, beds, vitals)
  - `/routes/ledger.js` (blocks, stats, modules)
  - `/routes/extensions.js` (NFC, attendance, visitors)
- No raw logic exists inside the route declarations; it must defer to controllers.

---

### 2. Database Abstraction Layer (DAL)

The current system writes directly to flat JSON files in `backend/data/` using synchronous read/writes or inline helpers:

- Create a database service interface (e.g., `services/database.js` or `world-state-db.js`).
- Implement an abstraction that wraps basic database operations (`get`, `set`, `list`, `queryByNamespace`).
- **Goal:** Allow switching persistence from the current mock JSON files to a relational database (PostgreSQL) or a real CouchDB ledger instance in the future by editing only one file.

---

### 3. Cryptography & Security Hardening

- **Config Verification:** Implement environment variable schema validation (using a library like `zod` or a custom configuration parser) to fail early on startup if key parameters (`JWT_SECRET`, `IDENTITY_SECRET`, etc.) are missing.
- **Cryptography Upgrades:** Implement standard cryptographical validation (e.g., `crypto` Node module, WebCrypto, or ECDSA signing for DIDs).
- **Token Hardening:** Set up secure cookie configuration options for JWT distribution, prepping the client to transition away from local storage tokens to `HttpOnly` cookie-based sessions.

---

### 4. Decoupled WebSockets

- Isolate WebSocket server setup and event triggers from HTTP routes.
- Create a dedicated WebSocket pub/sub emitter service (`services/websocket.js`) so route controllers can trigger broadcasts (e.g., `wsBroadcast("vitals:update", data)`) without needing direct references to the global client connection list.

---

## 🚦 Verification & Acceptance Criteria

1. **API Parity:** The frontend must work seamlessly with the refactored backend without modifying any URL targets or payload interfaces inside `src/lib/api.ts`.
2. **WebSocket Stability:** Live telemetry updates (vitals ticks, staff tracker signals) must broadcast immediately to all active tabs.
3. **Graceful Startup:** The server fails to start with descriptive errors if `.env` configurations are malformed or missing.
4. **Linting & Hygiene:** The codebase must pass standard linting rules (`npm run lint` or standard ESM rules) with zero syntax warnings.
