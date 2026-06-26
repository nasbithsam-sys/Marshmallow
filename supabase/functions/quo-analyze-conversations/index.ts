import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { conversation_id } = await req.json().catch(() => ({}));

    let query = supabase.from('quo_conversations').select('id, last_message_preview, last_message_time, direction, status');
    if (conversation_id) {
        query = query.eq('id', conversation_id);
    }

    const { data: conversations, error: convError } = await query;

    if (convError || !conversations) {
        throw new Error("Failed to fetch conversations");
    }

    for (const conv of conversations) {
        // Fetch last few messages
        const { data: messages } = await supabase
            .from('quo_messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('message_time', { ascending: false })
            .limit(10);

        if (!messages || messages.length === 0) continue;

        let needsFollowUp = false;
        let isImportant = false;
        let isDead = false;
        let isDelayed = false;
        let ruleResult = "Normal";
        let reason = "";

        const lastMsg = messages[0];
        const lastMsgTime = new Date(lastMsg.message_time).getTime();
        const now = new Date().getTime();
        const minsSinceLast = (now - lastMsgTime) / (1000 * 60);

        // Analyze last message
        const lastIncoming = messages.find(m => m.sender === 'customer');
        const lastOutgoing = messages.find(m => m.sender === 'agent');

        // Rule: Last message is incoming and no outgoing reply after 30 minutes
        if (conv.direction === 'incoming' && minsSinceLast > 30) {
            needsFollowUp = true;
            ruleResult = "Needs Follow-Up";
            reason = "No reply to incoming message after 30 minutes.";
        }

        // Rule: Customer asked price, availability, schedule, or service
        const importantKeywords = ['price', 'cost', 'how much', 'availability', 'schedule', 'service', 'address', 'street', 'zip', 'book'];
        const customerMsgsText = messages.filter(m => m.sender === 'customer').map(m => m.text.toLowerCase()).join(" ");
        if (importantKeywords.some(kw => customerMsgsText.includes(kw))) {
            isImportant = true;
            ruleResult = ruleResult === "Normal" ? "Important" : ruleResult + ", Important";
            reason += " Customer mentioned price/availability/details.";
        }

        // Rule: Customer waited more than 60 minutes for our reply
        if (lastOutgoing && lastIncoming) {
            const outTime = new Date(lastOutgoing.message_time).getTime();
            const inTime = new Date(lastIncoming.message_time).getTime();
            if (outTime > inTime && (outTime - inTime) / (1000 * 60) > 60) {
                isDelayed = true;
                ruleResult = "Delayed Response";
                reason = "Agent took more than 60 minutes to reply.";
            }
        }

        // Rule: Customer was interested but no follow-up for 24 hours
        // Simplification: if active conversation and no messages for 24h
        if (conv.status === 'active' && minsSinceLast > 1440) {
            isDead = true;
            ruleResult = "Dead Conversation";
            reason = "No activity for 24 hours.";
        }

        // Update flags
        await supabase.from('quo_conversation_flags').upsert({
            conversation_id: conv.id,
            is_important: isImportant,
            needs_follow_up: needsFollowUp,
            is_delayed: isDelayed,
            is_dead: isDead,
            rule_result: ruleResult,
            reason: reason.trim() || 'No special rules triggered.',
            last_customer_reply_time: lastIncoming ? lastIncoming.message_time : null,
            last_agent_reply_time: lastOutgoing ? lastOutgoing.message_time : null,
        }, { onConflict: 'conversation_id' });
    }

    return new Response(JSON.stringify({ success: true, analyzedCount: conversations.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
