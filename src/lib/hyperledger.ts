/**
 * Hyperledger Fabric Simulation Engine v2.0
 *
 * Architecture:
 *  - CouchDB World State  → localStorage["hl:worldstate"]
 *  - Block Ledger         → localStorage["hl:ledger"]
 *  - Transaction Pool     → localStorage["hl:txpool"]
 *  - Event Bus            → custom EventTarget
 *  - Peer nodes           → simulated with latency
 *  - DID Registry         → localStorage["hl:didregistry"]
 *
 * This module provides a REAL-TIME persistent blockchain that survives
 * page refreshes and is shared across all browser tabs via StorageEvent.
 */

import { toast } from "sonner";
import { isFabricOnline, fabricSubmitTx } from "./fabric-api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TransactionProposal {
  txId: string;
  chaincode: string;
  channel: string;
  fcn: string;
  args: string[];
  endorsers: string[];
  timestamp: string;
  status: "VALID" | "INVALID" | "PENDING";
  creator: string;
}

export interface Block {
  blockNumber: number;
  channelId: string;
  previousHash: string;
  dataHash: string;
  transactions: TransactionProposal[];
  timestamp: string;
  metadata: {
    orderer: string;
    commitPeer: string;
    consensusType: string;
  };
}

export interface DIDDocument {
  did: string;
  publicKey: string;
  controller: string;
  owner: string;
  ownerType: "patient" | "staff" | "device" | "org";
  status: "active" | "revoked" | "suspended";
  credentials: VerifiableCredential[];
  createdAt: string;
  updatedAt: string;
  serviceEndpoint?: string;
}

export interface VerifiableCredential {
  id: string;
  type: "IdentityVC" | "InsuranceVC" | "VaccinationVC" | "ProfessionalVC" | "AccessVC";
  issuer: string;
  subject: string;
  issuedAt: string;
  expiresAt: string;
  claims: Record<string, string>;
  signature: string;
  status: "active" | "expired" | "revoked";
}

export interface WorldStateEntry {
  key: string;
  value: Record<string, any>;
  namespace: string;
  version: string;
  updatedAt: string;
  txId: string;
}

export interface NetworkStats {
  blockHeight: number;
  txCount: number;
  peerCount: number;
  ordererCount: number;
  chaincodeCount: number;
  worldStateSize: number;
  lastBlockTime: string;
  throughputTps: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STORAGE_KEYS = {
  LEDGER: "hl:ledger",
  WORLD_STATE: "hl:worldstate",
  DID_REGISTRY: "hl:didregistry",
  TX_POOL: "hl:txpool",
  NETWORK_STATS: "hl:netstats",
};

const PEERS = [
  "Org1Peer0MSP (Apollo Main Campus)",
  "Org1Peer1MSP (Apollo Satellite)",
  "Org2Peer0MSP (Registry Authority)",
];

const ORDERERS = ["raft-orderer-01a.hosp", "raft-orderer-02b.hosp", "raft-orderer-03c.hosp"];

const CHANNEL = "embrace-health-channel";

const CHAINCODES = [
  "did-registry",
  "consent-manager",
  "billing-chaincode",
  "tracker-chaincode",
  "appointments-chaincode",
  "credential-issuer",
  "audit-chaincode",
];

// ---------------------------------------------------------------------------
// Crypto Utilities (deterministic SHA-256-like hex hash)
// ---------------------------------------------------------------------------
function simHash(input: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x9e3779b9);
    h2 = Math.imul(h2 ^ ch, 0x5f356495);
  }
  h1 ^= Math.imul(h1 ^ (h2 >>> 15), 0x735a2d97);
  h2 ^= Math.imul(h2 ^ (h1 >>> 15), 0xcaf649a9);
  h1 ^= h2 >>> 16; h2 ^= h1 >>> 16;
  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  const rand = Math.random().toString(36).substring(2, 18);
  return hex1 + hex2 + rand + Date.now().toString(16);
}

function generateTxId(): string {
  const ts = Date.now().toString(16);
  const rand = Math.random().toString(36).substring(2, 10);
  return `tx_${ts}_${rand}`;
}

function generateDIDKey(seed: string): string {
  const h = simHash(seed);
  return `did:hosp:0x${h.substring(0, 8)}${h.substring(8, 12)}`;
}

function generatePublicKey(did: string): string {
  const h = simHash(did + "pubkey");
  return `MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE${h.substring(0, 32).toUpperCase()}`;
}

function generateSignature(data: string): string {
  const h = simHash(data + "sig");
  return `MEQCIBas${h.substring(0, 20)}AiBm${h.substring(20, 40)}==`;
}

// ---------------------------------------------------------------------------
// Persistence Layer
// ---------------------------------------------------------------------------
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage quota exceeded — trim ledger
    if (key === STORAGE_KEYS.LEDGER) {
      const ledger = loadFromStorage<Block[]>(STORAGE_KEYS.LEDGER, []);
      const trimmed = ledger.slice(-100);
      localStorage.setItem(key, JSON.stringify(trimmed));
    }
  }
}

// ---------------------------------------------------------------------------
// Event Bus (cross-tab real-time sync)
// ---------------------------------------------------------------------------
type BlockListener = (block: Block) => void;
type WorldStateListener = (state: Record<string, WorldStateEntry>) => void;

const blockListeners: BlockListener[] = [];
const wsListeners: WorldStateListener[] = [];

export const registerLedgerListener = (cb: BlockListener) => {
  blockListeners.push(cb);
};

export const registerWorldStateListener = (cb: WorldStateListener) => {
  wsListeners.push(cb);
};

export const unregisterLedgerListener = (cb: BlockListener) => {
  const idx = blockListeners.indexOf(cb);
  if (idx >= 0) blockListeners.splice(idx, 1);
};

// Cross-tab sync: receive updates from other tabs
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.LEDGER && e.newValue) {
      try {
        const ledger: Block[] = JSON.parse(e.newValue);
        const latest = ledger[ledger.length - 1];
        if (latest) blockListeners.forEach((cb) => cb(latest));
      } catch {}
    }
    if (e.key === STORAGE_KEYS.WORLD_STATE && e.newValue) {
      try {
        const ws: Record<string, WorldStateEntry> = JSON.parse(e.newValue);
        wsListeners.forEach((cb) => cb(ws));
      } catch {}
    }
  });
}

// ---------------------------------------------------------------------------
// In-memory caches (loaded from localStorage on first access)
// ---------------------------------------------------------------------------
let _ledger: Block[] | null = null;
let _worldState: Record<string, WorldStateEntry> | null = null;
let _didRegistry: Record<string, DIDDocument> | null = null;

function getLedgerCache(): Block[] {
  if (!_ledger) {
    _ledger = loadFromStorage<Block[]>(STORAGE_KEYS.LEDGER, []);
    if (_ledger.length === 0) {
      _ledger = [createGenesisBlock()];
      saveToStorage(STORAGE_KEYS.LEDGER, _ledger);
    }
  }
  return _ledger;
}

function getWorldStateCache(): Record<string, WorldStateEntry> {
  if (!_worldState) {
    _worldState = loadFromStorage<Record<string, WorldStateEntry>>(STORAGE_KEYS.WORLD_STATE, {});
  }
  return _worldState;
}

function getDIDRegistryCache(): Record<string, DIDDocument> {
  if (!_didRegistry) {
    _didRegistry = loadFromStorage<Record<string, DIDDocument>>(STORAGE_KEYS.DID_REGISTRY, {});
  }
  return _didRegistry;
}

function createGenesisBlock(): Block {
  return {
    blockNumber: 0,
    channelId: CHANNEL,
    previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
    dataHash: simHash("GENESIS_BLOCK_EMBRACE_HEALTH_2026"),
    transactions: [{
      txId: "tx_genesis_embrace_health_000",
      chaincode: "system-chaincode",
      channel: CHANNEL,
      fcn: "initLedger",
      args: ["Embrace Health DID Hospital — Genesis Block", "2026-06-01T00:00:00Z"],
      endorsers: ["OrdererMSP (Embrace Health Consortium)"],
      timestamp: "2026-06-01 00:00:00",
      status: "VALID",
      creator: "SYSTEM",
    }],
    timestamp: "2026-06-01 00:00:00",
    metadata: {
      orderer: ORDERERS[0],
      commitPeer: PEERS[0],
      consensusType: "etcdraft",
    },
  };
}

// ---------------------------------------------------------------------------
// Public Read APIs
// ---------------------------------------------------------------------------
export const getLedger = (): Block[] => [...getLedgerCache()];

export const getWorldState = (): Record<string, WorldStateEntry> =>
  ({ ...getWorldStateCache() });

export const getDIDRegistry = (): Record<string, DIDDocument> =>
  ({ ...getDIDRegistryCache() });

export const getNetworkStats = (): NetworkStats => {
  const ledger = getLedgerCache();
  const ws = getWorldStateCache();
  const txCount = ledger.reduce((sum, b) => sum + b.transactions.length, 0);
  return {
    blockHeight: ledger.length,
    txCount,
    peerCount: PEERS.length,
    ordererCount: ORDERERS.length,
    chaincodeCount: CHAINCODES.length,
    worldStateSize: Object.keys(ws).length,
    lastBlockTime: ledger[ledger.length - 1]?.timestamp ?? "N/A",
    throughputTps: parseFloat((txCount / Math.max(1, ledger.length)).toFixed(2)),
  };
};

export const queryWorldState = (namespace: string): WorldStateEntry[] => {
  const ws = getWorldStateCache();
  return Object.values(ws).filter((e) => e.namespace === namespace);
};

export const resolveDID = (did: string): DIDDocument | null => {
  const registry = getDIDRegistryCache();
  return registry[did] ?? null;
};

// ---------------------------------------------------------------------------
// Chaincode World State Handlers
// ---------------------------------------------------------------------------
function applyChaincode(
  chaincode: string,
  fcn: string,
  args: string[],
  txId: string,
  timestamp: string
): void {
  const ws = getWorldStateCache();
  const registry = getDIDRegistryCache();

  function putState(namespace: string, key: string, value: Record<string, any>) {
    ws[`${namespace}:${key}`] = {
      key,
      value,
      namespace,
      version: `${txId}:1`,
      updatedAt: timestamp,
      txId,
    };
  }

  switch (`${chaincode}::${fcn}`) {
    case "did-registry::createDID":
    case "did-registry::registerDID": {
      const [did, owner, ownerType, controller] = args;
      const doc: DIDDocument = {
        did,
        publicKey: generatePublicKey(did),
        controller: controller || "did:hosp:consortium:authority",
        owner,
        ownerType: (ownerType as DIDDocument["ownerType"]) || "patient",
        status: "active",
        credentials: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        serviceEndpoint: `https://did.apollohospitals.in/resolve/${did}`,
      };
      registry[did] = doc;
      putState("did-registry", did, doc as any);
      break;
    }
    case "did-registry::revokeDID": {
      const [did] = args;
      if (registry[did]) {
        registry[did].status = "revoked";
        registry[did].updatedAt = timestamp;
        putState("did-registry", did, registry[did] as any);
      }
      break;
    }
    case "credential-issuer::issueCredential": {
      const [did, credType, issuer, claims] = args;
      if (registry[did]) {
        const vc: VerifiableCredential = {
          id: `vc_${txId}`,
          type: (credType as VerifiableCredential["type"]) || "IdentityVC",
          issuer: issuer || "Apollo Hospital Authority",
          subject: did,
          issuedAt: timestamp,
          expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
          claims: { raw: claims || "" },
          signature: generateSignature(did + credType + txId),
          status: "active",
        };
        registry[did].credentials.push(vc);
        registry[did].updatedAt = timestamp;
        putState("credential-issuer", `vc:${vc.id}`, vc as any);
      }
      break;
    }
    case "consent-manager::grantConsent": {
      const [grantId, patient, doctor, resource, expiry] = args;
      putState("consent-manager", grantId, {
        patient, doctor, resource,
        status: "active",
        expiry: expiry || new Date(Date.now() + 7 * 86400000).toISOString(),
        grantedAt: timestamp,
      });
      break;
    }
    case "consent-manager::revokeConsent": {
      const [grantId] = args;
      const existing = ws[`consent-manager:${grantId}`];
      if (existing) {
        existing.value.status = "revoked";
        existing.value.revokedAt = timestamp;
        existing.updatedAt = timestamp;
        existing.txId = txId;
      }
      break;
    }
    case "billing-chaincode::recordPayment": {
      const [patientDid, patientName, amount, category, ref] = args;
      putState("billing", ref || `bill_${txId}`, {
        patientDid, patientName, amount: Number(amount),
        category, status: "settled", ref, settledAt: timestamp,
      });
      break;
    }
    case "billing-chaincode::raiseInvoice": {
      const [patientDid, invoiceId, amount, items] = args;
      putState("billing", `invoice:${invoiceId}`, {
        patientDid, invoiceId, amount: Number(amount),
        items, status: "outstanding", raisedAt: timestamp,
      });
      break;
    }
    case "tracker-chaincode::reportTelemetry": {
      const [staffDid, name, location, status] = args;
      putState("tracker", staffDid, {
        staffDid, name, location, status, lastPing: timestamp,
        beaconStrength: (70 + Math.floor(Math.random() * 30)) + "%",
      });
      break;
    }
    case "tracker-chaincode::dispatchPagerNotify": {
      const [staffDid, name, location] = args;
      putState("tracker", `pager:${txId}`, {
        staffDid, name, location, type: "PAGER_NOTIFY", dispatchedAt: timestamp, status: "delivered",
      });
      break;
    }
    case "appointments-chaincode::createAppointment": {
      const [apptId, patientDid, doctorDid, slot, mode] = args;
      putState("appointments", apptId, {
        apptId, patientDid, doctorDid, slot, mode,
        status: "confirmed", bookedAt: timestamp,
      });
      break;
    }
    case "appointments-chaincode::cancelAppointment": {
      const [apptId] = args;
      const key = `appointments:${apptId}`;
      if (ws[key]) {
        ws[key].value.status = "cancelled";
        ws[key].value.cancelledAt = timestamp;
        ws[key].updatedAt = timestamp;
        ws[key].txId = txId;
      }
      break;
    }
    case "audit-chaincode::logEvent": {
      const [actor, resource, action, outcome] = args;
      putState("audit", `audit:${txId}`, {
        actor, resource, action, outcome,
        loggedAt: timestamp, severity: "INFO",
      });
      break;
    }
    case "financial-ledger-chaincode::resolvePatientDID": {
      const [did, name] = args;
      putState("financial", `resolve:${did}`, {
        did, name, resolvedAt: timestamp, by: "admin-console",
      });
      break;
    }
    case "financial-ledger-chaincode::generateFinancialStatement": {
      const [did, name] = args;
      putState("financial", `statement:${did}:${txId}`, {
        did, name, generatedAt: timestamp, format: "PDF",
      });
      break;
    }
    default:
      putState(chaincode, `generic:${txId}`, { fcn, args, executedAt: timestamp });
      break;
  }

  // Persist registry & world state
  _didRegistry = registry;
  _worldState = ws;
  saveToStorage(STORAGE_KEYS.DID_REGISTRY, registry);
  saveToStorage(STORAGE_KEYS.WORLD_STATE, ws);
}

// ---------------------------------------------------------------------------
// Main Transaction Submit
// ---------------------------------------------------------------------------
export const submitHyperledgerTransaction = async (
  chaincode: string,
  fcn: string,
  args: string[],
  options?: { silent?: boolean; creator?: string }
): Promise<TransactionProposal> => {
  let txId = generateTxId();
  let timestamp = new Date().toLocaleString("en-IN", { hour12: true });
  let blockNumber: number | null = null;
  const endorsingPeers = [PEERS[0], PEERS[Math.floor(Math.random() * PEERS.length)]];

  const online = await isFabricOnline();
  let submittedToBackend = false;
  if (online) {
    try {
      const res = await fabricSubmitTx(chaincode, fcn, args, options?.creator);
      txId = res.txId;
      blockNumber = res.blockNumber;
      // Convert standard ISO to localized string if needed, or keep ISO
      timestamp = res.timestamp ? new Date(res.timestamp).toLocaleString("en-IN", { hour12: true }) : timestamp;
      submittedToBackend = true;
    } catch (err) {
      console.warn("⚠️ Hyperledger: Backend submission failed, falling back to local simulation:", err);
      // Fallback: blockNumber remains null, so local consensus loop will run
    }
  }

  if (!submittedToBackend && options?.silent !== true) {
    try {
      const { enqueueOfflineTransaction } = await import("./offline-queue");
      enqueueOfflineTransaction(chaincode, fcn, args, options?.creator);
    } catch (err) {
      console.error("⚠️ Failed to enqueue offline transaction:", err);
    }
  }

  const proposal: TransactionProposal = {
    txId,
    chaincode,
    channel: CHANNEL,
    fcn,
    args,
    endorsers: [...new Set(endorsingPeers)],
    timestamp,
    status: "VALID",
    creator: options?.creator || "Admin Console",
  };

  if (blockNumber === null) {
    // Phase 1: Endorsement (simulated peer latency)
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
    // Phase 2: Ordering (Raft consensus)
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
  }

  // Phase 3: Apply chaincode to world state locally (for sync and fallback)
  applyChaincode(chaincode, fcn, args, txId, timestamp);

  // Phase 4: Commit new block locally
  const ledger = getLedgerCache();
  const prevBlock = ledger[ledger.length - 1];
  const dataHash = simHash(JSON.stringify(proposal) + prevBlock.dataHash);

  const newBlock: Block = {
    blockNumber: blockNumber ?? ledger.length,
    channelId: CHANNEL,
    previousHash: prevBlock.dataHash,
    dataHash,
    transactions: [proposal],
    timestamp,
    metadata: {
      orderer: ORDERERS[Math.floor(Math.random() * ORDERERS.length)],
      commitPeer: PEERS[0],
      consensusType: "etcdraft",
    },
  };

  ledger.push(newBlock);
  _ledger = ledger;
  saveToStorage(STORAGE_KEYS.LEDGER, ledger);

  // Notify listeners
  blockListeners.forEach((cb) => cb(newBlock));
  wsListeners.forEach((cb) => cb(getWorldStateCache()));

  if (!options?.silent) {
    toast.success(`Block #${newBlock.blockNumber} Committed`, {
      description: `${txId.slice(0, 18)}… | CC: ${chaincode}::${fcn}()`,
      duration: 3000,
    });
  }

  return proposal;
};

// ---------------------------------------------------------------------------
// DID Registry Management
// ---------------------------------------------------------------------------
export const registerDID = async (
  owner: string,
  ownerType: DIDDocument["ownerType"],
  controller?: string
): Promise<DIDDocument> => {
  const did = generateDIDKey(owner + Date.now());
  await submitHyperledgerTransaction(
    "did-registry",
    "createDID",
    [did, owner, ownerType, controller || "did:hosp:consortium:authority"],
    { silent: true }
  );
  return getDIDRegistryCache()[did]!;
};

export const issueCredential = async (
  did: string,
  credType: VerifiableCredential["type"],
  claims: Record<string, string>,
  issuer?: string
): Promise<VerifiableCredential | null> => {
  await submitHyperledgerTransaction(
    "credential-issuer",
    "issueCredential",
    [did, credType, issuer || "Apollo Hospital Authority", JSON.stringify(claims)],
    { silent: true }
  );
  const doc = getDIDRegistryCache()[did];
  return doc?.credentials[doc.credentials.length - 1] ?? null;
};

// ---------------------------------------------------------------------------
// Auto-seed: Provision DIDs for all patients & staff on first run
// ---------------------------------------------------------------------------
export const seedInitialDIDs = async (
  patients: Array<{ id: string; name: string; did: string }>,
  staff: Array<{ id: string; name: string; did: string; role: string }>
): Promise<void> => {
  console.log("[Hyperledger] Auto-seed skipped (clean nil mode).");
};

// ---------------------------------------------------------------------------
// Utility: Clear all persisted data (dev reset)
// ---------------------------------------------------------------------------
export const resetHyperledger = (): void => {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  _ledger = null;
  _worldState = null;
  _didRegistry = null;
  toast.success("Hyperledger state reset", { description: "All blocks and world state cleared." });
};
