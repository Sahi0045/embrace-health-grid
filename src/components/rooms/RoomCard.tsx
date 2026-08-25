import { CheckCircle2 } from "lucide-react";

export interface RoomCardProps {
  room: {
    id: string;
    roomId?: string;
    name: string;
    roomName?: string;
    floor: string | number;
    type?: string;
    category?: string;
    currentOccupant?: string | null;
  };
  isSelected: boolean;
  isCheckedIn: boolean;
  onToggle: (id: string) => void;
}

/**
 * Department identity, drawn from the categorical ramp (--chart-1..6) rather
 * than semantic tokens: these hues carry information, so collapsing them onto
 * primary/warning would make ICU and Theatre indistinguishable.
 *
 * Hue assignment stays as close to the previous palette as the ramp allows
 * (blue→teal blue, emerald→jade, purple→plum, amber→ochre) so anyone who has
 * learned the wards by colour is not relearning from scratch. ER is the one
 * exception and takes `destructive`: it is genuinely the urgent department, not
 * merely another category.
 *
 * No `dark:` variants — the chart tokens already swap with the theme.
 */
const CATEGORY_COLORS: Record<string, string> = {
  CARDIOLOGY: "bg-chart-4/10 text-chart-4 border-chart-4/30",
  OPD: "bg-chart-4/10 text-chart-4 border-chart-4/30",
  GENERAL: "bg-chart-1/10 text-chart-1 border-chart-1/30",
  WARD: "bg-chart-1/10 text-chart-1 border-chart-1/30",
  THEATRE: "bg-chart-5/10 text-chart-5 border-chart-5/30",
  OT: "bg-chart-5/10 text-chart-5 border-chart-5/30",
  ICU: "bg-chart-3/10 text-chart-3 border-chart-3/30",
  DIAG: "bg-chart-6/10 text-chart-6 border-chart-6/30",
  LAB: "bg-chart-2/10 text-chart-2 border-chart-2/30",
  ER: "bg-destructive/10 text-destructive border-destructive/30",
};

export function RoomCard({ room, isSelected, isCheckedIn, onToggle }: RoomCardProps) {
  const targetId = String(room.id || room.roomId || "").trim();
  const displayName = String(room.name || room.roomName || targetId || "Medical Room").trim();
  const rawCategory = String(room.category || room.type || "General")
    .trim()
    .toUpperCase();
  const displayFloor = room.floor ?? "1";

  const categoryStyle =
    CATEGORY_COLORS[rawCategory] ?? "bg-muted text-muted-foreground border-border";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(targetId);
      }}
      className={`relative w-full text-left rounded-2xl border p-4.5 transition-all duration-150 select-none flex flex-col justify-between space-y-3 ${
        isSelected
          ? "border-primary ring-2 ring-primary/30 bg-primary/5 shadow-clinical-sm"
          : isCheckedIn
            ? "border-success/60 bg-success/5 dark:bg-success/10"
            : "border-border/80 bg-card hover:border-primary/40 hover:shadow-clinical-sm"
      }`}
    >
      {/* Top Row: Category Tag + Floor + Selection Checkbox */}
      <div className="flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${categoryStyle}`}
          >
            {rawCategory}
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {typeof displayFloor === "number" ? `Floor ${displayFloor}` : displayFloor}
          </span>
        </div>

        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
            isSelected
              ? "bg-primary border-primary text-primary-foreground shadow-xs"
              : "border-border/80 bg-background"
          }`}
        >
          {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
        </div>
      </div>

      {/* Room Code / Name */}
      <div className="pointer-events-none py-1">
        <h3 className="font-display font-extrabold text-xl text-foreground tracking-tight line-clamp-1">
          {displayName}
        </h3>
      </div>

      {/* Status Line */}
      <div className="pt-2 border-t border-border/40 flex items-center justify-between pointer-events-none">
        {isCheckedIn ? (
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-success">
            <span className="h-2 w-2 rounded-full bg-success shrink-0" />
            <span>Checked In</span>
          </div>
        ) : room.currentOccupant ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-warning-foreground truncate max-w-[150px]">
            <span className="h-2 w-2 rounded-full bg-warning shrink-0" />
            <span className="truncate">{room.currentOccupant}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
            <span>Available</span>
          </div>
        )}
      </div>
    </button>
  );
}
