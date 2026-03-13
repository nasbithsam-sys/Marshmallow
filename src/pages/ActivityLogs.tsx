import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  Edit,
  Plus,
  Trash2,
  Eye,
  DollarSign,
  StickyNote,
  Share2,
  KeyRound,
  UserPlus,
  Camera,
  RefreshCw,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ActivityLog } from "@/types";

const actionIcons: Record<string, React.ElementType> = {
  create: Plus,
  created: Plus,
  update: Edit,
  updated: Edit,
  delete: Trash2,
  deleted: Trash2,
  view: Eye,
  viewed: Eye,
  status_changed: RefreshCw,
  payment_recorded: DollarSign,
  note_added: StickyNote,
  shared: Share2,
  password_changed: KeyRound,
  user_created: UserPlus,
  photos_uploaded: Camera,
};

const actionBadgeClasses: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-700 border-emerald-200",
  created: "bg-emerald-50 text-emerald-700 border-emerald-200",
  update: "bg-blue-50 text-blue-700 border-blue-200",
  updated: "bg-blue-50 text-blue-700 border-blue-200",
  delete: "bg-red-50 text-red-700 border-red-200",
  deleted: "bg-red-50 text-red-700 border-red-200",
  status_changed: "bg-amber-50 text-amber-700 border-amber-200",
  payment_recorded: "bg-green-50 text-green-700 border-green-200",
  note_added: "bg-violet-50 text-violet-700 border-violet-200",
  shared: "bg-cyan-50 text-cyan-700 border-cyan-200",
  password_changed: "bg-orange-50 text-orange-700 border-orange-200",
  photos_uploaded: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
};

const prettyText = (value?: string | null) => {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const ActivityLogs = () => {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as ActivityLog[];
    },
  });

  const getInitials = (name: string) =>
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const parseDetails = (details: unknown) => {
    if (!details) return null;

    if (typeof details === "object") return details as Record<string, unknown>;

    if (typeof details === "string") {
      try {
        return JSON.parse(details) as Record<string, unknown>;
      } catch {
        return { raw: details };
      }
    }

    return null;
  };

  const getReadableMessage = (log: ActivityLog) => {
    const parsed = parseDetails(log.details);

    if (parsed?.message && typeof parsed.message === "string") {
      return parsed.message;
    }

    if (parsed?.raw && typeof parsed.raw === "string") {
      return parsed.raw;
    }

    const actor = log.user_name || "Unknown";
    const action = prettyText(log.action).toLowerCase();
    const targetType = prettyText(log.target_type).toLowerCase();
    const targetId = log.target_id ? ` ${log.target_id}` : "";

    return `${actor} ${action} ${targetType}${targetId}`;
  };

  const getSecondaryDetails = (log: ActivityLog) => {
    const parsed = parseDetails(log.details);
    if (!parsed || typeof parsed !== "object") return null;

    const changes = parsed.changes;
    if (!changes || typeof changes !== "object" || Array.isArray(changes)) return null;

    const items = Object.entries(changes as Record<string, any>)
      .map(([key, value]) => {
        if (!value || typeof value !== "object") return null;
        const before = value.before ?? "empty";
        const after = value.after ?? "empty";
        if (before === after) return null;
        return `${prettyText(key)}: ${String(before)} → ${String(after)}`;
      })
      .filter(Boolean)
      .slice(0, 2);

    return items.length ? items.join(" • ") : null;
  };

  const getActionLabel = (action: string) => prettyText(action);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Activity Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Recent actions across the system</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-start">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-72" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border rounded-lg">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Activity className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium mb-1">No activity yet</p>
          <p className="text-sm text-muted-foreground">Actions will appear here as they happen</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border" />

          <div className="space-y-2">
            {logs.map((log) => {
              const Icon = actionIcons[log.action.toLowerCase()] || Activity;
              const badgeClass =
                actionBadgeClasses[log.action.toLowerCase()] || "bg-muted text-muted-foreground border-border";
              const message = getReadableMessage(log);
              const secondary = getSecondaryDetails(log);

              return (
                <div key={log.id} className="flex gap-4 items-start relative py-1">
                  <div className="w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center shrink-0 z-10">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <Card className="flex-1 border">
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
                        {getInitials(log.user_name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-foreground">{log.user_name || "Unknown"}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeClass}`}>
                            {getActionLabel(log.action)}
                          </span>
                          <span className="text-[11px] text-muted-foreground capitalize">
                            {prettyText(log.target_type)}
                          </span>
                        </div>

                        <p className="text-sm text-foreground leading-5 break-words">{message}</p>

                        {secondary && <p className="text-xs text-muted-foreground mt-1 break-words">{secondary}</p>}

                        {log.target_id && (
                          <p className="text-[11px] text-muted-foreground mt-1">Target ID: {log.target_id}</p>
                        )}
                      </div>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{format(new Date(log.created_at), "MMM d, yyyy h:mm a")}</TooltipContent>
                      </Tooltip>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;
