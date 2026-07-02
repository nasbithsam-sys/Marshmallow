import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/quo-ai.ts";

type SupabaseClient = ReturnType<typeof createClient>;

async function requireAdmin(req: Request, supabase: SupabaseClient) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) return { response: jsonResponse({ error: "Unauthorized" }, 401) };

  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) return { response: jsonResponse({ error: "Could not verify role" }, 500) };
  if (roleData?.role !== "admin") return { response: jsonResponse({ error: "Admin access required" }, 403) };

  return { user };
}

async function deleteConversationArtifacts(
  supabase: SupabaseClient,
  conversation: { id: string; quo_conversation_id: string | null },
) {
  const cleanupResults = await Promise.all([
    supabase.from("quo_ai_cost_logs").delete().eq("conversation_id", conversation.id),
    supabase.from("ai_usage_logs").delete().eq("conversation_id", conversation.id),
    conversation.quo_conversation_id
      ? supabase.from("quo_webhook_events").delete().eq("quo_conversation_id", conversation.quo_conversation_id)
      : Promise.resolve({ error: null }),
  ]);
  const cleanupError = cleanupResults.find((result) => result.error)?.error;
  if (cleanupError) throw cleanupError;

  const { error } = await supabase.from("quo_conversations").delete().eq("id", conversation.id);
  if (error) throw error;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function deleteAllConversationArtifacts(
  supabase: SupabaseClient,
  conversations: Array<{ id: string; quo_conversation_id: string | null }>,
) {
  for (const group of chunks(conversations, 250)) {
    const ids = group.map((conversation) => conversation.id);
    const externalIds = group
      .map((conversation) => conversation.quo_conversation_id)
      .filter((id): id is string => Boolean(id));

    const cleanupResults = await Promise.all([
      ids.length ? supabase.from("quo_ai_cost_logs").delete().in("conversation_id", ids) : Promise.resolve({ error: null }),
      ids.length ? supabase.from("ai_usage_logs").delete().in("conversation_id", ids) : Promise.resolve({ error: null }),
      externalIds.length ? supabase.from("quo_webhook_events").delete().in("quo_conversation_id", externalIds) : Promise.resolve({ error: null }),
    ]);
    const cleanupError = cleanupResults.find((result) => result.error)?.error;
    if (cleanupError) throw cleanupError;

    const { error } = await supabase.from("quo_conversations").delete().in("id", ids);
    if (error) throw error;
  }
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

    const auth = await requireAdmin(req, supabase);
    if ("response" in auth) return auth.response;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "get_status") {
      const { data } = await supabase
        .from("quo_ai_settings")
        .select("value")
        .eq("key", "quo_webhook_ingestion_paused")
        .maybeSingle();

      return jsonResponse({
        success: true,
        ingestion_paused: data?.value === true,
      });
    }

    if (action === "set_ingestion_paused") {
      const paused = Boolean(body.paused);
      const { error } = await supabase.from("quo_ai_settings").upsert(
        {
          key: "quo_webhook_ingestion_paused",
          value: paused,
          description:
            "Admin testing switch. When true, quo-webhook acknowledges incoming Quo webhooks but does not store conversations, messages, or AI jobs.",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );

      if (error) throw error;
      return jsonResponse({ success: true, ingestion_paused: paused });
    }

    if (action === "delete_conversation") {
      const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : null;
      if (!conversationId) return jsonResponse({ error: "conversation_id is required." }, 400);

      const { data: conversation, error } = await supabase
        .from("quo_conversations")
        .select("id, quo_conversation_id")
        .eq("id", conversationId)
        .maybeSingle();

      if (error) throw error;
      if (!conversation) return jsonResponse({ error: "Conversation not found." }, 404);

      await deleteConversationArtifacts(supabase, conversation);
      return jsonResponse({ success: true, deleted: 1 });
    }

    if (action === "delete_all_conversations") {
      if (body.confirm !== "DELETE QUO TEST CHATS") {
        return jsonResponse({ error: "Confirmation text is required." }, 400);
      }

      const { data: conversations, error } = await supabase
        .from("quo_conversations")
        .select("id, quo_conversation_id")
        .limit(5000);

      if (error) throw error;

      await deleteAllConversationArtifacts(supabase, conversations ?? []);

      return jsonResponse({ success: true, deleted: conversations?.length ?? 0 });
    }

    return jsonResponse({ error: "Unknown action." }, 400);
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown admin control error",
      },
      400,
    );
  }
});
