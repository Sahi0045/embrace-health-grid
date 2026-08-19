import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { StaggerList, StaggerItem } from "@/components/Motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import {
  Building2,
  Layers,
  Home,
  Bed,
  Plus,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  Hospital,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  getHospitalInfrastructure,
  getBedRoomStatistics,
  updateBedStatus,
  updateRoomStatus,
} from "@/lib/operations.server";
import { useTableRefresh } from "@/hooks/use-realtime";

import { BedKpiBar } from "@/components/beds/BedKpiBar";
import { BedStatusDonut } from "@/components/beds/BedStatusDonut";
import { InfraBreadcrumb } from "@/components/beds/InfraBreadcrumb";
import { BuildingCard } from "@/components/beds/BuildingCard";
import { FloorCard } from "@/components/beds/FloorCard";
import { WardCard } from "@/components/beds/WardCard";
import { RoomCard } from "@/components/beds/RoomCard";
import { BedCell } from "@/components/beds/BedCell";
import { BedDetailPanel } from "@/components/beds/BedDetailPanel";
import { StatusUpdateDialog } from "@/components/beds/StatusUpdateDialog";
import { CreateEntityDialog } from "@/components/beds/CreateEntityDialog";
import { useSpotlightTarget } from "@/hooks/use-spotlight";

export const Route = createFileRoute("/admin/beds-rooms")({
  validateSearch: (search: Record<string, unknown>): { highlight?: string } => ({
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Bed & Room Management — Admin Console" },
      {
        name: "description",
        content: "Manage hospital infrastructure, buildings, wards, rooms, and live bed allocation",
      },
    ],
  }),
  component: BedsRoomsManagement,
});

type ViewMode = "hierarchy" | "beds" | "rooms";

function BedsRoomsManagement() {
  const search = Route.useSearch();
  useSpotlightTarget(search.highlight);

  // Raw Data State
  const [buildings, setBuildings] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // View & Filter State
  const [viewMode, setViewMode] = useState<ViewMode>("hierarchy");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Navigation Drill-Down State
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);
  const [selectedWard, setSelectedWard] = useState<any>(null);

  // Detail Drawer State
  const [selectedBed, setSelectedBed] = useState<any | null>(null);

  // Dialog State
  const [createDialog, setCreateDialog] = useState<{
    open: boolean;
    type: "building" | "floor" | "ward" | "room" | "bed" | null;
    parent?: any;
  }>({ open: false, type: null });

  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    item: any;
    type: "bed" | "room" | null;
  }>({ open: false, item: null, type: null });

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [infraData, statsData] = await Promise.all([
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
      setStats(statsData);
    } catch (err: any) {
      toast.error(err?.message || "Failed to sync bed and room infrastructure");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time Subscriptions
  useTableRefresh("buildings", loadData);
  useTableRefresh("floors", loadData);
  useTableRefresh("wards", loadData);
  useTableRefresh("rooms", loadData);
  useTableRefresh("beds", loadData);

  // Handlers
  const handleUpdateStatus = async (
    itemId: string,
    newStatus: string,
    type: "bed" | "room",
    patientDid?: string,
  ) => {
    try {
      if (type === "bed") {
        await updateBedStatus({
          data: {
            bedId: itemId,
            status: newStatus as any,
            patientDid,
          },
        });
        toast.success("Bed status updated");
      } else {
        await updateRoomStatus({
          data: {
            roomId: itemId,
            status: newStatus as any,
          },
        });
        toast.success("Room status updated");
      }
      await loadData();
      setStatusDialog({ open: false, item: null, type: null });
      if (selectedBed && selectedBed.bed_id === itemId) {
        setSelectedBed({ ...selectedBed, status: newStatus, patient_did: patientDid ?? null });
      }
    } catch (error: any) {
      toast.error("Failed to update status", { description: error.message });
    }
  };

  const handleBedDetailStatusUpdate = async (newStatus: string) => {
    if (!selectedBed) return;
    try {
      await updateBedStatus({
        data: {
          bedId: selectedBed.bed_id,
          status: newStatus as any,
        },
      });
      toast.success("Bed status updated");
      setSelectedBed({ ...selectedBed, status: newStatus });
      await loadData();
    } catch (error: any) {
      toast.error("Failed to update status", { description: error.message });
    }
  };

  // Helper Stats Calculation per Entity
  const getBuildingStats = useCallback(
    (bId: string) => {
      const bFloors = floors.filter((f) => f.building_id === bId);
      const bWards = wards.filter((w) => w.building_id === bId);
      const bBeds = beds.filter((b) => b.building_id === bId);
      return {
        floorsCount: bFloors.length,
        wardsCount: bWards.length,
        bedsStats: {
          total: bBeds.length,
          occupied: bBeds.filter((b) => b.status === "occupied").length,
          available: bBeds.filter((b) => b.status === "available").length,
        },
      };
    },
    [floors, wards, beds],
  );

  const getFloorStats = useCallback(
    (fId: string) => {
      const fWards = wards.filter((w) => w.floor_id === fId);
      const fRooms = rooms.filter(
        (r) => r.floor === floors.find((f) => f.floor_id === fId)?.floor_name || r.building_id,
      );
      const fBeds = beds.filter((b) => fWards.some((w) => w.ward_id === b.ward_id));
      return {
        wardsCount: fWards.length,
        roomsCount: fRooms.length,
        bedsCount: fBeds.length,
      };
    },
    [wards, rooms, beds, floors],
  );

  const getWardStats = useCallback(
    (wId: string) => {
      const wRooms = rooms.filter((r) => r.ward_id === wId);
      const wBeds = beds.filter((b) => b.ward_id === wId);
      return {
        roomsCount: wRooms.length,
        bedsStats: {
          total: wBeds.length,
          occupied: wBeds.filter((b) => b.status === "occupied").length,
          available: wBeds.filter((b) => b.status === "available").length,
        },
      };
    },
    [rooms, beds],
  );

  // Filtered views
  const filteredBeds = useMemo(() => {
    return beds.filter((b) => {
      const matchesSearch =
        (b.bed_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.bed_type || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.patient_did || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [beds, searchQuery, statusFilter]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchesSearch =
        (r.room_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.room_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.room_type || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rooms, searchQuery, statusFilter]);

  return (
    <RouteGuard requiredRole="admin">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8 pb-24">
        {/* Page Header */}
        <PageHeader
          eyebrow="Hospital Infrastructure & Allocation"
          title="Bed & Room Management"
          description="Real-time occupancy tracking and 5-level hierarchy drill-down governance"
          actions={
            <div className="flex items-center gap-2">
              <Button
                onClick={loadData}
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-bold shadow-xs hover:bg-accent"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={() => setCreateDialog({ open: true, type: "building" })}
                size="sm"
                className="bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-extrabold rounded-xl shadow-clinical-md shadow-primary/25 text-xs"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Building
              </Button>
            </div>
          }
        />

        <StaggerList className="space-y-8">
          {/* Top KPI & Donut Bento Section */}
          <StaggerItem>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-7 flex flex-col">
                <BedKpiBar
                  bedStats={stats?.bedStats || {}}
                  roomStats={stats?.roomStats || {}}
                  gridClassName="grid gap-4 grid-cols-1 sm:grid-cols-2 h-full"
                />
              </div>
              <div className="lg:col-span-5 flex flex-col">
                <BedStatusDonut bedStats={stats?.bedStats || {}} />
              </div>
            </div>
          </StaggerItem>

          {/* Search, View Filter & Controls Bar */}
          <StaggerItem>
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card border border-border/80 p-3.5 rounded-2xl shadow-clinical-sm">
              {/* View Mode Switcher Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <button
                  type="button"
                  onClick={() => setViewMode("hierarchy")}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                    viewMode === "hierarchy"
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "border-border/80 text-muted-foreground hover:border-border bg-background"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Hierarchy Drill-Down
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("beds")}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                    viewMode === "beds"
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "border-border/80 text-muted-foreground hover:border-border bg-background"
                  }`}
                >
                  <Bed className="h-3.5 w-3.5" />
                  All Beds ({beds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("rooms")}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                    viewMode === "rooms"
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "border-border/80 text-muted-foreground hover:border-border bg-background"
                  }`}
                >
                  <Home className="h-3.5 w-3.5" />
                  All Rooms ({rooms.length})
                </button>
              </div>

              {/* Search & Status Filter */}
              <div className="flex items-center gap-2.5">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, code, DID..."
                    className="rounded-xl bg-background border border-border/80 pl-9.5 pr-4 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/40 h-9"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-card border border-border/80 rounded-xl px-3 py-1.5 shadow-clinical-xs text-xs font-extrabold text-foreground h-9 focus:ring-2 focus:ring-primary/40"
                >
                  <option value="all">All Statuses</option>
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
          </StaggerItem>

          {/* Main Content Area */}
          <StaggerItem>
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-border bg-muted/40 h-48 p-6 space-y-4"
                  >
                    <div className="h-6 bg-muted rounded w-1/2" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-12 bg-muted rounded w-full" />
                  </div>
                ))}
              </div>
            ) : viewMode === "hierarchy" ? (
              <div className="space-y-6">
                {/* Breadcrumb Navigation */}
                <InfraBreadcrumb
                  selectedBuilding={selectedBuilding}
                  selectedFloor={selectedFloor}
                  selectedWard={selectedWard}
                  onReset={() => {
                    setSelectedBuilding(null);
                    setSelectedFloor(null);
                    setSelectedWard(null);
                  }}
                  onSelectBuilding={() => {
                    setSelectedFloor(null);
                    setSelectedWard(null);
                  }}
                  onSelectFloor={() => {
                    setSelectedWard(null);
                  }}
                />

                {/* Level 0: Buildings Grid */}
                {!selectedBuilding && (
                  <div>
                    {buildings.length === 0 ? (
                      <EmptyState
                        icon={Building2}
                        title="No Buildings Configured"
                        description="Start by creating the first hospital building structure."
                        action={
                          <Button
                            onClick={() => setCreateDialog({ open: true, type: "building" })}
                            className="bg-primary text-primary-foreground font-extrabold rounded-xl shadow-clinical-md text-xs"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add First Building
                          </Button>
                        }
                      />
                    ) : (
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {buildings.map((building) => {
                          const bStats = getBuildingStats(building.building_id);
                          return (
                            <BuildingCard
                              key={building.building_id}
                              building={building}
                              floorsCount={bStats.floorsCount}
                              wardsCount={bStats.wardsCount}
                              bedsStats={bStats.bedsStats}
                              onSelect={() => setSelectedBuilding(building)}
                              onAddFloor={() => {
                                setSelectedBuilding(building);
                                setCreateDialog({ open: true, type: "floor", parent: building });
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Level 1: Floors Grid */}
                {selectedBuilding && !selectedFloor && (
                  <div>
                    {floors.filter((f) => f.building_id === selectedBuilding.building_id).length ===
                    0 ? (
                      <EmptyState
                        icon={Layers}
                        title={`No Floors in ${selectedBuilding.building_name}`}
                        description="Add a floor level to configure wards and rooms."
                        action={
                          <Button
                            onClick={() =>
                              setCreateDialog({
                                open: true,
                                type: "floor",
                                parent: selectedBuilding,
                              })
                            }
                            className="bg-primary text-primary-foreground font-extrabold rounded-xl shadow-clinical-md text-xs"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Floor
                          </Button>
                        }
                      />
                    ) : (
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {floors
                          .filter((f) => f.building_id === selectedBuilding.building_id)
                          .map((floor) => {
                            const fStats = getFloorStats(floor.floor_id);
                            return (
                              <FloorCard
                                key={floor.floor_id}
                                floor={floor}
                                wardsCount={fStats.wardsCount}
                                roomsCount={fStats.roomsCount}
                                bedsCount={fStats.bedsCount}
                                onSelect={() => setSelectedFloor(floor)}
                                onAddWard={() => {
                                  setSelectedFloor(floor);
                                  setCreateDialog({ open: true, type: "ward", parent: floor });
                                }}
                              />
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {/* Level 2: Wards Grid */}
                {selectedBuilding && selectedFloor && !selectedWard && (
                  <div>
                    {wards.filter((w) => w.floor_id === selectedFloor.floor_id).length === 0 ? (
                      <EmptyState
                        icon={Home}
                        title={`No Wards in ${selectedFloor.floor_name}`}
                        description="Add clinical wards (e.g. ICU, General, Emergency) to this floor."
                        action={
                          <Button
                            onClick={() =>
                              setCreateDialog({ open: true, type: "ward", parent: selectedFloor })
                            }
                            className="bg-primary text-primary-foreground font-extrabold rounded-xl shadow-clinical-md text-xs"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Ward
                          </Button>
                        }
                      />
                    ) : (
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {wards
                          .filter((w) => w.floor_id === selectedFloor.floor_id)
                          .map((ward) => {
                            const wStats = getWardStats(ward.ward_id);
                            return (
                              <WardCard
                                key={ward.ward_id}
                                ward={ward}
                                roomsCount={wStats.roomsCount}
                                bedsStats={wStats.bedsStats}
                                onSelect={() => setSelectedWard(ward)}
                                onAddRoom={() => {
                                  setSelectedWard(ward);
                                  setCreateDialog({ open: true, type: "room", parent: ward });
                                }}
                              />
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {/* Level 3: Rooms & Bed Grid */}
                {selectedBuilding && selectedFloor && selectedWard && (
                  <div>
                    {rooms.filter((r) => r.ward_id === selectedWard.ward_id).length === 0 ? (
                      <EmptyState
                        icon={Home}
                        title={`No Rooms in ${selectedWard.ward_name}`}
                        description="Add patient rooms to this ward to manage bed assignments."
                        action={
                          <Button
                            onClick={() =>
                              setCreateDialog({ open: true, type: "room", parent: selectedWard })
                            }
                            className="bg-primary text-primary-foreground font-extrabold rounded-xl shadow-clinical-md text-xs"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Room
                          </Button>
                        }
                      />
                    ) : (
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {rooms
                          .filter((r) => r.ward_id === selectedWard.ward_id)
                          .map((room) => {
                            const roomBeds = beds.filter((b) => b.room_id === room.room_id);
                            return (
                              <RoomCard
                                key={room.room_id}
                                room={room}
                                beds={roomBeds}
                                onSelectBed={(bed) => setSelectedBed(bed)}
                                onUpdateRoomStatus={() =>
                                  setStatusDialog({ open: true, item: room, type: "room" })
                                }
                                onAddBed={() =>
                                  setCreateDialog({ open: true, type: "bed", parent: room })
                                }
                              />
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : viewMode === "beds" ? (
              /* All Beds Directory View */
              <div className="space-y-4">
                {filteredBeds.length === 0 ? (
                  <EmptyState
                    icon={Bed}
                    title="No Beds Found"
                    description="No beds match the selected filters."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {filteredBeds.map((bed) => (
                      <BedCell key={bed.bed_id} bed={bed} onClick={() => setSelectedBed(bed)} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* All Rooms Directory View */
              <div className="space-y-4">
                {filteredRooms.length === 0 ? (
                  <EmptyState
                    icon={Home}
                    title="No Rooms Found"
                    description="No rooms match the selected filters."
                  />
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredRooms.map((room) => {
                      const roomBeds = beds.filter((b) => b.room_id === room.room_id);
                      return (
                        <RoomCard
                          key={room.room_id}
                          room={room}
                          beds={roomBeds}
                          onSelectBed={(bed) => setSelectedBed(bed)}
                          onUpdateRoomStatus={() =>
                            setStatusDialog({ open: true, item: room, type: "room" })
                          }
                          onAddBed={() =>
                            setCreateDialog({ open: true, type: "bed", parent: room })
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </StaggerItem>
        </StaggerList>

        {/* Slide-in Bed Detail Drawer Panel */}
        <BedDetailPanel
          bed={selectedBed}
          room={rooms.find((r) => r.room_id === selectedBed?.room_id)}
          ward={wards.find((w) => w.ward_id === selectedBed?.ward_id)}
          building={buildings.find((b) => b.building_id === selectedBed?.building_id)}
          onClose={() => setSelectedBed(null)}
          onUpdateStatus={handleBedDetailStatusUpdate}
        />

        {/* Status Update Dialog */}
        <StatusUpdateDialog
          dialog={statusDialog}
          onClose={() => setStatusDialog({ open: false, item: null, type: null })}
          onUpdate={handleUpdateStatus}
        />

        {/* Create Entity Dialog */}
        <CreateEntityDialog
          dialog={createDialog}
          onClose={() => setCreateDialog({ open: false, type: null, parent: undefined })}
          onSuccess={loadData}
          selectedBuilding={selectedBuilding || createDialog.parent}
          selectedFloor={selectedFloor || createDialog.parent}
          selectedWard={selectedWard || createDialog.parent}
          selectedRoom={createDialog.parent}
        />
      </div>
    </RouteGuard>
  );
}
