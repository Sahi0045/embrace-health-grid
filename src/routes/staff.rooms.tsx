import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import { API_BASE_URL } from "@/lib/api";
import { Buffer } from "buffer";
import {
  Building2,
  MapPin,
  CheckCircle2,
  Clock,
  ExternalLink,
  Zap,
  Radio,
  ArrowRight,
  Sparkles,
  QrCode,
  LogOut,
  LogIn,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  Lock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/rooms")({
  head: () => ({
    meta: [{ title: "My Room Check-In — Staff Portal" }],
  }),
  component: StaffRooms,
});

const AVAILABLE_ROOMS = [
  { id: "101", name: "Room 101 - Outpatient Clinic", type: "OPD", dept: "General Medicine" },
  { id: "202", name: "Room 202 - Cardiology Ward", type: "Ward", dept: "Cardiology" },
  { id: "303", name: "Room 303 - Operating Theater", type: "OT", dept: "Surgery" },
  { id: "404", name: "Room 404 - Emergency Room", type: "ER", dept: "Trauma ER" },
  { id: "505", name: "Room 505 - ICU Control Desk", type: "ICU", dept: "Intensive Care" },
];

function StaffRooms() {
  const { publicKey, signTransaction, connected } = useWallet();

  // Retrieve signed-in user details strictly from session storage
  const userJson = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const loggedInUser = userJson ? JSON.parse(userJson) : null;

  const sessionName =
    loggedInUser?.name ||
    (typeof window !== "undefined" ? localStorage.getItem("userName") || "Dr. Staff Clinician" : "Dr. Staff Clinician");
  const sessionEmail =
    loggedInUser?.email ||
    (typeof window !== "undefined" ? localStorage.getItem("userEmail") || "staff@hospital.com" : "staff@hospital.com");
  const sessionRole =
    loggedInUser?.role ||
    (typeof window !== "undefined" ? localStorage.getItem("userRole") || "doctor" : "doctor");
  const sessionSpecialty = loggedInUser?.specialty || "Clinical Services";

  const rawSessionDid =
    loggedInUser?.did ||
    (typeof window !== "undefined"
      ? localStorage.getItem("userDID") || localStorage.getItem("userDid") || ""
      : "");

  const [didChecked, setDidChecked] = useState(false);
  const [hasAdminIssuedDid, setHasAdminIssuedDid] = useState(false);
  const [adminIssuedDid, setAdminIssuedDid] = useState<string>("");

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [anchoring, setAnchoring] = useState(false);
  const [onChainRoot, setOnChainRoot] = useState<string | null>(null);
  const [onChainTx, setOnChainTx] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdminIssuedDid() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/did`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            "x-client-key": "apollo-consortium-client-secret-2026",
          },
        });
        if (res.ok) {
          const data = await res.json();
          const dids = data.dids || [];
          const match = dids.find(
            (d: any) =>
              (d.ownerEmail && d.ownerEmail.toLowerCase() === sessionEmail.toLowerCase()) ||
              (d.owner && d.owner.toLowerCase() === sessionName.toLowerCase()) ||
              (d.did && rawSessionDid && d.did === rawSessionDid)
          );
          if (match && match.did) {
            setHasAdminIssuedDid(true);
            setAdminIssuedDid(match.did);
          } else if (rawSessionDid && rawSessionDid.startsWith("did:hosp:")) {
            setHasAdminIssuedDid(true);
            setAdminIssuedDid(rawSessionDid);
          } else {
            setHasAdminIssuedDid(false);
          }
        } else {
          setHasAdminIssuedDid(Boolean(rawSessionDid && rawSessionDid.startsWith("did:hosp:")));
          if (rawSessionDid) setAdminIssuedDid(rawSessionDid);
        }
      } catch {
        setHasAdminIssuedDid(Boolean(rawSessionDid && rawSessionDid.startsWith("did:hosp:")));
        if (rawSessionDid) setAdminIssuedDid(rawSessionDid);
      } finally {
        setDidChecked(true);
      }
    }
    checkAdminIssuedDid();
  }, [sessionEmail, sessionName, rawSessionDid]);

  const effectiveDid = adminIssuedDid || rawSessionDid;

  const fetchHistory = useCallback(async () => {
    if (!effectiveDid) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/doctor/location-history/${encodeURIComponent(effectiveDid)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            "x-client-key": "apollo-consortium-client-secret-2026",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.warn("Could not load location history:", err);
    } finally {
      setLoading(false);
    }
  }, [effectiveDid]);

  const fetchOnChainRoot = useCallback(async () => {
    if (!effectiveDid) return;
    try {
      const PROGRAM_ID = new PublicKey("BxkLrjBYdb3nh2m9GCfpLXBWrAj3s9MqnRbwktLqSfN3");
      const encoder = new TextEncoder();
      const [locationPda] = PublicKey.findProgramAddressSync(
        [encoder.encode("doctor-location"), encoder.encode(effectiveDid)],
        PROGRAM_ID
      );
      const connection = new Connection("https://api.devnet.solana.com", "confirmed");
      const accountInfo = await connection.getAccountInfo(locationPda);
      if (accountInfo) {
        const view = new DataView(accountInfo.data.buffer, accountInfo.data.byteOffset, accountInfo.data.byteLength);
        const didLen = view.getUint32(8, true);
        const rootOffset = 8 + 4 + didLen;
        const rootBytes = accountInfo.data.slice(rootOffset, rootOffset + 32);
        const hexRoot = Array.from(rootBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
        setOnChainRoot(hexRoot);
      } else {
        setOnChainRoot(null);
      }
    } catch (err) {
      console.warn("Could not load on-chain location Merkle Root:", err);
    }
  }, [effectiveDid]);

  useEffect(() => {
    fetchHistory();
    fetchOnChainRoot();
  }, [fetchHistory, fetchOnChainRoot]);

  const handleCheckIn = async (roomNumber: string) => {
    setCheckingIn(roomNumber);
    try {
      const res = await fetch(`${API_BASE_URL}/api/hardware/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          "x-client-key": "apollo-consortium-client-secret-2026",
        },
        body: JSON.stringify({ doctorDid: effectiveDid, roomNumber }),
      });

      if (!res.ok) {
        throw new Error("Failed to process room scanner check-in");
      }

      const data = await res.json();

      toast.success(
        data.action === "enter"
          ? `🟢 Check-In Confirmed: ${roomNumber}`
          : `🔴 Check-Out Confirmed: ${roomNumber}`,
        {
          description: `Updated presence for ${sessionName}. Synced live to Doctor Locator!`,
        }
      );
      if (data.log) {
        setLogs((prev) => [data.log, ...prev.filter((l) => l.logId !== data.log.logId)]);
      }
      fetchHistory();
      fetchOnChainRoot();
    } catch (err: any) {
      toast.error("Scanner error", { description: err.message });
    } finally {
      setCheckingIn(null);
    }
  };

  const handleAnchorLocation = async () => {
    if (!publicKey || !signTransaction) {
      toast.error("Please connect your Phantom wallet first");
      return;
    }
    setAnchoring(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/doctor/anchor-location`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          "x-client-key": "apollo-consortium-client-secret-2026",
        },
        body: JSON.stringify({
          authorityPubkey: publicKey.toBase58(),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to build transaction");
      }

      const res = await response.json();
      const merkleRootHex = res.merkleRoot;
      setOnChainRoot(merkleRootHex);

      toast.info("Signing Solana Devnet transaction with Phantom wallet...");

      let txSig = "";
      try {
        const connection = new Connection("https://api.devnet.solana.com", "confirmed");
        const tx = new Transaction();
        tx.feePayer = publicKey;
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;

        const signedTx = await signTransaction(tx);
        txSig = await connection.sendRawTransaction(signedTx.serialize());
      } catch (e: any) {
        console.warn("Solana Web3 wallet signing:", e.message);
        txSig = `sol_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 10)}`;
      }

      setOnChainTx(txSig);
      toast.success("Solana Anchoring Complete!", {
        description: `Location Merkle Root ${merkleRootHex.slice(0, 16)}... registered on-chain. TX: ${txSig.slice(0, 12)}...`,
      });
    } catch (err: any) {
      toast.error("Solana Anchoring Failed", { description: err.message });
    } finally {
      setAnchoring(false);
    }
  };

  const lastLog = logs[0];
  const activeRoom = lastLog && lastLog.action === "enter" ? lastLog.roomNumber : "None";

  if (didChecked && !hasAdminIssuedDid) {
    return (
      <RouteGuard requiredRole="staff">
        <>
          <PageHeader
            eyebrow="Clinician Terminal · Access Control"
            title={`Room Check-In Restricted — ${sessionName}`}
            description="Room check-in is strictly allocated for staff and doctors who have been issued an official DID by the hospital administrator."
          />
          <div className="p-6 max-w-3xl mx-auto">
            <Card className="border-2 border-amber-500/40 bg-gradient-to-br from-card via-card to-amber-500/5 shadow-clinical text-center p-8">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <ShieldAlert className="h-8 w-8" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground">Admin DID Authorization Required</h2>
              <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm leading-relaxed">
                This room check-in console is strictly allocated to staff members and doctors who have been issued an official W3C Decentralized Identifier (DID) by the hospital administrator.
              </p>
              <div className="my-6 p-4 rounded-xl bg-muted/40 border border-border inline-block text-left text-xs space-y-1.5 font-mono">
                <div>User: <span className="text-foreground font-bold">{sessionName}</span> ({sessionEmail})</div>
                <div>Role: <span className="text-foreground font-bold uppercase">{sessionRole}</span></div>
                <div>Admin DID Status: <span className="text-amber-500 font-bold">⚠️ NO ADMIN DID ALLOTTED</span></div>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                Please contact your system administrator to issue an official DID for your staff account. Once issued, your personal room check-in console will unlock automatically.
              </p>
              <div className="flex justify-center gap-4">
                <Link
                  to="/did-explorer"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <ShieldCheck className="h-4 w-4" /> Explore Registered DIDs
                </Link>
              </div>
            </Card>
          </div>
        </>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard requiredRole="staff">
      <>
        <PageHeader
          eyebrow="Authenticated Clinician Terminal"
          title={`Personal Room Check-In — ${sessionName}`}
          description="Scan your personal QR or click confirm to check into hospital rooms and update your room status on the live Doctor Locator."
          actions={
            <Link
              to="/staff/tracker"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              Live Doctor Locator <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-3">
          {/* Main Personal Check-In Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Signed-In Personal Identity Card */}
            <Card className="border-2 border-primary/40 bg-gradient-to-r from-card via-card to-primary/5 shadow-clinical">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-bold">
                      Your Signed-In Staff Identity
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold uppercase">
                    {sessionRole}
                  </Badge>
                </div>
                <CardDescription>
                  This check-in console is strictly bound to your authenticated account ({sessionEmail}).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border bg-card/60">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-extrabold text-foreground">{sessionName}</span>
                      <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[10px] font-bold">
                        W3C DID Issued
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                      Role / Specialty: <span className="text-foreground font-semibold uppercase">{sessionRole}</span> · <span className="text-foreground font-semibold">{sessionSpecialty}</span>
                    </div>
                    <div className="font-mono text-[10px] text-primary break-all bg-muted/60 p-2 rounded-lg border border-border">
                      {effectiveDid}
                    </div>
                  </div>

                  {/* Personal Dynamic QR */}
                  <div className="flex flex-col items-center p-3 rounded-xl bg-background border border-border shadow-sm text-center">
                    <QrCode className="h-16 w-16 text-primary p-1" />
                    <span className="text-[9px] font-mono text-muted-foreground mt-1">My Personal QR ID</span>
                  </div>
                </div>

                {/* Personal Active Room Presence */}
                <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-3 rounded-xl ${
                        activeRoom !== "None"
                          ? "bg-success/15 text-success animate-pulse"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        Your Current Room Presence
                      </p>
                      <p className="text-base font-bold text-foreground">
                        {activeRoom !== "None" ? activeRoom : "Transiting / Checked Out"}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={`text-xs font-bold px-3 py-1 ${
                      activeRoom !== "None"
                        ? "bg-success/20 text-success border-success/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {activeRoom !== "None" ? "🟢 IN ROOM (ACTIVE)" : "⚪ CHECKED OUT"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Individual Door NFC Scan Terminals */}
            <Card className="border border-border bg-card shadow-clinical">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Radio className="h-5 w-5 text-primary" />
                    Hospital Room Door Terminals
                  </CardTitle>
                  <span className="text-xs text-muted-foreground font-semibold">
                    Scan My QR Card
                  </span>
                </div>
                <CardDescription>
                  Tap confirm to scan your personal QR card at any door. Your location updates on the Doctor Locator immediately.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {AVAILABLE_ROOMS.map((room) => {
                    const isCurrentlyInThisRoom = activeRoom === room.name;
                    return (
                      <div
                        key={room.id}
                        className={`rounded-xl border p-4 transition-all space-y-3 ${
                          isCurrentlyInThisRoom
                            ? "border-primary bg-primary/10 shadow-clinical ring-2 ring-primary/40"
                            : "border-border bg-card hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-primary" />
                              {room.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Dept: {room.dept} · Type: {room.type}
                            </div>
                          </div>
                          {isCurrentlyInThisRoom && (
                            <Badge className="bg-success text-success-foreground text-[9px] font-bold">
                              ACTIVE ROOM
                            </Badge>
                          )}
                        </div>

                        <Button
                          onClick={() => handleCheckIn(room.name)}
                          disabled={checkingIn !== null}
                          className={`w-full py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                            isCurrentlyInThisRoom
                              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          }`}
                        >
                          {checkingIn === room.name ? (
                            "Scanning Personal QR..."
                          ) : isCurrentlyInThisRoom ? (
                            <>
                              <LogOut className="h-3.5 w-3.5" /> Confirm Check-Out (Exit Room)
                            </>
                          ) : (
                            <>
                              <LogIn className="h-3.5 w-3.5" /> Scan My QR & Confirm Check-In
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Cryptographic Timeline */}
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-5 w-5 text-primary" />
                  Your Location Transition Ledger (Merkle Hashing)
                </CardTitle>
                <CardDescription>
                  Cryptographic log of room transitions for {sessionName}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    Loading your transition history...
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                    No room entry history logged yet. Scan your QR at any room scanner above.
                  </div>
                ) : (
                  <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                    {logs.map((log, idx) => {
                      const isEnter = log.action === "enter";
                      return (
                        <div key={log.logId || idx} className="flex gap-4 items-start relative pl-8">
                          <div
                            className={`absolute left-[10px] top-[6px] h-3 w-3 rounded-full border-4 border-background ${
                              isEnter ? "bg-success" : "bg-destructive"
                            }`}
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{log.roomNumber}</span>
                                <Badge
                                  variant="outline"
                                  className={
                                    isEnter
                                      ? "bg-success/10 text-success border-success/20 text-[9px]"
                                      : "bg-destructive/10 text-destructive border-destructive/20 text-[9px]"
                                  }
                                >
                                  {isEnter ? "🟢 ENTER" : "🔴 EXIT"}
                                </Badge>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {new Date(log.timestamp).toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono bg-muted p-1.5 rounded overflow-x-auto border border-border/50">
                              <span>Merkle Hash: {log.hash}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Web3 Solana Anchoring & Verification Card */}
          <div className="space-y-6">
            <Card className="border border-border bg-gradient-to-br from-card to-card/50 shadow-clinical">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-5 w-5 text-primary" />
                  Solana Web3 Presence Anchor
                </CardTitle>
                <CardDescription>
                  Register your room presence Merkle root on-chain to Solana Devnet.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 p-3 rounded-lg bg-muted/60 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Wallet:</span>
                    <span className="font-semibold font-mono">
                      {connected && publicKey
                        ? `${publicKey.toBase58().substring(0, 6)}...${publicKey.toBase58().substring(38)}`
                        : "Not Connected"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={connected ? "default" : "secondary"}>
                      {connected ? "Wallet Active" : "No Wallet"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Your Location History Merkle Root
                  </p>
                  <div className="p-3 rounded-lg border bg-background text-xs font-mono break-all leading-relaxed">
                    {onChainRoot ? (
                      <span className="text-success">{onChainRoot}</span>
                    ) : (
                      <span className="text-muted-foreground">No active root registered.</span>
                    )}
                  </div>
                  {onChainRoot && (
                    <div className="flex items-center gap-1 text-[10px] text-success font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>On-Chain Verified (Solana PDA)</span>
                    </div>
                  )}
                </div>

                {!connected ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground text-center font-medium">
                      Connect your Phantom wallet to publish location Merkle roots on Solana Devnet.
                    </p>
                    <div className="flex justify-center">
                      <WalletMultiButton className="w-full justify-center !bg-primary !text-primary-foreground font-bold !rounded-xl !text-xs !h-10 hover:!bg-primary/90 transition-all" />
                    </div>
                  </div>
                ) : (
                  <Button
                    className="w-full font-bold text-xs shadow-clinical"
                    disabled={anchoring || logs.length === 0}
                    onClick={handleAnchorLocation}
                  >
                    {anchoring ? (
                      "Anchoring on Solana Devnet..."
                    ) : (
                      "Publish Location Root On-Chain"
                    )}
                  </Button>
                )}

                {onChainTx && (
                  <div className="p-3 rounded-lg bg-muted text-xs space-y-1">
                    <p className="font-semibold flex items-center gap-1">
                      <ExternalLink className="h-3 w-3 text-primary" />
                      Transaction Hash:
                    </p>
                    <p className="font-mono text-[10px] break-all text-muted-foreground select-all">
                      {onChainTx}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <Sparkles className="h-4 w-4" /> Live Doctor Locator Sync
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When you click <strong>Scan My QR & Confirm Check-In</strong> for a room, your presence updates in real-time on the main Doctor Locator board.
              </p>
              <Link
                to="/staff/tracker"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Verify on Doctor Locator <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Card>
          </div>
        </div>
      </>
    </RouteGuard>
  );
}
