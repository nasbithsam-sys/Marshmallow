import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { Activity, Edit, Plus, Trash2, Eye } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ActivityLog } from '@/types';

const actionIcons: Record<string, React.ElementType> = {
  create: Plus,
  update: Edit,
  delete: Trash2,
  view: Eye,
};

const ActivityLogs = () => {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as ActivityLog[];
    },
  });

  const getInitials = (name: string) =>
    name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

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
          {/* Timeline line */}
          <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border" />

          <div className="space-y-1">
            {logs.map((log) => {
              const Icon = actionIcons[log.action.toLowerCase()] || Activity;
              return (
                <div key={log.id} className="flex gap-4 items-start relative pl-0 py-2">
                  {/* Timeline dot */}
                  <div className="w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center shrink-0 z-10">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <Card className="flex-1 border">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
                        {getInitials(log.user_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{log.user_name}</span>
                          <span className="text-xs text-muted-foreground">{log.action}</span>
                          <span className="text-xs text-muted-foreground capitalize">{log.target_type}</span>
                        </div>
                        {log.details && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{log.details}</p>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                        </TooltipContent>
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
