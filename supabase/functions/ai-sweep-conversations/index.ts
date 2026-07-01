import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/quo-ai.ts";

function envNumber(name: string, fallback: number) {
  const value = Number(Deno.env.get(name));
  return Number.isFinite(value) ? value : fallback;
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
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Supabase service configuration." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const staleHours = envNumber("AI_STALE_CONVERSATION_HOURS", 24);
    const cutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000).toISOString();

    const { data: candidates, error } = await supabase
      .from("quo_conversations")
      .select("id, current_ai_section, last_customer_message_at, last_agent_message_at, last_message_at")
      .not("last_customer_message_at", "is", null)
      .lt("last_customer_message_at", cutoff)
      .not("current_ai_section", "in", '("possible_dead","needs_human_review","lost_found_other_tech","not_a_lead_spam_wrong_number")')
      .order("last_customer_message_at", { ascending: true })
      .limit(envNumber("AI_SWEEP_LIMIT", 50));

    if (error) throw error;

    let markedPossibleDead = 0;
    let queuedAnalysis = 0;

    for (const conversation of candidates ?? []) {
      const agentAfterCustomer =
        conversation.last_agent_message_at &&
        conversation.last_customer_message_at &&
        new Date(conversation.last_agent_message_at).getTime() >
          new Date(conversation.last_customer_message_at).getTime();

      if (agentAfterCustomer) {
        await supabase.from("ai_conversation_states").upsert(
          {
            conversation_id: conversation.id,
            section: "possible_dead",
            priority: "low",
            customer_state: "waiting",
            needs_reply: false,
            is_possible_dead: true,
            confidence: 0.9,
            risk_level: "moderate",
            evidence: [],
            human_review_status: "pending",
          },
          { onConflict: "conversation_id" },
        );
        await supabase
          .from("quo_conversations")
          .update({
            current_ai_section: "possible_dead",
            current_priority: "low",
            rolling_ai_summary:
              "Rule sweep marked this conversation as possible dead because the team replied and the customer has been inactive past the configured threshold.",
            last_ai_analyzed_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);
        markedPossibleDead += 1;
      } else {
        EdgeRuntime.waitUntil(
          supabase.functions.invoke("ai-analyze-conversation", {
            body: { conversation_id: conversation.id },
          }),
        );
        queuedAnalysis += 1;
      }
    }

    return jsonResponse({
      success: true,
      scanned: candidates?.length ?? 0,
      marked_possible_dead: markedPossibleDead,
      queued_analysis: queuedAnalysis,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown sweep error",
      },
      400,
    );
  }
});
