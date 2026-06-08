/**
 * Hyperledger Fabric Simulation Server
 * REST API + WebSocket real-time broadcast
 * Port: 3001
 */

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { ConvexHttpClient } from "convex/browser";
import {
  putState as dbPutState, getState, getAllState, queryState,
  deleteState, getWorldStateSize, getAllWorldState, generateId,
} from "./world-state-db.js";

// Manual basic .env loader to read from workspace root
function loadEnv() {
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf8");
      content.split("\n").forEach(line => {
        const parts = line.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
          process.env[key] = val;
        }
      });
    } catch (e) {
      console.warn("Could not read .env file:", e.message);
    }
  }
}
loadEnv();

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

app.use(cors({ origin: "*" }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("tiny"));
app.use(express.json({ limit: "2mb" }));

// Initialize Convex Client
const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
let convexClient = null;
if (convexUrl && convexUrl !== "https://dummy-url.convex.cloud") {
  try {
    convexClient = new ConvexHttpClient(convexUrl);
    console.log(`📡 Connected to Live Convex Database at: ${convexUrl}`);
  } catch (err) {
    console.error("⚠️ Failed to connect Convex Client:", err.message);
  }
} else {
  console.log("ℹ️ Convex URL not configured. Operating in local simulated storage mode.");
}

// ─── Convex Real-Time Synchronizer ───────────────────────────────────────────
async function syncToConvex(namespace, key, value, txId) {
  if (!convexClient) return;
  try {
    // Invoke mutations using string paths (fully compatible with ConvexHttpClient)
    switch (namespace) {
      case "did-registry":
        if (value.status === "revoked") {
          await convexClient.mutation("records:revokeDID", { did: value.did });
        } else {
          await convexClient.mutation("records:createDID", {
            did: value.did,
            owner: value.owner,
            ownerType: value.ownerType || "patient",
            controller: value.controller || "did:hosp:consortium:authority",
            publicKey: value.publicKey || "",
            status: value.status || "active",
            createdAt: value.createdAt || new Date().toISOString(),
            updatedAt: value.updatedAt || new Date().toISOString(),
            serviceEndpoint: value.serviceEndpoint || "",
          });
        }
        break;

      case "credentials":
        if (value.status === "revoked") {
          await convexClient.mutation("records:revokeCredential", { id: value.id });
        } else {
          await convexClient.mutation("records:issueCredential", {
            id: value.id,
            type: value.type,
            issuer: value.issuer,
            subject: value.subject,
            issuedAt: value.issuedAt,
            expiresAt: value.expiresAt,
            claims: value.claims,
            signature: value.signature,
            status: value.status || "active",
          });
        }
        break;

      case "consent-manager":
        if (value.status === "revoked") {
          await convexClient.mutation("records:revokeConsent", { grantId: value.grantId });
        } else {
          await convexClient.mutation("records:grantConsent", {
            grantId: value.grantId,
            patientDid: value.patientDid,
            doctorDid: value.doctorDid,
            resource: value.resource,
            status: value.status || "active",
            expiry: value.expiry,
            grantedAt: value.grantedAt,
          });
        }
        break;

      case "audit":
        await convexClient.mutation("records:logAuditEvent", {
          txId: value.txId || txId || randomUUID(),
          actor: value.actor,
          resource: value.resource,
          action: value.action,
          outcome: value.outcome || "success",
          severity: value.severity || "info",
          loggedAt: value.loggedAt || new Date().toISOString(),
        });
        break;

      case "beds":
        await convexClient.mutation("records:updateBed", {
          bedId: value.bedId,
          ward: value.ward,
          status: value.status,
          patientDid: value.patientDid || undefined,
          updatedAt: value.updatedAt || new Date().toISOString(),
        });
        break;

      case "prescriptions":
        await convexClient.mutation("records:createPrescription", {
          rxId: value.rxId,
          patientDid: value.patientDid,
          doctorDid: value.doctorDid,
          drugs: value.drugs || [],
          diagnosis: value.diagnosis,
          notes: value.notes,
          signedBy: value.signedBy,
          signedAt: value.signedAt || new Date().toISOString(),
          status: value.status || "active",
          hash: value.hash || "",
        });
        break;

      case "appointments":
        await convexClient.mutation("records:createAppointment", {
          apptId: value.apptId,
          patientDid: value.patientDid,
          patientName: value.patientName,
          doctorDid: value.doctorDid,
          doctorName: value.doctorName,
          slot: value.slot,
          mode: value.mode,
          specialty: value.specialty,
          status: value.status || "confirmed",
          bookedAt: value.bookedAt || new Date().toISOString(),
        });
        break;
    }
  } catch (err) {
    console.error(`⚠️ Convex sync error [${namespace}]:`, err.message);
  }
}

// Wrapped putState to intercept all chaincode/worldstate writes
function putState(namespace, key, value, txId, version = "1") {
  const entry = dbPutState(namespace, key, value, txId, version);
  syncToConvex(namespace, key, value, txId).catch((err) => {
    console.error("⚠️ Convex background sync failed:", err.message);
  });
  return entry;
}



// ─── In-memory ledger (persisted per session) ────────────────────────────────
const CHANNEL = "embrace-health-channel";
const PEERS = ["Org1Peer0MSP", "Org1Peer1MSP", "Org2Peer0MSP"];
const ORDERERS = ["raft-orderer-01a", "raft-orderer-02b"];
let _ledger = [genesisBlock()];
let _blockNumber = 1;

function simHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, "0") + randomUUID().replace(/-/g, "").slice(0, 24);
}

function genesisBlock() {
  return {
    blockNumber: 0, channelId: CHANNEL,
    previousHash: "0".repeat(64),
    dataHash: simHash("GENESIS_2026"),
    transactions: [{ txId: "genesis", chaincode: "system", fcn: "initLedger", args: [], status: "VALID", timestamp: new Date().toISOString() }],
    timestamp: new Date().toISOString(),
    metadata: { orderer: ORDERERS[0], commitPeer: PEERS[0], consensusType: "etcdraft" },
  };
}

function commitBlock(proposal) {
  const prev = _ledger[_ledger.length - 1];
  const block = {
    blockNumber: _blockNumber++,
    channelId: CHANNEL,
    previousHash: prev.dataHash,
    dataHash: simHash(JSON.stringify(proposal)),
    transactions: [proposal],
    timestamp: new Date().toISOString(),
    metadata: {
      orderer: ORDERERS[Math.floor(Math.random() * ORDERERS.length)],
      commitPeer: PEERS[0],
      consensusType: "etcdraft",
    },
  };
  _ledger.push(block);
  if (_ledger.length > 500) _ledger = _ledger.slice(-500);
  broadcast({ event: "block:committed", data: block });
  return block;
}

// ─── WebSocket broadcast ─────────────────────────────────────────────────────
function broadcast(msg) {
  const text = JSON.stringify(msg);
  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(text); });
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ event: "connected", data: { blockHeight: _ledger.length, peers: PEERS.length } }));
  ws.on("error", () => {});
});

// ─── Vitals simulator ────────────────────────────────────────────────────────
const _vitals = new Map();
setInterval(() => {
  if (wss.clients.size === 0) return;
  const updates = [];
  for (const [id, v] of _vitals) {
    const updated = {
      heartRate: Math.max(40, Math.min(160, v.heartRate + Math.round((Math.random() - 0.5) * 6))),
      bp: `${Math.max(80, Math.min(180, parseInt(v.bp) + Math.round((Math.random() - 0.5) * 4)))}/${Math.max(50, Math.min(120, parseInt(v.bp.split("/")[1] || "80") + Math.round((Math.random() - 0.5) * 3)))}`,
      spo2: Math.max(88, Math.min(100, v.spo2 + Math.round((Math.random() - 0.5) * 2))),
      temp: parseFloat(Math.max(35, Math.min(40, v.temp + (Math.random() - 0.5) * 0.2)).toFixed(1)),
      respRate: Math.max(8, Math.min(30, v.respRate + Math.round((Math.random() - 0.5) * 2))),
    };
    _vitals.set(id, updated);
    updates.push({ id, ...updated });
  }
  if (updates.length > 0) broadcast({ event: "vitals:update", data: updates });
}, 5000);

// ─── Staff location simulator ────────────────────────────────────────────────
const LOCATIONS = ["OPD Room 3", "ICU Block B", "Emergency Ward", "OR Suite 2", "Radiology Block", "Lab Wing A", "Nursing Station", "Admin Block"];
const _staffLoc = new Map();
setInterval(async () => {
  if (wss.clients.size === 0 || _staffLoc.size === 0) return;
  const ids = [..._staffLoc.keys()];
  const id = ids[Math.floor(Math.random() * ids.length)];
  const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  const now = new Date().toISOString();
  _staffLoc.set(id, { location: loc, lastSignal: now, beacon: `${70 + Math.floor(Math.random() * 30)}%` });
  putState("tracker", id, { staffId: id, location: loc, lastPing: now }, randomUUID());
  broadcast({ event: "staff:location", data: { id, location: loc, lastSignal: now } });
}, 8000);

// ═══════════════════════════════════════════════════════════════════════════════
// REST ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Health
app.get("/health", (_, res) => res.json({ status: "ok", blockHeight: _ledger.length, peers: PEERS.length, time: new Date().toISOString() }));

// ─── Ledger ──────────────────────────────────────────────────────────────────
app.get("/api/ledger", (req, res) => {
  const page = parseInt(req.query.page ?? "0");
  const size = parseInt(req.query.size ?? "20");
  const blocks = [..._ledger].reverse().slice(page * size, (page + 1) * size);
  res.json({ blocks, total: _ledger.length, blockHeight: _ledger.length });
});

app.get("/api/ledger/stats", (_, res) => {
  const txCount = _ledger.reduce((s, b) => s + b.transactions.length, 0);
  res.json({
    blockHeight: _ledger.length, txCount,
    peerCount: PEERS.length, ordererCount: ORDERERS.length,
    worldStateSize: getWorldStateSize(),
    lastBlockTime: _ledger[_ledger.length - 1]?.timestamp,
    throughputTps: parseFloat((txCount / Math.max(1, _ledger.length)).toFixed(2)),
    channel: CHANNEL,
  });
});

// ─── Transactions ─────────────────────────────────────────────────────────────
app.post("/api/transaction", async (req, res) => {
  const { chaincode, fcn, args = [], creator = "Frontend" } = req.body;
  if (!chaincode || !fcn) return res.status(400).json({ error: "chaincode and fcn required" });

  await new Promise((r) => setTimeout(r, 300 + Math.random() * 400)); // simulate endorsement

  const txId = `tx_${Date.now().toString(16)}_${randomUUID().slice(0, 8)}`;
  const timestamp = new Date().toISOString();

  // Apply to world state
  applyChaincode(chaincode, fcn, args, txId, timestamp);

  const proposal = { txId, chaincode, channel: CHANNEL, fcn, args, status: "VALID", timestamp, creator, endorsers: [PEERS[0], PEERS[1]] };
  const block = commitBlock(proposal);

  res.json({ txId, blockNumber: block.blockNumber, status: "COMMITTED", timestamp });
});

// ─── World State ──────────────────────────────────────────────────────────────
app.get("/api/worldstate", (_, res) => res.json(getAllWorldState()));
app.get("/api/worldstate/:namespace", (req, res) => res.json(getAllState(req.params.namespace)));
app.get("/api/worldstate/:namespace/:key", (req, res) => {
  const entry = getState(req.params.namespace, req.params.key);
  if (!entry) return res.status(404).json({ error: "Not found" });
  res.json(entry);
});

// ─── DID Registry ─────────────────────────────────────────────────────────────
app.get("/api/did", (_, res) => {
  const all = getAllState("did-registry");
  res.json({ dids: all.map((e) => e.value), total: all.length });
});

app.get("/api/did/:did", (req, res) => {
  const entry = getState("did-registry", req.params.did);
  if (!entry) return res.status(404).json({ error: "DID not found" });
  res.json(entry.value);
});

app.post("/api/did", async (req, res) => {
  const userRole = req.headers["x-user-role"];
  if (userRole !== "admin") {
    return res.status(403).json({ error: "Access Denied: Only Admin can create DIDs" });
  }

  const { owner, ownerType = "patient", controller, ownerEmail } = req.body;
  if (!owner) return res.status(400).json({ error: "owner required" });
  const did = `did:hosp:0x${simHash(owner + Date.now()).slice(0, 8)}`;
  const txId = randomUUID();
  const doc = {
    did, publicKey: `MFkw${simHash(did).slice(0, 32).toUpperCase()}`,
    controller: controller || "did:hosp:consortium:authority",
    owner, ownerType, status: "active", credentials: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    serviceEndpoint: `https://did.apollohospitals.in/resolve/${did}`,
    ownerEmail: ownerEmail || null
  };
  putState("did-registry", did, doc, txId);
  const block = commitBlock({ txId, chaincode: "did-registry", fcn: "createDID", args: [did, owner, ownerType], status: "VALID", timestamp: new Date().toISOString(), channel: CHANNEL, creator: "API" });

  if (ownerEmail) {
    const userEntry = getState("users", ownerEmail);
    if (userEntry) {
      userEntry.value.did = did;
      putState("users", ownerEmail, userEntry.value, randomUUID());
    }
  }

  broadcast({ event: "did:created", data: doc });
  res.json({ did, doc, blockNumber: block.blockNumber, txId });
});

app.patch("/api/did/:did/revoke", (req, res) => {
  const entry = getState("did-registry", req.params.did);
  if (!entry) return res.status(404).json({ error: "DID not found" });
  entry.value.status = "revoked";
  entry.value.updatedAt = new Date().toISOString();
  putState("did-registry", req.params.did, entry.value, randomUUID());
  broadcast({ event: "did:revoked", data: { did: req.params.did } });
  res.json({ success: true, did: req.params.did, status: "revoked" });
});

// ─── Credentials ──────────────────────────────────────────────────────────────
app.post("/api/credential/issue", async (req, res) => {
  const { did, type = "IdentityVC", claims = {}, issuer } = req.body;
  if (!did) return res.status(400).json({ error: "did required" });
  const entry = getState("did-registry", did);
  if (!entry) return res.status(404).json({ error: "DID not found" });
  const txId = randomUUID();
  const vc = {
    id: `vc_${txId.slice(0, 8)}`, type, issuer: issuer || "Apollo Hospital Authority",
    subject: did, issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    claims, signature: `MEQCIBas${simHash(did + type).slice(0, 20)}==`,
    status: "active",
  };
  if (!entry.value.credentials) entry.value.credentials = [];
  entry.value.credentials.push(vc);
  entry.value.updatedAt = new Date().toISOString();
  putState("did-registry", did, entry.value, txId);
  putState("credentials", vc.id, vc, txId);
  const block = commitBlock({ txId, chaincode: "credential-issuer", fcn: "issueCredential", args: [did, type], status: "VALID", timestamp: new Date().toISOString(), channel: CHANNEL, creator: "API" });
  broadcast({ event: "credential:issued", data: vc });
  res.json({ vc, blockNumber: block.blockNumber, txId });
});

app.patch("/api/credential/:id/revoke", (req, res) => {
  const entry = getState("credentials", req.params.id);
  if (!entry) return res.status(404).json({ error: "Credential not found" });
  entry.value.status = "revoked";
  entry.value.revokedAt = new Date().toISOString();
  putState("credentials", req.params.id, entry.value, randomUUID());
  broadcast({ event: "credential:revoked", data: { id: req.params.id } });
  res.json({ success: true, id: req.params.id });
});

app.get("/api/credentials", (_, res) => {
  const all = getAllState("credentials");
  res.json({ credentials: all.map((e) => e.value), total: all.length });
});

// ─── Consent ──────────────────────────────────────────────────────────────────
app.get("/api/consent", (_, res) => {
  const all = getAllState("consent-manager");
  res.json({ consents: all.map((e) => e.value), total: all.length });
});

app.post("/api/consent/grant", (req, res) => {
  const { patientDid, doctorDid, resource, expiry } = req.body;
  const grantId = `consent_${randomUUID().slice(0, 8)}`;
  const txId = randomUUID();
  const grant = {
    grantId, patientDid, doctorDid, resource,
    status: "active",
    expiry: expiry || new Date(Date.now() + 7 * 86400000).toISOString(),
    grantedAt: new Date().toISOString(),
  };
  putState("consent-manager", grantId, grant, txId);
  commitBlock({ txId, chaincode: "consent-manager", fcn: "grantConsent", args: [grantId, patientDid, doctorDid, resource], status: "VALID", timestamp: new Date().toISOString(), channel: CHANNEL, creator: "API" });
  broadcast({ event: "consent:granted", data: grant });
  res.json(grant);
});

app.patch("/api/consent/:id/revoke", (req, res) => {
  const entry = getState("consent-manager", req.params.id);
  if (!entry) return res.status(404).json({ error: "Not found" });
  entry.value.status = "revoked";
  entry.value.revokedAt = new Date().toISOString();
  putState("consent-manager", req.params.id, entry.value, randomUUID());
  broadcast({ event: "consent:revoked", data: { id: req.params.id } });
  res.json({ success: true });
});

// ─── Audit ────────────────────────────────────────────────────────────────────
app.get("/api/audit", (req, res) => {
  const page = parseInt(req.query.page ?? "0");
  const size = parseInt(req.query.size ?? "50");
  const all = getAllState("audit");
  const sorted = all.sort((a, b) => b.updatedAt?.localeCompare(a.updatedAt ?? "") ?? 0);
  res.json({ events: sorted.slice(page * size, (page + 1) * size).map((e) => e.value), total: all.length });
});

app.post("/api/audit/log", (req, res) => {
  const { actor, resource, action, outcome = "success", severity = "info" } = req.body;
  const txId = randomUUID();
  const event = { txId, actor, resource, action, outcome, severity, loggedAt: new Date().toISOString() };
  putState("audit", `audit_${txId}`, event, txId);
  commitBlock({ txId, chaincode: "audit-chaincode", fcn: "logEvent", args: [actor, resource, action, outcome], status: "VALID", timestamp: new Date().toISOString(), channel: CHANNEL, creator: actor });
  broadcast({ event: "audit:logged", data: event });
  res.json(event);
});

// ─── Vitals ───────────────────────────────────────────────────────────────────
app.post("/api/vitals/seed", (req, res) => {
  const { patients = [] } = req.body;
  patients.forEach(({ id, heartRate = 72, bp = "120/80", spo2 = 98, temp = 36.5, respRate = 16 }) => {
    _vitals.set(id, { heartRate, bp, spo2, temp, respRate });
  });
  res.json({ seeded: patients.length });
});

app.get("/api/vitals/:id", (req, res) => {
  const v = _vitals.get(req.params.id);
  if (!v) return res.status(404).json({ error: "Not found" });
  res.json(v);
});

// ─── Staff tracker ────────────────────────────────────────────────────────────
app.post("/api/tracker/seed", (req, res) => {
  const { staff = [] } = req.body;
  staff.forEach(({ id, location = "Nursing Station" }) => {
    _staffLoc.set(id, { location, lastSignal: new Date().toISOString(), beacon: "85%" });
    putState("tracker", id, { staffId: id, location, lastPing: new Date().toISOString() }, randomUUID());
  });
  res.json({ seeded: staff.length });
});

app.get("/api/tracker", (_, res) => {
  const all = getAllState("tracker");
  res.json({ staff: all.map((e) => e.value) });
});

// ─── Beds & Infrastructure ────────────────────────────────────────────────────
app.get("/api/beds", (_, res) => {
  const all = getAllState("beds");
  res.json({ beds: all.map((e) => e.value), total: all.length });
});

app.post("/api/beds", (req, res) => {
  const { bedId, ward, status = "available", patientDid } = req.body;
  const txId = randomUUID();
  const bed = { bedId, ward, status, patientDid, updatedAt: new Date().toISOString() };
  putState("beds", bedId, bed, txId);
  commitBlock({ txId, chaincode: "infrastructure-chaincode", fcn: "updateBed", args: [bedId, ward, status], status: "VALID", timestamp: new Date().toISOString(), channel: CHANNEL, creator: "Infrastructure" });
  broadcast({ event: "bed:updated", data: bed });
  res.json(bed);
});

// ─── Prescriptions ────────────────────────────────────────────────────────────
app.post("/api/prescriptions", (req, res) => {
  const { patientDid, doctorDid, drugs, diagnosis, notes, signedBy } = req.body;
  const txId = randomUUID();
  const rxId = `PR-${Date.now().toString(36).toUpperCase()}`;
  const rx = {
    rxId, patientDid, doctorDid, drugs, diagnosis, notes, signedBy,
    signedAt: new Date().toISOString(), status: "active",
    hash: `sha256:${simHash(rxId + patientDid)}`,
  };
  putState("prescriptions", rxId, rx, txId);
  const block = commitBlock({ txId, chaincode: "prescription-chaincode", fcn: "signPrescription", args: [rxId, patientDid, doctorDid], status: "VALID", timestamp: new Date().toISOString(), channel: CHANNEL, creator: signedBy });
  broadcast({ event: "prescription:signed", data: { rxId, blockNumber: block.blockNumber } });
  res.json({ rxId, rx, blockNumber: block.blockNumber, txId });
});

app.get("/api/prescriptions/:patientDid", (req, res) => {
  const all = queryState("prescriptions", (v) => v.patientDid === req.params.patientDid);
  res.json({ prescriptions: all.map((e) => e.value) });
});

// ─── Lab results ──────────────────────────────────────────────────────────────
app.post("/api/labs", (req, res) => {
  const { patientDid, orderedBy, tests, priority = "routine" } = req.body;
  const labId = `LAB-${Date.now().toString(36).toUpperCase()}`;
  const txId = randomUUID();
  const lab = { labId, patientDid, orderedBy, tests, priority, status: "pending", orderedAt: new Date().toISOString() };
  putState("lab-results", labId, lab, txId);
  commitBlock({ txId, chaincode: "lab-chaincode", fcn: "createLabOrder", args: [labId, patientDid, priority], status: "VALID", timestamp: new Date().toISOString(), channel: CHANNEL, creator: orderedBy });
  broadcast({ event: "lab:ordered", data: lab });
  res.json(lab);
});

app.get("/api/labs/:patientDid", (req, res) => {
  const all = queryState("lab-results", (v) => v.patientDid === req.params.patientDid);
  res.json({ labs: all.map((e) => e.value) });
});

// ─── Fraud alerts ─────────────────────────────────────────────────────────────
app.post("/api/fraud/alert", (req, res) => {
  const { actor, type, message, severity = "high", riskScore = 75 } = req.body;
  const alertId = `FA-${randomUUID().slice(0, 8).toUpperCase()}`;
  const txId = randomUUID();
  const alert = { alertId, actor, type, message, severity, riskScore, status: "open", detectedAt: new Date().toISOString() };
  putState("fraud-alerts", alertId, alert, txId);
  broadcast({ event: "fraud:detected", data: alert });
  res.json(alert);
});

app.get("/api/fraud/alerts", (_, res) => {
  const all = getAllState("fraud-alerts");
  res.json({ alerts: all.map((e) => e.value), total: all.length });
});

// ─── Billing ──────────────────────────────────────────────────────────────────
app.post("/api/billing/payment", (req, res) => {
  const { patientDid, patientName, amount, category, reference } = req.body;
  const txId = randomUUID();
  const ref = reference || `REF-${Date.now().toString(36).toUpperCase()}`;
  const payment = { txId, patientDid, patientName, amount, category, status: "settled", ref, settledAt: new Date().toISOString() };
  putState("billing", ref, payment, txId);
  commitBlock({ txId, chaincode: "billing-chaincode", fcn: "recordPayment", args: [patientDid, String(amount), category, ref], status: "VALID", timestamp: new Date().toISOString(), channel: CHANNEL, creator: "Billing" });
  broadcast({ event: "payment:recorded", data: payment });
  res.json(payment);
});

app.get("/api/billing/:patientDid", (req, res) => {
  const all = queryState("billing", (v) => v.patientDid === req.params.patientDid);
  res.json({ payments: all.map((e) => e.value) });
});

// ─── Appointments ─────────────────────────────────────────────────────────────
app.get("/api/appointments", (_, res) => {
  const all = getAllState("appointments");
  res.json({ appointments: all.map((e) => e.value), total: all.length });
});

app.post("/api/appointments", (req, res) => {
  const { patientDid, patientName, doctorDid, doctorName, slot, mode, specialty } = req.body;
  const apptId = `appt_${randomUUID().slice(0, 8)}`;
  const txId = randomUUID();
  const appt = { apptId, patientDid, patientName, doctorDid, doctorName, slot, mode, specialty, status: "confirmed", bookedAt: new Date().toISOString() };
  putState("appointments", apptId, appt, txId);
  commitBlock({ txId, chaincode: "appointments-chaincode", fcn: "createAppointment", args: [apptId, patientDid, doctorDid, slot], status: "VALID", timestamp: new Date().toISOString(), channel: CHANNEL, creator: patientName });
  broadcast({ event: "appointment:booked", data: appt });
  res.json(appt);
});

// ─── Chaincode applier ────────────────────────────────────────────────────────
function applyChaincode(chaincode, fcn, args, txId, timestamp) {
  const key = `${chaincode}::${fcn}`;
  switch (key) {
    case "did-registry::createDID":
    case "did-registry::registerDID": {
      const [did, owner, ownerType, controller] = args;
      const doc = {
        did, owner, ownerType, status: "active", credentials: [],
        controller: controller || "did:hosp:consortium:authority",
        publicKey: `MFkw${simHash(did).slice(0, 32).toUpperCase()}`,
        createdAt: timestamp, updatedAt: timestamp,
        serviceEndpoint: `https://did.apollohospitals.in/resolve/${did}`,
      };
      putState("did-registry", did, doc, txId);
      break;
    }
    case "did-registry::revokeDID": {
      const [did] = args;
      const entry = getState("did-registry", did);
      if (entry) {
        entry.value.status = "revoked";
        entry.value.updatedAt = timestamp;
        putState("did-registry", did, entry.value, txId);
      }
      break;
    }
    case "credential-issuer::issueCredential": {
      const [did, credType, issuer, claims] = args;
      const entry = getState("did-registry", did);
      if (entry) {
        const vc = {
          id: `vc_${txId}`,
          type: credType || "IdentityVC",
          issuer: issuer || "Apollo Hospital Authority",
          subject: did,
          issuedAt: timestamp,
          expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
          claims: claims ? JSON.parse(claims) : {},
          signature: `MEQCIBas${simHash(did + credType + txId).slice(0, 20)}==`,
          status: "active",
        };
        if (!entry.value.credentials) entry.value.credentials = [];
        entry.value.credentials.push(vc);
        entry.value.updatedAt = timestamp;
        putState("did-registry", did, entry.value, txId);
        putState("credentials", vc.id, vc, txId);
      }
      break;
    }
    case "consent-manager::grantConsent": {
      const [grantId, patient, doctor, resource, expiry] = args;
      putState("consent-manager", grantId, {
        grantId, patientDid: patient, doctorDid: doctor, resource,
        status: "active",
        expiry: expiry || new Date(Date.now() + 7 * 86400000).toISOString(),
        grantedAt: timestamp,
      }, txId);
      break;
    }
    case "consent-manager::revokeConsent": {
      const [grantId] = args;
      const entry = getState("consent-manager", grantId);
      if (entry) {
        entry.value.status = "revoked";
        entry.value.revokedAt = timestamp;
        putState("consent-manager", grantId, entry.value, txId);
      }
      break;
    }
    case "billing-chaincode::recordPayment": {
      const [patientDid, patientName, amount, category, ref] = args;
      putState("billing", ref || `bill_${txId}`, {
        patientDid, patientName, amount: Number(amount),
        category, status: "settled", ref, settledAt: timestamp,
      }, txId);
      break;
    }
    case "billing-chaincode::raiseInvoice": {
      const [patientDid, invoiceId, amount, items] = args;
      putState("billing", `invoice:${invoiceId}`, {
        patientDid, invoiceId, amount: Number(amount),
        items, status: "outstanding", raisedAt: timestamp,
      }, txId);
      break;
    }
    case "tracker-chaincode::reportTelemetry": {
      const [staffDid, name, location, status] = args;
      putState("tracker", staffDid, {
        staffDid, name, location, status, lastPing: timestamp,
        beaconStrength: (70 + Math.floor(Math.random() * 30)) + "%",
      }, txId);
      break;
    }
    case "tracker-chaincode::dispatchPagerNotify": {
      const [staffDid, name, location] = args;
      putState("tracker", `pager:${txId}`, {
        staffDid, name, location, type: "PAGER_NOTIFY", dispatchedAt: timestamp, status: "delivered",
      }, txId);
      break;
    }
    case "appointments-chaincode::createAppointment": {
      const [apptId, patientDid, doctorDid, slot, mode] = args;
      let patientName = "Unknown Patient";
      let doctorName = "Unknown Doctor";
      const pEntry = getState("did-registry", patientDid);
      if (pEntry) patientName = pEntry.value.owner;
      const dEntry = getState("did-registry", doctorDid);
      if (dEntry) doctorName = dEntry.value.owner;

      putState("appointments", apptId || `appt_${txId}`, {
        apptId: apptId || `appt_${txId}`, patientDid, patientName, doctorDid, doctorName, slot, mode,
        status: "confirmed", bookedAt: timestamp,
      }, txId);
      break;
    }
    case "appointments-chaincode::cancelAppointment": {
      const [apptId] = args;
      const entry = getState("appointments", apptId);
      if (entry) {
        entry.value.status = "cancelled";
        entry.value.cancelledAt = timestamp;
        putState("appointments", apptId, entry.value, txId);
      }
      break;
    }
    case "audit-chaincode::logEvent": {
      const [actor, resource, action, outcome] = args;
      putState("audit", `audit_${txId}`, {
        txId: `audit_${txId}`, actor, resource, action, outcome,
        loggedAt: timestamp, severity: "info",
      }, txId);
      break;
    }
    case "financial-ledger-chaincode::resolvePatientDID": {
      const [did, name] = args;
      putState("financial", `resolve:${did}`, {
        did, name, resolvedAt: timestamp, by: "admin-console",
      }, txId);
      break;
    }
    case "financial-ledger-chaincode::generateFinancialStatement": {
      const [did, name] = args;
      putState("financial", `statement:${did}:${txId}`, {
        did, name, generatedAt: timestamp, format: "PDF",
      }, txId);
      break;
    }
    default:
      putState(chaincode, `generic_${txId}`, { fcn, args, executedAt: timestamp }, txId);
      break;
  }
}

// ─── Auth APIs ────────────────────────────────────────────────────────────────
app.post("/api/auth/signup", async (req, res) => {
  const { name, email, role, password } = req.body;
  if (!email || !role || !name) {
    return res.status(400).json({ error: "Name, email, and role are required" });
  }

  const existingUser = getState("users", email);
  if (existingUser) {
    return res.status(400).json({ error: "User already exists" });
  }

  const txId = randomUUID();
  const user = { name, email, password: password || "", role, did: null, createdAt: new Date().toISOString() };
  putState("users", email, user, txId);
  
  commitBlock({
    txId,
    chaincode: "users",
    fcn: "signup",
    args: [email, name, role],
    status: "VALID",
    timestamp: new Date().toISOString(),
    channel: CHANNEL,
    creator: "System"
  });

  res.json({ success: true, user: { name, email, role } });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const userEntry = getState("users", email);
  if (!userEntry) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  // If password was provided on signup, verify it, otherwise mock login is fine
  if (userEntry.value.password && userEntry.value.password !== password) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  res.json({ 
    success: true, 
    user: { 
      name: userEntry.value.name, 
      email: userEntry.value.email, 
      role: userEntry.value.role, 
      did: userEntry.value.did 
    } 
  });
});

app.get("/api/auth/users", (req, res) => {
  const role = req.headers["x-user-role"];
  if (role !== "admin") {
    return res.status(403).json({ error: "Forbidden: Admins only" });
  }

  const entries = getAllState("users");
  const users = entries.map(e => e.value);
  res.json({ users });
});

// 404
app.use((_, res) => res.status(404).json({ error: "Not found" }));

async function seedWorldStateIfEmpty() {
  console.log("🌱 World State seeding skipped (running in clean nil mode).");
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, async () => {
  console.log(`\n🏥 Hyperledger Fabric Simulation Server`);
  console.log(`   REST API : http://localhost:${PORT}/api`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   Health   : http://localhost:${PORT}/health\n`);

  try {
    const { bootstrapFromConvex } = await import("./world-state-db.js");
    await bootstrapFromConvex();
    await seedWorldStateIfEmpty();
  } catch (err) {
    console.error("⚠️ Failed to bootstrap World State from Convex:", err.message);
  }
});

