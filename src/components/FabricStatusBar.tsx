/**
 * FabricStatusBar — Persistent top banner showing real-time Hyperledger status
 * Shown on every page in the app
 */
import { useFabricConnection } from "@/hooks/use-fabric";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Wifi, WifiOff, Blocks, Zap, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";

export function FabricStatusBar() {
  const { online, wsConnected, blockHeight, latestBlock } = useFabricConnection();
  const [show, setShow] = useState(false);
  const [newBlock, setNewBlock] = useState(false);

  useEffect(() => {
    // Show only if server is online (hide for pure localStorage mode)
    setShow(online || wsConnected);
  }, [online, wsConnected]);

  useEffect(() => {
    if (!latestBlock) return;
    setNewBlock(true);
    const t = setTimeout(() => setNewBlock(false), 2000);
    return () => clearTimeout(t);
  }, [latestBlock]);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="w-full border-b border-border/50 bg-gradient-to-r from-primary/5 via-background to-chart-2/5 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between px-4 py-1.5 text-[11px]">
          {/* Left: Connection indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              {online ? (
                <span className="flex items-center gap-1 text-success font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative h-2 w-2 rounded-full bg-success" />
                  </span>
                  Fabric REST
                </span>
              ) : (
                <span className="flex items-center gap-1 text-warning-foreground">
                  <WifiOff className="h-3 w-3" />
                  LocalSim
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {wsConnected ? (
                <span className="flex items-center gap-1 text-success font-medium">
                  <Wifi className="h-3 w-3" />
                  WebSocket Live
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Activity className="h-3 w-3" />
                  LocalEvents
                </span>
              )}
            </div>

            <span className="hidden sm:flex items-center gap-1 text-muted-foreground">
              <Blocks className="h-3 w-3 text-primary" />
              Channel: <span className="font-mono font-semibold text-foreground">embrace-health-channel</span>
            </span>
          </div>

          {/* Right: Latest block */}
          <div className="flex items-center gap-3">
            <AnimatePresence mode="wait">
              {newBlock && (
                <motion.div
                  key="new-block"
                  initial={{ opacity: 0, x: 10, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-success font-semibold"
                >
                  <Zap className="h-2.5 w-2.5" />
                  New Block Committed!
                </motion.div>
              )}
            </AnimatePresence>

            {blockHeight > 0 && (
              <span className="text-muted-foreground">
                Block <span className="font-mono font-semibold text-foreground">#{blockHeight.toLocaleString()}</span>
              </span>
            )}

            <Link
              to="/admin/hyperledger"
              className="flex items-center gap-0.5 rounded border border-border bg-background/50 px-2 py-0.5 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
            >
              Console <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
