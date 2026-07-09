// supabase/functions/quo-chat/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QUO_API_BASE_URL =
  Deno.env.get("QUO_API_BASE_URL") ?? "https://api.openphone.com/v1";

type JsonObject = Record<string, unknown>;

type QuoChatRequest = {
  action?: string;
  participant?: string;
  content?: string;
};

type QuoPhoneNumber = {
  id: string;
  number: string;
  formattedNumber?: string | null;
  name?: string | null;
  restrictions?: {
    messaging?: {
      US?: string | null;
      CA?: string | null;
      Intl?: string | null;
    } | null;
  } | null;
};

type QuoConversation = {
  id: string;
  phoneNumberId: string;
  participants: string[];
  assignedTo?: string | null;
  name?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastActivityAt?: string | null;
};

type QuoMessage = {
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
};

type PaginatedResponse<T> = {
  data?: T[];
  totalItems?: number;
  nextPageToken?: string | null;
};

function jsonResponse(body: JsonObject, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeParticipant(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Already E.164
  if (/^\+[1-9]\d{1,14}$/.test(trimmed)) {
    return trimmed;
  }

  // Try to clean common phone formatting: (555) 123-4567, 555-123-4567, etc.
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // If your CRM is mostly US/Canada, 10 digits becomes +1XXXXXXXXXX.
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it already includes country code but no plus.
  if (digits.length >= 11 && digits.length <= 15 && /^[1-9]/.test(digits)) {
    return `+${digits}`;
  }

  return null;
}

async function safeJsonParse(text: string): Promise<unknown> {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getApiErrorMessage(data: unknown, status: number) {
  if (data && typeof data === "object") {
    if (
      "message" in data &&
      typeof (data as { message?: unknown }).message === "string"
    ) {
      return (data as { message: string }).message;
    }

    if (
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
    ) {
      return (data as { error: string }).error;
    }
  }

  return `Quo API request failed with status ${status}`;
}

async function quoFetch<T>(
  path: string,
  apiKey: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${QUO_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = await safeJsonParse(text);

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, response.status));
  }

  return data as T;
}

function pickDefaultPhoneNumber(
  phoneNumbers: QuoPhoneNumber[],
): QuoPhoneNumber | null {
  const unrestricted = phoneNumbers.find((phoneNumber) => {
    const messaging = phoneNumber.restrictions?.messaging;

    return (
      messaging?.US === "unrestricted" ||
      messaging?.CA === "unrestricted" ||
      messaging?.Intl === "unrestricted"
    );
  });

  return unrestricted ?? phoneNumbers[0] ?? null;
}

async function getAllPages<T>(
  apiKey: string,
  basePath: string,
  query: URLSearchParams,
  maxPages = 20,
): Promise<T[]> {
  const allItems: T[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const pageQuery = new URLSearchParams(query);

    if (pageToken) {
      pageQuery.set("pageToken", pageToken);
    }

    const response = await quoFetch<PaginatedResponse<T>>(
      `${basePath}?${pageQuery.toString()}`,
      apiKey,
    );

    allItems.push(...(response.data ?? []));

    if (!response.nextPageToken) {
      break;
    }

    pageToken = response.nextPageToken;
  }

  return allItems;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SB_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const quoApiKey = Deno.env.get("QUO_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !quoApiKey) {
      return jsonResponse(
        {
          error:
            "Server configuration missing. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SB_SERVICE_ROLE_KEY, and QUO_API_KEY in Supabase secrets.",
        },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized - no token provided" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized - invalid token" }, 401);
    }

    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      return jsonResponse(
        {
          error: "Could not verify admin role.",
          details: roleError.message,
        },
        500,
      );
    }

    if (roleData?.role !== "admin") {
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    let body: QuoChatRequest;

    try {
      body = (await req.json()) as QuoChatRequest;
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }

    const action = typeof body.action === "string" ? body.action : "get_thread";

    if (action !== "get_thread" && action !== "send_message") {
      return jsonResponse(
        {
          error: "Unsupported Quo chat action.",
        },
        400,
      );
    }

    const participant = normalizeParticipant(body.participant);

    if (!participant) {
      return jsonResponse(
        {
          error:
            "A valid participant phone number is required. Use E.164 format like +15555555555.",
        },
        400,
      );
    }

    const phoneNumbersResponse = await quoFetch<PaginatedResponse<QuoPhoneNumber>>(
      "/phone-numbers",
      quoApiKey,
    );

    const phoneNumbers = phoneNumbersResponse.data ?? [];
    const defaultPhoneNumber = pickDefaultPhoneNumber(phoneNumbers);

    if (!defaultPhoneNumber) {
      return jsonResponse(
        { error: "No Quo phone numbers are available in this workspace." },
        404,
      );
    }

    const conversationsQuery = new URLSearchParams();
    conversationsQuery.set("maxResults", "100");
    conversationsQuery.set("excludeInactive", "false");

    const conversations = await getAllPages<QuoConversation>(
      quoApiKey,
      "/conversations",
      conversationsQuery,
      20,
    );

    const matchingConversation =
      conversations.find((conversation) =>
        conversation.participants?.includes(participant),
      ) ?? null;

    const selectedPhoneNumber =
      phoneNumbers.find(
        (phoneNumber) => phoneNumber.id === matchingConversation?.phoneNumberId,
      ) ?? defaultPhoneNumber;

    if (action === "send_message") {
      const content = typeof body.content === "string" ? body.content.trim() : "";
      if (!content) {
        return jsonResponse({ error: "Message content is required." }, 400);
      }

      if (content.length > 1600) {
        return jsonResponse({ error: "Quo messages must be 1600 characters or fewer." }, 400);
      }

      const sent = await quoFetch<{ data: QuoMessage }>("/messages", quoApiKey, {
        method: "POST",
        body: JSON.stringify({
          content,
          from: selectedPhoneNumber.id,
          to: [participant],
        }),
      });

      const sentMessage = sent.data;
      if (sentMessage?.id && (sentMessage.conversationId || matchingConversation?.id)) {
        const { data: phoneRow } = await adminClient
          .from("quo_phone_numbers")
          .upsert(
            {
              quo_phone_number_id: selectedPhoneNumber.id,
              number: selectedPhoneNumber.formattedNumber ?? selectedPhoneNumber.number,
              display_number: selectedPhoneNumber.formattedNumber ?? selectedPhoneNumber.number,
              name: selectedPhoneNumber.name ?? null,
              label: selectedPhoneNumber.name ?? null,
              active: true,
            },
            { onConflict: "quo_phone_number_id" },
          )
          .select("id")
          .single();

        const conversationId = sentMessage.conversationId ?? matchingConversation?.id;
        const messageTime = new Date(sentMessage.createdAt).toISOString();
        const { data: existingConversation } = await adminClient
          .from("quo_conversations")
          .select("linked_lead_id")
          .eq("quo_conversation_id", conversationId)
          .maybeSingle();

        const { data: conversationRow } = await adminClient
          .from("quo_conversations")
          .upsert(
            {
              quo_conversation_id: conversationId,
              customer_name: matchingConversation?.name ?? null,
              customer_number: participant,
              number_id: phoneRow?.id ?? null,
              linked_lead_id: existingConversation?.linked_lead_id ?? null,
              last_message_preview: sentMessage.text,
              last_message_time: messageTime,
              last_message_at: messageTime,
              last_agent_message_at: messageTime,
              direction: "outgoing",
              status: "active",
              current_status: "open",
              raw_payload: sentMessage,
            },
            { onConflict: "quo_conversation_id" },
          )
          .select("id")
          .single();

        if (conversationRow?.id) {
          await adminClient.from("quo_messages").upsert(
            {
              quo_message_id: sentMessage.id,
              conversation_id: conversationRow.id,
              sender: "agent",
              direction: "outbound",
              recipients: sentMessage.to ?? [participant],
              text: sentMessage.text,
              media: [],
              status: sentMessage.status,
              message_time: messageTime,
              quo_created_at: messageTime,
              raw_payload: sentMessage,
            },
            { onConflict: "quo_message_id" },
          );

          await adminClient.from("quo_conversation_flags").upsert(
            { conversation_id: conversationRow.id },
            { onConflict: "conversation_id", ignoreDuplicates: true },
          );
        }
      }

      return jsonResponse({
        success: true,
        message: sentMessage,
        phoneNumber: {
          id: selectedPhoneNumber.id,
          number: selectedPhoneNumber.number,
          formattedNumber:
            selectedPhoneNumber.formattedNumber ?? selectedPhoneNumber.number,
          name: selectedPhoneNumber.name ?? null,
        },
      });
    }

    const messagesQuery = new URLSearchParams();
    messagesQuery.set("phoneNumberId", selectedPhoneNumber.id);
    messagesQuery.append("participants", participant);
    messagesQuery.set("maxResults", "100");

    const messages = await getAllPages<QuoMessage>(
      quoApiKey,
      "/messages",
      messagesQuery,
      20,
    );

    const sortedMessages = messages.sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );

    return jsonResponse({
      success: true,
      contact: {
        participant,
      },
      phoneNumber: {
        id: selectedPhoneNumber.id,
        number: selectedPhoneNumber.number,
        formattedNumber:
          selectedPhoneNumber.formattedNumber ?? selectedPhoneNumber.number,
        name: selectedPhoneNumber.name ?? null,
      },
      conversation: matchingConversation,
      messages: sortedMessages,
    });
  } catch (error) {
    console.error("quo-chat error:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An internal error occurred.",
      },
      500,
    );
  }
});
