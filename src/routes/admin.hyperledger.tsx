import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { getLedger, getWorldState, submitHyperledgerTransaction, type Block, registerLedgerListener } from "@/lib/hyperledger";
import { Database, Cpu, Layers, RefreshCw, Send, CheckCircle, Clock, Key, ShieldCheck, Terminal, Search, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/hyperledger")({
  head: () => ({ meta: [{ title: "Hyperledger Console — Admin" }] }),
  component: HyperledgerConsolePage,
});

function HyperledgerConsolePage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [couchDb, setCouchDb] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<"blocks" | "couchdb" | "console">("blocks");
  const [searchKey, setSearchKey] = useState("");
  
  // Custom Transaction Proposal States
  const [chaincode, setChaincode] = useState("did-registry");
  const [fcn, setFcn] = useState("createDID");
  const [argsInput, setArgsInput] = useState("did:hosp:0x88fe, Dr. Sameer Khan");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Initial fetch
    setBlocks(getLedger());
    setCouchDb(getWorldState());

    // Register block updates listener
    registerLedgerListener((newBlock) => {
      setBlocks((prev) => [...prev, newBlock]);
      setCouchDb(getWorldState());
    });
  }, []);

  const handleCustomTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const parsedArgs = argsInput.split(",").map(arg => arg.trim());
    try {
      await submitHyperledgerTransaction(chaincode, fcn, parsedArgs);
      setArgsInput("");
      toast.success("Transaction committed to block log");
    } catch (err) {
      toast.error("Failed to commit transaction proposal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFilteredDbKeys = () => {
    return Object.keys(couchDb).filter(key => 
      key.toLowerCase().includes(searchKey.toLowerCase()) || 
      JSON.stringify(couchDb[key]).toLowerCase().includes(searchKey.toLowerCase())
    );
  };

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        
        <PageHeader
          eyebrow="Admin Console"
          title="Hyperledger Fabric Console & Database Resolver"
          description="Live CouchDB world state monitor, Raft ordering cluster tracker, and transactional peer validator."
        />

        {/* Node stats cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Endorsing Peers", value: "2 Nodes Active", sub: "Org1Peer0, Org2Peer0", status: "text-success", icon: ShieldCheck },
            { label: "Raft Ordering Service", value: "3 Nodes Consensus", sub: "raft-orderer-01a", status: "text-success", icon: Cpu },
            { label: "World State DB", value: "CouchDB v3.2.2", sub: "Ledger Key-Value Sync", status: "text-primary", icon: Database },
            { label: "Block Height", value: `Height: ${blocks.length}`, sub: "Chain height logged", status: "text-success", icon: Layers },
          ].map((stat, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-clinical space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-border text-xs font-semibold gap-4">
          {[
            { id: "blocks", label: "Ledger Blocks", icon: Layers },
            { id: "couchdb", label: "CouchDB World State", icon: Database },
            { id: "console", label: "Chaincode Sandbox", icon: Terminal }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-1.5 pb-2.5 px-1 border-b-2 transition-colors ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-4">

          {/* Left panel / Console options or state metrics */}
          <div className="lg:col-span-1 space-y-4">
            
            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-3">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1">
                <Cpu className="h-4 w-4 text-primary" /> Consensus Monitor
              </h3>
              <div className="space-y-3 text-xs">
                <div className="rounded-lg bg-muted/50 p-2.5 border border-border space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Orderer Raft Node:</span>
                    <span className="font-semibold text-success flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Running
                    </span>
                  </div>
                  <div className="h-1 w-full bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-success w-[90%]" />
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-2.5 border border-border space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Endorsement Policy:</span>
                    <span className="font-semibold text-foreground">AND(Org1, Org2)</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Transactions require endorsement from both Apollo Node and Registry Node before committing.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-clinical text-xs space-y-2">
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Peer Connection Info</span>
              <div className="font-mono space-y-1 text-muted-foreground text-[10px]">
                <div>GRPC: grpcs://peer0.org1.hosp:7051</div>
                <div>TLS CERT: /crypto/peer/tls/ca.crt</div>
                <div>CHANNEL: embrace-health-channel</div>
              </div>
            </div>

          </div>

          {/* Right main view content */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              
              {/* Blocks Explorer View */}
              {activeTab === "blocks" && (
                <motion.div
                  key="blocks"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Layers className="h-4.5 w-4.5 text-primary" /> Block Ledger Chain
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {blocks.slice().reverse().map((block) => (
                      <div key={block.blockNumber} className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-3 hover:border-primary/20 transition-colors">
                        <div className="flex items-center justify-between border-b border-border pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="bg-primary/10 text-primary text-xs font-bold rounded-lg px-2.5 py-1">
                              Block #{block.blockNumber}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Committed at {block.timestamp}
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-bold text-success border border-success/20">
                            <CheckCircle className="h-3 w-3" /> Validated Ledger
                          </span>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 text-xs font-mono">
                          <div>
                            <span className="text-[10px] text-muted-foreground block font-sans">Block Hash</span>
                            <span className="text-foreground text-[10px] break-all">{block.dataHash}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block font-sans">Prev Hash</span>
                            <span className="text-muted-foreground text-[10px] break-all">{block.previousHash}</span>
                          </div>
                        </div>

                        {/* Block Transactions */}
                        <div className="mt-3 bg-muted/40 rounded-lg p-3 border border-border">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Transaction Proposal Payload
                          </div>
                          {block.transactions.map((tx) => (
                            <div key={tx.txId} className="space-y-2 text-xs">
                              <div className="flex justify-between items-start flex-wrap gap-1">
                                <span className="font-bold text-foreground font-mono">{tx.txId}</span>
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary font-mono">
                                  CC: {tx.chaincode} {"->"} {tx.fcn}()
                                </span>
                              </div>
                              <div className="text-muted-foreground text-[11px]">
                                <span className="font-bold text-foreground font-sans">Parameters: </span>
                                <span className="font-mono">{JSON.stringify(tx.args)}</span>
                              </div>
                              <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap items-center mt-1 pt-1.5 border-t border-border/40">
                                <span className="font-sans font-bold">Endorsement Certs:</span>
                                {tx.endorsers.map((end, idx) => (
                                  <span key={idx} className="bg-muted px-1.5 py-0.5 rounded border border-border font-mono">{end}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* CouchDB Database Browser View */}
              {activeTab === "couchdb" && (
                <motion.div
                  key="couchdb"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <div className="rounded-xl border border-border bg-card p-4 shadow-clinical flex flex-col sm:flex-row items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Database className="h-4.5 w-4.5 text-primary" /> CouchDB World State StateDB
                    </h3>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 w-full sm:max-w-xs">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Query keys or state values..."
                        value={searchKey}
                        onChange={(e) => setSearchKey(e.target.value)}
                        className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card overflow-hidden shadow-clinical">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted text-muted-foreground uppercase font-bold tracking-wider">
                        <tr>
                          <th className="px-4 py-3">State Document Key</th>
                          <th className="px-4 py-3">JSON Value Document</th>
                          <th className="px-4 py-3 text-right">DB Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {getFilteredDbKeys().map((key) => (
                          <tr key={key} className="hover:bg-muted/30">
                            <td className="px-4 py-3.5 font-mono text-primary font-bold">{key}</td>
                            <td className="px-4 py-3.5">
                              <pre className="font-mono text-[10px] text-foreground bg-muted/65 p-2 rounded border border-border overflow-x-auto max-w-lg">
                                {JSON.stringify(couchDb[key], null, 2)}
                              </pre>
                            </td>
                            <td className="px-4 py-3.5 text-right font-sans text-muted-foreground">
                              <span className="inline-flex items-center gap-1 rounded bg-success/10 text-success text-[10px] px-1.5 py-0.5 font-bold">
                                Committed
                              </span>
                            </td>
                          </tr>
                        ))}

                        {getFilteredDbKeys().length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                              <Database className="h-10 w-10 mx-auto mb-2 opacity-30" />
                              CouchDB CouchState is empty. Execute transactions to populate the database.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* Chaincode Sandbox Console View */}
              {activeTab === "console" && (
                <motion.div
                  key="console"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Terminal className="h-4.5 w-4.5 text-primary" /> Chaincode Exec Console Sandbox
                  </h3>

                  <div className="rounded-xl border border-border bg-card p-5 shadow-clinical space-y-4">
                    <form onSubmit={handleCustomTransaction} className="space-y-4 text-xs">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1">
                          <label className="font-bold text-muted-foreground uppercase text-[10px]">Chaincode ID</label>
                          <select
                            value={chaincode}
                            onChange={(e) => setChaincode(e.target.value)}
                            className="w-full rounded-lg border border-border bg-card p-2 text-foreground outline-none"
                          >
                            <option value="did-registry">did-registry</option>
                            <option value="consent-manager">consent-manager</option>
                            <option value="billing">billing</option>
                            <option value="tracker">tracker</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-muted-foreground uppercase text-[10px]">Smart Contract Function</label>
                          <input
                            type="text"
                            value={fcn}
                            onChange={(e) => setFcn(e.target.value)}
                            className="w-full rounded-lg border border-border bg-card p-2 text-foreground outline-none"
                            placeholder="e.g. createDID"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-muted-foreground uppercase text-[10px]">Proposal Arguments (Comma Separated)</label>
                          <input
                            type="text"
                            value={argsInput}
                            onChange={(e) => setArgsInput(e.target.value)}
                            className="w-full rounded-lg border border-border bg-card p-2 text-foreground outline-none font-mono"
                            placeholder="did:hosp:0x88fe, Dr. Sameer"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 font-bold hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" /> {isSubmitting ? "Invoking Chaincode..." : "Submit Transaction Proposal"}
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>

      </div>
    </RouteGuard>
  );
}
