import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getQuoMessagePreview,
  jsonResponse,
  normalizeQuoPayload,
  verifySignature,
} from "../_shared/quo-ai.ts";

async function isIngestionPaused(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("quo_ai_settings")
    .select("value")
    .eq("key", "quo_webhook_ingestion_paused")
    .maybeSingle();

  if (error) {
    console.error("Could not read Quo webhook pause setting:", error.message);
    return false;
  }

  return data?.value === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase service configuration." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rawBody = await req.text();
  const payload = JSON.parse(rawBody || "{}") as Record<string, unknown>;
  const webhookSecret = Deno.env.get("QUO_WEBHOOK_SECRET") ?? Deno.env.get("QUO_WEBHOOK_TOKEN") ?? undefined;
  const signature = req.headers.get("x-quo-signature") ?? req.headers.get("x-signature");
  const signatureVerified = await verifySignature(rawBody, signature, webhookSecret);

  const eventType =
    typeof payload.type === "string"
      ? payload.type
      : typeof payload.event_type === "string"
        ? payload.event_type
        : typeof payload.eventType === "string"
          ? payload.eventType
          : "message.received";
  const eventId =
    typeof payload.id === "string"
      ? payload.id
      : typeof payload.event_id === "string"
        ? payload.event_id
        : typeof payload.eventId === "string"
          ? payload.eventId
          : null;
  const isMessageEvent = eventType.startsWith("message.");

  let webhookEventId: string | null = null;

  try {
    if (await isIngestionPaused(supabase)) {
      await supabase
        .from("quo_webhook_events")
        .upsert(
          {
            quo_event_id: eventId,
            event_type: eventType,
            raw_payload: payload,
            processing_status: "ignored",
            signature_verified: signatureVerified,
            processed_at: new Date().toISOString(),
            error_message: "Quo Monitor ingestion is paused by an admin testing switch.",
          },
          {
            onConflict: eventId ? "quo_event_id" : "quo_message_id,event_type",
            ignoreDuplicates: true,
          },
        );

      return jsonResponse({
        success: true,
        ignored: true,
        paused: true,
        event_type: eventType,
        reason: "Quo Monitor ingestion is paused.",
      });
    }

    if (!isMessageEvent) {
      await supabase
        .from("quo_webhook_events")
        .upsert(
          {
            quo_event_id: eventId,
            event_type: eventType,
            raw_payload: payload,
            processing_status: "ignored",
            signature_verified: signatureVerified,
            processed_at: new Date().toISOString(),
            error_message: "Non-message Quo event ignored by CRM webhook.",
          },
          {
            onConflict: eventId ? "quo_event_id" : "quo_message_id,event_type",
            ignoreDuplicates: true,
          },
        );

      return jsonResponse({
        success: true,
        ignored: true,
        event_type: eventType,
        reason: "Only message events are processed by this webhook.",
      });
    }

    let normalizedPayload: ReturnType<typeof normalizeQuoPayload>;
    try {
      normalizedPayload = normalizeQuoPayload(payload);
    } catch (error) {
      await supabase
        .from("quo_webhook_events")
        .upsert(
          {
            quo_event_id: eventId,
            event_type: eventType,
            raw_payload: payload,
            processing_status: "ignored",
            signature_verified: signatureVerified,
            processed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : "Message event did not include a processable message payload.",
          },
          {
            onConflict: eventId ? "quo_event_id" : "quo_message_id,event_type",
            ignoreDuplicates: true,
          },
        );

      return jsonResponse({
        success: true,
        ignored: true,
        event_type: eventType,
        reason: "Message event did not include a processable message payload.",
      });
    }

    const { message, conversation } = normalizedPayload;

    const { data: eventData, error: eventError } = await supabase
      .from("quo_webhook_events")
      .upsert(
        {
          quo_event_id: eventId,
          event_type: eventType,
          quo_message_id: message.id,
          quo_conversation_id: conversation.id,
          quo_phone_number_id: conversation.phoneNumberId,
          raw_payload: payload,
          processing_status: "processing",
          signature_verified: signatureVerified,
        },
        {
          onConflict: "quo_message_id,event_type",
          ignoreDuplicates: true,
        },
      )
      .select("id")
      .maybeSingle();

    if (eventError) throw eventError;
    webhookEventId = eventData?.id ?? null;

    let phoneNumberRowId: string | null = null;
    if (conversation.phoneNumberId) {
      const { data: phoneRow, error: phoneError } = await supabase
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

      if (phoneError) throw phoneError;
      phoneNumberRowId = phoneRow.id;
    }

    const { data: existingLead } = conversation.customerNumber
      ? await supabase
          .from("leads")
          .select("id")
          .eq("customer_phone", conversation.customerNumber)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    const messageTime = new Date(message.createdAt).toISOString();
    const { data: conversationRow, error: conversationError } = await supabase
      .from("quo_conversations")
      .upsert(
        {
          quo_conversation_id: conversation.id,
          customer_name: conversation.customerName,
          customer_number: conversation.customerNumber,
          number_id: phoneNumberRowId,
          linked_lead_id: existingLead?.id ?? null,
          last_message_preview: getQuoMessagePreview(message.text, message.media),
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
      .select("id, linked_lead_id")
      .single();

    if (conversationError) throw conversationError;

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

    if (messageError) throw messageError;

    await supabase.from("quo_conversation_flags").upsert(
      { conversation_id: conversationRow.id },
      { onConflict: "conversation_id", ignoreDuplicates: true },
    );

    if (existingLead?.id) {
      await supabase.from("ai_lead_links").upsert(
        {
          conversation_id: conversationRow.id,
          lead_id: existingLead.id,
          match_type: "exact_phone",
          confidence: 1,
          created_by_ai: true,
        },
        { onConflict: "conversation_id,lead_id" },
      );
    }

    if (webhookEventId) {
      await supabase
        .from("quo_webhook_events")
        .update({ processing_status: "processed", processed_at: new Date().toISOString() })
        .eq("id", webhookEventId);
    }

    const debounceSeconds = Number(Deno.env.get("AI_MESSAGE_DEBOUNCE_SECONDS") ?? "60");
    const priority = message.sender !== "customer"
      ? "low"
      : message.text.toLowerCase().match(/urgent|asap|angry|cancel|refund|complaint|emergency/)
        ? "high"
        : "medium";
    const { error: enqueueError } = await supabase.rpc("enqueue_quo_ai_job", {
      _conversation_id: conversationRow.id,
      _latest_message_id: messageRow.id,
      _job_type: "message_analysis",
      _priority: priority,
      _debounce_seconds: Number.isFinite(debounceSeconds) ? debounceSeconds : 60,
    });

    if (enqueueError) {
      console.error("Failed to enqueue Quo AI job:", enqueueError.message);
    }

    return jsonResponse({
      success: true,
      conversation_id: conversationRow.id,
      message_id: messageRow.id,
      linked_lead_id: existingLead?.id ?? conversationRow.linked_lead_id ?? null,
      ai_job_enqueued: true,
    });
  } catch (error) {
    if (webhookEventId) {
      await supabase
        .from("quo_webhook_events")
        .update({
          processing_status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown webhook error",
          processed_at: new Date().toISOString(),
        })
        .eq("id", webhookEventId);
    }

    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown webhook error",
      },
      400,
    );
  }
});
