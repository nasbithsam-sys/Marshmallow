import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquare, Phone, Send } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhoneE164, stripPhone } from "@/lib/phone";
import { fetchQuoChatThread, sendQuoChatMessage, type QuoChatMessage } from "@/lib/quo-chat";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface QuoPhoneTriggerProps {
  contactName: string;
  phone?: string | null;
  className?: string;
  children?: ReactNode;
}

function getPhoneKey(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function mergeQuoMessages(messages: QuoChatMessage[]) {
  return Array.from(new Map(messages.map((message) => [message.id, message])).values()).sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

export default function QuoPhoneTrigger({
  contactName,
  phone,
  className,
  children,
}: QuoPhoneTriggerProps) {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);

  const trimmedPhone = phone?.trim() ?? "";
  const normalizedPhone = useMemo(() => normalizePhoneE164(trimmedPhone), [trimmedPhone]);
  const fallbackPhone = stripPhone(trimmedPhone) || trimmedPhone;
  const panelPhone = normalizedPhone ?? fallbackPhone;
  const triggerLabel = children ?? trimmedPhone;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<QuoChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [workspaceNumberLabel, setWorkspaceNumberLabel] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isAdmin = role === "admin";

  useEffect(() => {
    if (!isAdmin || !open || !normalizedPhone) return;

    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const contactKey = getPhoneKey(normalizedPhone);

    const loadThread = async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      setError(null);

      try {
        const response = await fetchQuoChatThread(normalizedPhone);
        if (!active) return;
        setMessages(mergeQuoMessages(response.messages ?? []));
        setWorkspaceNumberLabel(response.phoneNumber?.name ?? response.phoneNumber?.formattedNumber ?? null);
      } catch (fetchError) {
        if (!active) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load Quo messages");
        setMessages([]);
        setWorkspaceNumberLabel(null);
      } finally {
        if (active && showLoading) setLoading(false);
      }
    };

    const scheduleLiveRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void loadThread(false), 450);
    };

    setMessages([]);
    void loadThread(true);

    const channel = supabase
      .channel(`quo-lead-chat-${contactKey || normalizedPhone}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quo_conversations" }, (payload) => {
        const row = (payload.new ?? payload.old) as { customer_number?: string | null } | null;
        if (!row?.customer_number || getPhoneKey(row.customer_number) === contactKey) {
          scheduleLiveRefresh();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "quo_messages" }, scheduleLiveRefresh)
      .subscribe();

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, normalizedPhone, open]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  const handleSend = async () => {
    if (!normalizedPhone) {
      setError("This number could not be normalized to E.164.");
      return;
    }

    const content = messageDraft.trim();
    if (!content) return;

    setSending(true);
    setError(null);
    try {
      const response = await sendQuoChatMessage(normalizedPhone, content);
      setMessages((current) => mergeQuoMessages([...current, response.message]));
      setMessageDraft("");
      window.setTimeout(() => {
        void fetchQuoChatThread(normalizedPhone)
          .then((thread) => setMessages(mergeQuoMessages(thread.messages ?? [])))
          .catch(() => undefined);
      }, 1200);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send Quo message");
    } finally {
      setSending(false);
    }
  };

  if (!trimmedPhone) {
    return null;
  }

  if (!isAdmin) {
    return <span className={className}>{triggerLabel}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 text-left font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary/80",
          className,
        )}
      >
        <Phone className="h-3.5 w-3.5 shrink-0" />
        <span>{triggerLabel}</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader className="space-y-3 pr-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <MessageSquare className="h-3.5 w-3.5" />
              Quo Chat
            </div>
            <div className="space-y-1">
              <SheetTitle>Quo Chat</SheetTitle>
              <SheetDescription>
                Admin-only Quo conversation view for this contact.
              </SheetDescription>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="rounded-3xl border border-border/60 bg-muted/[0.18] p-5">
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Contact
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground">{contactName}</p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Phone Number
                  </p>
                  <p className="mt-1 font-mono text-sm text-foreground">{panelPhone}</p>
                </div>

                {workspaceNumberLabel && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Quo Number
                    </p>
                    <p className="mt-1 text-sm text-foreground">{workspaceNumberLabel}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="min-h-[320px] rounded-3xl border border-dashed border-border/70 bg-gradient-to-br from-muted/[0.2] to-transparent p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Messages
              </p>
              <div className="mt-4 rounded-2xl border border-border/50 bg-background/70 p-4">
                {loading ? (
                  <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading Quo messages...
                  </div>
                ) : error ? (
                  <div className="flex min-h-[240px] items-center justify-center text-center text-sm text-destructive">
                    {error}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex min-h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
                    Quo messages will appear here
                  </div>
                ) : (
                  <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                    {messages.map((message) => {
                      const outgoing = message.direction === "outgoing";
                      return (
                        <div key={message.id} className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                              outgoing ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                            )}
                          >
                            <p className="whitespace-pre-wrap leading-6">{message.text}</p>
                            <p
                              className={cn(
                                "mt-2 text-[11px]",
                                outgoing ? "text-primary-foreground/75" : "text-muted-foreground",
                              )}
                            >
                              {new Date(message.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-muted/[0.16] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Send Message
              </p>
              <div className="mt-3 space-y-3">
                <Textarea
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  placeholder="Type a message to send through Quo..."
                  className="min-h-[120px]"
                  disabled={!normalizedPhone || sending}
                />
                <div className="flex justify-end">
                  <Button type="button" onClick={() => void handleSend()} disabled={!normalizedPhone || sending || !messageDraft.trim()}>
                    {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button type="button" onClick={() => setOpen(false)} className="rounded-xl">
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
