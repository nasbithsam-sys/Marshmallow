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
    const supabaseServiceKey =
      Deno.env.get('SB_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase service configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth Check: only admins can trigger the manual historical sync.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Auth Header' }), { status: 401, headers: corsHeaders })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleError) {
      return new Response(JSON.stringify({ error: 'Could not verify role' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse requested parameters
    const { createdAfter, createdBefore, phoneNumberId, limit = 100 } = await req.json().catch(() => ({}));

    const QUO_API_KEY = Deno.env.get('QUO_API_KEY');
    if (!QUO_API_KEY) {
        throw new Error("Missing QUO_API_KEY");
    }

    // Mock API Base URL (OpenPhone / Quo typically uses api.openphone.com/v1 or similar)
    const API_BASE = Deno.env.get('QUO_API_BASE_URL') ?? "https://api.quo.com/v1";

    // Construct query
    const params = new URLSearchParams();
    if (createdAfter) params.append('createdAfter', createdAfter);
    if (createdBefore) params.append('createdBefore', createdBefore);
    if (phoneNumberId) params.append('phoneNumberId', phoneNumberId);
    params.append('limit', limit.toString());

    // NOTE: Replace with actual Quo/OpenPhone endpoint
    const response = await fetch(`${API_BASE}/messages?${params.toString()}`, {
        method: 'GET',
        headers: {
            // Quo API expects the raw key (no Bearer prefix); matches quo-chat / quo-reconcile-sync.
            'Authorization': QUO_API_KEY,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Quo API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const messages = data.data || [];
    let syncedCount = 0;

    // Log the sync attempt
    const syncLogDetails: Record<string, unknown> = { createdAfter, createdBefore, count: messages.length };
    const { data: syncLog } = await supabase
        .from('quo_sync_logs')
        .insert({
            sync_type: 'history',
            status: 'running',
            details: syncLogDetails
        }).select('id').single();

    for (const msg of messages) {
        // Upsert conversations and messages similarly to the webhook
        const quoMessageId = msg.id;
        const quoConversationId = msg.conversationId;
        const customerName = msg.contact?.name || 'Unknown Contact';
        const customerNumber = msg.contact?.phoneNumbers?.[0]?.value || msg.from;
        const direction = msg.direction === 'inbound' || msg.direction === 'incoming' ? 'incoming' : 'outgoing';
        const sender = direction === 'incoming' ? 'customer' : 'agent';
        const text = msg.text || '';
        const messageTime = msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString();

        const { data: convData, error: convError } = await supabase
            .from('quo_conversations')
            .upsert({
                quo_conversation_id: quoConversationId,
                customer_name: customerName,
                customer_number: customerNumber,
                last_message_preview: text.substring(0, 200),
                last_message_time: messageTime,
                direction: direction,
                status: 'active',
                raw_payload: msg
            }, { onConflict: 'quo_conversation_id' })
            .select('id').single();

        if (convError) continue;

        const { error: msgError } = await supabase
            .from('quo_messages')
            .upsert({
                quo_message_id: quoMessageId,
                conversation_id: convData.id,
                sender: sender,
                text: text,
                message_time: messageTime,
                raw_payload: msg
            }, { onConflict: 'quo_message_id', ignoreDuplicates: false });

        if (!msgError) syncedCount++;

        // Ensure flags exist
        await supabase.from('quo_conversation_flags').upsert({
            conversation_id: convData.id,
        }, { onConflict: 'conversation_id', ignoreDuplicates: true });
    }

    // Update log status
    if (syncLog) {
        await supabase.from('quo_sync_logs').update({
            status: 'completed',
            details: { ...syncLogDetails, syncedCount }
        }).eq('id', syncLog.id);
    }

    return new Response(JSON.stringify({ success: true, syncedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
