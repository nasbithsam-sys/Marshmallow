import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QUO_API_BASE_URL = Deno.env.get("QUO_API_BASE_URL") ?? "https://api.quo.com/v1";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeParticipant(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\+[1-9]\d{1,14}$/.test(trimmed) ? trimmed : null;
}

async function quoFetch<T>(path: string, apiKey: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${QUO_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const errorMessage =
      (data && typeof data === "object" && "message" in data && typeof data.message === "string" && data.message) ||
      (data && typeof data === "object" && "error" in data && typeof data.error === "string" && data.error) ||
      `Quo API request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as T;
}

type QuoPhoneNumber = {
  id: string;
  number: string;
  formattedNumber?: string | null;
  name?: string | null;
  users?: Array<{ id: string; role?: string | null }>;
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

function pickDefaultPhoneNumber(phoneNumbers: QuoPhoneNumber[]): QuoPhoneNumber | null {
  const unrestricted = phoneNumbers.find((phoneNumber) => {
    const messaging = phoneNumber.restrictions?.messaging;
    return messaging?.US === "unrestricted" || messaging?.Intl === "unrestricted" || messaging?.CA === "unrestricted";
  });

  return unrestricted ?? phoneNumbers[0] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY");
    const quoApiKey = Deno.env.get("QUO_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !quoApiKey) {
      return jsonResponse(
        {
          error: "Server configuration missing. Set SB_SERVICE_ROLE_KEY and QUO_API_KEY in Supabase secrets.",
        },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized - no token provided" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized - invalid token" }, 401);
    }

    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).single();
    if (roleData?.role !== "admin") {
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "";
    const participant = normalizeParticipant(body.participant);

    if (!participant) {
      return jsonResponse({ error: "A valid E.164 participant phone number is required." }, 400);
    }

    const phoneNumbersResponse = await quoFetch<{ data: QuoPhoneNumber[] }>("/phone-numbers", quoApiKey);
    const phoneNumbers = phoneNumbersResponse.data ?? [];
    const defaultPhoneNumber = pickDefaultPhoneNumber(phoneNumbers);

    const conversationsResponse = await quoFetch<{ data: QuoConversation[] }>(
      "/conversations?maxResults=100&excludeInactive=false",
      quoApiKey,
    );

    const matchingConversation =
      conversationsResponse.data?.find((conversation) => conversation.participants?.includes(participant)) ?? null;

    const selectedPhoneNumber =
      phoneNumbers.find((phoneNumber) => phoneNumber.id === matchingConversation?.phoneNumberId) ?? defaultPhoneNumber;

    if (!selectedPhoneNumber) {
      return jsonResponse({ error: "No Quo phone numbers are available in this workspace." }, 404);
    }

    if (action === "get_thread") {
      const query = new URLSearchParams();
      query.set("phoneNumberId", selectedPhoneNumber.id);
      query.append("participants", participant);
      query.set("maxResults", "100");

      const messagesResponse = await quoFetch<{ data: QuoMessage[] }>(`/messages?${query.toString()}`, quoApiKey);

      return jsonResponse({
        contact: {
          participant,
        },
        phoneNumber: {
          id: selectedPhoneNumber.id,
          number: selectedPhoneNumber.number,
          formattedNumber: selectedPhoneNumber.formattedNumber ?? selectedPhoneNumber.number,
          name: selectedPhoneNumber.name ?? null,
        },
        conversation: matchingConversation,
        messages: (messagesResponse.data ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      });
    }

    if (action === "send_message") {
      const content = typeof body.content === "string" ? body.content.trim() : "";
      if (!content) {
        return jsonResponse({ error: "Message content is required." }, 400);
      }

      const outbound = await quoFetch<{ data: QuoMessage }>(
        "/messages",
        quoApiKey,
        {
          method: "POST",
          body: JSON.stringify({
            content,
            from: selectedPhoneNumber.id,
            to: [participant],
          }),
        },
      );

      return jsonResponse({
        message: outbound.data,
      });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error("quo-chat error:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "An internal error occurred.",
      },
      500,
    );
  }
});
