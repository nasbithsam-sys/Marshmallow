import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, MessageSquare, User, Phone, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import {
  formatEasternTime,
  formatUsPhone,
  normalizeQuoLeadStatus,
  QUO_LEAD_STATUS_CONFIG,
  type QuoLeadStatus,
} from "@/lib/quo-dashboard";

interface MessageItem {
  id: string;
  sender: string;
  text: string | null;
  direction?: string | null;
  message_time: string | null;
  created_at?: string;
}

interface QuoChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: {
    id: string;
    customer_name?: string | null;
    customer_number?: string | null;
    number_name?: string | null;
    status?: string | null;
    agent_name?: string | null;
  } | null;
  onStatusChange?: (newStatus: QuoLeadStatus) => void;
}

export default function QuoChatDialog({
  open,
  onOpenChange,
  conversation,
  onStatusChange,
}: QuoChatDialogProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Fetch messages when conversation changes or opens
  useEffect(() => {
    if (!open || !conversation?.id) return;

    let isCancelled = false;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("quo_messages")
          .select("id, sender, text, direction, message_time, created_at")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Error fetching messages for chat", error);
        } else if (!isCancelled && data) {
          setMessages(data as MessageItem[]);
        }
      } catch (err) {
        console.error("Failed to load messages", err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchMessages();

    // Subscribe to realtime message updates
    const channel = supabase
      .channel(`chat_${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quo_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as MessageItem;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
    };
  }, [open, conversation?.id]);

  // Auto-scroll to bottom of message thread when messages load/update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !conversation?.id || sending) return;

    const textToSend = newMessage.trim();
    setNewMessage("");
    setSending(true);

    const nowIso = new Date().toISOString();
    const tempId = `temp_${Date.now()}`;

    // Optimistically append message to local state
    const optimisticMsg: MessageItem = {
      id: tempId,
      sender: "agent",
      direction: "outbound",
      text: textToSend,
      message_time: nowIso,
      created_at: nowIso,
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    // Dispatch Chrome Extension postMessage trigger
    const chatUrl = getQuoChatUrl(
      (conversation as any).quo_conversation_id,
      conversation.customer_number
    );

    try {
      window.postMessage(
        {
          action: "QUO_SEND_MESSAGE",
          chatUrl: chatUrl,
          message: textToSend,
        },
        "*"
      );
    } catch (postErr) {
      console.warn("PostMessage dispatch error", postErr);
    }

    try {
      // Insert into quo_messages database table
      const { data, error } = await supabase.from("quo_messages").insert({
        conversation_id: conversation.id,
        sender: "agent",
        direction: "outbound",
        text: textToSend,
        message_time: nowIso,
        quo_message_id: `msg_web_${Date.now()}`,
      }).select("id").single();

      if (error) {
        console.error("Failed to save message to DB", error);
        toast.error("Failed to append message");
      } else {
        // Update conversation last_message_preview and last_message_at
        await supabase
          .from("quo_conversations")
          .update({
            last_message_preview: textToSend,
            last_message_at: nowIso,
            last_message_time: nowIso,
            last_agent_message_at: nowIso,
          })
          .eq("id", conversation.id);

        toast.success("Message sent & dispatched to Chrome Extension");
      }
    } catch (err) {
      console.error("Send message exception", err);
    } finally {
      setSending(false);
    }
  };

  if (!conversation) return null;

  const currentStatusKey = normalizeQuoLeadStatus(conversation.status);
  const statusCfg = QUO_LEAD_STATUS_CONFIG[currentStatusKey];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] h-[85vh] max-h-[680px] p-0 flex flex-col overflow-hidden glass-panel-strong border-border/80 shadow-2xl">
        {/* Chat Header */}
        <DialogHeader className="p-4 border-b border-border/50 bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold text-sm">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <span>{formatUsPhone(conversation.customer_number)}</span>
                  {conversation.customer_name && (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({conversation.customer_name})
                    </span>
                  )}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  {conversation.number_name && (
                    <span className="text-xs font-medium text-muted-foreground">
                      {conversation.number_name}
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

        {/* Messages Body */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-background/40"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground gap-2 text-xs">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Loading chat messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-1 text-xs">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-1" />
              <span>No messages in this chat yet.</span>
            </div>
          ) : (
            messages.map((msg) => {
              const isOutbound =
                msg.sender === "agent" ||
                msg.direction === "outbound" ||
                msg.sender === "us";

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isOutbound ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed ${
                      isOutbound
                        ? "bg-primary text-primary-foreground rounded-br-xs"
                        : "bg-muted/90 text-foreground border border-border/50 rounded-bl-xs"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.text || "—"}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-muted-foreground">
                    <span>
                      {formatEasternTime(
                        msg.message_time || msg.created_at,
                        "time"
                      )}
                    </span>
                    {isOutbound && <CheckCheck className="h-3 w-3 text-primary/70" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chat Input Footer */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t border-border/50 bg-background/80 flex items-end gap-2 shrink-0"
        >
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type a message to append to chat thread..."
            className="flex-1 min-h-[44px] max-h-[100px] resize-none text-xs bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/40 border-border/60"
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || sending}
            size="sm"
            className="h-[44px] px-4 gap-1.5 font-medium shrink-0"
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
