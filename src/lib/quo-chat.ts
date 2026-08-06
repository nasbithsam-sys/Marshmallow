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

function lastTen(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Reads the conversation stored by the Quo webhook (no Quo API calls).
 */
export async function fetchQuoChatThread(participant: string): Promise<QuoChatThreadResponse> {
  const digits = lastTen(participant);

  const { data: conversations, error: conversationError } = await supabase
    .from("quo_conversations")
    .select(
      "id, quo_conversation_id, customer_name, customer_number, number_id, last_message_time, updated_at, quo_phone_numbers(id, quo_phone_number_id, number, display_number, name, label)",
    )
    .or(`customer_number.eq.${participant},customer_number.ilike.%${digits}`)
    .order("last_message_time", { ascending: false, nullsFirst: false })
    .limit(1);

  if (conversationError) {
    throw new Error(conversationError.message || "Failed to load Quo chat");
  }

  const conversation = conversations?.[0] ?? null;
  const numberRow = (conversation as unknown as {
    quo_phone_numbers?: {
      id: string;
      quo_phone_number_id: string;
      number: string;
      display_number: string | null;
      name: string | null;
      label: string | null;
    } | null;
  } | null)?.quo_phone_numbers ?? null;

  let messages: QuoChatMessage[] = [];

  if (conversation) {
    const { data: rows, error: messageError } = await supabase
      .from("quo_messages")
      .select("id, sender, recipients, text, direction, status, message_time, quo_created_at, created_at, conversation_id")
      .eq("conversation_id", conversation.id)
      .order("message_time", { ascending: true, nullsFirst: false })
      .limit(500);

    if (messageError) {
      throw new Error(messageError.message || "Failed to load Quo messages");
    }

    messages = (rows ?? []).map((row) => ({
      id: row.id,
      to: Array.isArray(row.recipients) ? (row.recipients as unknown[]).map((entry) => String(entry)) : [],
      from: row.sender ?? "",
      text: row.text ?? "",
      phoneNumberId: numberRow?.quo_phone_number_id ?? "",
      conversationId: row.conversation_id,
      direction: row.direction === "outgoing" ? "outgoing" : "incoming",
      status: row.status,
      createdAt: row.message_time ?? row.quo_created_at ?? row.created_at,
    }));
  }

  // Include messages queued for the extension that haven't been echoed back by the webhook yet.
  const { data: outbound } = await supabase
    .from("quo_outbound_messages")
    .select("id, to_number, body, status, created_at, sent_at, quo_message_id")
    .ilike("to_number", `%${digits}`)
    .in("status", ["pending", "sending", "failed"])
    .order("created_at", { ascending: true })
    .limit(50);

  const queued: QuoChatMessage[] = (outbound ?? []).map((row) => ({
    id: `outbound-${row.id}`,
    to: [row.to_number],
    from: numberRow?.number ?? "",
    text: row.body,
    phoneNumberId: numberRow?.quo_phone_number_id ?? "",
    conversationId: conversation?.id ?? null,
    direction: "outgoing" as const,
    status: row.status,
    createdAt: row.created_at,
  }));

  return {
    contact: { participant },
    phoneNumber: {
      id: numberRow?.quo_phone_number_id ?? "",
      number: numberRow?.number ?? "",
      formattedNumber: numberRow?.display_number ?? numberRow?.number ?? "",
      name: numberRow?.name ?? numberRow?.label ?? null,
    },
    conversation: conversation
      ? {
          id: conversation.quo_conversation_id,
          phoneNumberId: numberRow?.quo_phone_number_id ?? "",
          participants: [conversation.customer_number ?? participant],
          name: conversation.customer_name,
          updatedAt: conversation.updated_at,
          lastActivityAt: conversation.last_message_time,
        }
      : null,
    messages: [...messages, ...queued],
  };
}

/**
 * Queues an outbound message. The CRM browser extension picks it up and sends it through Quo.
 */
export async function sendQuoChatMessage(participant: string, content: string) {
  const { data: auth } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("quo_outbound_messages")
    .insert({
      to_number: participant,
      body: content,
      created_by: auth.user?.id ?? null,
    })
    .select("id, to_number, body, status, created_at")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to queue Quo message");
  }

  const message: QuoChatMessage = {
    id: `outbound-${data.id}`,
    to: [data.to_number],
    from: "",
    text: data.body,
    phoneNumberId: "",
    direction: "outgoing",
    status: data.status,
    createdAt: data.created_at,
  };

  return { message };
}
