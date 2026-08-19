import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import {
  BellRing,
  RefreshCw,
  Siren,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCentralAlerts,
  acknowledgeCentralAlert,
  resolveCentralAlert,
  getCentralAlertStats,
} from "@/lib/api";
import { useTableRefresh } from "@/hooks/use-realtime";
import { playClinicalAlert, isAudioAlertsEnabled, setAudioAlertsEnabled } from "@/lib/audio-alerts";

import type { CentralAlert, CentralAlertStats } from "@/lib/types";

import { AlertKpiBar } from "@/components/alerts/AlertKpiBar";
import { AlertFilterBar } from "@/components/alerts/AlertFilterBar";
import { AlertFeedCard } from "@/components/alerts/AlertFeedCard";
import { AlertDetailDialog } from "@/components/alerts/AlertDetailDialog";
import { BroadcastEmergencyDialog } from "@/components/alerts/BroadcastEmergencyDialog";

export const Route = createFileRoute("/admin/alerts")({
  head: () => ({
    meta: [
      { title: "Central Alert Center — Admin Console" },
      {
        name: "description",
        content:
          "Centralized hospital incident feed, real-time clinical alerts, equipment telemetry failures, and emergency broadcasts",
      },
    ],
  }),
  component: CentralAlertsPage,
});

const ITEMS_PER_PAGE = 10;

function getPaginationRange(current: number, total: number): (number | string)[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, 4, "...", total];
  }
  if (current >= total - 2) {
    return [1, "...", total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

function CentralAlertsPage() {
  const navigate = useNavigate();

  // Raw State
  const [alerts, setAlerts] = useState<CentralAlert[]>([]);
  const [stats, setStats] = useState<CentralAlertStats>({
    total: 0,
    active: 0,
    critical: 0,
    warning: 0,
    info: 0,
    acknowledged: 0,
    resolvedToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSeverity, setSelectedSeverity] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal Dialogs State
  const [inspectedAlert, setInspectedAlert] = useState<CentralAlert | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  useEffect(() => {
    setAudioEnabled(isAudioAlertsEnabled());
  }, []);

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    setAudioAlertsEnabled(next);
    if (next) {
      playClinicalAlert("info", true);
      toast.success("Alert Audio Activated", {
        description: "Clinical alert and warning chimes are now unmuted.",
      });
    } else {
      toast.info("Alert Audio Muted", {
        description: "Incident sounds silenced. Visual alerts remain active.",
      });
    }
  };

  // Audio trigger refs
  const previousCriticalCount = useRef<number>(0);
  const previousActiveCount = useRef<number>(0);

  // Data Loading Callback
  const loadData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      try {
        const [alertsRes, statsRes] = await Promise.all([
          getCentralAlerts({
            category: selectedCategory,
            severity: selectedSeverity,
            status: selectedStatus,
            search: searchQuery,
          }),
          getCentralAlertStats().catch(() => null),
        ]);

        const fetchedAlerts = alertsRes?.alerts || [];
        setAlerts(fetchedAlerts);

        if (statsRes) {
          setStats(statsRes);
          // Play appropriate clinical audio when new real-time alerts arrive
          if (
            statsRes.critical > previousCriticalCount.current &&
            previousCriticalCount.current !== 0
          ) {
            playClinicalAlert("critical");
          } else if (
            statsRes.active > previousActiveCount.current &&
            previousActiveCount.current !== 0
          ) {
            playClinicalAlert("warning");
          }
          previousCriticalCount.current = statsRes.critical;
          previousActiveCount.current = statsRes.active;
        }
      } catch (err: any) {
        console.warn("Central alerts sync error:", err);
        toast.error("Failed to sync hospital alert feed", {
          description: err?.message,
        });
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [selectedCategory, selectedSeverity, selectedStatus, searchQuery],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time Subscriptions across all domains
  useTableRefresh("emergency_broadcasts", () => loadData(true));
  useTableRefresh("inventory_alerts", () => loadData(true));
  useTableRefresh("fraud_alerts", () => loadData(true));
  useTableRefresh("beds", () => loadData(true));

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedSeverity, selectedStatus]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(alerts.length / ITEMS_PER_PAGE));
  const paginatedAlerts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return alerts.slice(start, start + ITEMS_PER_PAGE);
  }, [alerts, currentPage]);

  // Alert Handlers
  const handleAcknowledge = async (alert: CentralAlert) => {
    setIsUpdating(true);
    try {
      await acknowledgeCentralAlert({
        alertId: alert.id,
        sourceTable: alert.source_table,
      });
      playClinicalAlert("info");
      toast.success("Alert Acknowledged", {
        description: `Marked "${alert.title}" as under active investigation.`,
      });
      await loadData(true);
    } catch (err: any) {
      toast.error("Failed to acknowledge alert", { description: err.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResolve = async (alert: CentralAlert) => {
    setIsUpdating(true);
    try {
      await resolveCentralAlert({
        alertId: alert.id,
        sourceTable: alert.source_table,
      });
      playClinicalAlert("info");
      toast.success("Alert Resolved", {
        description: `Cleared incident for "${alert.title}".`,
      });
      await loadData(true);
    } catch (err: any) {
      toast.error("Failed to resolve alert", { description: err.message });
    } finally {
      setIsUpdating(false);
    }
  };

  // Jump to source with deep navigation and highlight parameter
  const handleJumpToSource = (alert: CentralAlert) => {
    if (!alert.target_url) return;

    const highlightParam = alert.highlight_id || alert.source_id;
    const separator = alert.target_url.includes("?") ? "&" : "?";
    const targetUrl = `${alert.target_url}${separator}highlight=${encodeURIComponent(highlightParam)}&source=alerts`;

    navigate({ to: targetUrl as any });
  };

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-8 pb-24">
        {/* Header with Title + Eyebrow + Emergency Broadcast CTA */}
        <PageHeader
          eyebrow="CENTRALIZED INCIDENT SENTINEL"
          title={
            <div className="flex items-center gap-3">
              <span>Hospital Alert Center</span>
              <button
                type="button"
                onClick={handleToggleAudio}
                className={`inline-flex items-center justify-center h-8 w-8 rounded-xl border transition-all ${
                  audioEnabled
                    ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 shadow-xs"
                    : "bg-muted/60 border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                title={
                  audioEnabled
                    ? "Alert Audio: ACTIVE (Click to Mute)"
                    : "Alert Audio: MUTED (Click to Unmute)"
                }
              >
                {audioEnabled ? (
                  <Volume2 className="h-4 w-4 animate-pulse text-primary" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          }
          description="Real-time clinical emergencies, critical patient triage, bed shortage forecasts, biomedical telemetry failures, and supply chain alerts."
          actions={
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData(false)}
                disabled={loading}
                className="rounded-xl h-9 text-xs font-bold gap-1.5 shadow-xs hover:bg-accent"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setBroadcastOpen(true)}
                className="h-9 rounded-xl text-xs font-extrabold gap-2 bg-gradient-to-r from-destructive to-red-600 text-destructive-foreground shadow-clinical-md shadow-destructive/25"
              >
                <Siren className="h-4 w-4 animate-pulse" />
                <span>Broadcast Emergency</span>
              </Button>
            </div>
          }
        />

        {/* Top Bento KPI Tiles */}
        <AlertKpiBar stats={stats} />

        {/* Filter & Search Toolbar */}
        <AlertFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedSeverity={selectedSeverity}
          onSeverityChange={setSelectedSeverity}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          totalAlerts={alerts.length}
        />

        {/* Vertical Alert Feed Container */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-extrabold text-lg text-foreground tracking-tight flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              <span>Live Alert Stream</span>
            </h2>

            <span className="text-xs font-medium text-muted-foreground">
              Page <span className="font-bold text-foreground">{currentPage}</span> of{" "}
              <span className="font-bold text-foreground">{totalPages}</span>
            </span>
          </div>

          {loading ? (
            /* Skeleton Loading State */
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border bg-card p-6 shadow-clinical space-y-3 animate-pulse"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-32 bg-muted/60 rounded-full" />
                    <div className="h-4 w-20 bg-muted/60 rounded-full" />
                  </div>
                  <div className="h-6 w-3/4 bg-muted/80 rounded-xl" />
                  <div className="h-4 w-full bg-muted/50 rounded-lg" />
                  <div className="pt-2 flex items-center justify-between">
                    <div className="h-8 w-28 bg-muted/60 rounded-xl" />
                    <div className="h-8 w-36 bg-muted/60 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : paginatedAlerts.length === 0 ? (
            /* Empty State */
            <EmptyState
              icon={ShieldAlert}
              title="No Active Alerts Found"
              description="No clinical, infrastructure, or supply chain alerts match your current filter criteria."
              action={
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                    setSelectedSeverity("all");
                    setSelectedStatus("all");
                  }}
                  className="bg-primary text-primary-foreground font-extrabold rounded-xl shadow-clinical-md text-xs cursor-pointer"
                >
                  Reset Filters
                </Button>
              }
            />
          ) : (
            /* Staggered Vertical Stream Feed */
            <StaggerList className="space-y-4">
              {paginatedAlerts.map((alert) => (
                <StaggerItem key={alert.id}>
                  <AlertFeedCard
                    alert={alert}
                    isUpdating={isUpdating}
                    onAcknowledge={handleAcknowledge}
                    onResolve={handleResolve}
                    onInspect={setInspectedAlert}
                    onJumpToSource={handleJumpToSource}
                  />
                </StaggerItem>
              ))}
            </StaggerList>
          )}

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/60">
              <div className="text-xs font-medium text-muted-foreground">
                Showing{" "}
                <span className="font-bold text-foreground">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                </span>{" "}
                to{" "}
                <span className="font-bold text-foreground">
                  {Math.min(currentPage * ITEMS_PER_PAGE, alerts.length)}
                </span>{" "}
                of <span className="font-bold text-foreground">{alerts.length}</span> alerts
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 shadow-xs hover:bg-accent"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </Button>

                {getPaginationRange(currentPage, totalPages).map((p, idx) =>
                  p === "..." ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-xs font-bold text-muted-foreground/60"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={`page-${p}`}
                      onClick={() => setCurrentPage(p as number)}
                      className={`h-8 min-w-[32px] px-2 rounded-xl text-xs font-extrabold transition-all ${
                        currentPage === p
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "border border-border/80 bg-background text-muted-foreground hover:border-border"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 shadow-xs hover:bg-accent"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Dialogs */}
        <AlertDetailDialog
          alert={inspectedAlert}
          onClose={() => setInspectedAlert(null)}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
          onJumpToSource={handleJumpToSource}
        />

        <BroadcastEmergencyDialog
          open={broadcastOpen}
          onClose={() => setBroadcastOpen(false)}
          onSuccess={() => loadData(true)}
        />
      </div>
    </RouteGuard>
  );
}
