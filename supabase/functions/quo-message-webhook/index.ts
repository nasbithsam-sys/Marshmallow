import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getQuoMessagePreview,
  isProcessableQuoWebhookEvent,
  jsonResponse,
  normalizeQuoContactPayload,
  normalizeQuoPayload,
  shouldEnqueueQuoAiForEvent,
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
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

    // Enforce signature when a secret is configured
    if (webhookSecret && !signatureVerified) {
      return jsonResponse({ error: "Invalid webhook signature" }, 401);
    }

    // Respect ingestion-pause admin toggle
    if (await isIngestionPaused(supabase)) {
      return jsonResponse({
        success: true,
        ignored: true,
        paused: true,
        reason: "Quo Monitor ingestion is paused.",
      });
    }

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

    if (eventType === "contact.updated") {
      const contact = normalizeQuoContactPayload(payload);
      let updatedConversations = 0;

      if (contact.name && contact.phoneNumbers.length > 0) {
        const { data: updatedRows, error: updateError } = await supabase
          .from("quo_conversations")
          .update({ customer_name: contact.name, raw_payload: payload })
          .in("customer_number", contact.phoneNumbers)
          .select("id");

        if (updateError) throw updateError;
        updatedConversations = updatedRows?.length ?? 0;
      }

      await supabase
        .from("quo_webhook_events")
        .upsert(
          {
            quo_event_id: eventId,
            event_type: eventType,
            raw_payload: payload,
            processing_status: "processed",
            signature_verified: signatureVerified,
            processed_at: new Date().toISOString(),
            error_message: updatedConversations
              ? `Updated contact name on ${updatedConversations} existing Quo conversation(s).`
              : "Contact update accepted; no matching stored conversation found.",
          },
          {
            onConflict: eventId ? "quo_event_id" : "quo_message_id,event_type",
            ignoreDuplicates: true,
          },
        );

      return jsonResponse({
        success: true,
        event_type: eventType,
        updated_conversations: updatedConversations,
      });
    }

    if (!isProcessableQuoWebhookEvent(eventType)) {
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
            error_message: "Quo event logged but not processed by CRM webhook.",
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
        reason: "This event does not update Quo AI conversations.",
      });
    }

    let normalizedPayload: ReturnType<typeof normalizeQuoPayload>;
    try {
      normalizedPayload = normalizeQuoPayload(payload, eventType);
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
            error_message: error instanceof Error ? error.message : "Quo event did not include a processable payload.",
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
        reason: "Quo event did not include a processable payload.",
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

    if (eventError) throw new Error(`Failed to upsert webhook event: ${eventError.message}`);

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

      if (phoneError) throw new Error(`Failed to upsert phone number: ${phoneError.message}`);
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

    // Preserve any previously-set linked_lead_id so re-upserts don't wipe manual/AI links.
    const { data: existingConversation } = await supabase
      .from("quo_conversations")
      .select("linked_lead_id")
      .eq("quo_conversation_id", conversation.id)
      .maybeSingle();

    const preservedLinkedLeadId =
      existingLead?.id ?? existingConversation?.linked_lead_id ?? null;

    const messageTime = new Date(message.createdAt).toISOString();
    const { data: conversationRow, error: conversationError } = await supabase
      .from("quo_conversations")
      .upsert(
        {
          quo_conversation_id: conversation.id,
          customer_name: conversation.customerName,
          customer_number: conversation.customerNumber,
          number_id: phoneNumberRowId,
          linked_lead_id: preservedLinkedLeadId,
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

    if (conversationError) throw new Error(`Failed to upsert conversation: ${conversationError.message}`);

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

    if (messageError) throw new Error(`Failed to upsert message: ${messageError.message}`);

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

    if (eventData?.id) {
      await supabase
        .from("quo_webhook_events")
        .update({ processing_status: "processed", processed_at: new Date().toISOString() })
        .eq("id", eventData.id);
    }

    let aiJobEnqueued = false;
    if (shouldEnqueueQuoAiForEvent(eventType, message)) {
      // Tag on every message trigger — no debounce delay.
      const priority = message.sender !== "customer"
        ? "medium"
        : message.text.toLowerCase().match(/urgent|asap|angry|cancel|refund|complaint|emergency/)
          ? "high"
          : "medium";

      const { data: jobData, error: enqueueError } = await supabase.rpc("enqueue_quo_ai_job", {
        _conversation_id: conversationRow.id,
        _latest_message_id: messageRow.id,
        _job_type: "message_analysis",
        _priority: priority,
        _debounce_seconds: 0,
      });

      if (enqueueError) {
        console.error("Failed to enqueue Quo AI job:", enqueueError.message);
      } else {
        aiJobEnqueued = true;

        if (jobData) {
          // Fire-and-forget: trigger immediate AI processing so the tag lands live.
          const functionUrl = `${supabaseUrl}/functions/v1/ai-process-quo-jobs`;
          const cronSecret = Deno.env.get("FUNCTION_CRON_SECRET");
          fetch(functionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
              "apikey": serviceRoleKey,
              "x-cron-secret": cronSecret || "",
            },
            body: JSON.stringify({ batch_size: 1, job_ids: [jobData] }),
          }).catch((err) => {
            console.error("Failed to trigger immediate AI job processing:", err.message);
          });
        }
      }
    }

    return jsonResponse({
      success: true,
      conversation_id: conversationRow.id,
      message_id: messageRow.id,
      linked_lead_id: existingLead?.id ?? conversationRow.linked_lead_id ?? null,
      ai_job_enqueued: aiJobEnqueued,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error),
      },
      400,
    );
  }
});
