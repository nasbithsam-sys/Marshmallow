import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ArrowUpRight } from "lucide-react";

interface UrgentNotification {
  id: string;
  title: string;
  message: string;
  lead_id: string | null;
  created_at: string;
  read: boolean;
}

const POLL_MS = 30000;

export default function UrgentLeadPopup() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<UrgentNotification[]>([]);

  const eligible = role === "admin" || role === "processor";

  const fetchUrgent = useCallback(async () => {
    if (!user || !eligible) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("read", false)
      .ilike("title", "%Urgent Job%")
      .order("created_at", { ascending: false })
      .limit(5);
    if (data) setItems(data as UrgentNotification[]);
  }, [user, eligible]);

  useEffect(() => {
    if (!eligible) return;
    void fetchUrgent();
    const interval = setInterval(fetchUrgent, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchUrgent, eligible]);

  const dismiss = async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  const openLead = async (n: UrgentNotification) => {
    await dismiss(n.id);
    if (n.lead_id) navigate(`/leads/${n.lead_id}`);
  };

  if (!eligible || items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2.5">
      <AnimatePresence initial={false}>
        {items.map((n) => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="pointer-events-auto relative overflow-hidden rounded-2xl border-2 border-destructive/40 bg-card shadow-[0_22px_50px_-18px_rgba(239,68,68,0.45)]"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-destructive via-destructive/80 to-destructive/40 animate-pulse" />
            <div className="flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-destructive">{n.title}</p>
                <p className="mt-0.5 text-[12px] leading-5 text-foreground/85 line-clamp-3">{n.message}</p>
                {n.lead_id && (
                  <button
                    onClick={() => openLead(n)}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/15"
                  >
                    View lead <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
              </div>
              <button
                onClick={() => dismiss(n.id)}
                aria-label="Dismiss"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
