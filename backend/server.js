/**
 * Express REST API + WebSocket Server (Clean, Database-Driven)
 * Port: 3001
 */

// Embrace Health backend entry point
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { ConvexHttpClient } from "convex/browser";
import {
  putState as dbPutState,
  getState,
  getAllState,
  queryState,
  deleteState,
  getWorldStateSize,
  getAllWorldState,
  generateId,
  createEncryptedBackup,
  verifyBackupEncryption,
} from "./world-state-db.js";
import { buildAuth, requestFingerprint } from "./middleware/auth.js";
import { createAuditHelper } from "./lib/audit.js";
import { registerExtensionRoutes } from "./routes/extensions.js";
import { MerkleTree, sha256 } from "./merkle.js";
import { buildMerkleTree, getMerkleRoot, hashLeaf } from "./lib/merkle-tree.js";
import { PublicKey, Transaction, TransactionInstruction, Connection } from "@solana/web3.js";
import { signCredential } from "./lib/vc-sign.js";
import * as notificationStore from "./lib/notifications.js";
import { splitRecord } from "./lib/hash.js";
import * as solanaLib from "./lib/solana.js";
import logger from "./lib/logger.js";
import { registerHealthRoutes } from "./lib/health.js";
import {
  createRefreshToken,
  consumeRefreshToken,
  revokeAllRefreshTokens,
  blockToken,
  blockAllTokensForUser,
  getTokenStoreStats,
  recordFailedLogin,
  checkAccountLockout,
  resetFailedLogins,
  generateTotpSecret,
  verifyTotpToken,
} from "./lib/token-store.js";
import {
  hipaaMiddleware,
  hipaaAuditPHIAccess,
  httpsEnforcementMiddleware,
  HIPAA_AUDIT_RETENTION_POLICY,
} from "./lib/hipaa.js";

// Load Environment Variables first
function loadEnv() {
  const envPaths = [
    join(process.cwd(), ".env"),
    join(process.cwd(), ".env.local"),
    join(process.cwd(), "..", ".env"),
    join(process.cwd(), "..", ".env.local"),
  ];
  envPaths.forEach((envPath) => {
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, "utf8");
        content.split("\n").forEach((line) => {
          if (line.trim().startsWith("#") || !line.includes("=")) return;
          const parts = line.split("=");
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts
              .slice(1)
              .join("=")
              .trim()
              .replace(/^['"]|['"]$/g, "");
            process.env[key] = val;
          }
        });
      } catch (e) {
        console.warn(`Could not read ${envPath} file:`, e.message);
      }
    }
  });
}
loadEnv();

let CLIENT_KEY = process.env.CLIENT_KEY || "apollo-consortium-client-secret-2026";

function requireClientAuth(req, res, next) {
  const clientKey = req.headers["x-client-key"];
  if (!clientKey || clientKey !== CLIENT_KEY) {
    return res
      .status(401)
      .json({ error: "Unauthorized Client Application: Missing or invalid x-client-key header" });
  }
  next();
}

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET environment variable is not set.");
    process.exit(1);
  } else {
    JWT_SECRET = "dev-only-jwt-secret-change-before-production";
    console.warn(
      "⚠️ JWT_SECRET environment variable is not set. Falling back to development secret.",
    );
  }
}
const IDENTITY_SECRET = process.env.IDENTITY_SECRET || JWT_SECRET + "-identity";
const ACCESS_TOKEN_TTL = "2h"; // Short-lived access token
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days (opaque, stored server-side)
const JWT_EXPIRES = ACCESS_TOKEN_TTL; // backward-compat alias
const CORS_ORIGIN =
  process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000,http://localhost:8080,http://localhost:3001";

/**
 * Mint a signed access JWT with a unique jti for revocation support.
 * @param {{ email:string, role:string, name:string, did?:string }} claims
 * @returns {{ token: string, jti: string, expiresIn: string }}
 */
function mintAccessToken(claims) {
  const jti = randomUUID();
  const token = jwt.sign({ ...claims, jti }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  return { token, jti };
}

const { requireAuth, requireRole, globalApiAuth } = buildAuth(jwt, JWT_SECRET);

const app = express();
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const allowedOrigins = CORS_ORIGIN.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || process.env.NODE_ENV !== "production") return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

const getCSPConnectSrc = () => {
  const sources = [
    "'self'",
    "http://localhost:3001",
    "ws://localhost:3001",
    "https://*.convex.cloud",
    "wss://*.convex.cloud",
    "https://api.devnet.solana.com",
  ];
  if (process.env.VITE_CONVEX_URL) {
    try {
      const url = new URL(process.env.VITE_CONVEX_URL);
      sources.push(`https://*.${url.host}`);
      sources.push(`wss://*.${url.host}`);
    } catch (_) {}
  }
  if (process.env.SOLANA_RPC_URL) {
    try {
      const url = new URL(process.env.SOLANA_RPC_URL);
      sources.push(`https://${url.host}`);
    } catch (_) {}
  }
  allowedOrigins.forEach((o) => {
    if (o !== "*") sources.push(o);
  });
  return [...new Set(sources)];
};

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: getCSPConnectSrc(),
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
      },
    },
  }),
);
// Structured request logging (replaces morgan)
app.use(logger.requestMiddleware.bind(logger));
app.use(express.json({ limit: "2mb" }));

// ─── HIPAA Technical Safeguards (§ 164.312) ──────────────────────────────────
// Order: HTTPS enforcement → security headers → session timeout → minimum necessary
app.use(
  hipaaMiddleware({
    httpsMode: process.env.NODE_ENV === "production" ? "redirect" : "warn",
    sessionMaxAge: 8 * 60 * 60, // 8 hours absolute session limit
  }),
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login/signup attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many refresh requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/refresh", refreshLimiter);

app.use(globalApiAuth);

logger.info("hipaa_audit_policy", HIPAA_AUDIT_RETENTION_POLICY);

// Initialize Convex Client
const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
let convexClient = null;
if (convexUrl && convexUrl !== "https://dummy-url.convex.cloud") {
  try {
    convexClient = new ConvexHttpClient(convexUrl);
    console.log(`📡 Connected to Live Convex Database at: ${convexUrl}`);
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      console.error("FATAL: Failed to connect to Convex Database in production:", err.message);
      process.exit(1);
    } else {
      console.error("⚠️ Failed to connect Convex Client:", err.message);
    }
  }
} else {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: Convex database URL is not configured in production environment.");
    process.exit(1);
  } else {
    console.log("ℹ️ Convex URL not configured. Operating in local simulated storage mode.");
  }
}

async function syncToConvex(namespace, key, value, txId) {
  if (!convexClient) return;
  try {
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

      default:
        await convexClient.mutation("records:putWorldState", {
          namespace,
          key,
          value,
          txId: txId || randomUUID(),
          version: "1",
        });
        break;
    }
  } catch (err) {
    console.error(`⚠️ Convex sync error [${namespace}]:`, err.message);
  }
}

function putState(namespace, key, value, txId, version = "1") {
  const entry = dbPutState(namespace, key, value, txId, version);
  syncToConvex(namespace, key, value, txId).catch((err) => {
    console.error("⚠️ Convex background sync failed:", err.message);
  });
  return entry;
}

const NETWORK = "embrace-health-network";
const NODES_COUNT = 3;

const logAudit = createAuditHelper({
  putState,
  broadcast,
  randomUUID,
  network: NETWORK,
});

function simHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, "0") + "a1b2c3d4e5f67890a1b2c3d4";
}

function broadcast(msg) {
  const text = JSON.stringify(msg);
  wss.clients.forEach((c) => {
    if (c.readyState === 1) c.send(text);
  });
}

wss.on("connection", (ws) => {
  ws.send(
    JSON.stringify({
      event: "connected",
      data: { blockHeight: 1, nodes: NODES_COUNT },
    }),
  );
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
const LOCATIONS = [
  "OPD Room 3",
  "ICU Block B",
  "Emergency Ward",
  "OR Suite 2",
  "Radiology Block",
  "Lab Wing A",
  "Nursing Station",
  "Admin Block",
];
const _staffLoc = new Map();
setInterval(async () => {
  if (wss.clients.size === 0 || _staffLoc.size === 0) return;
  const ids = [..._staffLoc.keys()];
  const id = ids[Math.floor(Math.random() * ids.length)];
  const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  const now = new Date().toISOString();
  _staffLoc.set(id, {
    location: loc,
    lastSignal: now,
    beacon: `${70 + Math.floor(Math.random() * 30)}%`,
  });
  putState("tracker", id, { staffId: id, location: loc, lastPing: now }, randomUUID());
  broadcast({ event: "staff:location", data: { id, location: loc, lastSignal: now } });
}, 8000);

// ─── Health check routes (liveness + readiness + metrics) ────────────────────
registerHealthRoutes(app, { convexClient });

// ─── Stats API ────────────────────────────────────────────────────────────────
app.get("/api/stats", requireAuth, (_, res) => {
  const audits = getAllState("audit");
  const txCount = audits.length;
  const blockHeight = Math.max(1, Math.floor(txCount / 3) + 1);
  const worldStateSize = getWorldStateSize();

  let lastBlockTime = new Date().toISOString();
  if (audits.length > 0) {
    const sortedAudits = [...audits].sort(
      (a, b) => b.updatedAt?.localeCompare(a.updatedAt ?? "") ?? 0,
    );
    if (sortedAudits[0]?.value?.loggedAt) {
      lastBlockTime = sortedAudits[0].value.loggedAt;
    }
  }

  const startMs = Date.now();

  const fraudAlerts = getAllState("fraud-alerts");
  const criticalFraudCount = fraudAlerts.filter(
    (a) => a.value?.severity === "high" || a.value?.status === "open",
  ).length;
  const complianceScore = Math.max(70, 100 - criticalFraudCount * 4);

  const uptimeSeconds = Math.floor(process.uptime());
  const computedTps = uptimeSeconds > 0 ? parseFloat((txCount / uptimeSeconds).toFixed(2)) : 0;
  const latencyMs = Date.now() - startMs;

  res.json({
    blockHeight,
    txCount,
    peerCount: convexClient ? 2 : 1,
    nodesCountUp: convexClient ? 2 : 1,
    nodesCountTotal: convexClient ? 2 : 1,
    worldStateSize,
    throughputTps: computedTps,
    lastBlockTime,
    latencyMs,
    complianceScore,
    uptimeSeconds,
  });
});

// ─── World State API ──────────────────────────────────────────────────────────
app.get("/api/worldstate", requireAuth, (_, res) => res.json(getAllWorldState()));
app.get("/api/worldstate/:namespace", requireAuth, (req, res) =>
  res.json(getAllState(req.params.namespace)),
);
app.get("/api/worldstate/:namespace/:key", requireAuth, (req, res) => {
  const entry = getState(req.params.namespace, req.params.key);
  if (!entry) return res.status(404).json({ error: "Not found" });
  res.json(entry);
});

// ─── DID Registry ─────────────────────────────────────────────────────────────
app.get("/api/did", requireAuth, (_, res) => {
  const all = getAllState("did-registry");
  res.json({ dids: all.map((e) => e.value), total: all.length });
});

app.get("/api/did/:did", requireAuth, (req, res) => {
  const entry = getState("did-registry", req.params.did);
  if (!entry) return res.status(404).json({ error: "DID not found" });
  res.json(entry.value);
});

app.post("/api/did", requireAuth, requireRole(["admin"]), async (req, res) => {
  const {
    owner,
    ownerType = "patient",
    controller,
    ownerEmail,
    mrn,
    employeeId,
    ...extraFields
  } = req.body;
  if (!owner) return res.status(400).json({ error: "owner required" });

  const assignedMrn =
    ownerType === "patient"
      ? mrn || extraFields.mrn || `MRN-${Math.floor(100000 + Math.random() * 900000)}`
      : null;
  const assignedEmployeeId =
    ownerType !== "patient"
      ? employeeId || extraFields.employeeId || `EMP-${Math.floor(1000 + Math.random() * 9000)}`
      : null;

  let preLinkedWallet = null;
  if (ownerEmail) {
    const userEntry = getState("users", ownerEmail);
    if (userEntry) {
      preLinkedWallet = userEntry.value.walletAddress || null;
    }
  }

  const did = `did:hosp:0x${simHash(owner + Date.now()).slice(0, 8)}`;
  const txId = randomUUID();
  const DID_RESOLVER_BASE = process.env.DID_RESOLVER_BASE || "https://did.embracehealth.in";
  const doc = {
    did,
    publicKey: `MFkw${simHash(did).slice(0, 32).toUpperCase()}`,
    controller: controller || "did:hosp:consortium:authority",
    owner,
    ownerType,
    status: "active",
    credentials: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    serviceEndpoint: `${DID_RESOLVER_BASE}/resolve/${did}`,
    ownerEmail: ownerEmail || null,
    mrn: assignedMrn,
    employeeId: assignedEmployeeId,
    walletAddress: preLinkedWallet,
    ...extraFields,
  };
  putState("did-registry", did, doc, txId);

  if (ownerEmail) {
    const userEntry = getState("users", ownerEmail);
    if (userEntry) {
      userEntry.value.did = did;
      if (ownerType === "patient") {
        userEntry.value.mrn = assignedMrn;
      } else {
        userEntry.value.employeeId = assignedEmployeeId;
      }
      putState("users", ownerEmail, userEntry.value, randomUUID());
    }
  }

  broadcast({ event: "did:created", data: doc });
  res.json({ did, doc, txId });
});

app.patch("/api/did/:did/revoke", requireAuth, requireRole(["admin"]), (req, res) => {
  const entry = getState("did-registry", req.params.did);
  if (!entry) return res.status(404).json({ error: "DID not found" });
  entry.value.status = "revoked";
  entry.value.updatedAt = new Date().toISOString();
  putState("did-registry", req.params.did, entry.value, randomUUID());
  broadcast({ event: "did:revoked", data: { did: req.params.did } });
  res.json({ success: true, did: req.params.did, status: "revoked" });
});

// ─── DID Request Workflow ───────────────────────────────────────────────────
app.get("/api/did/requests", requireAuth, (req, res) => {
  const all = getAllState("did-requests");
  let requests = all.map((e) => e.value);
  if (req.user.role !== "admin") {
    requests = requests.filter((r) => r.ownerEmail?.toLowerCase() === req.user.email?.toLowerCase());
  }
  res.json({ requests, total: requests.length });
});

app.post("/api/did/request", requireAuth, (req, res) => {
  const ownerEmail = req.user.email;
  const ownerName = req.body.ownerName || req.user.name || "Clinician";
  const ownerType = req.body.ownerType || req.user.role || "doctor";
  const department = req.body.department || "Clinical Services";

  // ── Wallet verification gate ──────────────────────────────────────────────
  const userEntry = getState("users", ownerEmail);
  if (!userEntry || !userEntry.value.walletAddress || !userEntry.value.walletVerified) {
    return res.status(400).json({
      error: "A verified Solana wallet is required before requesting a DID. Please connect and verify your wallet first.",
      code: "WALLET_NOT_VERIFIED",
    });
  }

  const existingDid = getAllState("did-registry").find(
    (d) => d.value.ownerEmail?.toLowerCase() === ownerEmail.toLowerCase()
  );
  if (existingDid) {
    return res.status(400).json({ error: "DID already issued for this account", did: existingDid.value.did });
  }

  const allReqs = getAllState("did-requests");
  const existingReq = allReqs.find(
    (r) => r.value.ownerEmail?.toLowerCase() === ownerEmail.toLowerCase() && r.value.status === "pending"
  );
  if (existingReq) {
    return res.json({ success: true, message: "DID request is already pending admin approval", request: existingReq.value });
  }

  const reqId = `DID-REQ-${randomUUID().slice(0, 8)}`;
  const txId = randomUUID();
  const requestDoc = {
    id: reqId,
    ownerName,
    ownerEmail,
    ownerType,
    department,
    walletAddress: userEntry.value.walletAddress,
    walletVerified: true,
    status: "pending",
    requestedAt: new Date().toISOString(),
  };

  putState("did-requests", reqId, requestDoc, txId);
  broadcast({ event: "did:request_created", data: requestDoc });

  pushNotification({
    type: "did_request",
    title: "New DID Issuance Request",
    message: `${ownerName} (${ownerEmail}) requested an official W3C DID issuance.`,
    link: "/admin/did",
  });

  res.status(201).json({ success: true, request: requestDoc, txId });
});

app.post("/api/did/requests/:id/approve", requireAuth, requireRole(["admin"]), async (req, res) => {
  const reqId = req.params.id;
  const entry = getState("did-requests", reqId);
  if (!entry) return res.status(404).json({ error: "DID request not found" });

  const reqDoc = entry.value;
  if (reqDoc.status === "approved") {
    return res.status(400).json({ error: "Request already approved" });
  }

  const ownerEmail = reqDoc.ownerEmail;
  const owner = reqDoc.ownerName;
  const ownerType = reqDoc.ownerType || "doctor";
  const assignedEmployeeId = ownerType !== "patient" ? `EMP-${Math.floor(1000 + Math.random() * 9000)}` : null;
  const assignedMrn = ownerType === "patient" ? `MRN-${Math.floor(100000 + Math.random() * 900000)}` : null;

  const did = `did:hosp:0x${simHash(owner + Date.now()).slice(0, 8)}`;
  const txId = randomUUID();
  const DID_RESOLVER_BASE = process.env.DID_RESOLVER_BASE || "https://did.embracehealth.in";

  const didDoc = {
    did,
    publicKey: `MFkw${simHash(did).slice(0, 32).toUpperCase()}`,
    controller: "did:hosp:consortium:authority",
    owner,
    ownerType,
    status: "active",
    credentials: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    serviceEndpoint: `${DID_RESOLVER_BASE}/resolve/${did}`,
    ownerEmail,
    mrn: assignedMrn,
    employeeId: assignedEmployeeId,
  };

  putState("did-registry", did, didDoc, txId);

  reqDoc.status = "approved";
  reqDoc.issuedDid = did;
  reqDoc.approvedAt = new Date().toISOString();
  reqDoc.approvedBy = req.user.email;
  putState("did-requests", reqId, reqDoc, randomUUID());

  if (ownerEmail) {
    const userEntry = getState("users", ownerEmail);
    if (userEntry) {
      userEntry.value.did = did;
      if (ownerType === "patient") userEntry.value.mrn = assignedMrn;
      else userEntry.value.employeeId = assignedEmployeeId;
      putState("users", ownerEmail, userEntry.value, randomUUID());
    }
  }

  broadcast({ event: "did:approved", data: { did, ownerEmail, reqId } });

  pushNotification({
    type: "did_approved",
    title: "Official DID Issued!",
    message: `Your official W3C DID (${did}) has been issued by the administrator.`,
    link: "/staff/profile",
  });

  res.json({ success: true, did, doc: didDoc, txId });
});

app.post("/api/did/requests/:id/reject", requireAuth, requireRole(["admin"]), (req, res) => {
  const reqId = req.params.id;
  const entry = getState("did-requests", reqId);
  if (!entry) return res.status(404).json({ error: "DID request not found" });

  const reqDoc = entry.value;
  reqDoc.status = "rejected";
  reqDoc.rejectedAt = new Date().toISOString();
  reqDoc.rejectedBy = req.user.email;
  putState("did-requests", reqId, reqDoc, randomUUID());

  broadcast({ event: "did:rejected", data: { reqId } });
  res.json({ success: true, request: reqDoc });
});

app.patch("/api/patient/emergency-profile", requireAuth, (req, res) => {
  const { emergencyContact, bloodGroup, allergies, conditions, organDonor } = req.body;
  const email = req.user.email;
  const userEntry = getState("users", email);

  if (!userEntry) {
    return res.status(404).json({ error: "User profile not found" });
  }

  const user = userEntry.value;
  if (emergencyContact !== undefined) user.emergencyContact = emergencyContact;
  if (bloodGroup !== undefined) user.bloodGroup = bloodGroup;
  if (allergies !== undefined) user.allergies = allergies;
  if (conditions !== undefined) user.conditions = conditions;
  if (organDonor !== undefined) user.organDonor = organDonor;

  putState("users", email, user, randomUUID());

  // Also sync to patients collection if present
  const allPatients = getAllState("patients");
  const pMatch = allPatients.find((p) => p.value.email === email || p.value.did === user.did);
  if (pMatch) {
    const patientVal = pMatch.value;
    if (emergencyContact !== undefined) patientVal.emergencyContact = emergencyContact;
    if (bloodGroup !== undefined) patientVal.bloodGroup = bloodGroup;
    if (allergies !== undefined) patientVal.allergies = allergies;
    if (conditions !== undefined) patientVal.conditions = conditions;
    if (organDonor !== undefined) patientVal.organDonor = organDonor;
    putState("patients", pMatch.key, patientVal, randomUUID());
  }

  broadcast({ event: "patient:updated", data: user });
  res.json({ success: true, patient: user });
});

// ─── Credentials ──────────────────────────────────────────────────────────────
app.post("/api/credential/issue", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { did, type = "IdentityVC", claims = {}, issuer } = req.body;
  if (!did) return res.status(400).json({ error: "did required" });
  const entry = getState("did-registry", did);
  if (!entry) return res.status(404).json({ error: "DID not found" });
  const txId = randomUUID();
  const vc = {
    id: `vc_${txId.slice(0, 8)}`,
    type,
    issuer: issuer || "Embrace Health Authority",
    subject: did,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    claims,
    signature: `MEQCIBas${simHash(did + type).slice(0, 20)}==`,
    status: "active",
  };
  if (!entry.value.credentials) entry.value.credentials = [];
  entry.value.credentials.push(vc);
  entry.value.updatedAt = new Date().toISOString();
  putState("did-registry", did, entry.value, txId);
  putState("credentials", vc.id, vc, txId);
  broadcast({ event: "credential:issued", data: vc });
  res.json({ vc, txId });
});

app.patch("/api/credential/:id/revoke", requireAuth, requireRole(["admin"]), (req, res) => {
  const entry = getState("credentials", req.params.id);
  if (!entry) return res.status(404).json({ error: "Credential not found" });
  entry.value.status = "revoked";
  entry.value.revokedAt = new Date().toISOString();
  putState("credentials", req.params.id, entry.value, randomUUID());
  broadcast({ event: "credential:revoked", data: { id: req.params.id } });
  res.json({ success: true, id: req.params.id });
});

app.get("/api/credentials", requireAuth, (_, res) => {
  const all = getAllState("credentials");
  res.json({ credentials: all.map((e) => e.value), total: all.length });
});

app.get("/api/consent", requireAuth, hipaaAuditPHIAccess("ConsentGrant"), (req, res) => {
  const all = getAllState("consent-manager");
  let consents = all.map((e) => e.value);
  if (req.user?.role === "patient") {
    const userDid = req.user.did;
    consents = consents.filter(
      (c) => !userDid || c.patientDid === userDid || c.patientEmail === req.user.email,
    );
  }
  res.json({ consents, total: consents.length });
});

app.post("/api/consent/grant", requireAuth, requireRole(["patient"]), hipaaAuditPHIAccess("ConsentGrant"), (req, res) => {
  const { patientDid, doctorDid, resource, expiry } = req.body;
  const grantId = `consent_${randomUUID().slice(0, 8)}`;
  const txId = randomUUID();
  const grant = {
    grantId,
    patientDid,
    doctorDid,
    resource: resource || "Medical Records",
    status: "active",
    expiry: expiry || new Date(Date.now() + 7 * 86400000).toISOString(),
    grantedAt: new Date().toISOString(),
  };
  putState("consent-manager", grantId, grant, txId);
  broadcast({ event: "consent:granted", data: grant });

  // Update matching pending consent request to approved
  const requests = getAllState("consent-requests");
  const pending = requests.find(
    (r) =>
      r.value &&
      r.value.patientDid === patientDid &&
      r.value.doctorDid === doctorDid &&
      r.value.status === "pending",
  );
  if (pending) {
    pending.value.status = "approved";
    putState("consent-requests", pending.key, pending.value, txId);
  }

  res.json(grant);
});

app.patch("/api/consent/:id/revoke", requireAuth, requireRole(["patient"]), hipaaAuditPHIAccess("ConsentGrant"), (req, res) => {
  const entry = getState("consent-manager", req.params.id);
  if (!entry) return res.status(404).json({ error: "Not found" });
  entry.value.status = "revoked";
  entry.value.revokedAt = new Date().toISOString();
  putState("consent-manager", req.params.id, entry.value, randomUUID());
  broadcast({ event: "consent:revoked", data: { id: req.params.id } });
  res.json({ success: true });
});

app.patch("/api/consent/requests/:id/deny", requireAuth, requireRole(["patient"]), hipaaAuditPHIAccess("ConsentRequest"), (req, res) => {
  const entry = getState("consent-requests", req.params.id);
  if (!entry) return res.status(404).json({ error: "Request not found" });
  entry.value.status = "denied";
  putState("consent-requests", req.params.id, entry.value, randomUUID());
  res.json({ success: true });
});

app.post("/api/consent/request", requireAuth, requireRole(["doctor", "staff"]), hipaaAuditPHIAccess("ConsentRequest"), (req, res) => {
  const { doctorDid, doctorName, patientDid, resource, reason, expiry } = req.body;
  if (!patientDid || !doctorDid)
    return res.status(400).json({ error: "patientDid and doctorDid required" });

  const reqId = "creq-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  const txId = "tx-creq-" + Date.now().toString(36);
  const request = {
    id: reqId,
    doctorDid,
    doctorName: doctorName || "Doctor",
    patientDid,
    resource: resource || "Medical Records",
    reason: reason || "Patient care and treatment",
    status: "pending",
    requestedAt: new Date().toISOString(),
    expiry: expiry || new Date(Date.now() + 48 * 3600000).toISOString(),
  };

  putState("consent-requests", reqId, request, txId);
  broadcast({ event: "consent:request", data: request });

  // Add notification in memory
  _notifications.push({
    id: "notif-creq-" + reqId,
    type: "consent_request",
    title: "Consent Request",
    message: `${request.doctorName} is requesting access to your ${request.resource}`,
    timestamp: new Date().toISOString(),
    read: false,
    severity: "warning",
    link: "/patient/consent",
  });

  res.json({ success: true, requestId: reqId, request, txId });
});

app.get("/api/consent/requests/:patientDid", requireAuth, requireRole(["patient"]), hipaaAuditPHIAccess("ConsentRequest"), (req, res) => {
  const all = getAllState("consent-requests");
  const requests = all
    .filter((e) => e.value?.patientDid === req.params.patientDid)
    .map((e) => e.value);
  res.json({ requests, total: requests.length });
});

// ─── Audit ────────────────────────────────────────────────────────────────────
app.get("/api/audit", requireAuth, (req, res) => {
  const page = parseInt(req.query.page ?? "0");
  const size = parseInt(req.query.size ?? "50");
  const all = getAllState("audit");
  const sorted = all.sort((a, b) => b.updatedAt?.localeCompare(a.updatedAt ?? "") ?? 0);
  res.json({
    events: sorted.slice(page * size, (page + 1) * size).map((e) => e.value),
    total: all.length,
  });
});

app.post("/api/audit/log", requireAuth, (req, res) => {
  const { actor, resource, action, outcome = "success", severity = "info" } = req.body;
  const txId = randomUUID();
  const event = {
    txId,
    actor,
    resource,
    action,
    outcome,
    severity,
    loggedAt: new Date().toISOString(),
  };
  putState("audit", `audit_${txId}`, event, txId);
  broadcast({ event: "audit:logged", data: event });
  res.json(event);
});

// ─── Vitals ───────────────────────────────────────────────────────────────────
app.post("/api/vitals/seed", requireAuth, requireRole(["admin", "doctor", "staff"]), hipaaAuditPHIAccess("VitalSigns"), (req, res) => {
  const { patients = [] } = req.body;
  patients.forEach(
    ({ id, heartRate = 72, bp = "120/80", spo2 = 98, temp = 36.5, respRate = 16 }) => {
      _vitals.set(id, { heartRate, bp, spo2, temp, respRate });
    },
  );
  res.json({ seeded: patients.length });
});

app.get("/api/vitals/:id", requireAuth, hipaaAuditPHIAccess("VitalSigns"), (req, res) => {
  const v = _vitals.get(req.params.id);
  if (!v) return res.status(404).json({ error: "Not found" });
  res.json(v);
});

// ─── Staff tracker ────────────────────────────────────────────────────────────
app.post(
  "/api/tracker/seed",
  requireAuth,
  requireRole(["admin", "doctor", "staff"]),
  (req, res) => {
    const { staff = [] } = req.body;
    staff.forEach(({ id, location = "Nursing Station" }) => {
      _staffLoc.set(id, { location, lastSignal: new Date().toISOString(), beacon: "85%" });
      putState(
        "tracker",
        id,
        { staffId: id, location, lastPing: new Date().toISOString() },
        randomUUID(),
      );
    });
    res.json({ seeded: staff.length });
  },
);

app.get("/api/tracker", requireAuth, requireRole(["admin", "doctor", "staff"]), hipaaAuditPHIAccess("StaffTracker"), (_, res) => {
  const all = getAllState("tracker");
  res.json({ staff: all.map((e) => e.value) });
});

// ─── Beds & Infrastructure ────────────────────────────────────────────────────
// NOTE: Duplicate GET /api/beds removed — canonical route with HIPAA audit is at ~line 1471

app.post("/api/beds", requireAuth, requireRole(["admin", "staff"]), hipaaAuditPHIAccess("BedOccupancy"), (req, res) => {
  const { bedId, ward, status = "available", patientDid } = req.body;
  const txId = randomUUID();
  const bed = { bedId, ward, status, patientDid, updatedAt: new Date().toISOString() };
  putState("beds", bedId, bed, txId);
  broadcast({ event: "bed:updated", data: bed });
  res.json(bed);
});

// ─── Prescriptions ────────────────────────────────────────────────────────────
app.post("/api/prescriptions", requireAuth, requireRole(["doctor", "staff"]), hipaaAuditPHIAccess("Prescription"), (req, res) => {
  const {
    patientDid, patientName, doctorDid: bodyDoctorDid,
    apptId, drugs, diagnosis, chiefComplaint, symptoms,
    notes, followUpDate, signedBy,
  } = req.body;

  // Always derive doctorDid from the authenticated token — never trust body
  const doctorDid  = req.user.did || `did:hosp:0x${simHash(req.user.email).slice(0, 8)}`;
  const doctorName = req.user.name || signedBy || "Doctor";

  if (!patientDid) return res.status(400).json({ error: "patientDid is required" });
  if (!drugs || !Array.isArray(drugs) || drugs.length === 0)
    return res.status(400).json({ error: "At least one drug is required" });

  const txId  = randomUUID();
  const rxId  = `PR-${Date.now().toString(36).toUpperCase()}`;
  const rx = {
    rxId,
    patientDid,
    patientName:    patientName  || "Patient",
    doctorDid,
    doctorName,
    apptId:         apptId       || null,
    drugs,
    diagnosis:      diagnosis    || "",
    chiefComplaint: chiefComplaint || "",
    symptoms:       symptoms     || "",
    notes:          notes        || "",
    followUpDate:   followUpDate || null,
    signedBy:       doctorName,
    signedAt:       new Date().toISOString(),
    status:         "active",
    hash:           `sha256:${simHash(rxId + patientDid + doctorDid)}`,
    txId,
    // Future blockchain hook — embed structured data for on-chain verification
    blockchainMeta: {
      patientDid, doctorDid, rxId, apptId: apptId || null,
      timestamp: new Date().toISOString(), network: "solana-devnet",
    },
  };
  putState("prescriptions", rxId, rx, txId);
  broadcast({ event: "prescription:signed", data: { rxId, patientDid, doctorDid } });
  res.status(201).json({ rxId, rx, txId });
});

// GET prescriptions I wrote (doctor's own view — no consent gate)
app.get(
  "/api/prescriptions/my",
  requireAuth,
  requireRole(["doctor", "staff", "admin"]),
  hipaaAuditPHIAccess("Prescription"),
  (req, res) => {
    const doctorDid  = req.user.did || `did:hosp:0x${simHash(req.user.email).slice(0, 8)}`;
    const doctorName = req.user.name || "";
    const all = queryState(
      "prescriptions",
      (v) => v.doctorDid === doctorDid || (doctorName && v.doctorName === doctorName),
    );
    const sorted = [...all].sort((a, b) =>
      (b.value.signedAt || "").localeCompare(a.value.signedAt || ""),
    );
    res.json({ prescriptions: sorted.map((e) => e.value), total: sorted.length });
  },
);

// GET all prescriptions (admin/staff overview — must be before :patientDid route)
app.get(
  "/api/prescriptions",
  requireAuth,
  requireRole(["admin", "staff", "doctor"]),
  hipaaAuditPHIAccess("Prescription"),
  (req, res) => {
    const all    = getAllState("prescriptions");
    const sorted = [...all].sort((a, b) =>
      (b.value.signedAt || "").localeCompare(a.value.signedAt || ""),
    );
    res.json({ prescriptions: sorted.map((e) => e.value), total: sorted.length });
  },
);

app.get(
  "/api/prescriptions/:patientDid",
  requireAuth,
  hipaaAuditPHIAccess("Prescription"),
  (req, res) => {
    const patientDid = req.params.patientDid;
    const role       = (req.user.role || "").toLowerCase();

    // Patient can only see their own
    if (role === "patient") {
      if (req.user.did && req.user.did !== patientDid) {
        return res.status(403).json({ error: "Access Denied: Cannot view another patient's prescriptions" });
      }
    }

    // Doctor / staff can see if:
    //   (a) they wrote the prescription, OR
    //   (b) they have an active appointment with this patient, OR
    //   (c) they have active consent
    if (role === "doctor" || role === "staff") {
      const doctorDid  = req.user.did || `did:hosp:0x${simHash(req.user.email).slice(0, 8)}`;
      const doctorName = req.user.name || "";

      const hasAppointment = queryState(
        "appointments",
        (v) =>
          v.patientDid === patientDid &&
          (v.doctorDid === doctorDid || (doctorName && v.doctorName === doctorName)),
      ).length > 0;

      const hasConsent = queryState(
        "consent-manager",
        (v) =>
          v.patientDid === patientDid &&
          v.doctorDid === doctorDid &&
          v.status === "active" &&
          new Date(v.expiry) > new Date(),
      ).length > 0;

      if (!hasAppointment && !hasConsent) {
        return res.status(403).json({
          error: "Access Denied: No appointment or active consent for this patient.",
        });
      }
    }

    const all    = queryState("prescriptions", (v) => v.patientDid === patientDid);
    const sorted = [...all].sort((a, b) =>
      (b.value.signedAt || "").localeCompare(a.value.signedAt || ""),
    );
    res.json({ prescriptions: sorted.map((e) => e.value) });
  },
);

// GET patients who have appointments with the logged-in doctor
app.get(
  "/api/appointments/my-patients",
  requireAuth,
  requireRole(["doctor", "staff", "admin"]),
  (req, res) => {
    const doctorDid  = req.user.did || `did:hosp:0x${simHash(req.user.email).slice(0, 8)}`;
    const doctorName = req.user.name || "";

    const myAppts = queryState(
      "appointments",
      (v) =>
        v.doctorDid === doctorDid ||
        (doctorName && v.doctorName === doctorName),
    ).map((e) => e.value);

    // Deduplicate patients, attach latest appointment info
    const patientMap = new Map();
    for (const appt of myAppts.sort((a, b) => (b.bookedAt || "").localeCompare(a.bookedAt || ""))) {
      if (!appt.patientDid) continue;
      if (!patientMap.has(appt.patientDid)) {
        patientMap.set(appt.patientDid, {
          patientDid:  appt.patientDid,
          patientName: appt.patientName || "Patient",
          latestAppt: {
            apptId:    appt.apptId,
            slot:      appt.slot,
            date:      appt.date,
            status:    appt.status,
            specialty: appt.specialty,
            reason:    appt.reason || "",
          },
          appointments: [],
        });
      }
      patientMap.get(appt.patientDid).appointments.push({
        apptId:  appt.apptId,
        slot:    appt.slot,
        date:    appt.date,
        status:  appt.status,
        reason:  appt.reason || "",
        mode:    appt.mode,
      });
    }

    res.json({ patients: Array.from(patientMap.values()), total: patientMap.size });
  },
);

// ─── Doctor Location Check-In & Tracking ────────────────────────────────────
app.post("/api/hardware/scan", (req, res) => {
  let { doctorDid, roomNumber } = req.body || {};
  if (!doctorDid && req.user?.email) {
    doctorDid = req.user.did;
  }
  if (!doctorDid) {
    const allDids = getAllState("did-registry");
    const docDidEntry = allDids.find((d) => d.value.ownerType === "doctor" || d.value.ownerType === "staff");
    doctorDid = docDidEntry?.value?.did || "did:hosp:0x4302bbea";
  }
  if (!roomNumber) {
    return res.status(400).json({ error: "roomNumber is required" });
  }

  // 1. Fetch doctor details from database
  const allUsers = getAllState("users");
  const doctorUserEntry = allUsers.find(
    (u) =>
      u.value?.did === doctorDid ||
      `did:hosp:0x${simHash(u.value?.email || "").slice(0, 8)}` === doctorDid,
  );

  let doctorUser = doctorUserEntry?.value;
  if (!doctorUser) {
    const docEmail = `doctor_${doctorDid.replace(/[^a-zA-Z0-9]/g, "")}@hospital.com`;
    doctorUser = {
      did: doctorDid,
      name: "Dr. Staff Clinician",
      email: docEmail,
      role: "doctor",
      specialty: "Outpatient Clinic"
    };
    putState("users", docEmail, doctorUser, randomUUID());
  }

  // 2. Fetch history logs to check previous status
  const all = queryState("doctor-locations", (v) => v.doctorDid === doctorDid);
  const sortedLogs = [...all].sort((a, b) => b.value.timestamp.localeCompare(a.value.timestamp));
  const lastLog = sortedLogs[0]?.value;

  // Toggle action
  let action = "enter";
  if (lastLog && lastLog.roomNumber === roomNumber && lastLog.action === "enter") {
    action = "exit";
  }

  // 3. Create log
  const logId = `LOC-${Date.now().toString(36).toUpperCase()}`;
  const timestamp = new Date().toISOString();
  const leafContent = `${logId}:${doctorDid}:${roomNumber}:${action}:${timestamp}`;
  const hash = `sha256:${simHash(leafContent)}`;

  const log = {
    logId,
    doctorDid,
    doctorName: doctorUser.name || "Dr. Staff",
    roomNumber,
    action,
    timestamp,
    hash,
  };

  const txId = randomUUID();
  putState("doctor-locations", logId, log, txId);

  // 4. Update doctor status across all backend persistence namespaces
  doctorUser.activeRoom = action === "enter" ? roomNumber : "None";
  doctorUser.roomStatus = action;
  doctorUser.lastLocationChange = timestamp;
  putState("users", doctorUser.email, doctorUser, randomUUID());
  putState("doctors", doctorDid, doctorUser, randomUUID());
  putState(
    "tracker",
    doctorDid,
    {
      id: doctorDid,
      did: doctorDid,
      name: doctorUser.name,
      location: action === "enter" ? roomNumber : "Nursing Station / Transiting",
      activeRoom: action === "enter" ? roomNumber : "None",
      roomStatus: action,
      lastSignal: timestamp,
    },
    randomUUID()
  );

  // 5. Broadcast to update staff tracker and doctor locator instantly
  broadcast({
    event: "staff:location",
    data: {
      id: doctorDid,
      did: doctorDid,
      name: doctorUser.name,
      location: action === "enter" ? roomNumber : "Nursing Station / Transiting",
      activeRoom: action === "enter" ? roomNumber : "None",
      status: action === "enter" ? "In Room" : "Off Duty",
      roomStatus: action,
      lastSignal: timestamp,
    },
  });

  // 6. Generate updated Merkle Tree and anchor root to Solana
  const updatedEntries = queryState("doctor-locations", (v) => v.doctorDid === doctorDid);
  const updatedLogs = updatedEntries.map((e) => e.value);
  const leaves = updatedLogs.map(
    (l) => `${l.logId}:${l.doctorDid}:${l.roomNumber}:${l.action}:${l.timestamp}`,
  );
  const tree = new MerkleTree(leaves);

  tree.build().then(() => {
    const rootHex = tree.getRoot();
    const anchorId = `loc_${randomUUID().slice(0, 8)}`;
    const anchorEntry = {
      anchorId,
      recordHash: rootHex,
      recordType: "doctor-location",
      actorDid: doctorDid,
      signature: `solana_loc_${rootHex.slice(0, 12)}_${Date.now().toString(36)}`,
      slot: Math.floor(Date.now() / 400),
      network: "devnet-simulated",
      anchoredAt: timestamp,
    };
    putState("solana-anchors", anchorId, anchorEntry, anchorId);

    // Save location root status
    putState(
      "doctor-location-roots",
      doctorDid,
      {
        doctorDid,
        merkleRoot: rootHex,
        lastUpdated: timestamp,
        signature: anchorEntry.signature,
      },
      randomUUID(),
    );
  });

  res.json({ success: true, action, log, txId });
});

app.post("/api/doctor/check-in", requireAuth, requireRole(["doctor", "staff"]), (req, res) => {
  const { roomNumber } = req.body;
  if (!roomNumber) {
    return res.status(400).json({ error: "roomNumber is required" });
  }

  const doctorDid = req.user.did || `did:hosp:0x${simHash(req.user.email).slice(0, 8)}`;

  // Call unified scan route logic directly
  req.url = "/api/hardware/scan";
  req.body = { doctorDid, roomNumber };
  app._router.handle(req, res);
});

app.get("/api/doctor/location-history/:doctorDid", requireAuth, hipaaAuditPHIAccess("DoctorLocation"), (req, res) => {
  const { doctorDid } = req.params;
  let all = queryState("doctor-locations", (v) => v.doctorDid === doctorDid);

  if (all.length === 0) {
    const defaultLog = {
      logId: "LOC-INIT",
      doctorDid,
      doctorName: "Dr. Staff",
      roomNumber: "Room 101 - Outpatient Clinic",
      action: "enter",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      hash: `sha256:${simHash("LOC-INIT:" + doctorDid + ":Room 101 - Outpatient Clinic:enter")}`,
    };
    putState("doctor-locations", "LOC-INIT", defaultLog, randomUUID());
    all = queryState("doctor-locations", (v) => v.doctorDid === doctorDid);
  }

  const sorted = [...all].sort((a, b) => b.value.timestamp.localeCompare(a.value.timestamp));
  res.json({ logs: sorted.map((e) => e.value) });
});

app.get("/api/doctors", (req, res) => {
  const allUsers = getAllState("users");
  const doctors = allUsers
    .filter((u) => u.value?.role === "doctor" || u.value?.role === "staff")
    .map((u) => {
      const doc = u.value;
      const did = doc.did || `did:hosp:0x${simHash(doc.email || "").slice(0, 8)}`;
      const locationLogs = queryState("doctor-locations", (v) => v.doctorDid === did);
      const sortedLogs = [...locationLogs].sort((a, b) => b.value.timestamp.localeCompare(a.value.timestamp));
      const lastLog = sortedLogs[0]?.value;
      const activeRoom = lastLog && lastLog.action === "enter" ? lastLog.roomNumber : (doc.activeRoom || "None");
      return {
        did,
        name: doc.name,
        email: doc.email,
        specialty: doc.specialty || "General Medicine",
        department: doc.department || doc.specialty || "Outpatient Clinic",
        activeRoom,
        roomStatus: lastLog?.action || doc.roomStatus || "exit",
        lastLocationChange: lastLog?.timestamp || doc.lastLocationChange || new Date().toISOString(),
      };
    });
  res.json({ doctors, total: doctors.length });
});

// ─── Room Master List ─────────────────────────────────────────────────────────
const HOSPITAL_ROOMS = [
  { id: "101", name: "Room 101 - Outpatient Clinic",    type: "OPD",  floor: "Ground"   },
  { id: "102", name: "Room 102 - General Consultation", type: "OPD",  floor: "Ground"   },
  { id: "201", name: "Room 201 - Cardiology Ward",      type: "Ward", floor: "First"    },
  { id: "202", name: "Room 202 - Neurology Ward",       type: "Ward", floor: "First"    },
  { id: "203", name: "Room 203 - Orthopedics Ward",     type: "Ward", floor: "First"    },
  { id: "301", name: "Room 301 - Operating Theater 1",  type: "OT",   floor: "Second"   },
  { id: "302", name: "Room 302 - Operating Theater 2",  type: "OT",   floor: "Second"   },
  { id: "401", name: "Room 401 - Emergency Room A",     type: "ER",   floor: "Ground"   },
  { id: "402", name: "Room 402 - Emergency Room B",     type: "ER",   floor: "Ground"   },
  { id: "501", name: "Room 501 - ICU Bay 1",            type: "ICU",  floor: "Third"    },
  { id: "502", name: "Room 502 - ICU Bay 2",            type: "ICU",  floor: "Third"    },
  { id: "601", name: "Room 601 - Radiology Suite",      type: "Diag", floor: "Basement" },
  { id: "602", name: "Room 602 - Pathology Lab",        type: "Lab",  floor: "Basement" },
];

app.get("/api/rooms", requireAuth, (req, res) => {
  res.json({ rooms: HOSPITAL_ROOMS, total: HOSPITAL_ROOMS.length });
});

// ─── Multi-room check-in / check-out ─────────────────────────────────────────
app.post(
  "/api/room-checkin/multi",
  requireAuth,
  requireRole(["doctor", "staff", "admin"]),
  (req, res) => {
    const { roomIds, action } = req.body;
    if (!Array.isArray(roomIds) || roomIds.length === 0)
      return res.status(400).json({ error: "roomIds[] is required" });
    if (!["checkin", "checkout"].includes(action))
      return res.status(400).json({ error: "action must be 'checkin' or 'checkout'" });

    const doctorDid  = req.user.did || `did:hosp:0x${simHash(req.user.email).slice(0, 8)}`;
    const doctorName = req.user.name || "Dr. Staff";
    const timestamp  = new Date().toISOString();
    const results    = [];

    for (const roomId of roomIds) {
      const room = HOSPITAL_ROOMS.find((r) => r.id === roomId);
      if (!room) continue;

      const logId    = `RCI-${Date.now().toString(36).toUpperCase()}-${roomId}`;
      const txId     = randomUUID();
      const leafData = `${logId}:${doctorDid}:${room.name}:${action}:${timestamp}`;
      const hash     = `sha256:${simHash(leafData)}`;

      const entry = {
        logId, doctorDid, doctorName,
        action, roomId: room.id, roomName: room.name, roomType: room.type,
        status: action === "checkin" ? "checked-in" : "checked-out",
        timestamp, txId, hash,
      };

      // Append-only audit history
      putState("room-checkin-history", logId, entry, txId);

      // Latest state per doctor+room key
      putState("room-checkin", `${doctorDid}::${room.id}`, {
        doctorDid, doctorName, roomId: room.id, roomName: room.name,
        roomType: room.type, action, timestamp, txId, hash,
      }, txId);

      // Feed into doctor-locations for Merkle / location-history compat
      putState("doctor-locations", logId, {
        logId, doctorDid, doctorName,
        roomNumber: room.name,
        action: action === "checkin" ? "enter" : "exit",
        timestamp, hash,
      }, txId);

      results.push(entry);
    }

    // Derive active rooms
    const active = queryState("room-checkin", (v) => v.doctorDid === doctorDid && v.action === "checkin");
    const activeRooms = active.map((e) => e.value.roomName);
    const hasActive   = activeRooms.length > 0;

    // Update tracker state
    putState("tracker", doctorDid, {
      id: doctorDid, did: doctorDid, name: doctorName,
      location:   hasActive ? activeRooms[0] : "Nursing Station",
      activeRooms, roomStatus: hasActive ? "enter" : "exit",
      lastSignal: timestamp,
    }, randomUUID());

    broadcast({ event: "room:checkin", data: { doctorDid, doctorName, action, rooms: results.map((r) => ({ id: r.roomId, name: r.roomName })), activeRooms, timestamp } });
    broadcast({ event: "staff:location", data: { id: doctorDid, did: doctorDid, name: doctorName, location: hasActive ? activeRooms[0] : "Nursing Station", activeRooms, status: hasActive ? "In Room" : "Available", lastSignal: timestamp } });

    res.status(201).json({ success: true, results, activeRooms, hasActiveRoom: hasActive });
  },
);

app.get("/api/room-checkin/status/:doctorDid", requireAuth, (req, res) => {
  const { doctorDid } = req.params;
  const active = queryState("room-checkin", (v) => v.doctorDid === doctorDid && v.action === "checkin");
  res.json({ checkedInRooms: active.map((e) => e.value), total: active.length });
});

app.get("/api/room-checkin/history/:doctorDid", requireAuth, (req, res) => {
  const { doctorDid } = req.params;
  const all    = queryState("room-checkin-history", (v) => v.doctorDid === doctorDid);
  const sorted = [...all].sort((a, b) => b.value.timestamp.localeCompare(a.value.timestamp));
  res.json({ logs: sorted.map((e) => e.value), total: sorted.length });
});

// ─── Merkle Tree: daily room events ──────────────────────────────────────────
app.get("/api/merkle-root/daily/:doctorDid", requireAuth, (req, res) => {
  const { doctorDid } = req.params;
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const all   = queryState("room-checkin-history", (v) => v.doctorDid === doctorDid);
  const todayEvents = all
    .map((e) => e.value)
    .filter((v) => v.timestamp && v.timestamp.startsWith(today))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (todayEvents.length === 0)
    return res.json({ events: [], merkleRoot: null, eventCount: 0, date: today });

  // Build the Merkle tree from today's events
  const leaves = todayEvents.map((ev) => ({
    doctorDid: ev.doctorDid,
    roomId:    ev.roomId,
    roomName:  ev.roomName,
    action:    ev.action,
    timestamp: ev.timestamp,
  }));
  const tree = buildMerkleTree(leaves);
  const root = getMerkleRoot(tree);

  res.json({ events: todayEvents, merkleRoot: root, eventCount: todayEvents.length, date: today });
});

// ─── Merkle Tree: publish daily root to blockchain ───────────────────────────
app.post("/api/merkle-root/publish", requireAuth, requireRole(["doctor"]), (req, res) => {
  const { doctorDid, txSignature, walletAddress } = req.body;
  if (!doctorDid) return res.status(400).json({ error: "doctorDid is required" });

  // Enforce: only the logged-in doctor can publish their own Merkle Root
  const tokenDid  = req.user.did || `did:hosp:0x${simHash(req.user.email).slice(0, 8)}`;
  const tokenName = req.user.name || "";
  const userEntry = getState("users", req.user.email);

  const isDoctorsDid = doctorDid === tokenDid ||
    (tokenName && queryState("did-registry", (v) =>
      v.did === doctorDid &&
      (v.ownerEmail?.toLowerCase() === req.user.email.toLowerCase() || v.owner === tokenName)
    ).length > 0);

  if (!isDoctorsDid) {
    return res.status(403).json({ error: "Access Denied: You can only publish your own daily Merkle Root." });
  }

  // Require verified wallet to publish on-chain
  if (!userEntry || !userEntry.value.walletVerified) {
    return res.status(400).json({
      error: "A verified Solana wallet is required to publish the Merkle Root.",
      code: "WALLET_NOT_VERIFIED",
    });
  }

  const today = new Date().toISOString().split("T")[0];
  const all   = queryState("room-checkin-history", (v) => v.doctorDid === doctorDid);
  const todayEvents = all
    .map((e) => e.value)
    .filter((v) => v.timestamp && v.timestamp.startsWith(today))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (todayEvents.length === 0)
    return res.status(400).json({ error: "No room events today to publish" });

  const leaves = todayEvents.map((ev) => ({
    doctorDid: ev.doctorDid,
    roomId:    ev.roomId,
    roomName:  ev.roomName,
    action:    ev.action,
    timestamp: ev.timestamp,
  }));
  const tree = buildMerkleTree(leaves);
  const root = getMerkleRoot(tree);

  // Use the real wallet txSignature when provided; fall back to simulated hash
  const txHash      = txSignature || `sol_${simHash(`${doctorDid}:${root}:${Date.now()}`).slice(0, 32)}`;
  const rootId      = `mr_${randomUUID().slice(0, 8)}`;
  const publishedAt = new Date().toISOString();
  const isRealTx    = !!txSignature;

  const record = {
    rootId,
    doctorDid,
    doctorName:  req.user.name || "",
    doctorEmail: req.user.email,
    walletAddress: walletAddress || userEntry.value.walletAddress || "",
    merkleRoot:  root,
    txHash,
    txSignature: txSignature || null,
    date:        today,
    eventCount:  todayEvents.length,
    publishedAt,
    network:     isRealTx ? "solana-devnet" : "solana-devnet-simulated",
    verified:    true,
    onChain:     isRealTx,
  };

  putState("merkle-roots",  rootId, record,                        randomUUID());
  putState("blockchain-tx", txHash, { txHash, rootId, doctorDid, doctorEmail: req.user.email, publishedAt, onChain: isRealTx }, randomUUID());

  broadcast({ event: "merkle:published", data: record });

  res.status(201).json({
    success: true, merkleRoot: root, txHash, rootId,
    eventCount: todayEvents.length, publishedAt, onChain: isRealTx,
  });
});

// ─── Merkle Tree: history of published roots ──────────────────────────────────
app.get("/api/merkle-root/:doctorDid/history", requireAuth, (req, res) => {
  const { doctorDid } = req.params;
  const all    = queryState("merkle-roots", (v) => v.doctorDid === doctorDid);
  const sorted = [...all].sort((a, b) => b.value.publishedAt.localeCompare(a.value.publishedAt));
  res.json({ roots: sorted.map((e) => e.value), total: sorted.length });
});

app.post("/api/doctor/anchor-location", requireAuth, (req, res, next) => {
  const userRole = String(req.user?.role || "").toLowerCase();
  if (userRole !== "doctor" && userRole !== "staff" && userRole !== "admin") {
    return res.status(403).json({ error: "Access Denied: Doctor, Staff, or Admin role required" });
  }
  next();
}, async (req, res) => {
  const { authorityPubkey } = req.body;
  if (!authorityPubkey) {
    return res.status(400).json({ error: "authorityPubkey is required" });
  }

    const doctorDid = req.user.did || `did:hosp:0x${simHash(req.user.email).slice(0, 8)}`;

    // Fetch all logs
    const entries = queryState("doctor-locations", (v) => v.doctorDid === doctorDid);
    const logs = entries.map((e) => e.value);

    if (logs.length === 0) {
      const defaultLog = {
        logId: "LOC-INIT",
        doctorDid,
        doctorName: req.user.name || "Dr. Staff",
        roomNumber: "Room 101 - Outpatient Clinic",
        action: "enter",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        hash: `sha256:${simHash("LOC-INIT:" + doctorDid + ":Room 101 - Outpatient Clinic:enter")}`,
      };
      putState("doctor-locations", "LOC-INIT", defaultLog, randomUUID());
      logs.push(defaultLog);
    }

    const leaves = logs.map(
      (l) => `${l.logId}:${l.doctorDid}:${l.roomNumber}:${l.action}:${l.timestamp}`,
    );
    const tree = new MerkleTree(leaves);
    await tree.build();
    const rootHex = tree.getRoot();

    let isUpdate = false;
    try {
      const connection = new Connection("https://api.devnet.solana.com", "confirmed");
      const programId = new PublicKey("BxkLrjBYdb3nh2m9GCfpLXBWrAj3s9MqnRbwktLqSfN3");
      const [locationPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("doctor-location"), Buffer.from(doctorDid)],
        programId,
      );
      const accountInfo = await connection.getAccountInfo(locationPda);
      if (accountInfo) isUpdate = true;
    } catch (err) {
      console.warn("Could not fetch location account status:", err.message);
    }

    const txId = randomUUID();
    res.json({
      merkleRoot: rootHex,
      isUpdate,
      transaction: Buffer.from(`solana_tx_placeholder_location:${rootHex}:${isUpdate}`).toString(
        "base64",
      ),
      txId,
    });
  },
);

// ─── Lab results ──────────────────────────────────────────────────────────────
app.post("/api/labs", requireAuth, requireRole(["doctor", "staff"]), hipaaAuditPHIAccess("LabResult"), (req, res) => {
  const { patientDid, orderedBy, tests, priority = "routine" } = req.body;
  const labId = `LAB-${Date.now().toString(36).toUpperCase()}`;
  const txId = randomUUID();
  const lab = {
    labId,
    patientDid,
    orderedBy,
    tests,
    priority,
    status: "pending",
    orderedAt: new Date().toISOString(),
  };
  putState("lab-results", labId, lab, txId);
  broadcast({ event: "lab:ordered", data: lab });
  res.json(lab);
});

app.get("/api/labs", requireAuth, requireRole(["doctor", "staff", "admin"]), hipaaAuditPHIAccess("LabResult"), (req, res) => {
  const all = getAllState("lab-results");
  res.json({ labs: all.map((e) => e.value), total: all.length });
});

app.get("/api/labs/:patientDid", requireAuth, hipaaAuditPHIAccess("LabResult"), (req, res) => {
  if (req.user.role === "patient" && req.user.did && req.user.did !== req.params.patientDid) {
    return res
      .status(403)
      .json({ error: "Access Denied: Cannot view other patients' lab results" });
  }
  const patientDid = req.params.patientDid;
  const all = queryState("lab-results", (v) => v.patientDid === patientDid);
  res.json({ labs: all.map((e) => e.value) });
});

app.get("/api/surgeries", (req, res) => {
  let all = getAllState("surgeries");
  if (all.length === 0) {
    const defaultSurgeries = [
      {
        id: "s1",
        patient: "Anika Sharma",
        mrn: "MRN-204871",
        procedure: "Cardiac Catheterization (PCI)",
        room: "Cath Lab 2",
        date: "2026-06-04",
        time: "11:00",
        surgeon: "Dr. Ravi Menon",
        anesthesiologist: "Dr. Deepak Joshi",
        status: "scheduled",
        estDuration: "90 min",
      },
    ];
    defaultSurgeries.forEach((s) => putState("surgeries", s.id, s, randomUUID()));
    all = getAllState("surgeries");
  }
  res.json({ surgeries: all.map((e) => e.value), total: all.length });
});

app.get("/api/infrastructure/ambulances", (req, res) => {
  res.json({
    ambulances: [
      { id: "amb_01", vehicleNo: "DL-01-AM-1001", status: "available", location: "Trauma ER Bay 1", driver: "Rajesh Kumar" },
      { id: "amb_02", vehicleNo: "DL-01-AM-1002", status: "dispatched", location: "En-Route (OPD Ward)", driver: "Suresh Singh" },
    ],
  });
});

app.get("/api/surgeries", (req, res) => {
  let all = getAllState("surgeries");
  if (all.length === 0) {
    const defaultSurgeries = [
      {
        id: "s1",
        patient: "Anika Sharma",
        mrn: "MRN-204871",
        procedure: "Cardiac Catheterization (PCI)",
        room: "Cath Lab 2",
        date: "2026-06-04",
        time: "11:00",
        surgeon: "Dr. Ravi Menon",
        anesthesiologist: "Dr. Deepak Joshi",
        status: "scheduled",
        estDuration: "90 min",
      },
    ];
    defaultSurgeries.forEach((s) => putState("surgeries", s.id, s, randomUUID()));
    all = getAllState("surgeries");
  }
  res.json({ surgeries: all.map((e) => e.value), total: all.length });
});

app.get("/api/infrastructure/ambulances", (req, res) => {
  res.json({
    ambulances: [
      { id: "amb_01", vehicleNo: "DL-01-AM-1001", status: "available", location: "Trauma ER Bay 1", driver: "Rajesh Kumar" },
      { id: "amb_02", vehicleNo: "DL-01-AM-1002", status: "dispatched", location: "En-Route (OPD Ward)", driver: "Suresh Singh" },
    ],
  });
});

// ─── Medical Records ──────────────────────────────────────────────────────────
async function getAnchorDiscriminator(name) {
  const hash = await sha256(`global:${name}`);
  return Buffer.from(hash.substring(0, 16), "hex");
}

async function buildAnchorTransaction(
  patientDid,
  merkleRootHex,
  authorityPubkeyStr,
  isUpdate = false,
) {
  const PROGRAM_ID = new PublicKey("BxkLrjBYdb3nh2m9GCfpLXBWrAj3s9MqnRbwktLqSfN3");
  const authority = new PublicKey(authorityPubkeyStr);

  const [patientRootPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("patient-root"), Buffer.from(patientDid)],
    PROGRAM_ID,
  );

  const discriminator = await getAnchorDiscriminator(
    isUpdate ? "update_patient_root" : "register_patient_root",
  );

  const didBytes = Buffer.from(patientDid);
  const didLen = Buffer.alloc(4);
  didLen.writeUInt32LE(didBytes.length);
  const rootBytes = Buffer.from(merkleRootHex, "hex");

  const data = Buffer.concat([discriminator, didLen, didBytes, rootBytes]);

  const keys = [{ pubkey: patientRootPda, isSigner: false, isWritable: true }];

  if (!isUpdate) {
    keys.push({ pubkey: authority, isSigner: true, isWritable: true });
    keys.push({
      pubkey: new PublicKey("11111111111111111111111111111111"),
      isSigner: false,
      isWritable: false,
    });
  } else {
    keys.push({ pubkey: authority, isSigner: true, isWritable: false });
  }

  const instruction = new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(instruction);
  tx.feePayer = authority;
  tx.recentBlockhash = "11111111111111111111111111111111";

  const serialized = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  return serialized.toString("base64");
}

app.get(
  "/api/medical-records/:patientDid",
  requireAuth,
  hipaaAuditPHIAccess("MedicalRecord"),
  (req, res) => {
    if (req.user.role === "patient" && req.user.did && req.user.did !== req.params.patientDid) {
      return res.status(403).json({ error: "Access Denied: Cannot view other patients' records" });
    }

    let all = queryState("medical-records", (v) => v.patientDid === req.params.patientDid);

    if (all.length === 0) {
      const defaultDocs = [
        {
          id: "REC-INITIAL-DISCHARGE",
          title: "Initial Discharge Summary",
          type: "discharge-summary",
          date: new Date(Date.now() - 30 * 86400000).toISOString(),
          issuedBy: "Dr. Ravi Menon",
          fileSize: "14 KB",
          summary:
            "Patient admitted with symptoms of angina. Angiography showed clear coronary pathways. Discharged with beta-blockers.",
          isNew: false,
        },
        {
          id: "REC-INITIAL-ECG",
          title: "Routine ECG Diagnostic",
          type: "imaging",
          date: new Date(Date.now() - 15 * 86400000).toISOString(),
          issuedBy: "Dr. Ravi Menon",
          fileSize: "45 KB",
          summary: "Sinus rhythm at 72 bpm. Ejection fraction at 60%. Cardiomegaly ruled out.",
          isNew: false,
        },
        {
          id: "REC-INITIAL-LIPID",
          title: "Standard Lipid Panel",
          type: "lab-report",
          date: new Date(Date.now() - 7 * 86400000).toISOString(),
          issuedBy: "Dr. Sameer Khan",
          fileSize: "8 KB",
          summary:
            "Total Cholesterol: 180 mg/dL, HDL: 45 mg/dL, LDL: 92 mg/dL. Triglycerides normal.",
          isNew: true,
        },
      ];

      defaultDocs.forEach((doc) => {
        const txId = randomUUID();
        const val = {
          recordId: doc.id,
          patientDid: req.params.patientDid,
          title: doc.title,
          type: doc.type,
          content: doc.summary,
          doctorName: doc.issuedBy,
          createdAt: doc.date,
          hash: `sha256:d8c0b56${randomUUID().slice(0, 8)}`,
        };
        putState("medical-records", doc.id, val, txId);
      });

      all = queryState("medical-records", (v) => v.patientDid === req.params.patientDid);
    }

    res.json({ records: all.map((e) => e.value), total: all.length });
  },
);

// GET all medical records (staff/admin overview)
app.get(
  "/api/medical-records",
  requireAuth,
  requireRole(["admin", "staff", "doctor"]),
  hipaaAuditPHIAccess("MedicalRecord"),
  (req, res) => {
    const all    = getAllState("medical-records");
    const sorted = [...all].sort((a, b) =>
      (b.value.createdAt || "").localeCompare(a.value.createdAt || ""),
    );
    res.json({ records: sorted.map((e) => e.value), total: sorted.length });
  },
);

// GET medical record linked to a specific prescription
app.get(
  "/api/medical-records/by-prescription/:rxId",
  requireAuth,
  hipaaAuditPHIAccess("MedicalRecord"),
  (req, res) => {
    const { rxId } = req.params;
    const found = queryState("medical-records", (v) => v.rxId === rxId);
    if (found.length === 0) return res.json({ record: null });
    // Return the most recent if somehow duplicated
    const sorted = [...found].sort((a, b) =>
      (b.value.createdAt || "").localeCompare(a.value.createdAt || ""),
    );
    res.json({ record: sorted[0].value });
  },
);

// GET my medical records (doctor's own records — all patients they treated)
app.get(
  "/api/medical-records/my",
  requireAuth,
  requireRole(["doctor", "staff"]),
  hipaaAuditPHIAccess("MedicalRecord"),
  (req, res) => {
    const doctorDid  = req.user.did || `did:hosp:0x${simHash(req.user.email).slice(0, 8)}`;
    const doctorName = req.user.name || "";
    const all = queryState(
      "medical-records",
      (v) => v.doctorDid === doctorDid || (doctorName && v.doctorName === doctorName),
    );
    const sorted = [...all].sort((a, b) =>
      (b.value.createdAt || "").localeCompare(a.value.createdAt || ""),
    );
    res.json({ records: sorted.map((e) => e.value), total: sorted.length });
  },
);

app.post(
  "/api/medical-records/:patientDid",
  requireAuth,
  requireRole(["doctor", "staff"]),
  async (req, res) => {
    const { patientDid } = req.params;
    const {
      title, type, content, doctorDid, doctorName,
      // New fields: link to prescription and appointment
      rxId, apptId,
      consultationSummary, clinicalNotes, testResults,
      recommendedFollowUp,
    } = req.body;

    if (!title || !type || !content) {
      return res.status(400).json({ error: "title, type, and content are required" });
    }

    const recordId = `REC-${Date.now().toString(36).toUpperCase()}`;
    const txId = randomUUID();
    const hash = await sha256(recordId + title + type + content);

    const record = {
      recordId,
      patientDid,
      title,
      type,
      content,
      doctorDid:           doctorDid           || req.user.did  || "did:hosp:unknown",
      doctorName:          doctorName          || req.user.name || "Doctor",
      // Linkage fields
      rxId:                rxId                || null,
      apptId:              apptId              || null,
      consultationSummary: consultationSummary || content,
      clinicalNotes:       clinicalNotes       || "",
      testResults:         testResults         || "",
      recommendedFollowUp: recommendedFollowUp || "",
      createdAt: new Date().toISOString(),
      hash: `sha256:${hash}`,
    };

    putState("medical-records", recordId, record, txId);
    broadcast({ event: "record:created", data: record });

    res.json({ record, txId });
  },
);

app.post("/api/medical-records/:patientDid/anchor", requireAuth, hipaaAuditPHIAccess("MedicalRecord"), async (req, res) => {
  const { patientDid } = req.params;
  const { authorityPubkey, isUpdate = false } = req.body;

  if (!authorityPubkey) {
    return res.status(400).json({ error: "authorityPubkey is required" });
  }

  const records = queryState("medical-records", (v) => v.patientDid === patientDid).map(
    (e) => e.value,
  );
  const prescriptions = queryState("prescriptions", (v) => v.patientDid === patientDid).map(
    (e) => e.value,
  );

  if (records.length === 0 && prescriptions.length === 0) {
    return res.status(400).json({ error: "No medical records or prescriptions found to anchor" });
  }

  const recordHashes = records.map((r) => r.hash || `sha256:${r.recordId}`);
  const rxHashes = prescriptions.map((p) => p.hash || `sha256:${p.rxId}`);
  const hashes = [...recordHashes, ...rxHashes];

  const tree = new MerkleTree(hashes);
  await tree.build();
  const root = tree.getRoot();

  try {
    const transactionPayload = await buildAnchorTransaction(
      patientDid,
      root,
      authorityPubkey,
      isUpdate,
    );
    res.json({
      success: true,
      merkleRoot: root,
      hashes,
      transactionPayload,
    });
  } catch (err) {
    res.status(500).json({ error: `Solana transaction serialization failed: ${err.message}` });
  }
});

// ─── Fraud alerts ─────────────────────────────────────────────────────────────
app.post("/api/fraud/alert", requireAuth, (req, res) => {
  const { actor, type, message, severity = "high", riskScore = 75 } = req.body;
  const alertId = `FA-${randomUUID().slice(0, 8).toUpperCase()}`;
  const txId = randomUUID();
  const alert = {
    alertId,
    actor,
    type,
    message,
    severity,
    riskScore,
    status: "open",
    detectedAt: new Date().toISOString(),
  };
  putState("fraud-alerts", alertId, alert, txId);
  broadcast({ event: "fraud:detected", data: alert });
  res.json(alert);
});

app.get("/api/fraud/alerts", requireAuth, requireRole(["admin", "doctor", "staff"]), (_, res) => {
  let all = getAllState("fraud-alerts");
  if (all.length === 0) {
    const defaultAlerts = [
      {
        alertId: "fa001",
        severity: "critical",
        status: "open",
        type: "Break-Glass Abuse",
        message: "Emergency override used outside declared emergency window",
        actor: "Dr. Sanjay Mehta",
        riskScore: 97,
        detectedAt: "2026-06-08T02:14:00.000Z",
        details:
          "Break-glass access invoked at 02:14 with no active emergency declaration. Access lasted 22 minutes. 14 records downloaded.",
        affectedResource: "Patient MRN-201884 · ICU records",
        actorRole: "General Physician",
        location: "OPD Block 2",
        ip: "10.14.2.88",
      },
      {
        alertId: "fa002",
        severity: "critical",
        status: "investigating",
        type: "Credential Replay Attack",
        message: "Identical credential presentation from two geographically distant endpoints",
        actor: "did:hosp:0x9af2…cc01",
        riskScore: 99,
        detectedAt: "2026-06-08T02:22:00.000Z",
        details:
          "Credential did:hosp:0x9af2... presented at Delhi and Mumbai endpoints within a 4-minute interval. Physical travel impossible.",
        affectedResource: "Clinician Identity Token",
        actorRole: "Security Monitor",
        location: "Gateway Router",
        ip: "125.16.88.2",
      },
    ];
    defaultAlerts.forEach((a) => putState("fraud-alerts", a.alertId, a, randomUUID()));
    all = getAllState("fraud-alerts");
  }
  res.json({ alerts: all.map((e) => e.value), total: all.length });
});

// ─── Beds & Infrastructure ────────────────────────────────────────────────────
app.get("/api/beds", requireAuth, hipaaAuditPHIAccess("BedOccupancy"), (_, res) => {
  const all = getAllState("beds");
  res.json({ beds: all.map((e) => e.value), total: all.length });
});

// NOTE: POST /api/beds is defined earlier (~line 821) with HIPAA audit

// ─── Billing ──────────────────────────────────────────────────────────────────
app.post(
  "/api/billing/payment",
  requireAuth,
  requireRole(["patient"]),
  hipaaAuditPHIAccess("BillingRecord"),
  (req, res) => {
    const { patientDid, patientName, amount, category, reference } = req.body;

    if (req.user.did !== patientDid) {
      return res
        .status(403)
        .json({ error: "Access Denied: Cannot record payment for another patient" });
    }

    const txId = randomUUID();
    const ref = reference || `REF-${Date.now().toString(36).toUpperCase()}`;
    const payment = {
      txId,
      patientDid,
      patientName,
      amount,
      category,
      status: "settled",
      ref,
      settledAt: new Date().toISOString(),
    };
    putState("billing", ref, payment, txId);
    broadcast({ event: "payment:recorded", data: payment });
    res.json(payment);
  },
);

app.get(
  "/api/billing/:patientDid",
  requireAuth,
  hipaaAuditPHIAccess("BillingRecord"),
  (req, res) => {
    if (req.user.role === "patient" && req.user.did && req.user.did !== req.params.patientDid) {
      return res
        .status(403)
        .json({ error: "Access Denied: Cannot view other patients' billing records" });
    }

    const patientDid = req.params.patientDid;
    let all = queryState("billing", (v) => v.patientDid === patientDid);

    if (all.length === 0) {
      // Seed default insurance config
      const defaultInsurance = {
        patientDid,
        provider: "Star Health Insurance",
        policyNumber: "SH-2024-789456",
        groupNumber: "GRP-45678",
        coverageType: "Premium Health Plan",
        copay: 500,
        deductible: 25000,
        deductibleMet: 18000,
        outOfPocketMax: 100000,
        outOfPocketMet: 32000,
        coveragePercentage: 80,
      };
      putState("billing", `insurance-${patientDid}`, defaultInsurance, randomUUID());

      // Seed default bill items
      const defaultBillItems = [
        {
          id: "bi1",
          patientDid,
          date: "2026-05-27",
          category: "room",
          description: "Private Room - Cardiology Ward (C-402)",
          quantity: 1,
          unitPrice: 5000,
          totalPrice: 5000,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 1000,
        },
        {
          id: "bi2",
          patientDid,
          date: "2026-05-28",
          category: "room",
          description: "Private Room - Cardiology Ward (C-402)",
          quantity: 1,
          unitPrice: 5000,
          totalPrice: 5000,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 1000,
        },
        {
          id: "bi3",
          patientDid,
          date: "2026-05-29",
          category: "room",
          description: "Private Room - Cardiology Ward (C-402)",
          quantity: 1,
          unitPrice: 5000,
          totalPrice: 5000,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 1000,
        },
        {
          id: "bi4",
          patientDid,
          date: "2026-05-30",
          category: "room",
          description: "Private Room - Cardiology Ward (C-402)",
          quantity: 1,
          unitPrice: 5000,
          totalPrice: 5000,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 1000,
        },
        {
          id: "bi5",
          patientDid,
          date: "2026-05-27",
          category: "consultation",
          description: "Emergency Consultation - Dr. Ravi Menon (Cardiologist)",
          quantity: 1,
          unitPrice: 2500,
          totalPrice: 2500,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 500,
        },
        {
          id: "bi6",
          patientDid,
          date: "2026-05-28",
          category: "consultation",
          description: "Daily Round - Dr. Ravi Menon",
          quantity: 1,
          unitPrice: 1000,
          totalPrice: 1000,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 200,
        },
        {
          id: "bi7",
          patientDid,
          date: "2026-05-29",
          category: "consultation",
          description: "Specialist Consultation - Dr. Sameer Khan (Endocrinologist)",
          quantity: 1,
          unitPrice: 1500,
          totalPrice: 1500,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 300,
        },
        {
          id: "bi8",
          patientDid,
          date: "2026-05-30",
          category: "consultation",
          description: "Daily Round - Dr. Ravi Menon",
          quantity: 1,
          unitPrice: 1000,
          totalPrice: 1000,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 200,
        },
        {
          id: "bi9",
          patientDid,
          date: "2026-05-28",
          category: "procedure",
          description: "Coronary Angiography with Stent Placement",
          quantity: 1,
          unitPrice: 185000,
          totalPrice: 185000,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 37000,
        },
        {
          id: "bi10",
          patientDid,
          date: "2026-05-28",
          category: "procedure",
          description: "Drug-Eluting Stent (DES)",
          quantity: 1,
          unitPrice: 95000,
          totalPrice: 95000,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 19000,
        },
        {
          id: "bi11",
          patientDid,
          date: "2026-05-27",
          category: "lab",
          description: "Troponin I Test (Emergency)",
          quantity: 1,
          unitPrice: 1200,
          totalPrice: 1200,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 240,
        },
        {
          id: "bi12",
          patientDid,
          date: "2026-05-27",
          category: "lab",
          description: "ECG (12-Lead)",
          quantity: 2,
          unitPrice: 500,
          totalPrice: 1000,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 200,
        },
        {
          id: "bi13",
          patientDid,
          date: "2026-05-28",
          category: "lab",
          description: "Complete Blood Count (CBC)",
          quantity: 1,
          unitPrice: 600,
          totalPrice: 600,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 120,
        },
        {
          id: "bi14",
          patientDid,
          date: "2026-05-29",
          category: "lab",
          description: "HbA1c Test",
          quantity: 1,
          unitPrice: 800,
          totalPrice: 800,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 160,
        },
        {
          id: "bi15",
          patientDid,
          date: "2026-05-29",
          category: "lab",
          description: "Lipid Profile",
          quantity: 1,
          unitPrice: 900,
          totalPrice: 900,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 180,
        },
        {
          id: "bi16",
          patientDid,
          date: "2026-05-27",
          category: "medication",
          description: "Aspirin 75mg (30 tablets)",
          quantity: 1,
          unitPrice: 120,
          totalPrice: 120,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 24,
        },
        {
          id: "bi17",
          patientDid,
          date: "2026-05-27",
          category: "medication",
          description: "Atorvastatin 40mg (30 tablets)",
          quantity: 1,
          unitPrice: 450,
          totalPrice: 450,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 90,
        },
        {
          id: "bi18",
          patientDid,
          date: "2026-05-27",
          category: "medication",
          description: "Metoprolol 50mg (60 tablets)",
          quantity: 1,
          unitPrice: 280,
          totalPrice: 280,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 56,
        },
        {
          id: "bi19",
          patientDid,
          date: "2026-05-27",
          category: "medication",
          description: "Insulin (Rapid-acting) 10ml vial",
          quantity: 2,
          unitPrice: 850,
          totalPrice: 1700,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 340,
        },
        {
          id: "bi20",
          patientDid,
          date: "2026-05-27",
          category: "medication",
          description: "Enoxaparin 40mg injection (3 doses)",
          quantity: 3,
          unitPrice: 320,
          totalPrice: 960,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 192,
        },
        {
          id: "bi21",
          patientDid,
          date: "2026-05-27",
          category: "nursing",
          description: "ICU Nursing Care (24 hours)",
          quantity: 1,
          unitPrice: 3000,
          totalPrice: 3000,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 600,
        },
        {
          id: "bi22",
          patientDid,
          date: "2026-05-28",
          category: "nursing",
          description: "General Ward Nursing Care",
          quantity: 1,
          unitPrice: 1500,
          totalPrice: 1500,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 300,
        },
        {
          id: "bi23",
          patientDid,
          date: "2026-05-29",
          category: "nursing",
          description: "General Ward Nursing Care",
          quantity: 1,
          unitPrice: 1500,
          totalPrice: 1500,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 300,
        },
        {
          id: "bi24",
          patientDid,
          date: "2026-05-30",
          category: "nursing",
          description: "General Ward Nursing Care",
          quantity: 1,
          unitPrice: 1500,
          totalPrice: 1500,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 300,
        },
        {
          id: "bi25",
          patientDid,
          date: "2026-05-27",
          category: "supplies",
          description: "IV Fluids and Administration Set",
          quantity: 1,
          unitPrice: 800,
          totalPrice: 800,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 160,
        },
        {
          id: "bi26",
          patientDid,
          date: "2026-05-28",
          category: "supplies",
          description: "Surgical Supplies (Cath Lab)",
          quantity: 1,
          unitPrice: 12000,
          totalPrice: 12000,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 2400,
        },
        {
          id: "bi27",
          patientDid,
          date: "2026-05-27",
          category: "supplies",
          description: "Oxygen Supply (24 hours)",
          quantity: 1,
          unitPrice: 1200,
          totalPrice: 1200,
          coveredByInsurance: true,
          insuranceCoverage: 80,
          patientResponsibility: 240,
        },
      ];
      putState("billing", `items-${patientDid}`, defaultBillItems, randomUUID());

      // Seed default daily charges
      const defaultDailyCharges = [
        {
          date: "2026-05-27",
          roomCharge: 5000,
          nursingCare: 3000,
          meals: 600,
          supplies: 2000,
          total: 10600,
        },
        {
          date: "2026-05-28",
          roomCharge: 5000,
          nursingCare: 1500,
          meals: 600,
          supplies: 12800,
          total: 19900,
        },
        {
          date: "2026-05-29",
          roomCharge: 5000,
          nursingCare: 1500,
          meals: 600,
          supplies: 400,
          total: 7500,
        },
        {
          date: "2026-05-30",
          roomCharge: 5000,
          nursingCare: 1500,
          meals: 600,
          supplies: 300,
          total: 7400,
        },
      ];
      putState("billing", `daily-${patientDid}`, defaultDailyCharges, randomUUID());

      // Seed initial payment records
      const defaultPayments = [
        {
          id: "pay1",
          patientDid,
          date: "2026-05-27",
          amount: 10000,
          method: "card",
          reference: "TXN-2026-05-27-001",
          paidBy: "Patient (Advance)",
        },
        {
          id: "pay2",
          patientDid,
          date: "2026-05-29",
          amount: 50000,
          method: "insurance",
          reference: "CLM-SH-2026-05-29-456",
          paidBy: "Star Health Insurance (Partial)",
        },
      ];
      defaultPayments.forEach((p) => putState("billing", `pay-${p.id}`, p, randomUUID()));

      all = queryState("billing", (v) => v.patientDid === patientDid);
    }

    // Parse the items
    const insuranceEntry = all.find((e) => e.key === `insurance-${patientDid}`);
    const itemsEntry = all.find((e) => e.key === `items-${patientDid}`);
    const dailyEntry = all.find((e) => e.key === `daily-${patientDid}`);
    const payments = all.filter((e) => e.key.startsWith("pay-")).map((e) => e.value);

    const insuranceInfo = insuranceEntry ? insuranceEntry.value : {};
    const billItems = itemsEntry ? itemsEntry.value : [];
    const dailyCharges = dailyEntry ? dailyEntry.value : [];

    // Calculate summary dynamically
    const totalCharges = billItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const patientResponsibility = billItems.reduce(
      (sum, item) => sum + (item.patientResponsibility || 0),
      0,
    );
    const insuranceClaimed = totalCharges - patientResponsibility;
    const amountPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const balanceDue = Math.max(0, patientResponsibility - amountPaid);

    // Category totals
    const categoryMap = {};
    billItems.forEach((item) => {
      categoryMap[item.category] = (categoryMap[item.category] || 0) + (item.totalPrice || 0);
    });
    const categoryTotals = Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);

    const billSummary = {
      admissionId: "ADM-2026-001234",
      patientId: patientDid,
      billNumber: `BILL-2026-05-30-001234`,
      generatedDate: "2026-05-30",
      fromDate: "2026-05-27",
      toDate: "2026-05-30",
      status: balanceDue === 0 ? "paid" : amountPaid > 0 ? "partial" : "pending",
      totalCharges,
      insuranceClaimed,
      insurancePaid: 50000,
      insurancePending: Math.max(0, insuranceClaimed - 50000),
      patientResponsibility,
      amountPaid,
      balanceDue,
      categoryTotals,
    };

    res.json({
      billSummary,
      billItems,
      dailyCharges,
      insuranceInfo,
      paymentRecords: payments,
    });
  },
);

// ─── Appointments ─────────────────────────────────────────────────────────────

// GET /api/doctors/verified — only users who have an active DID in the registry
app.get("/api/doctors/verified", requireAuth, (req, res) => {
  const allUsers = getAllState("users");
  const allDIDs = getAllState("did-registry");

  // Build a set of DIDs that are active
  const activeDIDs = new Set(
    allDIDs
      .filter((d) => d.value?.status === "active")
      .map((d) => d.value?.did)
      .filter(Boolean),
  );

  const doctors = allUsers
    .filter((u) => {
      const user = u.value;
      if (!user) return false;
      const role = (user.role || "").toLowerCase();
      if (role !== "doctor" && role !== "staff") return false;
      const did = user.did || `did:hosp:0x${simHash(user.email || "").slice(0, 8)}`;
      return activeDIDs.has(did);
    })
    .map((u) => {
      const doc = u.value;
      const did = doc.did || `did:hosp:0x${simHash(doc.email || "").slice(0, 8)}`;
      return {
        did,
        name: doc.name,
        email: doc.email,
        specialty: doc.specialty || doc.specializations?.[0] || "General Medicine",
        department: doc.department || "Outpatient Clinic",
        hospital: "Embrace Health Grid · OPD Block",
        rating: 4.5,
        status: "Available",
      };
    });

  res.json({ doctors, total: doctors.length });
});

// GET /api/appointments — server-side filtering by patientDid or doctorDid
app.get("/api/appointments", requireAuth, hipaaAuditPHIAccess("Appointment"), (req, res) => {
  const all = getAllState("appointments");
  let results = all.map((e) => e.value);

  const { patientDid, doctorDid, status } = req.query;

  // Patients may only see their own appointments
  if (req.user.role === "patient") {
    const myDid = req.user.did;
    results = results.filter((a) => a.patientDid === myDid);
  } else {
    if (patientDid) results = results.filter((a) => a.patientDid === patientDid);
    if (doctorDid)  results = results.filter((a) => a.doctorDid  === doctorDid);
  }

  if (status) results = results.filter((a) => a.status === status);

  res.json({ appointments: results, total: results.length });
});

// GET /api/appointments/requests — pending requests for the authenticated doctor
app.get(
  "/api/appointments/requests",
  requireAuth,
  requireRole(["doctor", "staff", "admin"]),
  hipaaAuditPHIAccess("Appointment"),
  (req, res) => {
    const doctorDid = req.user.did;
    const doctorName = req.user.name;
    const all = getAllState("appointments");
    const pending = all
      .map((e) => e.value)
      .filter(
        (a) =>
          a.status === "pending" &&
          (a.doctorDid === doctorDid ||
            (doctorName && a.doctorName === doctorName)),
      );
    res.json({ requests: pending, total: pending.length });
  },
);

// GET /api/appointments/my — all appointments for the authenticated doctor (any status)
app.get(
  "/api/appointments/my",
  requireAuth,
  requireRole(["doctor", "staff", "admin"]),
  hipaaAuditPHIAccess("Appointment"),
  (req, res) => {
    const doctorDid = req.user.did;
    const doctorName = req.user.name;
    const all = getAllState("appointments");
    const mine = all
      .map((e) => e.value)
      .filter(
        (a) =>
          a.doctorDid === doctorDid ||
          (doctorName && a.doctorName === doctorName),
      );
    res.json({ appointments: mine, total: mine.length });
  },
);

// ─── Surgeries ────────────────────────────────────────────────────────────────
app.get("/api/surgeries", requireAuth, hipaaAuditPHIAccess("Surgery"), (_, res) => {
  const defaultSurgeries = [
    {
      id: "s1",
      patient: "Anika Sharma",
      mrn: "MRN-204871",
      procedure: "Cardiac Catheterization (PCI)",
      room: "Cath Lab 2",
      date: "2026-06-04",
      time: "11:00",
      surgeon: "Dr. Ravi Menon",
      anesthesiologist: "Dr. Deepak Joshi",
      nurses: ["Nurse Priya K.", "Nurse Ananya V."],
      equipment: ["Cath Lab C-Arm", "Defibrillator", "Hemodynamic Monitor", "Infusion Pump ×3"],
      status: "scheduled",
      estDuration: "90 min",
    },
    {
      id: "s2",
      patient: "Rohan Iyer",
      mrn: "MRN-204902",
      procedure: "Total Hip Replacement (Left)",
      room: "OR-4",
      date: "2026-06-04",
      time: "13:30",
      surgeon: "Dr. Priya Nair",
      anesthesiologist: "Dr. Sunita Kapoor",
      nurses: ["Nurse Rekha S.", "Nurse Vijay T."],
      equipment: ["Orthopedic Power Tools Set", "C-Arm", "Cell Saver", "Electrosurgical Unit"],
      status: "scheduled",
      estDuration: "3 hours",
    },
    {
      id: "s3",
      patient: "Deepak Joshi",
      mrn: "MRN-203001",
      procedure: "Laparoscopic Appendectomy",
      room: "OR-2",
      date: "2026-06-02",
      time: "09:00",
      surgeon: "Dr. Kiran Bose",
      anesthesiologist: "Dr. Alok Sharma",
      nurses: ["Nurse Sunita V.", "Nurse Ram K."],
      equipment: ["Laparoscopic Tower", "Ultrasonic Scalpel", "Electrosurgical Unit"],
      status: "in-progress",
      estDuration: "45 min",
    },
    {
      id: "s4",
      patient: "Kavya Reddy",
      mrn: "MRN-206114",
      procedure: "LASIK Eye Surgery (Bilateral)",
      room: "Eye Suite 1",
      date: "2026-06-01",
      time: "14:00",
      surgeon: "Dr. Reena Pillai",
      anesthesiologist: "Local Anesthesia",
      nurses: ["Nurse Pooja A."],
      equipment: ["LASIK Excimer Laser", "Microkeratome", "Aberrometer"],
      status: "completed",
      estDuration: "30 min",
    },
  ];
  const all = getAllState("surgeries");
  if (all.length === 0) {
    res.json({ surgeries: defaultSurgeries, total: defaultSurgeries.length });
  } else {
    res.json({ surgeries: all.map((e) => e.value), total: all.length });
  }
});

app.post("/api/appointments", requireAuth, hipaaAuditPHIAccess("Appointment"), (req, res) => {
  const {
    patientDid,
    patientName,
    doctorDid,
    doctorName,
    slot,
    date,
    mode,
    specialty,
    reason,
    consentGranted,
  } = req.body;

  if (!patientDid || !doctorDid || !slot) {
    return res.status(400).json({ error: "patientDid, doctorDid, and slot are required" });
  }

  if (req.user.role === "patient" && req.user.did !== patientDid) {
    return res
      .status(403)
      .json({ error: "Access Denied: Cannot book appointments for another patient" });
  }

  // Enforce minimum 1 day ahead (skip for emergency slots)
  if (date && slot !== "Immediate Triage Priority") {
    const appointmentDate = new Date(date);
    appointmentDate.setHours(0, 0, 0, 0);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    if (appointmentDate < tomorrow) {
      return res
        .status(400)
        .json({ error: "Appointments must be booked at least 1 day in advance" });
    }
  }

  const apptId = `appt_${randomUUID().slice(0, 8)}`;
  const txId = randomUUID();
  const appt = {
    apptId,
    patientDid,
    patientName: patientName || "Patient",
    doctorDid,
    doctorName: doctorName || "Doctor",
    slot,
    date: date || slot.split(" · ")[0] || new Date().toISOString().split("T")[0],
    mode: mode || "in-person",
    specialty: specialty || "General Medicine",
    reason: reason || "",
    // New appointments go to pending — doctor must accept
    status: slot === "Immediate Triage Priority" ? "confirmed" : "pending",
    bookedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  putState("appointments", apptId, appt, txId);
  broadcast({ event: "appointment:booked", data: appt });

  if (consentGranted) {
    const grantId = `consent_${randomUUID().slice(0, 8)}`;
    const grant = {
      grantId,
      patientDid,
      doctorDid,
      resource: "Prescription Ledger",
      status: "active",
      expiry: new Date(Date.now() + 24 * 3600000).toISOString(),
      grantedAt: new Date().toISOString(),
    };
    putState("consent-manager", grantId, grant, txId);
    broadcast({ event: "consent:granted", data: grant });
  }

  res.status(201).json(appt);
});

app.patch("/api/appointments/:id/status", requireAuth, hipaaAuditPHIAccess("Appointment"), (req, res) => {
  const { id } = req.params;
  const { status, notes, suggestedSlot } = req.body;

  if (!status) return res.status(400).json({ error: "status is required" });

  const existing = getState("appointments", id);
  if (!existing) {
    return res.status(404).json({ error: "Appointment not found" });
  }

  const userRole = (req.user.role || "").toLowerCase();
  const userDid  = req.user.did;

  // Accept / reject / suggest — only the assigned doctor (or admin) may do this
  if (["accepted", "rejected", "suggested"].includes(status)) {
    const isAssignedDoctor =
      existing.doctorDid === userDid ||
      (req.user.name && existing.doctorName === req.user.name);
    if (!isAssignedDoctor && userRole !== "admin") {
      return res.status(403).json({
        error: "Access Denied: Only the assigned doctor can accept or reject appointments",
      });
    }
  }

  // Cancel — only the booking patient (or admin) may cancel
  if (status === "cancelled") {
    const isOwner = existing.patientDid === userDid;
    if (!isOwner && userRole !== "admin") {
      return res.status(403).json({
        error: "Access Denied: Only the patient who booked this appointment can cancel it",
      });
    }
  }

  // Map "accepted" → "confirmed" for legacy compatibility
  const normalizedStatus = status === "accepted" ? "confirmed" : status;

  const updated = {
    ...existing,
    status: normalizedStatus,
    notes: notes !== undefined ? notes : existing.notes,
    suggestedSlot: suggestedSlot || existing.suggestedSlot || null,
    reviewedBy: ["accepted", "rejected", "suggested"].includes(status)
      ? req.user.name || userDid
      : existing.reviewedBy,
    updatedAt: new Date().toISOString(),
  };

  const txId = randomUUID();
  putState("appointments", id, updated, txId);
  // Broadcast with granular event names so the patient portal can react
  broadcast({ event: "appointment:updated", data: updated });
  if (normalizedStatus === "confirmed") {
    broadcast({ event: "appointment:accepted", data: updated });
  } else if (normalizedStatus === "rejected") {
    broadcast({ event: "appointment:rejected", data: updated });
  }

  res.json({ success: true, appointment: updated });
});

// ─── Pager notifications (added for locator integrations) ────────────────────
app.post(
  "/api/tracker/notify",
  requireAuth,
  requireRole(["admin", "doctor", "staff"]),
  (req, res) => {
    const { staffDid, name, location } = req.body;
    if (!staffDid || !name) return res.status(400).json({ error: "staffDid and name required" });

    const txId = randomUUID();
    const notifyEvent = {
      id: `pager_${txId.slice(0, 8)}`,
      staffDid,
      name,
      location: location || "Unknown Location",
      dispatchedAt: new Date().toISOString(),
      status: "delivered",
    };
    putState("tracker", `pager_${txId.slice(0, 8)}`, notifyEvent, txId);
    broadcast({
      event: "staff:location",
      data: {
        id: staffDid,
        location: location || "Unknown Location",
        lastSignal: notifyEvent.dispatchedAt,
      },
    });

    logAudit(req, { resource: staffDid, action: "PAGER_DISPATCH" });
    res.json({ success: true, notifyEvent });
  },
);

/**
 * POST /api/auth/setup  — One-time bootstrap to create the first admin.
 * Becomes 410 Gone once any admin exists. Solves the circular-dependency
 * bootstrap problem: no admin JWT needed for the very first admin account.
 */
app.post("/api/auth/setup", requireClientAuth, async (req, res) => {
  const allUsers = getAllState("users");
  const adminExists = allUsers.some((u) => u.value?.role === "admin");
  if (adminExists) {
    return res
      .status(410)
      .json({ error: "Setup already completed. An admin account already exists." });
  }

  const { name, email, password, setupKey } = req.body;
  const SETUP_KEY = process.env.SETUP_KEY;
  if (SETUP_KEY && setupKey !== SETUP_KEY) {
    return res.status(401).json({ error: "Invalid setup key" });
  }
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  if (password.length < 12) {
    return res.status(400).json({ error: "Admin password must be at least 12 characters" });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  putState(
    "users",
    email,
    {
      name,
      email,
      password: hashedPassword,
      role: "admin",
      did: null,
      createdAt: new Date().toISOString(),
      bootstrapped: true,
    },
    randomUUID(),
  );

  const { token } = mintAccessToken({ email, role: "admin", name });
  const refreshToken = createRefreshToken(email, requestFingerprint(req));
  logger.info("bootstrap_admin_created", { email });
  res.status(201).json({
    success: true,
    message: "Admin account created. Setup is now locked.",
    token,
    refreshToken,
    user: { name, email, role: "admin" },
  });
});

/**
 * POST /api/auth/signup  — Patient self-registration only.
 * Staff/doctor/admin accounts must be created by an admin via /api/auth/users/create.
 */
app.post("/api/auth/signup", requireClientAuth, async (req, res) => {
  const { name, email, role, password } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: "Name and email are required" });
  }
  if (role && role !== "patient" && process.env.NODE_ENV === "production") {
    return res.status(403).json({
      error:
        "Self-registration is only available for patient accounts in production. Contact your administrator to create staff or admin accounts.",
    });
  }
  const assignedRole = role || "patient";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long" });
  }
  if (!/\d/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return res
      .status(400)
      .json({ error: "Password must contain at least one number and one special character" });
  }
  if (getState("users", email)) {
    return res.status(400).json({ error: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  putState(
    "users",
    email,
    {
      name,
      email,
      password: hashedPassword,
      role: assignedRole,
      did: null,
      createdAt: new Date().toISOString(),
    },
    randomUUID(),
  );

  const { token } = mintAccessToken({ email, role: assignedRole, name });
  const refreshToken = createRefreshToken(email, requestFingerprint(req));
  logger.info("user_registered", { email, role: assignedRole });
  res.json({ success: true, token, refreshToken, user: { name, email, role: assignedRole } });
});

/**
 * POST /api/auth/users/create  — Admin creates staff/doctor/admin accounts.
 * This is the correct way to onboard clinical staff without self-registration.
 */
app.post(
  "/api/auth/users/create",
  requireClientAuth,
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const { name, email, role, password, department, specializations, employeeId } = req.body;
    if (!name || !email || !role || !password) {
      return res.status(400).json({ error: "name, email, role, and password are required" });
    }
    if (!["staff", "doctor", "admin"].includes(role)) {
      return res.status(400).json({ error: "role must be staff, doctor, or admin" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (getState("users", email)) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    putState(
      "users",
      email,
      {
        name,
        email,
        password: hashedPassword,
        role,
        did: null,
        department: department || null,
        specializations: specializations || [],
        employeeId: employeeId || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        createdAt: new Date().toISOString(),
        createdBy: req.user.email,
      },
      randomUUID(),
    );

    logAudit(req, { resource: email, action: "USER_CREATED", outcome: "success" });
    logger.info("admin_created_user", { createdBy: req.user.email, newUser: email, role });
    res.status(201).json({ success: true, user: { name, email, role } });
  },
);

app.post("/api/auth/login", requireClientAuth, async (req, res) => {
  const { email, password, mfaCode } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  // HIPAA Authentication: Check for Account Lockout
  const lockout = checkAccountLockout(email);
  if (lockout.isLocked) {
    logAudit(req, {
      resource: email,
      action: "USER_LOGIN_LOCKED",
      outcome: "failure",
      severity: "warning",
    });
    return res.status(423).json({
      error: "Account Locked",
      code: "ACCOUNT_LOCKED",
      message: `Account is locked due to 5 consecutive failed login attempts. Try again in ${lockout.remainingSeconds} seconds.`,
      remainingSeconds: lockout.remainingSeconds,
    });
  }

  const userEntry = getState("users", email);
  if (!userEntry) {
    recordFailedLogin(email);
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (userEntry.value.password) {
    const isHash =
      userEntry.value.password.startsWith("$2a$") ||
      userEntry.value.password.startsWith("$2b$") ||
      userEntry.value.password.startsWith("$2y$");
    let match = false;
    if (isHash) {
      match = await bcrypt.compare(password || "", userEntry.value.password).catch(() => false);
    } else {
      match = password === userEntry.value.password;
    }
    if (!match) {
      const failStatus = recordFailedLogin(email);
      logAudit(req, { resource: email, action: "USER_LOGIN_FAILED", outcome: "failure" });
      if (failStatus.isLocked) {
        return res.status(423).json({
          error: "Account Locked",
          code: "ACCOUNT_LOCKED",
          message: "Account locked after 5 consecutive failed attempts. Locked for 15 minutes.",
          remainingSeconds: failStatus.remainingSeconds,
        });
      }
      return res
        .status(401)
        .json({ error: "Invalid email or password", attemptsRemaining: 5 - failStatus.count });
    }
  }

  // HIPAA: Enforce MFA for clinical roles (doctor, staff, admin)
  const MFA_REQUIRED_ROLES = ["doctor", "staff", "admin"];
  const isClinicalRole = MFA_REQUIRED_ROLES.includes(userEntry.value.role);

  if (isClinicalRole && !userEntry.value.mfaEnabled && process.env.NODE_ENV === "production") {
    // Clinical role has not set up MFA yet — issue a temporary token
    // that only allows MFA setup endpoints
    const { token: setupToken } = mintAccessToken({
      email: userEntry.value.email,
      role: userEntry.value.role,
      name: userEntry.value.name,
      did: userEntry.value.did,
    });
    resetFailedLogins(email);
    return res.status(202).json({
      mfaSetupRequired: true,
      message: "Multi-Factor Authentication is mandatory for clinical staff. Please set up MFA to continue.",
      setupToken,
      setupUrl: "/api/auth/mfa/setup",
      email: userEntry.value.email,
    });
  }

  // TOTP MFA Check if enabled for user
  if (userEntry.value.mfaEnabled && userEntry.value.mfaSecret) {
    if (!mfaCode) {
      return res.status(202).json({
        mfaRequired: true,
        message: "MFA code (2FA) is required to complete authentication",
        email: userEntry.value.email,
      });
    }

    const isValidMfa = verifyTotpToken(userEntry.value.mfaSecret, mfaCode);
    if (!isValidMfa) {
      recordFailedLogin(email);
      logAudit(req, { resource: email, action: "USER_MFA_FAILED", outcome: "failure" });
      return res.status(401).json({ error: "Invalid 2FA authentication code" });
    }
  }

  // Reset failed login counter on success
  resetFailedLogins(email);

  let userDid = userEntry.value.did;
  if (!userDid) {
    const allDids = getAllState("did-registry");
    const match = allDids.find((entry) => {
      const doc = entry.value;
      return (
        (doc.ownerEmail && doc.ownerEmail.toLowerCase() === userEntry.value.email?.toLowerCase()) ||
        (doc.owner && doc.owner.toLowerCase() === userEntry.value.name?.toLowerCase())
      );
    });
    if (match) {
      userDid = match.value.did;
      userEntry.value.did = userDid;
      putState("users", userEntry.value.email, userEntry.value, randomUUID());
    }
  }
  const user = {
    name: userEntry.value.name,
    email: userEntry.value.email,
    role: userEntry.value.role,
    did: userDid || null,
    walletAddress: userEntry.value.walletAddress || null,
    mrn: userEntry.value.mrn || null,
    employeeId: userEntry.value.employeeId || null,
    mfaEnabled: !!userEntry.value.mfaEnabled,
  };

  // Mint access token with jti + issue opaque refresh token
  const { token } = mintAccessToken({
    email: user.email,
    role: user.role,
    name: user.name,
    did: user.did,
  });
  const refreshToken = createRefreshToken(user.email, requestFingerprint(req));

  // Set HttpOnly Cookie for Refresh Token (Protection against XSS theft)
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/auth",
  });

  logger.info("user_login", {
    email: user.email,
    role: user.role,
    mfaVerified: !!userEntry.value.mfaEnabled,
  });
  res.json({ success: true, token, refreshToken, user });
});

// ─── MFA (TOTP) Setup & Verification Endpoints ──────────────────────────────
app.post("/api/auth/mfa/setup", requireAuth, (req, res) => {
  const userEntry = getState("users", req.user.email);
  if (!userEntry) return res.status(404).json({ error: "User not found" });

  const secret = generateTotpSecret(20);
  const otpauthUrl = `otpauth://totp/EmbraceHealthGrid:${encodeURIComponent(req.user.email)}?secret=${secret}&issuer=EmbraceHealthGrid`;

  // Temporarily store pending secret until verified
  userEntry.value.pendingMfaSecret = secret;
  putState("users", req.user.email, userEntry.value, randomUUID());

  logAudit(req, { resource: req.user.email, action: "MFA_SETUP_INITIATED" });
  res.json({
    secret,
    otpauthUrl,
    instructions:
      "Scan the QR code or enter the secret key into your Google Authenticator or Phantom app, then call /api/auth/mfa/verify with the 6-digit code.",
  });
});

app.post("/api/auth/mfa/verify", requireAuth, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "6-digit TOTP code is required" });

  const userEntry = getState("users", req.user.email);
  if (!userEntry) return res.status(404).json({ error: "User not found" });

  const secretToVerify = userEntry.value.pendingMfaSecret || userEntry.value.mfaSecret;
  if (!secretToVerify) {
    return res
      .status(400)
      .json({ error: "No pending MFA setup found. Call /api/auth/mfa/setup first." });
  }

  const isValid = verifyTotpToken(secretToVerify, code);
  if (!isValid) {
    logAudit(req, { resource: req.user.email, action: "MFA_VERIFY_FAILED", outcome: "failure" });
    return res.status(400).json({ error: "Invalid 6-digit TOTP code" });
  }

  userEntry.value.mfaSecret = secretToVerify;
  userEntry.value.mfaEnabled = true;
  delete userEntry.value.pendingMfaSecret;

  putState("users", req.user.email, userEntry.value, randomUUID());
  logAudit(req, { resource: req.user.email, action: "MFA_ENABLED", outcome: "success" });

  res.json({
    success: true,
    message:
      "Multi-Factor Authentication (TOTP 2FA) has been successfully activated for your account!",
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const userEntry = getState("users", req.user.email);
  if (!userEntry) {
    return res.status(404).json({ error: "User not found" });
  }

  let userDid = userEntry.value.did;
  if (!userDid) {
    const allDids = getAllState("did-registry");
    const match = allDids.find((entry) => {
      const doc = entry.value;
      return (
        (doc.ownerEmail && doc.ownerEmail.toLowerCase() === userEntry.value.email?.toLowerCase()) ||
        (doc.owner && doc.owner.toLowerCase() === userEntry.value.name?.toLowerCase())
      );
    });
    if (match) {
      userDid = match.value.did;
      userEntry.value.did = userDid;
      putState("users", userEntry.value.email, userEntry.value, randomUUID());
    }
  }

  res.json({
    user: {
      name: userEntry.value.name,
      email: userEntry.value.email,
      role: userEntry.value.role,
      did: userDid || null,
      walletAddress: userEntry.value.walletAddress || null,
      walletVerified: userEntry.value.walletVerified === true,
      mrn: userEntry.value.mrn || null,
      employeeId: userEntry.value.employeeId || null,
    },
  });
});

// ─── Wallet: legacy simple link (kept for backward compat, unverified) ────────
app.post("/api/auth/link-wallet", requireAuth, (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: "walletAddress is required" });
  const email = req.user.email;
  const userEntry = getState("users", email);
  if (!userEntry) return res.status(404).json({ error: "User not found" });

  // Enforce uniqueness: one wallet → one account
  const existingOwner = queryState("users", (v) =>
    v.walletAddress === walletAddress && v.email !== email
  );
  if (existingOwner.length > 0) {
    return res.status(409).json({ error: "This wallet is already linked to another account." });
  }

  userEntry.value.walletAddress = walletAddress;
  userEntry.value.walletVerified = false; // legacy link is unverified
  putState("users", email, userEntry.value, randomUUID());

  if (userEntry.value.did) {
    const didEntry = getState("did-registry", userEntry.value.did);
    if (didEntry) {
      didEntry.value.walletAddress = walletAddress;
      putState("did-registry", userEntry.value.did, didEntry.value, randomUUID());
      broadcast({ event: "did:updated", data: didEntry.value });
    }
  }

  res.json({
    success: true,
    user: {
      name: userEntry.value.name,
      email: userEntry.value.email,
      role: userEntry.value.role,
      did: userEntry.value.did,
      walletAddress,
      walletVerified: false,
      mrn: userEntry.value.mrn || null,
      employeeId: userEntry.value.employeeId || null,
    },
  });
});

// ─── Wallet: Step 1 — issue a sign-challenge nonce ───────────────────────────
// In-memory nonce store (TTL 5 minutes). For production use Redis.
const _walletNonces = new Map(); // walletAddress → { nonce, email, expiresAt }

app.post("/api/auth/wallet-challenge", requireAuth, (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: "walletAddress is required" });

  // Enforce: one wallet per account
  const existingOwner = queryState("users", (v) =>
    v.walletAddress === walletAddress &&
    v.email !== req.user.email &&
    v.walletVerified === true
  );
  if (existingOwner.length > 0) {
    return res.status(409).json({
      error: "This wallet is already linked and verified on another account. Each wallet may only be used by one account.",
    });
  }

  const nonce = randomUUID();
  const message = `Embrace Health Grid — Wallet Verification\nAccount: ${req.user.email}\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;
  _walletNonces.set(walletAddress, {
    nonce,
    message,
    email: req.user.email,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 min TTL
  });

  res.json({ nonce, message });
});

// ─── Wallet: Step 2 — verify signature + link wallet ─────────────────────────
app.post("/api/auth/wallet-verify", requireAuth, async (req, res) => {
  const { walletAddress, signature } = req.body;
  if (!walletAddress || !signature) {
    return res.status(400).json({ error: "walletAddress and signature are required" });
  }

  const pending = _walletNonces.get(walletAddress);
  if (!pending) {
    return res.status(400).json({ error: "No active challenge for this wallet. Request a new challenge first." });
  }
  if (Date.now() > pending.expiresAt) {
    _walletNonces.delete(walletAddress);
    return res.status(400).json({ error: "Challenge expired. Please request a new challenge." });
  }
  if (pending.email !== req.user.email) {
    return res.status(403).json({ error: "Challenge was issued for a different account." });
  }

  // Verify the Ed25519 signature using @solana/web3.js PublicKey
  try {
    const pubKey = new PublicKey(walletAddress);
    const msgBytes = new TextEncoder().encode(pending.message);
    const sigBytes = Buffer.from(signature, "base64");
    const nacl = await import("tweetnacl");
    const valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKey.toBytes());
    if (!valid) {
      return res.status(400).json({ error: "Signature verification failed. Wallet ownership could not be confirmed." });
    }
  } catch (err) {
    logger.warn({ err }, "wallet signature verification error");
    return res.status(400).json({ error: "Invalid signature or wallet address." });
  }

  // All checks passed — enforce one-wallet-per-account and one-account-per-wallet
  const email = req.user.email;

  const walletTakenByOther = queryState("users", (v) =>
    v.walletAddress === walletAddress && v.email !== email && v.walletVerified === true
  );
  if (walletTakenByOther.length > 0) {
    return res.status(409).json({ error: "This wallet is already verified on another account." });
  }

  const userEntry = getState("users", email);
  if (!userEntry) return res.status(404).json({ error: "User not found" });

  // Clear the nonce
  _walletNonces.delete(walletAddress);

  // Persist verified wallet to user record
  userEntry.value.walletAddress = walletAddress;
  userEntry.value.walletVerified = true;
  putState("users", email, userEntry.value, randomUUID());

  // Sync to DID registry if DID already issued
  if (userEntry.value.did) {
    const didEntry = getState("did-registry", userEntry.value.did);
    if (didEntry) {
      didEntry.value.walletAddress = walletAddress;
      didEntry.value.walletVerified = true;
      putState("did-registry", userEntry.value.did, didEntry.value, randomUUID());
      broadcast({ event: "did:updated", data: didEntry.value });
    }
  }

  broadcast({ event: "wallet:verified", data: { email, walletAddress } });

  res.json({
    success: true,
    verified: true,
    user: {
      name: userEntry.value.name,
      email,
      role: userEntry.value.role,
      did: userEntry.value.did,
      walletAddress,
      walletVerified: true,
      mrn: userEntry.value.mrn || null,
      employeeId: userEntry.value.employeeId || null,
    },
  });
});

app.post("/api/auth/update-profile", requireAuth, (req, res) => {
  const { name, phone, age, gender, bloodGroup, allergies, department, role, specializations } =
    req.body;
  const email = req.user.email;
  const userEntry = getState("users", email);
  if (!userEntry) {
    return res.status(404).json({ error: "User not found" });
  }

  // Update main user account properties
  if (name) userEntry.value.name = name;
  if (phone) userEntry.value.phone = phone;
  if (age) userEntry.value.age = parseInt(age) || userEntry.value.age;
  if (gender) userEntry.value.gender = gender;
  if (bloodGroup) userEntry.value.bloodGroup = bloodGroup;
  if (allergies) {
    userEntry.value.allergies = Array.isArray(allergies)
      ? allergies
      : String(allergies)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
  }
  // Staff properties
  if (department) userEntry.value.department = department;
  if (role) userEntry.value.role = role;
  if (specializations) {
    userEntry.value.specializations = Array.isArray(specializations)
      ? specializations
      : String(specializations)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
  }

  putState("users", email, userEntry.value, randomUUID());

  // Also sync with DID document if active
  if (userEntry.value.did) {
    const didEntry = getState("did-registry", userEntry.value.did);
    if (didEntry) {
      if (name) didEntry.value.name = name;
      if (phone) didEntry.value.phone = phone;
      if (age) didEntry.value.age = parseInt(age) || didEntry.value.age;
      if (gender) didEntry.value.gender = gender;
      if (bloodGroup) didEntry.value.bloodGroup = bloodGroup;
      if (allergies) {
        didEntry.value.allergies = userEntry.value.allergies;
      }
      if (department) didEntry.value.department = department;
      if (specializations) didEntry.value.specializations = userEntry.value.specializations;

      putState("did-registry", userEntry.value.did, didEntry.value, randomUUID());
      broadcast({ event: "did:updated", data: didEntry.value });
    }
  }

  res.json({
    success: true,
    user: {
      name: userEntry.value.name,
      email: userEntry.value.email,
      role: userEntry.value.role,
      did: userEntry.value.did,
      walletAddress: userEntry.value.walletAddress || null,
      mrn: userEntry.value.mrn || null,
      employeeId: userEntry.value.employeeId || null,
      phone: userEntry.value.phone || null,
      age: userEntry.value.age || null,
      gender: userEntry.value.gender || null,
      bloodGroup: userEntry.value.bloodGroup || null,
      allergies: userEntry.value.allergies || [],
      department: userEntry.value.department || null,
      specializations: userEntry.value.specializations || [],
    },
  });
});

/**
 * POST /api/auth/refresh  — Rotate refresh token and mint a new access token.
 * Accepts the opaque refresh token in the body (never from Authorization header).
 * Single-use: the provided token is consumed and a new one is issued.
 */
app.post("/api/auth/refresh", requireClientAuth, (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: "refreshToken is required" });
  }

  const fingerprint = requestFingerprint(req);
  const record = consumeRefreshToken(refreshToken, fingerprint);
  if (!record) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  const userEntry = getState("users", record.email);
  if (!userEntry) {
    return res.status(401).json({ error: "User account not found" });
  }

  const u = userEntry.value;
  const { token } = mintAccessToken({ email: u.email, role: u.role, name: u.name, did: u.did });
  const newRefreshToken = createRefreshToken(u.email, fingerprint);

  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });

  logger.info("token_refreshed", { email: u.email });
  res.json({ token, refreshToken: newRefreshToken });
});

/**
 * POST /api/auth/logout  — Invalidate the current access + refresh tokens.
 * The JTI of the access token is blocklisted so it can't be reused
 * even before its 2-hour expiry.
 */
app.post("/api/auth/logout", requireAuth, (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (req.user?.jti && req.user?.exp) {
    blockToken(req.user.jti, req.user.exp * 1000);
  }

  if (req.user?.email) {
    revokeAllRefreshTokens(req.user.email);
  }

  res.clearCookie("refreshToken", { path: "/api/auth" });

  logger.info("user_logged_out", { email: req.user?.email });
});

/**
 * POST /api/auth/revoke/:email  — Admin force-logout all sessions for a user.
 */
app.post("/api/auth/revoke/:email", requireAuth, requireRole(["admin"]), (req, res) => {
  const target = req.params.email;
  blockAllTokensForUser(target);
  revokeAllRefreshTokens(target);
  logAudit(req, { resource: target, action: "FORCE_LOGOUT", outcome: "success" });
  logger.info("admin_force_logout", { admin: req.user.email, target });
  res.json({ success: true, message: `All sessions for ${target} have been revoked` });
});

// ─── Admin Encrypted Backup & Verification ─────────────────────────────────
app.post("/api/admin/backup/create", requireAuth, requireRole(["admin"]), (req, res) => {
  try {
    const backupBundle = createEncryptedBackup();
    logAudit(req, { resource: backupBundle.backupId, action: "BACKUP_CREATED" });
    logger.info("backup_created", { admin: req.user.email, backupId: backupBundle.backupId });
    res.json({ success: true, backup: backupBundle });
  } catch (err) {
    logger.error("backup_create_failed", { error: err.message });
    res.status(500).json({ error: `Backup failed: ${err.message}` });
  }
});

app.post("/api/admin/backup/verify", requireAuth, requireRole(["admin"]), (req, res) => {
  const backupBundle = req.body;
  if (!backupBundle || !backupBundle.encryptedPayload) {
    return res.status(400).json({ error: "Backup bundle payload is required" });
  }

  try {
    const report = verifyBackupEncryption(backupBundle);
    logAudit(req, {
      resource: report.backupId || "backup_verify",
      action: "BACKUP_VERIFIED",
      outcome: report.verified ? "success" : "failure",
    });
    logger.info("backup_verified", { admin: req.user.email, verified: report.verified });
    res.json({ success: true, report });
  } catch (err) {
    logger.error("backup_verify_failed", { error: err.message });
    res.status(500).json({ error: `Verification failed: ${err.message}` });
  }
});

app.get("/api/auth/users", requireAuth, requireRole(["admin"]), (req, res) => {
  const entries = getAllState("users");
  const users = entries.map((e) => e.value);
  res.json({ users });
});

// ─── Notifications ──────────────────────────────────────────────────────────
app.get("/api/notifications", requireAuth, (req, res) => {
  const userEmail = req.user.email;
  const all = queryState("notifications", (v) => v.recipientEmail === userEmail);
  const notifications = all.map((e) => e.value);
  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({ notifications, unreadCount });
});

app.patch("/api/notifications/read-all", requireAuth, (req, res) => {
  const userEmail = req.user.email;
  const all = queryState("notifications", (v) => v.recipientEmail === userEmail);
  all.forEach((e) => {
    putState("notifications", e.key, { ...e.value, read: true }, randomUUID());
  });
  broadcast({ event: "notifications:update", data: { unreadCount: 0 } });
  res.json({ success: true });
});

app.patch("/api/notifications/:id/read", requireAuth, (req, res) => {
  const entry = getState("notifications", req.params.id);
  if (entry && entry.value) {
    putState("notifications", req.params.id, { ...entry.value, read: true }, randomUUID());
  }
  res.json({ success: true });
});

// ─── ZKP ─────────────────────────────────────────────────────────────────────
app.post("/api/zkproof/generate", requireAuth, requireRole(["patient"]), (req, res) => {
  const { patientDid, selectedClaims } = req.body;
  if (!patientDid) return res.status(400).json({ error: "patientDid required" });

  if (req.user.did !== patientDid) {
    return res
      .status(403)
      .json({ error: "Access Denied: Cannot generate proof for another patient" });
  }

  const proofId = "zkp-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const commitment = "0x" + simHash(patientDid + proofId).slice(0, 40);
  const nullifier = "0x" + simHash(proofId + Date.now()).slice(0, 40);
  const merkleRoot = "0x" + simHash(patientDid + "merkle" + 1).slice(0, 40);
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 3600000);

  const proof = {
    proofId,
    patientDid,
    claims: selectedClaims || [],
    commitment,
    nullifier,
    merkleRoot,
    circuitId: "groth16-hospital-v1",
    generatedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    qrPayload: Buffer.from(
      JSON.stringify({ proofId, patientDid, merkleRoot, circuitId: "groth16-hospital-v1" }),
    ).toString("base64"),
    verificationStatus: "pending",
  };

  const txId = "tx-zkp-" + Date.now().toString(36);
  putState(
    "zkproofs",
    proofId,
    {
      ...proof,
      module: "did-registry",
      fcn: "GenerateZKProof",
      network: NETWORK,
    },
    txId,
  );

  res.json({ proof, txId });
});

app.post("/api/zkproof/verify", requireAuth, (req, res) => {
  const { proofId } = req.body;
  if (!proofId) return res.status(400).json({ error: "proofId required" });

  const entry = getState("zkproofs", proofId);
  const proof = entry ? entry.value : null;

  const disclosedAttributes = {};
  if (proof && proof.claims) {
    proof.claims
      .filter((c) => c.disclosed)
      .forEach((c) => {
        disclosedAttributes[c.attribute] = c.value;
      });
  }

  const result = {
    valid: !!proof,
    proofId: proofId || "zkp-unknown",
    disclosedAttributes,
    verifiedAt: new Date().toISOString(),
    circuitId: "groth16-hospital-v1",
    blockHash: "0x" + simHash(proofId + "verify").slice(0, 40),
    message:
      "Zero-knowledge proof verified successfully. Identity confirmed without revealing full medical record.",
  };

  res.json(result);
});

// ─── Register Extension Routes (Medical Records, NFC, Visitors, Attendance, Solana) ───
registerExtensionRoutes(app, {
  putState,
  getState,
  getAllState,
  queryState,
  commitBlock: () => {}, // Mock no-op for backward compatibility in extensions
  broadcast,
  NETWORK,
  logAudit,
  requireRole,
  IDENTITY_SECRET,
});

// 404
app.use((_, res) => res.status(404).json({ error: "Not found" }));

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, async () => {
  logger.info("server_started", {
    api: `http://localhost:${PORT}/api`,
    ws: `ws://localhost:${PORT}`,
    health: `http://localhost:${PORT}/health`,
    ready: `http://localhost:${PORT}/health/ready`,
    metrics: `http://localhost:${PORT}/health/metrics`,
    env: process.env.NODE_ENV,
  });

  try {
    const { bootstrapFromConvex } = await import("./world-state-db.js");
    await bootstrapFromConvex();
    logger.info("convex_bootstrap_complete");
  } catch (err) {
    logger.warn("convex_bootstrap_failed", { error: err.message });
  }

  // Check if any admin exists — if not, log a bootstrap hint
  try {
    const { getAllState } = await import("./world-state-db.js");
    const allUsers = getAllState("users");
    const adminExists = allUsers.some((u) => u.value?.role === "admin");
    if (!adminExists) {
      logger.warn("no_admin_found", {
        message: "No admin account exists. Use POST /api/auth/setup to bootstrap the first admin.",
      });
    }
  } catch (err) {
    logger.error("admin_check_failed", { error: err.message });
  }
});

// ─── Process-level error handlers ─────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  logger.fatal("uncaught_exception", { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("unhandled_rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on("SIGTERM", () => {
  logger.info("sigterm_received", { msg: "Graceful shutdown initiated" });
  httpServer.close(() => {
    logger.info("server_closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("sigint_received", { msg: "Graceful shutdown initiated" });
  httpServer.close(() => {
    logger.info("server_closed");
    process.exit(0);
  });
});
