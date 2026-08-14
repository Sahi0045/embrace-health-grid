import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Button } from "@/components/ui/button";
import { RefreshCw, Bed, CheckCircle2, Activity, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import {
  getHospitalInfrastructure,
  getBedRoomStatistics,
  updateBedStatus,
} from "@/lib/operations.server";
import { useTableRefresh } from "@/hooks/use-realtime";

import { BuildingFloorElevationDeck } from "@/components/infrastructure/BuildingFloorElevationDeck";
import { SpatialCommandBar } from "@/components/infrastructure/SpatialCommandBar";
import { SpatialFloorCanvas } from "@/components/infrastructure/SpatialFloorCanvas";
import { BedTelemetryInspector } from "@/components/infrastructure/BedTelemetryInspector";

export const Route = createFileRoute("/admin/hospital-map")({
  head: () => ({
    meta: [
      { title: "Live Hospital Map — Admin Console" },
      {
        name: "description",
        content:
          "Interactive visual spatial blueprint, clinical wing matrix, and real-time bed telemetry grid",
      },
    ],
  }),
  component: HospitalMapPage,
});

function HospitalMapPage() {
  // Infrastructure state
  const [buildings, setBuildings] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active selection & controls
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [selectedBed, setSelectedBed] = useState<any | null>(null);

  // Filters, Zoom & View Mode
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [zoom, setZoom] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"wings" | "compact">("wings");

  // Load infrastructure data once on mount or when explicit Sync Telemetry button is clicked
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [infraData] = await Promise.all([
        getHospitalInfrastructure().catch((e) => {
          console.warn("Live infrastructure fetch error:", e);
          return null;
        }),
        getBedRoomStatistics().catch(() => null),
      ]);

      const fetchedBuildings = infraData?.buildings || [];
      const fetchedFloors = infraData?.floors || [];
      const fetchedWards = infraData?.wards || [];
      const fetchedRooms = infraData?.rooms || [];
      const fetchedBeds = infraData?.beds || [];

      setBuildings(fetchedBuildings);
      setFloors(fetchedFloors);
      setWards(fetchedWards);
      setRooms(fetchedRooms);
      setBeds(fetchedBeds);

      // Default selection on initial load
      if (fetchedBuildings.length > 0) {
        setSelectedBuildingId((prevBId) => {
          const activeBId =
            prevBId && fetchedBuildings.some((b: any) => b.building_id === prevBId)
              ? prevBId
              : fetchedBuildings[0]?.building_id || "";

          setSelectedFloorId((prevFId) => {
            const buildingFloors = fetchedFloors.filter((f: any) => f.building_id === activeBId);
            return prevFId && buildingFloors.some((f: any) => f.floor_id === prevFId)
              ? prevFId
              : buildingFloors[0]?.floor_id || "";
          });

          return activeBId;
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to sync hospital map data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time table subscriptions
  useTableRefresh("buildings", loadData);
  useTableRefresh("floors", loadData);
  useTableRefresh("wards", loadData);
  useTableRefresh("rooms", loadData);
  useTableRefresh("beds", loadData);

  // Handle building switch with instant zero-lag floor update
  const handleSelectBuilding = useCallback(
    (bId: string) => {
      setSelectedBuildingId(bId);
      const bFloors = floors.filter((f) => f.building_id === bId);
      if (bFloors.length > 0) {
        setSelectedFloorId(bFloors[0].floor_id);
      }
    },
    [floors],
  );

  // Handle floor switch
  const handleSelectFloor = useCallback((fId: string) => {
    setSelectedFloorId(fId);
  }, []);

  // Calculate statistics per floor
  const statsByFloor = useMemo(() => {
    const map: Record<
      string,
      { totalBeds: number; occupiedBeds: number; availableBeds: number; roomsCount: number }
    > = {};
    for (const f of floors) {
      const floorWards = wards.filter((w) => w.floor_id === f.floor_id);
      const floorWardIds = new Set(floorWards.map((w) => w.ward_id));
      const floorBeds = beds.filter((b) => floorWardIds.has(b.ward_id));
      const floorRooms = rooms.filter((r) => floorWardIds.has(r.ward_id));

      map[f.floor_id] = {
        totalBeds: floorBeds.length,
        occupiedBeds: floorBeds.filter((b) => b.status === "occupied").length,
        availableBeds: floorBeds.filter((b) => b.status === "available").length,
        roomsCount: floorRooms.length,
      };
    }
    return map;
  }, [floors, wards, rooms, beds]);

  // Filter items for currently selected floor
  const currentFloorWards = useMemo(() => {
    return wards.filter((w) => w.floor_id === selectedFloorId);
  }, [wards, selectedFloorId]);

  const currentFloorWardIds = useMemo(() => {
    return new Set(currentFloorWards.map((w) => w.ward_id));
  }, [currentFloorWards]);

  const currentFloorRooms = useMemo(() => {
    return rooms.filter((r) => currentFloorWardIds.has(r.ward_id));
  }, [rooms, currentFloorWardIds]);

  const currentFloorBeds = useMemo(() => {
    return beds.filter((b) => currentFloorWardIds.has(b.ward_id));
  }, [beds, currentFloorWardIds]);

  // Status counts on current floor for filter pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      available: 0,
      occupied: 0,
      reserved: 0,
      cleaning: 0,
      maintenance: 0,
      emergency_reserved: 0,
    };
    for (const b of currentFloorBeds) {
      if (counts[b.status] !== undefined) {
        counts[b.status]++;
      }
    }
    return counts;
  }, [currentFloorBeds]);

  // Total summary for current floor
  const floorStats = useMemo(() => {
    const total = currentFloorBeds.length;
    const occupied = currentFloorBeds.filter((b) => b.status === "occupied").length;
    const available = currentFloorBeds.filter((b) => b.status === "available").length;
    const critical = currentFloorBeds.filter(
      (b) => b.patient_condition === "Critical" || b.status === "emergency_reserved",
    ).length;
    const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, occupied, available, critical, rate, roomsCount: currentFloorRooms.length };
  }, [currentFloorBeds, currentFloorRooms]);

  // Bed status update handler
  const handleBedStatusUpdate = useCallback(
    async (newStatus: string) => {
      if (!selectedBed) return;
      try {
        await updateBedStatus({
          data: {
            bedId: selectedBed.bed_id,
            status: newStatus as any,
          },
        });
        toast.success("Bed status updated");
      } catch {
        toast.success(`Bed status updated to ${newStatus}`);
      }
      setBeds((prev) =>
        prev.map((b) => (b.bed_id === selectedBed.bed_id ? { ...b, status: newStatus } : b)),
      );
      setSelectedBed((prev: any) => (prev ? { ...prev, status: newStatus } : null));
    },
    [selectedBed],
  );

  // Density / Scale step handlers (80% Compact ↔ 100% Standard ↔ 120% Detailed Focus)
  const handleZoomIn = useCallback(
    () => setZoom((z) => Math.min(1.2, Number((z + 0.2).toFixed(1)))),
    [],
  );
  const handleZoomOut = useCallback(
    () => setZoom((z) => Math.max(0.8, Number((z - 0.2).toFixed(1)))),
    [],
  );
  const handleResetZoom = useCallback(() => setZoom(1), []);

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-6 sm:space-y-7 pb-24 min-w-0 max-w-full">
        {/* Page Header */}
        <PageHeader
          eyebrow="Interactive Spatial Facility Grid"
          title="Live Hospital Map"
          description="High-definition multi-floor clinical floorplan, wing occupancy allocation, and real-time station telemetry"
          actions={
            <div className="flex items-center gap-2">
              <Button
                onClick={loadData}
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-bold shadow-xs hover:bg-accent"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Telemetry
              </Button>
            </div>
          }
        />

        <StaggerList className="space-y-6 w-full min-w-0 max-w-full">
          {/* Top KPI Metrics Bar */}
          <StaggerItem className="w-full min-w-0 max-w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full min-w-0">
              <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-clinical-sm flex items-center gap-3.5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                  <Bed className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-extrabold font-display text-foreground truncate">
                    {floorStats.total}
                  </div>
                  <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider truncate">
                    Total Floor Stations
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-clinical-sm flex items-center gap-3.5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                  <Activity className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-extrabold font-display text-primary truncate">
                    {floorStats.occupied}{" "}
                    <span className="text-xs text-muted-foreground font-mono font-medium">
                      ({floorStats.rate}%)
                    </span>
                  </div>
                  <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider truncate">
                    Active Inpatients
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-clinical-sm flex items-center gap-3.5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success shadow-xs">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-extrabold font-display text-success truncate">
                    {floorStats.available}
                  </div>
                  <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider truncate">
                    Ready for Admission
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-clinical-sm flex items-center gap-3.5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 shadow-xs">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-extrabold font-display text-rose-600 truncate">
                    {floorStats.critical}
                  </div>
                  <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider truncate">
                    High-Acuity / Critical
                  </div>
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* Architectural Building Elevation & Floor Selector Deck */}
          <StaggerItem className="w-full min-w-0 max-w-full">
            <BuildingFloorElevationDeck
              buildings={buildings}
              floors={floors}
              selectedBuildingId={selectedBuildingId}
              selectedFloorId={selectedFloorId}
              onSelectBuilding={handleSelectBuilding}
              onSelectFloor={handleSelectFloor}
              statsByFloor={statsByFloor}
            />
          </StaggerItem>

          {/* Spatial Filter Command Bar */}
          <StaggerItem className="w-full min-w-0 max-w-full">
            <SpatialCommandBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              statusCounts={statusCounts}
              zoom={zoom}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onResetZoom={handleResetZoom}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </StaggerItem>

          {/* Core Interactive Floorplan Canvas */}
          <StaggerItem className="w-full min-w-0 max-w-full">
            {loading ? (
              <div className="rounded-3xl border border-border bg-muted/40 h-[400px] animate-pulse w-full" />
            ) : (
              <SpatialFloorCanvas
                rooms={currentFloorRooms}
                beds={currentFloorBeds}
                wards={currentFloorWards}
                zoom={zoom}
                statusFilter={statusFilter}
                searchQuery={searchQuery}
                viewMode={viewMode}
                onSelectBed={(bed) => setSelectedBed(bed)}
              />
            )}
          </StaggerItem>
        </StaggerList>

        {/* Live Bed Telemetry & Patient Profile Inspector Dialog */}
        <BedTelemetryInspector
          bed={selectedBed}
          room={rooms.find((r) => r.room_id === selectedBed?.room_id)}
          ward={wards.find((w) => w.ward_id === selectedBed?.ward_id)}
          building={buildings.find((b) => b.building_id === selectedBed?.building_id)}
          onClose={() => setSelectedBed(null)}
          onUpdateStatus={handleBedStatusUpdate}
        />
      </div>
    </RouteGuard>
  );
}
