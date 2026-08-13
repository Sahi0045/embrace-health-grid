import { CheckCircle2, Clock, MapPin, ShieldCheck, User, Sparkles } from "lucide-react";

export interface RoomStatusBarProps {
  userName: string;
  userRole?: string;
  isVerified: boolean;
  activeRoomsCount: number;
  todayEventsCount: number;
  totalRoomsCount: number;
  activeRooms?: Array<{ roomId: string; roomName: string }>;
}

export function RoomStatusBar({
  userName,
  userRole = "Staff",
  isVerified,
  activeRoomsCount,
  todayEventsCount,
  totalRoomsCount,
  activeRooms = [],
}: RoomStatusBarProps) {
  // Get initials for avatar fallback
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 md:p-6 shadow-clinical-sm transition-all duration-200">
      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Left Side: Avatar + Name + Badges + Duty Status */}
        <div className="flex items-center gap-3.5">
          {/* Avatar Initials Ring */}
          <div className="relative shrink-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/25 text-primary font-display font-extrabold text-sm shadow-xs">
              {initials || <User className="h-5 w-5" />}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
                isVerified ? "bg-success" : "bg-warning"
              }`}
              title={isVerified ? "Verified Node" : "Pending Verification"}
            />
          </div>

          {/* User Details */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-extrabold text-base text-foreground tracking-tight">
                {userName}
              </h2>
              <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase">
                {userRole}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                  isVerified
                    ? "bg-success/10 text-success border-success/30"
                    : "bg-warning/10 text-warning-foreground border-warning/30"
                }`}
              >
                {isVerified ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Verified Node
                  </>
                ) : (
                  <>
                    <Clock className="h-3 w-3" /> Verification Pending
                  </>
                )}
              </span>
            </div>

            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              {activeRoomsCount > 0 ? (
                <span className="text-success font-semibold flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  Checked into {activeRoomsCount} room{activeRoomsCount > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary/70" />
                  Standby Duty · Select rooms below to check in
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right Side: Sleek Typographic Metric Group with Vertical Dividers */}
        <div className="flex items-center divide-x divide-border/60 rounded-xl border border-border/70 bg-background/80 py-2 px-1 shadow-xs shrink-0">
          <div className="px-4 text-center min-w-[80px]">
            <div className="text-lg font-extrabold font-display text-success leading-none">
              {activeRoomsCount}
            </div>
            <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mt-1">
              Active
            </div>
          </div>

          <div className="px-4 text-center min-w-[80px]">
            <div className="text-lg font-extrabold font-display text-primary leading-none">
              {todayEventsCount}
            </div>
            <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mt-1">
              Actions
            </div>
          </div>

          <div className="px-4 text-center min-w-[80px]">
            <div className="text-lg font-extrabold font-display text-foreground leading-none">
              {totalRoomsCount}
            </div>
            <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mt-1">
              Total
            </div>
          </div>
        </div>
      </div>

      {/* Active Room Location Pills Footer */}
      {activeRooms.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-border/50 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mr-1">
            Active Locations:
          </span>
          {activeRooms.map((room) => (
            <span
              key={room.roomId}
              className="inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-bold text-success"
            >
              <MapPin className="h-3 w-3" />
              <span>{room.roomName || room.roomId}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
