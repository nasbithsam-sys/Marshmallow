import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, Loader2, MessageSquare, Phone, Send, Clock, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhoneE164, stripPhone } from "@/lib/phone";
import { fetchQuoChatThread, sendQuoChatMessage, type QuoChatMessage } from "@/lib/quo-chat";
import {
  formatEasternTime,
  formatUsPhone,
  getQuoChatUrl,
  getQuoNumberEmoji,
  getQuoNumberName,
  normalizeQuoLeadStatus,
  QUO_LEAD_STATUS_CONFIG,
  sendQuoMessageViaExtension,
  scheduleQuoMessageViaExtension,
} from "@/lib/quo-dashboard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RenderEmoji from "@/components/common/RenderEmoji";

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
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [customScheduleTime, setCustomScheduleTime] = useState("");

  // Conversation metadata for header details
  const [conversationMeta, setConversationMeta] = useState<{
    id?: string;
    quoConversationId?: string;
    quoPhoneNumberId?: string;
    phoneNumberObj?: any;
    numberName?: string;
    numberEmoji?: string;
    status?: string;
  } | null>(null);

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

        const numObj = response.phoneNumber;
        const numName = getQuoNumberName(numObj, numObj?.formattedNumber);
        const numEmoji = getQuoNumberEmoji(numObj, numObj?.formattedNumber);
        const convStatus = (response.conversation as any)?.current_status || (response.conversation as any)?.status || "raw";

        setConversationMeta({
          id: response.conversation?.id,
          quoConversationId: (response.conversation as any)?.quo_conversation_id,
          quoPhoneNumberId: response.phoneNumber?.id,
          phoneNumberObj: numObj,
          numberName: numName,
          numberEmoji: numEmoji,
          status: convStatus,
        });
      } catch (fetchError) {
        if (!active) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load Quo messages");
        setMessages([]);
        setConversationMeta(null);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "quo_outbound_messages" }, scheduleLiveRefresh)
      .subscribe();

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, normalizedPhone, open]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView?.({ block: "end" });
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
    setMessageDraft("");

    const nowIso = new Date().toISOString();
    const tempId = `temp_${Date.now()}`;

    // Optimistically add message to stream
    const optimisticMsg: QuoChatMessage = {
      id: tempId,
      to: [normalizedPhone],
      from: "agent",
      text: content,
      phoneNumberId: conversationMeta?.quoPhoneNumberId || "",
      conversationId: conversationMeta?.id,
      direction: "outgoing",
      status: "pending",
      createdAt: nowIso,
    };
    setMessages((current) => mergeQuoMessages([...current, optimisticMsg]));

    // Construct Chat URL for OpenPhone / my.quo.com
    const chatUrl = getQuoChatUrl(
      conversationMeta?.quoConversationId,
      normalizedPhone,
      conversationMeta?.quoPhoneNumberId
    );

    // Save message via API / Supabase
    try {
      await sendQuoChatMessage(normalizedPhone, content);
    } catch (sendErr) {
      console.warn("sendQuoChatMessage save warning:", sendErr);
    }

    // Trigger Chrome Extension postMessage and await QUO_SEND_MESSAGE_RESPONSE
    const toastId = toast.loading("Sending via QUO Extension...");

    try {
      const extRes = await sendQuoMessageViaExtension(chatUrl, content);
      if (extRes.success) {
        toast.success("Success! The message was pasted and sent via QUO.", { id: toastId });
      } else {
        toast.error(`Extension notice: ${extRes.error || "Failed to complete send"}`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Extension notice: ${err?.message || "Extension dispatch error"}`, { id: toastId });
    } finally {
      setSending(false);
      void fetchQuoChatThread(normalizedPhone)
        .then((thread) => setMessages(mergeQuoMessages(thread.messages ?? [])))
        .catch(() => undefined);
    }
  };

  const handleSchedule = async (scheduleTime: string) => {
    if (!normalizedPhone) {
      setError("This number could not be normalized to E.164.");
      return;
    }

    const content = messageDraft.trim();
    if (!content) return;

    setSending(true);
    setError(null);
    setMessageDraft("");
    setCustomScheduleTime("");
    setScheduleOpen(false);

    const chatUrl = getQuoChatUrl(
      conversationMeta?.quoConversationId,
      normalizedPhone,
      conversationMeta?.quoPhoneNumberId
    );

    const toastId = toast.loading(`Scheduling message for "${scheduleTime}" via Extension...`);

    try {
      const extRes = await scheduleQuoMessageViaExtension(chatUrl, content, scheduleTime);
      if (extRes.success) {
        toast.success(`Success! Message scheduled for "${scheduleTime}".`, { id: toastId });
      } else {
        toast.error(`Failed to schedule: ${extRes.error || "Cancelled"}`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Failed to schedule: ${err?.message || "Extension error"}`, { id: toastId });
    } finally {
      setSending(false);
      void fetchQuoChatThread(normalizedPhone)
        .then((thread) => setMessages(mergeQuoMessages(thread.messages ?? [])))
        .catch(() => undefined);
    }
  };

  if (!trimmedPhone) {
    return null;
  }

  if (!isAdmin) {
    return <span className={className}>{triggerLabel}</span>;
  }

  const currentStatusKey = normalizeQuoLeadStatus(conversationMeta?.status);
  const statusCfg = QUO_LEAD_STATUS_CONFIG[currentStatusKey];

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[580px] h-[85vh] max-h-[680px] p-0 flex flex-col overflow-hidden glass-panel-strong border-border/80 shadow-2xl">
          {/* Modern Header - Identical to QUO Dashboard */}
          <DialogHeader className="p-4 border-b border-border/50 bg-muted/30 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold text-sm shrink-0">
                  <MessageSquare className="h-5 w-5" />
                </span>
                <div>
                  <DialogTitle className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                    <span>{formatUsPhone(panelPhone)}</span>
                    {contactName && (
                      <span className="text-xs font-normal text-muted-foreground">
                        ({contactName})
                      </span>
                    )}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {conversationMeta?.numberName && (
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <RenderEmoji emoji={conversationMeta.numberEmoji} size="sm" />
                        <span>{conversationMeta.numberName}</span>
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-semibold ${statusCfg.badgeClass}`}
                    >
                      {statusCfg.label}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Messages Stream Body - Identical to QUO Dashboard */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-background/40">
            {loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground gap-2 text-xs">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Loading chat messages...
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-center text-xs text-destructive">
                {error}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-1 text-xs">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-1" />
                <span>No messages in this chat yet.</span>
              </div>
            ) : (
              messages.map((message) => {
                const isOutbound = message.direction === "outgoing" || message.from === "agent";

                return (
                  <div
                    key={message.id}
                    className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed ${
                        isOutbound
                          ? "bg-primary text-primary-foreground rounded-br-xs"
                          : "bg-muted/90 text-foreground border border-border/50 rounded-bl-xs"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.text || "—"}</p>
                    </div>
                    <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-muted-foreground">
                      <span>{formatEasternTime(message.createdAt, "time")}</span>
                      {isOutbound && <CheckCheck className="h-3 w-3 text-primary/70" />}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Footer - Identical to QUO Dashboard */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="p-3 border-t border-border/50 bg-background/80 flex items-end gap-2 shrink-0"
          >
            <Textarea
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Type a message to append to chat thread..."
              className="flex-1 min-h-[44px] max-h-[100px] resize-none text-xs bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/40 border-border/60"
              disabled={!normalizedPhone || sending}
            />
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="submit"
              disabled={!normalizedPhone || sending || !messageDraft.trim()}
              size="sm"
              className="h-[44px] px-4 gap-1.5 font-medium"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Send</span>
                </>
              )}
            </Button>

            {/* Schedule Message Popover */}
            <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!normalizedPhone || sending || !messageDraft.trim()}
                  className="h-[44px] px-3 gap-1.5 border-border/80 bg-background/80 hover:bg-muted text-xs font-medium"
                  title="Schedule message for later via Chrome Extension"
                >
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span className="hidden sm:inline">Schedule</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[300px] p-3 space-y-3 glass-panel-strong border-border/80 shadow-2xl">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <span>Schedule Message</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Quo Extension</Badge>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Quick Presets</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs justify-start border-border/60 hover:bg-muted/60"
                      onClick={() => void handleSchedule("tomorrow at 9am")}
                    >
                      Tomorrow 9:00 AM
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs justify-start border-border/60 hover:bg-muted/60"
                      onClick={() => void handleSchedule("tomorrow at 5pm")}
                    >
                      Tomorrow 5:00 PM
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs justify-start border-border/60 hover:bg-muted/60"
                      onClick={() => void handleSchedule("in 1 hour")}
                    >
                      In 1 Hour
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs justify-start border-border/60 hover:bg-muted/60"
                      onClick={() => void handleSchedule("in 2 hours")}
                    >
                      In 2 Hours
                    </Button>
                  </div>
                </div>

                {/* Custom Time Input */}
                <div className="space-y-1.5 pt-1 border-t border-border/40">
                  <label className="text-[11px] font-medium text-muted-foreground">Custom Time Description</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={customScheduleTime}
                      onChange={(e) => setCustomScheduleTime(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customScheduleTime.trim()) {
                          e.preventDefault();
                          void handleSchedule(customScheduleTime.trim());
                        }
                      }}
                      placeholder="e.g. tomorrow at 5pm"
                      className="h-8 text-xs bg-muted/30"
                    />
                    <Button
                      size="sm"
                      disabled={!customScheduleTime.trim()}
                      onClick={() => void handleSchedule(customScheduleTime.trim())}
                      className="h-8 text-xs px-3 bg-amber-600 hover:bg-amber-700 text-white shrink-0 font-medium"
                    >
                      Schedule
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
