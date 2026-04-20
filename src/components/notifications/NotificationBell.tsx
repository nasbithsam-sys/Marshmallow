import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const NOTIFICATION_POLL_INTERVAL_MS = 5 * 60 * 1000;

interface Notification {
  id: string;
  title: string;
  message: string;
  lead_id: string | null;
  read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data as Notification[]);
  }, [user]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void fetchNotifications();
      }
    };

    refreshIfVisible();

    const interval = setInterval(refreshIfVisible, NOTIFICATION_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) {
      void fetchNotifications();
    }
  }, [fetchNotifications, open]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    fetchNotifications();
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    }
    setOpen(false);
    if (n.lead_id) navigate(`/leads/${n.lead_id}`);
    fetchNotifications();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground shadow-[0_0_10px_hsl(var(--destructive)/0.3)]">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-premium-xl border-border/40" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-primary" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-72">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                <Bell className="h-5 w-5 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors ${!n.read ? 'bg-primary/[0.03]' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] ${!n.read ? 'font-semibold' : 'font-medium'} text-foreground`}>{n.title}</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/40 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
