import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Layers,
  Home,
  Bed,
  Plus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  Wrench,
  Ban,
  Shield,
  Activity,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import * as React from "react";
import { toast } from "sonner";
import {
  getHospitalInfrastructure,
  getBedRoomStatistics,
  updateBedStatus,
  updateRoomStatus,
  createBuilding,
  createFloor,
  createWard,
  createRoom,
  createBed,
} from "@/lib/operations.server";
import { useTableRefresh } from "@/hooks/use-realtime";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/beds-rooms")({
  head: () => ({
    meta: [
      { title: "Bed & Room Management — Admin Console" },
      { name: "description", content: "Manage hospital infrastructure and bed allocation" },
    ],
  }),
  component: BedsRoomsManagement,
});

// Status configurations
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  available: { label: "Available", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  occupied: { label: "Occupied", color: "bg-primary/10 text-primary border-primary/20", icon: Users },
  reserved: { label: "Reserved", color: "bg-warning/10 text-warning-foreground border-warning/20", icon: Clock },
  cleaning: { label: "Cleaning", color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: Activity },
  maintenance: { label: "Maintenance", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: Wrench },
  blocked: { label: "Blocked", color: "bg-destructive/10 text-destructive border-destructive/20", icon: Ban },
  emergency_reserved: { label: "Emergency", color: "bg-red-600/10 text-red-600 border-red-200", icon: Shield },
};

function BedsRoomsManagement() {
  // State for infrastructure data
  const [buildings, setBuildings] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Navigation state (drill-down)
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);
  const [selectedWard, setSelectedWard] = useState<any>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

  // Dialog state
  const [createDialog, setCreateDialog] = useState<{
    open: boolean;
    type: "building" | "floor" | "ward" | "room" | "bed" | null;
  }>({ open: false, type: null });
  
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    item: any;
    type: "bed" | "room" | null;
  }>({ open: false, item: null, type: null });

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [infraData, statsData] = await Promise.all([
        getHospitalInfrastructure(),
        getBedRoomStatistics(),
      ]);
      
      setBuildings(infraData.buildings || []);
      setFloors(infraData.floors || []);
      setWards(infraData.wards || []);
      setRooms(infraData.rooms || []);
      setBeds(infraData.beds || []);
      setStats(statsData);
    } catch (error: any) {
      toast.error("Failed to load data", { description: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time subscriptions for live updates
  useTableRefresh("buildings", loadData);
  useTableRefresh("floors", loadData);
  useTableRefresh("wards", loadData);
  useTableRefresh("rooms", loadData);
  useTableRefresh("beds", loadData);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Handlers
  const handleUpdateStatus = async (itemId: string, newStatus: string, type: "bed" | "room") => {
    try {
      if (type === "bed") {
        await updateBedStatus({ data: { bedId: itemId, status: newStatus as "available" | "occupied" | "reserved" | "cleaning" | "maintenance" | "blocked" | "emergency_reserved" } });
        toast.success("Bed status updated");
      } else {
        await updateRoomStatus({ data: { roomId: itemId, status: newStatus as "available" | "occupied" | "reserved" | "cleaning" | "maintenance" | "blocked" | "emergency_reserved" } });
        toast.success("Room status updated");
      }
      await loadData();
      setStatusDialog({ open: false, item: null, type: null });
    } catch (error: any) {
      toast.error("Failed to update status", { description: error.message });
    }
  };

  // Statistics cards
  const bedStats = stats?.bedStats || {};
  const roomStats = stats?.roomStats || {};

  return (
    <RouteGuard requiredRole="admin">
      <div className="space-y-6 p-6">
        <PageHeader
          eyebrow="Hospital Infrastructure"
          title="Bed & Room Management"
          description="Manage hospital buildings, floors, wards, rooms, and bed allocation"
          actions={
            <div className="flex gap-2">
              <Button onClick={loadData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={() => setCreateDialog({ open: true, type: "building" })}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Building
              </Button>
            </div>
          }
        />

        {/* Statistics Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Beds</CardTitle>
              <Bed className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bedStats.total || 0}</div>
              <p className="text-xs text-muted-foreground">
                {bedStats.occupied || 0} occupied · {bedStats.available || 0} available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {bedStats.total
                  ? Math.round(((bedStats.occupied || 0) / bedStats.total) * 100)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">
                {bedStats.total - (bedStats.occupied || 0)} beds free
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Under Maintenance</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(bedStats.maintenance || 0) + (bedStats.cleaning || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {bedStats.maintenance || 0} maintenance · {bedStats.cleaning || 0} cleaning
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reserved</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(bedStats.reserved || 0) + (bedStats.emergency_reserved || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {bedStats.emergency_reserved || 0} emergency · {bedStats.reserved || 0} regular
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Hierarchy Navigation */}
        <Tabs defaultValue="hierarchy" className="space-y-4">
          <TabsList>
            <TabsTrigger value="hierarchy">Hierarchy View</TabsTrigger>
            <TabsTrigger value="beds">All Beds</TabsTrigger>
            <TabsTrigger value="rooms">All Rooms</TabsTrigger>
          </TabsList>

          <TabsContent value="hierarchy" className="space-y-4">
            {loading ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ) : buildings.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No buildings configured yet</p>
                    <Button
                      className="mt-4"
                      onClick={() => setCreateDialog({ open: true, type: "building" })}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Building
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {buildings.map((building) => {
                  const buildingFloors = floors.filter((f) => f.building_id === building.building_id);
                  const isExpanded = expandedItems.has(building.building_id);
                  
                  return (
                    <Card key={building.building_id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpand(building.building_id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                            <Building2 className="h-5 w-5 text-primary" />
                            <div>
                              <CardTitle className="text-lg">{building.building_name}</CardTitle>
                              {building.building_code && (
                                <p className="text-sm text-muted-foreground">
                                  Code: {building.building_code}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{buildingFloors.length} floors</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedBuilding(building);
                                setCreateDialog({ open: true, type: "floor" });
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Floor
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      
                      {isExpanded && (
                        <CardContent className="space-y-3">
                          {buildingFloors.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No floors added yet
                            </p>
                          ) : (
                            buildingFloors.map((floor) => (
                              <FloorItem
                                key={floor.floor_id}
                                floor={floor}
                                wards={wards.filter((w) => w.floor_id === floor.floor_id)}
                                rooms={rooms}
                                beds={beds}
                                expandedItems={expandedItems}
                                toggleExpand={toggleExpand}
                                onAddWard={() => {
                                  setSelectedBuilding(building);
                                  setSelectedFloor(floor);
                                  setCreateDialog({ open: true, type: "ward" });
                                }}
                                onAddRoom={(ward) => {
                                  setSelectedBuilding(building);
                                  setSelectedFloor(floor);
                                  setSelectedWard(ward);
                                  setCreateDialog({ open: true, type: "room" });
                                }}
                                onAddBed={(room) => {
                                  setSelectedRoom(room);
                                  setCreateDialog({ open: true, type: "bed" });
                                }}
                                onUpdateBedStatus={(bed) => {
                                  setStatusDialog({ open: true, item: bed, type: "bed" });
                                }}
                                onUpdateRoomStatus={(room) => {
                                  setStatusDialog({ open: true, item: room, type: "room" });
                                }}
                              />
                            ))
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="beds" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Beds ({beds.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {beds.map((bed) => (
                    <div
                      key={bed.bed_id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Bed className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{bed.bed_number || bed.bed_id}</p>
                          <p className="text-sm text-muted-foreground">
                            {bed.bed_type || "Standard"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={bed.status} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStatusDialog({ open: true, item: bed, type: "bed" })}
                        >
                          Update Status
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rooms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Rooms ({rooms.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rooms.map((room) => (
                    <div
                      key={room.room_id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{room.room_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {room.room_type || "General"} · Capacity: {room.capacity || 1}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={room.status} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStatusDialog({ open: true, item: room, type: "room" })}
                        >
                          Update Status
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <CreateDialog
          dialog={createDialog}
          onClose={() => {
            setCreateDialog({ open: false, type: null });
            setSelectedBuilding(null);
            setSelectedFloor(null);
            setSelectedWard(null);
            setSelectedRoom(null);
          }}
          onSuccess={loadData}
          selectedBuilding={selectedBuilding}
          selectedFloor={selectedFloor}
          selectedWard={selectedWard}
          selectedRoom={selectedRoom}
        />

        <StatusUpdateDialog
          dialog={statusDialog}
          onClose={() => setStatusDialog({ open: false, item: null, type: null })}
          onUpdate={handleUpdateStatus}
        />
      </div>
    </RouteGuard>
  );
}

// Helper Components
function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.available;
  const Icon = config.icon;
  
  return (
    <Badge variant="outline" className={config.color}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function FloorItem({
  floor,
  wards,
  rooms,
  beds,
  expandedItems,
  toggleExpand,
  onAddWard,
  onAddRoom,
  onAddBed,
  onUpdateBedStatus,
  onUpdateRoomStatus,
}: {
  floor: any;
  wards: any[];
  rooms: any[];
  beds: any[];
  expandedItems: Set<string>;
  toggleExpand: (id: string) => void;
  onAddWard: () => void;
  onAddRoom: (ward: any) => void;
  onAddBed: (room: any) => void;
  onUpdateBedStatus: (bed: any) => void;
  onUpdateRoomStatus: (room: any) => void;
}) {
  const isExpanded = expandedItems.has(floor.floor_id);
  
  return (
    <div className="border-l-2 border-primary/20 pl-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => toggleExpand(floor.floor_id)}>
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
          <Layers className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">{floor.floor_name}</p>
            <p className="text-xs text-muted-foreground">Floor {floor.floor_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{wards.length} wards</Badge>
          <Button variant="ghost" size="sm" onClick={onAddWard}>
            <Plus className="h-3 w-3 mr-1" />
            Ward
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="ml-8 space-y-2 mt-2">
          {wards.length === 0 ? (
            <p className="text-xs text-muted-foreground">No wards added yet</p>
          ) : (
            wards.map((ward) => {
              const wardRooms = rooms.filter((r) => r.ward_id === ward.ward_id);
              const wardExpanded = expandedItems.has(ward.ward_id);
              
              return (
                <div key={ward.ward_id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => toggleExpand(ward.ward_id)}>
                        {wardExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </Button>
                      <Home className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{ward.ward_name}</p>
                        <p className="text-xs text-muted-foreground">{ward.ward_type || "General"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{wardRooms.length} rooms</Badge>
                      <Button variant="ghost" size="sm" onClick={() => onAddRoom(ward)}>
                        <Plus className="h-3 w-3 mr-1" />
                        Room
                      </Button>
                    </div>
                  </div>

                  {wardExpanded && (
                    <div className="ml-6 space-y-2">
                      {wardRooms.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No rooms added yet</p>
                      ) : (
                        wardRooms.map((room) => {
                          const roomBeds = beds.filter((b) => b.room_id === room.room_id);
                          const roomExpanded = expandedItems.has(room.room_id);
                          
                          return (
                            <div key={room.room_id} className="border rounded p-2 space-y-2 bg-muted/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => toggleExpand(room.room_id)}>
                                    {roomExpanded ? <ChevronDown className="h-2 w-2" /> : <ChevronRight className="h-2 w-2" />}
                                  </Button>
                                  <Home className="h-3 w-3" />
                                  <div>
                                    <p className="text-xs font-medium">{room.room_name}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {room.room_type || "General"} · {roomBeds.length} beds
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <StatusBadge status={room.status} />
                                  <Button variant="ghost" size="sm" onClick={() => onUpdateRoomStatus(room)}>
                                    Update
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => onAddBed(room)}>
                                    <Plus className="h-2 w-2" />
                                  </Button>
                                </div>
                              </div>

                              {roomExpanded && (
                                <div className="ml-4 space-y-1">
                                  {roomBeds.length === 0 ? (
                                    <p className="text-[10px] text-muted-foreground">No beds</p>
                                  ) : (
                                    roomBeds.map((bed) => (
                                      <div key={bed.bed_id} className="flex items-center justify-between p-1.5 bg-background rounded text-xs">
                                        <div className="flex items-center gap-1">
                                          <Bed className="h-3 w-3" />
                                          <span>{bed.bed_number || bed.bed_id}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <StatusBadge status={bed.status} />
                                          <Button variant="ghost" size="sm" onClick={() => onUpdateBedStatus(bed)}>
                                            Update
                                          </Button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// Status Update Dialog
function StatusUpdateDialog({
  dialog,
  onClose,
  onUpdate,
}: {
  dialog: { open: boolean; item: any; type: "bed" | "room" | null };
  onClose: () => void;
  onUpdate: (itemId: string, status: string, type: "bed" | "room") => Promise<void>;
}) {
  const [selectedStatus, setSelectedStatus] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (dialog.item) {
      setSelectedStatus(dialog.item.status || "available");
    }
  }, [dialog.item]);

  const handleSubmit = async () => {
    if (!dialog.item || !dialog.type) return;
    setUpdating(true);
    try {
      const itemId = dialog.type === "bed" ? dialog.item.bed_id : dialog.item.room_id;
      await onUpdate(itemId, selectedStatus, dialog.type);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={dialog.open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update {dialog.type === "bed" ? "Bed" : "Room"} Status</DialogTitle>
          <DialogDescription>
            Change the status of{" "}
            {dialog.type === "bed"
              ? dialog.item?.bed_number || dialog.item?.bed_id
              : dialog.item?.room_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      {React.createElement(config.icon, { className: "h-4 w-4" })}
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={updating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updating}>
            {updating ? "Updating..." : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Create Dialog
function CreateDialog({
  dialog,
  onClose,
  onSuccess,
  selectedBuilding,
  selectedFloor,
  selectedWard,
  selectedRoom,
}: {
  dialog: { open: boolean; type: "building" | "floor" | "ward" | "room" | "bed" | null };
  onClose: () => void;
  onSuccess: () => void;
  selectedBuilding?: any;
  selectedFloor?: any;
  selectedWard?: any;
  selectedRoom?: any;
}) {
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      switch (dialog.type) {
        case "building":
          await createBuilding({ data: {
            name: formData.name,
            code: formData.code,
            description: formData.description,
            totalFloors: parseInt(formData.totalFloors || "0"),
          }});
          toast.success("Building created successfully");
          break;

        case "floor":
          await createFloor({ data: {
            buildingId: selectedBuilding.building_id,
            floorNumber: parseInt(formData.floorNumber),
            name: formData.name,
            description: formData.description,
          }});
          toast.success("Floor created successfully");
          break;

        case "ward":
          await createWard({ data: {
            floorId: selectedFloor.floor_id,
            buildingId: selectedBuilding.building_id,
            name: formData.name,
            code: formData.code,
            type: formData.type,
            description: formData.description,
            capacity: parseInt(formData.capacity || "0"),
          }});
          toast.success("Ward created successfully");
          break;

        case "room":
          await createRoom({ data: {
            wardId: selectedWard.ward_id,
            buildingId: selectedBuilding.building_id,
            name: formData.name,
            roomNumber: formData.roomNumber,
            roomType: formData.roomType,
            floor: selectedFloor.floor_name,
            capacity: parseInt(formData.capacity || "1"),
          }});
          toast.success("Room created successfully");
          break;

        case "bed":
          await createBed({ data: {
            roomId: selectedRoom.room_id,
            wardId: selectedRoom.ward_id,
            buildingId: selectedRoom.building_id,
            bedNumber: formData.bedNumber,
            bedType: formData.bedType,
          }});
          toast.success("Bed created successfully");
          break;
      }

      setFormData({});
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error("Failed to create", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={dialog.open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Add New {dialog.type ? dialog.type.charAt(0).toUpperCase() + dialog.type.slice(1) : ""}
          </DialogTitle>
          <DialogDescription>
            {dialog.type === "building" && "Create a new building in the hospital"}
            {dialog.type === "floor" && `Add a floor to ${selectedBuilding?.building_name}`}
            {dialog.type === "ward" && `Add a ward to ${selectedFloor?.floor_name}`}
            {dialog.type === "room" && `Add a room to ${selectedWard?.ward_name}`}
            {dialog.type === "bed" && `Add a bed to ${selectedRoom?.room_name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {dialog.type === "building" && (
            <>
              <div>
                <Label>Building Name *</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Main Block"
                />
              </div>
              <div>
                <Label>Building Code</Label>
                <Input
                  value={formData.code || ""}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="MB"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Emergency and outpatient services"
                />
              </div>
              <div>
                <Label>Total Floors</Label>
                <Input
                  type="number"
                  value={formData.totalFloors || ""}
                  onChange={(e) => setFormData({ ...formData, totalFloors: e.target.value })}
                  placeholder="5"
                />
              </div>
            </>
          )}

          {dialog.type === "floor" && (
            <>
              <div>
                <Label>Floor Number *</Label>
                <Input
                  type="number"
                  value={formData.floorNumber || ""}
                  onChange={(e) => setFormData({ ...formData, floorNumber: e.target.value })}
                  placeholder="1"
                />
              </div>
              <div>
                <Label>Floor Name *</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ground Floor"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Emergency and OPD"
                />
              </div>
            </>
          )}

          {dialog.type === "ward" && (
            <>
              <div>
                <Label>Ward Name *</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="General Ward A"
                />
              </div>
              <div>
                <Label>Ward Code</Label>
                <Input
                  value={formData.code || ""}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="GW-A"
                />
              </div>
              <div>
                <Label>Ward Type</Label>
                <Select value={formData.type || ""} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">General</SelectItem>
                    <SelectItem value="ICU">ICU</SelectItem>
                    <SelectItem value="Emergency">Emergency</SelectItem>
                    <SelectItem value="Pediatric">Pediatric</SelectItem>
                    <SelectItem value="Maternity">Maternity</SelectItem>
                    <SelectItem value="Surgery">Surgery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={formData.capacity || ""}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="30"
                />
              </div>
            </>
          )}

          {dialog.type === "room" && (
            <>
              <div>
                <Label>Room Name *</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Room 101"
                />
              </div>
              <div>
                <Label>Room Number</Label>
                <Input
                  value={formData.roomNumber || ""}
                  onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                  placeholder="101"
                />
              </div>
              <div>
                <Label>Room Type</Label>
                <Select value={formData.roomType || ""} onValueChange={(v) => setFormData({ ...formData, roomType: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Double">Double</SelectItem>
                    <SelectItem value="ICU">ICU</SelectItem>
                    <SelectItem value="Emergency">Emergency</SelectItem>
                    <SelectItem value="Operating">Operating</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bed Capacity</Label>
                <Input
                  type="number"
                  value={formData.capacity || ""}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="1"
                />
              </div>
            </>
          )}

          {dialog.type === "bed" && (
            <>
              <div>
                <Label>Bed Number</Label>
                <Input
                  value={formData.bedNumber || ""}
                  onChange={(e) => setFormData({ ...formData, bedNumber: e.target.value })}
                  placeholder="B-01"
                />
              </div>
              <div>
                <Label>Bed Type</Label>
                <Select value={formData.bedType || ""} onValueChange={(v) => setFormData({ ...formData, bedType: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="ICU">ICU</SelectItem>
                    <SelectItem value="Pediatric">Pediatric</SelectItem>
                    <SelectItem value="Electric">Electric</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
