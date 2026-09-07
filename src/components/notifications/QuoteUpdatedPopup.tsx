import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FileCheck, X, ArrowUpRight } from "lucide-react";

interface QuoteUpdatedNotification {
  id: string;
  title: string;
  message: string;
  lead_id: string | null;
  created_at: string;
}

const POLL_MS = 20000;
const BASELINE_KEY = "quote_updated_popup_baseline_at";

function getOrInitBaseline(): string {
  let v = window.sessionStorage.getItem(BASELINE_KEY);
  if (!v) {
    v = new Date().toISOString();
    window.sessionStorage.setItem(BASELINE_KEY, v);
  }
  return v;
}

export default function QuoteUpdatedPopup() {
  const { user, role, fullyAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<QuoteUpdatedNotification[]>([]);
  const baselineRef = useRef<string>(getOrInitBaseline());
  const prevCountRef = useRef(0);

  // Only CS and CS Admin receive these popups
  const isEligible =
    (role === "customer_service" || role === "cs_admin") &&
    Boolean(user) &&
    fullyAuthenticated;

  const fetchUpdated = useCallback(async () => {
    if (!user || !isEligible) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("read", false)
      .ilike("title", "%Quote Updated%")
      .gt("created_at", baselineRef.current)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data && data.length > 0) {
      setItems((prev) => {
        const existing = new Set(prev.map((i) => i.id));
        const next = (data as QuoteUpdatedNotification[]).filter(
          (n) => !existing.has(n.id)
        );
        const merged = [...next, ...prev];

        // Play sound when new items arrive
        if (next.length > 0 && prevCountRef.current !== merged.length) {
          import("@/lib/notification-sound").then(({ playAssignmentSound }) => {
            playAssignmentSound();
          });
        }
        prevCountRef.current = merged.length;
        return merged;
      });
    }
  }, [user, isEligible]);

  // Polling
  useEffect(() => {
    if (!isEligible) return;
    void fetchUpdated();
    const interval = setInterval(fetchUpdated, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchUpdated, isEligible]);

  // Realtime — fire immediately when notification is inserted
  useEffect(() => {
    if (!user || !isEligible) return;

    const channel = supabase
      .channel(`quote-updated-popup:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { title?: string } | undefined;
          if (row?.title?.toLowerCase().includes("quote updated")) {
            void fetchUpdated();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isEligible, fetchUpdated]);

  const dismiss = async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    prevCountRef.current = Math.max(0, prevCountRef.current - 1);
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  const openLead = async (n: QuoteUpdatedNotification) => {
    await dismiss(n.id);
    if (n.lead_id) navigate(`/leads/${n.lead_id}`);
  };

  if (!isEligible || items.length === 0) return null;

  return (
    <>
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
                className="relative overflow-hidden rounded-3xl border-2 border-blue-400/60 bg-card shadow-[0_40px_80px_-20px_rgba(59,130,246,0.40)]"
              >
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-300/50 animate-pulse" />

                <div className="flex items-start gap-4 p-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-400/15 text-blue-600 ring-2 ring-blue-400/30 dark:text-blue-300">
                    <FileCheck className="h-7 w-7" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-bold text-blue-600 dark:text-blue-300">
                        {n.title}
                      </p>
                      {items.length > 1 && (
                        <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-200">
                          {idx + 1} / {items.length}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[14px] leading-6 text-foreground/90">
                      {n.message}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {n.lead_id && (
                        <button
                          onClick={() => openLead(n)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(59,130,246,0.7)] transition-transform hover:-translate-y-0.5 hover:bg-blue-700"
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
