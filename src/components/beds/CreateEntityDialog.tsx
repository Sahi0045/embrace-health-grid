import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBuilding,
  createFloor,
  createWard,
  createRoom,
  createBed,
} from "@/lib/operations.server";
import { toast } from "sonner";

interface CreateEntityDialogProps {
  dialog: { open: boolean; type: "building" | "floor" | "ward" | "room" | "bed" | null };
  onClose: () => void;
  onSuccess: () => void;
  selectedBuilding?: any;
  selectedFloor?: any;
  selectedWard?: any;
  selectedRoom?: any;
}

export function CreateEntityDialog({
  dialog,
  onClose,
  onSuccess,
  selectedBuilding,
  selectedFloor,
  selectedWard,
  selectedRoom,
}: CreateEntityDialogProps) {
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      switch (dialog.type) {
        case "building":
          await createBuilding({
            data: {
              name: formData.name,
              code: formData.code,
              description: formData.description,
              totalFloors: parseInt(formData.totalFloors || "0"),
            },
          });
          toast.success("Building created successfully");
          break;

        case "floor":
          await createFloor({
            data: {
              buildingId: selectedBuilding.building_id,
              floorNumber: parseInt(formData.floorNumber),
              name: formData.name,
              description: formData.description,
            },
          });
          toast.success("Floor created successfully");
          break;

        case "ward":
          await createWard({
            data: {
              floorId: selectedFloor.floor_id,
              buildingId: selectedBuilding.building_id,
              name: formData.name,
              code: formData.code,
              type: formData.type,
              description: formData.description,
              capacity: parseInt(formData.capacity || "0"),
            },
          });
          toast.success("Ward created successfully");
          break;

        case "room":
          await createRoom({
            data: {
              wardId: selectedWard.ward_id,
              buildingId: selectedBuilding.building_id,
              name: formData.name,
              roomNumber: formData.roomNumber,
              roomType: formData.roomType,
              floor: selectedFloor?.floor_name,
              capacity: parseInt(formData.capacity || "1"),
            },
          });
          toast.success("Room created successfully");
          break;

        case "bed":
          await createBed({
            data: {
              roomId: selectedRoom.room_id,
              wardId: selectedRoom.ward_id,
              buildingId: selectedRoom.building_id,
              bedNumber: formData.bedNumber,
              bedType: formData.bedType,
            },
          });
          toast.success("Bed created successfully");
          break;
      }

      setFormData({});
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error("Failed to create entity", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = dialog.type ? dialog.type.charAt(0).toUpperCase() + dialog.type.slice(1) : "";

  return (
    <Dialog open={dialog.open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-clinical-xl">
        <DialogHeader>
          <DialogTitle className="font-display font-extrabold text-lg text-foreground tracking-tight">
            Add New {typeLabel}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {dialog.type === "building" && "Create a new building in the hospital infrastructure"}
            {dialog.type === "floor" && `Add a floor to ${selectedBuilding?.building_name}`}
            {dialog.type === "ward" && `Add a ward to ${selectedFloor?.floor_name}`}
            {dialog.type === "room" && `Add a room to ${selectedWard?.ward_name}`}
            {dialog.type === "bed" && `Add a bed to ${selectedRoom?.room_name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {dialog.type === "building" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Building Name *</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Main Specialty Block"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Building Code</Label>
                <Input
                  value={formData.code || ""}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="MSB-01"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Description</Label>
                <Input
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Inpatient and surgery services"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Total Floors</Label>
                <Input
                  type="number"
                  value={formData.totalFloors || ""}
                  onChange={(e) => setFormData({ ...formData, totalFloors: e.target.value })}
                  placeholder="5"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
            </>
          )}

          {dialog.type === "floor" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Floor Number *</Label>
                <Input
                  type="number"
                  value={formData.floorNumber || ""}
                  onChange={(e) => setFormData({ ...formData, floorNumber: e.target.value })}
                  placeholder="1"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Floor Name *</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="2nd Floor Surgical Care"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Description</Label>
                <Input
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Post-op recovery and ICU"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
            </>
          )}

          {dialog.type === "ward" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Ward Name *</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ICU Ward Alpha"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Ward Code</Label>
                <Input
                  value={formData.code || ""}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="ICU-A"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Ward Type</Label>
                <Select
                  value={formData.type || ""}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger className="rounded-xl border border-border bg-background text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border">
                    <SelectItem value="General" className="text-xs">
                      General
                    </SelectItem>
                    <SelectItem value="ICU" className="text-xs">
                      ICU
                    </SelectItem>
                    <SelectItem value="Emergency" className="text-xs">
                      Emergency
                    </SelectItem>
                    <SelectItem value="Pediatric" className="text-xs">
                      Pediatric
                    </SelectItem>
                    <SelectItem value="Maternity" className="text-xs">
                      Maternity
                    </SelectItem>
                    <SelectItem value="Surgery" className="text-xs">
                      Surgery
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Capacity</Label>
                <Input
                  type="number"
                  value={formData.capacity || ""}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="20"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
            </>
          )}

          {dialog.type === "room" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Room Name *</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Suite 302"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Room Number</Label>
                <Input
                  value={formData.roomNumber || ""}
                  onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                  placeholder="302"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Room Type</Label>
                <Select
                  value={formData.roomType || ""}
                  onValueChange={(v) => setFormData({ ...formData, roomType: v })}
                >
                  <SelectTrigger className="rounded-xl border border-border bg-background text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border">
                    <SelectItem value="Single" className="text-xs">
                      Single
                    </SelectItem>
                    <SelectItem value="Double" className="text-xs">
                      Double
                    </SelectItem>
                    <SelectItem value="ICU" className="text-xs">
                      ICU
                    </SelectItem>
                    <SelectItem value="Emergency" className="text-xs">
                      Emergency
                    </SelectItem>
                    <SelectItem value="Operating" className="text-xs">
                      Operating
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Bed Capacity</Label>
                <Input
                  type="number"
                  value={formData.capacity || ""}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="2"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
            </>
          )}

          {dialog.type === "bed" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Bed Number *</Label>
                <Input
                  value={formData.bedNumber || ""}
                  onChange={(e) => setFormData({ ...formData, bedNumber: e.target.value })}
                  placeholder="B-101"
                  className="rounded-xl border-border bg-background text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Bed Type</Label>
                <Select
                  value={formData.bedType || ""}
                  onValueChange={(v) => setFormData({ ...formData, bedType: v })}
                >
                  <SelectTrigger className="rounded-xl border border-border bg-background text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border">
                    <SelectItem value="Standard" className="text-xs">
                      Standard
                    </SelectItem>
                    <SelectItem value="ICU" className="text-xs">
                      ICU
                    </SelectItem>
                    <SelectItem value="Pediatric" className="text-xs">
                      Pediatric
                    </SelectItem>
                    <SelectItem value="Electric" className="text-xs">
                      Electric
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl h-10 text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-xl h-10 text-xs font-extrabold bg-gradient-to-r from-primary to-blue-600 text-primary-foreground shadow-clinical-md"
          >
            {submitting ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
