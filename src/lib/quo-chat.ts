import { supabase } from "@/integrations/supabase/client";

export interface QuoChatMessage {
  id: string;
  to: string[];
  from: string;
  text: string;
  phoneNumberId: string;
  conversationId?: string | null;
  direction: "incoming" | "outgoing";
  userId?: string | null;
  status?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface QuoChatThreadResponse {
  contact: {
    participant: string;
  };
  phoneNumber: {
    id: string;
    number: string;
    formattedNumber: string;
    name?: string | null;
  };
  conversation?: {
    id: string;
    phoneNumberId: string;
    participants: string[];
    assignedTo?: string | null;
    name?: string | null;
    updatedAt?: string | null;
    lastActivityAt?: string | null;
  } | null;
  messages: QuoChatMessage[];
}

export async function fetchQuoChatThread(participant: string) {
  const { data, error } = await supabase.functions.invoke("quo-chat", {
    body: {
      action: "get_thread",
      participant,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to load Quo chat");
  }

  return data as QuoChatThreadResponse;
}

export async function sendQuoChatMessage(participant: string, content: string) {
  const { data, error } = await supabase.functions.invoke("quo-chat", {
    body: {
      action: "send_message",
      participant,
      content,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to send Quo message");
  }

  return data as { message: QuoChatMessage };
}
