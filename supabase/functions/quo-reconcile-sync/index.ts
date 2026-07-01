import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  normalizeQuoPayload,
} from "../_shared/quo-ai.ts";

type PaginatedResponse<T> = {
  data?: T[];
  nextPageToken?: string | null;
};

async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const quoApiKey = Deno.env.get("QUO_API_KEY");
    const quoBaseUrl = Deno.env.get("QUO_API_BASE_URL") ?? "https://api.quo.com/v1";
    if (!supabaseUrl || !serviceRoleKey || !quoApiKey) {
      return jsonResponse({ error: "Missing Supabase or Quo API configuration." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const since =
      typeof body.createdAfter === "string"
        ? body.createdAfter
        : new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const limit = Math.min(Number(body.limit ?? 100), 250);

    const { data: syncLog } = await supabase
      .from("quo_sync_logs")
      .insert({
        sync_type: "reconcile",
        status: "running",
        details: { createdAfter: since, limit },
      })
      .select("id")
      .single();

    const params = new URLSearchParams();
    params.set("createdAfter", since);
    params.set("maxResults", String(limit));
    if (typeof body.phoneNumberId === "string") params.set("phoneNumberId", body.phoneNumberId);

    const response = await fetch(`${quoBaseUrl}/messages?${params.toString()}`, {
      headers: {
        Authorization: quoApiKey,
        Accept: "application/json",
      },
    });
    const data = await safeJson(response) as PaginatedResponse<Record<string, unknown>>;
    if (!response.ok) {
      throw new Error(`Quo API request failed with status ${response.status}`);
    }

    let insertedOrUpdated = 0;
    let analyzed = 0;

    for (const rawMessage of data?.data ?? []) {
      const payload = {
        type: "message.reconciled",
        data: {
          message: rawMessage,
          conversation: {
            id: rawMessage.conversationId,
            phoneNumberId: rawMessage.phoneNumberId,
          },
        },
      };

      const { message, conversation } = normalizeQuoPayload(payload);

      let phoneNumberRowId: string | null = null;
      if (conversation.phoneNumberId) {
        const { data: phoneRow } = await supabase
          .from("quo_phone_numbers")
          .upsert(
            {
              quo_phone_number_id: conversation.phoneNumberId,
              number: conversation.phoneNumberDisplay ?? conversation.phoneNumberId,
              display_number: conversation.phoneNumberDisplay,
              name: conversation.phoneNumberName,
              label: conversation.phoneNumberName,
              active: true,
            },
            { onConflict: "quo_phone_number_id" },
          )
          .select("id")
          .single();
        phoneNumberRowId = phoneRow?.id ?? null;
      }

      const messageTime = new Date(message.createdAt).toISOString();
      const { data: conversationRow, error: conversationError } = await supabase
        .from("quo_conversations")
        .upsert(
          {
            quo_conversation_id: conversation.id,
            customer_name: conversation.customerName,
            customer_number: conversation.customerNumber,
            number_id: phoneNumberRowId,
            last_message_preview: message.text.slice(0, 200),
            last_message_time: messageTime,
            last_message_at: messageTime,
            last_customer_message_at: message.sender === "customer" ? messageTime : undefined,
            last_agent_message_at: message.sender === "agent" ? messageTime : undefined,
            direction: message.direction === "inbound" ? "incoming" : "outgoing",
            status: "active",
            current_status: "open",
            raw_payload: payload,
          },
          { onConflict: "quo_conversation_id" },
        )
        .select("id")
        .single();

      if (conversationError || !conversationRow) continue;

      const { data: messageRow, error: messageError } = await supabase
        .from("quo_messages")
        .upsert(
          {
            quo_message_id: message.id,
            conversation_id: conversationRow.id,
            sender: message.sender,
            direction: message.direction,
            recipients: message.to,
            text: message.text,
            media: message.media,
            status: message.status,
            message_time: messageTime,
            quo_created_at: messageTime,
            raw_payload: payload,
          },
          { onConflict: "quo_message_id" },
        )
        .select("id")
        .single();

      if (!messageError) {
        insertedOrUpdated += 1;
        if (message.sender === "customer") {
          analyzed += 1;
          EdgeRuntime.waitUntil(
            supabase.functions.invoke("ai-analyze-conversation", {
              body: {
                conversation_id: conversationRow.id,
                latest_message_id: messageRow?.id,
              },
            }),
          );
        }
      }
    }

    if (syncLog?.id) {
      await supabase
        .from("quo_sync_logs")
        .update({
          status: "completed",
          details: {
            createdAfter: since,
            fetched: data?.data?.length ?? 0,
            insertedOrUpdated,
            analyzed,
          },
        })
        .eq("id", syncLog.id);
    }

    return jsonResponse({
      success: true,
      fetched: data?.data?.length ?? 0,
      inserted_or_updated: insertedOrUpdated,
      queued_analysis: analyzed,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown reconcile error",
      },
      400,
    );
  }
});
