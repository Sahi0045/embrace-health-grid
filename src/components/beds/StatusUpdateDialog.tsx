import { useState, useEffect } from "react";
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
import { CheckCircle2, Users, Clock, Activity, Wrench, Ban, Shield } from "lucide-react";

interface StatusUpdateDialogProps {
  dialog: { open: boolean; item: any; type: "bed" | "room" | null };
  onClose: () => void;
  onUpdate: (
    itemId: string,
    status: string,
    type: "bed" | "room",
    patientDid?: string,
  ) => Promise<void>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  available: { label: "Available", icon: CheckCircle2 },
  occupied: { label: "Occupied", icon: Users },
  reserved: { label: "Reserved", icon: Clock },
  cleaning: { label: "Cleaning", icon: Activity },
  maintenance: { label: "Maintenance", icon: Wrench },
  blocked: { label: "Blocked", icon: Ban },
  emergency_reserved: { label: "Emergency Reserved", icon: Shield },
};

export function StatusUpdateDialog({ dialog, onClose, onUpdate }: StatusUpdateDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState("");
  const [patientDid, setPatientDid] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (dialog.item) {
      setSelectedStatus(dialog.item.status || "available");
      setPatientDid(dialog.item.patient_did || "");
    }
  }, [dialog.item]);

  const handleSubmit = async () => {
    if (!dialog.item || !dialog.type) return;
    setUpdating(true);
    try {
      const itemId = dialog.type === "bed" ? dialog.item.bed_id : dialog.item.room_id;
      await onUpdate(
        itemId,
        selectedStatus,
        dialog.type,
        selectedStatus === "occupied" ? patientDid : undefined,
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={dialog.open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-clinical-xl">
        <DialogHeader>
          <DialogTitle className="font-display font-extrabold text-lg text-foreground tracking-tight">
            Update {dialog.type === "bed" ? "Bed" : "Room"} Status
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Change operational status for{" "}
            <span className="font-bold text-foreground">
              {dialog.type === "bed"
                ? dialog.item?.bed_number || dialog.item?.bed_id
                : dialog.item?.room_name}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">Operational Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="rounded-xl border border-border bg-background text-xs font-medium focus:ring-2 focus:ring-primary/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-border shadow-clinical-md">
                {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem key={key} value={key} className="text-xs font-medium rounded-lg">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {dialog.type === "bed" && selectedStatus === "occupied" && (
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">
                Patient DID (Required when occupied)
              </Label>
              <Input
                value={patientDid}
                onChange={(e) => setPatientDid(e.target.value)}
                placeholder="did:solana:..."
                className="rounded-xl bg-background border border-border text-xs font-mono"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={updating}
            className="flex-1 rounded-xl h-10 text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updating}
            className="flex-1 rounded-xl h-10 text-xs font-extrabold bg-gradient-to-r from-primary to-blue-600 text-primary-foreground shadow-clinical-md"
          >
            {updating ? "Updating..." : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
