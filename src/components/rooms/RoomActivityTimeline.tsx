import { ActivityItem } from "@/components/dashboard/ActivityItem";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  History,
  Loader2,
  LogIn,
  LogOut,
  Search,
  TreePine,
  ShieldCheck,
  CheckCircle2,
  Hash,
  Copy,
} from "lucide-react";
import { useState } from "react";

export interface RoomEventItem {
  id: string;
  roomName?: string;
  roomId?: string;
  action: "checkin" | "checkout" | string;
  timestamp: string;
}

export interface RoomActivityTimelineProps {
  events: RoomEventItem[];
  dailyEvents?: any[];
  dailyRoot?: string | null;
  dailyDate?: string;
  loading?: boolean;
}

export function RoomActivityTimeline({
  events,
  dailyEvents = [],
  dailyRoot = null,
  dailyDate = "",
  loading = false,
}: RoomActivityTimelineProps) {
  const [activeTab, setActiveTab] = useState<"history" | "daily">("history");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<"all" | "checkin" | "checkout">("all");
  const [copiedRoot, setCopiedRoot] = useState(false);

  const checkinCount = events.filter((e) => e.action === "checkin").length;
  const checkoutCount = events.filter((e) => e.action === "checkout").length;

  const filteredEvents = events.filter((e) => {
    const matchesAction = actionFilter === "all" || e.action === actionFilter;
    const name = e.roomName || e.roomId || "";
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesAction && matchesSearch;
  });

  const filteredDaily = dailyEvents.filter((e: any) => {
    const name = e.room_name || e.room_id || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-5 shadow-clinical-sm">
      {/* 2-Tab Segment Switcher Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        {/* Tab Buttons — Flat Single Level */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-extrabold border transition-all ${
              activeTab === "history"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border hover:text-foreground bg-background"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Activity History</span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                activeTab === "history"
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {events.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-extrabold border transition-all ${
              activeTab === "daily"
                ? "bg-success text-success-foreground border-success shadow-xs"
                : "border-border/80 text-muted-foreground hover:border-border hover:text-foreground bg-background"
            }`}
          >
            <TreePine className="h-3.5 w-3.5" />
            <span>Daily Room Events</span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                activeTab === "daily" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {dailyEvents.length}
            </span>
          </button>
        </div>

        {/* Tab Right Controls */}
        {activeTab === "history" ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActionFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-extrabold border transition-all ${
                actionFilter === "all"
                  ? "bg-foreground text-background border-foreground shadow-xs"
                  : "border-border/80 text-muted-foreground hover:border-border hover:text-foreground bg-background"
              }`}
            >
              All ({events.length})
            </button>

            <button
              type="button"
              onClick={() => setActionFilter(actionFilter === "checkin" ? "all" : "checkin")}
              className={`rounded-full px-3 py-1 text-xs font-extrabold border transition-all flex items-center gap-1 ${
                actionFilter === "checkin"
                  ? "bg-success text-success-foreground border-success shadow-xs"
                  : "border-border/80 text-muted-foreground hover:border-success/40 hover:text-success bg-background"
              }`}
            >
              <LogIn className="h-3 w-3" /> In ({checkinCount})
            </button>

            <button
              type="button"
              onClick={() => setActionFilter(actionFilter === "checkout" ? "all" : "checkout")}
              className={`rounded-full px-3 py-1 text-xs font-extrabold border transition-all flex items-center gap-1 ${
                actionFilter === "checkout"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "border-border/80 text-muted-foreground hover:border-primary/40 hover:text-primary bg-background"
              }`}
            >
              <LogOut className="h-3 w-3" /> Out ({checkoutCount})
            </button>
          </div>
        ) : (
          dailyRoot && (
            <div className="flex items-center gap-1.5 text-xs font-medium bg-success/10 border border-success/30 px-3 py-1 rounded-full shrink-0 transition-all hover:border-success/50">
              <ShieldCheck className="h-3.5 w-3.5 text-success shrink-0" />
              <span className="font-extrabold text-foreground">Root:</span>
              <span className="font-mono font-bold text-success text-[11px]" title={dailyRoot}>
                {dailyRoot.length > 12
                  ? `${dailyRoot.slice(0, 6)}...${dailyRoot.slice(-4)}`
                  : dailyRoot}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(dailyRoot);
                  setCopiedRoot(true);
                  setTimeout(() => setCopiedRoot(false), 2000);
                }}
                className="p-1 rounded-md text-success/70 hover:text-success hover:bg-success/20 transition-colors"
                title="Copy Merkle Root"
              >
                {copiedRoot ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )
        )}
      </div>

      {/* Filter / Search Bar */}
      {(activeTab === "history" ? events.length > 0 : dailyEvents.length > 0) && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              activeTab === "history"
                ? "Search activity log by room name..."
                : "Search daily room events by room name..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl bg-background border border-border pl-9 pr-4 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
          />
        </div>
      )}

      {/* TAB 1: ACTIVITY HISTORY VIEW */}
      {activeTab === "history" && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-10 text-center space-y-2.5">
              <Clock className="h-9 w-9 text-muted-foreground/30 mx-auto" />
              <h4 className="font-bold text-sm text-foreground">
                {searchTerm || actionFilter !== "all"
                  ? "No matching activity log"
                  : "No duty actions logged today"}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchTerm || actionFilter !== "all"
                  ? "Try clearing filters or search query."
                  : "Check-ins and check-outs will appear here in real-time."}
              </p>
            </div>
          ) : (
            <div className="space-y-1 divide-y divide-border/40 max-h-[500px] overflow-y-auto pr-1">
              {filteredEvents.map((evt, idx) => {
                const isCheckin = evt.action === "checkin";
                const roomDisplayName = evt.roomName || evt.roomId || "Medical Unit";
                const formattedTime = evt.timestamp
                  ? new Date(evt.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Just now";
                const formattedDate = evt.timestamp
                  ? new Date(evt.timestamp).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })
                  : "Today";

                return (
                  <ActivityItem
                    key={evt.id || idx}
                    icon={isCheckin ? LogIn : LogOut}
                    severity={isCheckin ? "success" : "info"}
                    title={`${isCheckin ? "Checked into" : "Checked out of"} ${roomDisplayName}`}
                    subtitle={`Recorded on ${formattedDate}`}
                    time={formattedTime}
                    badge={
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 ${
                          isCheckin
                            ? "bg-success/10 text-success border-success/30"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {isCheckin ? "Check-In" : "Check-Out"}
                      </Badge>
                    }
                    isLast={idx === filteredEvents.length - 1}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: DAILY ROOM EVENTS VIEW */}
      {activeTab === "daily" && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : filteredDaily.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-10 text-center space-y-2.5">
              <TreePine className="h-9 w-9 text-muted-foreground/30 mx-auto" />
              <h4 className="font-bold text-sm text-foreground">
                {searchTerm ? "No matching daily events" : "No Merkle events logged today"}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchTerm
                  ? "Try clearing your search term."
                  : "Daily room events will accumulate here to build the Merkle Root proof."}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredDaily.map((evt: any, idx: number) => {
                const isCheckin = evt.action === "checkin";
                const eventTime = evt.occurred_at
                  ? new Date(evt.occurred_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "Recorded today";

                return (
                  <div
                    key={evt.event_id || idx}
                    className="rounded-2xl border border-border/80 bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-border transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {/* Sequence Badge */}
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-card border border-border/80 font-mono text-xs font-extrabold text-foreground shadow-xs">
                        #{idx + 1}
                      </span>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-foreground truncate">
                            {evt.room_name || evt.room_id || "Medical Room"}
                          </h4>
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-extrabold uppercase px-2 py-0.5 ${
                              isCheckin
                                ? "bg-success/15 text-success border-success/30"
                                : "bg-primary/15 text-primary border-primary/30"
                            }`}
                          >
                            {isCheckin ? "Check-In" : "Check-Out"}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                          <span>ID: {evt.event_id || `EVT-${idx + 1}`}</span>
                          <span>·</span>
                          <span>{eventTime}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/30 px-2.5 py-0.5 text-[10px] font-extrabold text-success">
                        <CheckCircle2 className="h-3 w-3" /> Merkle Leaf #{idx + 1}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
