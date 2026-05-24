import { useEffect, useState, useCallback, useRef } from "react";
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

const POLL_MS = 20000;
const BASELINE_KEY = "urgent_popup_baseline_at";

function getOrInitBaseline(): string {
  let v = window.sessionStorage.getItem(BASELINE_KEY);
  if (!v) {
    v = new Date().toISOString();
    window.sessionStorage.setItem(BASELINE_KEY, v);
  }
  return v;
}

export default function UrgentLeadPopup() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<UrgentNotification[]>([]);
  const baselineRef = useRef<string>(getOrInitBaseline());

  // Every role gets urgent popups
  const eligible = Boolean(role) && role !== "no_role";

  const fetchUrgent = useCallback(async () => {
    if (!user || !eligible) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("read", false)
      .ilike("title", "%Urgent Job%")
      .gt("created_at", baselineRef.current)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setItems((prev) => {
        const existing = new Set(prev.map((i) => i.id));
        const next = (data as UrgentNotification[]).filter((n) => !existing.has(n.id));
        return [...next, ...prev];
      });
    }
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
    <>
      {/* Backdrop blocker - but we don't block clicks on rest of app, just dim slightly */}
      <div className="pointer-events-none fixed inset-0 z-[90] bg-foreground/10" />

      <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="pointer-events-auto flex w-full max-w-[520px] flex-col gap-3">
          <AnimatePresence initial={false}>
            {items.map((n, idx) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -10, transition: { duration: 0.18 } }}
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
                className="relative overflow-hidden rounded-3xl border-2 border-amber-400/60 bg-card shadow-[0_40px_80px_-20px_rgba(234,179,8,0.55)]"
              >
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300/50 animate-pulse" />

                <div className="flex items-start gap-4 p-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-600 ring-2 ring-amber-400/30 dark:text-amber-300">
                    <AlertTriangle className="h-7 w-7" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-bold text-amber-600 dark:text-amber-300">{n.title}</p>
                      {items.length > 1 && (
                        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-200">
                          {idx + 1} / {items.length}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[14px] leading-6 text-foreground/90">{n.message}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {n.lead_id && (
                        <button
                          onClick={() => openLead(n)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(234,179,8,0.7)] transition-transform hover:-translate-y-0.5 hover:bg-amber-600"
                        >
                          Open lead <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => dismiss(n.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => dismiss(n.id)}
                    aria-label="Close"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
