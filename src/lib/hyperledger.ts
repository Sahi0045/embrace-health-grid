import { toast } from "sonner";

export interface TransactionProposal {
  txId: string;
  chaincode: string;
  fcn: string;
  args: string[];
  endorsers: string[];
  timestamp: string;
}

export interface Block {
  blockNumber: number;
  previousHash: string;
  dataHash: string;
  transactions: TransactionProposal[];
  timestamp: string;
}

// In-Memory CouchDB (World State)
const worldState: Record<string, any> = {};

// In-Memory Block Ledger starting with Genesis Block
const ledger: Block[] = [
  {
    blockNumber: 0,
    previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
    dataHash: "8582d0016e788bc5ee3f4bb01a75f8f8f2db63200ff3d2bfa12aa31e98d9ba02",
    transactions: [
      {
        txId: "tx_genesis_000",
        chaincode: "did-registry",
        fcn: "initLedger",
        args: ["Genesis Block Initiated"],
        endorsers: ["OrdererMSP"],
        timestamp: "2026-06-01 00:00:00"
      }
    ],
    timestamp: "2026-06-01 00:00:00"
  }
];

// Listeners for block updates
const listeners: ((block: Block) => void)[] = [];

export const registerLedgerListener = (callback: (block: Block) => void) => {
  listeners.push(callback);
};

export const getLedger = (): Block[] => [...ledger];
export const getWorldState = (): Record<string, any> => ({ ...worldState });

// Simulate Hyperledger Fabric Transaction Lifecycle: Endorse -> Order -> Commit
export const submitHyperledgerTransaction = async (
  chaincode: string,
  fcn: string,
  args: string[]
): Promise<TransactionProposal> => {
  // Phase 1: Endorsement
  const txId = "tx_" + Math.random().toString(36).substring(2, 15);
  const endorsers = ["Org1Peer0MSP (Apollo Hospital)", "Org2Peer0MSP (Registry Node)"];
  const timestamp = new Date().toLocaleTimeString();

  const proposal: TransactionProposal = {
    txId,
    chaincode,
    fcn,
    args,
    endorsers,
    timestamp
  };

  // Phase 2: Ordering (Raft Consensus Simulation)
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Phase 3: Validation and Commitment
  // Update CouchDB World State
  if (chaincode === "did-registry" && fcn === "createDID") {
    const [did, owner] = args;
    worldState[did] = { owner, status: "active", verifiedAt: timestamp };
  } else if (chaincode === "consent-manager" && fcn === "grantConsent") {
    const [grantId, patient, doctor, reason] = args;
    worldState[grantId] = { patient, doctor, reason, status: "active" };
  } else if (chaincode === "billing" && fcn === "recordPayment") {
    const [txHash, patientName, amount, category] = args;
    worldState[txHash] = { patientName, amount, category, status: "settled" };
  } else if (chaincode === "tracker" && fcn === "reportTelemetry") {
    const [docId, location, status] = args;
    worldState[docId] = { location, status, lastPing: timestamp };
  }

  // Create new Block
  const blockNumber = ledger.length;
  const previousBlock = ledger[ledger.length - 1];
  
  // Calculate simulated SHA-256 data hashes
  const dataHash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  const newBlock: Block = {
    blockNumber,
    previousHash: previousBlock.dataHash,
    dataHash,
    transactions: [proposal],
    timestamp: new Date().toLocaleTimeString()
  };

  ledger.push(newBlock);

  // Trigger Listeners
  listeners.forEach((callback) => callback(newBlock));

  // Broadcast to Client
  toast.success(`Hyperledger Block #${blockNumber} Committed`, {
    description: `Tx: ${txId.substring(0, 10)}... | Chaincode: ${chaincode} | Endorsed by 2 Peers`,
  });

  return proposal;
};
