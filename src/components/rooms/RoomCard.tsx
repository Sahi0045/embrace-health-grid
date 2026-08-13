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

const CATEGORY_COLORS: Record<string, string> = {
  CARDIOLOGY: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  GENERAL: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  THEATRE: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  OPD: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  WARD: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  OT: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  ER: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  ICU: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  DIAG: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  LAB: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
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
