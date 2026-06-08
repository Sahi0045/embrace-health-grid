import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import {
  getLedger, getWorldState, getNetworkStats, getDIDRegistry,
  submitHyperledgerTransaction, resetHyperledger, resolveDID,
  registerLedgerListener, registerWorldStateListener, unregisterLedgerListener,
  type Block, type WorldStateEntry, type NetworkStats, type DIDDocument,
} from "@/lib/hyperledger";
import { Database, Cpu, Layers, Send, CheckCircle, Clock, ShieldCheck, Terminal, Search, RefreshCw, Trash2, Activity, Key, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/hyperledger")({
  head: () => ({ meta: [{ title: "Hyperledger Console — Admin" }] }),
  component: HyperledgerConsolePage,
});

type Tab = "blocks" | "couchdb" | "did" | "console";

function HyperledgerConsolePage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [worldState, setWorldState] = useState<Record<string, WorldStateEntry>>({});
  const [didRegistry, setDidRegistry] = useState<Record<string, DIDDocument>>({});
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("blocks");
  const [searchKey, setSearchKey] = useState("");
  const [didQuery, setDidQuery] = useState("");
  const [resolvedDID, setResolvedDID] = useState<DIDDocument | null>(null);
  const [chaincode, setChaincode] = useState("did-registry");
  const [fcn, setFcn] = useState("createDID");
  const [argsInput, setArgsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());

  const refresh = useCallback(() => {
    setBlocks(getLedger());
    setWorldState(getWorldState());
    setDidRegistry(getDIDRegistry());
    setStats(getNetworkStats());
    setLastUpdate(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    refresh();

    const blockCb = (block: Block) => {
      setBlocks((p) => [...p, block]);
      setStats(getNetworkStats());
      setLastUpdate(new Date().toLocaleTimeString());
    };
    const wsCb = (ws: Record<string, WorldStateEntry>) => {
      setWorldState({ ...ws });
      setDidRegistry(getDIDRegistry());
    };

    registerLedgerListener(blockCb);
    registerWorldStateListener(wsCb);

    // Poll every 3s for cross-tab updates
    const poll = setInterval(refresh, 3000);
    return () => {
      unregisterLedgerListener(blockCb);
      clearInterval(poll);
    };
  }, [refresh]);

  const handleSubmitTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const args = argsInput.split(",").map((a) => a.trim()).filter(Boolean);
      await submitHyperledgerTransaction(chaincode, fcn, args);
      setArgsInput("");
      refresh();
    } catch {
      toast.error("Transaction failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveDID = () => {
    const doc = resolveDID(didQuery.trim());
    if (doc) setResolvedDID(doc);
    else toast.error("DID not found in registry");
  };

  const filteredWsKeys = Object.keys(worldState).filter(
    (k) => k.toLowerCase().includes(searchKey.toLowerCase()) ||
      JSON.stringify(worldState[k]).toLowerCase().includes(searchKey.toLowerCase())
  );

  const filteredDIDs = Object.keys(didRegistry).filter(
    (k) => k.toLowerCase().includes(searchKey.toLowerCase()) ||
      didRegistry[k].owner.toLowerCase().includes(searchKey.toLowerCase())
  );

  const tabs: { id: Tab; label: string; icon: typeof Layers; count?: number }[] = [
    { id: "blocks", label: "Ledger Blocks", icon: Layers, count: blocks.length },
    { id: "couchdb", label: "CouchDB World State", icon: Database, count: Object.keys(worldState).length },
    { id: "did", label: "DID Registry", icon: Key, count: Object.keys(didRegistry).length },
    { id: "console", label: "Chaincode Sandbox", icon: Terminal },
  ];

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        <div className="flex items-start justify-between flex-wrap gap-3">
          <PageHeader
            eyebrow="Hyperledger Fabric — embrace-health-channel"
            title="Blockchain Console & Live Database"
            description="Real-time block explorer, CouchDB world state browser, DID registry, and chaincode execution sandbox."
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-muted-foreground font-mono">Updated: {lastUpdate}</span>
            <button onClick={refresh} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button onClick={() => { resetHyperledger(); refresh(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20">
              <Trash2 className="h-3.5 w-3.5" /> Reset Chain
            </button>
          </div>
        </div>

        {/* Live Network Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[
              { label: "Block Height", value: stats.blockHeight, icon: Layers, color: "text-primary" },
              { label: "Transactions", value: stats.txCount, icon: Activity, color: "text-success" },
              { label: "DID Records", value: Object.keys(didRegistry).length, icon: Key, color: "text-primary" },
              { label: "World State Keys", value: stats.worldStateSize, icon: Database, color: "text-warning-foreground" },
              { label: "Peer Nodes", value: stats.peerCount, icon: Globe, color: "text-success" },
              { label: "Orderer Nodes", value: stats.ordererCount, icon: Cpu, color: "text-success" },
              { label: "Chaincodes", value: stats.chaincodeCount, icon: ShieldCheck, color: "text-primary" },
            ].map((s, i) => (
              <div key={i} className="rounded-xl border border-border bg-card px-4 py-3 shadow-clinical flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
                  <div className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value}</div>
                </div>
                <s.icon className={`h-5 w-5 ${s.color} opacity-60`} />
              </div>
            ))}
          </div>
        )}

        {/* Peer Status Row */}
        <div className="flex gap-3 flex-wrap">
          {[
            { name: "Org1Peer0MSP (Apollo Main)", status: "Running" },
            { name: "Org1Peer1MSP (Apollo Satellite)", status: "Running" },
            { name: "Org2Peer0MSP (Registry Authority)", status: "Running" },
            { name: "raft-orderer-01a.hosp", status: "Leader" },
            { name: "raft-orderer-02b.hosp", status: "Follower" },
            { name: "raft-orderer-03c.hosp", status: "Follower" },
          ].map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[10px] font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span className="font-semibold text-foreground">{p.name}</span>
              <span className="text-muted-foreground">· {p.status}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border gap-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${activeTab === t.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search bar for DB tabs */}
        {(activeTab === "couchdb" || activeTab === "did") && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={searchKey} onChange={(e) => setSearchKey(e.target.value)}
              placeholder={activeTab === "did" ? "Search DID or owner…" : "Search key or value…"}
              className="bg-transparent text-xs outline-none w-full text-foreground placeholder:text-muted-foreground" />
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── Ledger Blocks ── */}
          {activeTab === "blocks" && (
            <motion.div key="blocks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              {blocks.length === 0 && (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                  <Layers className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  No blocks yet. Submit a transaction to create the first block.
                </div>
              )}
              {[...blocks].reverse().map((block) => (
                <div key={block.blockNumber} className="rounded-xl border border-border bg-card p-5 shadow-clinical hover:border-primary/20 transition-colors space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-primary/10 text-primary font-black text-sm rounded-lg px-3 py-1">Block #{block.blockNumber}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{block.timestamp}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">CH: {block.channelId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">via {block.metadata.orderer}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/20 px-2 py-0.5 text-[9px] font-bold text-success">
                        <CheckCircle className="h-3 w-3" /> VALID
                      </span>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 font-mono text-[10px]">
                    <div><span className="text-muted-foreground font-sans">Data Hash: </span><span className="text-foreground break-all">{block.dataHash}</span></div>
                    <div><span className="text-muted-foreground font-sans">Prev Hash: </span><span className="text-muted-foreground break-all">{block.previousHash}</span></div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 border border-border space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Transactions ({block.transactions.length})
                    </div>
                    {block.transactions.map((tx) => (
                      <div key={tx.txId} className="text-xs space-y-1 pt-1 border-t border-border/40 first:border-0 first:pt-0">
                        <div className="flex justify-between flex-wrap gap-1">
                          <span className="font-mono font-bold text-foreground">{tx.txId}</span>
                          <span className="font-mono rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[9px]">
                            {tx.chaincode}::{tx.fcn}()
                          </span>
                        </div>
                        <div className="text-muted-foreground font-mono text-[10px]">Args: {JSON.stringify(tx.args)}</div>
                        <div className="flex gap-1 flex-wrap">
                          {tx.endorsers.map((e, i) => (
                            <span key={i} className="bg-muted border border-border rounded px-1.5 py-0.5 text-[9px] font-mono">{e}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* ── CouchDB World State ── */}
          {activeTab === "couchdb" && (
            <motion.div key="couchdb" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-clinical">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Namespace:Key</th>
                      <th className="px-4 py-3">JSON State Document</th>
                      <th className="px-4 py-3">Tx Version</th>
                      <th className="px-4 py-3">Updated At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredWsKeys.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                        <Database className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        World State empty — submit transactions to populate.
                      </td></tr>
                    )}
                    {filteredWsKeys.map((k) => {
                      const entry = worldState[k];
                      return (
                        <tr key={k} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-primary font-bold break-all max-w-[180px]">{k}</td>
                          <td className="px-4 py-3">
                            <pre className="font-mono text-[9px] bg-muted/60 p-2 rounded border border-border overflow-x-auto max-w-xs">{JSON.stringify(entry.value, null, 2)}</pre>
                          </td>
                          <td className="px-4 py-3 font-mono text-[9px] text-muted-foreground">{entry.version}</td>
                          <td className="px-4 py-3 text-[10px] text-muted-foreground">{entry.updatedAt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ── DID Registry ── */}
          {activeTab === "did" && (
            <motion.div key="did" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* DID resolver */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Key className="h-4 w-4 text-primary" /> DID Resolver</h3>
                <div className="flex gap-2">
                  <input value={didQuery} onChange={(e) => setDidQuery(e.target.value)}
                    placeholder="did:hosp:0x…"
                    className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-mono text-foreground outline-none" />
                  <button onClick={handleResolveDID} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:bg-primary/90">
                    Resolve
                  </button>
                </div>
                {resolvedDID && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary">{resolvedDID.did}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${resolvedDID.status === "active" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                        {resolvedDID.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2">
                      <div><span className="text-muted-foreground">Owner:</span><p className="font-semibold mt-0.5">{resolvedDID.owner}</p></div>
                      <div><span className="text-muted-foreground">Type:</span><p className="font-semibold mt-0.5 capitalize">{resolvedDID.ownerType}</p></div>
                      <div><span className="text-muted-foreground">Created:</span><p className="font-semibold mt-0.5">{resolvedDID.createdAt}</p></div>
                    </div>
                    <div><span className="text-muted-foreground">Public Key:</span><p className="font-mono text-[9px] break-all mt-0.5 bg-muted p-1.5 rounded">{resolvedDID.publicKey}</p></div>
                    <div>
                      <span className="text-muted-foreground font-bold">Verifiable Credentials ({resolvedDID.credentials.length})</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {resolvedDID.credentials.map((vc) => (
                          <span key={vc.id} className={`rounded-full px-2 py-0.5 text-[9px] font-bold border ${vc.status === "active" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}`}>
                            {vc.type}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* DID Table */}
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-clinical">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">DID</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Credentials</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredDIDs.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No DID records found. Store is initializing…</td></tr>
                    )}
                    {filteredDIDs.slice(0, 50).map((did) => {
                      const doc = didRegistry[did];
                      return (
                        <tr key={did} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setDidQuery(did); setResolvedDID(doc); setActiveTab("did"); }}>
                          <td className="px-4 py-3 font-mono text-primary text-[10px] font-bold max-w-[160px] truncate">{did}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{doc.owner}</td>
                          <td className="px-4 py-3 capitalize text-muted-foreground">{doc.ownerType}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${doc.status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                              {doc.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{doc.credentials.length} VC{doc.credentials.length !== 1 ? "s" : ""}</td>
                          <td className="px-4 py-3 text-[10px] text-muted-foreground">{doc.createdAt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ── Chaincode Sandbox ── */}
          {activeTab === "console" && (
            <motion.div key="console" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-6 shadow-clinical space-y-5">
                <h3 className="text-sm font-bold flex items-center gap-2"><Terminal className="h-4 w-4 text-primary" /> Execute Chaincode Transaction</h3>
                <form onSubmit={handleSubmitTx} className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="font-bold text-muted-foreground uppercase text-[10px]">Chaincode</label>
                      <select value={chaincode} onChange={(e) => setChaincode(e.target.value)}
                        className="w-full rounded-lg border border-border bg-muted/40 p-2.5 text-foreground outline-none">
                        <option>did-registry</option>
                        <option>consent-manager</option>
                        <option>billing-chaincode</option>
                        <option>tracker-chaincode</option>
                        <option>appointments-chaincode</option>
                        <option>credential-issuer</option>
                        <option>audit-chaincode</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-muted-foreground uppercase text-[10px]">Function</label>
                      <input value={fcn} onChange={(e) => setFcn(e.target.value)}
                        className="w-full rounded-lg border border-border bg-muted/40 p-2.5 text-foreground outline-none font-mono"
                        placeholder="e.g. createDID" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-muted-foreground uppercase text-[10px]">Args (comma-separated)</label>
                      <input value={argsInput} onChange={(e) => setArgsInput(e.target.value)}
                        className="w-full rounded-lg border border-border bg-muted/40 p-2.5 text-foreground outline-none font-mono"
                        placeholder="arg1, arg2, arg3" />
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
                    <Send className="h-4 w-4" />
                    {isSubmitting ? "Endorsing… Ordering… Committing…" : "Submit Transaction Proposal"}
                  </button>
                </form>

                {/* Quick-fire presets */}
                <div className="border-t border-border pt-4 space-y-2">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Quick Presets</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Register Patient DID", cc: "did-registry", fn: "createDID", args: "did:hosp:0xabc123, John Doe, patient, did:hosp:consortium" },
                      { label: "Grant Consent", cc: "consent-manager", fn: "grantConsent", args: "GRANT-001, did:hosp:patient1, did:hosp:doctor1, MedicalRecords" },
                      { label: "Record Payment", cc: "billing-chaincode", fn: "recordPayment", args: "did:hosp:pat1, Jane Smith, 4500, consultation, REF-123" },
                      { label: "Log Audit", cc: "audit-chaincode", fn: "logEvent", args: "Admin, Records, READ, SUCCESS" },
                    ].map((p) => (
                      <button key={p.label}
                        onClick={() => { setChaincode(p.cc); setFcn(p.fn); setArgsInput(p.args); }}
                        className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-[10px] font-semibold hover:bg-muted transition-colors">
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </RouteGuard>
  );
}
